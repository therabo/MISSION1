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

/** Exact recorded source plus explicitly synthetic, bounded grammar mutations. */
public class NasaCompletedDepartureTest {
  public static byte[] fixture() throws Exception {
    try (var in =
        new GZIPInputStream(
            NasaCompletedDepartureTest.class.getResourceAsStream(
                "/fixtures/crew/nasa/verification/completed-departure-feed.xml.gz"))) {
      byte[] raw = in.readAllBytes();
      assertEquals(
          "312a35ef56856f9081731b0fb505eff999291d134ee1100778951424a712f54c",
          CrewHttpReader.sha256(raw));
      return raw;
    }
  }

  public static CrewSourceDocument document(byte[] raw) {
    return new CrewSourceDocument(
        NasaSourceType.NASA_ISS_OPERATIONAL_FEED,
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            NasaOperationalFeedHttpSource.URL,
            Instant.parse("2026-10-10T14:09:37.143134Z"),
            null,
            null,
            null,
            null,
            CrewHttpReader.sha256(raw),
            "NASA_RSS",
            "REGRESSION"),
        raw);
  }

  static CrewSourceObservation observation(String day, String publication) {
    return new CrewSourceObservation(
        CrewSource.NASA_OFFICIAL,
        URI.create("https://www.nasa.gov/blogs/spacestation/" + day + "/test-only-departure/"),
        Instant.parse(publication).plusSeconds(60),
        Instant.parse(publication),
        null,
        null,
        null,
        "a".repeat(64),
        "TEST_ONLY",
        "TEST_ONLY");
  }

  static CrewSourceObservation source() {
    return observation("2026/10/07", "2026-10-07T12:48:02Z");
  }

  static String sentence(String names) {
    return "At 8:05 a.m. EDT, "
        + names
        + " undocked from the space-facing port of the "
        + "International Space Station’s Harmony module aboard the SpaceX Dragon spacecraft.";
  }

  static List<CrewVerificationEvidence> parse(String text) {
    return new NasaOperationalPostParser()
        .parse("Crew undocks from station", "<p>" + text + "</p>", source());
  }

  @Test
  void exactFullFeedPreservesNamesOrderTimeAndIndependentPublication() throws Exception {
    var result = new NasaOperationalFeedParser().verify(document(fixture()));
    assertEquals(CrewSourceState.AVAILABLE, result.state());
    var departures=result.value().stream().filter(e -> e.type()==CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION).toList();
    assertEquals(1, departures.size()); // No count arithmetic, cargo event or splashdown departure.
    var e = departures.getFirst();
    assertEquals(CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION, e.type());
    assertEquals(CrewVerificationEvidence.Assertion.COMPLETED, e.assertion());
    assertEquals(
        List.of("Jessica Meir", "Jack Hathaway", "Sophie Adenot", "Andrey Fedyaev"),
        e.people().stream().map(PersonReference::displayName).toList());
    assertTrue(
        e.people().stream().allMatch(p -> p.mission1Id() == null && p.externalIds().isEmpty()));
    assertEquals(Instant.parse("2026-10-07T12:05:00Z"), e.observation().sourceEventAt());
    assertEquals(Instant.parse("2026-10-07T12:48:02Z"), e.observation().sourcePublishedAt());
    assertEquals(Instant.parse("2026-10-10T14:09:37.143134Z"), e.observation().retrievedAt());
    var time = CrewOperationalTime.read(e.evidenceMethod()).orElseThrow();
    assertEquals("MINUTE", time.precision());
    assertEquals("EDT", time.sourceZone());
    assertEquals("8:05 a.m.", time.sourceClock());
    assertEquals("America/New_York", time.zone());
    assertEquals("ARTICLE_DATE", time.dateBasis());
    assertEquals(e.observation().sourceEventAt(), time.instant());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "NASA astronaut Test Alpha",
        "NASA astronauts Test Alpha and Test Beta",
        "NASA astronauts Test Alpha, Test Beta and Test Gamma",
        "NASA astronauts Test Alpha, Test Beta, and Test Gamma",
        "NASA astronauts Test Alpha and Test Beta, ESA (European Space Agency) astronaut Test"
            + " Gamma, and Roscosmos cosmonaut Test Delta",
        "NASA astronauts Test J. Alpha and Test-Beta Gamma",
        "NASA astronauts Élodie O’Neill and Renée D'Arc"
      })
  void boundedPersonListVariants(String names) {
    var e = parse(sentence(names)).getFirst();
    assertEquals(CrewVerificationEvidence.Assertion.COMPLETED, e.assertion());
    assertFalse(e.people().isEmpty());
    assertTrue(e.people().size() <= 4);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "NASA astronauts Test Alpha and Test Beta will undock from the International Space"
            + " Station.",
        "NASA astronauts Test Alpha and Test Beta are scheduled to undock from the International"
            + " Space Station.",
        "NASA astronaut Test Alpha plans to return to Earth.",
        "NASA astronaut Test Alpha previously undocked from the International Space Station.",
        "NASA astronaut Test Alpha, after undocking last year, discussed the mission.",
        "In a biography, NASA astronaut Test Alpha undocked from the International Space Station in"
            + " 2020.",
        "NASA astronaut Test Alpha said: ‘We will undock tomorrow.’",
        "The crew departure has been delayed. NASA astronaut Test Alpha remains aboard.",
        "NASA astronaut Test Alpha returned to Earth after the mission.",
        "NASA astronaut Test Alpha docked with the International Space Station.",
        "NASA astronaut Test Alpha left the station airlock for a spacewalk.",
        "The cargo spacecraft undocked while NASA astronaut Test Alpha monitored the operation.",
        "The departure will leave seven residents aboard the orbital outpost."
      })
  void negativesNeverEmitCompletedDepartureOrCurrentCount(String text) {
    List<CrewVerificationEvidence> output;
    try {
      output = parse(text);
    } catch (IllegalArgumentException unsupported) {
      output = List.of();
    }
    assertTrue(
        output.stream()
            .noneMatch(
                e ->
                    e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION
                        || e.type() == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD));
  }

  @Test
  void futureTenseWithValidClockCannotMasqueradeAsCompleted() {
    for (String verb :
        List.of("will undock", "are scheduled to undock", "plan to leave", "will depart")) {
      var text = sentence("NASA astronauts Test Alpha and Test Beta").replace("undocked", verb);
      assertTrue(parse(text).isEmpty());
    }
  }

  @Test
  void paragraphScopeExcludesNearbyAstronautsCaptionsQuotesAndSplashdown() {
    String html =
        "<p>NASA astronaut Other Person is aboard the station.</p><figure><figcaption>"
            + sentence("NASA astronaut Caption Person")
            + "</figcaption></figure><blockquote><p>"
            + sentence("NASA astronaut Quoted Person")
            + "</p></blockquote><p>"
            + sentence("NASA astronaut Test Alpha")
            + "</p><p>NASA astronaut Other Person splashed down.</p>";
    var e = new NasaOperationalPostParser().parse("Crew undocks", html, source());
    assertEquals(1, e.size());
    assertEquals("Test Alpha", e.getFirst().people().getFirst().displayName());
  }

  @Test
  void htmlNormalizationAndInlineMarkupRetainList() {
    var e = parse(sentence("NASA astronauts <b>Test Alpha</b>\n and <a>Test Beta</a>"));
    assertEquals(
        List.of("Test Alpha", "Test Beta"),
        e.getFirst().people().stream().map(PersonReference::displayName).toList());
  }

  @Test
  void zoneConversionUsesDateRulesAndRejectsIncompatibleZone() {
    var winter =
        new NasaOperationalPostParser()
            .parse(
                "Crew undocks",
                "<p>" + sentence("NASA astronaut Test Alpha").replace("EDT", "EST") + "</p>",
                observation("2026/01/07", "2026-01-07T14:00:00Z"))
            .getFirst();
    assertEquals(Instant.parse("2026-01-07T13:05:00Z"), winter.observation().sourceEventAt());
    assertThrows(
        IllegalArgumentException.class,
        () -> parse(sentence("NASA astronaut Test Alpha").replace("EDT", "EST")));
  }

  @Test
  void springGapFailsAndExplicitFallAbbreviationDisambiguates() {
    var parser = new NasaOperationalPostParser();
    String text =
        sentence("NASA astronaut Test Alpha").replace("8:05", "2:30").replace("EDT", "EST");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parser.parse(
                "Crew undocks",
                "<p>" + text + "</p>",
                observation("2026/03/08", "2026-03-08T12:00:00Z")));
    for (String zone : List.of("EDT", "EST")) {
      var e =
          parser
              .parse(
                  "Crew undocks",
                  "<p>"
                      + sentence("NASA astronaut Test Alpha")
                          .replace("8:05", "1:30")
                          .replace("EDT", zone)
                      + "</p>",
                  observation("2026/11/01", "2026-11-01T12:00:00Z"))
              .getFirst();
      assertEquals(
          Instant.parse(zone.equals("EDT") ? "2026-11-01T05:30:00Z" : "2026-11-01T06:30:00Z"),
          e.observation().sourceEventAt());
    }
  }

  @Test
  void clockDoesNotOverrideHistoricalModalOrQuotedClause() {
    for (String modifier : List.of("previously", "formerly", "had", "will have", "never"))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              parse(
                  sentence("NASA astronaut Test Alpha")
                      .replace(" undocked", " " + modifier + " undocked")));
    var quoted =
        new NasaOperationalPostParser()
            .parse(
                "A quotation",
                "<p><q>" + sentence("NASA astronaut Test Alpha") + "</q></p>",
                source());
    assertTrue(quoted.isEmpty());
  }

  @Test
  void parserBoundaryHasNoCanonicalIdentityOrProviderLookupDependency() throws Exception {
    for (String file :
        List.of(
            "NasaOperationalPostParser.java",
            "NasaOperationalTimeParser.java",
            "NasaOperationalFeedParser.java")) {
      String code =
          java.nio.file.Files.readString(
              java.nio.file.Path.of("src/main/java/org/mission1/source/crew/nasa/" + file));
      for (String forbidden :
          List.of(
              "ReviewedCrew",
              "crew.automatic",
              "crew.persistence",
              "LaunchLibrary",
              "HttpClient",
              "Jessica Meir",
              "Fedyaev"))
        assertFalse(
            code.contains(forbidden),
            file + " crosses source interpretation boundary: " + forbidden);
    }
  }

  @Test
  void weekdayDateIsUniqueBoundedAndPublicationIsOnlyConsistencyCheck() {
    var e =
        new NasaOperationalPostParser()
            .parse(
                "Crew undocks",
                "<p>"
                    + sentence("NASA astronaut Test Alpha").replace("EDT,", "EDT on Wednesday,")
                    + "</p>",
                observation("2026/10/08", "2026-10-08T13:00:00Z"))
            .getFirst();
    assertEquals(Instant.parse("2026-10-07T12:05:00Z"), e.observation().sourceEventAt());
    assertEquals(
        "BOUNDED_WEEKDAY", CrewOperationalTime.read(e.evidenceMethod()).orElseThrow().dateBasis());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new NasaOperationalPostParser()
                .parse(
                    "Crew undocks",
                    "<p>" + sentence("NASA astronaut Test Alpha") + "</p>",
                    observation("2026/10/06", "2026-10-07T12:48:02Z")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new NasaOperationalPostParser()
                .parse(
                    "Crew undocks",
                    "<p>" + sentence("NASA astronaut Test Alpha") + "</p>",
                    observation("2026/10/07", "2026-10-07T11:00:00Z")));
  }

  @Test
  void unknownRelevantGrammarAndMissingDateFailClosed() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parse(
                sentence("NASA astronaut Test Alpha")
                    .replace("undocked", "unexpectedly transferred away")));
    var o =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            URI.create("https://www.nasa.gov/blogs/spacestation/undated/"),
            source().retrievedAt(),
            source().sourcePublishedAt(),
            null,
            null,
            null,
            "a".repeat(64),
            "TEST",
            "TEST");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new NasaOperationalPostParser()
                .parse("Crew undocks", "<p>" + sentence("NASA astronaut Test Alpha") + "</p>", o));
  }

  @Test
  void subjectDomSizeAndUnicodeBounds() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parse(
                sentence(
                    "NASA astronauts "
                        + String.join(", ", Collections.nCopies(31, "Test Alpha")))));
    assertThrows(IllegalArgumentException.class, () -> parse("x".repeat(2_097_153)));
    assertThrows(
        IllegalArgumentException.class, () -> parse(sentence("NASA astronaut Test \uFFFDAlpha")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parse(
                "<div>".repeat(101)
                    + sentence("NASA astronaut Test Alpha")
                    + "</div>".repeat(101)));
  }
}
