package org.mission1.crew.membership;

import static org.mission1.crew.membership.Membership.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** Batched SELECT-only adapter. Acquires a repeatable-read cut after the materializer lock. */
@Repository
public class RetainedMembershipInputs {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final CrewEditorialRepository editorial;
  private final CrewVerificationRepository verification;
  private final ActiveMembershipPolicy policy;

  public RetainedMembershipInputs(
      JdbcTemplate jdbc,
      ObjectMapper json,
      CrewEditorialRepository editorial,
      CrewVerificationRepository verification,
      ActiveMembershipPolicy policy) {
    this.jdbc = jdbc;
    this.json = json;
    this.editorial = editorial;
    this.verification = verification;
    this.policy = policy;
  }

  private JsonNode node(Object o) {
    try {
      return json.readTree(o.toString());
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String hash(Object o) {
    try {
      return CrewHttpReader.sha256(json.writeValueAsBytes(o));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static Long id(Map<String, Object> r, String k) {
    return r == null || r.get(k) == null ? null : ((Number) r.get(k)).longValue();
  }

  static Instant time(Map<String, Object> r, String k) {
    return r == null || r.get(k) == null ? null : ((java.sql.Timestamp) r.get(k)).toInstant();
  }

  static Map<String, Object> first(List<Map<String, Object>> rows) {
    return rows.isEmpty() ? null : rows.getFirst();
  }

  private static Map<String, Object> newest(
      List<Map<String, Object>> rows, String source, String category) {
    return rows.stream()
        .filter(
            r ->
                source.equals(r.get("source"))
                    && (category == null || category.equals(r.get("category"))))
        .max(
            Comparator.comparing((Map<String, Object> r) -> time(r, "completed_at"))
                .thenComparing(r -> id(r, "id")))
        .orElse(null);
  }

  @Transactional(
      readOnly = true,
      propagation = Propagation.REQUIRES_NEW,
      isolation = Isolation.REPEATABLE_READ)
  public Input load(Instant at) {
    var by = at.atOffset(ZoneOffset.UTC);
    var runs =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(source,category) * FROM (
             SELECT *,CASE WHEN result_state='SUCCESS' THEN 'GOOD' WHEN source_state='NO_ACTIVE_EXPEDITION' THEN 'EMPTY' ELSE 'FAILURE' END category
             FROM crew_source_sync_run WHERE station='ISS' AND completed_at<=? AND result_state IN ('SUCCESS','SOURCE_RESULT','INVALID_SNAPSHOT','PERSISTENCE_FAILURE','UNEXPECTED_FAILURE')
            ) r ORDER BY source,category,completed_at DESC,id DESC
            """,
            by);
    var llGood = newest(runs, "LAUNCH_LIBRARY_2", "GOOD");
    var llEmpty = newest(runs, "LAUNCH_LIBRARY_2", "EMPTY");
    var llSelected =
        llEmpty != null
                && (llGood == null
                    || time(llEmpty, "completed_at").isAfter(time(llGood, "completed_at"))
                    || time(llEmpty, "completed_at").equals(time(llGood, "completed_at"))
                        && id(llEmpty, "id") > id(llGood, "id"))
            ? llEmpty
            : llGood;
    var llAttempt = newest(runs, "LAUNCH_LIBRARY_2", null);
    var opGood = newest(runs, "NASA_OFFICIAL", "GOOD");
    var opAttempt = newest(runs, "NASA_OFFICIAL", null);
    var people =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(o.external_id) o.person_id,o.external_id,o.display_name,o.snapshot_id
            FROM crew_person_observation o JOIN crew_source_sync_run r ON r.snapshot_id=o.snapshot_id AND r.result_state='SUCCESS'
            WHERE o.source='LAUNCH_LIBRARY_2' AND r.completed_at<=?
            ORDER BY o.external_id,r.completed_at DESC,r.id DESC LIMIT 10001
            """,
            by);
    if (people.size() > 10000) throw new IllegalStateException("Bounded Crew human scope exceeded");
    var humans =
        people.stream()
            .map(
                r ->
                    new Human(
                        "LL2:PERSON:" + r.get("external_id"),
                        (UUID) r.get("person_id"),
                        (String) r.get("display_name"),
                        id(r, "snapshot_id")))
            .sorted(Comparator.comparing(Human::key))
            .toList();
    Map<UUID, String> keys = new HashMap<>();
    for (var h : humans) keys.put(h.anchor(), h.key());
    Instant llCaptured = time(llSelected, "retrieved_at");
    if (llCaptured == null
        && llSelected != null
        && "NO_ACTIVE_EXPEDITION".equals(llSelected.get("source_state")))
      llCaptured = time(llSelected, "completed_at");
    Freshness llFresh = policy.freshness(llCaptured, policy.temporal().primaryMaxAge(), at);
    var assignments = new ArrayList<Assignment>();
    if (id(llSelected, "snapshot_id") != null)
      for (var r :
          jdbc.queryForList(
              """
              SELECT a.*,e.name expedition_name FROM crew_assignment_observation a JOIN crew_expedition_observation e
              ON e.snapshot_id=a.snapshot_id AND e.expedition_id=a.expedition_id WHERE a.snapshot_id=? ORDER BY a.person_id
              """,
              id(llSelected, "snapshot_id"))) {
        var from = time(r, "valid_from");
        var until = time(r, "valid_until");
        assignments.add(
            new Assignment(
                keys.get((UUID) r.get("person_id")),
                id(r, "snapshot_id"),
                (UUID) r.get("expedition_id"),
                (String) r.get("external_id"),
                (String) r.get("expedition_name"),
                (String) r.get("role"),
                from,
                until,
                time(llSelected, "retrieved_at"),
                llFresh,
                llFresh == Freshness.FRESH
                    && (from == null || !from.isAfter(at))
                    && (until == null || at.isBefore(until))));
      }
    var roster = editorial.latestRoster(at).orElse(null);
    var topic =
        first(
            jdbc.queryForList(
                """
                SELECT a.* FROM crew_editorial_acquisition a WHERE stream='NASA_EDITORIAL_TOPIC' AND outcome<>'FAILURE'
                AND parser_name=? AND parser_version=? AND completed_at<=? ORDER BY completed_at DESC,id DESC LIMIT 1
                """,
                CrewEditorial.PARSER,
                CrewEditorial.VERSION,
                by));
    var topicFacts =
        topic == null
            ? List.<Map<String, Object>>of()
            : jdbc.queryForList(
                """
                SELECT f.* FROM crew_editorial_fact_capture c JOIN crew_editorial_topic_fact f ON f.id=c.fact_id WHERE c.acquisition_id=? ORDER BY f.fact_kind
                """,
                id(topic, "id"));
    var countFact =
        topicFacts.stream()
            .filter(r -> r.get("fact_kind").equals("NASA_WEBSITE_EDITORIAL_REPORTED_ABOARD_COUNT"))
            .findFirst()
            .orElse(null);
    var epochFact =
        topicFacts.stream()
            .filter(r -> r.get("fact_kind").equals("NASA_EDITORIAL_EXPEDITION_NUMBER"))
            .findFirst()
            .orElse(null);
    var graph =
        first(
            jdbc.queryForList(
                "SELECT * FROM crew_auto_graph_revision WHERE applied_at<=? ORDER BY id DESC LIMIT"
                    + " 1",
                by));
    var decisionRows =
        graph == null
            ? List.<Map<String, Object>>of()
            : jdbc.queryForList(
                """
                SELECT d.*,c.candidate_key,f.source_observation_id,o.evidence,h.observation_id head_observation,ho.known_at head_known_at
                FROM crew_auto_graph_application ga JOIN crew_auto_decision_revision d ON d.id=ga.decision_id
                LEFT JOIN crew_auto_candidate c ON c.id=d.candidate_id JOIN crew_auto_feature_snapshot f ON f.snapshot_hash=d.snapshot_hash
                JOIN crew_auto_observation o ON o.id=f.source_observation_id LEFT JOIN crew_auto_input_head h ON h.identity_key=d.source_key
                LEFT JOIN crew_auto_observation ho ON ho.id=h.observation_id
                WHERE ga.graph_id=? ORDER BY d.source_key
                """,
                id(graph, "id"));
    var components = graph == null ? json.createArrayNode() : node(graph.get("components"));
    var decisions = new ArrayList<ShadowMembershipIdentity.Decision>();
    for (var r : decisionRows) {
      String source = (String) r.get("source_key"), target = (String) r.get("candidate_key");
      boolean inComponent = false;
      for (var c : components) {
        Set<String> members = new HashSet<>();
        c.path("members").forEach(n -> members.add(n.asText()));
        if (members.contains(source) && members.contains(target)) inComponent = true;
      }
      decisions.add(
          new ShadowMembershipIdentity.Decision(
              id(r, "id"),
              source,
              target,
              (String) r.get("outcome"),
              id(r, "source_observation_id"),
              node(r.get("evidence")),
              time(r, "head_known_at") != null && time(r, "head_known_at").isAfter(at)
                  || Objects.equals(id(r, "head_observation"), id(r, "source_observation_id")),
              inComponent));
    }
    var boundary =
        new ShadowMembershipIdentity(decisions, humans.stream().map(Human::key).toList());
    var editorialSlots = new ArrayList<Slot>();
    Freshness rosterFresh =
        policy.freshness(roster == null ? null : roster.capturedAt(), policy.rosterAge(), at);
    boolean epochCompatible =
        roster != null
            && epochFact != null
            && ((Number) epochFact.get("value")).intValue() == roster.roster().expedition();
    // A failed topic/mission capture retains last-good membership; an observed epoch mismatch
    // blocks its current eligibility.
    if (roster != null)
      for (var m : roster.roster().members()) {
        String key = "NASA:EDITORIAL_SLOT:" + roster.resource().key() + ":" + m.index();
        var b =
            boundary.bind(
                key, "crew_editorial_roster_member", roster.id() + ":" + m.index(), hash(m));
        editorialSlots.add(
            new Slot(
                key,
                m.name(),
                "NASA_EDITORIAL_EXPEDITION",
                roster.id(),
                m.index(),
                roster.acquisitionId(),
                null,
                null,
                roster.capturedAt(),
                null,
                "UNDATED_EDITORIAL_CAPTURE",
                roster.roster().expedition(),
                rosterFresh,
                epochCompatible,
                b.human(),
                b.decision(),
                b.observation(),
                b.state(),
                m.conflicts()));
      }
    var selected =
        new CrewCompatibleVersionSelector()
            .select(verification.evidenceAsOf(at), verification.occurrenceVersionsAsOf(at));
    var subjectKeys =
        jdbc.queryForList(
            "SELECT s.evidence_id,s.subject_index,v.subject_key,e.evidence_hash FROM"
                + " crew_evidence_subject s JOIN crew_verification_evidence e ON e.id=s.evidence_id"
                + " LEFT JOIN crew_subject_version_link v ON v.evidence_id=s.evidence_id AND"
                + " v.subject_index=s.subject_index");
    Map<String, String> subjects = new HashMap<>();
    Map<Long, String> hashes = new HashMap<>();
    for (var r : subjectKeys) {
      if (r.get("subject_key") != null)
        subjects.put(
            r.get("evidence_id") + ":" + r.get("subject_index"), (String) r.get("subject_key"));
      hashes.put(id(r, "evidence_id"), (String) r.get("evidence_hash"));
    }
    boolean opHealthy =
        opGood != null && (opAttempt == null || id(opAttempt, "id").equals(id(opGood, "id")));
    var events = new ArrayList<Event>();
    for (var item : selected.evidence()) {
      var e = item.value();
      var effective = CrewReconciliationEngine.effectiveTime(e);
      if (e.assertion() == CrewVerificationEvidence.Assertion.PLANNED
          || effective == null
          || effective.isAfter(at)) continue;
      if (e.type() != CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD
          && e.type() != CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
          && e.type() != CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION) continue;
      if (e.type() != CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD
          && e.assertion() != CrewVerificationEvidence.Assertion.COMPLETED) continue;
      boolean applicable =
          opHealthy && policy.temporal().applicable(e, time(opGood, "retrieved_at"), at);
      for (int i = 0; i < e.people().size(); i++) {
        String ref = item.id() + ":" + i;
        String subject = subjects.getOrDefault(ref, "legacy:" + ref);
        String key = "NASA:OPERATIONAL_SUBJECT:" + subject;
        var b = boundary.bind(key, "crew_evidence_subject", ref, hashes.get(item.id()));
        boolean positive = e.type() != CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION;
        var slot =
            new Slot(
                key + ":evidence:" + ref,
                e.people().get(i).displayName(),
                "NASA_OPERATIONAL_FEED",
                null,
                null,
                null,
                item.id(),
                i,
                e.observation().retrievedAt(),
                effective,
                e.observation().sourceEventAt() == null
                    ? "PUBLICATION_TIME_PROXY"
                    : CrewOperationalTime.read(e.evidenceMethod())
                        .map(t -> "SOURCE_EVENT_TIME_" + t.precision())
                        .orElse("SOURCE_EVENT_TIME_PRECISION_UNSPECIFIED"),
                null,
                applicable ? Freshness.FRESH : Freshness.STALE,
                positive,
                b.human(),
                b.decision(),
                b.observation(),
                b.state(),
                List.of());
        events.add(new Event(slot, e.type().name(), e.assertion().name(), applicable));
      }
    }
    var opVerification =
        opGood == null
            ? null
            : new CrewVerificationRepository.Verification(
                id(opGood, "id"),
                id(opGood, "verification_document_id"),
                time(opGood, "retrieved_at"));
    var operationalState =
        new CrewReconciliationEngine(policy.temporal())
            .evaluate(
                new CrewReconciliationEngine.Inputs(
                    null, false, opVerification, opHealthy, selected.evidence(), List.of(), at));
    Integer lastKnown = operationalState.officialCrewCount();
    // Reuse the existing temporal count gate independently from shadow identity/membership.
    boolean countApplicable =
        opHealthy
            && lastKnown != null
            && selected.evidence().stream()
                .anyMatch(
                    e ->
                        e.value().type() == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD
                            && !e.value()
                                .assertion()
                                .equals(CrewVerificationEvidence.Assertion.PLANNED)
                            && policy
                                .temporal()
                                .applicable(e.value(), time(opGood, "retrieved_at"), at));
    var health = new ArrayList<Health>();
    health.add(
        runHealth(
            "LL2_STRUCTURED_CREW", llAttempt, llSelected, policy.temporal().primaryMaxAge(), at));
    health.add(
        runHealth(
            "NASA_OPERATIONAL_FEED",
            opAttempt,
            opGood,
            policy.temporal().verificationMaxAge(),
            at));
    var editorialHealth =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(a.stream,a.requested_url) a.*,
             (SELECT max(b.completed_at) FROM crew_editorial_acquisition b WHERE b.stream=a.stream AND b.requested_url=a.requested_url AND b.outcome<>'FAILURE' AND b.completed_at<=?) good_at
            FROM crew_editorial_acquisition a WHERE a.completed_at<=? ORDER BY a.stream,a.requested_url,a.completed_at DESC,a.id DESC
            """,
            by,
            by);
    for (var h : editorialHealth) {
      String stream = (String) h.get("stream");
      health.add(
          new Health(
              stream,
              (String) h.get("requested_url"),
              (String) h.get("outcome"),
              (String) h.get("reason"),
              id(h, "id"),
              time(h, "completed_at"),
              time(h, "good_at"),
              policy.freshness(
                  time(h, "good_at"),
                  stream.equals("NASA_EDITORIAL_EXPEDITION")
                      ? policy.rosterAge()
                      : stream.equals("NASA_EDITORIAL_TOPIC")
                          ? policy.topicAge()
                          : policy.personalAge(),
                  at)));
    }
    for (var stream :
        List.of("NASA_EDITORIAL_TOPIC", "NASA_EDITORIAL_EXPEDITION", "NASA_PERSON_RESOURCE"))
      if (health.stream().noneMatch(h -> h.stream().equals(stream)))
        health.add(
            new Health(
                stream,
                "",
                "UNAVAILABLE",
                "NO_RETAINED_SOURCE",
                null,
                null,
                null,
                Freshness.NO_DATA));
    var identityHealth =
        new TreeMap<String, Object>(
            jdbc.queryForMap(
                """
                SELECT count(*) FILTER(WHERE failed) failed_jobs,count(*) FILTER(WHERE NOT failed AND generation>completed_generation AND available_at<=?) pending_jobs FROM crew_auto_job
                """,
                by));
    identityHealth.put(
        "degraded",
        graph == null
            || decisions.stream().anyMatch(d -> !d.currentHead())
            || ((Number) identityHealth.get("failed_jobs")).longValue() > 0
            || ((Number) identityHealth.get("pending_jobs")).longValue() > 0);
    if (roster != null && !epochCompatible)
      health.add(
          new Health(
              "NASA_EDITORIAL_EXPEDITION",
              roster.resource().canonicalUrl().toString(),
              "DEGRADED",
              "TOPIC_EXPEDITION_DISAGREEMENT",
              roster.acquisitionId(),
              roster.capturedAt(),
              roster.capturedAt(),
              rosterFresh));
    var cut =
        new Cut(
            id(llSelected, "id"),
            id(llSelected, "snapshot_id"),
            roster == null ? null : roster.acquisitionId(),
            roster == null ? null : roster.id(),
            id(topic, "id"),
            id(countFact, "id"),
            id(graph, "id"),
            id(opGood, "id"),
            id(opAttempt, "id"),
            selected.evidence().stream()
                .map(CrewVerificationRepository.Evidence::id)
                .sorted()
                .toList(),
            selected.choices().stream()
                .map(
                    c -> {
                      Map<String, Object> m = new TreeMap<>();
                      m.put("occurrence", c.occurrenceKey());
                      m.put("evidence", c.selectedEvidenceIds());
                      m.put("observation", c.latestObservation());
                      m.put("ambiguousOrder", c.ambiguousOrder());
                      return m;
                    })
                .toList(),
            health.stream()
                .sorted(Comparator.comparing(Health::stream).thenComparing(Health::resource))
                .toList(),
            identityHealth);
    return new Input(
        cut,
        humans,
        List.copyOf(assignments),
        List.copyOf(editorialSlots),
        List.copyOf(events),
        countFact == null ? null : ((Number) countFact.get("value")).intValue(),
        countApplicable ? lastKnown : null,
        lastKnown,
        llSelected != null && llFresh == Freshness.FRESH,
        rosterFresh == Freshness.FRESH && epochCompatible);
  }

  private static Instant goodCapture(Map<String, Object> good) {
    return good != null && "NO_ACTIVE_EXPEDITION".equals(good.get("source_state"))
        ? time(good, "completed_at")
        : time(good, "retrieved_at");
  }

  private Health runHealth(
      String stream,
      Map<String, Object> attempt,
      Map<String, Object> good,
      Duration age,
      Instant at) {
    return new Health(
        stream,
        attempt == null ? "" : Objects.toString(attempt.get("source_url"), ""),
        attempt == null
            ? "UNAVAILABLE"
            : "SUCCESS".equals(attempt.get("result_state"))
                    || "NO_ACTIVE_EXPEDITION".equals(attempt.get("source_state"))
                ? "SUCCESS"
                : "FAILURE",
        attempt == null
            ? "NO_RETAINED_SOURCE"
            : Objects.toString(attempt.get("source_state"), "UNKNOWN"),
        id(attempt, "id"),
        time(attempt, "completed_at"),
        goodCapture(good),
        policy.freshness(goodCapture(good), age, at));
  }
}
