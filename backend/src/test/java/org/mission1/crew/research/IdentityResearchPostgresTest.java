package org.mission1.crew.research;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.research.IdentityEvidence.*;
import static org.mission1.crew.research.IdentityTestFixtures.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
class IdentityResearchPostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  @Autowired IdentityResearchStore store;
  @Autowired RetainedIdentityEvidence retained;
  @Autowired JdbcTemplate jdbc;
  final FrozenIdentityModel model = FrozenIdentityModel.load(JSON);
  final IdentityEvidence ll =
      person(
          "LL2:PERSON:1",
          Provider.LL2,
          "Test Person",
          "Test Person selected in 2021 Crew-13",
          Set.of(Witness.PERSON_SCOPED_HISTORY),
          List.of());
  final IdentityEvidence nasa =
      person(
          "NASA:EDITORIAL_SLOT:1",
          Provider.NASA,
          "Test Person",
          "Test Person selected in 2021 Crew-13",
          Set.of(Witness.PERSONAL_FLIGHT_CAPTION, Witness.VALIDATED_BIOGRAPHY),
          List.of());

  @BeforeEach
  void clean() {
    jdbc.execute(
        "TRUNCATE crew_identity_research_identity,crew_identity_research_release,crew_identity_research_graph_revision,crew_identity_research_job"
            + " RESTART IDENTITY CASCADE");
    jdbc.update("UPDATE crew_identity_research_sweep_lease SET next_at='1970-01-01T00:00:00Z'");
    store.installRelease(FrozenIdentityModel.VERSION, IdentityPolicy.VERSION, TIME);
  }

  int count(String table) {
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
  }

  IdentityResearchStore.Evaluation evaluate() {
    return store.evaluate(
        nasa.key(),
        model,
        FrozenIdentityModel.VERSION,
        IdentityPolicy.VERSION,
        TIME.plusSeconds(20));
  }

  void drain() {
    for (int i = 0; i < 128; i++) {
      var j = store.claim(TIME.plusSeconds(30));
      if (j.isEmpty()) return;
      if (j.get().identity() != null)
        store.evaluate(
            j.get().identity(),
            model,
            FrozenIdentityModel.VERSION,
            IdentityPolicy.VERSION,
            TIME.plusSeconds(30));
      store.finish(j.get(), TIME.plusSeconds(30), false);
    }
  }



  @Test
  void deferMatchRevocationAndABAAppendRatherThanMutate() {
    var sparse = changed(nasa, "", Set.of(), List.of());
    store.retain(List.of(ll, sparse), TIME);
    var first = evaluate();
    assertEquals(IdentityPolicy.Outcome.AUTO_DEFER, first.result().outcome());
    store.retain(List.of(ll, nasa), TIME.plusSeconds(1));
    var second = evaluate();
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, second.result().outcome());
    store.retain(
        List.of(
            ll,
            changed(nasa, nasa.biography(), nasa.qualifications(), List.of("HARD:WRONG_TARGET"))),
        TIME.plusSeconds(2));
    var third = evaluate();
    assertEquals(IdentityPolicy.Outcome.AUTO_DEFER, third.result().outcome());
    store.retain(List.of(ll, nasa), TIME.plusSeconds(3));
    var fourth = evaluate();
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, fourth.result().outcome());
    assertEquals(4, count("crew_identity_research_decision_revision"));
    assertEquals(4, count("crew_identity_research_observation"));
    var chain =
        jdbc.queryForList("SELECT id,predecessor_id FROM crew_identity_research_decision_revision ORDER BY id");
    assertNull(chain.getFirst().get("predecessor_id"));
    for (int i = 1; i < chain.size(); i++)
      assertEquals(chain.get(i - 1).get("id"), chain.get(i).get("predecessor_id"));
    evaluate();
    assertEquals(4, count("crew_identity_research_decision_revision"));
    assertEquals(0, count("crew_person_equivalence_decision"));
  }

  @Test
  void wrongSyntheticHumanMerge10CorrectsTo11() {
    List<IdentityEvidence> people = new ArrayList<>();
    people.add(ll);
    people.add(nasa);
    for (int i = 2; i <= 10; i++)
      people.add(
          person("LL2:PERSON:" + i, Provider.LL2, "Distinct Human " + i, "", Set.of(), List.of()));
    store.retain(people, TIME);
    assertEquals(11, store.inputs().size());
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, evaluate().result().outcome());
    assertEquals(
        10,
        IdentityResearchGraph.project(
                people.stream().map(IdentityEvidence::key).toList(), store.edges())
            .size());
    store.retain(
        List.of(
            changed(
                nasa,
                nasa.biography(),
                nasa.qualifications(),
                List.of("HARD:KNOWN_DIFFERENT_HUMANS"))),
        TIME.plusSeconds(1));
    assertEquals(IdentityPolicy.Outcome.AUTO_SEPARATE, evaluate().result().outcome());
    assertEquals(
        11,
        IdentityResearchGraph.project(
                people.stream().map(IdentityEvidence::key).toList(), store.edges())
            .size());
    assertEquals(2, count("crew_identity_research_decision_revision"));
    assertEquals(0, count("crew_person"));
  }

  @Test
  void separationCanBeCorrectedAutomatically() {
    store.retain(
        List.of(
            ll,
            changed(
                nasa,
                nasa.biography(),
                nasa.qualifications(),
                List.of("HARD:KNOWN_DIFFERENT_HUMANS"))),
        TIME);
    assertEquals(IdentityPolicy.Outcome.AUTO_SEPARATE, evaluate().result().outcome());
    store.retain(List.of(nasa), TIME.plusSeconds(1));
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, evaluate().result().outcome());
  }

  @Test
  void duplicateWorkAndRestartRemainIdempotent() {
    store.retain(List.of(ll, nasa), TIME);
    store.retain(List.of(ll, nasa), TIME);
    assertEquals(2, count("crew_identity_research_observation"));
    assertEquals(1, count("crew_identity_research_job"));
    var first = store.claim(TIME.plusSeconds(1)).orElseThrow();
    assertTrue(store.claim(TIME.plusSeconds(2)).isEmpty());
    var restarted = store.claim(TIME.plusSeconds(302)).orElseThrow();
    assertNotEquals(first.token(), restarted.token());
    var a = evaluate();
    var b = FrozenIdentityModel.load(JSON);
    assertEquals(
        a.probability(),
        store
            .evaluate(
                nasa.key(),
                b,
                FrozenIdentityModel.VERSION,
                IdentityPolicy.VERSION,
                TIME.plusSeconds(400))
            .probability());
    store.finish(first, TIME.plusSeconds(401), false);
    assertNotNull(jdbc.queryForObject("SELECT lease_token FROM crew_identity_research_job", UUID.class));
    store.finish(restarted, TIME.plusSeconds(402), false);
    assertEquals(1, count("crew_identity_research_decision_revision"));
  }

  @Test
  void newGenerationDuringLeaseIsNeverLost() {
    store.retain(List.of(ll, nasa), TIME);
    var j = store.claim(TIME.plusSeconds(1)).orElseThrow();
    store.retain(
        List.of(changed(nasa, "Crew-4", nasa.qualifications(), List.of())), TIME.plusSeconds(2));
    store.finish(j, TIME.plusSeconds(3), false);
    assertTrue(store.claim(TIME.plusSeconds(4)).isPresent());
  }

  @Test
  void concurrentEvaluationProducesOneLogicalRevisionAndApplication() throws Exception {
    store.retain(List.of(ll, nasa), TIME);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      var a =
          pool.submit(
              () -> {
                start.await();
                return evaluate();
              });
      var b =
          pool.submit(
              () -> {
                start.await();
                return evaluate();
              });
      start.countDown();
      assertEquals(a.get().revision(), b.get().revision());
    }
    assertEquals(1, count("crew_identity_research_decision_revision"));
    assertEquals(1, count("crew_identity_research_graph_application"));
  }

  @Test
  void concurrentClaimsGiveOneLease() throws Exception {
    store.retain(List.of(ll, nasa), TIME);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a = pool.submit(() -> store.claim(TIME));
      var b = pool.submit(() -> store.claim(TIME));
      assertEquals(1, (a.get().isPresent() ? 1 : 0) + (b.get().isPresent() ? 1 : 0));
    }
  }

  @Test
  void policyUpgradeAppendsPinnedRevision() {
    store.retain(List.of(ll, nasa), TIME);
    evaluate();
    store.installRelease(FrozenIdentityModel.VERSION, "balanced-test-upgrade", TIME.plusSeconds(1));
    var r =
        store.evaluate(
            nasa.key(),
            model,
            FrozenIdentityModel.VERSION,
            "balanced-test-upgrade",
            TIME.plusSeconds(2));
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, r.result().outcome());
    assertEquals(2, count("crew_identity_research_decision_revision"));
    assertEquals(2, count("crew_identity_research_release"));
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
  void providerArrivalOrderRestartDuplicateAndPermutationConverge(int seed) {
    var records = new ArrayList<>(List.of(ll, nasa));
    if (seed == 1) Collections.reverse(records);
    if (seed >= 2) Collections.shuffle(records, new Random(seed));
    for (var r : records) {
      store.retain(List.of(r), TIME);
      drain();
      if (seed == 3 || seed == 4) assertNotNull(FrozenIdentityModel.load(JSON));
      if (seed >= 5) {
        store.retain(List.of(r), TIME);
        drain();
      }
    }
    var e = evaluate();
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, e.result().outcome());
    assertEquals("LL2:PERSON:1", e.best());
    assertEquals(
        1,
        IdentityResearchGraph.project(
                store.inputs().stream().map(i -> i.evidence().key()).toList(), store.edges())
            .size());
    assertEquals(0, count("crew_identity_binding_version"));
    assertEquals(0, count("crew_person_equivalence_decision"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "crew_identity_research_release",
        "crew_identity_research_observation",
        "crew_identity_research_candidate",
        "crew_identity_research_feature_snapshot",
        "crew_identity_research_decision_revision",
        "crew_identity_research_decision_evidence",
        "crew_identity_research_graph_revision",
        "crew_identity_research_graph_application",
        "crew_identity_research_identity"
      })
  void semanticHistoryIsImmutable(String table) {
    store.retain(List.of(ll, nasa), TIME);
    evaluate();
    assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM " + table));
  }

  @Test
  void snapshotHashCorruptionIsRejected() {
    store.retain(List.of(ll, nasa), TIME);
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO crew_identity_research_feature_snapshot VALUES (?,?,?,'{}'::jsonb,'{}')",
                "a".repeat(64),
                store.inputs().getFirst().id(),
                FrozenIdentityModel.SCHEMA));
  }

  @Test
  void staleAndCrossSourcePredecessorsFail() {
    store.retain(List.of(ll, nasa), TIME);
    evaluate();
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO"
                    + " crew_identity_research_decision_revision(source_key,outcome,probability,runner_probability,margin,model_version,policy_version,feature_schema,model_sha,snapshot_hash,witnesses,conflicts,reasons,known_at,evaluated_at)"
                    + " SELECT"
                    + " source_key,outcome,probability,runner_probability,margin,model_version,policy_version,feature_schema,model_sha,snapshot_hash,witnesses,conflicts,reasons,known_at,evaluated_at"
                    + " FROM crew_identity_research_decision_revision"));
  }

  @Test
  void queueFailureIsBoundedObservableAndSourceIndependent() {
    store.retain(List.of(ll, nasa), TIME);
    for (int i = 0; i < 8; i++) {
      var j = store.claim(TIME.plusSeconds(i * 10000)).orElseThrow();
      store.fail(j, TIME.plusSeconds(i * 10000), new IllegalStateException());
    }
    assertTrue(store.claim(TIME.plusSeconds(100000)).isEmpty());
    assertEquals(
        1L,
        ((Number) ((Map<?, ?>) store.health(true, null, TIME).get("queue")).get("failed"))
            .longValue());
    assertEquals(0, count("crew_source_sync_run"));
    store.retain(List.of(changed(nasa, "new", Set.of(), List.of())), TIME.plusSeconds(100001));
    assertTrue(store.claim(TIME.plusSeconds(100002)).isPresent());
  }

  @Test
  void readOnlyQueriesNeverAppendOrEnqueue() {
    store.retain(List.of(ll, nasa), TIME);
    evaluate();
    var counts = jdbc.queryForList("SELECT * FROM crew_identity_research_job");
    int revisions = count("crew_identity_research_decision_revision");
    store.report();
    store.health(true, null, TIME);
    store.inputs();
    retained.load(TIME);
    assertEquals(counts, jdbc.queryForList("SELECT * FROM crew_identity_research_job"));
    assertEquals(revisions, count("crew_identity_research_decision_revision"));
  }
}
