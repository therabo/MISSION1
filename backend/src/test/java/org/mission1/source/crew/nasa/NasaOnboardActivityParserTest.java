package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.time.*;
import java.util.*;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

class NasaOnboardActivityParserTest {
  static final Instant AT = Instant.parse("2026-10-11T13:00:00Z");

  static CrewSourceObservation observation() {
    return new CrewSourceObservation(
        CrewSource.NASA_OFFICIAL,
        URI.create("https://www.nasa.gov/blogs/spacestation/2026/10/11/test-only-activities/"),
        AT,
        AT,
        null,
        null,
        null,
        "0".repeat(64),
        "NASA_RSS",
        "NasaOperationalFeedParser/1.2.0");
  }

  List<CrewVerificationEvidence> parse(String body) {
    return new NasaOperationalPostParser()
        .parse("Station research activities", body, observation());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "is working aboard the International Space Station",
        "worked inside the Kibo laboratory",
        "serviced hardware aboard the station",
        "conducted research in the Destiny laboratory module",
        "transferred cargo inside Harmony module",
        "performed maintenance aboard the orbital outpost"
      })
  void boundedTypedSubjectActivityAndStationLocation(String clause) {
    var e = parse("<p>NASA astronaut Alice Example " + clause + ".</p>").getFirst();
    assertEquals(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD, e.type());
    assertEquals(CrewVerificationEvidence.Assertion.OBSERVED, e.assertion());
    assertEquals(
        List.of("Alice Example"), e.people().stream().map(PersonReference::displayName).toList());
    assertNull(e.people().getFirst().mission1Id());
    assertNull(e.observation().sourceEventAt());
    assertEquals("NasaOperationalPostParser/1.2.0|PUBLICATION_TIME_PROXY", e.evidenceMethod());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "will work aboard the ISS",
        "is scheduled to work aboard the ISS",
        "previously worked aboard the ISS",
        "worked aboard the ISS last year",
        "recalled working aboard the ISS",
        "is working at NASA headquarters",
        "is working in a Kibo laboratory training simulator",
        "will remain aboard the ISS",
        "is a flight engineer aboard the ISS",
        "was selected for a mission to the ISS",
        "worked on equipment while Bob Other is aboard the ISS",
        "is not working aboard the ISS",
        "worked aboard a SpaceX Dragon",
        "said Bob Other worked aboard the ISS",
        "worked on hardware that Bob Other serviced aboard the ISS",
        "worked aboard the ISS in 2022"
      })
  void mentionsPlansBiographyHistoryNegationAndWrongLocationCannotObserve(String clause) {
    assertTrue(parse("<p>NASA astronaut Alice Example " + clause + ".</p>").isEmpty());
  }

  @Test
  void unrelatedPersonInAnotherSentenceAndCaptionNeverContaminates() {
    var e =
        parse(
            "<figure><figcaption><p>NASA astronaut Bob Other is working aboard the"
                + " ISS.</p></figcaption></figure><p>NASA astronaut Alice Example worked in the"
                + " Kibo laboratory. NASA astronaut Bob Other previously lived aboard the"
                + " ISS.</p>");
    assertEquals(1, e.size());
    assertEquals("Alice Example", e.getFirst().people().getFirst().displayName());
    assertTrue(
        parse(
                "<blockquote><p>NASA astronaut Alice Example is working aboard the"
                    + " ISS.</p></blockquote>")
            .isEmpty());
    assertTrue(
        parse("<p><q>NASA astronaut Alice Example is working aboard the ISS.</q></p>").isEmpty());
  }

  @Test
  void explicitClockBelongsOnlyToActivityAndWinsOverPublication() {
    var e =
        parse("<p>At 8:05 a.m. EDT, NASA astronaut Alice Example worked aboard the ISS.</p>")
            .getFirst();
    assertEquals(Instant.parse("2026-10-11T12:05:00Z"), e.observation().sourceEventAt());
    assertEquals("MINUTE", CrewOperationalTime.read(e.evidenceMethod()).orElseThrow().precision());
    var unrelated =
        parse(
                "<p>Ground controllers acted at 8:05 a.m. EDT. NASA astronaut Alice Example is"
                    + " working aboard the ISS.</p>")
            .getFirst();
    assertNull(unrelated.observation().sourceEventAt());
  }

  @Test
  void postDepartureArticleCannotRefreshPresence() {
    assertTrue(
        new NasaOperationalPostParser()
            .parse(
                "Crew splashes down returning to Earth",
                "<p>NASA astronaut Alice Example worked aboard the station.</p>",
                observation())
            .isEmpty());
  }

  @Test
  void sameParagraphSurnameNeedsUniqueTypedIntroduction() {
    assertTrue(parse("<p>Example worked inside the Destiny laboratory module.</p>").isEmpty());
    assertTrue(
        parse(
                "<p>NASA astronaut Alice Example and NASA astronaut Bob Example will fly soon."
                    + " Example worked inside the Destiny laboratory module.</p>")
            .isEmpty());
    var e =
        parse(
            "<p>NASA astronaut Alice Example will stay until spring. Example wore a sensor as she"
                + " worked inside the Destiny laboratory module.</p>");
    assertEquals("Alice Example", e.getFirst().people().getFirst().displayName());
  }

  @Test
  void exactCapturedNasaFeedProvidesScopedRecurringObservations() throws Exception {
    byte[] bytes;
    try (var in =
        new GZIPInputStream(
            getClass()
                .getResourceAsStream("/fixtures/crew/nasa/verification/activity-feed.xml.gz"))) {
      bytes = in.readAllBytes();
    }
    assertEquals(
        "312a35ef56856f9081731b0fb505eff999291d134ee1100778951424a712f54c",
        CrewHttpReader.sha256(bytes));
    var o = observation();
    var result =
        new NasaOperationalFeedParser()
            .verify(
                new CrewSourceDocument(
                    NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
                    new CrewSourceObservation(
                        o.source(),
                        NasaOperationalFeedHttpSource.URL,
                        AT,
                        null,
                        null,
                        null,
                        null,
                        CrewHttpReader.sha256(bytes),
                        "NASA_RSS",
                        "1.2.0"),
                    bytes));
    assertEquals(CrewSourceState.AVAILABLE, result.state());
    var observed =
        result.value().stream()
            .filter(e -> e.type() == CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD)
            .toList();
    assertEquals(3, observed.size());
    assertTrue(
        observed.stream()
            .anyMatch(
                e ->
                    e.people().size() == 1
                        && e.people().getFirst().displayName().equals("Anil Menon")
                        && e.observation()
                            .sourcePublishedAt()
                            .equals(Instant.parse("2026-10-06T17:57:55Z"))));
    var luke =
        observed.stream()
            .filter(
                e ->
                    e.observation()
                        .sourcePublishedAt()
                        .equals(Instant.parse("2026-10-09T16:35:40Z")))
            .findFirst()
            .orElseThrow();
    assertEquals(
        List.of("Luke Delaney"), luke.people().stream().map(PersonReference::displayName).toList());
    assertEquals(
        URI.create("https://www.nasa.gov/people/nasa-astronaut-luke-delaney/"),
        luke.people().getFirst().officialProfileUrl());
    assertNull(
        luke.observation()
            .sourceEventAt()); // Earlier controller clock is not Delaney's activity clock.
    assertTrue(
        observed.stream()
            .noneMatch(
                e ->
                    e.people().stream()
                        .anyMatch(
                            p ->
                                p.displayName().contains("Meir")
                                    || p.displayName().contains("Hathaway"))));
  }
}
