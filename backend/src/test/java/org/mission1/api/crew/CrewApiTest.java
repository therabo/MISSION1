package org.mission1.api.crew;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.net.URI;
import java.time.*;
import java.util.*;

/** Synthetic TEST_ONLY states: executable JSON contract, never current source truth. */
@WebMvcTest(CrewController.class)
@Import({CrewErrors.class, CrewRestQueryService.class})
class CrewApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean CrewQueryService structured;
    @MockitoBean CrewReconciliationQueryService reconciled;
    @MockitoBean CrewReadQueryService people;
    @MockitoBean CrewReconciliationPolicy policy;
    @MockitoBean Clock clock;
    final Instant at = Instant.parse("2026-10-03T12:00:00Z");
    final UUID expeditionId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    final UUID id = uuid(1);
    CrewReconciliationQueryService.Current current;
    CrewQueryService.Latest latest;
    CrewQueryService.Status healthy;
    CrewSourceObservation ll2, nasa;
    Map<UUID, CrewReadRepository.Person> persons;

    static UUID uuid(int i) {
        return UUID.fromString("00000000-0000-0000-0000-" + String.format("%012d", i));
    }

    CrewSourceObservation observation(CrewSource source, String path) {
        return new CrewSourceObservation(
                source,
                URI.create("https://example.test/" + path),
                at.minusSeconds(60),
                source == CrewSource.NASA_OFFICIAL ? at.minusSeconds(120) : null,
                null,
                null,
                null,
                "a".repeat(64),
                "TEST_ONLY",
                "TEST_ONLY/v1");
    }

    CrewSyncRun run(
            long id,
            CrewSource source,
            CrewSyncRun.Outcome outcome,
            CrewSourceState state,
            Instant start) {
        var o = source == CrewSource.NASA_OFFICIAL ? nasa : ll2;
        return new CrewSyncRun(
                id,
                source,
                Station.ISS,
                start,
                start.plusSeconds(1),
                outcome,
                state,
                o.sourceUrl(),
                200,
                o,
                null,
                null,
                null,
                null,
                source == CrewSource.LAUNCH_LIBRARY_2 && outcome == CrewSyncRun.Outcome.SUCCESS
                        ? 1L
                        : null);
    }

    AstronautProfile profile(int i) {
        var p =
                new PersonReference(
                        uuid(i),
                        i == 1 ? "Zoë Тест" : "TEST Person " + i,
                        List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "TEST" + i)),
                        null);
        return new AstronautProfile(
                p,
                new Agency("TEST Agency", "TEST", "Government", List.of()),
                List.of(
                        new Nationality("IT", "ITA", "Italia"),
                        new Nationality("FR", "FRA", "France")),
                "TEST text <script>alert('x')</script>\nPunctuation: ‘quoted’ & plain.",
                new CareerStatistics(
                        Duration.parse("P436DT6H28M11S"),
                        Duration.parse("PT18H30M0.123456789S"),
                        2,
                        6,
                        at.minusSeconds(999),
                        null),
                new CrewMediaAsset(
                        URI.create("https://example.test/image.png"),
                        URI.create("https://example.test/thumb.png"),
                        "TEST Credit",
                        "TEST License",
                        URI.create("https://example.test/license"),
                        true),
                true,
                ll2,
                "TEST_ONLY");
    }

    @BeforeEach
    void setup() {
        ll2 = observation(CrewSource.LAUNCH_LIBRARY_2, "ll2");
        nasa = observation(CrewSource.NASA_OFFICIAL, "nasa");
        when(clock.instant()).thenReturn(at);
        when(policy.primaryMaxAge()).thenReturn(Duration.ofHours(6));
        when(policy.verificationMaxAge()).thenReturn(Duration.ofHours(6));
        when(policy.fresh(any(), any(), any())).thenReturn(true);
        when(policy.applicable(any(), any(), any())).thenReturn(true);
        var profiles = new ArrayList<AstronautProfile>();
        for (int i = 1; i <= 7; i++) profiles.add(profile(i));
        var exp =
                new Expedition(
                        expeditionId,
                        new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "TEST_EXP"),
                        "TEST Expedition",
                        at.minusSeconds(600),
                        null,
                        Station.ISS,
                        ll2);
        var assignments =
                profiles.stream()
                        .map(
                                p ->
                                        new CrewAssignment(
                                                null,
                                                exp.externalId(),
                                                p.person(),
                                                CrewRole.FLIGHT_ENGINEER,
                                                "Flight Engineer",
                                                null,
                                                null,
                                                ll2))
                        .toList();
        latest =
                new CrewQueryService.Latest(
                        new CrewRepository.StoredSnapshot(
                                91,
                                new CrewSourceSnapshot(
                                        Station.ISS,
                                        1,
                                        true,
                                        List.of(exp),
                                        assignments,
                                        profiles,
                                        ll2,
                                        "4")),
                        run(
                                92,
                                CrewSource.LAUNCH_LIBRARY_2,
                                CrewSyncRun.Outcome.SUCCESS,
                                CrewSourceState.AVAILABLE,
                                at.minusSeconds(60)));
        healthy =
                new CrewQueryService.Status(
                        Optional.of(latest.successfulRun()),
                        Optional.of(latest.successfulRun()),
                        Optional.empty(),
                        Optional.empty(),
                        false);
        persons = new LinkedHashMap<>();
        for (var p : profiles)
            persons.put(
                    p.person().mission1Id(),
                    new CrewReadRepository.Person(
                            p.person().mission1Id(),
                            p.person().displayName(),
                            null,
                            p.person().externalIds(),
                            p,
                            at.minusSeconds(60),
                            ll2));
        for (int i = 8; i <= 9; i++)
            persons.put(
                    uuid(i),
                    new CrewReadRepository.Person(
                            uuid(i),
                            "TEST NASA-only " + i,
                            URI.create("https://example.test/people/" + i),
                            List.of(new ExternalId(CrewSource.NASA_OFFICIAL, "profile:test" + i)),
                            null,
                            null,
                            null));
        when(people.findPeople(any(), any()))
                .thenAnswer(
                        inv -> {
                            var result = new LinkedHashMap<UUID, CrewReadRepository.Person>();
                            for (UUID key : (Collection<UUID>) inv.getArgument(0))
                                if (persons.containsKey(key)) result.put(key, persons.get(key));
                            return result;
                        });
        when(structured.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS))
                .thenReturn(Optional.of(latest));
        when(structured.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS)).thenReturn(healthy);
        when(people.latestStructuredOutcome()).thenReturn(Optional.of(latest.successfulRun()));
        setState(ReconciliationStatus.PARTIAL_MATCH);
    }

    void setState(ReconciliationStatus status) {
        var positive =
                new CrewVerificationEvidence(
                        CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                        Station.ISS,
                        List.of(new PersonReference(null, "TEST public subject", List.of(), null)),
                        null,
                        NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                        nasa,
                        "TEST parser supporting internals not public",
                        "TEST/v1");
        boolean match = status == ReconciliationStatus.MATCH;
        if (match)
            positive =
                    new CrewVerificationEvidence(
                            CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                            Station.ISS,
                            java.util.stream.IntStream.rangeClosed(1, 7)
                                    .mapToObj(i -> profile(i).person())
                                    .toList(),
                            null,
                            NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                            nasa,
                            "TEST exhaustive matching roster",
                            "TEST/v1",
                            CrewVerificationEvidence.Completeness.EXHAUSTIVE,
                            CrewVerificationEvidence.Assertion.OBSERVED);
        var count =
                new CrewVerificationEvidence(
                        CrewVerificationEvidence.Type.CREW_COUNT_ABOARD,
                        Station.ISS,
                        List.of(),
                        match ? 7 : 11,
                        NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                        nasa,
                        "TEST count",
                        "TEST/v1");
        var states = new ArrayList<CrewReconciliationSnapshot.PersonState>();
        for (int i = 1; i <= (match ? 7 : 9); i++)
            states.add(
                    new CrewReconciliationSnapshot.PersonState(
                            uuid(i),
                            i == 7 && !match
                                    ? CrewReconciliationSnapshot.Presence.UNVERIFIED
                                    : CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD,
                            i == 7 && !match
                                    ? null
                                    : CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD,
                            i == 7 && !match ? null : at.minusSeconds(120),
                            i == 7 && !match ? List.of() : List.of(101L),
                            i <= 7));
        var unresolved = new ArrayList<CrewReconciliationSnapshot.UnresolvedSubject>();
        for (int i = 0; i < 3; i++)
            unresolved.add(
                    new CrewReconciliationSnapshot.UnresolvedSubject(
                            101,
                            i,
                            "TEST unresolved " + i,
                            CrewIdentityResolution.Method.UNRESOLVED,
                            List.of()));
        var s =
                new CrewReconciliationSnapshot(
                        "TEST/v1",
                        at,
                        91L,
                        92L,
                        93L,
                        at.minusSeconds(60),
                        at.minusSeconds(60),
                        status,
                        match ? 7 : 11,
                        match ? 0 : 3,
                        states,
                        match ? List.of() : unresolved,
                        match
                                ? states.stream()
                                        .map(CrewReconciliationSnapshot.PersonState::personId)
                                        .toList()
                                : List.of(),
                        match ? List.of() : List.of(uuid(7)),
                        match ? List.of() : List.of(uuid(8), uuid(9)),
                        List.of(101L, 102L),
                        List.of(),
                        List.of(201L));
        var nasaRun =
                run(
                        93,
                        CrewSource.NASA_OFFICIAL,
                        CrewSyncRun.Outcome.SUCCESS,
                        CrewSourceState.AVAILABLE,
                        at.minusSeconds(60));
        var nasaHealth =
                new CrewQueryService.Status(
                        Optional.of(nasaRun),
                        Optional.of(nasaRun),
                        Optional.empty(),
                        Optional.empty(),
                        false);
        current =
                new CrewReconciliationQueryService.Current(
                        s,
                        Optional.of(latest),
                        healthy,
                        nasaHealth,
                        Optional.of(new CrewReconciliationRepository.Stored(99, s)),
                        Optional.empty(),
                        Optional.of(
                                new CrewReconciliationRepository.Run(
                                        100,
                                        at.minusSeconds(30),
                                        at.minusSeconds(29),
                                        "SUCCESS",
                                        null,
                                        99L,
                                        "TEST/v1")),
                        List.of(
                                new CrewVerificationRepository.Evidence(101, 201, positive),
                                new CrewVerificationRepository.Evidence(102, 201, count)),
                        List.of());
        when(reconciled.current()).thenAnswer(inv -> current);
    }

    JsonNode read(String path) throws Exception {
        var r =
                mvc.perform(get(path))
                        .andExpect(status().isOk())
                        .andExpect(content().contentTypeCompatibleWith("application/json"))
                        .andExpect(header().string("Cache-Control", "no-store"))
                        .andReturn();
        return json.readTree(
                r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void partialMatchPreservesElevenEightThreeSevenAndNineMembers() throws Exception {
        var r = read("/api/iss/crew");
        assertEquals(11, r.at("/counts/officialAboard").asInt());
        assertEquals(8, r.at("/counts/resolvedAboard").asInt());
        assertEquals(3, r.at("/counts/unresolvedSubjects").asInt());
        assertEquals(7, r.at("/counts/structuredAssignments").asInt());
        assertEquals(9, r.get("members").size());
        assertEquals(3, r.get("unresolvedSubjects").size());
        assertEquals("PARTIAL_MATCH", r.at("/reconciliation/status").asText());
        for (var u : r.get("unresolvedSubjects")) {
            assertFalse(u.has("id"));
            assertFalse(u.has("personId"));
            assertFalse(u.has("candidates"));
        }
    }

    @ParameterizedTest
    @EnumSource(ReconciliationStatus.class)
    void everyExistingReconciliationStatusIsPreserved(ReconciliationStatus state) throws Exception {
        setState(state);
        assertEquals(state.name(), read("/api/iss/crew").at("/reconciliation/status").asText());
    }

    @Test
    void matchHasEmptyUnresolvedArray() throws Exception {
        setState(ReconciliationStatus.MATCH);
        var r = read("/api/iss/crew");
        assertEquals(0, r.get("unresolvedSubjects").size());
        assertEquals(7, r.get("members").size());
        assertEquals(7, r.at("/counts/resolvedAboard").asInt());
        assertEquals(7, r.at("/counts/officialAboard").asInt());
        for (var p : r.get("members"))
            assertEquals("CONFIRMED_ABOARD", p.at("/presence/state").asText());
    }

    @Test
    void ll2OnlyAssignmentRemainsUnverified() throws Exception {
        var r = read("/api/iss/crew");
        assertEquals("UNVERIFIED", r.at("/members/6/presence/state").asText());
        assertTrue(r.at("/members/6/presence/authority").isNull());
        assertFalse(r.at("/members/6/assignment").isNull());
    }

    @Test
    void nasaOnlyPersonHasNoFabricatedAssignmentOrProfile() throws Exception {
        var r = read("/api/iss/crew");
        assertTrue(r.at("/members/7/assignment").isNull());
        assertEquals("CONFIRMED_ABOARD", r.at("/members/7/presence/state").asText());
        assertTrue(r.at("/members/7/agency").isNull());
        var p = read("/api/iss/crew/" + uuid(8));
        assertEquals("UNAVAILABLE", p.get("profileAvailability").asText());
        assertTrue(p.get("biography").isNull());
        assertEquals("TEST NASA-only 8", p.get("name").asText());
    }

    @Test
    void profileSerializesUuidUnicodeTextInstantsDurationsAndMediaRights() throws Exception {
        var p = read("/api/iss/crew/" + id);
        assertEquals(id.toString(), p.get("id").asText());
        assertEquals("Zoë Тест", p.get("name").asText());
        assertEquals(profile(1).biography(), p.get("biography").asText());
        assertEquals(2, p.get("nationalities").size());
        assertEquals(
                Duration.parse("P436DT6H28M11S"),
                Duration.parse(p.at("/career/timeInSpace").asText()));
        assertEquals("PT18H30M0.123456789S", p.at("/career/evaTime").asText());
        assertEquals(at, Instant.parse(p.at("/reconciliation/evaluatedAt").asText()));
        assertEquals("TEST Credit", p.at("/image/credit").asText());
        assertTrue(p.at("/image/singleUse").asBoolean());
        assertEquals("https://example.test/license", p.at("/image/licenseUrl").asText());
        assertTrue(p.at("/career/lastFlight").isNull());
    }

    @Test
    void nullableStructuredProfileIsValid() throws Exception {
        var p = profile(1);
        var empty = new AstronautProfile(p.person(), null, List.of(), null, null, null, null, ll2);
        persons.put(
                id,
                new CrewReadRepository.Person(
                        id, p.person().displayName(), null, List.of(), empty, at, ll2));
        var r = read("/api/iss/crew/" + id);
        assertTrue(r.get("agency").isNull());
        assertTrue(r.get("image").isNull());
        assertTrue(r.get("career").isNull());
        assertEquals(0, r.get("nationalities").size());
    }

    @Test
    void historicalKnownPersonDoesNotNeedCurrentMembership() throws Exception {
        persons.put(
                uuid(10),
                new CrewReadRepository.Person(
                        uuid(10), "TEST historical", null, List.of(), profile(10), at, ll2));
        var r = read("/api/iss/crew/" + uuid(10));
        assertTrue(r.get("currentAssignment").isNull());
        assertEquals("UNKNOWN", r.at("/currentPresence/state").asText());
    }

    @Test
    void sourceFreshnessAndReconciliationTimesRemainDistinct() throws Exception {
        var r = read("/api/iss/crew");
        assertEquals(
                at.minusSeconds(60).toString(),
                r.at("/freshness/structuredSource/lastSuccessfulFetchAt").asText());
        assertEquals(at.toString(), r.at("/reconciliation/evaluatedAt").asText());
        assertEquals(
                at.minusSeconds(30).toString(), r.at("/reconciliation/lastAttemptAt").asText());
        assertEquals("LAUNCH_LIBRARY_2", r.at("/provenance/structuredSource/source").asText());
        assertEquals("NASA_OFFICIAL", r.at("/provenance/verification/source").asText());
    }

    @Test
    void rawSourceAndDatabaseIdentifiersNeverLeak() throws Exception {
        String r = read("/api/iss/crew").toString();
        for (String field :
                List.of(
                        "snapshotId",
                        "runId",
                        "evidenceId",
                        "documentId",
                        "supportingExcerpt",
                        "parserName",
                        "body",
                        "subjectIndex",
                        "identityKey")) assertFalse(r.contains("\"" + field + "\""), field);
        assertFalse(r.contains("parser supporting internals"));
    }

    @Test
    void staleCountRetainsLastKnownButCurrentCountIsNull() throws Exception {
        setState(ReconciliationStatus.STALE);
        when(policy.applicable(any(), any(), any())).thenReturn(false);
        var r = read("/api/iss/crew");
        assertTrue(r.at("/counts/officialAboard").isNull());
        assertEquals(11, r.at("/counts/lastKnownOfficialAboard").asInt());
        assertTrue(r.at("/freshness/stale").asBoolean());
        assertFalse(r.at("/unresolvedSubjects/0/applicable").asBoolean());
    }

    @Test
    void expeditionUsesStructuredAssignmentsAndRoles() throws Exception {
        var r = read("/api/iss/expedition/current");
        assertEquals(7, r.get("assignmentCount").asInt());
        assertEquals(expeditionId.toString(), r.at("/expedition/id").asText());
        assertEquals(id.toString(), r.at("/assignments/0/personId").asText());
        assertEquals("FLIGHT_ENGINEER", r.at("/assignments/0/roleCode").asText());
        assertEquals(2, r.at("/assignments/0/nationalities").size());
        assertFalse(r.at("/assignments/0").has("presence"));
        verifyNoInteractions(reconciled);
    }

    @Test
    void explicitNoActiveExpeditionIsNormalResponse() throws Exception {
        when(people.latestStructuredOutcome())
                .thenReturn(
                        Optional.of(
                                run(
                                        200,
                                        CrewSource.LAUNCH_LIBRARY_2,
                                        CrewSyncRun.Outcome.SOURCE_RESULT,
                                        CrewSourceState.NO_ACTIVE_EXPEDITION,
                                        at.minusSeconds(1))));
        var r = read("/api/iss/expedition/current");
        assertTrue(r.get("expedition").isNull());
        assertEquals("NO_ACTIVE_EXPEDITION", r.get("sourceState").asText());
        assertEquals(0, r.get("assignments").size());
    }

    @Test
    void noActiveWithoutPreviousSnapshotIs200() throws Exception {
        when(structured.latest(any(), any())).thenReturn(Optional.empty());
        when(people.latestStructuredOutcome())
                .thenReturn(
                        Optional.of(
                                run(
                                        200,
                                        CrewSource.LAUNCH_LIBRARY_2,
                                        CrewSyncRun.Outcome.SOURCE_RESULT,
                                        CrewSourceState.NO_ACTIVE_EXPEDITION,
                                        at.minusSeconds(1))));
        assertTrue(read("/api/iss/expedition/current").get("expedition").isNull());
    }

    @Test
    void noCrewInputsReturnsAvailabilityProblem() throws Exception {
        var empty =
                new CrewQueryService.Status(
                        Optional.empty(),
                        Optional.empty(),
                        Optional.empty(),
                        Optional.empty(),
                        false);
        var state =
                new CrewReconciliationSnapshot(
                        "TEST/v1",
                        at,
                        null,
                        null,
                        null,
                        null,
                        null,
                        ReconciliationStatus.VERIFICATION_UNAVAILABLE,
                        null,
                        0,
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());
        current =
                new CrewReconciliationQueryService.Current(
                        state,
                        Optional.empty(),
                        empty,
                        empty,
                        Optional.empty(),
                        Optional.empty(),
                        Optional.empty(),
                        List.of(),
                        List.of());
        mvc.perform(get("/api/iss/crew"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:crew-state-unavailable"));
    }

    @Test
    void rateLimitHealthIsSeparateFromReconciliation() throws Exception {
        var failed =
                run(
                        200,
                        CrewSource.NASA_OFFICIAL,
                        CrewSyncRun.Outcome.SOURCE_RESULT,
                        CrewSourceState.RATE_LIMITED,
                        at.minusSeconds(1));
        var health =
                new CrewQueryService.Status(
                        Optional.of(failed),
                        current.verificationHealth().lastSuccess(),
                        Optional.of(failed),
                        Optional.of(at.plusSeconds(600)),
                        true);
        current =
                new CrewReconciliationQueryService.Current(
                        current.interpretation(),
                        current.structuredPrimary(),
                        current.primaryHealth(),
                        health,
                        current.lastPersistedInterpretation(),
                        current.lastParseFailure(),
                        current.lastReconciliationAttempt(),
                        current.verificationEvidence(),
                        current.identityResolutions());
        var r = read("/api/iss/crew");
        assertTrue(r.at("/freshness/verification/rateLimited").asBoolean());
        assertTrue(r.at("/freshness/verification/lastRefreshFailed").asBoolean());
        assertTrue(r.at("/counts/officialAboard").isNull());
        assertEquals("PARTIAL_MATCH", r.at("/reconciliation/status").asText());
    }

    @Test
    void noPrimaryStateIs503() throws Exception {
        when(structured.latest(any(), any())).thenReturn(Optional.empty());
        when(people.latestStructuredOutcome()).thenReturn(Optional.empty());
        mvc.perform(get("/api/iss/expedition/current"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(
                        jsonPath("$.type").value("urn:mission1:problem:crew-primary-unavailable"));
    }

    @Test
    void unknownUuidIs404() throws Exception {
        mvc.perform(get("/api/iss/crew/" + uuid(99)))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:person-not-found"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-a-uuid", "1-1-1-1-1", "573"})
    void malformedUuidIs400(String value) throws Exception {
        mvc.perform(get("/api/iss/crew/" + value))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:bad-request"));
        verifyNoInteractions(reconciled);
    }

    @Test
    void internalFailureIsSanitized() throws Exception {
        when(reconciled.current()).thenThrow(new IllegalStateException("TEST secret SQL password"));
        var r =
                mvc.perform(get("/api/iss/crew"))
                        .andExpect(status().isInternalServerError())
                        .andExpect(
                                jsonPath("$.type")
                                        .value("urn:mission1:problem:crew-internal-error"))
                        .andReturn();
        assertFalse(r.getResponse().getContentAsString().contains("secret"));
    }
}
