package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

class NasaOperationalFeedParserTest {
    final NasaOperationalFeedParser parser = new NasaOperationalFeedParser();

    static byte[] fixture() throws Exception {
        try (var input =
                new java.util.zip.GZIPInputStream(
                        NasaOperationalFeedParserTest.class.getResourceAsStream(
                                "/fixtures/crew/nasa/verification/operational-feed.xml.gz"))) {
            byte[] raw = input.readAllBytes();
            assertEquals(
                    "12257a99814dba2d2336ca0a51533ae10a94f9e651d825e8dfa6f6b0cffeeb0e",
                    CrewHttpReader.sha256(raw));
            return raw;
        }
    }

    static CrewSourceDocument document(byte[] body) {
        return new CrewSourceDocument(
                NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
                new CrewSourceObservation(
                        CrewSource.NASA_OFFICIAL,
                        NasaOperationalFeedHttpSource.URL,
                        Instant.parse("2026-10-03T10:40:51Z"),
                        null,
                        null,
                        "test-etag",
                        "Fri, 02 Oct 2026 18:14:15 GMT",
                        CrewHttpReader.sha256(body),
                        "NASA_RSS",
                        "NasaOperationalFeedParser/1.0.0"),
                body);
    }

    @Test
    void recordedOfficialFeedProducesTypedPartialPresenceAndSeparateCount() throws Exception {
        var result = parser.verify(document(fixture()));
        assertEquals(CrewSourceState.AVAILABLE, result.state());
        var evidence = result.value();
        assertEquals(4, evidence.size());
        var arrival =
                evidence.stream()
                        .filter(
                                e ->
                                        e.type()
                                                == CrewVerificationEvidence.Type
                                                        .PERSON_ENTERED_STATION)
                        .findFirst()
                        .orElseThrow();
        assertEquals(4, arrival.people().size());
        assertEquals(
                Instant.parse("2026-10-02T02:01:55Z"), arrival.observation().sourcePublishedAt());
        var hatch =
                evidence.stream()
                        .filter(e -> e.type() == CrewVerificationEvidence.Type.HATCH_OPENED)
                        .findFirst()
                        .orElseThrow();
        assertNull(hatch.observation().sourceEventAt());
        assertTrue(hatch.people().isEmpty());
        assertTrue(hatch.supportingExcerpt().contains("9:19 p.m. EDT"));
        assertNull(
                arrival.observation()
                        .sourceEventAt()); // Hatch opening is not a personal entry instant.
        assertEquals(CrewVerificationEvidence.Assertion.COMPLETED, arrival.assertion());
        assertEquals(CrewVerificationEvidence.Completeness.PARTIAL, arrival.completeness());
        assertEquals(
                URI.create("https://www.nasa.gov/people/jessica-watkins/"),
                arrival.people().getFirst().officialProfileUrl());
        assertEquals(
                7,
                evidence.stream()
                        .filter(
                                e ->
                                        e.type()
                                                == CrewVerificationEvidence.Type
                                                        .PERSON_CURRENTLY_ABOARD)
                        .findFirst()
                        .orElseThrow()
                        .people()
                        .size());
        var count =
                evidence.stream()
                        .filter(e -> e.type() == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD)
                        .findFirst()
                        .orElseThrow();
        assertEquals(11, count.crewCount());
        assertTrue(count.people().isEmpty());
        assertTrue(
                evidence.stream()
                        .noneMatch(
                                e ->
                                        e.type()
                                                == CrewVerificationEvidence.Type
                                                        .PERSON_DEPARTED_STATION));
    }

    @Test
    void additiveMarkupIsIgnoredButMandatoryMetadataDisappearanceFails() throws Exception {
        String xml = new String(fixture(), StandardCharsets.UTF_8);
        assertEquals(
                CrewSourceState.AVAILABLE,
                parser.verify(
                                document(
                                        xml.replace("</channel>", "<extra>new</extra></channel>")
                                                .getBytes(StandardCharsets.UTF_8)))
                        .state());
        for (String changed :
                List.of(
                        xml.replace("<pubDate>", "<other>").replace("</pubDate>", "</other>"),
                        xml.replace("International Space Station - NASA", "Unknown"),
                        xml.replace("content:encoded", "content:lost")))
            assertEquals(
                    CrewSourceState.MALFORMED_RESPONSE,
                    parser.verify(document(changed.getBytes(StandardCharsets.UTF_8))).state());
    }

    @Test
    void missingSemanticArrivalAnchorFailsClosed() throws Exception {
        String xml =
                new String(fixture(), StandardCharsets.UTF_8)
                        .replace(
                                "have entered the International Space Station",
                                "completed an unexpected editorial transition");
        assertEquals(
                CrewSourceState.MALFORMED_RESPONSE,
                parser.verify(document(xml.getBytes(StandardCharsets.UTF_8))).state());
    }

    @Test
    void xmlExternalEntitiesAndUnofficialItemsAreRejected() throws Exception {
        String xml = new String(fixture(), StandardCharsets.UTF_8);
        assertEquals(
                CrewSourceState.MALFORMED_RESPONSE,
                parser.verify(
                                document(
                                        xml.replace(
                                                        "<rss ",
                                                        "<!DOCTYPE rss [<!ENTITY x SYSTEM"
                                                                + " 'file:///not-read'>]><rss ")
                                                .getBytes(StandardCharsets.UTF_8)))
                        .state());
        assertEquals(
                CrewSourceState.MALFORMED_RESPONSE,
                parser.verify(
                                document(
                                        xml.replace(
                                                        "https://www.nasa.gov/blogs/",
                                                        "https://invalid.example/blogs/")
                                                .getBytes(StandardCharsets.UTF_8)))
                        .state());
    }

    @Test
    void plannedDepartureIsNotCompletedAndUnknownPersonGrammarFails() {
        var posts = new NasaOperationalPostParser();
        var o = document("test".getBytes()).observation();
        assertTrue(
                posts.parse(
                                "Scheduled departure",
                                "<p>NASA astronauts Test Alpha and Test Beta will depart the"
                                        + " International Space Station tomorrow.</p>",
                                o)
                        .isEmpty());
        var done =
                posts.parse(
                        "Crew departure",
                        "<p>NASA astronauts Test Alpha and Test Beta have departed the"
                                + " International Space Station.</p>",
                        o);
        assertEquals(CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION, done.getFirst().type());
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        posts.parse(
                                "Crew enter station",
                                "<p>Some people have entered the International Space Station.</p>",
                                o));
    }

    @Test
    void unscopedCompletedCrewUndockingFailsClosed() {
        var posts = new NasaOperationalPostParser();
        var o = document("test".getBytes()).observation();
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        posts.parse(
                                "Dragon Undocks from Station, Heads for Splashdown",
                                "<p>At 5:20 p.m. EST, NASA’s SpaceX Crew-11 mission undocked from"
                                    + " the International Space Station’s Harmony module aboard the"
                                    + " SpaceX Dragon spacecraft.</p>",
                                o));
    }

    @Test
    void profileLinksAreValidatedWithoutExternalRedirectRequests() {
        assertNull(
                NasaOperationalPostParser.officialProfile("https://www.nasa.gov/mission/crew-13/"));
        assertNull(
                NasaOperationalPostParser.officialProfile(
                        "https://unofficial.example/people/test/"));
        assertNull(
                NasaOperationalPostParser.officialProfile(
                        "https://www.nasa.gov/people/test/?fake=1"));
    }
}
