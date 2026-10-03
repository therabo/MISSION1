package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewReconciliationSnapshot.*;
import org.mission1.crew.domain.CrewVerificationEvidence.*;

import java.net.URI;
import java.time.*;
import java.util.*;

/** All scenarios below are SYNTHETIC TEST evidence, never production ISS state. */
class CrewReconciliationEngineTest {
    static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");
    final CrewReconciliationEngine engine =
            new CrewReconciliationEngine(CrewReconciliationPolicy.defaults());

    PersonReference person(int n) {
        return new PersonReference(
                new UUID(0, n),
                "Test Person " + n,
                List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "" + n)),
                null);
    }

    CrewSourceObservation observation(CrewSource source, Instant published, Instant event) {
        return new CrewSourceObservation(
                source,
                URI.create("https://www.nasa.gov/blogs/spacestation/test/"),
                NOW.minusSeconds(100),
                published,
                event,
                null,
                null,
                "a".repeat(64),
                "TEST",
                "TEST-v1");
    }

    CrewQueryService.Latest primary(int... members) {
        return primaryAt(NOW.minusSeconds(3600), null, members);
    }

    CrewQueryService.Latest primaryAt(Instant fetched, Instant assignedFrom, int... members) {
        var o =
                new CrewSourceObservation(
                        CrewSource.LAUNCH_LIBRARY_2,
                        URI.create("https://ll.example.test/expeditions/"),
                        fetched,
                        null,
                        null,
                        null,
                        null,
                        "b".repeat(64),
                        "TEST",
                        "TEST-v1");
        var exp =
                new Expedition(
                        new UUID(1, 1),
                        new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "1"),
                        "TEST expedition",
                        NOW.minusSeconds(86400),
                        null,
                        Station.ISS,
                        o);
        var assignments =
                Arrays.stream(members)
                        .mapToObj(
                                n ->
                                        new CrewAssignment(
                                                new ExternalId(
                                                        CrewSource.LAUNCH_LIBRARY_2,
                                                        "assignment" + n),
                                                exp.externalId(),
                                                person(n),
                                                CrewRole.FLIGHT_ENGINEER,
                                                "Flight Engineer",
                                                assignedFrom,
                                                null,
                                                o))
                        .toList();
        var snap =
                new CrewSourceSnapshot(
                        Station.ISS, 1, true, List.of(exp), assignments, List.of(), o, "4");
        return new CrewQueryService.Latest(
                new CrewRepository.StoredSnapshot(1, snap),
                new CrewSyncRun(
                        1,
                        CrewSource.LAUNCH_LIBRARY_2,
                        Station.ISS,
                        fetched,
                        fetched,
                        CrewSyncRun.Outcome.SUCCESS,
                        CrewSourceState.AVAILABLE,
                        o.sourceUrl(),
                        200,
                        o,
                        null,
                        null,
                        null,
                        null,
                        1L));
    }

    CrewVerificationRepository.Evidence assertion(
            long id,
            Type type,
            Completeness completeness,
            Assertion mode,
            Instant published,
            Instant event,
            Integer count,
            PersonReference... people) {
        return new CrewVerificationRepository.Evidence(
                id,
                id,
                new CrewVerificationEvidence(
                        type,
                        Station.ISS,
                        List.of(people),
                        count,
                        NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                        observation(CrewSource.NASA_OFFICIAL, published, event),
                        "SYNTHETIC TEST assertion " + id,
                        "TEST-v1",
                        completeness,
                        mode));
    }

    CrewVerificationRepository.Evidence roster(long id, Instant at, int... members) {
        return assertion(
                id,
                Type.PERSON_CURRENTLY_ABOARD,
                Completeness.EXHAUSTIVE,
                Assertion.OBSERVED,
                at,
                null,
                null,
                Arrays.stream(members).mapToObj(this::person).toArray(PersonReference[]::new));
    }

    CrewVerificationRepository.Evidence event(long id, Type type, Instant at, int member) {
        return assertion(
                id,
                type,
                Completeness.EVENT_ONLY,
                Assertion.COMPLETED,
                at.plusSeconds(10),
                at,
                null,
                person(member));
    }

    CrewReconciliationSnapshot evaluate(
            CrewQueryService.Latest primary,
            boolean primaryOk,
            boolean nasaOk,
            Instant asOf,
            List<CrewVerificationRepository.Evidence> evidence) {
        var resolution = new ArrayList<CrewIdentityResolution>();
        for (var e : evidence)
            for (int i = 0; i < e.value().people().size(); i++) {
                var p = e.value().people().get(i);
                resolution.add(
                        new CrewIdentityResolution(
                                e.id() * 100 + i,
                                e.id(),
                                i,
                                p.mission1Id(),
                                p.mission1Id() == null
                                        ? CrewIdentityResolution.Method.UNRESOLVED
                                        : CrewIdentityResolution.Method.EXTERNAL_ID,
                                List.of(),
                                null,
                                "TEST-v1"));
            }
        return engine.evaluate(
                new CrewReconciliationEngine.Inputs(
                        primary,
                        primaryOk,
                        new CrewVerificationRepository.Verification(2, 1, NOW.minusSeconds(100)),
                        nasaOk,
                        evidence,
                        resolution,
                        asOf));
    }

    CrewReconciliationSnapshot eval(
            CrewQueryService.Latest p, CrewVerificationRepository.Evidence... e) {
        return evaluate(p, true, true, NOW, List.of(e));
    }

    Presence presence(CrewReconciliationSnapshot s, int n) {
        return s.people().stream()
                .filter(p -> p.personId().equals(person(n).mission1Id()))
                .findFirst()
                .orElseThrow()
                .presence();
    }

    @Test
    void exactSevenResolvedPeopleMatchOnlyWithExhaustiveCoverage() {
        var s =
                eval(
                        primary(1, 2, 3, 4, 5, 6, 7),
                        roster(1, NOW.minusSeconds(2000), 1, 2, 3, 4, 5, 6, 7));
        assertEquals(ReconciliationStatus.MATCH, s.status());
        assertEquals(7, s.presentInBoth().size());
        assertTrue(s.people().stream().allMatch(p -> p.presence() == Presence.CONFIRMED_ABOARD));
    }

    @Test
    void newerFourArrivalsMakeNasaAheadWithoutFabricatedAssignments() {
        var s =
                eval(
                        primary(1, 2, 3, 4, 5, 6, 7),
                        roster(1, NOW.minusSeconds(4000), 1, 2, 3, 4, 5, 6, 7),
                        event(2, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(1000), 8),
                        event(3, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(1000), 9),
                        event(4, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(1000), 10),
                        event(5, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(1000), 11));
        assertEquals(ReconciliationStatus.NASA_AHEAD, s.status());
        assertEquals(4, s.onlyInNasa().size());
        assertEquals(7, s.people().stream().filter(PersonState::ll2Assigned).count());
    }

    @Test
    void differencesWithoutProvenPrecedenceArePartialMatch() {
        var s = eval(primary(1, 2), roster(1, NOW.minusSeconds(4000), 2, 3));
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
        assertEquals(1, s.presentInBoth().size());
        assertEquals(1, s.onlyInLl2().size());
        assertEquals(1, s.onlyInNasa().size());
    }

    @Test
    void newerExplicitStructuredAssignmentCanBeLl2AheadButDoesNotConfirmPresence() {
        var s =
                eval(
                        primaryAt(NOW.minusSeconds(300), NOW.minusSeconds(1000), 1, 2),
                        roster(1, NOW.minusSeconds(2000), 1));
        assertEquals(ReconciliationStatus.LL2_AHEAD, s.status());
        assertEquals(Presence.UNVERIFIED, presence(s, 2));
    }

    @Test
    void nasaFailureNeverPromotesLl2OrLastKnownPresence() {
        var s =
                evaluate(
                        primary(1),
                        true,
                        false,
                        NOW,
                        List.of(roster(1, NOW.minusSeconds(1000), 1)));
        assertEquals(ReconciliationStatus.VERIFICATION_UNAVAILABLE, s.status());
        assertEquals(Presence.UNVERIFIED, presence(s, 1));
        assertEquals(Presence.CONFIRMED_ABOARD, s.people().getFirst().lastKnownPresence());
    }

    @Test
    void primaryUnavailableStillAllowsNasaPresence() {
        var s = evaluate(null, false, true, NOW, List.of(roster(1, NOW.minusSeconds(1000), 1)));
        assertEquals(ReconciliationStatus.PRIMARY_UNAVAILABLE, s.status());
        assertEquals(Presence.CONFIRMED_ABOARD, presence(s, 1));
    }

    @Test
    void oldCurrentAssertionIsRetainedAsStale() {
        var s = eval(primary(1), roster(1, NOW.minusSeconds(4 * 86400), 1));
        assertEquals(ReconciliationStatus.STALE, s.status());
        assertEquals(Presence.STALE, presence(s, 1));
    }

    @Test
    void freshRetrievalCannotMakeOldAssertionsCurrent() {
        var s =
                evaluate(
                        primary(1),
                        true,
                        true,
                        NOW.plusSeconds(7 * 3600),
                        List.of(roster(1, NOW.minusSeconds(1000), 1)));
        assertEquals(ReconciliationStatus.STALE, s.status());
        assertEquals(Presence.STALE, presence(s, 1));
    }

    @Test
    void unresolvedSubjectsAreVisibleAndPreventMatch() {
        var unknown = new PersonReference(null, "Unresolved Test Person", List.of(), null);
        var s =
                eval(
                        primary(1),
                        assertion(
                                1,
                                Type.PERSON_CURRENTLY_ABOARD,
                                Completeness.EXHAUSTIVE,
                                Assertion.OBSERVED,
                                NOW.minusSeconds(1000),
                                null,
                                null,
                                person(1),
                                unknown));
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
        assertEquals("Unresolved Test Person", s.unresolved().getFirst().displayName());
    }

    @Test
    void ambiguousIdentityIsNotGuessed() {
        var e = roster(1, NOW.minusSeconds(1000), 1);
        var resolution =
                new CrewIdentityResolution(
                        1,
                        1,
                        0,
                        null,
                        CrewIdentityResolution.Method.AMBIGUOUS,
                        List.of(person(1).mission1Id(), person(2).mission1Id()),
                        null,
                        "TEST");
        var s =
                engine.evaluate(
                        new CrewReconciliationEngine.Inputs(
                                primary(1),
                                true,
                                new CrewVerificationRepository.Verification(2, 1, NOW),
                                true,
                                List.of(e),
                                List.of(resolution),
                                NOW));
        assertEquals(ReconciliationStatus.AMBIGUOUS, s.status());
        assertEquals(Presence.UNVERIFIED, presence(s, 1));
        assertEquals(2, s.unresolved().getFirst().candidates().size());
    }

    @Test
    void countElevenWithTenIdentitiesDoesNotInventEleventh() {
        var s =
                eval(
                        primary(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
                        roster(1, NOW.minusSeconds(1000), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
                        assertion(
                                2,
                                Type.CREW_COUNT_ABOARD,
                                Completeness.COUNT_ONLY,
                                Assertion.OBSERVED,
                                NOW.minusSeconds(1000),
                                null,
                                11));
        assertEquals(11, s.officialCrewCount());
        assertEquals(10, s.people().size());
        assertEquals(1, s.unidentifiedCount());
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
    }

    @Test
    void countOnlyEqualityNeverMatches() {
        var s =
                eval(
                        primary(1, 2),
                        assertion(
                                1,
                                Type.CREW_COUNT_ABOARD,
                                Completeness.COUNT_ONLY,
                                Assertion.OBSERVED,
                                NOW.minusSeconds(1000),
                                null,
                                2));
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
        assertTrue(s.presentInBoth().isEmpty());
        assertEquals(2, s.unidentifiedCount());
    }

    @Test
    void plannedDepartureAndFutureEventLeavePresenceUnchanged() {
        var s =
                eval(
                        primary(1),
                        roster(1, NOW.minusSeconds(2000), 1),
                        assertion(
                                2,
                                Type.PERSON_DEPARTED_STATION,
                                Completeness.EVENT_ONLY,
                                Assertion.PLANNED,
                                NOW.minusSeconds(1000),
                                NOW.plusSeconds(1000),
                                null,
                                person(1)),
                        event(3, Type.PERSON_DEPARTED_STATION, NOW.plusSeconds(1000), 1));
        assertEquals(Presence.CONFIRMED_ABOARD, presence(s, 1));
    }

    @Test
    void completedDepartureSupersedesArrival() {
        var s =
                eval(
                        primary(1),
                        event(1, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(2000), 1),
                        event(2, Type.PERSON_DEPARTED_STATION, NOW.minusSeconds(1000), 1));
        assertEquals(Presence.CONFIRMED_NOT_ABOARD, presence(s, 1));
    }

    @Test
    void partialOmissionIsNotDeparture() {
        var partial =
                assertion(
                        2,
                        Type.PERSON_CURRENTLY_ABOARD,
                        Completeness.PARTIAL,
                        Assertion.OBSERVED,
                        NOW.minusSeconds(1000),
                        null,
                        null,
                        person(2));
        var s =
                eval(
                        primary(1, 2),
                        event(1, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(2000), 1),
                        partial);
        assertEquals(Presence.CONFIRMED_ABOARD, presence(s, 1));
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
    }

    @Test
    void exhaustiveOmissionCanNegatePreviouslyKnownPresence() {
        var s =
                eval(
                        primary(1, 2),
                        event(1, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(2000), 1),
                        roster(2, NOW.minusSeconds(1000), 2));
        assertEquals(Presence.CONFIRMED_NOT_ABOARD, presence(s, 1));
    }

    @Test
    void lateOldDepartureCannotRewindNewerRoster() {
        var old = event(2, Type.PERSON_DEPARTED_STATION, NOW.minusSeconds(3000), 1);
        var latest = roster(1, NOW.minusSeconds(1000), 1);
        var a = eval(primary(1), latest, old);
        var b = eval(primary(1), old, latest);
        assertEquals(Presence.CONFIRMED_ABOARD, presence(a, 1));
        assertEquals(a, b);
    }

    @Test
    void laterCompletedEventSupersedesRosterAndInvalidatesOlderCount() {
        var s =
                eval(
                        primary(1),
                        roster(1, NOW.minusSeconds(2000), 1),
                        assertion(
                                2,
                                Type.CREW_COUNT_ABOARD,
                                Completeness.COUNT_ONLY,
                                Assertion.OBSERVED,
                                NOW.minusSeconds(2000),
                                null,
                                1),
                        event(3, Type.PERSON_DEPARTED_STATION, NOW.minusSeconds(1000), 1));
        assertEquals(Presence.CONFIRMED_NOT_ABOARD, presence(s, 1));
        assertNull(s.officialCrewCount());
    }

    @Test
    void equallyTimedContradictoryClaimsAreAmbiguous() {
        var s =
                eval(
                        primary(1),
                        event(1, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(1000), 1),
                        event(2, Type.PERSON_DEPARTED_STATION, NOW.minusSeconds(1000), 1));
        assertEquals(ReconciliationStatus.AMBIGUOUS, s.status());
        assertEquals(Presence.AMBIGUOUS, presence(s, 1));
    }

    @Test
    void ll2AssignmentWithNoNasaIsUnverifiedRegardlessOfInSpace() {
        var s = eval(primary(1));
        assertEquals(ReconciliationStatus.VERIFICATION_UNAVAILABLE, s.status());
        assertEquals(Presence.UNVERIFIED, presence(s, 1));
        assertNull(s.officialCrewCount());
    }

    @Test
    void policyVersionAndChangedInterpretationChangeKeyButSameEvaluationDoesNot() {
        var a = eval(primary(1), roster(1, NOW.minusSeconds(1000), 1));
        var b = eval(primary(1), roster(1, NOW.minusSeconds(1000), 1));
        assertEquals(CrewReconciliationService.stateKey(a), CrewReconciliationService.stateKey(b));
        var engine2 =
                new CrewReconciliationEngine(
                        new CrewReconciliationPolicy(
                                Duration.ofHours(12),
                                Duration.ofHours(6),
                                Duration.ofHours(72),
                                Duration.ofDays(14)));
        var c =
                engine2.evaluate(
                        new CrewReconciliationEngine.Inputs(
                                primary(1), true, null, false, List.of(), List.of(), NOW));
        assertNotEquals(a.algorithmVersion(), c.algorithmVersion());
    }

    @Test
    void unresolvedCompletedDepartureInvalidatesOlderCountWithoutInventingIdentity() {
        var count =
                assertion(
                        1,
                        Type.CREW_COUNT_ABOARD,
                        Completeness.COUNT_ONLY,
                        Assertion.OBSERVED,
                        NOW.minusSeconds(2000),
                        null,
                        11);
        var departure =
                assertion(
                        2,
                        Type.PERSON_DEPARTED_STATION,
                        Completeness.PARTIAL,
                        Assertion.COMPLETED,
                        NOW.minusSeconds(1000),
                        null,
                        null,
                        new PersonReference(null, "Unresolved Test Person", List.of(), null));
        var s = eval(primary(1), count, departure);
        assertNull(s.officialCrewCount());
        assertEquals(1, s.unresolved().size());
        assertEquals(Presence.UNVERIFIED, presence(s, 1));
    }

    @Test
    void expiredSupersededCountDoesNotMakeNewCompletedArrivalStale() {
        var old =
                assertion(
                        1,
                        Type.CREW_COUNT_ABOARD,
                        Completeness.COUNT_ONLY,
                        Assertion.OBSERVED,
                        NOW.minusSeconds(4 * 86400),
                        null,
                        1);
        var s =
                eval(
                        primary(1),
                        old,
                        event(2, Type.PERSON_ENTERED_STATION, NOW.minusSeconds(200), 1));
        assertNull(s.officialCrewCount());
        assertEquals(Presence.CONFIRMED_ABOARD, presence(s, 1));
        assertEquals(ReconciliationStatus.PARTIAL_MATCH, s.status());
    }

    @Test
    void eventTypeWithoutCompletedAssertionDoesNotEstablishPresence() {
        var e =
                assertion(
                        1,
                        Type.PERSON_ENTERED_STATION,
                        Completeness.EVENT_ONLY,
                        Assertion.OBSERVED,
                        NOW.minusSeconds(200),
                        null,
                        null,
                        person(1));
        var s = eval(primary(1), e);
        assertEquals(Presence.UNVERIFIED, presence(s, 1));
        assertEquals(ReconciliationStatus.VERIFICATION_UNAVAILABLE, s.status());
    }

    CrewReconciliationSnapshot replay(List<CrewVerificationRepository.Evidence> evidence, Instant at) {
        var resolution=new ArrayList<CrewIdentityResolution>();
        for(var e:evidence) for(int n=0;n<e.value().people().size();n++) {
            var id=e.value().people().get(n).mission1Id();
            resolution.add(new CrewIdentityResolution(e.id()*100+n,e.id(),n,id,CrewIdentityResolution.Method.EXTERNAL_ID,List.of(id),"TEST","TEST-v1"));
        }
        return engine.evaluateEffectiveTime(new CrewReconciliationEngine.Inputs(null,false,new CrewVerificationRepository.Verification(1,1,NOW),true,evidence,resolution,at));
    }
    @Test void replayUsesLateEventAtEffectiveTimeAndDepartureInEventOrder() {
        var arrival=event(101,Type.PERSON_ENTERED_STATION,NOW.minusSeconds(7200),1);
        var departure=event(102,Type.PERSON_DEPARTED_STATION,NOW.minusSeconds(3600),1);
        var afterArrival=replay(List.of(departure,arrival),NOW.minusSeconds(5400));
        assertEquals(Presence.CONFIRMED_ABOARD,afterArrival.people().getFirst().presence());
        assertTrue(replay(List.of(arrival,departure),NOW.minusSeconds(8000)).people().isEmpty());
        assertEquals(Presence.CONFIRMED_NOT_ABOARD,replay(List.of(arrival,departure),NOW).people().getFirst().presence());
        assertEquals(afterArrival,replay(List.of(arrival,departure),NOW.minusSeconds(5400)));
    }
    @Test void replayPlannedTransitionAndPartialOmissionRemainInert() {
        var arrival=event(101,Type.PERSON_ENTERED_STATION,NOW.minusSeconds(7200),1);
        var planned=assertion(102,Type.PERSON_DEPARTED_STATION,Completeness.PARTIAL,Assertion.PLANNED,NOW.minusSeconds(3600),null,null,person(1));
        var partial=assertion(103,Type.PERSON_CURRENTLY_ABOARD,Completeness.PARTIAL,Assertion.OBSERVED,NOW.minusSeconds(100),null,null,person(2));
        var state=replay(List.of(arrival,planned,partial),NOW);
        assertEquals(Presence.CONFIRMED_ABOARD,state.people().getFirst().presence());
    }
    @Test void replayRetainsStaleLastKnownWithoutClaimingCurrentPresenceAfterApplicabilityWindow() {
        var arrival=event(101,Type.PERSON_ENTERED_STATION,NOW.minusSeconds(15*86400),1);
        assertEquals(Presence.STALE,replay(List.of(arrival),NOW).people().getFirst().presence());
    }
}
