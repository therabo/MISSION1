package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.*;
import com.sun.net.httpserver.HttpServer;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.ll2.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.net.*;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Loopback HTTP + real PostgreSQL only. Changed payloads are explicitly TEST_ONLY. */
@SpringBootTest
@Testcontainers
class JdbcCrewRefreshRepositoryTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.10")
                    .withDatabaseName("mission1_test")
                    .withUsername("mission1_test")
                    .withPassword("test_only");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired CrewRepository runs;
    @Autowired CrewVerificationRepository verification;
    @Autowired CrewReconciliationRepository reconciled;
    @Autowired CrewRefreshRepository refresh;
    @Autowired JdbcTemplate jdbc;
    FixtureCrewSource fixture;
    HttpServer server;
    CrewEventSource events;
    CrewIngestionService roster;
    NasaCrewVerificationIngestionService nasa;
    CrewReconciliationService reconciliation;
    CrewReconciliationQueryService query;
    CrewRefreshCoordinator coordinator;
    final JsonMapper json = new JsonMapper();
    ObjectNode page;
    byte[] nasaBody;
    int eventStatus = 200, nasaStatus = 200;
    String eventRetry = "10800", nasaRetry = "10800", seenEtag, seenModified;
    AtomicInteger eventRequests = new AtomicInteger(), nasaRequests = new AtomicInteger();
    final Instant start = Instant.parse("2026-10-03T00:00:00Z");

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute(
                "TRUNCATE"
                    + " crew_source_sync_run,crew_source_snapshot,crew_person,crew_person_external_id,crew_expedition,crew_expedition_external_id,crew_expedition_observation,crew_person_observation,crew_assignment_observation,crew_document_body,crew_source_document,crew_verification_evidence,crew_evidence_subject,crew_document_evidence,crew_identity_resolution,crew_reconciliation_run,crew_reconciliation_snapshot,crew_reconciliation_evidence,crew_reconciliation_resolution,crew_reconciled_person,crew_reconciled_person_evidence,crew_event_catalog_run,crew_operational_event_observation,crew_event_catalog_observation,crew_refresh_follow_up,crew_refresh_trigger"
                    + " RESTART IDENTITY CASCADE");
        fixture = new FixtureCrewSource();
        fixture.clock.time = start;
        page =
                (ObjectNode)
                        json.readTree(
                                getClass()
                                        .getResourceAsStream(
                                                "/fixtures/crew/ll2/events-calendar.json"));
        page.put("count", 0);
        page.set("results", json.createArrayNode());
        nasaBody =
                feed(
                        "TEST_ONLY Science update",
                        "<p>Research continues aboard the orbital laboratory.</p>",
                        start.minusSeconds(60));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/2.3.0/events/",
                e -> {
                    eventRequests.incrementAndGet();
                    e.getResponseHeaders().add("Content-Type", "application/json");
                    if (eventRetry != null) e.getResponseHeaders().add("Retry-After", eventRetry);
                    byte[] b = page.toString().getBytes();
                    e.sendResponseHeaders(eventStatus, b.length);
                    try (var out = e.getResponseBody()) {
                        out.write(b);
                    }
                });
        server.createContext(
                "/nasa",
                e -> {
                    nasaRequests.incrementAndGet();
                    seenEtag = e.getRequestHeaders().getFirst("If-None-Match");
                    seenModified = e.getRequestHeaders().getFirst("If-Modified-Since");
                    e.getResponseHeaders().add("Content-Type", "application/rss+xml");
                    e.getResponseHeaders().add("ETag", "TEST_ETAG");
                    e.getResponseHeaders().add("Last-Modified", "Sat, 03 Oct 2026 00:00:00 GMT");
                    e.getResponseHeaders().add("Retry-After", nasaRetry);
                    e.sendResponseHeaders(nasaStatus, nasaStatus == 304 ? -1 : nasaBody.length);
                    try (var out = e.getResponseBody()) {
                        if (nasaStatus != 304) out.write(nasaBody);
                    }
                });
        server.start();
        var base = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/2.3.0/");
        events =
                new LaunchLibrary2CrewEventSource(
                        new CrewHttpReader(
                                HttpClient.newHttpClient(), fixture.clock, Duration.ofSeconds(2)),
                        base,
                        4);
        roster =
                new CrewIngestionService(
                        fixture.source,
                        runs,
                        new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
                        fixture.clock,
                        fixture.source.currentExpeditionUrl());
        // Official feed source URL is preserved in service lineage; test transport forwards the
        // request to loopback.
        CrewVerificationHttpSource transport =
                (url, etag, modified) -> {
                    try {
                        var b =
                                java.net.http.HttpRequest.newBuilder(
                                                URI.create(
                                                        "http://127.0.0.1:"
                                                                + server.getAddress().getPort()
                                                                + "/nasa"))
                                        .GET();
                        if (etag != null) b.header("If-None-Match", etag);
                        if (modified != null) b.header("If-Modified-Since", modified);
                        var response =
                                HttpClient.newHttpClient()
                                        .send(
                                                b.build(),
                                                java.net.http.HttpResponse.BodyHandlers
                                                        .ofByteArray());
                        return new CrewVerificationHttpSource.Fetch(
                                response.body(),
                                response.statusCode() == 200 || response.statusCode() == 304
                                        ? null
                                        : new CrewSourceResult.Failure(
                                                CrewSourceResult.FailureCode.HTTP_ERROR,
                                                response.statusCode(),
                                                response.headers()
                                                        .firstValue("Retry-After")
                                                        .orElse(null)),
                                response.statusCode(),
                                "application/rss+xml",
                                response.headers().firstValue("ETag").orElse(null),
                                response.headers().firstValue("Last-Modified").orElse(null),
                                fixture.clock.time);
                    } catch (Exception ex) {
                        throw new IllegalStateException(ex);
                    }
                };
        nasa =
                new NasaCrewVerificationIngestionService(
                        transport,
                        new NasaOperationalFeedParser(),
                        verification,
                        runs,
                        new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
                        fixture.clock,
                        NasaOperationalFeedHttpSource.URL,
                        NasaOperationalFeedParser.NAME,
                        NasaOperationalFeedParser.VERSION);
        reconciliation =
                new CrewReconciliationService(
                        runs,
                        new CrewQueryService(runs, fixture.clock),
                        verification,
                        reconciled,
                        CrewReconciliationPolicy.defaults(),
                        fixture.clock);
        query =
                new CrewReconciliationQueryService(
                        reconciliation,
                        new CrewQueryService(runs, fixture.clock),
                        reconciled,
                        verification,
                        runs);
        coordinator = coordinator(true, true, true);
    }

    @AfterEach
    void close() {
        server.stop(0);
        fixture.close();
    }

    CrewRefreshCoordinator coordinator(boolean r, boolean n, boolean e) {
        return new CrewRefreshCoordinator(
                new CrewRefreshPolicy(CrewRefreshPolicy.Settings.defaults()),
                refresh,
                runs,
                verification,
                query,
                reconciliation,
                roster,
                nasa,
                events,
                fixture.clock,
                r,
                n,
                e,
                Duration.ofMinutes(5),
                Duration.ofMinutes(10),
                Duration.ofMinutes(15));
    }

    byte[] feed(String title, String html, Instant published) {
        return ("<rss xmlns:content='http://purl.org/rss/1.0/modules/content/'><channel><title>International"
                    + " Space Station - NASA</title><item><title>"
                        + title
                        + "</title><guid>TEST_ONLY_"
                        + title
                        + "</guid><link>https://www.nasa.gov/blogs/TEST_ONLY/</link><pubDate>"
                        + DateTimeFormatter.RFC_1123_DATE_TIME.format(
                                published.atZone(ZoneOffset.UTC))
                        + "</pubDate><content:encoded><![CDATA["
                        + html
                        + "]]></content:encoded></item></channel></rss>")
                .getBytes(StandardCharsets.UTF_8);
    }

    void advance(long minutes) {
        fixture.clock.time = fixture.clock.time.plusSeconds(minutes * 60);
        coordinator.tick();
    }

    int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    void event(Instant at, boolean crewed) throws Exception {
        var recorded =
                (ObjectNode)
                        json.readTree(
                                getClass()
                                        .getResourceAsStream(
                                                "/fixtures/crew/ll2/events-calendar.json"));
        var row = (ObjectNode) recorded.withArray("results").get(0).deepCopy();
        row.put("date", at.toString());
        row.put(
                "url",
                events.request(fixture.clock.time)
                        .url()
                        .resolve("/2.3.0/events/" + row.get("id").asText() + "/")
                        .toString());
        if (crewed) row.withArray("astronauts").addObject().put("id", 99999);
        page.put("count", 1);
        page.set("results", json.createArrayNode().add(row));
    }

    long catalog() {
        var request = events.request(fixture.clock.time);
        var d =
                new CrewRefreshPolicy.Decision(
                        CrewRefreshPolicy.Target.LL2_EVENT_CATALOG,
                        CrewRefreshPolicy.Reason.BASELINE_CATALOG_REFRESH,
                        Duration.ofHours(6),
                        null,
                        null,
                        null,
                        fixture.clock.time);
        long t = refresh.trigger("TEST_ONLY_CATALOG_" + UUID.randomUUID(), d, fixture.clock.time);
        long run = refresh.startCatalog(request, fixture.clock.time, t);
        var f = events.fetch(request);
        refresh.completeCatalog(
                run,
                f,
                fixture.clock.time,
                f.state() == CrewSourceState.RATE_LIMITED
                        ? new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5))
                                .retryAfter(eventRetry, fixture.clock.time)
                        : null);
        return run;
    }

    @Test
    void startupIsStaggeredAndSourcesCanAllBeDisabled() {
        coordinator.tick();
        assertEquals(0, fixture.requests.get());
        advance(5);
        assertEquals(1, fixture.requests.get());
        assertEquals(0, nasaRequests.get());
        advance(5);
        assertEquals(1, nasaRequests.get());
        assertEquals(0, eventRequests.get());
        advance(5);
        assertEquals(1, eventRequests.get());
        assertEquals(3, count("crew_refresh_trigger"));
        coordinator = coordinator(false, false, false);
        advance(600);
        assertEquals(1, fixture.requests.get());
        assertEquals(1, nasaRequests.get());
        assertEquals(1, eventRequests.get());
    }

    @Test
    void catalogAtoBtoARetainsImmutableHistoryAndCurrentAssociation() throws Exception {
        event(start.plusSeconds(3600), false);
        long a = catalog();
        long first = refresh.latestCatalog().orElseThrow().candidates().getFirst().observationId();
        fixture.clock.time = fixture.clock.time.plusSeconds(1);
        event(start.plusSeconds(7200), false);
        catalog();
        fixture.clock.time = fixture.clock.time.plusSeconds(1);
        event(start.plusSeconds(3600), false);
        catalog();
        assertEquals(2, count("crew_operational_event_observation"));
        assertEquals(3, count("crew_event_catalog_observation"));
        assertEquals(
                first,
                refresh.latestCatalog().orElseThrow().candidates().getFirst().observationId());
        assertThrows(
                RuntimeException.class,
                () ->
                        jdbc.update(
                                "UPDATE crew_operational_event_observation SET external_id='TEST'"
                                        + " WHERE id=?",
                                first));
        assertThrows(
                RuntimeException.class,
                () -> jdbc.update("DELETE FROM crew_event_catalog_run WHERE id=?", a));
    }

    @Test
    void conditional304ReusesEvidenceAndCannotReopenFollowUp() {
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Transfer have entered the International Space"
                                + " Station.</p>",
                        start.minusSeconds(60));
        advance(5);
        advance(5);
        assertEquals(1, count("crew_refresh_follow_up"));
        long evidence = refresh.followUps().getFirst().evidenceId();
        nasaStatus = 304;
        advance(120);
        coordinator.tick();
        coordinator.tick();
        assertEquals("TEST_ETAG", seenEtag);
        assertNotNull(seenModified);
        assertEquals(1, count("crew_refresh_follow_up"));
        assertEquals(evidence, refresh.followUps().getFirst().evidenceId());
        assertEquals(1, count("crew_source_document"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"planned", "count"})
    void plannedAndCountOnlyReportsDoNotAccelerateRoster(String kind) {
        nasaBody =
                feed(
                        "TEST_ONLY " + kind,
                        kind.equals("planned")
                                ? "<p>NASA astronauts Test Transfer will depart the International"
                                        + " Space Station tomorrow.</p>"
                                : "<p>There are seven crew members aboard the International Space"
                                        + " Station.</p>",
                        start.minusSeconds(60));
        advance(5);
        advance(5);
        assertEquals(0, count("crew_refresh_follow_up"));
        advance(60);
        assertEquals(1, fixture.requests.get());
    }

    @Test
    void completedArrivalTriggersThenSettlesOnlyAfterMatchingStructuredAssignment()
            throws Exception {
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Transfer have entered the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        assertEquals(1, count("crew_refresh_follow_up"));
        assertEquals("OPEN", refresh.followUps().getFirst().state());
        advance(55);
        assertEquals(2, fixture.requests.get());
        assertEquals(
                "NASA_COMPLETED_ARRIVAL",
                jdbc.queryForObject(
                        "SELECT reason FROM crew_refresh_trigger WHERE follow_up_id IS NOT NULL"
                                + " ORDER BY id LIMIT 1",
                        String.class));
        var rosterPage = (ObjectNode) json.readTree(fixture.body);
        ((ObjectNode) rosterPage.withArray("results").get(0).get("crew").get(0).get("astronaut"))
                .put("name", "Test Transfer");
        fixture.body = rosterPage.toString();
        advance(60);
        assertEquals("SETTLED", refresh.followUps().getFirst().state());
        assertTrue(
                jdbc.queryForObject(
                                "SELECT count(*) FROM crew_refresh_trigger WHERE"
                                        + " reason='STRUCTURED_SOURCE_LAG_FOLLOW_UP'",
                                Integer.class)
                        > 0);
        int before = fixture.requests.get();
        coordinator = coordinator(true, true, true);
        advance(10);
        assertEquals(before, fixture.requests.get());
        assertEquals("SETTLED", refresh.followUps().getFirst().state());
    }

    @Test
    void unresolvedPartialMatchExhaustsSixAttemptsAndRestartCannotReopen() {
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Departure",
                        "<p>NASA astronauts Test Unresolved have departed the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        for (int i = 0; i < 6; i++) {
            advance(i == 0 ? 55 : 60);
            coordinator.tick();
        }
        assertEquals(6, refresh.followUps().getFirst().attempts());
        assertEquals("ATTEMPTS_EXHAUSTED", refresh.followUps().getFirst().state());
        int before = fixture.requests.get();
        coordinator = coordinator(true, true, true);
        advance(60);
        assertEquals(before, fixture.requests.get());
        assertEquals(1, count("crew_refresh_follow_up"));
    }

    @Test
    void horizonStopsUnresolvedFollowUpWithoutCountEquality() {
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Unresolved have entered the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        advance(1440);
        assertEquals("EXPIRED", refresh.followUps().getFirst().state());
    }

    @Test
    void oldCompletedEvidenceDoesNotRewindPolicy() {
        nasaBody =
                feed(
                        "TEST_ONLY Old arrival",
                        "<p>NASA astronauts Test Transfer have entered the International Space"
                                + " Station.</p>",
                        start.minusSeconds(90000));
        advance(5);
        advance(5);
        assertEquals(0, count("crew_refresh_follow_up"));
    }

    @Test
    void durable429IsSharedBetweenCatalogAndRosterAcrossRestart() {
        eventStatus = 429;
        advance(15);
        coordinator.tick();
        coordinator.tick();
        assertEquals(1, eventRequests.get());
        assertEquals(
                start.plusSeconds(11700),
                runs.retryAfterAt(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElseThrow());
        int before = fixture.requests.get();
        coordinator = coordinator(true, true, true);
        advance(120);
        assertEquals(before, fixture.requests.get());
        assertEquals(1, eventRequests.get());
        advance(60);
        assertEquals(before + 1, fixture.requests.get());
    }

    @Test
    void sharedRollingQuotaIncludesBothLl2Capabilities() {
        for (int i = 0; i < 12; i++) {
            long id =
                    runs.startRun(
                            CrewSource.LAUNCH_LIBRARY_2,
                            Station.ISS,
                            start.plusSeconds(i),
                            fixture.source.currentExpeditionUrl());
            runs.completeRun(
                    id,
                    new CrewRepository.Completion(
                            start.plusSeconds(i),
                            CrewSyncRun.Outcome.UNEXPECTED_FAILURE,
                            null,
                            null,
                            null,
                            null,
                            null,
                            "TEST_ONLY",
                            null));
        }
        assertEquals(start.plusSeconds(3600), refresh.ll2EligibleAt(start.plusSeconds(900), 12));
        coordinator = coordinator(false, false, true);
        advance(15);
        assertEquals(0, eventRequests.get());
        advance(60);
        assertEquals(1, eventRequests.get());
    }

    @Test
    void invalidTriggerAssociationRollsBackSourceRunAndAuditIsImmutable() {
        var d =
                new CrewRefreshPolicy.Decision(
                        CrewRefreshPolicy.Target.NASA_VERIFICATION,
                        CrewRefreshPolicy.Reason.BASELINE_SCHEDULE,
                        Duration.ofHours(2),
                        null,
                        null,
                        null,
                        start);
        long id = refresh.trigger("TEST_ONLY", d, start);
        assertEquals(id, refresh.trigger("TEST_ONLY", d, start));
        assertThrows(
                RuntimeException.class,
                () ->
                        runs.startTriggeredRun(
                                CrewSource.LAUNCH_LIBRARY_2,
                                Station.ISS,
                                start,
                                fixture.source.currentExpeditionUrl(),
                                id));
        assertEquals(0, count("crew_source_sync_run"));
        assertThrows(
                RuntimeException.class,
                () ->
                        jdbc.update(
                                "UPDATE crew_refresh_trigger SET reason='MANUAL_OR_TEST' WHERE"
                                        + " id=?",
                                id));
    }

    @Test
    void candidateWriteFailureRollsBackGraphAndRecordsCalendarFailure() throws Exception {
        event(start.plusSeconds(3600), false);
        jdbc.execute(
                "CREATE FUNCTION test_event_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN"
                        + " RAISE EXCEPTION 'TEST_ONLY rollback'; END; $$");
        jdbc.execute(
                "CREATE TRIGGER test_event_reject BEFORE INSERT ON crew_event_catalog_observation"
                        + " FOR EACH ROW EXECUTE FUNCTION test_event_reject()");
        try {
            coordinator = coordinator(false, false, true);
            advance(15);
        } finally {
            jdbc.execute("DROP TRIGGER test_event_reject ON crew_event_catalog_observation");
            jdbc.execute("DROP FUNCTION test_event_reject()");
        }
        assertEquals(0, count("crew_operational_event_observation"));
        assertEquals("FAILURE", refresh.latestCatalog().orElseThrow().result());
        assertEquals(
                200,
                jdbc.queryForObject(
                        "SELECT http_status FROM crew_event_catalog_run", Integer.class));
        assertNotNull(
                jdbc.queryForObject(
                        "SELECT content_hash FROM crew_event_catalog_run", String.class));
        assertEquals(1, count("crew_refresh_trigger"));
    }

    @Test
    void competingDatabaseCoordinatorsCannotOwnTheSameTick() throws Exception {
        var acquired = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first =
                    executor.submit(
                            () ->
                                    refresh.withCoordinatorLock(
                                            () -> {
                                                acquired.countDown();
                                                try {
                                                    release.await(5, TimeUnit.SECONDS);
                                                } catch (InterruptedException e) {
                                                    Thread.currentThread().interrupt();
                                                }
                                            }));
            assertTrue(acquired.await(5, TimeUnit.SECONDS));
            assertFalse(refresh.withCoordinatorLock(() -> fail("Concurrent claim")));
            release.countDown();
            assertTrue(first.get(5, TimeUnit.SECONDS));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"normal", "crewed", "rescheduled"})
    void fakeClock24HourSimulationAssertsActualHttpBudgets(String scenario) throws Exception {
        if (!scenario.equals("normal")) event(start.plusSeconds(12 * 3600), true);
        for (int minute = 1; minute <= 1440; minute++) {
            fixture.clock.time = start.plusSeconds(minute * 60L);
            if (scenario.equals("rescheduled") && minute == 720)
                event(start.plusSeconds(30 * 3600), true);
            coordinator.tick();
        }
        int ll2 = fixture.requests.get() + eventRequests.get();
        assertEquals(12, fixture.requests.get());
        assertEquals(4, eventRequests.get());
        assertTrue(ll2 <= 28);
        assertTrue(nasaRequests.get() <= 48);
        if (scenario.equals("normal")) assertEquals(12, nasaRequests.get());
        else assertTrue(nasaRequests.get() > 12);
        assertEquals(
                ll2 + nasaRequests.get(),
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_refresh_trigger WHERE source_sync_run_id IS NOT"
                                + " NULL OR catalog_run_id IS NOT NULL",
                        Integer.class));
        System.out.println(
                "TEST_ONLY 24h "
                        + scenario
                        + ": LL2 roster="
                        + fixture.requests.get()
                        + ", calendar="
                        + eventRequests.get()
                        + ", NASA="
                        + nasaRequests.get());
    }

    @Test
    void v4UpgradePreservesLl2NasaReconciliationAndOrbitSentinels() {
        roster.ingest();
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Jessica Meir have entered the International Space"
                                + " Station.</p>",
                        start.minusSeconds(60));
        nasa.ingest();
        reconciliation.reconcile();
        var migration =
                Flyway.configure()
                        .dataSource(
                                POSTGRES.getJdbcUrl(),
                                POSTGRES.getUsername(),
                                POSTGRES.getPassword())
                        .schemas("event_refresh_upgrade")
                        .target("4")
                        .load();
        assertEquals(4, migration.migrate().migrationsExecuted);
        List<String> tables =
                List.of(
                        "crew_source_snapshot",
                        "crew_person",
                        "crew_person_external_id",
                        "crew_expedition",
                        "crew_expedition_external_id",
                        "crew_expedition_observation",
                        "crew_person_observation",
                        "crew_assignment_observation",
                        "crew_document_body",
                        "crew_source_document",
                        "crew_verification_evidence",
                        "crew_evidence_subject",
                        "crew_document_evidence",
                        "crew_identity_resolution",
                        "crew_source_sync_run",
                        "crew_reconciliation_snapshot",
                        "crew_reconciliation_run",
                        "crew_reconciliation_evidence",
                        "crew_reconciliation_resolution",
                        "crew_reconciled_person",
                        "crew_reconciled_person_evidence");
        Map<String, String> before = new LinkedHashMap<>();
        for (var table : tables) {
            jdbc.execute(
                    "INSERT INTO event_refresh_upgrade."
                            + table
                            + " OVERRIDING SYSTEM VALUE SELECT * FROM public."
                            + table);
            before.put(table, tableHash("event_refresh_upgrade." + table));
        }
        jdbc.update(
                "INSERT INTO"
                    + " event_refresh_upgrade.orbital_element_sets(catalog_number,source_format,line1,line2,element_epoch,provider,upstream_origin,source_uri,sha256,classification)"
                    + " VALUES"
                    + " (25544,'TLE',?,?,now(),'TEST_ONLY','TEST_ONLY','https://example.invalid/TEST',?,'SOURCE_PROVIDED_ORBITAL_ELEMENTS')",
                "1".repeat(69),
                "2".repeat(69),
                "a".repeat(64));
        jdbc.update(
                "INSERT INTO"
                    + " event_refresh_upgrade.nasa_oem_ephemerides(sha256,xml,creation_date,start_time,stop_time,last_retrieved_at)"
                    + " VALUES (?, ?,now(),now(),now()+interval '1 day',now())",
                "c".repeat(64),
                new byte[] {1, 2, 3});
        before.put("orbital_element_sets", tableHash("event_refresh_upgrade.orbital_element_sets"));
        before.put("nasa_oem_ephemerides", tableHash("event_refresh_upgrade.nasa_oem_ephemerides"));
        var latest =
                Flyway.configure()
                        .dataSource(
                                POSTGRES.getJdbcUrl(),
                                POSTGRES.getUsername(),
                                POSTGRES.getPassword())
                        .schemas("event_refresh_upgrade")
                        .load();
        assertEquals(1, latest.migrate().migrationsExecuted);
        latest.validate();
        for (var entry : before.entrySet())
            assertEquals(
                    entry.getValue(),
                    tableHash("event_refresh_upgrade." + entry.getKey()),
                    entry.getKey());
        assertTrue(count("crew_verification_evidence") > 0);
        assertTrue(count("crew_reconciliation_snapshot") > 0);
    }

    String tableHash(String table) {
        return jdbc.queryForObject(
                "SELECT md5(coalesce(string_agg(v,'|' ORDER BY v),'')) FROM (SELECT"
                        + " to_jsonb(t)::text AS v FROM "
                        + table
                        + " t) a",
                String.class);
    }

    @Test
    void interruptedClaimConsumesBudgetAndRestartDoesNotAbandonRun() {
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Unresolved have entered the International Space"
                                + " Station.</p>",
                        start.minusSeconds(60));
        nasa.ingest();
        reconciliation.reconcile();
        coordinator.tick();
        var f = refresh.followUps().getFirst();
        var d =
                new CrewRefreshPolicy.Decision(
                        CrewRefreshPolicy.Target.LL2_ROSTER,
                        CrewRefreshPolicy.Reason.NASA_COMPLETED_ARRIVAL,
                        Duration.ofHours(1),
                        null,
                        f.evidenceId(),
                        f.id(),
                        start);
        long trigger = refresh.trigger("TEST_ONLY_INTERRUPTED", d, start);
        long run =
                runs.startTriggeredRun(
                        CrewSource.LAUNCH_LIBRARY_2,
                        Station.ISS,
                        start,
                        fixture.source.currentExpeditionUrl(),
                        trigger);
        assertEquals(1, refresh.followUps().getFirst().attempts());
        coordinator = coordinator(true, true, true);
        advance(10);
        assertEquals(0, fixture.requests.get());
        assertEquals(CrewSyncRun.Outcome.IN_PROGRESS, runs.findRun(run).orElseThrow().outcome());
        advance(50);
        coordinator.tick();
        assertEquals(1, fixture.requests.get());
        assertEquals(CrewSyncRun.Outcome.IN_PROGRESS, runs.findRun(run).orElseThrow().outcome());
    }

    @ParameterizedTest
    @ValueSource(strings = {"invalid", "Wed, 07 Oct 2026 00:00:00 GMT"})
    void event429FallbackAndRfcDateRemainDurable(String header) {
        eventStatus = 429;
        eventRetry = header;
        coordinator = coordinator(false, false, true);
        advance(15);
        var retry = runs.retryAfterAt(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElseThrow();
        assertEquals(
                header.equals("invalid")
                        ? start.plusSeconds(900 + 7200)
                        : Instant.parse("2026-10-07T00:00:00Z"),
                retry);
        coordinator = coordinator(true, true, true);
        advance(60);
        assertEquals(0, fixture.requests.get());
        assertEquals(1, eventRequests.get());
    }

    @Test
    void completedDepartureSettlesOnlyAfterPersonIsAbsentFromStructuredAssignments()
            throws Exception {
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Departure",
                        "<p>NASA astronauts Jessica Meir have departed the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        advance(55);
        assertEquals("OPEN", refresh.followUps().getFirst().state());
        var changed = (ObjectNode) json.readTree(fixture.body);
        var crew = (ArrayNode) changed.withArray("results").get(0).get("crew");
        for (int i = crew.size() - 1; i >= 0; i--)
            if (crew.get(i).get("astronaut").get("name").asText().equals("Jessica Meir"))
                crew.remove(i);
        fixture.body = changed.toString();
        advance(60);
        coordinator.tick();
        assertEquals("SETTLED", refresh.followUps().getFirst().state());
    }

    @Test
    void failedActualAttemptsConsumeFollowUpBudgetWithoutRetryStorm() {
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Unresolved have entered the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        fixture.status = 503;
        for (int i = 0; i < 6; i++) {
            advance(i == 0 ? 55 : 60);
            coordinator.tick();
            coordinator.tick();
        }
        assertEquals(6, refresh.followUps().getFirst().attempts());
        assertEquals("ATTEMPTS_EXHAUSTED", refresh.followUps().getFirst().state());
        assertEquals(
                6,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_refresh_trigger t JOIN crew_source_sync_run r ON"
                                + " r.id=t.source_sync_run_id WHERE t.follow_up_id IS NOT NULL AND"
                                + " r.result_state='SOURCE_RESULT'",
                        Integer.class));
    }

    @Test
    void nasaRateLimitCannotBeOverriddenByCrewedWindow() throws Exception {
        event(start.plusSeconds(3600), true);
        catalog();
        nasaStatus = 429;
        advance(5);
        advance(5);
        assertEquals(1, nasaRequests.get());
        coordinator = coordinator(true, true, true);
        advance(60);
        coordinator.tick();
        assertEquals(1, nasaRequests.get());
        assertTrue(
                runs.retryAfterAt(CrewSource.NASA_OFFICIAL, Station.ISS)
                        .orElseThrow()
                        .isAfter(fixture.clock.time));
    }

    @Test
    void restartDuringAnticipationPreservesMinimumInterval() throws Exception {
        event(start.plusSeconds(3600), true);
        catalog();
        advance(5);
        advance(5);
        assertEquals(1, nasaRequests.get());
        coordinator = coordinator(true, true, true);
        advance(10);
        assertEquals(1, nasaRequests.get());
        advance(20);
        assertEquals(2, nasaRequests.get());
    }

    @Test
    void completedTransferPersistsPendingTriggerDuringLl2CooldownAndCoalescesAcrossRestart() {
        fixture.status = 429;
        advance(5);
        nasaBody =
                feed(
                        "TEST_ONLY Arrival",
                        "<p>NASA astronauts Test Unresolved have entered the International Space"
                                + " Station.</p>",
                        fixture.clock.time);
        advance(5);
        coordinator.tick();
        assertEquals(1, fixture.requests.get());
        long trigger =
                jdbc.queryForObject(
                        "SELECT id FROM crew_refresh_trigger WHERE follow_up_id IS NOT NULL",
                        Long.class);
        assertNull(
                jdbc.queryForObject(
                        "SELECT source_sync_run_id FROM crew_refresh_trigger WHERE id=?",
                        Long.class,
                        trigger));
        assertEquals(
                start.plusSeconds(5 * 60 + 10800),
                jdbc.queryForObject(
                                "SELECT eligible_at FROM crew_refresh_trigger WHERE id=?",
                                java.time.OffsetDateTime.class,
                                trigger)
                        .toInstant());
        coordinator = coordinator(true, true, true);
        advance(60);
        coordinator.tick();
        assertEquals(1, fixture.requests.get());
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_refresh_trigger WHERE follow_up_id IS NOT NULL",
                        Integer.class));
        fixture.status = 200;
        advance(120);
        coordinator.tick();
        assertNotNull(
                jdbc.queryForObject(
                        "SELECT source_sync_run_id FROM crew_refresh_trigger WHERE id=?",
                        Long.class,
                        trigger));
        assertEquals(2, fixture.requests.get());
    }

    @ParameterizedTest
    @ValueSource(strings = {"LL2", "NASA"})
    void baselineAndAcceleratedCallerShareTheSameSourceOverlapGuard(String target)
            throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        CrewRefreshPolicy.Decision decision;
        java.util.concurrent.Callable<CrewSyncRun.Outcome> baseline;
        java.util.function.LongFunction<CrewSyncRun.Outcome> accelerated;
        if (target.equals("LL2")) {
            nasaBody =
                    feed(
                            "TEST_ONLY Arrival",
                            "<p>NASA astronauts Test Unresolved have entered the International"
                                + " Space Station.</p>",
                            start.minusSeconds(60));
            nasa.ingest();
            reconciliation.reconcile();
            coordinator.tick();
            var f = refresh.followUps().getFirst();
            decision =
                    new CrewRefreshPolicy.Decision(
                            CrewRefreshPolicy.Target.LL2_ROSTER,
                            CrewRefreshPolicy.Reason.NASA_COMPLETED_ARRIVAL,
                            Duration.ofHours(1),
                            null,
                            f.evidenceId(),
                            f.id(),
                            start);
            StructuredCrewSource blocked =
                    station -> {
                        calls.incrementAndGet();
                        entered.countDown();
                        try {
                            release.await(5, TimeUnit.SECONDS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(e);
                        }
                        return fixture.source.fetchCurrentExpedition(station);
                    };
            var shared =
                    new CrewIngestionService(
                            blocked,
                            runs,
                            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
                            fixture.clock,
                            fixture.source.currentExpeditionUrl());
            baseline = () -> shared.ingestScheduled().outcome();
            accelerated = id -> shared.ingestWhenDue(Duration.ofHours(1), id).outcome();
        } else {
            event(start.plusSeconds(3600), true);
            catalog();
            var c = refresh.latestCatalog().orElseThrow();
            decision =
                    new CrewRefreshPolicy(CrewRefreshPolicy.Settings.defaults())
                            .nasa(start, null, start, null, c.retrievedAt(), c.candidates());
            CrewVerificationHttpSource blocked =
                    (url, etag, modified) -> {
                        calls.incrementAndGet();
                        entered.countDown();
                        try {
                            release.await(5, TimeUnit.SECONDS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(e);
                        }
                        return new CrewVerificationHttpSource.Fetch(
                                nasaBody,
                                null,
                                200,
                                "application/rss+xml",
                                "TEST_ETAG",
                                "Sat, 03 Oct 2026 00:00:00 GMT",
                                fixture.clock.time);
                    };
            var shared =
                    new NasaCrewVerificationIngestionService(
                            blocked,
                            new NasaOperationalFeedParser(),
                            verification,
                            runs,
                            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
                            fixture.clock,
                            NasaOperationalFeedHttpSource.URL,
                            NasaOperationalFeedParser.NAME,
                            NasaOperationalFeedParser.VERSION);
            baseline = () -> shared.ingestScheduled().outcome();
            accelerated = id -> shared.ingestWhenDue(Duration.ofMinutes(30), id).outcome();
        }
        long trigger = refresh.trigger("TEST_ONLY_OVERLAP:" + target, decision, start);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var active = executor.submit(baseline);
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                assertEquals(CrewSyncRun.Outcome.SKIPPED_OVERLAP, accelerated.apply(trigger));
            } finally {
                release.countDown();
            }
            assertEquals(CrewSyncRun.Outcome.SUCCESS, active.get(5, TimeUnit.SECONDS));
            assertEquals(1, calls.get());
            assertEquals(
                    "SKIPPED_OVERLAP",
                    jdbc.queryForObject(
                            "SELECT r.result_state FROM crew_refresh_trigger t JOIN"
                                + " crew_source_sync_run r ON r.id=t.source_sync_run_id WHERE"
                                + " t.id=?",
                            String.class,
                            trigger));
        }
    }

    @Test
    void emptyDatabaseMigratesToV5() {
        assertEquals(5, count("flyway_schema_history"));
        assertEquals(
                "5",
                jdbc.queryForObject(
                        "SELECT version FROM flyway_schema_history WHERE success ORDER BY"
                                + " installed_rank DESC LIMIT 1",
                        String.class));
    }
}
