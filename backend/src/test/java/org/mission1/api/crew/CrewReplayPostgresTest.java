package org.mission1.api.crew;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;

import org.junit.jupiter.api.*;
import org.mission1.api.crew.CrewPostgresApiTest.SqlInstrumentation;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.lang.reflect.*;
import java.sql.Connection;
import java.time.*;
import java.util.*;

/** Full PostgreSQL→query→mapper→controller→JSON chain. Recorded fixtures are offline test-only. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Import(CrewPostgresApiTest.SqlInstrumentation.class)
class CrewReplayPostgresTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.10")
                    .withDatabaseName("crew_api_test")
                    .withUsername("mission1_test")
                    .withPassword("test_only");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired org.mission1.orbital.oem.NasaOemRepository oem;
    @Autowired CrewRepository runs;
    @Autowired org.mission1.orbital.application.OrbitalElementSetRepository orbital;
    @Autowired org.mission1.orbital.propagation.TleElementParser tle;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired org.mission1.replay.CrewReplayQueryService crewReplay;
    @Autowired org.mission1.replay.OrbitHistoricalQueryService orbitReplay;
    @Autowired org.mission1.replay.MissionReplayQueryService missionReplay;
    @Autowired CrewVerificationRepository verification;
    @Autowired CrewReconciliationService reconciliation;

    @MockitoSpyBean
    org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource configuredGp;

    @MockitoSpyBean org.mission1.source.orbital.nasa.NasaOemSource configuredOem;
    @MockitoBean Clock clock;
    @MockitoSpyBean LaunchLibrary2CrewSource configuredLl2;
    @MockitoBean NasaCrewVerificationIngestionService configuredNasa;
    FixtureCrewSource fixture;
    CrewVerificationHttpSource nasaSource;
    byte[] body;
    Instant at = Instant.parse("2026-10-03T12:00:00Z");
    static final List<String> TABLES =
            List.of(
                    "crew_source_sync_run",
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
                    "crew_reconciliation_run",
                    "crew_reconciliation_snapshot",
                    "crew_reconciliation_evidence",
                    "crew_reconciliation_resolution",
                    "crew_reconciled_person",
                    "crew_reconciled_person_evidence");

    @BeforeEach
    void setup() throws Exception {
        SqlInstrumentation.enabled = false;
        jdbc.execute(
                "TRUNCATE orbital_element_sets,nasa_oem_ephemerides,"
                        + String.join(",", TABLES)
                        + " RESTART IDENTITY CASCADE");
        fixture = new FixtureCrewSource();
        fixture.clock.time = at;
        when(clock.instant()).thenAnswer(inv -> fixture.clock.time);
        try (var input =
                new java.util.zip.GZIPInputStream(
                        getClass()
                                .getResourceAsStream(
                                        "/fixtures/crew/nasa/verification/operational-feed.xml.gz"))) {
            body = input.readAllBytes();
        }
        nasaSource = mock(CrewVerificationHttpSource.class);
        when(nasaSource.fetch(any(), any(), any()))
                .thenAnswer(
                        inv ->
                                new CrewVerificationHttpSource.Fetch(
                                        body,
                                        null,
                                        200,
                                        "application/rss+xml",
                                        "TEST_ETAG",
                                        null,
                                        fixture.clock.time));
    }

    @AfterEach
    void close() {
        SqlInstrumentation.enabled = false;
        fixture.close();
    }

    void ll2() {
        new CrewIngestionService(
                        fixture.source,
                        runs,
                        new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
                        fixture.clock,
                        fixture.source.currentExpeditionUrl())
                .ingest();
    }

    void nasa() {
        new NasaCrewVerificationIngestionService(
                        nasaSource,
                        new NasaOperationalFeedParser(),
                        verification,
                        runs,
                        new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
                        fixture.clock,
                        NasaOperationalFeedHttpSource.URL,
                        NasaOperationalFeedParser.NAME,
                        NasaOperationalFeedParser.VERSION)
                .ingest();
    }

    void populated() {
        ll2();
        nasa();
        reconciliation.reconcile();
    }

    UUID personId() {
        return jdbc.queryForObject(
                "SELECT person_id FROM crew_person_external_id WHERE source='LAUNCH_LIBRARY_2' AND"
                        + " external_id='573'",
                UUID.class);
    }

    JsonNode read(String path) throws Exception {
        var r =
                mvc.perform(get(path))
                        .andExpect(status().isOk())
                        .andExpect(content().contentTypeCompatibleWith("application/json"))
                        .andReturn();
        return json.readTree(
                r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    Map<String, Long> counts() {
        var result = new TreeMap<String, Long>();
        for (var t :
                jdbc.queryForList(
                        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY"
                                + " tablename",
                        String.class))
            result.put(t, jdbc.queryForObject("SELECT count(*) FROM " + t, Long.class));
        return result;
    }

    JsonNode replay(Instant t) throws Exception {
        return read("/api/iss/replay?at=" + t);
    }

    void metadataRevision() throws Exception {
        populated();
        body = getClass().getResourceAsStream("/fixtures/crew/nasa/occurrences/new.xml").readAllBytes();
        fixture.clock.time = Instant.parse("2026-10-06T21:27:06.770331Z");
        nasa();
        reconciliation.reconcile();
    }

    @Test
    void currentAndReplaySelectOneUnresolvedFedyaevWithoutChangingCanonicalHumanIdentity() throws Exception {
        metadataRevision();
        var current = read("/api/iss/crew");
        var historical = replay(Instant.parse("2026-10-02T02:01:55Z"));
        for (var state : List.of(current, historical.at("/crew/state"))) {
            int fed = 0;
            for (var subject : state.path("unresolvedSubjects"))
                if (subject.path("displayName").asText().equals("Andrey Fedyaev")) {
                    fed++;
                    assertEquals("UNRESOLVED", subject.path("resolution").asText());
                }
            assertEquals(1, fed, state.toString());
            assertEquals(state.path("unresolvedSubjects").size(), state.at("/counts/unresolvedSubjects").asInt());
        }
        assertEquals(5, jdbc.queryForObject("SELECT count(*) FROM crew_verification_evidence", Integer.class));
        assertEquals(18, jdbc.queryForObject("SELECT count(*) FROM crew_evidence_subject", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(DISTINCT occurrence_key) FROM crew_assertion_version v JOIN crew_verification_evidence e ON e.id=v.evidence_id WHERE e.evidence_type='PERSON_CURRENTLY_ABOARD'", Integer.class));
        assertEquals("EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION", historical.path("semantics").asText());
        assertEquals(Instant.parse("2026-10-02T02:01:55Z").toString(), historical.at("/crew/effectiveAt").asText());
        var canonical = jdbc.queryForObject("SELECT person_id FROM crew_person_external_id WHERE source='LAUNCH_LIBRARY_2' AND external_id='732'", UUID.class);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM crew_identity_resolution r JOIN crew_evidence_subject s USING(evidence_id,subject_index) WHERE s.display_name='Andrey Fedyaev' AND r.person_id IS NOT NULL", Integer.class));
        boolean canonicalFound = false;
        for (var member : current.path("members")) if (member.path("id").asText().equals(canonical.toString())) {
            canonicalFound = true;
            assertNotEquals("CONFIRMED_ABOARD", member.at("/presence/state").asText());
        }
        assertTrue(canonicalFound, "LL2 person remains independently represented");
    }

    @Test
    void selectedCurrentAndReplayGetHaveZeroWritesAndZeroProviderCalls() throws Exception {
        metadataRevision();
        var before = counts();
        int ll2Calls = fixture.requests.get();
        clearInvocations(nasaSource, configuredLl2, configuredNasa, configuredGp, configuredOem);
        SqlInstrumentation.sql.clear();
        SqlInstrumentation.enabled = true;
        try {
            read("/api/iss/crew"); read("/api/iss/crew");
            replay(Instant.parse("2026-10-02T02:01:55Z"));
            replay(Instant.parse("2026-10-02T02:01:55Z"));
            read("/api/iss/replay/coverage");
        } finally { SqlInstrumentation.enabled = false; }
        assertEquals(before, counts()); assertEquals(ll2Calls, fixture.requests.get());
        verifyNoInteractions(nasaSource, configuredLl2, configuredNasa, configuredGp, configuredOem);
        assertTrue(SqlInstrumentation.sql.stream().allMatch(q -> q.stripLeading().toUpperCase().startsWith("SELECT")), SqlInstrumentation.sql.toString());
    }

    @Test
    void selectedMetadataDoesNotExtendAssertionFreshnessOrEraseCountHistory() throws Exception {
        metadataRevision(); var current = read("/api/iss/crew");
        assertTrue(current.at("/counts/officialAboard").isNull());
        assertEquals(11, current.at("/counts/lastKnownOfficialAboard").asInt());
        var old = replay(Instant.parse("2026-10-02T18:14:13Z"));
        assertEquals(11, old.at("/crew/state/counts/officialAboard").asInt());
        assertEquals("UNAVAILABLE", replay(Instant.parse("2026-01-01T00:00:00Z")).at("/crew/availability").asText());
    }

    @Test
    void lateEvidenceUsesPublicationFallbackBeforeCaptureWithoutBackfillingAssignments()
            throws Exception {
        populated();
        var historical = replay(Instant.parse("2026-10-02T03:00:00Z"));
        assertEquals(
                "EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION",
                historical.path("semantics").asText());
        assertEquals(8, historical.at("/crew/state/counts/resolvedAboard").asInt());
        assertTrue(historical.at("/crew/state/expedition").isNull());
        assertTrue(historical.at("/crew/state/counts/structuredAssignments").isNull());
        assertTrue(historical.at("/crew/state/counts/officialAboard").isNull());
        assertEquals(3, historical.at("/crew/state/unresolvedSubjects").size());
        assertEquals("UNAVAILABLE", historical.at("/orbit/availability").asText());
    }

    @Test
    void effectiveOrderingDoesNotDependOnQueryOrder() throws Exception {
        populated();
        var old = Instant.parse("2026-10-02T03:00:00Z");
        var recent = at;
        var a = replay(old);
        var b = replay(recent);
        assertEquals(a, replay(old));
        assertEquals(b, replay(recent));
        assertEquals(11, b.at("/crew/state/counts/officialAboard").asInt());
        assertEquals(7, b.at("/crew/state/counts/structuredAssignments").asInt());
        assertEquals(
                "LATEST_AVAILABLE_CANONICAL_METADATA; OPERATIONAL_FIELDS_AT_REQUESTED_TIME",
                b.at("/crew/profilePolicy").asText());
    }

    @Test
    void unsupportedAndEmptyHistoryAreNormalIndependentUnavailableStates() throws Exception {
        assertEquals("UNAVAILABLE", replay(at).at("/crew/availability").asText());
        populated();
        var old = replay(Instant.parse("2026-01-01T00:00:00Z"));
        assertTrue(old.at("/crew/state").isNull());
        assertTrue(old.at("/orbit/primary").isNull());
        var coverage = read("/api/iss/replay/coverage");
        assertEquals("2026-10-02T02:01:55Z", coverage.at("/crew/start").asText());
        assertEquals("INSUFFICIENT", coverage.path("orbitGate").asText());
    }

    @Test
    void invalidFutureMissingTimesNeverProduce500() throws Exception {
        for (var value : List.of("bad", "2027-01-01T00:00:00Z", "1800-01-01T00:00:00Z"))
            mvc.perform(get("/api/iss/replay").param("at", value))
                    .andExpect(status().isBadRequest());
        mvc.perform(get("/api/iss/replay")).andExpect(status().isBadRequest());
    }

    @Test
    void repeatedQueriesHaveNoSourceCallsNoWritesAndCoherentReadTransaction() throws Exception {
        populated();
        var before = counts();
        int ll2Calls = fixture.requests.get();
        clearInvocations(nasaSource, configuredLl2, configuredNasa, configuredGp, configuredOem);
        SqlInstrumentation.sql.clear();
        SqlInstrumentation.readOnly.clear();
        SqlInstrumentation.isolation.clear();
        SqlInstrumentation.enabled = true;
        replay(at);
        replay(Instant.parse("2026-10-02T03:00:00Z"));
        read("/api/iss/replay/coverage");
        SqlInstrumentation.enabled = false;
        assertEquals(before, counts());
        assertEquals(ll2Calls, fixture.requests.get());
        verifyNoInteractions(
                nasaSource, configuredLl2, configuredNasa, configuredGp, configuredOem);
        assertTrue(
                SqlInstrumentation.sql.stream()
                        .allMatch(q -> q.stripLeading().toUpperCase().startsWith("SELECT")),
                SqlInstrumentation.sql.toString());
        assertTrue(SqlInstrumentation.readOnly.stream().allMatch(Boolean::booleanValue));
        assertTrue(
                SqlInstrumentation.isolation.stream()
                        .allMatch(i -> i == Connection.TRANSACTION_REPEATABLE_READ));
    }

    @Test
    void profileEnrichmentNeverAddsCurrentMembersToEarlierHistoricalState() throws Exception {
        populated();
        var historical = replay(Instant.parse("2026-10-02T03:00:00Z"));
        assertEquals(
                historical.at("/crew/state/members").size(),
                historical.at("/crew/profiles").size());
        assertTrue(
                historical.at("/crew/profiles").findValues("currentAssignment").stream()
                        .allMatch(JsonNode::isNull));
    }

    void gp() throws Exception {
        var lines =
                new String(
                                getClass().getResourceAsStream("/replay/third.tle").readAllBytes(),
                                java.nio.charset.StandardCharsets.US_ASCII)
                        .lines()
                        .toList();
        orbital.storeIfNew(
                tle.parse(
                        lines.get(1),
                        lines.get(2),
                        at,
                        "CELESTRAK_GP",
                        "USSF_GP_VIA_CELESTRAK",
                        java.net.URI.create(
                                "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE")));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "true,true",
        "true,false",
        "false,true",
        "false,false"
    })
    void independentSubsystemAvailabilityMatrix(boolean crewAvailable, boolean orbitAvailable)
            throws Exception {
        if (crewAvailable) populated();
        if (orbitAvailable) gp();
        var r = replay(Instant.parse("2026-10-02T03:00:00Z"));
        assertEquals(crewAvailable, !r.at("/crew/state").isNull());
        assertEquals(orbitAvailable, !r.at("/orbit/primary").isNull());
    }

    @Test
    void postgresSourceHistorySelectionUsesEpochInsteadOfLateRetrievalTime() throws Exception {
        gp();
        var t = Instant.parse("2026-10-02T03:00:00Z");
        var r = replay(t);
        assertEquals(t.toString(), r.at("/orbit/primary/effectiveAt").asText());
        assertEquals("2026-10-01T19:41:07.107360Z", r.at("/orbit/primary/source/epoch").asText());
        assertEquals(at.toString(), r.at("/orbit/primary/source/retrievedAt").asText());
        var coverage = read("/api/iss/replay/coverage");
        assertFalse(coverage.at("/orbit/intervals").isEmpty());
    }

    @Test
    void componentQueryTimingAndQueryCountsUseRealPostgres() throws Exception {
        populated();
        gp();
        var t = Instant.parse("2026-10-02T03:00:00Z");
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactions);
        tx.setReadOnly(true);
        tx.setIsolationLevel(Connection.TRANSACTION_REPEATABLE_READ);
        var actions = new LinkedHashMap<String, Runnable>();
        actions.put("CrewReplay", () -> crewReplay.at(t, at));
        actions.put("OrbitHistoricalState", () -> orbitReplay.at(t, at));
        actions.put("MissionReplay", () -> missionReplay.at(t));
        for (var entry : actions.entrySet()) {
            for (int i = 0; i < 5; i++) tx.executeWithoutResult(x -> entry.getValue().run());
            var times = new ArrayList<Double>();
            SqlInstrumentation.sql.clear();
            SqlInstrumentation.enabled = true;
            for (int i = 0; i < 30; i++) {
                long start = System.nanoTime();
                tx.executeWithoutResult(x -> entry.getValue().run());
                times.add((System.nanoTime() - start) / 1e6);
            }
            SqlInstrumentation.enabled = false;
            Collections.sort(times);
            System.out.printf(
                    java.util.Locale.ROOT,
                    "REPLAY_PERFORMANCE %s n=30 medianMs=%.3f p95Ms=%.3f worstMs=%.3f"
                            + " queriesPerCall=%.1f%n",
                    entry.getKey(),
                    times.get(14),
                    times.get(28),
                    times.getLast(),
                    SqlInstrumentation.sql.size() / 30.0);
        }
    }

    @Test
    void structuredCoverageStartsAtCaptureAndLeavesUnsupportedGap() throws Exception {
        ll2();
        fixture.clock.time = at.plusSeconds(86400);
        assertEquals("UNAVAILABLE", replay(at.minusSeconds(1)).at("/crew/availability").asText());
        assertEquals(
                "UNAVAILABLE", replay(at.plusSeconds(21601)).at("/crew/availability").asText());
        assertEquals("PARTIAL", replay(at.plusSeconds(21600)).at("/crew/availability").asText());
    }

    @Test
    void latestProfilePolicyEnrichesHistoricalStateWithoutChangingHistoricalAssignments()
            throws Exception {
        populated();
        var tree = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture.body);
        for (var a : tree.at("/results/0/crew"))
            if (a.at("/astronaut/id").asInt() == 573)
                ((com.fasterxml.jackson.databind.node.ObjectNode) a.get("astronaut"))
                        .put("bio", "TEST_ONLY later metadata");
        fixture.body = tree.toString();
        fixture.clock.time = at.plusSeconds(3600);
        ll2();
        var r = replay(at);
        var p = r.at("/crew/profiles").findValues("biography");
        assertTrue(p.stream().anyMatch(x -> x.asText().equals("TEST_ONLY later metadata")));
        assertEquals(7, r.at("/crew/state/counts/structuredAssignments").asInt());
    }

    @Test
    void postgresOemCoverageUsesRetainedVectorsInsteadOfMetadataStopOrLatestFetch()
            throws Exception {
        var bytes =
                getClass()
                        .getResourceAsStream("/replay/nasa-oem-2026-09-28-excerpt.xml")
                        .readAllBytes();
        var doc = new org.mission1.source.orbital.nasa.NasaOemXmlParser().parse(bytes);
        oem.store(doc, bytes, at, null);
        var t = doc.vectors().getFirst().epoch();
        var r = replay(t);
        assertEquals("NASA_OEM", r.at("/orbit/primary/source/kind").asText());
        assertEquals("UNAVAILABLE", r.at("/crew/availability").asText());
        assertEquals(
                "UNAVAILABLE",
                replay(doc.vectors().getLast().epoch().plusSeconds(1))
                        .at("/orbit/availability")
                        .asText());
    }

    @Test
    void noActiveHistoricalOutcomeClearsOldAssignmentContextAndPreservesProvenance()
            throws Exception {
        ll2();
        fixture.clock.time = at.plusSeconds(1);
        fixture.body = "{\"count\":0,\"next\":null,\"previous\":null,\"results\":[]}";
        ll2();
        var r = replay(fixture.clock.time);
        assertTrue(r.at("/crew/state/expedition").isNull());
        assertEquals(0, r.at("/crew/state/counts/structuredAssignments").asInt());
        assertEquals(
                "NO_ACTIVE_EXPEDITION",
                r.at("/crew/state/freshness/structuredSource/sourceState").asText());
        assertFalse(r.at("/crew/state/provenance/structuredSource").isNull());
        assertEquals(7, replay(at).at("/crew/state/counts/structuredAssignments").asInt());
    }
}
