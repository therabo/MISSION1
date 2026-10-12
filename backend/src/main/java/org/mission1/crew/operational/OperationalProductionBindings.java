package org.mission1.crew.operational;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** One set-based production boundary. Reads sealed facts; cannot acquire, score or write. */
@Repository
public class OperationalProductionBindings {
  public enum Mode {
    S10_SCOPED_BINDING,
    LEGACY_OPERATIONAL_BINDING
  }

  public record Binding(
      String provider, UUID person, Long revision, Long resolution, Instant knownAt, String state) {
    public boolean matched() {
      return provider != null && person != null;
    }
  }

  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final CrewIdentityRepository identities;
  private final Mode mode;

  public OperationalProductionBindings(
      JdbcTemplate jdbc,
      ObjectMapper json,
      CrewIdentityRepository identities,
      @Value("${mission1.crew.operational-binding.mode:S10_SCOPED_BINDING}") Mode mode) {
    this.jdbc = jdbc;
    this.json = json;
    this.identities = identities;
    this.mode = mode;
  }

  public Mode mode() {
    return mode;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Map<String, Binding> resolve(
      List<CrewVerificationRepository.Evidence> evidence, Instant knownAt) {
    if (evidence.isEmpty()) return Map.of();
    var knowledge = identities.knowledge(knownAt);
    String ids =
        "{" + String.join(",", evidence.stream().map(e -> Long.toString(e.id())).toList()) + "}";
    // Deliberately do not filter release/outcome before selecting the exact latest head.
    var rows =
        jdbc.queryForList(
            """
            SELECT b.*,rel.serialized_policy,rel.model_sha,
              s.display_name exact_name,e.evidence_hash exact_hash,e.evidence_type exact_type,e.assertion exact_assertion,
              d.content_hash exact_document_hash,v.subject_key exact_subject,v.version_key exact_version,
              (SELECT count(*) FROM crew_operational_binding_candidate c WHERE c.revision_id=b.id) candidate_count,
              (SELECT count(*) FROM crew_operational_binding_proof p WHERE p.revision_id=b.id) proof_count,
              NOT EXISTS(SELECT FROM crew_operational_binding_candidate c WHERE c.revision_id=b.id
                AND (c.candidate_key IS DISTINCT FROM c.payload->>'key' OR c.payload IS DISTINCT FROM b.result->'evaluation'->'candidates'->c.candidate_rank)) candidates_equal,
              NOT EXISTS(SELECT FROM crew_operational_binding_proof p JOIN crew_operational_binding_candidate c
                ON c.revision_id=p.revision_id AND c.candidate_key=p.candidate_key
                WHERE p.revision_id=b.id AND (NOT c.payload->'proofs' @> jsonb_build_array(p.payload)
                  OR p.resource_ref IS DISTINCT FROM p.payload->>'resourceRef'
                  OR p.resource_hash IS DISTINCT FROM p.payload->>'hash'
                  OR p.authority IS DISTINCT FROM p.payload->>'authority'
                  OR p.relation_type IS DISTINCT FROM p.payload->>'relation'
                  OR p.independence_group IS DISTINCT FROM p.payload->>'independenceGroup'
                  OR p.required IS DISTINCT FROM (p.payload->>'required')::boolean)) proofs_equal
            FROM (SELECT DISTINCT ON(evidence_id,subject_index) * FROM crew_operational_binding_revision
              WHERE evidence_id=ANY(?::bigint[]) AND known_at<=? ORDER BY evidence_id,subject_index,id DESC) b
            JOIN crew_operational_binding_release rel ON rel.version=b.release_version
            JOIN crew_evidence_subject s ON s.evidence_id=b.evidence_id AND s.subject_index=b.subject_index
            JOIN crew_verification_evidence e ON e.id=b.evidence_id JOIN crew_source_document d ON d.id=b.document_id
            LEFT JOIN crew_subject_version_link v ON v.evidence_id=b.evidence_id AND v.subject_index=b.subject_index
            """,
            ids,
            knownAt.atOffset(ZoneOffset.UTC));
    var heads = new HashMap<String, Map<String, Object>>();
    rows.forEach(r -> heads.put(r.get("evidence_id") + ":" + r.get("subject_index"), r));
    var explicitRows =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(evidence_id,subject_index) * FROM crew_identity_resolution
            WHERE evidence_id=ANY(?::bigint[]) AND resolved_at<=?
            ORDER BY evidence_id,subject_index,resolved_at DESC,id DESC
            """,
            ids,
            knownAt.atOffset(ZoneOffset.UTC));
    var explicit = new HashMap<String, Map<String, Object>>();
    explicitRows.forEach(r -> explicit.put(r.get("evidence_id") + ":" + r.get("subject_index"), r));
    var providerRows =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(x.external_id) x.external_id,x.person_id,o.display_name FROM crew_person_external_id x
            JOIN crew_person_observation o ON o.person_id=x.person_id AND o.source=x.source AND o.external_id=x.external_id
            JOIN crew_source_sync_run r ON r.snapshot_id=o.snapshot_id AND r.result_state='SUCCESS'
            WHERE x.source='LAUNCH_LIBRARY_2' AND r.completed_at<=? ORDER BY x.external_id,r.completed_at DESC,r.id DESC
            """,
            knownAt.atOffset(ZoneOffset.UTC));
    var names = new HashMap<String, String>();
    providerRows.forEach(
        r -> names.put("LL2:PERSON:" + r.get("external_id"), r.get("display_name").toString()));
    var targets = new HashMap<String, UUID>();
    providerRows.forEach(
        r -> {
          var canonical = knowledge.canonicalize((UUID) r.get("person_id"));
          var approved =
              knowledge.resolveProviderIdentity(
                  CrewCanonicalIdentity.Key.legacy(
                      CrewSource.LAUNCH_LIBRARY_2, r.get("external_id").toString()));
          if (approved == null || approved.equals(canonical))
            targets.put("LL2:PERSON:" + r.get("external_id"), canonical);
        });
    var result = new TreeMap<String, Binding>();
    for (var e : evidence)
      for (int i = 0; i < e.value().people().size(); i++) {
        String ref = e.id() + ":" + i;
        var old = explicit.get(ref);
        UUID oldPerson = old == null ? null : knowledge.canonicalize((UUID) old.get("person_id"));
        var source = e.value().people().get(i);
        var provider =
            targets.entrySet().stream()
                .filter(
                    x ->
                        x.getValue().equals(oldPerson)
                            && OperationalNames.normalize(source.displayName())
                                .equals(OperationalNames.normalize(names.get(x.getKey()))))
                .map(Map.Entry::getKey)
                .sorted()
                .findFirst()
                .orElse(null);
        boolean strong =
            old != null
                && provider != null
                && ("AUTHORITATIVE_MAPPING".equals(old.get("method"))
                        && old.get("identity_key") != null
                        && oldPerson.equals(
                            knowledge.resolveProviderIdentity(
                                CrewCanonicalIdentity.Key.legacy(
                                    CrewSource.NASA_OFFICIAL, old.get("identity_key").toString())))
                    || "EXTERNAL_ID".equals(old.get("method"))
                        && source.externalIds().stream()
                            .anyMatch(
                                x ->
                                    x.source() == CrewSource.LAUNCH_LIBRARY_2
                                        && targets.containsKey("LL2:PERSON:" + x.value())
                                        && oldPerson.equals(
                                            targets.get("LL2:PERSON:" + x.value()))));
        if (!strong) provider = null;
        var head = heads.get(ref);
        if (head == null) {
          result.put(
              ref,
              new Binding(
                  provider,
                  provider == null ? null : oldPerson,
                  null,
                  provider == null ? null : ((Number) old.get("id")).longValue(),
                  provider == null
                      ? null
                      : ((java.sql.Timestamp) old.get("resolved_at")).toInstant(),
                  provider == null ? "UNRESOLVED" : "EXPLICIT_V7"));
          continue;
        }
        String state = "S10_" + head.get("outcome");
        Long revision = ((Number) head.get("id")).longValue();
        Instant decision = ((java.sql.Timestamp) head.get("known_at")).toInstant();
        String target = (String) head.get("target_provider_key");
        UUID person = (UUID) head.get("target_person_id");
        boolean valid =
            valid(head, e.value(), i, knownAt)
                && person != null
                && person.equals(targets.get(target));
        if (valid && strong && oldPerson != null && !person.equals(oldPerson)) {
          valid = false;
          state = "S10_V7_CONFLICT";
        }
        if (!valid && state.equals("S10_AUTO_MATCH")) state = "S10_INCOMPATIBLE_OR_EXPIRED";
        result.put(
            ref,
            new Binding(
                valid ? target : null, valid ? person : null, revision, null, decision, state));
      }
    return Collections.unmodifiableMap(result);
  }

  /**
   * Validate retained gates and immutable normalized lineage, never recompute identity features.
   */
  boolean valid(Map<String, Object> r, CrewVerificationEvidence e, int index, Instant knownAt) {
    try {
      if (!Set.of(
                  CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                  CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                  CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION)
              .contains(e.type())
          || e.assertion() == CrewVerificationEvidence.Assertion.PLANNED
          || e.type() != CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD
              && e.assertion() != CrewVerificationEvidence.Assertion.COMPLETED) return false;
      if (!"AUTO_MATCH".equals(r.get("outcome"))
          || !OperationalPolicy.PRODUCTION.version().equals(r.get("release_version"))) return false;
      if (!json.writeValueAsString(OperationalPolicy.PRODUCTION.release(json))
              .equals(r.get("serialized_policy"))
          || !org.mission1.crew.automatic.FrozenIdentityModel.SHA.equals(r.get("model_sha")))
        return false;
      String cut = (String) r.get("serialized_cut"), value = (String) r.get("serialized_result");
      if (!hash(cut).equals(r.get("input_hash")) || !hash(value).equals(r.get("result_hash")))
        return false;
      var c = json.readTree(cut);
      var out = json.readTree(value);
      var evaluation = out.path("evaluation");
      var s = c.path("subject");
      if (!c.path("release").equals(json.valueToTree(OperationalPolicy.PRODUCTION.release(json)))
          || !OperationalResources.VERSION.equals(c.path("resourceParser").asText())
          || !"s10-scoped-resource-fact-digests-v1".equals(c.path("cutSchema").asText())
          || !c.has("candidateSetTruncated")
          || c.path("candidateSetTruncated").asBoolean()
          || !"AUTO_MATCH".equals(evaluation.path("outcome").asText())
          || !evaluation.path("candidate").asText().equals(r.get("target_provider_key")))
        return false;
      if (!c.equals(json.readTree(r.get("input_cut").toString()))
          || !out.equals(json.readTree(r.get("result").toString()))) return false;
      if (!s.equals(evaluation.path("subject"))
          || !s.path("integrity").asBoolean()
          || evaluation.path("truncated").asBoolean()
          || !evaluation.path("reasons").isEmpty()
          || !json.readTree(r.get("reasons").toString()).isEmpty()) return false;
      String key =
          r.get("exact_subject") == null
              ? "legacy:" + r.get("evidence_id") + ":" + index
              : r.get("exact_subject").toString();
      String version =
          r.get("exact_version") == null
              ? hash(key + ":" + r.get("exact_hash"))
              : r.get("exact_version").toString();
      if (!key.equals(s.path("key").asText())
          || !e.people().get(index).displayName().equals(r.get("exact_name"))
          || !e.type().name().equals(r.get("exact_type"))
          || !e.assertion().name().equals(r.get("exact_assertion"))
          || !key.equals(r.get("subject_key"))
          || !version.equals(r.get("source_version"))
          || !r.get("evidence_hash").equals(r.get("exact_hash"))
          || !r.get("document_hash").equals(r.get("exact_document_hash"))
          || !s.path("name").asText().equals(e.people().get(index).displayName())
          || !s.path("type").asText().equals(e.type().name())
          || !s.path("assertion").asText().equals(e.assertion().name())
          || !s.path("version").asText().equals(version)
          || !s.path("evidenceHash").asText().equals(r.get("exact_hash"))
          || !s.path("documentHash").asText().equals(r.get("exact_document_hash"))
          || s.path("evidenceId").asLong() != ((Number) r.get("evidence_id")).longValue()
          || s.path("documentId").asLong() != ((Number) r.get("document_id")).longValue()
          || s.path("index").asInt() != index
          || !hash(key + ":" + version + ":" + r.get("exact_hash")).equals(r.get("binding_key")))
        return false;
      if (!Objects.equals(
          CrewReconciliationEngine.effectiveTime(e), Instant.parse(s.path("effectiveAt").asText())))
        return false;
      double probability = ((Number) r.get("probability")).doubleValue(),
          margin = ((Number) r.get("margin")).doubleValue();
      if (!Double.isFinite(probability)
          || !Double.isFinite(margin)
          || probability
              < (e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION ? .999 : .991)
          || margin < .20) return false;
      if (probability != evaluation.path("probability").asDouble(-1)
          || margin != evaluation.path("margin").asDouble(-1)
          || ((Number) r.get("runner_probability")).doubleValue()
              != evaluation.path("runnerProbability").asDouble(-1)) return false;
      if (margin != probability - evaluation.path("runnerProbability").asDouble(-1)
          || !Objects.equals(
              r.get("runner_key"),
              evaluation.path("runner").isNull() ? null : evaluation.path("runner").asText()))
        return false;
      var candidates = evaluation.path("candidates");
      if (candidates.isEmpty()
          || !candidates.get(0).path("key").asText().equals(r.get("target_provider_key")))
        return false;
      double previous = 1.0;
      for (var candidate : candidates) {
        double p = candidate.path("probability").asDouble(-1);
        if (!Double.isFinite(p) || p < 0 || p > previous) return false;
        previous = p;
      }
      if (candidates.size() > 1
          && (candidates.get(1).path("probability").asDouble(-1)
                  != evaluation.path("runnerProbability").asDouble(-1)
              || !candidates.get(1).path("key").equals(evaluation.path("runner")))) return false;
      if (candidates.size() == 1
          && (!evaluation.path("runner").isNull()
              || evaluation.path("runnerProbability").asDouble(-1) != 0)) return false;
      if (((Number) r.get("candidate_count")).intValue() != candidates.size()
          || !Boolean.TRUE.equals(r.get("candidates_equal"))
          || !Boolean.TRUE.equals(r.get("proofs_equal"))) return false;
      int proofs = 0;
      for (var candidate : candidates) proofs += candidate.path("proofs").size();
      if (proofs != ((Number) r.get("proof_count")).intValue()) return false;
      JsonNode winner = null;
      for (var candidate : candidates)
        if (candidate.path("key").asText().equals(r.get("target_provider_key"))) winner = candidate;
      if (winner == null
          || winner.path("probability").asDouble(-1) != probability
          || !winner.path("compatibleName").asBoolean()
          || !winner.path("qualifiedWitness").asBoolean()
          || !winner.path("temporal").asBoolean()
          || !winner.path("contradictions").isEmpty()
          || winner.path("proofs").isEmpty()) return false;
      if (e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION
          && (e.assertion() != CrewVerificationEvidence.Assertion.COMPLETED
              || !winner.path("signals").path("namedMissionFlight").asBoolean())) return false;
      var resources = c.path("resources");
      int required = 0;
      boolean stable = false, flight = false, official = false, agency = false, roster = false;
      Instant effective = CrewReconciliationEngine.effectiveTime(e);
      for (var proof : winner.path("proofs"))
        if (proof.path("required").asBoolean()) {
          required++;
          if (!proof.path("contradiction").isNull()) return false;
          if (proof.hasNonNull("effectiveFrom")
                  && effective.isBefore(Instant.parse(proof.path("effectiveFrom").asText()))
              || proof.hasNonNull("effectiveUntil")
                  && effective.isAfter(Instant.parse(proof.path("effectiveUntil").asText())))
            return false;
          String authority = proof.path("authority").asText(),
              relation = proof.path("relation").asText();
          stable |=
              authority.equals("PROVIDER_STABLE_ID") && relation.equals("EXISTING_PROVIDER_PERSON");
          flight |=
              authority.equals("OFFICIAL_PERSON_FLIGHT_RELATION")
                  && relation.startsWith("PERSON_FLIGHT:")
                  && proof.hasNonNull("effectiveFrom");
          roster |=
              authority.equals("OFFICIAL_NAMED_MISSION_ROSTER")
                  && relation.equals("NAMED_MEMBER_WITH_PERSON_SPECIFIC_FLIGHT");
          agency |=
              authority.equals("AGENCY_OWN_PERSON_RESOURCE")
                  && Set.of("AGENCY_PERSON_AND_PROVIDER_PRECISE_DOB", "NATIVE_NAME_DOB_SELECTION")
                      .contains(relation);
          official |=
              authority.equals("VERIFIED_OFFICIAL_PERSON_RESOURCE")
                  && relation.startsWith("SAME_SUBJECT_DOM_TO_TYPED_PERSON:");
          boolean available = false;
          for (var resource : resources)
            if (resource.get(0).asText().equals(proof.path("resourceRef").asText())
                && resource.get(1).asText().equals(proof.path("hash").asText())
                && resource.get(3).asText().equals(proof.path("capturedAt").asText())
                && resource.get(5).asText().equals(proof.path("locator").asText())
                && !Instant.parse(resource.get(3).asText()).isAfter(knownAt)
                && !Instant.parse(resource.get(4).asText()).isBefore(knownAt)) available = true;
          if (!available) return false;
        }
      return required > 0
          && stable
          && flight
          && (official || agency || roster)
          && (!winner.path("scopedVariant").asBoolean() || agency)
          && (e.type() != CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION || roster);
    } catch (Exception invalid) {
      return false;
    }
  }

  private static String hash(String value) {
    return CrewHttpReader.sha256(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
