package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mission1.crew.domain.*;

import java.net.URI;
import java.time.*;
import java.util.*;

class CrewRefreshPolicyTest {
    final Instant now = Instant.parse("2026-10-03T12:00:00Z");
    final CrewRefreshPolicy policy = new CrewRefreshPolicy(CrewRefreshPolicy.Settings.defaults());

    CrewRefreshPolicy.Candidate event(
            CrewOperationalEvent.Relevance relevance,
            Instant date,
            String precision,
            CrewOperationalEvent.Status status) {
        return new CrewRefreshPolicy.Candidate(
                1,
                new CrewOperationalEvent(
                        "99999",
                        URI.create("https://example.invalid/TEST_EVENT/99999"),
                        CrewOperationalEvent.Kind.DOCKING,
                        date,
                        precision,
                        now,
                        relevance,
                        status,
                        List.of(),
                        List.of()));
    }

    CrewRefreshPolicy.Decision nasa(List<CrewRefreshPolicy.Candidate> candidates) {
        return policy.nasa(
                now, now.minusSeconds(3600), now.minusSeconds(7200), null, now, candidates);
    }

    @Test
    void noEventPreservesBaselineAndIsNotDueAtOneHour() {
        var d = nasa(List.of());
        assertEquals(Duration.ofHours(2), d.interval());
        assertFalse(d.due(now));
    }

    @ParameterizedTest
    @EnumSource(CrewOperationalEvent.Relevance.class)
    void validatedRelevanceSelectsBoundedCadence(CrewOperationalEvent.Relevance relevance) {
        var d = nasa(List.of(event(relevance, now, "Minute", CrewOperationalEvent.Status.UNKNOWN)));
        assertEquals(
                switch (relevance) {
                    case CREWED -> Duration.ofMinutes(30);
                    case UNKNOWN -> Duration.ofHours(1);
                    case CARGO -> Duration.ofHours(2);
                },
                d.interval());
        if (relevance == CrewOperationalEvent.Relevance.CARGO) assertNull(d.eventObservationId());
        else assertEquals(1, d.eventObservationId());
    }

    @ParameterizedTest
    @ValueSource(longs = {-21601, 21601, 172800, -172800})
    void outsideWindowNeverAccelerates(long delta) {
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now.plusSeconds(delta),
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
    }

    @ParameterizedTest
    @ValueSource(longs = {-21600, 21600, 0})
    void windowBoundariesAreInclusive(long delta) {
        assertEquals(
                Duration.ofMinutes(30),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now.plusSeconds(delta),
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"Day", "Month", "Year", "Unknown", "Second"})
    void unverifiedOrCoarsePrecisionFailsClosed(String precision) {
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now,
                                        precision,
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
    }

    @Test
    void cancelledAndNullScheduleAreInert() {
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now,
                                        "Minute",
                                        CrewOperationalEvent.Status.CANCELLED)))
                        .interval());
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        null,
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
    }

    @Test
    void rescheduleEarlierAndLaterUseLatestObservation() {
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now.plusSeconds(86400),
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
        assertEquals(
                Duration.ofMinutes(30),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now,
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
        assertEquals(
                Duration.ofHours(2),
                nasa(List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now.minusSeconds(86400),
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)))
                        .interval());
    }

    @Test
    void staleFailedAndFutureCatalogCannotAccelerate() {
        for (Instant fetched : Arrays.asList(null, now.minusSeconds(43201), now.plusSeconds(1))) {
            var d =
                    policy.nasa(
                            now,
                            now.minusSeconds(3600),
                            now.minusSeconds(7200),
                            null,
                            fetched,
                            List.of(
                                    event(
                                            CrewOperationalEvent.Relevance.CREWED,
                                            now,
                                            "Minute",
                                            CrewOperationalEvent.Status.UNKNOWN)));
            assertEquals(Duration.ofHours(2), d.interval());
        }
    }

    @Test
    void retryAfterAndStartupGateDominateWindow() {
        var retry = now.plusSeconds(10800);
        var d =
                policy.nasa(
                        now,
                        now.minusSeconds(3600),
                        now.plusSeconds(600),
                        retry,
                        now,
                        List.of(
                                event(
                                        CrewOperationalEvent.Relevance.CREWED,
                                        now,
                                        "Minute",
                                        CrewOperationalEvent.Status.UNKNOWN)));
        assertEquals(retry, d.eligibleAt());
        assertFalse(d.due(now));
    }

    CrewVerificationRepository.Evidence evidence(
            CrewVerificationEvidence.Type type,
            CrewVerificationEvidence.Assertion assertion,
            Instant published,
            Instant explicit) {
        var o =
                new CrewSourceObservation(
                        CrewSource.NASA_OFFICIAL,
                        URI.create("https://www.nasa.gov/blogs/TEST"),
                        now,
                        published,
                        explicit,
                        null,
                        null,
                        "0".repeat(64),
                        "NASA_RSS",
                        "TEST_ONLY");
        var people =
                type == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD
                        ? List.<PersonReference>of()
                        : List.of(
                                new PersonReference(
                                        null, "SYNTHETIC_TEST_PERSON", List.of(), null));
        return new CrewVerificationRepository.Evidence(
                42,
                1,
                new CrewVerificationEvidence(
                        type,
                        Station.ISS,
                        people,
                        type == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD ? 7 : null,
                        NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
                        o,
                        "SYNTHETIC_TEST_EXCERPT",
                        "TEST_ONLY",
                        type == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD
                                ? CrewVerificationEvidence.Completeness.COUNT_ONLY
                                : CrewVerificationEvidence.Completeness.EVENT_ONLY,
                        assertion));
    }

    @ParameterizedTest
    @EnumSource(
            value = CrewVerificationEvidence.Type.class,
            names = {"PERSON_ENTERED_STATION", "PERSON_DEPARTED_STATION"})
    void completedNamedTransfersUseEventOtherwisePublication(CrewVerificationEvidence.Type type) {
        assertEquals(
                now.minusSeconds(60),
                policy.completedContext(
                                evidence(
                                        type,
                                        CrewVerificationEvidence.Assertion.COMPLETED,
                                        now.minusSeconds(120),
                                        now.minusSeconds(60)),
                                now)
                        .orElseThrow());
        assertEquals(
                now.minusSeconds(120),
                policy.completedContext(
                                evidence(
                                        type,
                                        CrewVerificationEvidence.Assertion.COMPLETED,
                                        now.minusSeconds(120),
                                        null),
                                now)
                        .orElseThrow());
    }

    @ParameterizedTest
    @EnumSource(
            value = CrewVerificationEvidence.Type.class,
            names = {
                "CREW_COUNT_ABOARD",
                "DOCKING_OCCURRED",
                "UNDOCKING_OCCURRED",
                "HATCH_OPENED",
                "PERSON_CURRENTLY_ABOARD"
            })
    void nonTransferEvidenceNeverTriggers(CrewVerificationEvidence.Type type) {
        assertTrue(
                policy.completedContext(
                                evidence(
                                        type,
                                        CrewVerificationEvidence.Assertion.COMPLETED,
                                        now,
                                        null),
                                now)
                        .isEmpty());
    }

    @Test
    void plannedObservedMissingFutureAndOldContextsAreInert() {
        for (var assertion :
                List.of(
                        CrewVerificationEvidence.Assertion.PLANNED,
                        CrewVerificationEvidence.Assertion.OBSERVED))
            assertTrue(
                    policy.completedContext(
                                    evidence(
                                            CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                                            assertion,
                                            now,
                                            null),
                                    now)
                            .isEmpty());
        for (var context :
                Arrays.asList(
                        null,
                        now.plusSeconds(1),
                        now.minusSeconds(86400),
                        now.minusSeconds(172800)))
            assertTrue(
                    policy.completedContext(
                                    evidence(
                                            CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                                            CrewVerificationEvidence.Assertion.COMPLETED,
                                            context,
                                            null),
                                    now)
                            .isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"SETTLED", "EXPIRED", "ATTEMPTS_EXHAUSTED", "SUPERSEDED"})
    void terminalFollowUpsNeverRestart(String state) {
        var f =
                new CrewRefreshPolicy.FollowUp(
                        1, 42, now.minusSeconds(60), now.plusSeconds(3600), state, 1);
        assertEquals(
                CrewRefreshPolicy.Reason.BASELINE_SCHEDULE,
                policy.roster(now, now.minusSeconds(3600), now, null, List.of(f), Map.of())
                        .reason());
    }

    @Test
    void horizonAndBudgetReturnToBaselineEvenWithPartialMatch() {
        for (var f :
                List.of(
                        new CrewRefreshPolicy.FollowUp(
                                1, 42, now.minusSeconds(86400), now, "OPEN", 1),
                        new CrewRefreshPolicy.FollowUp(
                                1, 42, now.minusSeconds(60), now.plusSeconds(3600), "OPEN", 6)))
            assertEquals(
                    Duration.ofHours(2),
                    policy.roster(now, now.minusSeconds(3600), now, null, List.of(f), Map.of())
                            .interval());
    }

    @Test
    void followUpReasonDistinguishesArrivalDepartureAndSourceLag() {
        for (var type :
                List.of(
                        CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                        CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION)) {
            var e = evidence(type, CrewVerificationEvidence.Assertion.COMPLETED, now, null);
            for (int attempts : new int[] {0, 1}) {
                var f =
                        new CrewRefreshPolicy.FollowUp(
                                1, 42, now, now.plusSeconds(3600), "OPEN", attempts);
                var d =
                        policy.roster(
                                now, now.minusSeconds(3600), now, null, List.of(f), Map.of(42L, e));
                assertEquals(
                        attempts > 0
                                ? CrewRefreshPolicy.Reason.STRUCTURED_SOURCE_LAG_FOLLOW_UP
                                : type == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                                        ? CrewRefreshPolicy.Reason.NASA_COMPLETED_ARRIVAL
                                        : CrewRefreshPolicy.Reason.NASA_COMPLETED_DEPARTURE,
                        d.reason());
                assertEquals(42, d.evidenceId());
                assertTrue(d.due(now));
            }
        }
    }

    @Test
    void settlementRequiresSafeIdentityEvidenceAndAssignmentRatherThanCounts() {
        var e =
                evidence(
                        CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                        CrewVerificationEvidence.Assertion.COMPLETED,
                        now,
                        null);
        UUID person = UUID.randomUUID();
        var r =
                new CrewIdentityResolution(
                        1,
                        42,
                        0,
                        person,
                        CrewIdentityResolution.Method.EXACT_UNIQUE_NAME,
                        List.of(person),
                        "TEST",
                        "TEST");
        assertFalse(policy.settled(e, now, state(person, false, List.of(42L), now), List.of(r)));
        assertFalse(policy.settled(e, now, state(person, true, List.of(), now), List.of(r)));
        assertFalse(
                policy.settled(
                        e,
                        now,
                        state(person, true, List.of(42L), now.minusSeconds(1)),
                        List.of(r)));
        assertFalse(policy.settled(e, now, state(person, true, List.of(42L), now), List.of()));
        assertTrue(policy.settled(e, now, state(person, true, List.of(42L), now), List.of(r)));
    }

    CrewReconciliationSnapshot state(
            UUID person, boolean assigned, List<Long> cited, Instant fetched) {
        return new CrewReconciliationSnapshot(
                "TEST",
                now,
                1L,
                1L,
                1L,
                fetched,
                now,
                ReconciliationStatus.PARTIAL_MATCH,
                7,
                0,
                List.of(
                        new CrewReconciliationSnapshot.PersonState(
                                person,
                                CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD,
                                null,
                                now,
                                cited,
                                assigned)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(42L),
                List.of(1L),
                List.of(1L));
    }

    @Test
    void lateOlderTransferIsSupersededOnlyByNewerConfirmedOppositeIdentity() {
        var e =
                evidence(
                        CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION,
                        CrewVerificationEvidence.Assertion.COMPLETED,
                        now.minusSeconds(120),
                        null);
        UUID person = UUID.randomUUID();
        var r =
                new CrewIdentityResolution(
                        1,
                        42,
                        0,
                        person,
                        CrewIdentityResolution.Method.EXACT_UNIQUE_NAME,
                        List.of(person),
                        "TEST",
                        "TEST");
        assertTrue(
                policy.superseded(
                        e,
                        now.minusSeconds(120),
                        state(person, true, List.of(99L), now),
                        List.of(r)));
        assertFalse(policy.superseded(e, now, state(person, true, List.of(99L), now), List.of(r)));
        assertFalse(
                policy.superseded(
                        e,
                        now.minusSeconds(120),
                        state(person, true, List.of(99L), now),
                        List.of()));
    }

    @Test
    void settingsRejectUnboundedQuota() {
        var s = CrewRefreshPolicy.Settings.defaults();
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new CrewRefreshPolicy.Settings(
                                s.roster(),
                                s.nasa(),
                                s.catalog(),
                                s.pre(),
                                s.post(),
                                s.crewed(),
                                s.unknown(),
                                s.followUp(),
                                s.horizon(),
                                s.catalogMaxAge(),
                                7,
                                15));
    }
}
