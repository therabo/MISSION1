package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

@SpringBootTest
@Testcontainers
class JdbcCrewRepositoryTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10")
            .withDatabaseName("mission1_test").withUsername("mission1_test").withPassword("test_only");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired CrewRepository repository;
    @Autowired JdbcTemplate jdbc;
    FixtureCrewSource fixture;
    CrewIngestionService service;
    CrewQueryService query;
    final JsonMapper json = JsonMapper.builder().build();
    final CrewIngestionPolicy policy = new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5));

    @BeforeEach void setup() throws Exception {
        jdbc.execute("TRUNCATE crew_source_sync_run, crew_source_snapshot, crew_person,"
                    + " crew_person_external_id, crew_expedition, crew_expedition_external_id,"
                    + " crew_expedition_observation, crew_person_observation,"
                    + " crew_assignment_observation RESTART IDENTITY CASCADE");
        fixture = new FixtureCrewSource();
        service = coordinator(fixture.source);
        query = new CrewQueryService(repository, fixture.clock);
    }
    @AfterEach void close() { fixture.close(); }
    CrewIngestionService coordinator(StructuredCrewSource source) {
        return new CrewIngestionService(source, repository, policy, fixture.clock, fixture.source.currentExpeditionUrl());
    }
    CrewRepository.StoredSnapshot ingest() {
        var result = service.ingest(); assertEquals(CrewSyncRun.Outcome.SUCCESS, result.outcome());
        return repository.findSnapshot(result.snapshotId()).orElseThrow();
    }
    int count(String table) { return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class); }
    CrewQueryService.Latest latest() { return query.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElseThrow(); }
    ObjectNode page() throws Exception { return (ObjectNode) json.readTree(fixture.body); }
    ObjectNode expedition(ObjectNode page) { return (ObjectNode) page.get("results").get(0); }
    ObjectNode astronaut(ObjectNode page, int i) { return (ObjectNode) expedition(page).get("crew").get(i).get("astronaut"); }
    Map<String, AstronautProfile> profiles(CrewSourceSnapshot s) {
        var result = new HashMap<String, AstronautProfile>();
        s.profiles().forEach(p -> result.put(p.person().externalIds().getFirst().value(), p)); return result;
    }

    @Test void cleanDatabaseMigratesPublicBaselineAndTelemetryWithoutChangingCrewSchema() {
        assertEquals(List.of("1","2"), jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank", String.class));
        assertEquals(78, jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
                            + " AND table_name LIKE 'crew_%'", Integer.class));
        assertTrue(query.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).isEmpty());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM information_schema.columns WHERE"
                            + " table_schema='public' AND column_name IN ('currently_aboard_iss',"
                            + " 'station_presence')", Integer.class));
    }



    @Test void roundTripsRealRecordedObservationsWithIdentityProvenanceDurationsAndRights() {
        var original = fixture.source.fetchCurrentExpedition(Station.ISS).value();
        var stored = ingest(); var restored = stored.snapshot();
        assertEquals(original.observation(), restored.observation());
        assertEquals("4", restored.sourceStationExternalId());
        assertEquals(original.expeditions().getFirst().name(), restored.expeditions().getFirst().name());
        assertNotNull(restored.expeditions().getFirst().mission1Id());
        assertEquals(7, restored.assignments().size());
        var byId = profiles(restored);
        for (var p : original.profiles()) {
            var r = byId.get(p.person().externalIds().getFirst().value());
            assertNotNull(r.person().mission1Id()); assertEquals(p.person().displayName(), r.person().displayName());
            assertEquals(p.agency(), r.agency()); assertEquals(p.nationalities(), r.nationalities());
            assertEquals(p.media(), r.media()); assertEquals(p.career(), r.career());
            assertEquals(p.biography(), r.biography()); assertEquals(p.inSpace(), r.inSpace());
            assertEquals("list", r.sourceProfileMode());
        }
        assertTrue(restored.profiles().stream().allMatch(p -> Boolean.TRUE.equals(p.inSpace())));
        assertEquals(200, latest().successfulRun().httpStatus());
        assertEquals(7, count("crew_person")); assertEquals(1, count("crew_expedition"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
                            + " AND table_name LIKE '%presence%'", Integer.class));
    }

    @Test void identicalFetchesAreTwoRunsOneSnapshotAndOneGraph() {
        var first = service.ingest(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        var second = service.ingest();
        assertTrue(first.snapshotInserted()); assertFalse(second.snapshotInserted());
        assertEquals(first.snapshotId(), second.snapshotId()); assertNotEquals(first.runId(), second.runId());
        assertEquals(2, count("crew_source_sync_run")); assertEquals(1, count("crew_source_snapshot"));
        assertEquals(7, count("crew_person_observation")); assertEquals(7, count("crew_assignment_observation"));
        assertEquals(1, count("crew_expedition_observation")); assertEquals(2, fixture.requests.get());
        assertEquals(fixture.clock.time, latest().latestSuccessfulFetchAt());
        assertEquals(Instant.parse("2026-10-03T10:00:00Z"), latest().snapshot().snapshot().observation().retrievedAt());
    }

    @Test void changedProfileRoleAndRosterRetainOldRowsAndStableIdentities() throws Exception {
        var a = ingest(); var page = page();
        astronaut(page, 0).put("name", "SYNTHETIC_TEST_NEW_SPELLING").put("bio", "SYNTHETIC_TEST_PROFILE_CHANGE").put("in_space", false);
        astronaut(page, 0).put("time_in_space", "PT123.123456789S").put("flights_count", 9);
        ((ObjectNode) astronaut(page, 0).get("image")).put("credit", "SYNTHETIC_TEST_CREDIT");
        ((ObjectNode) expedition(page).get("crew").get(0).get("role")).put("role", "Flight Engineer");
        ((ArrayNode) expedition(page).get("crew")).remove(6);
        fixture.body = page.toString(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        var b = ingest();
        var ap = profiles(a.snapshot()).get("573"); var bp = profiles(b.snapshot()).get("573");
        assertEquals(ap.person().mission1Id(), bp.person().mission1Id());
        assertEquals(a.snapshot().expeditions().getFirst().mission1Id(), b.snapshot().expeditions().getFirst().mission1Id());
        assertEquals(Duration.parse("PT123.123456789S"), bp.career().timeInSpace()); assertEquals(9, bp.career().flightsCount());
        assertFalse(bp.inSpace()); assertNotEquals(ap.biography(), bp.biography()); assertNotEquals(ap.media(), bp.media());
        assertEquals(a.snapshot(), repository.findSnapshot(a.id()).orElseThrow().snapshot());
        assertEquals(7, a.snapshot().assignments().size()); assertEquals(6, b.snapshot().assignments().size());
        assertEquals(CrewRole.COMMANDER, a.snapshot().assignments().getFirst().role());
        assertEquals(CrewRole.FLIGHT_ENGINEER, b.snapshot().assignments().getFirst().role());
        assertEquals(7, count("crew_person")); assertEquals(13, count("crew_assignment_observation"));
        assertEquals(2, count("crew_source_snapshot"));
    }

    @Test void sameNameWithDifferentSourceIdCreatesDifferentIdentity() throws Exception {
        var a = ingest(); var page = page(); astronaut(page, 0).put("id", 99999); // TEST same-name/different-person
        fixture.body = page.toString(); var b = ingest();
        assertNotEquals(profiles(a.snapshot()).get("573").person().mission1Id(), profiles(b.snapshot()).get("99999").person().mission1Id());
        assertEquals(8, count("crew_person"));
    }

    @Test void changedExpeditionHasNewAnchorAndKeepsOldExpedition() throws Exception {
        var a = ingest(); var page = page(); expedition(page).put("id", 99999).put("name", "SYNTHETIC_TEST_EXPEDITION");
        fixture.body = page.toString(); var b = ingest();
        assertNotEquals(a.snapshot().expeditions().getFirst().mission1Id(), b.snapshot().expeditions().getFirst().mission1Id());
        assertEquals(2, count("crew_expedition")); assertEquals(a.snapshot(), repository.findSnapshot(a.id()).orElseThrow().snapshot());
    }

    @Test void nullableFixtureAndMultipleNationalitiesRoundTripWithoutDefaults() throws Exception {
        var page = page(); var nullable = json.readTree(FixtureCrewSource.fixture("astronaut-nullable-fields"));
        ((ObjectNode)expedition(page).get("crew").get(0)).set("astronaut", nullable);
        ((ArrayNode) astronaut(page, 1).get("nationality")).add(json.readTree("{\"name\":\"SYNTHETIC_TEST_COUNTRY\",\"alpha_2_code\":null,\"alpha_3_code\":null}"));
        fixture.body = page.toString(); var result = profiles(ingest().snapshot());
        var p = result.get("573"); assertNull(p.agency()); assertNull(p.media()); assertNull(p.inSpace());
        assertNull(p.biography()); assertTrue(p.nationalities().isEmpty()); assertNull(p.career().timeInSpace());
        assertNull(p.career().flightsCount()); assertEquals(2, result.get("713").nationalities().size());
        assertNull(result.get("713").nationalities().getLast().alpha2());
    }

    @ParameterizedTest @EnumSource(value = CrewSourceState.class, names = {"SOURCE_UNAVAILABLE", "NOT_FOUND", "RATE_LIMITED", "MALFORMED_RESPONSE", "NO_ACTIVE_EXPEDITION", "AMBIGUOUS"})
    void failedSourceRunPreservesLastSuccessAndRecordsOutcome(CrewSourceState state) {
        var a = ingest(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        var source = mock(StructuredCrewSource.class);
        CrewSourceResult<CrewSourceSnapshot> result;
        if (state == CrewSourceState.NO_ACTIVE_EXPEDITION || state == CrewSourceState.AMBIGUOUS) {
            result = new CrewSourceResult<>(state, a.snapshot(), a.snapshot().observation(), null, 200);
        } else {
            int status = state == CrewSourceState.RATE_LIMITED ? 429 : state == CrewSourceState.NOT_FOUND ? 404 : 500;
            result = new CrewSourceResult<>(state, null, null, new CrewSourceResult.Failure(
                    CrewSourceResult.FailureCode.HTTP_ERROR, status, state == CrewSourceState.RATE_LIMITED ? "10800" : null));
        }
        when(source.fetchCurrentExpedition(Station.ISS)).thenReturn(result);
        var failed = coordinator(source).ingest();
        assertEquals(CrewSyncRun.Outcome.SOURCE_RESULT, failed.outcome());
        assertEquals(state, repository.findRun(failed.runId()).orElseThrow().sourceState());
        assertEquals(a.id(), latest().snapshot().id()); assertEquals(1, count("crew_source_snapshot"));
        assertEquals(failed.runId(), query.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).lastFailure().orElseThrow().id());
        assertEquals(fixture.clock.time, query.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).lastAttempt().orElseThrow().startedAt());
    }

    @Test void timeoutIsRecordedWithoutFabricatedHttpStatusOrEmptySnapshot() {
        var source = mock(StructuredCrewSource.class);
        when(source.fetchCurrentExpedition(Station.ISS)).thenReturn(new CrewSourceResult<>(CrewSourceState.SOURCE_UNAVAILABLE,
                null, null, new CrewSourceResult.Failure(CrewSourceResult.FailureCode.TIMEOUT, null, null)));
        var result = coordinator(source).ingest(); var run = repository.findRun(result.runId()).orElseThrow();
        assertEquals("TIMEOUT", run.errorCode()); assertNull(run.httpStatus()); assertNull(run.observation());
        assertEquals(0, count("crew_source_snapshot")); assertTrue(query.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).isEmpty());
    }

    @Test void actual429PersistsRetryAfterAndSuppressesRequestsAcrossCoordinatorRestart() {
        fixture.status = 429; service.ingest(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        var restarted = coordinator(fixture.source); var skipped = restarted.ingestScheduled();
        assertEquals(CrewSyncRun.Outcome.SKIPPED_RATE_LIMIT, skipped.outcome()); assertEquals(1, fixture.requests.get());
        assertEquals(Instant.parse("2026-10-03T13:00:00Z"), repository.retryAfterAt(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElseThrow());
        assertTrue(query.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).rateLimited());
        fixture.clock.time = fixture.clock.time.plusSeconds(3600); fixture.status = 200;
        assertEquals(CrewSyncRun.Outcome.SUCCESS, restarted.ingestScheduled().outcome()); assertEquals(2, fixture.requests.get());
        assertFalse(query.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).rateLimited());
    }

    @Test void scheduledCadenceUsesDurableAttemptAndSkipsDoNotPostponeEligibility() {
        ingest(); fixture.clock.time = fixture.clock.time.plusSeconds(3600);
        assertEquals(CrewSyncRun.Outcome.SKIPPED_NOT_DUE, coordinator(fixture.source).ingestScheduled().outcome());
        fixture.clock.time = fixture.clock.time.plusSeconds(3600);
        assertEquals(CrewSyncRun.Outcome.SUCCESS, coordinator(fixture.source).ingestScheduled().outcome());
        assertEquals(2, fixture.requests.get());
    }

    @Test void latestSuccessfulRunCanReuseOlderSnapshotAfterNewerSnapshotAndFailure() throws Exception {
        String aBody = fixture.body; var a = ingest(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        var p = page(); astronaut(p, 0).put("bio", "SYNTHETIC_TEST_B"); fixture.body = p.toString(); var b = ingest();
        fixture.clock.time = fixture.clock.time.plusSeconds(7200); fixture.body = aBody; var c = ingest();
        assertEquals(a.id(), c.id()); assertNotEquals(b.id(), latest().snapshot().id());
        fixture.clock.time = fixture.clock.time.plusSeconds(7200); fixture.status = 500; service.ingest();
        assertEquals(a.id(), latest().snapshot().id());
        assertEquals(Instant.parse("2026-10-03T14:00:00Z"), latest().latestSuccessfulFetchAt());
        assertEquals(2, count("crew_source_snapshot")); assertEquals(4, count("crew_source_sync_run"));
    }

    @Test void midGraphFailureRollsBackIdentitiesAndGraphButKeepsFailedRun() {
        jdbc.execute("CREATE FUNCTION crew_test_fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$"
                    + " BEGIN RAISE EXCEPTION 'TEST failure'; END; $$");
        jdbc.execute("CREATE TRIGGER crew_test_failure BEFORE INSERT ON crew_assignment_observation FOR"
                    + " EACH ROW EXECUTE FUNCTION crew_test_fail_assignment()");
        try {
            var result = service.ingest(); assertEquals(CrewSyncRun.Outcome.PERSISTENCE_FAILURE, result.outcome());
            assertEquals(1, count("crew_source_sync_run")); assertEquals(0, count("crew_source_snapshot"));
            assertEquals(0, count("crew_person")); assertEquals(0, count("crew_expedition"));
            assertEquals(0, count("crew_person_observation")); assertEquals(0, count("crew_expedition_observation"));
            assertEquals("PERSISTENCE_FAILURE", repository.findRun(result.runId()).orElseThrow().errorCode());
        } finally {
            jdbc.execute("DROP TRIGGER crew_test_failure ON crew_assignment_observation");
            jdbc.execute("DROP FUNCTION crew_test_fail_assignment()");
        }
    }

    @Test void failedNewGraphKeepsPreviouslySuccessfulSnapshotUnchanged() throws Exception {
        var old = ingest(); var page = page(); astronaut(page, 0).put("bio", "SYNTHETIC_TEST_FAILED_UPDATE");
        fixture.body = page.toString(); fixture.clock.time = fixture.clock.time.plusSeconds(7200);
        jdbc.execute("CREATE FUNCTION crew_test_fail_profile() RETURNS trigger LANGUAGE plpgsql AS $$"
                    + " BEGIN RAISE EXCEPTION 'TEST failure'; END; $$");
        jdbc.execute("CREATE TRIGGER crew_test_failure BEFORE INSERT ON crew_person_observation FOR EACH"
                    + " ROW EXECUTE FUNCTION crew_test_fail_profile()");
        try {
            var failed = service.ingest(); assertEquals(CrewSyncRun.Outcome.PERSISTENCE_FAILURE, failed.outcome());
            assertEquals(old.id(), latest().snapshot().id()); assertEquals(old.snapshot(), latest().snapshot().snapshot());
            assertEquals(1, count("crew_source_snapshot")); assertEquals(7, count("crew_person_observation"));
            assertEquals(2, count("crew_source_sync_run"));
        } finally {
            jdbc.execute("DROP TRIGGER crew_test_failure ON crew_person_observation");
            jdbc.execute("DROP FUNCTION crew_test_fail_profile()");
        }
    }

    @Test void persistenceExplicitlyTruncatesAbsoluteInstantsButKeepsDurationNanoseconds() throws Exception {
        fixture.clock.time = fixture.clock.time.plusNanos(123456789);
        var page = page(); astronaut(page, 0).put("eva_time", "PT1.123456789S"); fixture.body = page.toString();
        var s = ingest().snapshot();
        assertEquals(fixture.clock.time.truncatedTo(java.time.temporal.ChronoUnit.MICROS), s.observation().retrievedAt());
        assertEquals(Duration.parse("PT1.123456789S"), profiles(s).get("573").career().evaTime());
    }

    @Test void databaseRejectsHistoryMutationDuplicateMappingsAndDuplicateAssignments() {
        var s = ingest();
        for (String table : List.of("crew_source_snapshot", "crew_person_observation", "crew_expedition_observation", "crew_assignment_observation"))
            assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM " + table));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE crew_person_observation SET biography='TEST'"));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO crew_person_external_id SELECT * FROM"
                                    + " crew_person_external_id"));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO crew_assignment_observation SELECT * FROM"
                                    + " crew_assignment_observation"));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO crew_source_snapshot"
                                    + " (source,station,source_api_version,adapter_version,source_station_external_id,content_hash,first_observed_at,source_url,total_active_expeditions,candidates_complete)"
                                    + " SELECT"
                                    + " source,station,source_api_version,adapter_version,source_station_external_id,content_hash,first_observed_at,source_url,total_active_expeditions,candidates_complete"
                                    + " FROM crew_source_snapshot"));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM crew_person"));
        assertEquals(s.snapshot(), repository.findSnapshot(s.id()).orElseThrow().snapshot());
    }

    @Test void concurrentDirectPersistenceStillDeduplicatesSnapshotAndIdentities() throws Exception {
        var snapshot = fixture.source.fetchCurrentExpedition(Station.ISS).value();
        long a = repository.startRun(CrewSource.LAUNCH_LIBRARY_2, Station.ISS, fixture.clock.time, fixture.source.currentExpeditionUrl());
        long b = repository.startRun(CrewSource.LAUNCH_LIBRARY_2, Station.ISS, fixture.clock.time, fixture.source.currentExpeditionUrl());
        var c = new CrewRepository.Completion(fixture.clock.time, CrewSyncRun.Outcome.SUCCESS, CrewSourceState.AVAILABLE, 200, snapshot.observation(), null, null, null, null);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var x = executor.submit(() -> repository.storeSuccessfulRun(a, snapshot, c));
            var y = executor.submit(() -> repository.storeSuccessfulRun(b, snapshot, c));
            assertEquals(x.get(10, TimeUnit.SECONDS).snapshotId(), y.get(10, TimeUnit.SECONDS).snapshotId());
        }
        assertEquals(1, count("crew_source_snapshot")); assertEquals(7, count("crew_person")); assertEquals(2, count("crew_source_sync_run"));
    }

    @Test void overlappingCoordinatorInvocationRecordsSkipWithoutSecondSourceCall() throws Exception {
        var source = mock(StructuredCrewSource.class); var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var result = fixture.source.fetchCurrentExpedition(Station.ISS);
        when(source.fetchCurrentExpedition(Station.ISS)).thenAnswer(inv -> { entered.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS)); return result; });
        var coordinator = coordinator(source);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var first = executor.submit(coordinator::ingest);
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                assertEquals(CrewSyncRun.Outcome.SKIPPED_OVERLAP, coordinator.ingest().outcome());
            } finally { release.countDown(); }
            assertEquals(CrewSyncRun.Outcome.SUCCESS, first.get(10, TimeUnit.SECONDS).outcome());
        }
        verify(source, times(1)).fetchCurrentExpedition(Station.ISS); assertEquals(2, count("crew_source_sync_run"));
    }
}
