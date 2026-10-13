package org.mission1.crew.membership;

import static org.mission1.crew.membership.Membership.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** Single writer to the additive projection. Public GET paths have no dependency on this class. */
@Repository
public class ActiveMembershipStore {
  public record Materialized(
      long revision, boolean inserted, String semanticHash, Result result, double millis) {}

  public record Latest(
      long revision, Instant evaluatedAt, Instant createdAt, String semanticHash, Result result) {}

  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final RetainedMembershipInputs inputs;
  private final ActiveMembershipPolicy policy;

  public ActiveMembershipStore(
      JdbcTemplate jdbc,
      ObjectMapper json,
      RetainedMembershipInputs inputs,
      ActiveMembershipPolicy policy) {
    this.jdbc = jdbc;
    this.json = json;
    this.inputs = inputs;
    this.policy = policy;
  }

  public String encode(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public String hash(String s) {
    return CrewHttpReader.sha256(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  private static OffsetDateTime utc(Instant t) {
    return t == null ? null : t.atOffset(ZoneOffset.UTC);
  }

  @Transactional(isolation = Isolation.READ_COMMITTED)
  public Materialized materialize(Instant evaluationTime) {
    long begin = System.nanoTime();
    Instant at = evaluationTime.truncatedTo(ChronoUnit.MICROS);
    jdbc.execute("SELECT pg_advisory_xact_lock(73491,6)");
    long generation =
        jdbc.queryForObject(
            "SELECT generation FROM crew_active_projection_work WHERE singleton", Long.class);
    // Separate read transaction begins after acquiring the writer lock. Waiting writers cannot use
    // an old snapshot.
    var input = inputs.load(at);
    var result = policy.evaluate(input, at);
    String cut = encode(result.cut()),
        meaning = encode(result),
        inputHash = hash(cut),
        semanticHash = hash(meaning);
    var latest =
        jdbc.queryForList(
            "SELECT id,input_hash,semantic_hash FROM crew_active_projection_revision ORDER BY id"
                + " DESC LIMIT 1");
    Long predecessor = latest.isEmpty() ? null : ((Number) latest.getFirst().get("id")).longValue();
    if (!latest.isEmpty()
        && inputHash.equals(latest.getFirst().get("input_hash"))
        && semanticHash.equals(latest.getFirst().get("semantic_hash"))) {
      finish(generation, at);
      return new Materialized(
          predecessor, false, semanticHash, result, (System.nanoTime() - begin) / 1e6);
    }
    var c = result.cut();
    long revision =
        jdbc.queryForObject(
            """
            INSERT INTO crew_active_projection_revision(predecessor_id,policy_version,identity_mode,evaluated_at,created_at,
             ll2_run_id,ll2_snapshot_id,roster_acquisition_id,roster_id,topic_acquisition_id,topic_count_fact_id,graph_id,
             operational_run_id,operational_attempt_id,input_hash,semantic_hash,serialized_cut,input_cut,serialized_result,result,health)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?::jsonb,?) RETURNING id
            """,
            Long.class,
            predecessor,
            policy.key(),
            inputs.identityMode(),
            utc(at),
            utc(at),
            c.ll2Run(),
            c.ll2Snapshot(),
            c.rosterAcquisition(),
            c.roster(),
            c.topicAcquisition(),
            c.topicCountFact(),
            c.graph(),
            c.operationalRun(),
            c.operationalAttempt(),
            inputHash,
            semanticHash,
            cut,
            cut,
            meaning,
            meaning,
            result.health().name());
    var memberRows = new ArrayList<Object[]>();
    var supportRows = new ArrayList<Object[]>();
    for (var m : result.members()) {
      memberRows.add(
          new Object[] {
            revision,
            m.human().key(),
            m.human().anchor(),
            m.state().name(),
            m.human().profileSnapshot(),
            m.departureVeto(),
            encode(m)
          });
      for (var s : m.supports())
        supportRows.add(
            new Object[] {
              revision,
              m.human().key(),
              s.key(),
              s.type().name(),
              s.stream(),
              utc(s.capturedAt()),
              utc(s.effectiveAt()),
              s.precision(),
              s.freshness().name(),
              s.eligible(),
              s.snapshot(),
              s.expeditionId(),
              s.snapshot() == null ? null : m.human().anchor(),
              s.acquisition(),
              s.roster(),
              s.memberIndex(),
              s.evidence(),
              s.subjectIndex(),
              s.decision(),
              s.observation(),
              s.supersededByDeparture(),
              encode(s)
            });
    }
    jdbc.batchUpdate(
        "INSERT INTO crew_active_projection_member VALUES (?,?,?,?,?,?,?::jsonb)", memberRows);
    var captureRows = new ArrayList<Object[]>();
    for (var h : c.health())
      if (h.attemptId() != null) {
        boolean sourceRun =
            h.stream().equals("LL2_STRUCTURED_CREW") || h.stream().equals("NASA_OPERATIONAL_FEED");
        captureRows.add(
            new Object[] {
              revision,
              "HEALTH:" + h.stream() + ":" + h.resource(),
              h.stream(),
              sourceRun ? h.attemptId() : null,
              sourceRun ? null : h.attemptId(),
              null
            });
      }
    for (var choice : c.occurrenceChoices())
      if (choice.get("observation")
          instanceof org.mission1.crew.domain.CrewOccurrenceVersion.Observation o)
        captureRows.add(
            new Object[] {
              revision,
              "OPERATIONAL:" + choice.get("occurrence"),
              "NASA_OPERATIONAL_FEED",
              o.runId(),
              null,
              o.documentId()
            });
    var uniqueCaptures = new TreeMap<String, Object[]>();
    for (var row : captureRows) uniqueCaptures.put(row[1].toString(), row);
    jdbc.batchUpdate(
        "INSERT INTO crew_active_projection_input_capture VALUES (?,?,?,?,?,?)",
        new ArrayList<>(uniqueCaptures.values()));

    // Exact selected operational assertion cut, with original document FKs.
    if (!c.evidence().isEmpty())
      jdbc.update(
          """
          INSERT INTO crew_active_projection_evidence SELECT ?,id,document_id FROM crew_verification_evidence WHERE id=ANY(?::bigint[])
          """,
          revision,
          "{" + String.join(",", c.evidence().stream().map(Object::toString).toList()) + "}");
    if (inputs.modern()) {
      var bindings = json.valueToTree(c.identityHealth()).path("bindings");
      var bindingRows = new ArrayList<Object[]>();
      bindings
          .fields()
          .forEachRemaining(
              entry -> {
                var b = entry.getValue();
                if (!b.hasNonNull("provider")) return;
                var ref = entry.getKey().split(":");
                bindingRows.add(
                    new Object[] {
                      revision,
                      Long.parseLong(ref[0]),
                      Integer.parseInt(ref[1]),
                      b.path("provider").asText(),
                      b.hasNonNull("revision") ? b.path("revision").asLong() : null,
                      b.hasNonNull("resolution") ? b.path("resolution").asLong() : null,
                      utc(Instant.parse(b.path("knownAt").asText())),
                      encode(b)
                    });
              });
      jdbc.batchUpdate(
          "INSERT INTO crew_active_projection_binding VALUES(?,?,?,?,?,?,?,?::jsonb)", bindingRows);
    }
    jdbc.batchUpdate(
        """
        INSERT INTO crew_active_projection_support VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb)
        """,
        supportRows);
    var slotRows = new ArrayList<Object[]>();
    for (var u : result.unresolved()) {
      var s = u.slot();
      slotRows.add(
          new Object[] {
            revision,
            s.key(),
            u.state(),
            s.acquisition(),
            s.roster(),
            s.memberIndex(),
            s.evidence(),
            s.subjectIndex(),
            s.decision(),
            s.observation(),
            encode(u)
          });
    }
    jdbc.batchUpdate(
        "INSERT INTO crew_active_projection_slot VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb)", slotRows);
    jdbc.batchUpdate(
        "INSERT INTO crew_active_projection_finding VALUES (?,?,?,?,?)",
        result.findings().stream()
            .map(f -> new Object[] {revision, f.namespace(), f.code(), f.subject(), f.detail()})
            .toList());
    finish(generation, at);
    System.getLogger(getClass().getName())
        .log(
            System.Logger.Level.INFO,
            "Crew lifecycle mode="
                + inputs.identityMode()
                + ": revision={0}, active={1}, retained={2}, unresolved_active={3},"
                + " conflicts={4}, departure_vetoes={5}, health={6}",
            revision,
            result.counts().resolvedActiveHumans(),
            result.counts().retainedHumans(),
            result.counts().unresolvedActiveSlots(),
            result.findings().size(),
            result.members().stream().filter(m -> m.departureVeto() != null).count(),
            result.health());
    return new Materialized(
        revision, true, semanticHash, result, (System.nanoTime() - begin) / 1e6);
  }

  private void finish(long generation, Instant at) {
    jdbc.update(
        "UPDATE crew_active_projection_work SET"
            + " completed_generation=greatest(completed_generation,?),last_success_at=? WHERE"
            + " singleton",
        generation,
        utc(at));
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void failure() {
    jdbc.update("UPDATE crew_active_projection_work SET failures=failures+1 WHERE singleton");
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Optional<Latest> latest() {
    return jdbc
        .query(
            "SELECT * FROM crew_active_projection_revision ORDER BY id DESC LIMIT 1",
            (r, n) -> {
              try {
                return new Latest(
                    r.getLong("id"),
                    r.getObject("evaluated_at", OffsetDateTime.class).toInstant(),
                    r.getObject("created_at", OffsetDateTime.class).toInstant(),
                    r.getString("semantic_hash"),
                    json.readValue(r.getString("serialized_result"), Result.class));
              } catch (Exception e) {
                throw new IllegalStateException("Invalid shadow projection", e);
              }
            })
        .stream()
        .findFirst();
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Map<String, Object> health(Instant at) {
    var latest = latest();
    Map<String, Object> h =
        new TreeMap<>(
            jdbc.queryForMap(
                "SELECT generation,completed_generation,last_success_at,failures FROM"
                    + " crew_active_projection_work WHERE singleton"));
    h.put("shadow_projection_failures", h.get("failures"));
    h.put(
        "shadow_projection_revisions",
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Long.class));
    h.put(
        "shadow_projection_age_seconds",
        latest
            .map(l -> Math.max(0, Duration.between(l.evaluatedAt(), at).toSeconds()))
            .orElse(-1L));
    if (latest.isPresent()) {
      var r = latest.get().result();
      h.put("shadow_active_members", r.counts().resolvedActiveHumans());
      h.put("shadow_retained_people", r.counts().retainedHumans());
      h.put("shadow_unresolved_active_slots", r.counts().unresolvedActiveSlots());
      h.put(
          "shadow_membership_conflicts",
          r.findings().stream().filter(f -> f.namespace().equals("MEMBERSHIP")).count());
      h.put(
          "shadow_departure_vetoes",
          r.members().stream().filter(m -> m.departureVeto() != null).count());
      for (var type : Type.values())
        h.put(
            "shadow_membership_" + type.name().toLowerCase(Locale.ROOT) + "_supported",
            r.members().stream()
                .filter(m -> m.supports().stream().anyMatch(s -> s.type() == type && s.eligible()))
                .count());
      h.put("projectionHealth", r.health());
    }
    return Collections.unmodifiableMap(h);
  }
}
