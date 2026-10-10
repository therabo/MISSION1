package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.source.crew.nasa.NasaEditorialParserTest.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial.*;

class NasaEditorialSourceTest {
  final NasaEditorialParser parser = new NasaEditorialParser(JSON);
  final Instant now = Instant.parse("2026-10-10T12:00:00Z");
  final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
  CrewEditorialRepository repository;
  Map<String, byte[]> bodies;
  List<StoredCapture> captures;
  List<Relation> relations;
  NasaEditorialSource source;
  StoredRoster roster;
  int httpCalls;
  String exact;

  @BeforeEach
  void setup() throws Exception {
    repository = mock(CrewEditorialRepository.class);
    bodies = new HashMap<>();
    captures = new ArrayList<>();
    relations = new ArrayList<>();
    httpCalls = 0;
    var topic = parser.resource(parser.json(fixture("iss-topic")), Kind.NASA_TOPIC);
    bodies.put(NasaEditorialParser.TOPIC.toString(), html(topic));
    bodies.put(NasaEditorialParser.API + "topic/" + topic.wpId(), fixture("iss-topic"));
    bodies.put(
        NasaEditorialParser.API + "mission-status?slug=active&per_page=100",
        fixture("active-taxonomy-slug"));
    bodies.put(
        NasaEditorialParser.API + "mission-target?slug=international-space-station&per_page=100",
        fixture("target-slug"));
    String filters = "mission-status=10828&mission-target=11040";
    exact = NasaEditorialParser.API + "mission?slug=expedition-75&" + filters + "&per_page=100";
    bodies.put(exact, fixture("topic-derived-active-slug"));
    bodies.put(
        NasaEditorialParser.API + "mission?" + filters + "&search=Expedition&per_page=100",
        fixture("topic-derived-active-slug"));
    for (String s : List.of("luke", "menon", "watkins")) {
      var topicNode = parser.json(fixture("topic-" + s));
      var t = parser.resource(topicNode, Kind.NASA_TOPIC);
      var p = parser.resource(parser.json(fixture("people-" + s)), Kind.NASA_PEOPLE_RESOURCE);
      bodies.put(t.canonicalUrl().toString(), html(t));
      bodies.put(NasaEditorialParser.API + "topic/" + t.wpId(), fixture("topic-" + s));
      var bio = parser.biography(topicNode);
      bodies.put(bio.toString(), html(p));
      bodies.put(NasaEditorialParser.API + "people/" + p.wpId(), fixture("people-" + s));
    }
    when(repository.latest(any(), any(), anyBoolean()))
        .thenAnswer(
            a ->
                captures.stream()
                    .filter(
                        c ->
                            c.capture().stream() == a.getArgument(0)
                                && c.capture().requestedUrl().equals(a.getArgument(1))
                                && (!(boolean) a.getArgument(2) || c.outcome() != Outcome.FAILURE))
                    .reduce((x, y) -> y));
    when(repository.retain(
            any(),
            nullable(Resource.class),
            nullable(Roster.class),
            nullable(TopicFacts.class),
            any(),
            anyString()))
        .thenAnswer(
            a -> {
              Capture c = a.getArgument(0);
              Resource r = a.getArgument(1);
              Roster rr = a.getArgument(2);
              var stored =
                  new StoredCapture(
                      captures.size() + 1L,
                      rr == null ? null : 1L,
                      c,
                      r,
                      a.getArgument(4),
                      a.getArgument(5));
              captures.add(stored);
              if (rr != null)
                roster = new StoredRoster(1, stored.id(), c.completedAt(), r, rr, relations);
              return stored;
            });
    when(repository.latestRoster(any())).thenAnswer(a -> Optional.ofNullable(roster));
    doAnswer(
            a -> {
              relations.add(a.getArgument(0));
              return null;
            })
        .when(repository)
        .retainRelation(any());
    source =
        new NasaEditorialSource(
            (stream, url, cached) -> {
              httpCalls++;
              byte[] body = bodies.get(url.toString());
              // Test HTTP redirects represented explicitly; production validates every hop.
              URI finalUrl = url;
              if (url.getPath().contains("jessica-watkins-ph-d"))
                finalUrl = URI.create("https://www.nasa.gov/people/jessica-watkins/");
              return new Capture(
                  stream,
                  url,
                  finalUrl,
                  finalUrl.equals(url) ? List.of() : List.of(finalUrl.toString()),
                  now,
                  now,
                  body == null ? 404 : 200,
                  Map.of(
                      "Content-Type",
                      List.of(
                          url.getPath().startsWith("/wp-json/") ? "application/json" : "text/html"),
                      "X-WP-Total",
                      List.of("1"),
                      "X-WP-TotalPages",
                      List.of("1")),
                  body == null ? "NOT FOUND".getBytes() : body,
                  null);
            },
            repository,
            parser,
            clock,
            NasaEditorialParser.TOPIC);
  }

  byte[] html(Resource r) {
    String route =
        switch (r.kind()) {
          case NASA_TOPIC -> "topic";
          case NASA_PEOPLE_RESOURCE -> "people";
          default -> "mission";
        };
    return ("<link rel='canonical' href='"
            + r.canonicalUrl()
            + "'><link rel='alternate' href='"
            + NasaEditorialParser.API
            + route
            + "/"
            + r.wpId()
            + "'><h1>"
            + (r.canonicalUrl().equals(NasaEditorialParser.TOPIC)
                ? "Station Research News"
                : r.title())
            + "</h1>")
        .getBytes();
  }

  @Test
  void realSourceFixturesCold18RequestsThenRoutine2AndNoIdentityWriter() {
    var first = source.acquire();
    assertEquals(75, first.expedition());
    assertEquals(7, first.websiteCount());
    assertEquals(7, first.members());
    assertEquals(18, first.requests());
    assertEquals(
        6,
        relations.stream()
            .filter(r -> r.status() == RelationStatus.VERIFIED_ABOUT_PERSON_RELATION)
            .count());
    var second = source.acquire();
    assertEquals(2, second.requests());
    assertEquals(20, httpCalls);
    assertTrue(captures.stream().noneMatch(c -> c.capture().stream() == null));
  }

  @ParameterizedTest
  @ValueSource(strings = {"empty", "two", "status", "target", "number", "title", "slug", "type"})
  void exactDiscoveryAlwaysFailsClosed(String error) throws Exception {
    var n = current().deepCopy();
    var array = JSON.createArrayNode();
    switch (error) {
      case "empty" -> {}
      case "two" -> {
        array.add(n);
        array.add(n.deepCopy());
      }
      default -> {
        switch (error) {
          case "status" -> ((ObjectNode) n).set("mission-status", JSON.createArrayNode().add(999));
          case "target" -> ((ObjectNode) n).set("mission-target", JSON.createArrayNode().add(999));
          case "number" -> ((ObjectNode) n).put("slug", "expedition-76");
          case "title" -> ((ObjectNode) n.path("title")).put("rendered", "Expedition 76");
          case "slug" -> ((ObjectNode) n).put("slug", "unrelated");
          case "type" -> ((ObjectNode) n).put("type", "people");
        }
        array.add(n);
      }
    }
    bodies.put(exact, array.toString().getBytes());
    var result = source.acquire();
    assertNull(result.rosterId());
    assertNull(roster);
    assertTrue(result.outcome().startsWith("FAILURE"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"empty", "ambiguous", "name", "type"})
  void taxonomyEmptyAmbiguousOrMalformedBlocksMission(String error) throws Exception {
    var url = NasaEditorialParser.API + "mission-status?slug=active&per_page=100";
    var n = JSON.readTree(bodies.get(url));
    if (error.equals("empty")) n = JSON.createArrayNode();
    else if (error.equals("ambiguous")) ((ArrayNode) n).add(n.get(0).deepCopy());
    else ((ObjectNode) n.get(0)).put(error.equals("type") ? "taxonomy" : "name", "wrong");
    bodies.put(url, n.toString().getBytes());
    assertNull(source.acquire().rosterId());
    assertFalse(
        captures.stream().anyMatch(c -> c.capture().requestedUrl().toString().equals(exact)));
  }

  @Test
  void changedTaxonomyIdsAreDiscoveredWithoutConstants() throws Exception {
    for (var pair :
        List.of(
            new String[] {"mission-status?slug=active&per_page=100", "123"},
            new String[] {"mission-target?slug=international-space-station&per_page=100", "456"})) {
      String url = NasaEditorialParser.API + pair[0];
      var n = JSON.readTree(bodies.get(url));
      ((ObjectNode) n.get(0)).put("id", Integer.parseInt(pair[1]));
      bodies.put(url, n.toString().getBytes());
    }
    var n = current().deepCopy();
    ((ObjectNode) n).set("mission-status", JSON.createArrayNode().add(123));
    ((ObjectNode) n).set("mission-target", JSON.createArrayNode().add(456));
    String filters = "mission-status=123&mission-target=456";
    for (String url :
        List.of(
            NasaEditorialParser.API + "mission?slug=expedition-75&" + filters + "&per_page=100",
            NasaEditorialParser.API + "mission?" + filters + "&search=Expedition&per_page=100"))
      bodies.put(url, ("[" + n + "]").getBytes());
    assertEquals(7, source.acquire().members());
  }

  @Test
  void malformedCountDoesNotBlockRosterAndCountMismatchIsRetained() throws Exception {
    var key = NasaEditorialParser.API + "topic/196922";
    var n = JSON.readTree(bodies.get(key));
    ((ObjectNode) n.path("content"))
        .put(
            "rendered",
            "<div>75<h4>Expedition</h4></div><div>bad<h4>Crew Members Aboard</h4></div>");
    bodies.put(key, n.toString().getBytes());
    var result = source.acquire();
    assertEquals(7, result.members());
    assertNull(result.websiteCount());
    ((ObjectNode) n.path("content"))
        .put(
            "rendered", "<div>75<h4>Expedition</h4></div><div>8<h4>Crew Members Aboard</h4></div>");
    bodies.put(key, n.toString().getBytes());
    assertEquals(8, source.acquire().websiteCount());
    assertTrue(
        captures.stream().anyMatch(c -> c.reason().startsWith("TOPIC_COUNT_ROSTER_MISMATCH")));
    assertFalse(
        roster.roster().conflicts().stream()
            .anyMatch(c -> c.startsWith("TOPIC_COUNT_ROSTER_MISMATCH")));
  }

  @Test
  void profile404AndWrongPersonNeverRemoveMemberOrFailMission() throws Exception {
    var target = NasaEditorialParser.API + "topic/619970";
    var n = parser.json(fixture("topic-luke"));
    ((ObjectNode) n.path("title")).put("rendered", "NASA Astronaut: Jack Hathaway");
    bodies.put(target, n.toString().getBytes());
    bodies.remove(NasaEditorialParser.API + "people/40775");
    assertEquals(7, source.acquire().members());
    assertTrue(
        relations.stream()
            .anyMatch(
                r ->
                    r.subjectName().equals("Luke Delaney")
                        && r.status() == RelationStatus.REJECTED_MISMATCH));
    assertTrue(
        captures.stream()
            .anyMatch(
                c ->
                    c.capture().stream() == Stream.NASA_PERSON_RESOURCE
                        && c.outcome() == Outcome.FAILURE));
    assertTrue(
        captures.stream().anyMatch(c -> c.rosterId() != null && c.outcome() != Outcome.FAILURE));
  }

  @Test
  void failedCapturePreservesRosterAndOperationalStateIsNeverTouched() {
    var good = source.acquire();
    bodies.put(exact, "[]".getBytes());
    assertNull(source.acquire().rosterId());
    assertEquals(good.rosterId(), roster.id());
    verify(repository, never()).nasaCooldown(any());
  }
}
