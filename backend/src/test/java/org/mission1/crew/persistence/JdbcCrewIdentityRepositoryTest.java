package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** TEST_ONLY UUIDs with reviewed provider keys; no external network. PostgreSQL owns invariants. */
@SpringBootTest
@Testcontainers
class JdbcCrewIdentityRepositoryTest {
    @Container
    static final PostgreSQLContainer<?> PG =
            new PostgreSQLContainer<>("postgres:16.10")
                    .withDatabaseName("identity_test")
                    .withUsername("test")
                    .withPassword("test_only");

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired JdbcCrewIdentityRepository identities;
    @Autowired PlatformTransactionManager tx;
    final Instant at = Instant.parse("2026-10-10T12:00:00Z");
    final UUID luke = new UUID(0, 1),
            lukeAlias = new UUID(0, 2),
            watkins = new UUID(0, 3),
            watkinsAlias = new UUID(0, 4),
            meir = new UUID(0, 5),
            fedyaev = new UUID(0, 6);

    @BeforeEach
    void clear() {
        jdbc.execute(
                "TRUNCATE"
                    + " crew_person,crew_identity_binding_version,crew_person_equivalence_decision,crew_identity_decision_evidence"
                    + " RESTART IDENTITY CASCADE");
    }

    void person(UUID id, int age) {
        jdbc.update(
                "INSERT INTO crew_person(id,created_at) VALUES (?,?)",
                id,
                at.minusSeconds(age).atOffset(ZoneOffset.UTC));
    }

    void key(UUID id, String source, String key) {
        jdbc.update(
                "INSERT INTO crew_person_external_id(person_id,source,external_id) VALUES (?,?,?)",
                id,
                source,
                key);
    }

    void anchors() {
        person(luke, 100);
        person(lukeAlias, 50);
        person(watkins, 100);
        person(watkinsAlias, 50);
        person(meir, 100);
        person(fedyaev, 100);
        key(luke, "NASA_OFFICIAL", "profile:nasa-astronaut-luke-delaney");
        key(lukeAlias, "LAUNCH_LIBRARY_2", "710");
        key(watkins, "NASA_OFFICIAL", "profile:jessica-watkins");
        key(watkinsAlias, "LAUNCH_LIBRARY_2", "582");
        key(meir, "LAUNCH_LIBRARY_2", "573");
        key(fedyaev, "LAUNCH_LIBRARY_2", "732");
    }

    int count(String t) {
        return jdbc.queryForObject("SELECT count(*) FROM " + t, Integer.class);
    }

    List<Map<String, Object>> rows(String t) {
        return jdbc.queryForList("SELECT * FROM " + t + " ORDER BY 1");
    }

    @Test
    void dryRunIsPureApplyIsIdempotentAndOriginalAnchorsMappingsSurvive() {
        anchors();
        var people = rows("crew_person");
        var keys = rows("crew_person_external_id");
        var p = identities.preview(at);
        assertEquals(2, p.proposals());
        assertEquals(4, p.identitiesFound());
        assertEquals(0, count("crew_person_equivalence_decision"));
        assertEquals(luke, p.items().getFirst().representative());
        identities.apply(at);
        var decisions = rows("crew_identity_binding_version");
        var proof = rows("crew_identity_decision_evidence");
        assertEquals(2, identities.apply(at.plusSeconds(1)).alreadyActive());
        assertEquals(decisions, rows("crew_identity_binding_version"));
        assertEquals(proof, rows("crew_identity_decision_evidence"));
        assertEquals(people, rows("crew_person"));
        assertEquals(keys, rows("crew_person_external_id"));
        assertEquals(luke, identities.knowledge(at).canonicalize(lukeAlias));
        assertEquals(watkins, identities.knowledge(at).canonicalize(watkinsAlias));
        assertEquals(meir, identities.knowledge(at).canonicalize(meir));
        assertEquals(fedyaev, identities.knowledge(at).canonicalize(fedyaev));
        assertEquals(lukeAlias, identities.knowledge(at.minusSeconds(1)).canonicalize(lukeAlias));
    }

    @Test
    void missingIdentitiesStayPendingWithoutFabricatedPeopleAndCompleteAfterArrival() {
        person(luke, 100);
        key(luke, "NASA_OFFICIAL", "profile:nasa-astronaut-luke-delaney");
        assertEquals(2, identities.apply(at).pending());
        assertEquals(1, count("crew_person"));
        assertEquals(4, count("crew_identity_binding_version"));
        person(lukeAlias, 50);
        key(lukeAlias, "LAUNCH_LIBRARY_2", "710");
        identities.apply(at.plusSeconds(1));
        assertEquals(luke, identities.knowledge(at.plusSeconds(1)).canonicalize(lukeAlias));
        assertEquals(2, count("crew_person"));
        assertEquals(6, count("crew_identity_binding_version"));
    }

    @Test
    void reversedProviderArrivalChoosesEarliestAnchorAndUuidTieIsDeterministic() {
        person(lukeAlias, 100);
        person(luke, 50);
        key(lukeAlias, "LAUNCH_LIBRARY_2", "710");
        key(luke, "NASA_OFFICIAL", "profile:nasa-astronaut-luke-delaney");
        identities.apply(at);
        assertEquals(lukeAlias, identities.knowledge(at).canonicalize(luke));
        clear();
        person(luke, 50);
        person(lukeAlias, 50);
        key(lukeAlias, "LAUNCH_LIBRARY_2", "710");
        key(luke, "NASA_OFFICIAL", "profile:nasa-astronaut-luke-delaney");
        identities.apply(at);
        assertEquals(luke, identities.knowledge(at).canonicalize(lukeAlias));
    }

    @Test
    void concurrentReviewedApplicationAndRestartDoNotDuplicateDecisions() throws Exception {
        anchors();
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> identities.apply(at));
            var b = pool.submit(() -> identities.apply(at));
            a.get(20, TimeUnit.SECONDS);
            b.get(20, TimeUnit.SECONDS);
        }
        assertEquals(2, count("crew_person_equivalence_decision"));
        assertEquals(4, count("crew_identity_binding_version"));
        var restarted = new JdbcCrewIdentityRepository(jdbc);
        assertEquals(luke, restarted.knowledge(at).canonicalize(lukeAlias));
        assertEquals(2, restarted.preview(at).alreadyActive());
    }

    @Test
    void revocationIsAppendOnlyUsesLatestVersionAndAutomaticReapplyCannotReactivate() {
        anchors();
        identities.apply(at);
        var original = rows("crew_person");
        identities.revoke(
                "luke-delaney-v1", at.plusSeconds(1), "TEST_ONLY separate reviewed correction");
        assertEquals(luke, identities.knowledge(at).canonicalize(lukeAlias));
        assertEquals(lukeAlias, identities.knowledge(at.plusSeconds(1)).canonicalize(lukeAlias));
        assertEquals(watkins, identities.knowledge(at.plusSeconds(1)).canonicalize(watkinsAlias));
        identities.apply(at.plusSeconds(2));
        assertEquals(3, count("crew_person_equivalence_decision"));
        assertEquals(original, rows("crew_person"));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_current_person_equivalence WHERE"
                            + " declaration_key='luke-delaney-v1'",
                        Integer.class));
        assertThrows(
                RuntimeException.class,
                () -> jdbc.update("UPDATE crew_identity_binding_version SET policy_version='bad'"));
        assertThrows(
                RuntimeException.class,
                () -> jdbc.update("DELETE FROM crew_person_equivalence_decision"));
        assertThrows(
                RuntimeException.class,
                () -> jdbc.update("DELETE FROM crew_identity_decision_evidence"));
    }

    void equivalence(UUID a, UUID b, UUID representative, Long predecessor) {
        jdbc.update(
                """
                INSERT INTO crew_person_equivalence_decision(declaration_key,left_person_id,right_person_id,representative_id,status,method,policy_version,decided_at,known_at,actor_category,predecessor_id)
                VALUES ('TEST_ONLY',?,?,?,'ACTIVE','REVIEWED_SAME_HUMAN','TEST_ONLY',?,?,'MAINTAINER_REVIEWED',?)
                """,
                a,
                b,
                representative,
                at.atOffset(ZoneOffset.UTC),
                at.atOffset(ZoneOffset.UTC),
                predecessor);
    }

    @Test
    void selfReversePairConflictingRepresentativeAndTransitiveChainAreRejected() {
        anchors();
        identities.apply(at);
        assertThrows(RuntimeException.class, () -> equivalence(luke, luke, luke, null));
        assertThrows(RuntimeException.class, () -> equivalence(lukeAlias, luke, luke, null));
        assertThrows(RuntimeException.class, () -> equivalence(luke, lukeAlias, luke, null));
        assertThrows(RuntimeException.class, () -> equivalence(lukeAlias, meir, lukeAlias, null));
        assertThrows(RuntimeException.class, () -> equivalence(lukeAlias, watkins, watkins, null));
        assertEquals(2, count("crew_person_equivalence_decision"));
    }

    @Test
    void evidenceFailureRollsBackWholeReviewedApplication() {
        anchors();
        jdbc.execute(
                "CREATE FUNCTION test_fail_proof() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN"
                    + " RAISE EXCEPTION 'TEST_ONLY proof failure'; END $$");
        jdbc.execute(
                "CREATE TRIGGER test_fail_proof BEFORE INSERT ON crew_identity_decision_evidence"
                    + " FOR EACH ROW EXECUTE FUNCTION test_fail_proof()");
        try {
            assertThrows(RuntimeException.class, () -> identities.apply(at));
            assertEquals(0, count("crew_identity_binding_version"));
            assertEquals(0, count("crew_person_equivalence_decision"));
            assertEquals(0, count("crew_identity_decision_evidence"));
        } finally {
            jdbc.execute("DROP TRIGGER test_fail_proof ON crew_identity_decision_evidence");
            jdbc.execute("DROP FUNCTION test_fail_proof()");
        }
    }

    @Test
    void evidenceFkAndOwnerInvariantsRejectOrphanAndMultipleOwners() {
        anchors();
        identities.apply(at);
        assertThrows(
                RuntimeException.class,
                () ->
                        jdbc.update(
                                "INSERT INTO"
                                    + " crew_identity_decision_evidence(binding_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary)"
                                    + " VALUES"
                                    + " (99999,'PRIMARY_OFFICIAL','TEST_ONLY','https://example.test',now(),?,'x','x')",
                                "a".repeat(64)));
        assertThrows(
                RuntimeException.class,
                () ->
                        jdbc.update(
                                "INSERT INTO"
                                    + " crew_identity_decision_evidence(binding_id,equivalence_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary)"
                                    + " VALUES"
                                    + " (1,1,'PRIMARY_OFFICIAL','TEST_ONLY','https://example.test',now(),?,'x','x')",
                                "a".repeat(64)));
    }

    @Test
    void pendingApprovalCanBeRevokedBeforeEitherProviderArrives() {
        identities.apply(at);
        identities.revoke(
                "luke-delaney-v1", at.plusSeconds(1), "TEST_ONLY pending review withdrawn");
        person(luke, 100);
        person(lukeAlias, 50);
        key(luke, "NASA_OFFICIAL", "profile:nasa-astronaut-luke-delaney");
        key(lukeAlias, "LAUNCH_LIBRARY_2", "710");
        identities.apply(at.plusSeconds(2));
        assertEquals(lukeAlias, identities.knowledge(at.plusSeconds(2)).canonicalize(lukeAlias));
    }

    @Test
    void explicitSupersessionPreservesOldBindingAndRejectsStaleReviewer() {
        anchors();
        identities.apply(at);
        var key =
                new CrewCanonicalIdentity.Key(
                        CrewSource.NASA_OFFICIAL,
                        "PERSON_PROFILE_RESOURCE",
                        "profile:nasa-astronaut-luke-delaney");
        long old =
                jdbc.queryForObject(
                        "SELECT id FROM crew_current_identity_binding WHERE"
                            + " external_key='profile:nasa-astronaut-luke-delaney'",
                        Long.class);
        var proof = ReviewedCrewIdentities.load().declarations().getFirst().evidence();
        identities.supersedeBinding(
                key, meir, old, at.plusSeconds(1), "TEST_ONLY correction", proof);
        assertEquals(luke, identities.knowledge(at).resolveProviderIdentity(key));
        assertEquals(meir, identities.knowledge(at.plusSeconds(1)).resolveProviderIdentity(key));
        assertThrows(
                IllegalStateException.class,
                () ->
                        identities.supersedeBinding(
                                key, fedyaev, old, at.plusSeconds(2), "TEST_ONLY stale", proof));
        assertThrows(IllegalStateException.class, () -> identities.apply(at.plusSeconds(2)));
    }

    @Test
    void prooflessDecisionCannotCommit() {
        anchors();
        assertThrows(RuntimeException.class, () -> equivalence(luke, lukeAlias, luke, null));
    }

    @Test
    void typedNamespaceSeparatesTopicAndPersonResource() {
        anchors();
        identities.apply(at);
        assertNull(
                identities
                        .knowledge(at)
                        .resolveProviderIdentity(
                                new CrewCanonicalIdentity.Key(
                                        CrewSource.NASA_OFFICIAL,
                                        "PERSON_PROFILE_TOPIC_RESOURCE",
                                        "profile:jessica-watkins")));
    }
}
