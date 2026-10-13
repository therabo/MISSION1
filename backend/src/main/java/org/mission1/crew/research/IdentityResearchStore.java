package org.mission1.crew.research;

import static org.mission1.crew.research.IdentityEvidence.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** Only crew_auto_* writes. All mutations are outside public reads. */
@Repository
public class IdentityResearchStore {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public IdentityResearchStore(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public record Input(long id, IdentityEvidence evidence) {}

  public record Job(String key, String identity, long generation, UUID token, int attempts) {}

  public record Scored(
      String candidate, long observation, double[] features, FrozenIdentityModel.Score score) {}

  public record Evaluation(
      String source,
      String best,
      Double probability,
      String runner,
      double runnerProbability,
      double margin,
      int candidateCount,
      IdentityPolicy.Result result,
      long revision) {}

  public String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public String hash(Object value) {
    return CrewHttpReader.sha256(encode(value).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  private static OffsetDateTime utc(Instant at) {
    return at.atOffset(ZoneOffset.UTC);
  }

  private void lock() {
    jdbc.execute("SELECT pg_advisory_xact_lock(73491,5)");
  }

  @Transactional
  public void installRelease(String modelVersion, String policyVersion, Instant now) {
    lock();
    var policy =
        Map.of(
            "corroboration",
            "SOURCE_SCOPED_PERSONAL_WITNESS",
            "conflict",
            "AUTHORITY_AND_WHOLE_COMPONENT",
            "mode",
            "SHADOW",
            "separateCutoff",
            IdentityPolicy.SEPARATE);
    int inserted =
        jdbc.update(
            """
            INSERT INTO crew_auto_release VALUES (?,?,?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING
            """,
            modelVersion,
            policyVersion,
            FrozenIdentityModel.SCHEMA,
            FrozenIdentityModel.SHA,
            FrozenIdentityModel.LEXICAL_SHA,
            IdentityPolicy.THRESHOLD,
            IdentityPolicy.MARGIN,
            encode(policy));
    // Immutable release IDs cannot be reused with different semantics.
    var release =
        jdbc.queryForMap(
            "SELECT * FROM crew_auto_release WHERE model_version=? AND policy_version=?",
            modelVersion,
            policyVersion);
    if (!release.get("model_sha").equals(FrozenIdentityModel.SHA)
        || !release.get("feature_schema").equals(FrozenIdentityModel.SCHEMA)
        || !release.get("lexical_sha").equals(FrozenIdentityModel.LEXICAL_SHA)
        || ((Number) release.get("match_threshold")).doubleValue() != IdentityPolicy.THRESHOLD
        || ((Number) release.get("minimum_margin")).doubleValue() != IdentityPolicy.MARGIN)
      throw new IllegalStateException("Release ID collision");
    if (inserted > 0)
      for (String k :
          jdbc.queryForList(
              "SELECT identity_key FROM crew_auto_identity WHERE provider='NASA'", String.class))
        enqueue(k, now);
  }

  private void enqueue(String identity, Instant now) {
    jdbc.update(
        """
        INSERT INTO crew_auto_job(job_key,job_kind,identity_key,available_at,enqueued_at) VALUES (?,'EVALUATE',?,?,?)
        ON CONFLICT(job_key) DO UPDATE SET generation=crew_auto_job.generation+1,available_at=excluded.available_at,
        enqueued_at=excluded.enqueued_at,attempts=0,failed=false,last_error=NULL
        """,
        "E:" + identity,
        identity,
        utc(now),
        utc(now));
  }

  @Transactional
  public void requestImport(Instant now) {
    jdbc.update(
        """
        INSERT INTO crew_auto_job(job_key,job_kind,available_at,enqueued_at) VALUES ('IMPORT','IMPORT',?,?)
        ON CONFLICT(job_key) DO UPDATE SET generation=crew_auto_job.generation+1,available_at=excluded.available_at,enqueued_at=excluded.enqueued_at,failed=false,attempts=0
        """,
        utc(now),
        utc(now));
  }

  @Transactional
  public int retain(List<IdentityEvidence> evidence, Instant now) {
    lock();
    var before = inputs();
    Map<String, Input> old = new HashMap<>();
    before.forEach(i -> old.put(i.evidence().key(), i));
    List<IdentityEvidence> changed = new ArrayList<>();
    for (var r : evidence) {
      jdbc.update(
          "INSERT INTO crew_auto_identity(identity_key,provider,entity_kind) VALUES (?,?,?) ON"
              + " CONFLICT DO NOTHING",
          r.key(),
          r.provider().name(),
          r.kind().name());
      String h = hash(r);
      jdbc.update(
          "INSERT INTO"
              + " crew_auto_observation(identity_key,evidence_hash,extractor_version,evidence,known_at)"
              + " VALUES (?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING",
          r.key(),
          h,
          FrozenIdentityModel.SCHEMA,
          encode(r),
          utc(now));
    }
    Map<String, Long> versions = new HashMap<>();
    jdbc.query(
        "SELECT id,identity_key,evidence_hash FROM crew_auto_observation WHERE extractor_version=?",
        r -> {
          versions.put(r.getString(2) + ":" + r.getString(3), r.getLong(1));
        },
        FrozenIdentityModel.SCHEMA);
    for (var r : evidence) {
      Long id = versions.get(r.key() + ":" + hash(r));
      if (old.containsKey(r.key()) && old.get(r.key()).id() == id) continue;
      jdbc.update(
          "INSERT INTO crew_auto_input_head VALUES (?,?) ON CONFLICT(identity_key) DO UPDATE SET"
              + " observation_id=excluded.observation_id",
          r.key(),
          id);
      changed.add(r);
      if (r.provider() == Provider.NASA) enqueue(r.key(), now);
    }
    // Changes on the LL2 side invalidate only blocked NASA inputs and previous pair dependencies.
    var all = inputs();
    var nasa =
        all.stream().map(Input::evidence).filter(r -> r.provider() == Provider.NASA).toList();
    var changedLl2 = changed.stream().filter(r -> r.provider() == Provider.LL2).toList();
    if (!changedLl2.isEmpty()) {
      var index = new IdentityCandidates(changedLl2);
      Set<String> affected = new TreeSet<>();
      for (var n : nasa) if (!index.retrieve(n).candidates().isEmpty()) affected.add(n.key());
      Set<String> keys = new HashSet<>();
      changedLl2.forEach(r -> keys.add(r.key()));
      jdbc.query(
          "SELECT source_key,candidate_key FROM crew_auto_candidate",
          r -> {
            if (keys.contains(r.getString(2))) affected.add(r.getString(1));
          });
      for (var k : affected) enqueue(k, now);
    }
    var components = IdentityResearchGraph.project(old.keySet(), edges());
    Set<String> affectedComponents = new TreeSet<>();
    for (var r : changed)
      for (var c : components)
        if (c.members().contains(r.key()))
          for (var k : c.members()) if (k.startsWith("NASA:")) affectedComponents.add(k);
    for (var k : affectedComponents) enqueue(k, now);
    return changed.size();
  }

  @Transactional(readOnly = true)
  public List<Input> inputs() {
    return jdbc.query(
        "SELECT o.id,o.evidence FROM crew_auto_input_head h JOIN crew_auto_observation o ON"
            + " o.id=h.observation_id ORDER BY h.identity_key",
        (r, n) -> {
          try {
            return new Input(r.getLong(1), json.readValue(r.getString(2), IdentityEvidence.class));
          } catch (Exception e) {
            throw new IllegalStateException(e);
          }
        });
  }

  @Transactional
  public Optional<Job> claim(Instant now) {
    return jdbc
        .query(
            """
            WITH due AS (SELECT job_key FROM crew_auto_job WHERE NOT failed AND available_at<=?
              AND (lease_until IS NULL OR lease_until<=?) AND (generation>completed_generation OR job_kind='EVALUATE')
              ORDER BY CASE WHEN job_kind='IMPORT' THEN 0 ELSE 1 END,available_at,job_key FOR UPDATE SKIP LOCKED LIMIT 1)
            UPDATE crew_auto_job j SET lease_until=?,lease_token=?,attempts=least(attempts+1,8)
            FROM due WHERE j.job_key=due.job_key RETURNING j.*
            """,
            (r, n) ->
                new Job(
                    r.getString("job_key"),
                    r.getString("identity_key"),
                    r.getLong("generation"),
                    r.getObject("lease_token", UUID.class),
                    r.getInt("attempts")),
            utc(now),
            utc(now),
            utc(now.plusSeconds(300)),
            UUID.randomUUID())
        .stream()
        .findFirst();
  }

  @Transactional
  public void finish(Job job, Instant now, boolean deferred) {
    Duration delay =
        deferred
            ? Duration.ofHours(
                job.attempts() <= 1 ? 2 : job.attempts() == 2 ? 6 : job.attempts() == 3 ? 24 : 168)
            : Duration.ofDays(36500);
    jdbc.update(
        """
        UPDATE crew_auto_job SET completed_generation=greatest(completed_generation,?),lease_until=NULL,lease_token=NULL,
        available_at=CASE WHEN generation>? THEN ? ELSE ? END,last_success_at=?,last_error=NULL,
        attempts=CASE WHEN ? THEN attempts ELSE 0 END
        WHERE job_key=? AND lease_token=?
        """,
        job.generation(),
        job.generation(),
        utc(now),
        utc(now.plus(delay)),
        utc(now),
        deferred,
        job.key(),
        job.token());
  }

  @Transactional
  public void fail(Job job, Instant now, RuntimeException error) {
    jdbc.update(
        "UPDATE crew_auto_job SET"
            + " lease_until=NULL,lease_token=NULL,failed=(attempts>=8),last_error=?,available_at=?"
            + " WHERE job_key=? AND lease_token=?",
        error.getClass().getSimpleName(),
        utc(now.plusSeconds(Math.min(7200, 900L * (1L << Math.min(job.attempts() - 1, 3))))),
        job.key(),
        job.token());
  }

  @Transactional
  public boolean safetySweep(Instant now, String model, String policy) {
    if (jdbc.update(
            "UPDATE crew_auto_sweep_lease SET next_at=? WHERE singleton AND next_at<=?",
            utc(now.plus(Duration.ofDays(1))),
            utc(now))
        != 1) return false;
    requestImport(now);
    for (String key :
        jdbc.queryForList(
            """
            SELECT i.identity_key FROM crew_auto_identity i LEFT JOIN LATERAL
            (SELECT * FROM crew_auto_decision_revision WHERE source_key=i.identity_key ORDER BY id DESC LIMIT 1) d ON true
            WHERE i.provider='NASA' AND (d.id IS NULL OR d.model_version<>? OR d.policy_version<>? OR
            (d.outcome='AUTO_DEFER' AND d.evaluated_at<?))
            """,
            String.class,
            model,
            policy,
            utc(now.minus(Duration.ofDays(7))))) enqueue(key, now);
    return true;
  }

  public List<IdentityResearchGraph.Edge> edges() {
    return jdbc.query(
        """
        SELECT DISTINCT ON(d.source_key) d.source_key,c.candidate_key,d.outcome,d.id
        FROM crew_auto_decision_revision d LEFT JOIN crew_auto_candidate c ON c.id=d.candidate_id
        ORDER BY d.source_key,d.id DESC
        """,
        (r, n) ->
            new IdentityResearchGraph.Edge(
                r.getString(1),
                r.getString(2),
                IdentityPolicy.Outcome.valueOf(r.getString(3)),
                r.getLong(4)));
  }

  @Transactional
  public Evaluation evaluate(
      String sourceKey,
      FrozenIdentityModel model,
      String modelVersion,
      String policyVersion,
      Instant now) {
    lock();
    var inputs = inputs();
    Map<String, Input> keyed = new TreeMap<>();
    Map<String, IdentityEvidence> facts = new TreeMap<>();
    inputs.forEach(
        i -> {
          keyed.put(i.evidence().key(), i);
          facts.put(i.evidence().key(), i.evidence());
        });
    var source = Objects.requireNonNull(keyed.get(sourceKey), "Missing retained source");
    if (source.evidence().provider() != Provider.NASA)
      throw new IllegalArgumentException("NASA source required");
    var block = new IdentityCandidates(facts.values()).retrieve(source.evidence());
    var extractor = new IdentityFeatures(model);
    List<Scored> scores = new ArrayList<>();
    for (var candidate : block.candidates()) {
      var features = extractor.extract(candidate, source.evidence());
      scores.add(
          new Scored(
              candidate.key(), keyed.get(candidate.key()).id(), features, model.score(features)));
    }
    scores.sort(
        Comparator.<Scored>comparingDouble(s -> s.score().probability())
            .reversed()
            .thenComparing(Scored::candidate));
    Scored best = scores.isEmpty() ? null : scores.getFirst(),
        runner = scores.size() < 2 ? null : scores.get(1);
    double p = best == null ? 0 : best.score().probability(),
        second = runner == null ? 0 : runner.score().probability();
    var component =
        best == null
            ? List.<String>of()
            : IdentityResearchGraph.validate(sourceKey, best.candidate(), facts, edges());
    IdentityPolicy.Result result =
        best == null
            ? new IdentityPolicy.Result(
                IdentityPolicy.Outcome.AUTO_DEFER,
                List.of(),
                List.of(),
                List.of("NO_CANDIDATES", "MISSING_EVIDENCE"))
            : new IdentityPolicy()
                .decide(
                    facts.get(best.candidate()),
                    source.evidence(),
                    best.features(),
                    p,
                    second,
                    component);
    if (block.truncated())
      result =
          new IdentityPolicy.Result(
              IdentityPolicy.Outcome.AUTO_DEFER,
              result.witnesses(),
              result.conflicts(),
              List.of("TRUNCATED_CANDIDATE_BLOCK"));
    Map<String, Object> snapshot = new TreeMap<>();
    snapshot.put("sourceObservation", source.id());
    snapshot.put("candidates", scores);
    snapshot.put("blockTruncated", block.truncated());
    snapshot.put("policyResult", result);
    String snapshotHash = hash(snapshot);
    jdbc.update(
        "INSERT INTO crew_auto_feature_snapshot VALUES (?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING",
        snapshotHash,
        source.id(),
        FrozenIdentityModel.SCHEMA,
        encode(snapshot),
        encode(snapshot));
    Long candidateId = null;
    for (var s : scores) {
      jdbc.update(
          "INSERT INTO crew_auto_candidate(source_key,candidate_key) VALUES (?,?) ON CONFLICT DO"
              + " NOTHING",
          sourceKey,
          s.candidate());
    }
    if (best != null)
      candidateId =
          jdbc.queryForObject(
              "SELECT id FROM crew_auto_candidate WHERE source_key=? AND candidate_key=?",
              Long.class,
              sourceKey,
              best.candidate());
    var previous =
        jdbc.queryForList(
            "SELECT * FROM crew_auto_decision_revision WHERE source_key=? ORDER BY id DESC LIMIT 1",
            sourceKey);
    Long predecessor =
        previous.isEmpty() ? null : ((Number) previous.getFirst().get("id")).longValue();
    long revision;
    if (!previous.isEmpty()
        && previous.getFirst().get("snapshot_hash").equals(snapshotHash)
        && previous.getFirst().get("model_version").equals(modelVersion)
        && previous.getFirst().get("policy_version").equals(policyVersion)) revision = predecessor;
    else {
      revision =
          jdbc.queryForObject(
              """
              INSERT INTO crew_auto_decision_revision(source_key,candidate_id,predecessor_id,outcome,probability,runner_key,runner_probability,margin,
              model_version,policy_version,feature_schema,model_sha,snapshot_hash,witnesses,conflicts,reasons,known_at,evaluated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,?) RETURNING id
              """,
              Long.class,
              sourceKey,
              candidateId,
              predecessor,
              result.outcome().name(),
              p,
              runner == null ? null : runner.candidate(),
              second,
              p - second,
              modelVersion,
              policyVersion,
              FrozenIdentityModel.SCHEMA,
              FrozenIdentityModel.SHA,
              snapshotHash,
              encode(result.witnesses()),
              encode(result.conflicts()),
              encode(result.reasons()),
              utc(now),
              utc(now));
      Set<Long> observations = new TreeSet<>();
      observations.add(source.id());
      scores.forEach(s -> observations.add(s.observation()));
      for (long id : observations)
        jdbc.update("INSERT INTO crew_auto_decision_evidence VALUES (?,?)", revision, id);
      appendGraph(facts.keySet(), now);
      System.getLogger(getClass().getName())
          .log(
              System.Logger.Level.INFO,
              "auto_identity source={0} candidate={1} model={2} policy={3} p={4} margin={5}"
                  + " witnesses={6} conflicts={7} revision={8} outcome={9}",
              sourceKey,
              best == null ? null : best.candidate(),
              modelVersion,
              policyVersion,
              Double.toString(p),
              Double.toString(p - second),
              result.witnesses(),
              result.conflicts(),
              revision,
              result.outcome());
    }
    return new Evaluation(
        sourceKey,
        best == null ? null : best.candidate(),
        p,
        runner == null ? null : runner.candidate(),
        second,
        p - second,
        scores.size(),
        result,
        revision);
  }

  private void appendGraph(Set<String> keys, Instant now) {
    var edges = edges();
    var components = IdentityResearchGraph.project(keys, edges);
    String h = hash(components);
    var prior =
        jdbc.queryForList(
            "SELECT id,graph_hash FROM crew_auto_graph_revision ORDER BY id DESC LIMIT 1");
    if (!prior.isEmpty() && prior.getFirst().get("graph_hash").equals(h)) return;
    Long pred = prior.isEmpty() ? null : ((Number) prior.getFirst().get("id")).longValue();
    long id =
        jdbc.queryForObject(
            "INSERT INTO crew_auto_graph_revision(predecessor_id,graph_hash,components,applied_at)"
                + " VALUES (?,?,?::jsonb,?) RETURNING id",
            Long.class,
            pred,
            h,
            encode(components),
            utc(now));
    for (var edge : edges)
      jdbc.update("INSERT INTO crew_auto_graph_application VALUES (?,?)", id, edge.revision());
  }

  @Transactional(readOnly = true)
  public Map<String, Object> health(boolean loaded, String error, Instant now) {
    var jobs =
        jdbc.queryForMap(
            """
            SELECT count(*) FILTER(WHERE generation>completed_generation OR job_kind='EVALUATE' AND available_at<=now()) pending,
            count(*) FILTER(WHERE failed) failed,count(*) FILTER(WHERE attempts>1) retries,
            min(enqueued_at) FILTER(WHERE generation>completed_generation) oldest_pending,
            max(last_success_at) latest_success FROM crew_auto_job
            """);
    Map<String, Object> out = new TreeMap<>();
    out.put("modelLoaded", loaded);
    out.put("modelShaValid", loaded);
    out.put("modelError", error == null ? "" : error);
    out.put("queue", jobs);
    out.put(
        "auto_identity_revision_total",
        jdbc.queryForObject("SELECT count(*) FROM crew_auto_decision_revision", Long.class));
    var counts =
        jdbc.queryForList(
            "SELECT outcome,count(*) count FROM crew_auto_decision_revision GROUP BY outcome");
    out.put("decisions", counts);
    for (String outcome : List.of("MATCH", "SEPARATE", "DEFER"))
      out.put(
          "auto_identity_" + outcome.toLowerCase(Locale.ROOT) + "_total",
          counts.stream()
              .filter(c -> c.get("outcome").equals("AUTO_" + outcome))
              .map(c -> c.get("count"))
              .findFirst()
              .orElse(0L));
    out.put(
        "auto_identity_conflict_total",
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_auto_decision_revision WHERE"
                + " jsonb_array_length(conflicts)>0",
            Long.class));
    var active = edges();
    out.put(
        "provider_identities_unbound",
        active.stream().filter(e -> e.outcome() != IdentityPolicy.Outcome.AUTO_MATCH).count());
    out.put(
        "shadow_identity_components",
        IdentityResearchGraph.project(inputs().stream().map(i -> i.evidence().key()).toList(), active)
            .size());
    out.put(
        "high_risk_match_count",
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_auto_decision_revision WHERE outcome='AUTO_MATCH' AND"
                + " probability<0.995",
            Long.class));
    out.put("auto_identity_queue_pending", jobs.get("pending"));
    out.put(
        "auto_identity_queue_oldest_age",
        jobs.get("oldest_pending") == null
            ? 0
            : Math.max(
                0,
                Duration.between(((java.sql.Timestamp) jobs.get("oldest_pending")).toInstant(), now)
                    .toSeconds()));
    out.put("evaluatedAt", now);
    return out;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public List<Map<String, Object>> report() {
    var rows =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(d.source_key) d.*,c.candidate_key,s.payload
            FROM crew_auto_decision_revision d LEFT JOIN crew_auto_candidate c ON c.id=d.candidate_id
            JOIN crew_auto_feature_snapshot s ON s.snapshot_hash=d.snapshot_hash ORDER BY d.source_key,d.id DESC
            """);
    for (var row : rows)
      for (String field : List.of("payload", "witnesses", "conflicts", "reasons")) {
        try {
          row.put(field, json.readValue(row.get(field).toString(), Object.class));
        } catch (Exception e) {
          throw new IllegalStateException("Invalid retained automatic JSON", e);
        }
      }
    return rows;
  }
}
