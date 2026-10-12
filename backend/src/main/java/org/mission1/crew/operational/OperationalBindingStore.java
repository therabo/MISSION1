package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import com.fasterxml.jackson.databind.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.crew.automatic.FrozenIdentityModel;
import org.mission1.crew.domain.CrewSource;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** All writes are confined to V11 tables. A transaction seals decisions and normalized children. */
@Repository
public class OperationalBindingStore {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final CrewIdentityRepository identity;

  public OperationalBindingStore(
      JdbcTemplate jdbc, ObjectMapper json, CrewIdentityRepository identity) {
    this.jdbc = jdbc;
    this.json = json;
    this.identity = identity;
  }

  public record Job(UUID token, long generation, Instant notifiedAt) {}

  public record FetchJob(String url, UUID token) {}

  public record Saved(
      long id,
      String subject,
      String outcome,
      String provider,
      UUID human,
      String comparison,
      List<String> consequences,
      boolean inserted) {}

  private static OffsetDateTime utc(Instant t) {
    return t == null ? null : t.atOffset(ZoneOffset.UTC);
  }

  String encode(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  static String hash(String s) {
    return CrewHttpReader.sha256(s.getBytes(StandardCharsets.UTF_8));
  }

  @Transactional
  public void install(Instant at) {
    install(at, OperationalPolicy.SHADOW);
  }

  @Transactional
  public void install(Instant at, OperationalPolicy release) {
    String policy = encode(release.release(json));
    var retained =
        jdbc.queryForList(
            "SELECT serialized_policy FROM crew_operational_binding_release WHERE version=?",
            release.version());
    if (!retained.isEmpty()) {
      if (!policy.equals(retained.getFirst().get("serialized_policy")))
        throw new IllegalStateException("Immutable S10 policy mismatch");
      return;
    }
    jdbc.update(
        "INSERT INTO crew_operational_binding_release VALUES(?,?,?,?::jsonb,?,?) ON CONFLICT DO"
            + " NOTHING",
        release.version(),
        utc(at),
        policy,
        policy,
        hash(policy),
        FrozenIdentityModel.SHA);
    String previous =
        jdbc.queryForObject(
            "SELECT serialized_policy FROM crew_operational_binding_release WHERE version=?",
            String.class,
            release.version());
    if (!policy.equals(previous)) throw new IllegalStateException("Immutable S10 policy mismatch");
  }

  @Transactional
  public Optional<Job> claim(Instant at) {
    UUID token = UUID.randomUUID();
    var rows =
        jdbc.queryForList(
            """
            UPDATE crew_operational_binding_work SET claim_token=?,claimed_until=?
            WHERE singleton AND claimed_until<=? AND next_at<=?
            RETURNING generation,notified_at
            """,
            token,
            utc(at.plusSeconds(300)),
            utc(at),
            utc(at));
    return rows.isEmpty()
        ? Optional.empty()
        : Optional.of(
            new Job(
                token,
                ((Number) rows.getFirst().get("generation")).longValue(),
                RetainedOperationalInputs.time(rows.getFirst().get("notified_at"))));
  }

  @Transactional
  public void finish(Job j, Instant at, boolean failure) {
    int n =
        jdbc.update(
            """
            UPDATE crew_operational_binding_work SET completed_generation=CASE WHEN ? THEN completed_generation ELSE ? END,
            failures=CASE WHEN ? THEN failures+1 ELSE 0 END,
            next_at=CASE WHEN generation>? THEN ? ELSE ? END,claimed_until='epoch',claim_token=NULL
            WHERE singleton AND claim_token=? AND claimed_until>?
            """,
            failure,
            j.generation(),
            failure,
            j.generation(),
            utc(at),
            utc(at.plusSeconds(failure ? 300 : 900)),
            j.token(),
            utc(at));
    if (n != 1) throw new IllegalStateException("S10 worker lease lost");
  }

  @Transactional
  public void discover(Collection<String> urls, Instant at) {
    for (String url : new TreeSet<>(urls)) {
      try {
        OperationalResources.allowed(url);
      } catch (IllegalArgumentException e) {
        continue;
      }
      jdbc.update(
          "INSERT INTO crew_operational_resource_work(requested_url,next_at,discovered_at)"
              + " VALUES(?,?,?) ON CONFLICT DO NOTHING",
          url,
          utc(at),
          utc(at));
    }
  }

  @Transactional
  public Optional<FetchJob> claimResource(Instant at) {
    UUID token = UUID.randomUUID();
    var rows =
        jdbc.queryForList(
            """
            UPDATE crew_operational_resource_work SET claim_token=?,claimed_until=? WHERE requested_url=(
              SELECT requested_url FROM crew_operational_resource_work WHERE next_at<=? AND claimed_until<=?
              ORDER BY next_at,requested_url FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING requested_url
            """,
            token,
            utc(at.plusSeconds(120)),
            utc(at),
            utc(at));
    return rows.isEmpty()
        ? Optional.empty()
        : Optional.of(new FetchJob(rows.getFirst().get("requested_url").toString(), token));
  }

  @Transactional
  public void finishResource(FetchJob j, Instant at, boolean success, Instant retryAt) {
    int n =
        jdbc.update(
            """
            UPDATE crew_operational_resource_work SET next_at=?,claimed_until='epoch',claim_token=NULL,
            failures=CASE WHEN ? THEN 0 ELSE failures+1 END WHERE requested_url=? AND claim_token=? AND claimed_until>?
            """,
            utc(success ? at.plus(Duration.ofDays(7)) : retryAt),
            success,
            j.url(),
            j.token(),
            utc(at));
    if (n != 1) throw new IllegalStateException("S10 resource lease lost");
  }

  @Transactional(readOnly = true)
  public boolean hasFreshResource(String url, Instant at) {
    var rows =
        jdbc.queryForList(
            """
            SELECT max(at) captured_at FROM (
              SELECT completed_at at FROM crew_operational_resource_attempt WHERE requested_url=? AND (resource_version_id IS NOT NULL OR reused_editorial_acquisition_id IS NOT NULL)
              UNION ALL SELECT completed_at FROM crew_editorial_acquisition WHERE requested_url=? AND stream='NASA_PERSON_RESOURCE' AND outcome<>'FAILURE'
            ) captures WHERE at<=?
            """,
            url,
            url,
            utc(at));
    return !rows.isEmpty()
        && rows.getFirst().get("captured_at") != null
        && RetainedOperationalInputs.time(rows.getFirst().get("captured_at"))
            .plus(Duration.ofDays(7))
            .isAfter(at);
  }

  @Transactional
  public boolean permit(String host, Instant at) {
    jdbc.execute("SELECT pg_advisory_xact_lock(73491,11)");
    int count =
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_operational_request_permit WHERE host=? AND reserved_at>?",
            Integer.class,
            host,
            utc(at.minusSeconds(3600)));
    int budget = host.equals("ll.thespacedevs.com") ? 3 : 12;
    if (host.equals("ll.thespacedevs.com")) {
      var inherited =
          jdbc.queryForMap(
              """
              SELECT count(*) attempts,max(retry_at) retry_at FROM (
                SELECT started_at at,retry_after_at retry_at FROM crew_source_sync_run
                  WHERE source='LAUNCH_LIBRARY_2' AND result_state NOT LIKE 'SKIPPED_%'
                UNION ALL SELECT started_at,retry_after_at FROM crew_event_catalog_run
              ) attempts WHERE at>?
              """,
              utc(at.minusSeconds(3600)));
      if (count + ((Number) inherited.get("attempts")).intValue() >= 15
          || inherited.get("retry_at") != null
              && RetainedOperationalInputs.time(inherited.get("retry_at")).isAfter(at))
        return false;
    }
    if (count >= budget) return false;
    jdbc.update(
        "INSERT INTO crew_operational_request_permit(host,reserved_at) VALUES(?,?)", host, utc(at));
    return true;
  }

  @Transactional
  public Long retain(OperationalResources.Capture capture, Instant completedAt) {
    Long id = null, reused = null;
    String reason = capture.error() == null ? "ACQUISITION_UNQUALIFIED" : capture.error();
    try {
      var facts =
          new OperationalResources(json)
              .parse(capture, "s10:" + hash(capture.url()) + ":" + capture.hash());
      var existing =
          jdbc.queryForList(
              """
              SELECT a.id FROM crew_editorial_acquisition a JOIN crew_source_document d ON d.id=a.document_id
              WHERE a.requested_url=? AND a.final_url=? AND d.content_hash=? AND a.stream='NASA_PERSON_RESOURCE'
                AND a.outcome<>'FAILURE' AND a.completed_at<=? ORDER BY a.completed_at DESC,a.id DESC LIMIT 1
              """,
              capture.url(),
              capture.finalUrl(),
              capture.hash(),
              utc(completedAt));
      if (!existing.isEmpty()) reused = ((Number) existing.getFirst().get("id")).longValue();
      else {
        jdbc.update(
            """
            INSERT INTO crew_operational_resource_version(requested_url,final_url,redirects,captured_at,http_status,content_type,body_hash,body,parser_version,facts)
            VALUES(?,?,?::jsonb,?,?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING
            """,
            capture.url(),
            capture.finalUrl(),
            encode(capture.redirects()),
            utc(capture.capturedAt()),
            capture.status(),
            capture.contentType(),
            capture.hash(),
            capture.body(),
            OperationalResources.VERSION,
            encode(facts));
        id =
            jdbc.queryForObject(
                "SELECT id FROM crew_operational_resource_version WHERE requested_url=? AND"
                    + " body_hash=? AND parser_version=?",
                Long.class,
                capture.url(),
                capture.hash(),
                OperationalResources.VERSION);
      }
      reason = reused == null ? "CAPTURED_TYPED_FACTS" : "REUSED_V8_TYPED_CAPTURE";
    } catch (IllegalArgumentException e) {
      reason =
          e.getMessage() != null && e.getMessage().matches("[A-Z][A-Z0-9_]{0,99}")
              ? e.getMessage()
              : "VALIDATION_FAILED";
    }
    jdbc.update(
        "INSERT INTO"
            + " crew_operational_resource_attempt(requested_url,attempted_at,completed_at,http_status,reason,resource_version_id,retry_at,reused_editorial_acquisition_id)"
            + " VALUES(?,?,?,?,?,?,?,?)",
        capture.url(),
        utc(capture.capturedAt()),
        utc(completedAt),
        capture.status(),
        reason,
        id,
        utc(capture.retryAt()),
        reused);
    if (reused != null) return -reused;
    return id;
  }

  @Transactional
  public List<Saved> save(
      List<Evaluation> evaluations,
      List<Resource> resources,
      OperationalShadowComparison.Differential differential,
      Instant at,
      Job lease) {
    return save(evaluations, resources, differential, at, lease, OperationalPolicy.SHADOW);
  }

  @Transactional
  public List<Saved> save(
      List<Evaluation> evaluations,
      List<Resource> resources,
      OperationalShadowComparison.Differential differential,
      Instant at,
      Job lease,
      OperationalPolicy release) {
    jdbc.execute("SELECT pg_advisory_xact_lock(73491,10)");
    if (lease != null
        && jdbc.queryForObject(
                "SELECT count(*) FROM crew_operational_binding_work WHERE singleton AND"
                    + " claim_token=? AND claimed_until>?",
                Integer.class,
                lease.token(),
                utc(at))
            != 1) throw new IllegalStateException("S10 evaluation lease lost");
    // Only AFTER local scoring: existing canonical routing, profile publishability and production
    // comparison.
    var knowledge = identity.knowledge(at);
    var targets = new TreeMap<String, UUID>();
    var anchors =
        jdbc.queryForList(
            """
            SELECT DISTINCT x.external_id,x.person_id FROM crew_person_external_id x
            JOIN crew_person_observation o ON o.person_id=x.person_id AND o.source=x.source AND o.external_id=x.external_id
            JOIN crew_source_sync_run r ON r.snapshot_id=o.snapshot_id AND r.result_state='SUCCESS'
            WHERE x.source='LAUNCH_LIBRARY_2' AND r.completed_at<=?
            """,
            utc(at));
    for (var r : anchors) {
      var p =
          knowledge.resolveProviderIdentity(
              CrewCanonicalIdentity.Key.legacy(
                  CrewSource.LAUNCH_LIBRARY_2, r.get("external_id").toString()));
      var canonicalAnchor = knowledge.canonicalize((UUID) r.get("person_id"));
      if (p != null && !p.equals(canonicalAnchor))
        continue; // No publishable V7 route without equivalence.
      p = canonicalAnchor;
      targets.put("LL2:PERSON:" + r.get("external_id"), p);
    }
    var canonicalOwners = new HashMap<String, Set<String>>();
    for (var e : evaluations)
      if (e.outcome() == Outcome.AUTO_MATCH && targets.containsKey(e.candidate()))
        canonicalOwners
            .computeIfAbsent(
                e.subject().evidenceId() + ":" + targets.get(e.candidate()), k -> new HashSet<>())
            .add(e.subject().key());
    var production =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(evidence_id,subject_index) id,evidence_id,subject_index,person_id,method,resolved_at,resolver_version,resolution_hash FROM crew_identity_resolution WHERE resolved_at<=?
            ORDER BY evidence_id,subject_index,resolved_at DESC,id DESC
            """,
            utc(at));
    var resolutions = new HashMap<String, Map<String, Object>>();
    production.forEach(
        r -> resolutions.put(r.get("evidence_id") + ":" + r.get("subject_index"), r));
    Long projection =
        jdbc.queryForObject(
            "SELECT max(id) FROM crew_active_projection_revision WHERE evaluated_at<=?",
            Long.class,
            utc(at));
    var previousRows =
        jdbc.queryForList(
            "SELECT DISTINCT ON(binding_key) * FROM crew_operational_binding_revision ORDER BY"
                + " binding_key,id DESC");
    var previous = new HashMap<String, Map<String, Object>>();
    previousRows.forEach(r -> previous.put(r.get("binding_key").toString(), r));
    var all = new ArrayList<>(evaluations);
    var selected = new HashMap<String, String>();
    evaluations.forEach(e -> selected.put(e.subject().key(), e.subject().identity()));
    for (var old : previous.values()) {
      if (old.get("outcome").equals("SUPERSEDED") || !selected.containsKey(old.get("subject_key")))
        continue;
      try {
        var source =
            json.treeToValue(
                json.readTree(old.get("input_cut").toString()).path("subject"), Subject.class);
        if (!selected.get(source.key()).equals(source.identity()))
          all.add(
              new Evaluation(
                  source,
                  Outcome.SUPERSEDED,
                  null,
                  0,
                  null,
                  0,
                  0,
                  false,
                  List.of("NEW_COMPATIBLE_SOURCE_VERSION_SELECTED"),
                  List.of(),
                  at,
                  0,
                  0));
      } catch (Exception error) {
        throw new IllegalStateException("Stored S10 supersession lineage", error);
      }
    }
    var saved = new ArrayList<Saved>();
    for (var original : all) {
      var e = original;
      var subject = e.subject();
      UUID target = e.candidate() == null ? null : targets.get(e.candidate());
      if (e.outcome() == Outcome.AUTO_MATCH && target == null)
        e =
            new Evaluation(
                subject,
                Outcome.AUTO_DEFER,
                null,
                e.probability(),
                e.runner(),
                e.runnerProbability(),
                e.margin(),
                e.truncated(),
                List.of("NO_PUBLISHABLE_V7_TARGET"),
                e.candidates(),
                e.cut(),
                e.candidateNanos(),
                e.totalNanos());
      if (e.outcome() == Outcome.AUTO_MATCH
          && canonicalOwners.get(subject.evidenceId() + ":" + target).size() > 1)
        e = e.conflict("DISTINCT_SOURCE_SUBJECTS_SAME_V7_HUMAN");
      var prod = resolutions.get(subject.evidenceId() + ":" + subject.index());
      UUID prodPerson = prod == null ? null : knowledge.canonicalize((UUID) prod.get("person_id"));
      String comparison =
          e.outcome() == Outcome.CONFLICT
              ? "SHADOW_CONFLICT"
              : e.outcome() == Outcome.AUTO_MATCH
                  ? prodPerson == null
                      ? "SHADOW_MATCHES_PRODUCTION_UNRESOLVED"
                      : target.equals(prodPerson)
                          ? "SHADOW_AGREES_WITH_PRODUCTION"
                          : "SHADOW_DISAGREES"
                  : prodPerson == null
                      ? "SHADOW_AND_PRODUCTION_UNRESOLVED"
                      : "SHADOW_DEFER_PRODUCTION_MATCHED";
      var consequences =
          new ArrayList<>(differential.effects().getOrDefault(subject.identity(), List.of()));
      if (e.outcome() != Outcome.AUTO_MATCH)
        consequences = new ArrayList<>(List.of("NO_ELIGIBLE_SHADOW_BINDING"));
      else if (!subject.departure() && (prodPerson == null || !target.equals(prodPerson)))
        consequences.add("WOULD_UPDATE_ANNOTATION");
      String binding = hash(subject.identity());
      var old = previous.get(binding);
      var cut = new TreeMap<String, Object>();
      cut.put("subject", subject);
      cut.put("release", release.release(json));
      cut.put("cutSchema", "s10-scoped-resource-fact-digests-v1");
      cut.put("resourceParser", OperationalResources.VERSION);
      cut.put(
          "resources",
          resources.stream()
              .map(
                  r ->
                      List.of(
                          r.ref(),
                          r.hash(),
                          hash(encode(r)),
                          r.capturedAt(),
                          r.validUntil(),
                          r.locator(),
                          r.available(at)))
              .toList());
      if (e.outcome() == Outcome.SUPERSEDED) {
        String replacement = hash(selected.get(subject.key()));
        Long replacementId =
            jdbc.queryForObject(
                "SELECT max(id) FROM crew_operational_binding_revision WHERE binding_key=?",
                Long.class,
                replacement);
        cut.put("supersededBy", Map.of("bindingKey", replacement, "revision", replacementId));
      }
      cut.put("outcome", e.outcome());
      cut.put("gates", e.reasons());
      cut.put("candidateSetTruncated", e.truncated());
      cut.put("v7Targets", targets);
      if (release.version().equals(OperationalPolicy.SHADOW.version())) {
        cut.put("productionResolution", prod);
        cut.put("productionProjection", projection);
      } else {
        // Diagnostic revisions cannot feed back into the semantic S10 cut.
        cut.put(
            "explicitV7Target",
            prod != null
                    && Set.of("EXTERNAL_ID", "AUTHORITATIVE_MAPPING").contains(prod.get("method"))
                ? prodPerson
                : null);
      }
      String serializedCut = encode(cut), inputHash = hash(serializedCut);
      if (old != null && old.get("input_hash").equals(inputHash)) {
        saved.add(
            new Saved(
                ((Number) old.get("id")).longValue(),
                subject.key(),
                old.get("outcome").toString(),
                (String) old.get("target_provider_key"),
                (UUID) old.get("target_person_id"),
                old.get("comparison").toString(),
                consequences,
                false));
        continue;
      }
      String correction =
          e.outcome() == Outcome.SUPERSEDED
              ? "NEW_COMPATIBLE_SOURCE_VERSION_SELECTED"
              : old == null
                  ? "INITIAL_EVALUATION"
                  : old.get("outcome").equals("AUTO_MATCH") && e.outcome() != Outcome.AUTO_MATCH
                      ? "PREVIOUS_MATCH_CONFLICT_OR_REVOKED"
                      : "NEW_EVIDENCE_OR_POLICY_CUT";
      var result = new TreeMap<String, Object>();
      result.put("evaluation", e);
      result.put("productionResolution", prod);
      result.put("productionProjection", projection);
      result.put("shadowBeforeHash", hash(encode(differential.before())));
      result.put("shadowAfterHash", hash(encode(differential.after())));
      result.put("comparison", comparison);
      result.put("consequences", consequences);
      String serializedResult = encode(result);
      Long id =
          jdbc.queryForObject(
              """
              INSERT INTO crew_operational_binding_revision(binding_key,subject_key,source_version,evidence_id,subject_index,document_id,evidence_hash,document_hash,
                predecessor_id,release_version,input_hash,serialized_cut,input_cut,known_at,effective_at,outcome,target_provider_key,target_person_id,
                probability,runner_key,runner_probability,margin,reasons,correction_reason,serialized_result,result,result_hash,
                production_person_id,production_resolution_id,production_projection_id,comparison,consequences)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?::jsonb,?,?,?,?,?,?::jsonb) RETURNING id
              """,
              Long.class,
              binding,
              subject.key(),
              subject.version(),
              subject.evidenceId(),
              subject.index(),
              subject.documentId(),
              subject.evidenceHash(),
              subject.documentHash(),
              old == null ? null : old.get("id"),
              release.version(),
              inputHash,
              serializedCut,
              serializedCut,
              utc(at),
              utc(subject.effectiveAt()),
              e.outcome().name(),
              e.candidate(),
              e.outcome() == Outcome.AUTO_MATCH ? target : null,
              e.probability(),
              e.runner(),
              e.runnerProbability(),
              e.margin(),
              encode(e.reasons()),
              correction,
              serializedResult,
              serializedResult,
              hash(serializedResult),
              prodPerson,
              prod == null ? null : prod.get("id"),
              projection,
              comparison,
              encode(consequences));
      int rank = 0, proofIndex = 0;
      for (var c : e.candidates()) {
        jdbc.update(
            "INSERT INTO crew_operational_binding_candidate VALUES(?,?,?,?::jsonb)",
            id,
            c.key(),
            rank++,
            encode(c));
        for (var p : c.proofs())
          jdbc.update(
              "INSERT INTO crew_operational_binding_proof VALUES(?,?,?,?,?,?,?,?,?,?::jsonb)",
              id,
              proofIndex++,
              c.key(),
              p.resourceRef(),
              p.hash(),
              p.authority().name(),
              p.relation(),
              p.independenceGroup(),
              p.required(),
              encode(p));
      }
      saved.add(
          new Saved(
              id,
              subject.key(),
              e.outcome().name(),
              e.candidate(),
              e.outcome() == Outcome.AUTO_MATCH ? target : null,
              comparison,
              List.copyOf(consequences),
              true));
    }
    return List.copyOf(saved);
  }
}
