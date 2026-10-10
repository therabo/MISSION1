package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.membership.Membership.*;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.GZIPInputStream;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.automatic.*;
import org.mission1.crew.domain.CrewEditorial;
import org.mission1.source.crew.nasa.NasaEditorialParser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
class ActiveMembershipPostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  @Autowired ActiveMembershipStore store;
  @Autowired RetainedMembershipInputs inputs;
  @Autowired ActiveMembershipPolicy policy;
  @Autowired AutomaticIdentityStore auto;
  @Autowired AutomaticIdentityWorker worker;
  @Autowired CrewEditorialRepository editorial;
  @Autowired NasaEditorialParser parser;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @Autowired PlatformTransactionManager transactions;
  final Instant t =
      Instant.now().minusSeconds(120).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
  final List<String> current = List.of("650", "713", "649", "582", "710", "642", "915");
  final List<String> all =
      List.of("650", "713", "649", "582", "710", "642", "915", "573", "712", "747", "732");

  @BeforeEach
  void clean() {
    jdbc.execute(
        "TRUNCATE"
            + " crew_active_projection_revision,crew_auto_identity,crew_auto_release,crew_auto_graph_revision,crew_auto_job,crew_source_snapshot,crew_person,crew_document_body,crew_editorial_resource"
            + " RESTART IDENTITY CASCADE");
    jdbc.update("UPDATE crew_auto_sweep_lease SET next_at='1970-01-01T00:00:00Z'");
  }

  JsonNode fixture(String name) throws Exception {
    try (var in =
        new GZIPInputStream(
            getClass().getResourceAsStream("/fixtures/crew/nasa/editorial/" + name + ".json.gz"))) {
      return json.readTree(in);
    }
  }

  JsonNode records() throws Exception {
    try (var in =
        new GZIPInputStream(
            getClass().getResourceAsStream("/crew/automatic/source-feature-reference.json.gz"))) {
      return json.readTree(in).path("records");
    }
  }

  long ll2(List<String> assigned, Instant captured, String tag) throws Exception {
    var records = records();
    String hash = store.hash("TEST_ONLY:" + tag);
    long snapshot =
        jdbc.queryForObject(
            """
            INSERT INTO crew_source_snapshot(source,station,source_api_version,adapter_version,source_station_external_id,content_hash,first_observed_at,source_url,total_active_expeditions,candidates_complete)
            VALUES('LAUNCH_LIBRARY_2','ISS','SOURCE_DERIVED_TEST','TEST_ONLY','4',?,?, 'https://example.test/retained',1,true) RETURNING id
            """,
            Long.class,
            hash,
            captured.atOffset(ZoneOffset.UTC));
    UUID expedition = UUID.nameUUIDFromBytes("fixture-expedition".getBytes());
    jdbc.update(
        "INSERT INTO crew_expedition VALUES (?,?) ON CONFLICT DO NOTHING",
        expedition,
        captured.atOffset(ZoneOffset.UTC));
    jdbc.update(
        "INSERT INTO crew_expedition_external_id VALUES (?,'LAUNCH_LIBRARY_2','test-expedition') ON"
            + " CONFLICT DO NOTHING",
        expedition);
    jdbc.update(
        "INSERT INTO"
            + " crew_expedition_observation(snapshot_id,expedition_id,source,external_id,name,station,source_station_external_id)"
            + " VALUES (?,?,'LAUNCH_LIBRARY_2','test-expedition','Expedition 75','ISS','4')",
        snapshot,
        expedition);
    for (var id : all) {
      UUID person = UUID.nameUUIDFromBytes(id.getBytes());
      var r = records.path("ll2:" + id);
      jdbc.update(
          "INSERT INTO crew_person VALUES (?,?) ON CONFLICT DO NOTHING",
          person,
          captured.atOffset(ZoneOffset.UTC));
      jdbc.update(
          "INSERT INTO crew_person_external_id VALUES (?,'LAUNCH_LIBRARY_2',?) ON CONFLICT DO"
              + " NOTHING",
          person,
          id);
      jdbc.update(
          "INSERT INTO"
              + " crew_person_observation(snapshot_id,person_id,source,external_id,display_name,biography,career_present,agency,nationalities)"
              + " VALUES (?,?,'LAUNCH_LIBRARY_2',?,?,?,false,?::jsonb,'[]'::jsonb)",
          snapshot,
          person,
          id,
          r.path("name").asText(),
          r.path("bio").asText(),
          json.createObjectNode().put("abbreviation", r.path("agency").asText()).toString());
      if (assigned.contains(id))
        jdbc.update(
            "INSERT INTO"
                + " crew_assignment_observation(snapshot_id,expedition_id,person_id,source,external_id,role,source_role_label)"
                + " VALUES (?,?,?,'LAUNCH_LIBRARY_2',?,'FLIGHT_ENGINEER','Flight Engineer')",
            snapshot,
            expedition,
            person,
            "assignment-" + id);
    }
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url,retrieved_at,content_hash,snapshot_id)"
            + " VALUES"
            + " ('LAUNCH_LIBRARY_2','ISS',?,?,'SUCCESS','AVAILABLE','https://example.test/retained',?,?,?)",
        captured.atOffset(ZoneOffset.UTC),
        captured.atOffset(ZoneOffset.UTC),
        captured.atOffset(ZoneOffset.UTC),
        hash,
        snapshot);
    return snapshot;
  }

  CrewEditorial.Capture capture(CrewEditorial.Stream stream, String url, byte[] body, Instant at) {
    return new CrewEditorial.Capture(
        stream,
        URI.create(url),
        URI.create(url),
        List.of(),
        at,
        at,
        200,
        Map.of("Content-Type", List.of("application/json")),
        body,
        null);
  }

  CrewEditorial.StoredCapture roster(Instant captured, boolean resources) throws Exception {
    var n = org.mission1.source.crew.nasa.NasaEditorialParserTest.current();
    // Corpus fixture is a list of minimal NASA resource shapes; find current Expedition 75.
    if (!n.has("id") && n.has("pages")) n = n.path("pages").path("75");
    var resource = parser.resource(n, CrewEditorial.Kind.NASA_MISSION);
    var root =
        editorial.retain(
            capture(
                CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION,
                NasaEditorialParser.API + "mission/" + resource.wpId(),
                json.writeValueAsBytes(n),
                captured),
            resource,
            parser.roster(n, 75),
            null,
            CrewEditorial.Outcome.SUCCESS,
            "TEST_ONLY");
    var topic = fixture("iss-topic");
    if (topic.isArray()) topic = topic.get(0);
    var tr = parser.resource(topic, CrewEditorial.Kind.NASA_TOPIC);
    editorial.retain(
        capture(
            CrewEditorial.Stream.NASA_EDITORIAL_TOPIC,
            NasaEditorialParser.API + "topic/" + tr.wpId(),
            json.writeValueAsBytes(topic),
            captured),
        tr,
        null,
        parser.topic(topic, tr, NasaEditorialParser.TOPIC),
        CrewEditorial.Outcome.SUCCESS,
        "TEST_ONLY");
    if (resources)
      for (var e : Map.of("luke", 4, "watkins", 3, "menon", 1).entrySet()) {
        var bio = fixture("people-" + e.getKey());
        if (bio.isArray()) bio = bio.get(0);
        var personal = parser.resource(bio, CrewEditorial.Kind.NASA_PEOPLE_RESOURCE);
        var c =
            editorial.retain(
                capture(
                    CrewEditorial.Stream.NASA_PERSON_RESOURCE,
                    NasaEditorialParser.API + "people/" + personal.wpId(),
                    json.writeValueAsBytes(bio),
                    captured),
                personal,
                null,
                null,
                CrewEditorial.Outcome.SUCCESS,
                "TEST_ONLY");
        editorial.retainRelation(
            new CrewEditorial.Relation(
                root.rosterId(),
                e.getValue(),
                parser.roster(n, 75).members().get(e.getValue()).name(),
                personal.canonicalUrl().toString(),
                "Biography",
                CrewEditorial.RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
                personal,
                c.id(),
                "TEST_ONLY_VERIFIED"));
      }
    return root;
  }

  void evaluateIdentity() {
    assertEquals(0, worker.run(256).failed());
  }

  @Test
  void freshAndV9Upgrade() {
    assertEquals(
        10, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history", Integer.class));
    var old =
        Flyway.configure()
            .dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())
            .schemas("active_upgrade")
            .target("9")
            .load();
    assertEquals(9, old.migrate().migrationsExecuted);
    jdbc.update(
        "INSERT INTO active_upgrade.crew_person VALUES"
            + " ('00000000-0000-0000-0000-000000000001',now())");
    var before = jdbc.queryForList("SELECT * FROM active_upgrade.crew_person");
    var newer =
        Flyway.configure()
            .dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())
            .schemas("active_upgrade")
            .load();
    assertEquals(1, newer.migrate().migrationsExecuted);
    newer.validate();
    assertEquals(before, jdbc.queryForList("SELECT * FROM active_upgrade.crew_person"));
  }

  @Test
  void independentLl2ActiveAndRetainedProfiles() throws Exception {
    ll2(current, t, "a");
    var r = store.materialize(t.plusSeconds(1));
    assertEquals(7, r.result().counts().resolvedActiveHumans());
    assertEquals(4, r.result().counts().retainedHumans());
    assertEquals(7, r.result().counts().ll2Assignments());
    assertEquals(0, r.result().counts().unresolvedActiveSlots());
    assertTrue(r.result().members().stream().allMatch(m -> m.human().profileSnapshot() != null));
    assertTrue(r.result().members().stream().allMatch(m -> m.presence().equals("UNKNOWN")));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
    assertFalse(store.materialize(t.plusSeconds(2)).inserted());
    assertEquals(r.revision(), store.latest().orElseThrow().revision());
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2, 3, 4, 5})
  void ordersRestartDuplicateAndLateMatchConverge(int order) throws Exception {
    if (order % 2 == 0) {
      roster(t, true);
      store.materialize(t.plusSeconds(1));
      ll2(current, t.plusSeconds(2), "a");
    } else {
      ll2(current, t, "a");
      store.materialize(t.plusSeconds(1));
      roster(t.plusSeconds(2), true);
    }
    var before = store.materialize(Instant.now());
    assertEquals(7, before.result().counts().resolvedActiveHumans());
    assertEquals(7, before.result().counts().unresolvedActiveSlots());
    evaluateIdentity();
    var r = store.materialize(Instant.now());
    assertEquals(7, r.result().counts().resolvedActiveHumans());
    assertEquals(4, r.result().counts().unresolvedActiveSlots());
    assertEquals(3, r.result().counts().resolvedEditorialMemberships());
    assertEquals(7, r.result().counts().websiteReportedAboard());
    assertEquals(4, r.result().counts().retainedHumans());
    assertTrue(r.inserted());
    assertFalse(store.materialize(Instant.now()).inserted());
    assertEquals(
        0,
        jdbc.queryForObject("SELECT count(*) FROM crew_identity_binding_version", Integer.class));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
    assertEquals(
        10,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_active_projection_support WHERE projection_id=?",
            Integer.class,
            r.revision()));
  }

  @Test
  void matchWithdrawalDoesNotBorrowReviewedIdentity() throws Exception {
    ll2(current, t, "a");
    var root = roster(t, true);
    evaluateIdentity();
    var matched = store.materialize(Instant.now());
    assertEquals(3, matched.result().counts().resolvedEditorialMemberships());
    editorial.retainRelation(
        new CrewEditorial.Relation(
            root.rosterId(),
            4,
            "Luke Delaney",
            "https://www.nasa.gov/people/nasa-astronaut-luke-delaney/",
            "Biography",
            CrewEditorial.RelationStatus.REJECTED_MISMATCH,
            null,
            null,
            "TEST_ONLY_CHANGED_TARGET"));
    evaluateIdentity();
    var revoked = store.materialize(Instant.now());
    assertEquals(2, revoked.result().counts().resolvedEditorialMemberships());
    assertEquals(5, revoked.result().counts().unresolvedActiveSlots());
    assertEquals(7, revoked.result().counts().resolvedActiveHumans());
    assertNotEquals(matched.result().cut().graph(), revoked.result().cut().graph());
  }

  @Test
  void noActiveSuccessDoesNotResurrectAssignmentsAfterFailure() throws Exception {
    ll2(current, t, "a");
    assertEquals(7, store.materialize(t.plusSeconds(1)).result().counts().resolvedActiveHumans());
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url)"
            + " VALUES"
            + " ('LAUNCH_LIBRARY_2','ISS',?,?,'SOURCE_RESULT','NO_ACTIVE_EXPEDITION','https://example.test/empty')",
        t.plusSeconds(2).atOffset(ZoneOffset.UTC),
        t.plusSeconds(2).atOffset(ZoneOffset.UTC));
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url)"
            + " VALUES"
            + " ('LAUNCH_LIBRARY_2','ISS',?,?,'SOURCE_RESULT','SOURCE_UNAVAILABLE','https://example.test/failure')",
        t.plusSeconds(3).atOffset(ZoneOffset.UTC),
        t.plusSeconds(3).atOffset(ZoneOffset.UTC));
    var r = store.materialize(t.plusSeconds(4));
    assertEquals(0, r.result().counts().resolvedActiveHumans());
    assertEquals(11, r.result().counts().retainedHumans());
    assertNull(r.result().cut().ll2Snapshot());
  }

  @Test
  void staleSourceReconciliationPersistsNewRevisionWithoutSourceWrites() throws Exception {
    ll2(current, t, "a");
    var first = store.materialize(t.plusSeconds(1));
    var stale = store.materialize(t.plus(Duration.ofHours(7)));
    assertNotEquals(first.revision(), stale.revision());
    assertEquals(0, stale.result().counts().resolvedActiveHumans());
    assertEquals(11, stale.result().counts().retainedHumans());
    assertEquals(HealthState.UNAVAILABLE, stale.result().health());
    assertEquals(
        1, jdbc.queryForObject("SELECT count(*) FROM crew_source_snapshot", Integer.class));
  }

  @Test
  void abaAcquisitionAndSemanticProjectionHistory() throws Exception {
    ll2(current, t, "a");
    var a = store.materialize(t.plusSeconds(1));
    ll2(current.subList(0, 6), t.plusSeconds(2), "b");
    var b = store.materialize(t.plusSeconds(3));
    assertEquals(6, b.result().counts().resolvedActiveHumans());
    long old = a.result().cut().ll2Snapshot();
    String hash =
        jdbc.queryForObject(
            "SELECT content_hash FROM crew_source_snapshot WHERE id=?", String.class, old);
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url,retrieved_at,content_hash,snapshot_id)"
            + " VALUES"
            + " ('LAUNCH_LIBRARY_2','ISS',?,?,'SUCCESS','AVAILABLE','https://example.test/retained',?,?,?)",
        t.plusSeconds(4).atOffset(ZoneOffset.UTC),
        t.plusSeconds(4).atOffset(ZoneOffset.UTC),
        t.plusSeconds(4).atOffset(ZoneOffset.UTC),
        hash,
        old);
    var again = store.materialize(t.plusSeconds(5));
    assertEquals(7, again.result().counts().resolvedActiveHumans());
    assertEquals(old, again.result().cut().ll2Snapshot());
    assertEquals(
        3,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Integer.class));
  }

  @Test
  void concurrentMaterializationOneLogicalRevision() throws Exception {
    ll2(current, t, "a");
    try (var pool = Executors.newFixedThreadPool(4)) {
      var futures = new ArrayList<Future<ActiveMembershipStore.Materialized>>();
      for (int i = 0; i < 8; i++)
        futures.add(pool.submit(() -> store.materialize(t.plusSeconds(1))));
      for (var f : futures) assertEquals(7, f.get().result().counts().resolvedActiveHumans());
    }
    assertEquals(
        1,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Integer.class));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "crew_active_projection_revision",
        "crew_active_projection_member",
        "crew_active_projection_support",
        "crew_active_projection_slot",
        "crew_active_projection_finding",
        "crew_active_projection_evidence",
        "crew_active_projection_input_capture"
      })
  void immutableHistory(String table) throws Exception {
    ll2(current, t, "a");
    roster(t, true);
    evaluateIdentity();
    operational("650", "PERSON_DEPARTED_STATION", t.plusSeconds(1), t.plusSeconds(2));
    store.materialize(Instant.now());
    assertTrue(jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class) > 0);
    assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM " + table));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE "
                    + table
                    + " SET "
                    + (table.endsWith("revision") ? "id=id" : "projection_id=projection_id")));
  }

  @Test
  void semanticHashAndOwnerIntegrityAndRollback() throws Exception {
    ll2(current, t, "a");
    var r = store.materialize(t.plusSeconds(1));
    assertEquals(
        r.semanticHash(),
        jdbc.queryForObject(
            "SELECT encode(sha256(convert_to(serialized_result,'UTF8')),'hex') FROM"
                + " crew_active_projection_revision WHERE id=?",
            String.class,
            r.revision()));
    assertThrows(
        DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM crew_person"));
    var tx = new TransactionTemplate(transactions);
    assertThrows(
        RuntimeException.class,
        () ->
            tx.execute(
                status -> {
                  store.materialize(t.plus(Duration.ofHours(7)));
                  throw new IllegalStateException("TEST_ONLY_TRANSACTION_FAILURE");
                }));
    assertEquals(
        1,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Integer.class));
    var wrongOwner =
        assertThrows(
            DataIntegrityViolationException.class,
            () ->
                new TransactionTemplate(transactions)
                    .executeWithoutResult(
                        status -> {
                          var open = store.materialize(t.plus(Duration.ofHours(7)));
                          jdbc.update(
                              "INSERT INTO crew_active_projection_member SELECT"
                                  + " projection_id,'LL2:PERSON:WRONG',person_id,state,profile_snapshot_id,departure_evidence_id,payload"
                                  + " FROM crew_active_projection_member WHERE projection_id=?"
                                  + " LIMIT 1",
                              open.revision());
                        }));
    assertTrue(
        wrongOwner.getMostSpecificCause().getMessage().contains("typed LL2 provider anchor"));
  }

  long operational(String humanId, String type, Instant effective, Instant captureTime)
      throws Exception {
    String raw = "TEST_ONLY_ACCEPTED_OPERATIONAL_" + type + effective;
    String hash = store.hash(raw);
    jdbc.update("INSERT INTO crew_document_body VALUES (?,?)", hash, raw.getBytes());
    long document =
        jdbc.queryForObject(
            "INSERT INTO"
                + " crew_source_document(source,source_type,source_url,retrieved_at,content_hash,parser_name,parser_version,parsed)"
                + " VALUES"
                + " ('NASA_OFFICIAL','NASA_ISS_OPERATIONAL_FEED','https://example.test/event',?,?,'TEST_ONLY','1',true)"
                + " RETURNING id",
            Long.class,
            captureTime.atOffset(ZoneOffset.UTC),
            hash);
    long evidence =
        jdbc.queryForObject(
            """
            INSERT INTO crew_verification_evidence(document_id,evidence_hash,station,evidence_type,assertion,completeness,source_type,assertion_url,source_published_at,source_event_at,supporting_excerpt,parser_name,parser_version,evidence_method)
            VALUES (?,?,'ISS',?,'COMPLETED','EVENT_ONLY','NASA_ISS_OPERATIONAL_FEED','https://example.test/event',?,?,'TEST_ONLY named completed event','TEST_ONLY','1','TEST_ONLY_ACCEPTED_EVENT') RETURNING id
            """,
            Long.class,
            document,
            hash,
            type,
            effective.atOffset(ZoneOffset.UTC),
            effective.atOffset(ZoneOffset.UTC));
    String name = records().path("ll2:" + humanId).path("name").asText();
    jdbc.update(
        "INSERT INTO crew_evidence_subject VALUES (?,0,?,NULL,'[]'::jsonb)", evidence, name);
    jdbc.update("INSERT INTO crew_document_evidence VALUES (?,?)", document, evidence);
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url,retrieved_at,content_hash,verification_document_id)"
            + " VALUES"
            + " ('NASA_OFFICIAL','ISS',?,?,'SUCCESS','AVAILABLE','https://example.test/event',?,?,?)",
        captureTime.atOffset(ZoneOffset.UTC),
        captureTime.atOffset(ZoneOffset.UTC),
        captureTime.atOffset(ZoneOffset.UTC),
        hash,
        document);
    // Explicit synthetic rich typed source evidence exercises V9 integration without V7.
    auto.installRelease(FrozenIdentityModel.VERSION, IdentityPolicy.VERSION, captureTime);
    String bio = name + " selected in 2021 for Crew-13";
    var ref =
        new IdentityEvidence.Reference(
            "crew_evidence_subject", evidence + ":0", hash, "TEST_ONLY_NAMED_EVENT", captureTime);
    var source =
        new IdentityEvidence(
            "NASA:OPERATIONAL_SUBJECT:legacy:" + evidence + ":0",
            IdentityEvidence.Provider.NASA,
            IdentityEvidence.Kind.OPERATIONAL_SUBJECT,
            name,
            List.of(name),
            bio,
            null,
            null,
            false,
            Set.of("2021"),
            Set.of("crew-13"),
            Set.of(IdentityEvidence.Witness.VALIDATED_BIOGRAPHY),
            List.of(),
            List.of(ref));
    var target =
        new IdentityEvidence(
            "LL2:PERSON:" + humanId,
            IdentityEvidence.Provider.LL2,
            IdentityEvidence.Kind.PERSON,
            name,
            List.of(name),
            bio,
            null,
            null,
            false,
            Set.of("2021"),
            Set.of("crew-13"),
            Set.of(IdentityEvidence.Witness.PERSON_SCOPED_HISTORY),
            List.of(),
            List.of(
                new IdentityEvidence.Reference(
                    "crew_person_observation", "TEST_ONLY", hash, "TEST_ONLY", captureTime)));
    auto.retain(List.of(source, target), captureTime);
    var result =
        auto.evaluate(
            source.key(),
            FrozenIdentityModel.load(json),
            FrozenIdentityModel.VERSION,
            IdentityPolicy.VERSION,
            captureTime);
    assertEquals(IdentityPolicy.Outcome.AUTO_MATCH, result.result().outcome());
    return evidence;
  }

  @Test
  void acceptedDepartureReentryAndOperationalOnlyVisitorPersistWithFks() throws Exception {
    ll2(current, t, "a");
    long departed =
        operational("650", "PERSON_DEPARTED_STATION", t.plusSeconds(1), t.plusSeconds(2));
    var removed = store.materialize(t.plusSeconds(3));
    assertEquals(6, removed.result().counts().resolvedActiveHumans());
    var person =
        removed.result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:650"))
            .findFirst()
            .orElseThrow();
    assertEquals(departed, person.departureVeto());
    assertEquals(1, person.supports().size());
    assertFalse(person.supports().getFirst().eligible());
    operational("650", "PERSON_ENTERED_STATION", t.plusSeconds(4), t.plusSeconds(5));
    var reentry = store.materialize(t.plusSeconds(6));
    assertEquals(7, reentry.result().counts().resolvedActiveHumans());
    assertNull(
        reentry.result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:650"))
            .findFirst()
            .orElseThrow()
            .departureVeto());
    operational("573", "PERSON_ENTERED_STATION", t.plusSeconds(7), t.plusSeconds(8));
    var visitor = store.materialize(t.plusSeconds(9));
    assertEquals(8, visitor.result().counts().resolvedActiveHumans());
    assertNull(
        visitor.result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:573"))
            .findFirst()
            .orElseThrow()
            .assignment());
  }

  @Test
  void wrongHashPredecessorSupportSlotAndCutAreRejected() throws Exception {
    ll2(current, t, "a");
    roster(t, true);
    evaluateIdentity();
    var r = store.materialize(Instant.now());
    var wrongSlot =
        assertThrows(
            DataIntegrityViolationException.class,
            () ->
                new TransactionTemplate(transactions)
                    .executeWithoutResult(
                        status -> {
                          var open = store.materialize(t.plus(Duration.ofHours(7)));
                          jdbc.update(
                              "INSERT INTO crew_active_projection_slot SELECT"
                                  + " projection_id,slot_key||'wrong',state,acquisition_id,roster_id,999,evidence_id,subject_index,decision_id,observation_id,payload"
                                  + " FROM crew_active_projection_slot WHERE projection_id=? LIMIT"
                                  + " 1",
                              open.revision());
                        }));
    assertTrue(wrongSlot.getMostSpecificCause().getMessage().contains("foreign key constraint"));
    var wrongSupport =
        assertThrows(
            DataIntegrityViolationException.class,
            () ->
                new TransactionTemplate(transactions)
                    .executeWithoutResult(
                        status -> {
                          var open = store.materialize(t.plus(Duration.ofHours(7)));
                          jdbc.update(
                              "INSERT INTO crew_active_projection_support SELECT"
                                  + " projection_id,human_key,support_key||'wrong',support_type,stream,captured_at,effective_at,precision,freshness,eligible,snapshot_id,expedition_id,person_id,acquisition_id,roster_id,member_index,evidence_id,subject_index,999999,observation_id,departure_evidence_id,payload"
                                  + " FROM crew_active_projection_support WHERE decision_id IS NOT"
                                  + " NULL AND projection_id=? LIMIT 1",
                              open.revision());
                        }));
    assertTrue(
        wrongSupport.getMostSpecificCause().getMessage().contains("Unqualified automatic binding"));
    String columns =
        "predecessor_id,policy_version,identity_mode,evaluated_at,created_at,ll2_run_id,ll2_snapshot_id,roster_acquisition_id,roster_id,topic_acquisition_id,topic_count_fact_id,graph_id,operational_run_id,operational_attempt_id,input_hash,semantic_hash,serialized_cut,input_cut,serialized_result,result,health";
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO crew_active_projection_revision("
                    + columns
                    + ") SELECT "
                    + columns
                    + " FROM crew_active_projection_revision WHERE id=?",
                r.revision()));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO crew_active_projection_revision("
                    + columns
                    + ") SELECT "
                    + columns
                        .replace("predecessor_id", String.valueOf(r.revision()))
                        .replace("semantic_hash", "repeat('0',64)")
                    + " FROM crew_active_projection_revision WHERE id=?",
                r.revision()));
    assertEquals(
        1,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Integer.class));
  }

  @Test
  void committedRevisionRejectsLateChildInsert() throws Exception {
    ll2(current, t, "a");
    var r = store.materialize(t.plusSeconds(1));
    var failure =
        assertThrows(
            DataIntegrityViolationException.class,
            () ->
                jdbc.update(
                    "INSERT INTO crew_active_projection_finding VALUES"
                        + " (?,'MEMBERSHIP','TEST_ONLY_LATE_INSERT','TEST_ONLY','TEST_ONLY')",
                    r.revision()));
    assertTrue(failure.getMostSpecificCause().getMessage().contains("sealed"));
  }

  @Test
  void sourceNotificationSurvivesRestartAndCompletesOnlyObservedGeneration() throws Exception {
    long before =
        jdbc.queryForObject("SELECT generation FROM crew_active_projection_work", Long.class);
    ll2(current, t, "a");
    long notified =
        jdbc.queryForObject("SELECT generation FROM crew_active_projection_work", Long.class);
    assertTrue(notified > before);
    store.materialize(t.plusSeconds(1));
    assertEquals(
        notified,
        jdbc.queryForObject(
            "SELECT completed_generation FROM crew_active_projection_work", Long.class));
    ll2(current, t.plusSeconds(2), "b");
    assertTrue(
        jdbc.queryForObject(
            "SELECT generation>completed_generation FROM crew_active_projection_work",
            Boolean.class));
    store.failure();
    assertTrue(
        jdbc.queryForObject("SELECT failures>0 FROM crew_active_projection_work", Boolean.class));
    store.materialize(t.plusSeconds(3));
    assertFalse(
        jdbc.queryForObject(
            "SELECT generation>completed_generation FROM crew_active_projection_work",
            Boolean.class));
  }
}
