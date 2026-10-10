package org.mission1.api.crew;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;

import org.junit.jupiter.api.*;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
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

import javax.sql.DataSource;

/** Full PostgreSQL→query→mapper→controller→JSON chain. Recorded fixtures are offline test-only. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Import(CrewPostgresApiTest.SqlInstrumentation.class)
class CrewPostgresApiTest {
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
    @Autowired CrewRepository runs;
    @Autowired CrewVerificationRepository verification;
    @Autowired CrewReconciliationService reconciliation;
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
        jdbc.execute("TRUNCATE " + String.join(",", TABLES) + " RESTART IDENTITY CASCADE");
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
        org.mission1.crew.LegacyCrewIdentityFixture.retainV1(
                jdbc, verification, fixture.clock.time);
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
        for (var t : TABLES)
            result.put(t, jdbc.queryForObject("SELECT count(*) FROM " + t, Long.class));
        return result;
    }

    @Test
    void realPostgresPartialMatchSerializesActualPersistedFixtures() throws Exception {
        populated();
        var r = read("/api/iss/crew");
        assertEquals("PARTIAL_MATCH", r.at("/reconciliation/status").asText());
        assertEquals(11, r.at("/counts/officialAboard").asInt());
        assertEquals(8, r.at("/counts/resolvedAboard").asInt());
        assertEquals(3, r.at("/counts/unresolvedSubjects").asInt());
        assertEquals(7, r.at("/counts/structuredAssignments").asInt());
        assertEquals(9, r.get("members").size());
        assertEquals(3, r.get("unresolvedSubjects").size());
        assertEquals(personId().toString(), read("/api/iss/crew/" + personId()).get("id").asText());
        assertEquals(7, read("/api/iss/expedition/current").get("assignmentCount").asInt());
        assertEquals(
                "10",
                jdbc.queryForObject(
                        "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC"
                            + " LIMIT 1",
                        String.class));
    }

    @Test
    void allGetsHaveZeroNetworkAndWritesAndReadOnlyRepeatableReadConnections() throws Exception {
        populated();
        int ll2Calls = fixture.requests.get();
        clearInvocations(nasaSource, configuredLl2, configuredNasa);
        var before = counts();
        var id = personId();
        SqlInstrumentation.enabled = true;
        SqlInstrumentation.sql.clear();
        SqlInstrumentation.readOnly.clear();
        SqlInstrumentation.isolation.clear();
        var queryCounts = new LinkedHashMap<String, Integer>();
        for (var path :
                List.of("/api/iss/crew", "/api/iss/expedition/current", "/api/iss/crew/" + id)) {
            int previous = SqlInstrumentation.sql.size();
            read(path);
            queryCounts.put(path, SqlInstrumentation.sql.size() - previous);
        }
        System.out.println("CREW_REST_QUERY_COUNTS=" + json.writeValueAsString(queryCounts));
        SqlInstrumentation.enabled = false;
        assertEquals(before, counts());
        assertEquals(ll2Calls, fixture.requests.get());
        verifyNoInteractions(nasaSource, configuredLl2, configuredNasa);
        assertFalse(SqlInstrumentation.sql.isEmpty());
        assertTrue(
                SqlInstrumentation.sql.stream()
                        .allMatch(s -> s.stripLeading().toUpperCase().startsWith("SELECT")),
                SqlInstrumentation.sql.toString());
        assertTrue(SqlInstrumentation.readOnly.stream().allMatch(Boolean::booleanValue));
        assertTrue(
                SqlInstrumentation.isolation.stream()
                        .allMatch(x -> x == Connection.TRANSACTION_REPEATABLE_READ));
    }

    @Test
    void sourceFailureKeepsLastValidStateWithIndependentHealth() throws Exception {
        populated();
        fixture.clock.time = at.plusSeconds(1);
        fixture.status = 500;
        ll2();
        var r = read("/api/iss/crew");
        assertEquals("PRIMARY_UNAVAILABLE", r.at("/reconciliation/status").asText());
        assertTrue(r.at("/freshness/structuredSource/lastRefreshFailed").asBoolean());
        assertEquals(7, read("/api/iss/expedition/current").get("assignmentCount").asInt());
        fixture.clock.time = at.plusSeconds(2);
        when(nasaSource.fetch(any(), any(), any()))
                .thenReturn(
                        new CrewVerificationHttpSource.Fetch(
                                new byte[0],
                                new CrewSourceResult.Failure(
                                        CrewSourceResult.FailureCode.HTTP_ERROR, 500, null),
                                500,
                                null,
                                null,
                                null,
                                fixture.clock.time));
        nasa();
        r = read("/api/iss/crew");
        assertEquals("VERIFICATION_UNAVAILABLE", r.at("/reconciliation/status").asText());
        assertTrue(r.at("/freshness/verification/lastRefreshFailed").asBoolean());
        assertEquals(9, r.get("members").size());
        assertTrue(r.at("/counts/officialAboard").isNull());
        assertEquals(11, r.at("/counts/lastKnownOfficialAboard").asInt());
    }

    @Test
    void freshnessReevaluatesWithoutReconciliationWrites() throws Exception {
        populated();
        var before = counts();
        fixture.clock.time = at.plusSeconds(7 * 3600);
        var r = read("/api/iss/crew");
        assertEquals("STALE", r.at("/reconciliation/status").asText());
        assertTrue(r.at("/freshness/stale").asBoolean());
        assertTrue(r.at("/counts/officialAboard").isNull());
        assertEquals(before, counts());
    }

    @Test
    void verificationUnavailableDoesNotPromoteAssignedPeople() throws Exception {
        ll2();
        var r = read("/api/iss/crew");
        assertEquals("VERIFICATION_UNAVAILABLE", r.at("/reconciliation/status").asText());
        assertTrue(r.at("/counts/officialAboard").isNull());
        for (var p : r.get("members")) assertEquals("UNVERIFIED", p.at("/presence/state").asText());
    }

    @Test
    void nasaOnlyStateIsUsableWithoutPrimaryAndProfile() throws Exception {
        nasa();
        org.mission1.crew.LegacyCrewIdentityFixture.retainV1(
                jdbc, verification, fixture.clock.time);
        reconciliation.reconcile();
        var r = read("/api/iss/crew");
        assertEquals("PRIMARY_UNAVAILABLE", r.at("/reconciliation/status").asText());
        assertTrue(r.get("expedition").isNull());
        assertTrue(r.at("/counts/structuredAssignments").isNull());
        assertFalse(r.get("members").isEmpty());
        for (var member : r.get("members")) assertTrue(member.get("assignment").isNull());
        var p = read("/api/iss/crew/" + r.at("/members/0/id").asText());
        assertEquals("UNAVAILABLE", p.get("profileAvailability").asText());
        assertFalse(p.get("name").isNull());
        assertTrue(p.get("currentAssignment").isNull());
    }

    @Test
    void emptyDatabaseProduces503AndUnknownPerson404() throws Exception {
        mvc.perform(get("/api/iss/crew"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:crew-state-unavailable"));
        mvc.perform(get("/api/iss/expedition/current")).andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/iss/crew/" + UUID.randomUUID())).andExpect(status().isNotFound());
    }

    @Test
    void noActiveOutcomeSurvivesLaterTransportFailureWithoutOldRoster() throws Exception {
        ll2();
        fixture.clock.time = at.plusSeconds(1);
        fixture.body = "{\"count\":0,\"next\":null,\"previous\":null,\"results\":[]}";
        ll2();
        var r = read("/api/iss/expedition/current");
        assertEquals("NO_ACTIVE_EXPEDITION", r.get("sourceState").asText());
        assertTrue(r.get("expedition").isNull());
        assertEquals(0, r.get("assignments").size());
        fixture.clock.time = at.plusSeconds(2);
        fixture.status = 500;
        ll2();
        r = read("/api/iss/expedition/current");
        assertEquals("NO_ACTIVE_EXPEDITION", r.get("sourceState").asText());
        assertTrue(r.at("/freshness/lastRefreshFailed").asBoolean());
    }

    @Test
    void personRemainsKnownAfterRosterRemovesThem() throws Exception {
        ll2();
        UUID id = personId();
        var tree = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture.body);
        var crew = (com.fasterxml.jackson.databind.node.ArrayNode) tree.at("/results/0/crew");
        for (int i = 0; i < crew.size(); i++)
            if (crew.get(i).at("/astronaut/id").asInt() == 573) {
                crew.remove(i);
                break;
            }
        fixture.body = tree.toString();
        fixture.clock.time = at.plusSeconds(1);
        ll2();
        var p = read("/api/iss/crew/" + id);
        assertEquals("Jessica Meir", p.get("name").asText());
        assertTrue(p.get("currentAssignment").isNull());
        assertEquals("AVAILABLE", p.get("profileAvailability").asText());
    }

    @Test
    void personProfileFollowsLatestSuccessfulFetchIncludingSnapshotReuse() throws Exception {
        String original = fixture.body;
        ll2();
        UUID id = personId();
        String biography = read("/api/iss/crew/" + id).get("biography").asText();
        var tree = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture.body);
        for (var assignment : tree.at("/results/0/crew")) {
            var person =
                    (com.fasterxml.jackson.databind.node.ObjectNode) assignment.get("astronaut");
            if (person.get("id").asInt() == 573) person.put("bio", "TEST_ONLY newer profile");
        }
        fixture.body = tree.toString();
        fixture.clock.time = at.plusSeconds(1);
        ll2();
        assertEquals(
                "TEST_ONLY newer profile", read("/api/iss/crew/" + id).get("biography").asText());
        fixture.body = original;
        fixture.clock.time = at.plusSeconds(2);
        ll2();
        var p = read("/api/iss/crew/" + id);
        assertEquals(biography, p.get("biography").asText());
        assertEquals(fixture.clock.time.toString(), p.get("profileLastSuccessfulFetchAt").asText());
        assertEquals(at.toString(), p.at("/profileProvenance/observedAt").asText());
    }

    @Test
    void crewSqlCountDoesNotGrowWithRosterSize() throws Exception {
        ll2();
        int original = sqlCount("/api/iss/crew");
        var tree = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture.body);
        var crew = (com.fasterxml.jackson.databind.node.ArrayNode) tree.at("/results/0/crew");
        for (int i = 0; i < 30; i++) {
            var extra = (com.fasterxml.jackson.databind.node.ObjectNode) crew.get(0).deepCopy();
            extra.put("id", 90000 + i);
            var person = (com.fasterxml.jackson.databind.node.ObjectNode) extra.get("astronaut");
            person.put("id", 90000 + i);
            person.put("name", "TEST_ONLY additional " + i);
            crew.add(extra);
        }
        fixture.body = tree.toString();
        fixture.clock.time = at.plusSeconds(1);
        ll2();
        assertEquals(37, read("/api/iss/crew").get("members").size());
        int larger = sqlCount("/api/iss/crew");
        assertEquals(original, larger);
        System.out.println(
                "CREW_REST_ROSTER_SQL="
                        + original
                        + " queries for 7 and "
                        + larger
                        + " for 37 members");
    }

    int sqlCount(String path) throws Exception {
        SqlInstrumentation.sql.clear();
        SqlInstrumentation.enabled = true;
        try {
            read(path);
            return SqlInstrumentation.sql.size();
        } finally {
            SqlInstrumentation.enabled = false;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class SqlInstrumentation {
        static boolean enabled;
        static final List<String> sql = new ArrayList<>();
        static final List<Boolean> readOnly = new ArrayList<>();
        static final List<Integer> isolation = new ArrayList<>();

        @Bean
        static BeanPostProcessor countSql() {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessAfterInitialization(Object bean, String name) {
                    if (!(bean instanceof DataSource source)) return bean;
                    return Proxy.newProxyInstance(
                            DataSource.class.getClassLoader(),
                            new Class<?>[] {DataSource.class},
                            (proxy, method, args) -> {
                                Object result = invoke(method, source, args);
                                if (result instanceof Connection connection
                                        && method.getName().equals("getConnection"))
                                    return Proxy.newProxyInstance(
                                            Connection.class.getClassLoader(),
                                            new Class<?>[] {Connection.class},
                                            (p, m, a) -> {
                                                if (enabled
                                                        && m.getName().equals("prepareStatement")) {
                                                    sql.add((String) a[0]);
                                                    readOnly.add(connection.isReadOnly());
                                                    isolation.add(
                                                            connection.getTransactionIsolation());
                                                }
                                                Object called = invoke(m, connection, a);
                                                if (called instanceof java.sql.Statement statement && m.getName().equals("createStatement"))
                                                    return Proxy.newProxyInstance(java.sql.Statement.class.getClassLoader(), new Class<?>[]{java.sql.Statement.class},
                                                            (sp, sm, sa) -> {
                                                                if (enabled && sm.getName().startsWith("execute") && sa != null && sa.length > 0 && sa[0] instanceof String query) {
                                                                    sql.add(query); readOnly.add(connection.isReadOnly()); isolation.add(connection.getTransactionIsolation());
                                                                }
                                                                return invoke(sm, statement, sa);
                                                            });
                                                return called;
                                            });
                                return result;
                            });
                }
            };
        }

        static Object invoke(Method m, Object target, Object[] args) throws Throwable {
            try {
                return m.invoke(target, args);
            } catch (InvocationTargetException e) {
                throw e.getCause();
            }
        }
    }
@Test
    void reviewedCanonicalIdentityJoinsRetainedProfilesAndKeepsBothUuidUrls() throws Exception {
        populated();
        var tree = json.readTree(fixture.body);
        CanonicalCrewFixture.reviewedAssignments(tree);
        fixture.body = tree.toString();
        fixture.clock.time = Instant.parse("2026-10-10T12:00:00Z");
        ll2();
        var crew = read("/api/iss/crew");
        assertEquals(9, crew.get("members").size());
        for (var provider : List.of("710", "582")) {
            var alias =
                    jdbc.queryForObject(
                            "SELECT person_id FROM crew_person_external_id WHERE"
                                + " source='LAUNCH_LIBRARY_2' AND external_id=?",
                            UUID.class,
                            provider);
            var root =
                    jdbc.queryForObject(
                            "SELECT representative_id FROM crew_active_equivalence WHERE"
                                + " alias_id=?",
                            UUID.class,
                            alias);
            var canonical = read("/api/iss/crew/" + root);
            var compatible = read("/api/iss/crew/" + alias);
            assertEquals(root.toString(), compatible.get("id").asText());
            assertEquals(alias.toString(), compatible.at("/canonicalProfile/requestedId").asText());
            assertEquals("AVAILABLE", compatible.get("profileAvailability").asText());
            assertNotNull(compatible.get("biography"));
            assertFalse(compatible.get("currentAssignment").isNull());
            ((com.fasterxml.jackson.databind.node.ObjectNode) canonical.get("canonicalProfile"))
                    .remove("requestedId");
            ((com.fasterxml.jackson.databind.node.ObjectNode) compatible.get("canonicalProfile"))
                    .remove("requestedId");
            assertEquals(canonical, compatible);
            assertEquals(
                    1,
                    crew.get("members").findValues("id").stream()
                            .filter(n -> n.asText().equals(root.toString()))
                            .count());
        }
var before = counts();
        SqlInstrumentation.sql.clear();
        SqlInstrumentation.enabled = true;
        try {
            read("/api/iss/crew");
            read("/api/iss/expedition/current");
            assertTrue(
                    SqlInstrumentation.sql.stream()
                            .noneMatch(x -> x.matches("(?is).*\\b(INSERT|UPDATE|DELETE)\\b.*")));
        } finally {
            SqlInstrumentation.enabled = false;
        }
        assertEquals(before, counts());
    }
}
