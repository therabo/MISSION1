package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;

import org.junit.jupiter.api.*;
import org.mission1.api.crew.CrewRestQueryService;
import org.mission1.crew.application.*;
import org.mission1.crew.persistence.JdbcActiveMembershipReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

import java.time.*;
import java.util.*;

/** Offline source-derived fixtures, real V1--V10 persistence and production HTTP composition. */
@org.springframework.context.annotation.Import(ResearchMembershipTestConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ProductionCurrentPostgresTest {
    @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired ActiveMembershipStore store;
    @Autowired ActiveMembershipPolicy policy;
    @Autowired ActiveMembershipReader reader;
    @Autowired ProductionCurrentMembership membership;
    @Autowired CrewRestQueryService api;
    @MockitoSpyBean CrewReadQueryService people;
    @Autowired CrewQueryService structured;
    @Autowired CrewReconciliationQueryService reconciled;
    @Autowired CrewReconciliationPolicy temporal;
    @Autowired Clock clock;
    @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc http;
    @Autowired CrewEditorialRepository editorial;
    @Autowired org.mission1.source.crew.nasa.NasaEditorialParser parser;
    @Autowired org.mission1.crew.research.IdentityResearchStore auto;
    @Autowired org.mission1.crew.research.IdentityResearchWorker worker;
    ActiveMembershipPostgresTest fixture;

    @BeforeEach
    void seed() {
        fixture = new ActiveMembershipPostgresTest();
        fixture.jdbc = jdbc;
        fixture.json = json;
        fixture.store = store;
        fixture.policy = policy;
        fixture.editorial = editorial;
        fixture.parser = parser;
        fixture.auto = auto;
        fixture.worker = worker;
        fixture.transactions = transactions;
        fixture.clean();
    }

    UUID id(String key) {
        return UUID.nameUUIDFromBytes(key.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    void active() throws Exception {
        fixture.ll2(fixture.current, fixture.t, "current");
        store.materialize(fixture.t.plusSeconds(1));
    }

    JsonNode current() throws Exception {
        return json.readTree(
                http.perform(get("/api/iss/crew"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    void unavailable(String reason) throws Exception {
        http.perform(get("/api/iss/crew"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(
                        jsonPath("$.type")
                                .value("urn:mission1:problem:crew-current-projection-unavailable"))
                .andExpect(jsonPath("$.reason").value(reason))
                .andExpect(jsonPath("$.members").doesNotExist());
    }

    @Test
    void defaultActiveReadUsesProfilesWithoutV9MatchOrNasaRosterAndKeepsCountsSeparate()
            throws Exception {
        active();
        var c = current();
        assertEquals(ProductionCurrentMembership.Mode.ACTIVE_PROJECTION, membership.mode());
        assertEquals(7, c.path("members").size());
        assertEquals(7, c.at("/membership/resolvedCurrentMembers").asInt());
        assertEquals(7, c.at("/counts/structuredAssignments").asInt());
        assertTrue(c.at("/counts/officialAboard").isMissingNode());
        assertEquals(0, c.at("/counts/resolvedAboard").asInt());
        assertFalse(c.has("unresolvedSubjects"));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_identity_research_decision_revision", Integer.class));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
        for (var m : c.path("members")) {
            assertTrue(m.path("assignment").isObject());
            var detail =
                    json.readTree(
                            http.perform(get("/api/iss/crew/" + m.path("id").asText()))
                                    .andExpect(status().isOk())
                                    .andReturn()
                                    .getResponse()
                                    .getContentAsString());
            assertEquals("AVAILABLE", detail.path("profileAvailability").asText());
            assertFalse(detail.path("biography").asText().isBlank());
        }
        http.perform(get("/api/iss/crew/" + id("732")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Andrei Fedyaev"));
        assertEquals(11, jdbc.queryForObject("SELECT count(*) FROM crew_person", Integer.class));
    }

    @Test
    void sourceAssignmentOrderIsPreservedBeforeCanonicalUuidFallback() throws Exception {
        active();
        assertEquals(
                api.expedition().assignments().stream().map(a -> a.personId()).toList(),
                api.crew().members().stream().map(m -> m.id()).toList());
    }

    @Test
    void futureEvaluationFailsClosed() throws Exception {
        Instant future = clock.instant().plusSeconds(60);
        fixture.ll2(fixture.current, future, "future");
        store.materialize(future.plusSeconds(1));
        unavailable("FUTURE");
    }

    @Test
    void ll2OmissionDoesNotRemoveQualifiedEditorialMembershipOrInventAnAssignment()
            throws Exception {
        fixture.ll2(
                fixture.current.stream().filter(k -> !k.equals("713")).toList(), fixture.t, "six");
        fixture.roster(fixture.t, true);
        fixture.evaluateIdentity();
        store.materialize(clock.instant());
        var c = current();
        assertEquals(7, c.path("members").size());
        assertEquals(6, c.at("/counts/structuredAssignments").asInt());
        var menon =
                api.crew().members().stream()
                        .filter(m -> m.id().equals(id("713")))
                        .findFirst()
                        .orElseThrow();
        assertNull(menon.assignment());
        assertEquals("UNKNOWN", menon.presence().state());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
    }

    @Test
    void missingProjectionFailsClosedDespiteSevenLegacyAssignments() throws Exception {
        fixture.ll2(fixture.current, fixture.t, "legacy");
        unavailable("MISSING");
    }

    @Test
    void unavailableCommittedRevisionFailsClosedAndDoesNotResurrectPreviousRevision()
            throws Exception {
        active();
        store.materialize(fixture.t.plus(Duration.ofHours(8)));
        unavailable("UNAVAILABLE");
    }

    @Test
    void oldDegradedRetainedProjectionIsServedWithEvaluationAgeAndIndependentSourceHealth()
            throws Exception {
        Instant old = fixture.t.minus(Duration.ofDays(1));
        fixture.ll2(fixture.current, old, "old");
        store.materialize(old.plusSeconds(1));
        var c = current();
        assertEquals("DEGRADED", c.at("/membership/health").asText());
        assertEquals(7, c.path("members").size());
        assertTrue(c.at("/membership/ageSeconds").asLong() >= 86400);
        assertTrue(c.at("/freshness/structuredSource/stale").asBoolean());
    }

    @Test
    void persistedRevisionChangesAreVisibleWithoutRestartAndFormerDetailSurvives()
            throws Exception {
        active();
        long a = current().at("/membership/revision").asLong();
        var six = fixture.current.stream().filter(k -> !k.equals("650")).toList();
        fixture.ll2(six, fixture.t.plusSeconds(2), "six");
        store.materialize(fixture.t.plusSeconds(3));
        assertEquals(6, current().path("members").size());
        assertTrue(current().at("/membership/revision").asLong() > a);
        http.perform(get("/api/iss/crew/" + id("650"))).andExpect(status().isOk());
        fixture.ll2(fixture.current, fixture.t.plusSeconds(4), "seven-again");
        store.materialize(fixture.t.plusSeconds(5));
        assertEquals(7, current().path("members").size());
        assertEquals(
                3,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_membership_projection_revision", Integer.class));
    }

    @Test
    void restartReaderUsesSameCommittedRevisionAndPublication()
            throws Exception {
        active();
        var prior = reader.latestCompatible().orElseThrow();
        var restarted = new JdbcActiveMembershipReader(jdbc, json, policy);
        assertEquals(prior, restarted.latestCompatible().orElseThrow());
        var restartedPublication = new ProductionCurrentMembership(restarted, people);
        var restored = new CrewRestQueryService(structured, reconciled, people, temporal, clock, restartedPublication).crew();
        assertEquals(7, restored.members().size());
        assertEquals(prior.revision(), restored.membership().revision());
    }

    @Test
    void
            qualifiedOperationalVisitorHasNoFabricatedAssignmentAndDepartureAndReentryFlowThroughCurrent()
                    throws Exception {
        active();
        fixture.operational(
                "650",
                "PERSON_DEPARTED_STATION",
                fixture.t.plusSeconds(2),
                fixture.t.plusSeconds(3));
        store.materialize(fixture.t.plusSeconds(4));
        assertEquals(6, current().path("members").size());
        fixture.operational(
                "650",
                "PERSON_ENTERED_STATION",
                fixture.t.plusSeconds(5),
                fixture.t.plusSeconds(6));
        store.materialize(fixture.t.plusSeconds(7));
        assertEquals(7, current().path("members").size());
        fixture.operational(
                "573",
                "PERSON_ENTERED_STATION",
                fixture.t.plusSeconds(8),
                fixture.t.plusSeconds(9));
        store.materialize(fixture.t.plusSeconds(10));
        var c = current();
        assertEquals(8, c.path("members").size());
        for (var m : c.path("members"))
            if (m.path("id").asText().equals(id("573").toString()))
                assertTrue(m.path("assignment").isNull());
        assertEquals(7, c.at("/counts/structuredAssignments").asInt());
    }

    @Test
    void shadowOnlyIdentityIsNotPromotedWhenProductionPublicationCannotMapIt() throws Exception {
        active();
        fixture.operational(
                "573",
                "PERSON_ENTERED_STATION",
                fixture.t.plusSeconds(2),
                fixture.t.plusSeconds(3));
        store.materialize(fixture.t.plusSeconds(4));
        var retained =
                people.findPeople(fixture.all.stream().map(this::id).toList(), clock.instant());
        var allowed = new HashMap<>(retained);
        allowed.remove(id("573"));
        doReturn(allowed).when(people).findPeople(anyCollection(), any());
        var c = current();
        assertEquals(7, c.path("members").size());
        assertEquals(1, c.at("/membership/nonPublishableActive").asInt());
        assertEquals("DEGRADED", c.at("/membership/health").asText());
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
        assertEquals(
                8,
                reader.latestCompatible().orElseThrow().result().counts().resolvedActiveHumans());
    }

    void pair(UUID a, UUID b) {
        var ids = new ArrayList<>(List.of(a, b));
        ids.sort(Comparator.comparing(UUID::toString));
        UUID root =
                jdbc.queryForObject(
                        "SELECT id FROM crew_person WHERE id IN (?,?) ORDER BY created_at,id LIMIT"
                                + " 1",
                        UUID.class,
                        a,
                        b);
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        s -> {
                            long decision =
                                    jdbc.queryForObject(
                                            "INSERT INTO"
                                                + " crew_person_equivalence_decision(declaration_key,left_person_id,right_person_id,representative_id,status,method,policy_version,decided_at,known_at,actor_category)"
                                                + " VALUES('TEST_ONLY',?,?,?,'ACTIVE','REVIEWED_SAME_HUMAN','TEST_ONLY',?,?,'MAINTAINER_REVIEWED')"
                                                + " RETURNING id",
                                            Long.class,
                                            ids.get(0),
                                            ids.get(1),
                                            root,
                                            fixture.t.atOffset(ZoneOffset.UTC),
                                            fixture.t.atOffset(ZoneOffset.UTC));
                            jdbc.update(
                                    "INSERT INTO"
                                        + " crew_identity_decision_evidence(equivalence_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary)"
                                        + " VALUES(?,'RETAINED_SOURCE','TEST_ONLY','https://example.test/proof',?,?,'TEST_ONLY','TEST_ONLY"
                                        + " reviewed fixture')",
                                    decision,
                                    fixture.t.atOffset(ZoneOffset.UTC),
                                    "0".repeat(64));
                        });
    }

    @Test
    void canonicalAliasesAndCollisionsUseProductionV7AndNeverDuplicateCards() throws Exception {
        active();
        pair(id("582"), id("710"));
        var c = current();
        assertEquals(6, c.path("members").size());
        assertEquals(1, c.at("/membership/canonicalCollisions").asInt());
        assertEquals("DEGRADED", c.at("/membership/health").asText());
        UUID canonical = people.identityAt(clock.instant()).canonicalize(id("582"));
        http.perform(get("/api/iss/crew/" + id("710")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(canonical.toString()));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT count(*) FROM crew_person_equivalence_decision", Integer.class));
    }

    @Test
    void allTableFingerprintsAreUnchangedAfterRepeatedCurrentAndRetainedDetailReads()
            throws Exception {
        active();
        var before = fingerprints();
        for (int i = 0; i < 3; i++) {
            current();
            http.perform(get("/api/iss/crew/" + id("732"))).andExpect(status().isOk());
        }
        assertEquals(before, fingerprints());
    }

    Map<String, String> fingerprints() {
        var result = new TreeMap<String, String>();
        for (String table :
                jdbc.queryForList(
                        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY"
                                + " tablename",
                        String.class))
            result.put(
                    table,
                    jdbc.queryForObject(
                            "SELECT md5(coalesce(string_agg(row_to_json(x)::text,E'\\n"
                                    + "' ORDER BY row_to_json(x)::text),'')) FROM \""
                                    + table
                                    + "\" x",
                            String.class));
        return result;
    }

    void insert(Membership.Result result, Instant at, String hash) throws Exception {
        String body = json.writeValueAsString(result), cut = json.writeValueAsString(result.cut());
        jdbc.update(
                "INSERT INTO"
                    + " crew_membership_projection_revision(policy_version,identity_mode,evaluated_at,created_at,input_hash,semantic_hash,serialized_cut,input_cut,serialized_result,result,health)"
                    + " VALUES(?,?,?, ?,?,?,?,?::jsonb,?,?::jsonb,?)",
                result.policy(),
                Membership.MODE,
                at.atOffset(ZoneOffset.UTC),
                at.atOffset(ZoneOffset.UTC),
                store.hash(cut),
                hash == null ? store.hash(body) : hash,
                cut,
                cut,
                body,
                body,
                result.health().name());
    }

    Membership.Result empty(String policyKey) {
        var cut =
                new Membership.Cut(
                        null, null, null, null, null, null, null, null, null, List.of(), List.of(),
                        List.of(), Map.of());
        return new Membership.Result(
                cut,
                policyKey,
                List.of(),
                List.of(),
                List.of(),
                new Membership.Counts(0, 0, 0, 0, 0, 0, 0, null, null, null),
                Membership.HealthState.DEGRADED,
                Map.of());
    }

    @Test
    void unsupportedPolicyIsRejected() throws Exception {
        insert(empty("TEST_ONLY_UNSUPPORTED"), fixture.t, null);
        unavailable("INCOMPATIBLE");
    }

    @Test
    void incompleteSerializedMembersFailClosedEvenIfRelationalCountsLookEmpty() throws Exception {
        fixture.ll2(fixture.current, fixture.t, "profiles");
        var e = empty(policy.key());
        var m =
                new Membership.Member(
                        new Membership.Human("LL2:PERSON:650", id("650"), "TEST_ONLY", null),
                        Membership.State.RETAINED,
                        List.of(),
                        null,
                        "UNKNOWN",
                        null,
                        List.of(),
                        null,
                        null,
                        null,
                        "TEST_ONLY");
        insert(
                new Membership.Result(
                        e.cut(),
                        e.policy(),
                        List.of(m),
                        e.unresolved(),
                        e.findings(),
                        e.counts(),
                        e.health(),
                        e.consistency()),
                fixture.t.plusSeconds(1),
                null);
        unavailable("INVALID");
    }

    @Test
    void corruptSemanticHashCannotCommitUnderFrozenV10Schema() throws Exception {
        assertThrows(
                org.springframework.dao.DataIntegrityViolationException.class,
                () -> insert(empty(policy.key()), fixture.t, "0".repeat(64)));
        unavailable("MISSING");
    }
}
