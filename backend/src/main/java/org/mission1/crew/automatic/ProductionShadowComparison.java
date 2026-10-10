package org.mission1.crew.automatic;

import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.CrewSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Post-computation diagnostic only. This class is never a worker/model/feature dependency. */
@Service
public class ProductionShadowComparison {
  public enum Classification {
    AGREES,
    SHADOW_MATCH_PRODUCTION_DEFERRED,
    SHADOW_DEFER_PRODUCTION_MATCHED,
    DISAGREES,
    NO_PRODUCTION_REFERENCE
  }

  public record Comparison(
      String source,
      String name,
      String shadowCandidate,
      String shadowOutcome,
      Classification classification,
      UUID productionReference) {}

  private final AutomaticIdentityStore store;
  private final CrewIdentityRepository production;
  private final JdbcTemplate jdbc;

  public ProductionShadowComparison(
      AutomaticIdentityStore store, CrewIdentityRepository production, JdbcTemplate jdbc) {
    this.store = store;
    this.production = production;
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public List<Comparison> read(Instant now) {
    // Persisted outputs are obtained before any production knowledge is read.
    var decisions = store.report();
    var inputs = store.inputs();
    var knowledge = production.knowledge(now);
    Map<String, String> resourceUrls = new HashMap<>();
    jdbc.query(
        "SELECT id,resource_metadata->>'canonicalUrl' FROM crew_editorial_acquisition WHERE"
            + " resource_metadata IS NOT NULL",
        r -> {
          resourceUrls.put(r.getString(1), r.getString(2));
        });
    Map<String, UUID> anchors = new HashMap<>();
    jdbc.query(
        "SELECT source,external_id,person_id FROM crew_person_external_id",
        r -> {
          anchors.put(r.getString(1) + ":" + r.getString(2), r.getObject(3, UUID.class));
        });
    Map<String, IdentityEvidence> facts = new HashMap<>();
    inputs.forEach(i -> facts.put(i.evidence().key(), i.evidence()));
    Map<String, UUID> subjectReferences = new HashMap<>();
    Set<String> productionDeferred = new HashSet<>();
    jdbc.query(
        """
        SELECT DISTINCT ON(coalesce(v.subject_key,'legacy:'||r.evidence_id||':'||r.subject_index))
        coalesce(v.subject_key,'legacy:'||r.evidence_id||':'||r.subject_index),r.person_id
        FROM crew_identity_resolution r LEFT JOIN crew_subject_version_link v
        ON v.evidence_id=r.evidence_id AND v.subject_index=r.subject_index
        ORDER BY coalesce(v.subject_key,'legacy:'||r.evidence_id||':'||r.subject_index),r.resolved_at DESC,r.id DESC
        """,
        r -> {
          String key = "NASA:OPERATIONAL_SUBJECT:" + r.getString(1);
          UUID id = r.getObject(2, UUID.class);
          if (id == null) productionDeferred.add(key);
          else subjectReferences.put(key, knowledge.canonicalize(id));
        });
    List<Comparison> out = new ArrayList<>();
    var pattern =
        Pattern.compile(
            "https://www\\.nasa\\.gov/(?:people|humans-in-space/astronauts|astronauts/biographies)/([a-z0-9-]+)/?");
    for (var d : decisions) {
      String source = d.get("source_key").toString(),
          candidate = Objects.toString(d.get("candidate_key"), null),
          outcome = d.get("outcome").toString();
      var fact = facts.get(source);
      Set<UUID> references = new HashSet<>();
      if (subjectReferences.containsKey(source)) references.add(subjectReferences.get(source));
      for (var ref : fact.references()) {
        String url =
            ref.table().equals("crew_editorial_acquisition")
                ? resourceUrls.getOrDefault(ref.id(), "")
                : "";
        var m = pattern.matcher(ref.locator() + " " + url);
        while (m.find()) {
          String key = "profile:" + m.group(1);
          var id =
              knowledge.resolveProviderIdentity(
                  CrewCanonicalIdentity.Key.legacy(CrewSource.NASA_OFFICIAL, key));
          if (id == null) id = anchors.get("NASA_OFFICIAL:" + key);
          if (id != null) references.add(knowledge.canonicalize(id));
        }
      }
      UUID reference = references.size() == 1 ? references.iterator().next() : null;
      UUID target =
          candidate == null
              ? null
              : knowledge.canonicalize(
                  anchors.get("LAUNCH_LIBRARY_2:" + candidate.substring("LL2:PERSON:".length())));
      Classification c;
      if (references.size() > 1) c = Classification.DISAGREES;
      else if (reference == null && productionDeferred.contains(source))
        c =
            outcome.equals("AUTO_MATCH")
                ? Classification.SHADOW_MATCH_PRODUCTION_DEFERRED
                : Classification.AGREES;
      else if (reference == null)
        c =
            outcome.equals("AUTO_MATCH")
                ? Classification.SHADOW_MATCH_PRODUCTION_DEFERRED
                : Classification.NO_PRODUCTION_REFERENCE;
      else if (!outcome.equals("AUTO_MATCH")) c = Classification.SHADOW_DEFER_PRODUCTION_MATCHED;
      else c = reference.equals(target) ? Classification.AGREES : Classification.DISAGREES;
      out.add(new Comparison(source, fact.name(), candidate, outcome, c, reference));
    }
    return List.copyOf(out);
  }
}
