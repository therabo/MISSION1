package org.mission1.crew.automatic;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.automatic.IdentityEvidence.*;
import static org.mission1.crew.automatic.IdentityTestFixtures.*;

import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/**
 * Captured real-source content in disposable databases; transport/scheduling timestamps are test
 * fixtures.
 */
@SpringBootTest
@Testcontainers
class AutomaticSourceIntegrationTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  @Autowired AutomaticIdentityStore store;
  @Autowired RetainedIdentityEvidence loader;
  @Autowired CrewEditorialRepository editorial;
  @Autowired NasaEditorialParser parser;
  @Autowired JdbcTemplate jdbc;
  @Autowired ProductionShadowComparison comparison;

  @BeforeEach
  void clean() {
    jdbc.execute(
        "TRUNCATE"
            + " crew_auto_identity,crew_auto_release,crew_auto_graph_revision,crew_auto_job,crew_source_snapshot,crew_person,crew_document_body,crew_editorial_resource"
            + " RESTART IDENTITY CASCADE");
    jdbc.update("UPDATE crew_auto_sweep_lease SET next_at='1970-01-01T00:00:00Z'");
    store.installRelease(FrozenIdentityModel.VERSION, IdentityPolicy.VERSION, TIME);
  }

  void ll2() {
    var records = file("source-feature-reference.json.gz").path("records");
    String hash = store.hash(records);
    long snapshot =
        jdbc.queryForObject(
            """
            INSERT INTO crew_source_snapshot(source,station,source_api_version,adapter_version,source_station_external_id,content_hash,first_observed_at,source_url,total_active_expeditions,candidates_complete)
            VALUES ('LAUNCH_LIBRARY_2','ISS','SOURCE_DERIVED_TEST_FIXTURE','TEST_ONLY','ISS',?,?, 'https://example.test/retained-fixture',1,true) RETURNING id
            """,
            Long.class,
            hash,
            TIME.atOffset(ZoneOffset.UTC));
    for (String id :
        List.of("650", "713", "649", "582", "710", "642", "915", "573", "712", "747", "732")) {
      var r = records.path("ll2:" + id);
      assertTrue(r.has("bio"));
      UUID person = UUID.nameUUIDFromBytes(id.getBytes());
      jdbc.update("INSERT INTO crew_person VALUES (?,?)", person, TIME.atOffset(ZoneOffset.UTC));
      jdbc.update(
          "INSERT INTO crew_person_external_id VALUES (?,'LAUNCH_LIBRARY_2',?)", person, id);
      jdbc.update(
          """
          INSERT INTO crew_person_observation(snapshot_id,person_id,source,external_id,display_name,biography,career_present,agency,nationalities)
          VALUES (?,?,'LAUNCH_LIBRARY_2',?,?,?,false,?::jsonb,'[]'::jsonb)
          """,
          snapshot,
          person,
          id,
          r.path("name").asText(),
          r.path("bio").asText(),
          JSON.createObjectNode().put("abbreviation", r.path("agency").asText()).toString());
    }
    jdbc.update(
        """
        INSERT INTO crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url,retrieved_at,content_hash,snapshot_id)
        VALUES ('LAUNCH_LIBRARY_2','ISS',?,?,'SUCCESS','AVAILABLE','https://example.test/retained-fixture',?,?,?)
        """,
        TIME.atOffset(ZoneOffset.UTC),
        TIME.atOffset(ZoneOffset.UTC),
        TIME.atOffset(ZoneOffset.UTC),
        hash,
        snapshot);
  }

  CrewEditorial.Capture capture(CrewEditorial.Stream stream, String url, byte[] body) {
    return new CrewEditorial.Capture(
        stream,
        URI.create(url),
        URI.create(url),
        List.of(),
        TIME,
        TIME,
        200,
        Map.of("Content-Type", List.of("application/json")),
        body,
        null);
  }

  void nasa() {
    nasa(() -> {});
  }

  void nasa(Runnable betweenResources) {
    var n = NasaEditorialParserTest.current();
    var resource = parser.resource(n, CrewEditorial.Kind.NASA_MISSION);
    byte[] body = n.toString().getBytes();
    var root =
        editorial.retain(
            capture(
                CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION,
                NasaEditorialParser.API + "mission/748853",
                body),
            resource,
            parser.roster(n, 75),
            null,
            CrewEditorial.Outcome.SUCCESS,
            "TEST_ONLY_CAPTURE");
    for (var e : Map.of("luke", 4, "watkins", 3, "menon", 1).entrySet()) {
      byte[] topic = NasaEditorialParserTest.fixture("topic-" + e.getKey());
      var topicResource = parser.resource(parser.json(topic), CrewEditorial.Kind.NASA_TOPIC);
      editorial.retain(
          capture(
              CrewEditorial.Stream.NASA_PERSON_RESOURCE,
              NasaEditorialParser.API + "topic/" + topicResource.wpId(),
              topic),
          topicResource,
          null,
          null,
          CrewEditorial.Outcome.SUCCESS,
          "TEST_ONLY_CAPTURE");
      byte[] bio = NasaEditorialParserTest.fixture("people-" + e.getKey());
      var personal = parser.resource(parser.json(bio), CrewEditorial.Kind.NASA_PEOPLE_RESOURCE);
      var c =
          editorial.retain(
              capture(
                  CrewEditorial.Stream.NASA_PERSON_RESOURCE,
                  NasaEditorialParser.API + "people/" + personal.wpId(),
                  bio),
              personal,
              null,
              null,
              CrewEditorial.Outcome.SUCCESS,
              "TEST_ONLY_CAPTURE");
      String name = parser.roster(n, 75).members().get(e.getValue()).name();
      editorial.retainRelation(
          new CrewEditorial.Relation(
              root.rosterId(),
              e.getValue(),
              name,
              personal.canonicalUrl().toString(),
              "Biography",
              CrewEditorial.RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
              personal,
              c.id(),
              "ABOUT_PERSON_VERIFIED"));
      betweenResources.run();
    }
  }

  AutomaticIdentityWorker worker() {
    return new AutomaticIdentityWorker(store, loader, Clock.systemUTC(), JSON);
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2, 3, 4, 5})
  void sourceColdStartOrdersRestartAndDuplicateConverge(int order) {
    if (order == 2) {
      var inserted = new java.util.concurrent.atomic.AtomicBoolean();
      nasa(
          () -> {
            if (!inserted.getAndSet(true)) ll2();
            assertEquals(0, worker().run(256).failed());
          });
    } else if (order % 2 == 0) {
      nasa();
      assertEquals(0, worker().run(256).failed());
      ll2();
    } else {
      ll2();
      assertEquals(0, worker().run(256).failed());
      nasa();
    }
    assertEquals(0, worker().run(256).failed());
    var report = store.report();
    var slots =
        report.stream()
            .filter(d -> d.get("source_key").toString().contains("EDITORIAL_SLOT"))
            .toList();
    assertEquals(7, slots.size());
    assertEquals(3, slots.stream().filter(d -> d.get("outcome").equals("AUTO_MATCH")).count());
    for (String id : List.of("710", "582", "713"))
      assertTrue(
          slots.stream()
              .anyMatch(
                  d ->
                      d.get("candidate_key").equals("LL2:PERSON:" + id)
                          && d.get("outcome").equals("AUTO_MATCH")));
    assertEquals(
        0,
        jdbc.queryForObject("SELECT count(*) FROM crew_identity_binding_version", Integer.class));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
    int revisions = report.size();
    store.requestImport(Instant.now());
    var restart = new AutomaticIdentityWorker(store, loader, Clock.systemUTC(), JSON);
    assertEquals(0, restart.run(256).failed());
    assertEquals(revisions, store.report().size());
    var all = loader.load(TIME.plusSeconds(102));
    assertEquals(7, all.queries());
    assertEquals(24, all.evidence().size());
  }

  @Test
  void wrongPersonLinkNeverContributesBiography() {
    nasa();
    ll2();
    var root = editorial.latestRoster(TIME.plusSeconds(1)).orElseThrow();
    var luke = root.roster().members().get(4);
    editorial.retainRelation(
        new CrewEditorial.Relation(
            root.id(),
            4,
            luke.name(),
            "https://www.nasa.gov/people/nasa-astronaut-luke-delaney/",
            "Biography",
            CrewEditorial.RelationStatus.REJECTED_MISMATCH,
            null,
            null,
            "TEST_ONLY_WRONG_LINK"));
    var evidence =
        loader.load(TIME.plusSeconds(1)).evidence().stream()
            .filter(r -> r.kind() == Kind.EDITORIAL_SLOT && r.name().equals(luke.name()))
            .findFirst()
            .orElseThrow();
    assertFalse(evidence.qualifications().contains(Witness.VALIDATED_BIOGRAPHY));
    assertEquals("", evidence.biography());
  }

  @Test
  void productionComparisonIsDownstreamAndCannotChangeShadowFeatures() {
    nasa();
    ll2();
    assertEquals(0, worker().run(256).failed());
    var before = store.report();
    var hashes = before.stream().map(r -> r.get("snapshot_hash")).toList();
    var person =
        jdbc.queryForObject(
            "SELECT person_id FROM crew_person_external_id WHERE source='LAUNCH_LIBRARY_2' AND"
                + " external_id='710'",
            UUID.class);
    jdbc.update(
        "INSERT INTO crew_person_external_id VALUES"
            + " (?,'NASA_OFFICIAL','profile:nasa-astronaut-luke-delaney')",
        person);
    var compared = comparison.read(Instant.now());
    assertTrue(
        compared.stream()
            .anyMatch(
                r ->
                    r.name().equals("Luke Delaney")
                        && r.shadowOutcome().equals("AUTO_MATCH")
                        && r.classification() == ProductionShadowComparison.Classification.AGREES));
    assertEquals(hashes, store.report().stream().map(r -> r.get("snapshot_hash")).toList());
    assertEquals(
        0,
        jdbc.queryForObject("SELECT count(*) FROM crew_identity_binding_version", Integer.class));
  }

  @Test
  void modelFailureDoesNotConsumeJobsOrHarmSources() throws Exception {
    var bad = org.mockito.Mockito.mock(com.fasterxml.jackson.databind.ObjectMapper.class);
    org.mockito.Mockito.when(bad.readTree(org.mockito.ArgumentMatchers.any(byte[].class)))
        .thenThrow(new java.io.IOException("TEST_ONLY_INVALID_ARTIFACT"));
    nasa();
    var before = jdbc.queryForList("SELECT * FROM crew_auto_job");
    var w = new AutomaticIdentityWorker(store, loader, Clock.fixed(TIME, ZoneOffset.UTC), bad);
    assertEquals(0, w.run(16).claimed());
    assertEquals(false, w.health().get("modelLoaded"));
    assertEquals(before, jdbc.queryForList("SELECT * FROM crew_auto_job"));
    assertEquals(
        0, jdbc.queryForObject("SELECT count(*) FROM crew_auto_decision_revision", Integer.class));
  }
}
