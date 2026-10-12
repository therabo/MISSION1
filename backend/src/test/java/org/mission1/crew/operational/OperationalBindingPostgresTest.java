package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.operational.OperationalBinding.*;
import static org.mission1.crew.operational.OperationalFixtures.*;

import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.mission1.crew.membership.ActiveMembershipPolicy;
import org.mission1.crew.membership.RetainedMembershipInputs;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
class OperationalBindingPostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  @Autowired OperationalBindingStore store;
  @Autowired RetainedOperationalInputs inputs;
  @Autowired RetainedMembershipInputs membership;
  @Autowired ActiveMembershipPolicy membershipPolicy;
  @Autowired JdbcTemplate jdbc;

  static OffsetDateTime utc(Instant at) {
    return at.atOffset(ZoneOffset.UTC);
  }

  int count(String table) {
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
  }

  @BeforeEach
  void clean() {
    jdbc.execute(
        "TRUNCATE"
            + " crew_operational_binding_release,crew_operational_resource_version,crew_person,crew_source_snapshot,crew_source_document"
            + " RESTART IDENTITY CASCADE");
    jdbc.update(
        "UPDATE crew_operational_binding_work SET"
            + " generation=1,completed_generation=0,claimed_until='epoch',claim_token=NULL,next_at='epoch'");
    store.install(CUT);
    for (var n : CORPUS.path("captures"))
      try {
        var redirects =
            JSON.convertValue(
                n.path("redirects"),
                new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        store.retain(
            new OperationalResources.Capture(
                n.path("url").asText(),
                n.path("finalUrl").asText(),
                redirects,
                Instant.parse(n.path("capturedAt").asText()),
                200,
                n.path("contentType").asText(),
                null,
                n.path("body").binaryValue()),
            CUT);
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
  }

  /** Constructed SQL lineage around a captured subject; no source truth is invented. */
  Subject source(String revision) {
    var original = subject("Anil Menon");
    byte[] body =
        ("TEST_ONLY_LINEAGE_" + revision).getBytes(java.nio.charset.StandardCharsets.UTF_8);
    String hash = org.mission1.source.crew.CrewHttpReader.sha256(body);
    jdbc.update("INSERT INTO crew_document_body VALUES(?,?)", hash, body);
    long document =
        jdbc.queryForObject(
            "INSERT INTO"
                + " crew_source_document(source,source_type,source_url,retrieved_at,content_hash,parser_name,parser_version,parsed)"
                + " VALUES('NASA_OFFICIAL','NASA_ISS_OPERATIONAL_FEED','https://example.test/event',?,?,'TEST_ONLY','1',true)"
                + " RETURNING id",
            Long.class,
            utc(CUT.minusSeconds(20)),
            hash);
    long evidence =
        jdbc.queryForObject(
            """
            INSERT INTO crew_verification_evidence(document_id,evidence_hash,station,evidence_type,assertion,completeness,source_type,assertion_url,source_published_at,source_event_at,supporting_excerpt,parser_name,parser_version,evidence_method)
            VALUES(?,?,'ISS','PERSON_CURRENTLY_ABOARD','OBSERVED','PARTIAL','NASA_ISS_OPERATIONAL_FEED','https://example.test/event',?,?,'TEST_ONLY named observation','TEST_ONLY','1','TEST_ONLY') RETURNING id
            """,
            Long.class,
            document,
            hash,
            utc(original.effectiveAt()),
            utc(original.effectiveAt()));
    jdbc.update("INSERT INTO crew_evidence_subject VALUES(?,0,'Anil Menon',NULL,'[]')", evidence);
    jdbc.update("INSERT INTO crew_document_evidence VALUES(?,?)", document, evidence);
    String occurrence = OperationalBindingStore.hash("test-occurrence"),
        key = OperationalBindingStore.hash("test-subject"),
        version = OperationalBindingStore.hash(revision);
    jdbc.update(
        "INSERT INTO crew_assertion_occurrence"
            + " VALUES(?,NULL,NULL,?,'UNASSOCIATED_SCOPE','TEST_ONLY') ON CONFLICT DO NOTHING",
        occurrence,
        occurrence);
    jdbc.update("INSERT INTO crew_assertion_version VALUES(?,?)", evidence, occurrence);
    jdbc.update(
        "INSERT INTO crew_subject_occurrence VALUES(?,?,'Anil Menon') ON CONFLICT DO NOTHING",
        key,
        occurrence);
    jdbc.update(
        "INSERT INTO crew_subject_metadata_version VALUES(?,?,?,'Anil Menon',NULL,'[]')",
        version,
        key,
        version);
    jdbc.update(
        "INSERT INTO crew_subject_version_link VALUES(?,0,?,?,?)",
        evidence,
        occurrence,
        key,
        version);
    return new Subject(
        key,
        version,
        evidence,
        0,
        document,
        hash,
        hash,
        original.article(),
        original.title(),
        original.name(),
        original.paragraph(),
        original.inlineHtml(),
        original.type(),
        original.assertion(),
        original.effectiveAt(),
        original.publishedAt(),
        CUT.minusSeconds(20),
        "TEST_ONLY",
        original.agency(),
        original.role(),
        original.missions(),
        original.anchors(),
        true);
  }

  void target() {
    UUID person = UUID.nameUUIDFromBytes("test-existing-713".getBytes());
    String hash = "a".repeat(64);
    long snapshot =
        jdbc.queryForObject(
            "INSERT INTO"
                + " crew_source_snapshot(source,station,source_api_version,adapter_version,source_station_external_id,content_hash,first_observed_at,source_url,total_active_expeditions,candidates_complete)"
                + " VALUES('LAUNCH_LIBRARY_2','ISS','TEST_ONLY','TEST_ONLY','4',?,?,'https://example.test/retained',1,true)"
                + " RETURNING id",
            Long.class,
            hash,
            utc(CUT.minusSeconds(10)));
    jdbc.update("INSERT INTO crew_person VALUES(?,?)", person, utc(CUT.minusSeconds(10)));
    jdbc.update("INSERT INTO crew_person_external_id VALUES(?,'LAUNCH_LIBRARY_2','713')", person);
    jdbc.update(
        "INSERT INTO"
            + " crew_person_observation(snapshot_id,person_id,source,external_id,display_name,career_present,nationalities)"
            + " VALUES(?,?,'LAUNCH_LIBRARY_2','713','Anil Menon',true,'[]')",
        snapshot,
        person);
    long evidence =
        jdbc.queryForObject("SELECT max(id) FROM crew_verification_evidence", Long.class);
    jdbc.update(
        "INSERT INTO"
            + " crew_identity_resolution(evidence_id,subject_index,resolved_at,person_id,method,candidates,resolver_version,resolution_hash)"
            + " VALUES(?,0,?,?,'EXTERNAL_ID',ARRAY[?]::uuid[],'TEST_ONLY',?)",
        evidence,
        utc(CUT.minusSeconds(5)),
        person,
        person,
        OperationalBindingStore.hash("production:" + evidence));
    jdbc.update(
        "INSERT INTO"
            + " crew_source_sync_run(source,station,started_at,completed_at,result_state,source_state,source_url,retrieved_at,content_hash,snapshot_id)"
            + " VALUES('LAUNCH_LIBRARY_2','ISS',?,?,'SUCCESS','AVAILABLE','https://example.test/retained',?,?,?)",
        utc(CUT.minusSeconds(10)),
        utc(CUT.minusSeconds(10)),
        utc(CUT.minusSeconds(10)),
        hash,
        snapshot);
  }

  List<OperationalBindingStore.Saved> save(Subject s, List<Resource> resources, Instant at) {
    var e = RESOLVER.evaluate(s, resources, at, true);
    var diff =
        new OperationalShadowComparison(membershipPolicy)
            .compare(membership.load(at), List.of(e), at);
    return store.save(List.of(e), resources, diff, at, null);
  }

  @Test
  void freshAndV10UpgradeAreAdditive() {
    var old =
        Flyway.configure()
            .dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())
            .schemas("upgrade_operational")
            .target("10")
            .load();
    assertEquals(10, old.migrate().migrationsExecuted);
    jdbc.update(
        "INSERT INTO upgrade_operational.crew_person"
            + " VALUES('00000000-0000-0000-0000-000000000123',now())");
    var before = jdbc.queryForList("SELECT * FROM upgrade_operational.crew_person");
    var next =
        Flyway.configure()
            .dataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword())
            .schemas("upgrade_operational")
            .load();
    assertEquals(2, next.migrate().migrationsExecuted);
    next.validate();
    assertEquals(before, jdbc.queryForList("SELECT * FROM upgrade_operational.crew_person"));
    assertEquals(12, count("flyway_schema_history"));
  }

  @Test
  void deferMatchConflictSupersessionAndRestartAppendImmutableRevisions() {
    var s = source("v1");
    target();
    var first = save(s, List.of(provider("LL2:PERSON:713")), CUT).getFirst();
    assertEquals("AUTO_DEFER", first.outcome());
    var match = save(s, RESOURCES, CUT.plusSeconds(1)).getFirst();
    assertEquals("AUTO_MATCH", match.outcome());
    assertFalse(save(s, RESOURCES, CUT.plusSeconds(2)).getFirst().inserted());
    var conflicting =
        RESOURCES.stream()
            .map(
                r ->
                    r.kind() == Kind.PROVIDER_PERSON && "LL2:PERSON:713".equals(r.providerKey())
                        ? changed(
                            r,
                            r.kind(),
                            r.name(),
                            r.agency(),
                            "1980-02-02",
                            r.flights(),
                            r.links(),
                            r.validUntil())
                        : r.kind() == Kind.NASA_PEOPLE && r.name().contains("Anil Menon")
                            ? changed(
                                r,
                                r.kind(),
                                r.name(),
                                r.agency(),
                                "1900-02-02",
                                r.flights(),
                                r.links(),
                                r.validUntil())
                            : r)
            .toList();
    assertEquals("CONFLICT", save(s, conflicting, CUT.plusSeconds(3)).getFirst().outcome());
    // Returning to an earlier factual cut is a new correction, not a duplicate historical decision.
    assertEquals("AUTO_MATCH", save(s, RESOURCES, CUT.plusSeconds(4)).getFirst().outcome());
    var newer = source("v2");
    var corrected = save(newer, RESOURCES, CUT.plusSeconds(5));
    assertEquals(2, corrected.size());
    assertTrue(corrected.stream().anyMatch(x -> x.outcome().equals("SUPERSEDED")));
    assertFalse(save(newer, RESOURCES, CUT.plusSeconds(6)).getFirst().inserted());
    assertEquals(6, count("crew_operational_binding_revision"));
    assertEquals(1, count("crew_person"));
    assertEquals(0, count("crew_identity_binding_version"));
    assertEquals(0, count("crew_auto_decision_revision"));
    assertEquals(0, count("crew_active_projection_revision"));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE crew_operational_binding_revision SET reasons='[]' WHERE id=?",
                match.id()));
    assertThrows(
        DataIntegrityViolationException.class,
        () -> jdbc.update("DELETE FROM crew_operational_binding_revision WHERE id=?", match.id()));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO crew_operational_binding_candidate"
                    + " VALUES(?,'LL2:PERSON:999',255,'{}')",
                match.id()));
  }

  @Test
  void unpublishableProviderCannotBecomeNewCanonicalHuman() {
    var s = source("missing-target");
    var result = save(s, RESOURCES, CUT).getFirst();
    assertEquals("AUTO_DEFER", result.outcome());
    assertNull(result.human());
    assertEquals(0, count("crew_person"));
  }

  @Test
  void notificationLeaseSurvivesLostProcessAndCoalescesNewInput() {
    var first = store.claim(CUT).orElseThrow();
    assertTrue(store.claim(CUT.plusSeconds(1)).isEmpty());
    source("notify");
    store.finish(first, CUT.plusSeconds(2), false);
    var second = store.claim(CUT.plusSeconds(3)).orElseThrow();
    assertTrue(second.generation() > first.generation());
    var restarted = store.claim(CUT.plusSeconds(304)).orElseThrow();
    assertThrows(
        IllegalStateException.class, () -> store.finish(second, CUT.plusSeconds(305), false));
    store.finish(restarted, CUT.plusSeconds(306), false);
    assertTrue(store.claim(CUT.plusSeconds(307)).isEmpty());
  }

  @Test
  void sameBodyRevalidationAndOutagePreserveOriginalCapture() throws Exception {
    jdbc.execute("TRUNCATE crew_operational_resource_version RESTART IDENTITY CASCADE");
    var n = CORPUS.path("captures").get(0);
    byte[] body = n.path("body").binaryValue();
    String url = n.path("url").asText();
    var capture =
        new OperationalResources.Capture(
            url,
            n.path("finalUrl").asText(),
            List.of(),
            CUT,
            200,
            n.path("contentType").asText(),
            null,
            body);
    Long id = store.retain(capture, CUT);
    assertNotNull(id);
    assertEquals(
        id,
        store.retain(
            new OperationalResources.Capture(
                url,
                capture.finalUrl(),
                List.of(),
                CUT.plusSeconds(10),
                200,
                capture.contentType(),
                null,
                body),
            CUT.plusSeconds(10)));
    assertNull(
        store.retain(
            new OperationalResources.Capture(
                url, url, List.of(), CUT.plusSeconds(11), 503, "text/html", "HTTP_503", null),
            CUT.plusSeconds(11)));
    assertEquals(1, count("crew_operational_resource_version"));
    assertEquals(3, count("crew_operational_resource_attempt"));
    var r =
        inputs.load(CUT.plusSeconds(12)).resources().stream()
            .filter(x -> x.url().equals(url))
            .findFirst()
            .orElseThrow();
    assertEquals(CUT, r.capturedAt());
    assertEquals(CUT.plusSeconds(10).plus(Duration.ofDays(30)), r.validUntil());
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE crew_operational_resource_version SET http_status=201 WHERE id=?", id));
    assertTrue(store.permit("ll.thespacedevs.com", CUT));
    assertTrue(store.permit("ll.thespacedevs.com", CUT));
    assertTrue(store.permit("ll.thespacedevs.com", CUT));
    assertFalse(store.permit("ll.thespacedevs.com", CUT));
  }
}
