package org.mission1.crew.domain;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mission1.source.crew.CrewHttpReader;

class CrewEvidenceContractTest {
    private static final Instant RETRIEVED = Instant.parse("2026-10-03T08:34:43.318408Z");
    private static final Instant PUBLISHED = Instant.parse("2026-10-02T02:01:55Z");
    private static final Instant EVENT = Instant.parse("2026-10-02T01:19:00Z");

    private CrewSourceObservation observation(byte[] body) {
        return new CrewSourceObservation(CrewSource.NASA_OFFICIAL,
                URI.create("https://www.nasa.gov/blogs/spacestation/2026/10/01/crew-13-members-enter-station-join-expedition-75/"),
                RETRIEVED, PUBLISHED, EVENT, null, null, CrewHttpReader.sha256(body),
                "NASA_HTML", "reviewed-evidence-v1");
    }
    private byte[] fixture() throws Exception {
        try (var in = getClass().getResourceAsStream("/fixtures/crew/nasa/nasa-arrival-fragment.html")) {
            assertNotNull(in); return in.readAllBytes();
        }
    }

    @Test void presenceEvidenceExistsWithoutAnLl2AssignmentOrInventedNasaId() throws Exception {
        var person = new PersonReference(null, "Jessica Watkins", List.of(),
                URI.create("https://www.nasa.gov/people/jessica-watkins/"));
        var captured = observation(fixture());
        var entryObservation = new CrewSourceObservation(captured.source(), captured.sourceUrl(), captured.retrievedAt(),
                captured.sourcePublishedAt(), null, null, null, captured.contentHash(), captured.sourceVersion(), captured.adapterVersion());
        var evidence = new CrewVerificationEvidence(CrewVerificationEvidence.Type.PERSON_ENTERED_STATION,
                Station.ISS, List.of(person), null, NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                entryObservation, "Jessica Watkins is named in the captured entry report.", "MANUALLY_REVIEWED_TEST_EVIDENCE_V1");
        var presence = new StationPresence(Station.ISS, person, StationPresence.State.PRESENT, PUBLISHED, null, null, List.of(evidence));
        assertTrue(person.externalIds().isEmpty()); assertNull(person.mission1Id());
        assertEquals(PUBLISHED, presence.evidence().getFirst().observation().sourcePublishedAt());
        assertNull(presence.enteredAt()); // The exact hatch time is not the individual's entry instant.
        assertNull(evidence.observation().sourceEventAt());
        assertNotEquals(EVENT, PUBLISHED); assertNotEquals(RETRIEVED, PUBLISHED);
    }

    @Test void assignmentAndInSpaceCannotConfirmStationPresence() throws Exception {
        var person = new PersonReference(null, "TEST person", List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "99999")), null);
        var assignment = new CrewAssignment(null, new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "99999"), person,
                CrewRole.FLIGHT_ENGINEER, "Flight Engineer", null, null, observation(fixture()));
        var profile = new AstronautProfile(person, null, List.of(), null, null, null, true, observation(fixture()));
        var presence = new StationPresence(Station.ISS, person, StationPresence.State.UNKNOWN, RETRIEVED, null, null, List.of());
        assertTrue(profile.inSpace()); assertNotNull(assignment);
        assertEquals(StationPresence.State.UNKNOWN, presence.state());
        assertThrows(IllegalArgumentException.class, () -> new StationPresence(Station.ISS, person,
                StationPresence.State.PRESENT, RETRIEVED, null, null, List.of()));
        assertFalse(java.util.Arrays.stream(AstronautProfile.class.getRecordComponents())
                .anyMatch(c -> c.getType() == StationPresence.class || c.getName().equals("currentlyAboardIss")));
        assertFalse(java.util.Arrays.stream(CrewAssignment.class.getRecordComponents())
                .anyMatch(c -> c.getType() == StationPresence.class));
    }

    @Test void preservesRawDocumentBytesAndAllTimestampRoles() throws Exception {
        var body = fixture(); var obs = observation(body);
        var document = new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_POST, obs, body);
        byte original = body[0]; body[0] = 0;
        assertEquals(original, document.body()[0]); var copy = document.body(); copy[0] = 0;
        assertEquals(original, document.body()[0]);
        assertEquals(RETRIEVED, document.observation().retrievedAt());
        assertEquals(PUBLISHED, document.observation().sourcePublishedAt());
        assertEquals(EVENT, document.observation().sourceEventAt());
    }

    @Test void countAssertionAndConflictVocabularyAreNotBooleanVerification() throws Exception {
        var count = new CrewVerificationEvidence(CrewVerificationEvidence.Type.CREW_COUNT_ABOARD, Station.ISS,
                List.of(), 11, NasaSourceType.NASA_ISS_OPERATIONAL_POST, observation(fixture()),
                "Reviewed count in the separate October 2 report: eleven people.", "SYNTHETIC_CONTRACT_TEST");
        assertEquals(11, count.crewCount());
        assertThrows(IllegalArgumentException.class, () -> new CrewVerificationEvidence(CrewVerificationEvidence.Type.CREW_COUNT_ABOARD,
                Station.ISS, List.of(), null, NasaSourceType.NASA_ISS_OPERATIONAL_POST, observation(fixture()), "TEST", "TEST"));
        assertNotNull(ReconciliationStatus.NASA_AHEAD); assertNotNull(ReconciliationStatus.AMBIGUOUS);
    }

    @Test void rejectsInvalidHashAndMissingNamedEvidence() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> new CrewSourceObservation(CrewSource.NASA_OFFICIAL,
                URI.create("https://www.nasa.gov/"), RETRIEVED, null, null, null, null, "", "NASA_HTML", "TEST"));
        assertThrows(IllegalArgumentException.class, () -> new CrewVerificationEvidence(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                Station.ISS, List.of(), null, NasaSourceType.NASA_ISS_OPERATIONAL_POST, observation(fixture()), "TEST", "TEST"));
    }

    @Test void countMembershipAndHatchEvidenceCannotConfirmAnIndividualsPresence() throws Exception {
        var person = new PersonReference(null, "TEST person", List.of(), null);
        for (var type : List.of(CrewVerificationEvidence.Type.CREW_COUNT_ABOARD,
                CrewVerificationEvidence.Type.EXPEDITION_MEMBERSHIP, CrewVerificationEvidence.Type.HATCH_OPENED)) {
            var evidence = new CrewVerificationEvidence(type, Station.ISS, List.of(person),
                    type == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD ? 11 : null,
                    NasaSourceType.NASA_ISS_OPERATIONAL_POST, observation(fixture()), "TEST", "SYNTHETIC_CONTRACT_TEST");
            assertThrows(IllegalArgumentException.class, () -> new StationPresence(Station.ISS, person,
                    StationPresence.State.PRESENT, RETRIEVED, null, null, List.of(evidence)));
        }
    }

    @Test void namedPresenceEvidenceCannotConfirmAnotherPersonOrDeparture() throws Exception {
        var person = new PersonReference(null, "TEST person", List.of(), null);
        var other = new PersonReference(null, "TEST other person", List.of(), null);
        var evidence = new CrewVerificationEvidence(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
                Station.ISS, List.of(person), null, NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                observation(fixture()), "TEST", "SYNTHETIC_CONTRACT_TEST");
        assertThrows(IllegalArgumentException.class, () -> new StationPresence(Station.ISS, other,
                StationPresence.State.PRESENT, RETRIEVED, null, null, List.of(evidence)));
        assertThrows(IllegalArgumentException.class, () -> new StationPresence(Station.ISS, person,
                StationPresence.State.DEPARTED, RETRIEVED, null, null, List.of(evidence)));
    }
}
