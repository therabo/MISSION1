package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.util.*;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.CrewEditorial.*;

public class NasaEditorialParserTest {
  public static final ObjectMapper JSON = JsonMapper.builder().findAndAddModules().build();
  private final NasaEditorialParser parser = new NasaEditorialParser(JSON);

  public static byte[] fixture(String stem) {
    try (var in =
        new GZIPInputStream(
            NasaEditorialParserTest.class.getResourceAsStream(
                "/fixtures/crew/nasa/editorial/" + stem + ".json.gz"))) {
      return in.readAllBytes();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static JsonNode current() {
    try {
      return JSON.readTree(fixture("topic-derived-active-slug")).get(0);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private JsonNode html(String html) {
    var n = JSON.createObjectNode();
    n.putObject("content").put("rendered", html);
    return n;
  }

  @Test
  void currentDualSectionsPreserveNamesRolesAgencyLinksAndScopedCaptions() {
    var r = parser.roster(current(), 75);
    assertEquals(7, r.members().size());
    assertEquals(
        List.of(
            "Pyotr Dubrov",
            "Anil Menon",
            "Anna Kikina",
            "Jessica Watkins",
            "Luke Delaney",
            "Joshua Kutryk",
            "Sergey Teteryatnikov"),
        r.members().stream().map(Member::name).toList());
    assertEquals("Commander", r.members().getFirst().role());
    assertEquals(List.of("ROLE_BETWEEN_SECTIONS"), r.members().getFirst().conflicts());
    assertEquals(List.of("AGENCY_CARD_CAPTION"), r.members().get(5).conflicts());
    assertEquals(
        3,
        r.members().stream()
            .flatMap(m -> m.links().stream())
            .filter(l -> l.url().contains("/humans-in-space/astronauts/"))
            .count());
    assertEquals(
        4,
        r.members().stream()
            .flatMap(m -> m.mentions().stream())
            .filter(m -> m.captionKind() == CaptionKind.PERSONAL_FLIGHT_CAPTION)
            .count());
    assertTrue(r.members().stream().allMatch(m -> m.mentions().size() == 2));
  }

  @ParameterizedTest
  @ValueSource(
      ints = {
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
        72, 73, 74, 75
      })
  void all75SourceShapesAlsoWorkWithoutCss(int number) throws Exception {
    var n = JSON.readTree(fixture("expedition-roster-sections")).get(number - 1);
    var a = parser.roster(n, number);
    var b = n.deepCopy();
    ((ObjectNode) b.path("content"))
        .put(
            "rendered",
            n.path("content").path("rendered").asText().replaceAll("(?i)\\sclass=\"[^\"]*\"", ""));
    assertEquals(a, parser.roster(b, number));
    assertFalse(a.members().isEmpty());
  }

  @Test
  void topicFactsAreIndependentAndRetainSourceText() {
    var n = parser.json(fixture("iss-topic"));
    var r = parser.resource(n, Kind.NASA_TOPIC);
    var facts = parser.topic(n, r, NasaEditorialParser.TOPIC);
    assertEquals(75, facts.expedition().value());
    assertEquals(7, facts.aboardCount().value());
    assertTrue(facts.aboardCount().text().contains("Crew Members Aboard"));
    var changed = n.deepCopy();
    ((ObjectNode) changed.path("content"))
        .put(
            "rendered",
            "<div>75<h4>Expedition</h4></div><div>seven<h4>Crew Members Aboard</h4></div>");
    var bad = parser.topic(changed, r, NasaEditorialParser.TOPIC);
    assertEquals(75, bad.expedition().value());
    assertNull(bad.aboardCount().value());
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "seven", "-1", "101", "7.0"})
  void malformedCountsFailClosedIndependently(String count) {
    var n = parser.json(fixture("iss-topic"));
    var r = parser.resource(n, Kind.NASA_TOPIC);
    ((ObjectNode) n.path("content"))
        .put(
            "rendered",
            "<div>75<h4>Expedition</h4></div><div>" + count + "<h4>Crew Members Aboard</h4></div>");
    var f = parser.topic(n, r, NasaEditorialParser.TOPIC);
    assertEquals(75, f.expedition().value());
    assertNull(f.aboardCount().value());
  }

  @Test
  void duplicateConflictingCountsAndExpeditionOutOfBounds() {
    var n = parser.json(fixture("iss-topic"));
    var r = parser.resource(n, Kind.NASA_TOPIC);
    ((ObjectNode) n.path("content"))
        .put(
            "rendered",
            "<div>0<h4>Expedition</h4></div><div>7<h4>Crew Members Aboard</h4></div><div>8<h4>Crew"
                + " Members Aboard</h4></div>");
    var f = parser.topic(n, r, NasaEditorialParser.TOPIC);
    assertNull(f.expedition().value());
    assertNull(f.aboardCount().value());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "<h2>Unknown</h2><p>A Test, Commander</p>",
        "<h2>Crew</h2><p>A Test, Commander<br>A Test, Flight Engineer</p>",
        "<h2>Crew</h2><p><a href='x'>A Test</a>, Commander<br><a href='y'>A Test</a>,"
            + " Commander</p>",
        "<h2>Crew</h2><p>A Test, Engineer</p>",
        "<h2>Crew</h2><p></p>"
      })
  void unknownEmptyAndDuplicateSectionsRejected(String html) {
    assertThrows(IllegalArgumentException.class, () -> parser.roster(html(html), 75));
  }

  @Test
  void unknownCardsNeverSilentlyFallbackAndConflictingSectionsFail() {
    var n = current().deepCopy();
    ((ObjectNode) n.path("content"))
        .put(
            "rendered",
            n.path("content")
                .path("rendered")
                .asText()
                .replace("At the Station", "Some other cards"));
    final var unknown = n;
    assertThrows(IllegalArgumentException.class, () -> parser.roster(unknown, 75));
    n = current().deepCopy();
    ((ObjectNode) n.path("content"))
        .put(
            "rendered",
            n.path("content")
                .path("rendered")
                .asText()
                .replace("Pyotr Dubrov, Commander", "SYNTHETIC Person, Commander"));
    final var mismatch = n;
    assertThrows(IllegalArgumentException.class, () -> parser.roster(mismatch, 75));
  }

  @Test
  void malformedRecoverableHtmlLegacyPdfAgencyAndUnlinkedNames() {
    var r =
        parser.roster(
            html(
                "<h2>Crew</h2><p><a href='https://www.nasa.gov/test.pdf'>A Test</a>,"
                    + " Commander<br><a href='https://www.esa.int/test'>B Test</a>, Flight"
                    + " Engineer<br>C Test, Flight Engineer"),
            8);
    assertEquals(3, r.members().size());
    assertEquals(2, r.members().stream().flatMap(m -> m.links().stream()).count());
  }

  @Test
  void allThreeAboutResourcesAreVerifiedAndWrongPersonRejected() {
    for (var pair :
        List.of(
            new String[] {"luke", "Luke Delaney"},
            new String[] {"watkins", "Jessica Watkins"},
            new String[] {"menon", "Anil Menon"})) {
      var topic = parser.json(fixture("topic-" + pair[0]));
      assertTrue(parser.about(parser.resource(topic, Kind.NASA_TOPIC), pair[1]));
      assertNotNull(parser.biography(topic));
      var people =
          parser.resource(parser.json(fixture("people-" + pair[0])), Kind.NASA_PEOPLE_RESOURCE);
      assertTrue(parser.about(people, pair[1]));
      assertFalse(parser.about(people, "Sophie Adenot"));
    }
  }

  @Test
  void actualExpedition74SophieLinkPointsToHathawayAndCannotBecomeAboutSophie() throws Exception {
    var page = JSON.readTree(fixture("expedition-roster-sections")).get(73);
    var sophie =
        parser.roster(page, 74).members().stream()
            .filter(m -> m.name().equals("Sophie Adenot"))
            .findFirst()
            .orElseThrow();
    assertTrue(sophie.links().stream().anyMatch(l -> l.url().contains("jack-hathaway")));
    var target =
        parser.resource(parser.json(fixture("people-hathaway")), Kind.NASA_PEOPLE_RESOURCE);
    assertTrue(parser.about(target, "Jack Hathaway"));
    assertFalse(parser.about(target, sophie.name()));
    assertThrows(
        IllegalArgumentException.class,
        () -> parser.resource(current(), Kind.NASA_PEOPLE_RESOURCE));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "http://www.nasa.gov/",
        "https://localhost/",
        "https://127.0.0.1/",
        "https://www.nasa.gov.evil.test/",
        "https://a:b@www.nasa.gov/",
        "https://www.nasa.gov:8443/",
        "https://www.nasa.gov/%2e%2e/"
      })
  void unsafeUrlsRejected(String value) {
    assertThrows(IllegalArgumentException.class, () -> NasaEditorialParser.nasaUrl(value));
  }

  @Test
  void unicodeDomAndResourceBounds() {
    assertThrows(
        IllegalArgumentException.class, () -> NasaEditorialParser.utf8(new byte[] {(byte) 0xff}));
    assertThrows(
        IllegalArgumentException.class,
        () -> NasaEditorialParser.dom("<div>".repeat(110) + "</div>".repeat(110)));
    assertThrows(
        IllegalArgumentException.class, () -> NasaEditorialParser.normalize("A\u0000Test"));
    assertEquals("É Test", NasaEditorialParser.normalize("E\u0301  Test"));
  }

  @Test
  void advertisedTypeCanonicalAndSemanticIdentityFailClosed() {
    String html =
        "<link rel='canonical' href='"
            + NasaEditorialParser.TOPIC
            + "'><link rel='alternate' href='"
            + NasaEditorialParser.API
            + "topic/123'><h1>Station Research News</h1>";
    assertEquals(
        URI.create(NasaEditorialParser.API + "topic/123"),
        parser.advertised(html.getBytes(), NasaEditorialParser.TOPIC, "topic"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parser.advertised(
                html.replace("topic/123", "people/123").getBytes(),
                NasaEditorialParser.TOPIC,
                "topic"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            parser.advertised(
                html.replace("Station Research News", "Wrong").getBytes(),
                NasaEditorialParser.TOPIC,
                "topic"));
  }
}
