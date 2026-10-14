package org.mission1.crew.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.source.crew.nasa.NasaEditorialParserTest.*;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.CrewEditorial.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest(properties = {"mission1.crew.editorial.enabled=false"})
@Testcontainers
class JdbcCrewEditorialRepositoryTest {
  @Container
  static final PostgreSQLContainer<?> PG =
      new PostgreSQLContainer<>("postgres:16.10")
          .withDatabaseName("editorial_test")
          .withUsername("test")
          .withPassword("test_only");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  @Autowired CrewEditorialRepository repository;
  @Autowired JdbcTemplate jdbc;
  final NasaEditorialParser parser = new NasaEditorialParser(JSON);
  final Instant t = Instant.parse("2026-10-10T12:00:00Z");

  @BeforeEach
  void clean() {
    jdbc.execute("TRUNCATE crew_document_body,crew_resource RESTART IDENTITY CASCADE");
    jdbc.update("UPDATE crew_resource_refresh_lease SET next_eligible_at='1970-01-01T00:00:00Z'");
    jdbc.update(
        "UPDATE crew_nasa_request_budget SET"
            + " next_request_at='1970-01-01T00:00:00Z',cooldown_until='1970-01-01T00:00:00Z'");
  }

  Capture capture(Stream s, String url, byte[] body, Instant at) {
    return new Capture(
        s,
        URI.create(url),
        URI.create(url),
        List.of(),
        at,
        at,
        200,
        Map.of("Content-Type", List.of("application/json")),
        body,
        null);
  }

  StoredCapture roster(Instant at, String body) {
    var n = parser.json(body.getBytes());
    return repository.retain(
        capture(
            Stream.NASA_EDITORIAL_EXPEDITION,
            NasaEditorialParser.API + "mission/748853",
            body.getBytes(),
            at),
        parser.resource(n, Kind.NASA_MISSION),
        parser.roster(n, 75),
        null,
        Outcome.DEGRADED,
        "FIELD_CONFLICT");
  }

  int count(String table) {
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
  }



  @Test
  void sameBodyNoiseAndModifiedChangesReuseSemanticContentButKeepEveryCapture() {
    var n = current();
    var a = roster(t, n.toString());
    var same = roster(t.plusSeconds(1), n.toString());
    assertEquals(a.rosterId(), same.rosterId());
    var noisy = n.deepCopy();
    ((ObjectNode) noisy.path("content"))
        .put(
            "rendered",
            "<!--unrelated editorial noise-->" + n.path("content").path("rendered").asText());
    ((ObjectNode) noisy).put("modified_gmt", "2026-10-10T12:00:02");
    var changed = roster(t.plusSeconds(2), noisy.toString());
    assertEquals(a.rosterId(), changed.rosterId());
    assertEquals(3, count("crew_resource_acquisition"));
    assertEquals(1, count("crew_resource_roster_version"));
    assertEquals(7, count("crew_resource_roster_member"));
    assertEquals(2, count("crew_source_document"));
    assertEquals(
        t.plusSeconds(2), repository.latestRoster(t.plusSeconds(3)).orElseThrow().capturedAt());
    assertEquals(0, count("crew_source_sync_run"));
    assertEquals(0, count("crew_identity_resolution"));
  }

  @Test
  void aToBToAWithFailureAndNewRepositoryRestartSelectsNewestCapture() {
    var n = current();
    var a = roster(t, n.toString());
    var b = n.deepCopy();
    ((ObjectNode) b.path("content"))
        .put(
            "rendered",
            n.path("content")
                .path("rendered")
                .asText()
                .replace("Luke Delaney", "SYNTHETIC TEST Person"));
    var changed = roster(t.plusSeconds(1), b.toString());
    assertNotEquals(a.rosterId(), changed.rosterId());
    repository.retain(
        capture(
            Stream.NASA_EDITORIAL_EXPEDITION,
            NasaEditorialParser.API + "mission/748853",
            "bad".getBytes(),
            t.plusSeconds(2)),
        null,
        null,
        null,
        Outcome.FAILURE,
        "UNKNOWN_MARKUP");
    assertEquals(changed.rosterId(), repository.latestRoster(t.plusSeconds(3)).orElseThrow().id());
    var again = roster(t.plusSeconds(4), n.toString());
    assertEquals(a.rosterId(), again.rosterId());
    var restarted = new JdbcCrewEditorialRepository(jdbc, JSON);
    var latest = restarted.latestRoster(t.plusSeconds(5)).orElseThrow();
    assertEquals(a.rosterId(), latest.id());
    assertEquals(again.id(), latest.acquisitionId());
    assertEquals(2, count("crew_resource_roster_version"));
    assertEquals(changed.rosterId(), restarted.latestRoster(t.plusSeconds(2)).orElseThrow().id());
    assertTrue(restarted.latestRoster(t.minusSeconds(1)).isEmpty());
  }

  @Test
  void changedTopicCountAndAcquisitionConsistencyDoNotDuplicateMissionRosterMeaning() {
    var n = current();
    var resource = parser.resource(n, Kind.NASA_MISSION);
    var parsed = parser.roster(n, 75);
    var first =
        repository.retain(
            capture(
                Stream.NASA_EDITORIAL_EXPEDITION,
                NasaEditorialParser.API + "mission/748853",
                n.toString().getBytes(),
                t),
            resource,
            parsed,
            null,
            Outcome.DEGRADED,
            "VALID_ROSTER_WITH_ATTRIBUTED_CONFLICTS");
    var second =
        repository.retain(
            capture(
                Stream.NASA_EDITORIAL_EXPEDITION,
                NasaEditorialParser.API + "mission/748853",
                n.toString().getBytes(),
                t.plusSeconds(1)),
            resource,
            parsed,
            null,
            Outcome.DEGRADED,
            "TOPIC_COUNT_ROSTER_MISMATCH:reported=8,roster=7");
    assertEquals(first.rosterId(), second.rosterId());
    assertEquals(1, count("crew_resource_roster_version"));
    assertEquals(2, count("crew_resource_acquisition"));
    assertTrue(
        repository
            .latest(Stream.NASA_EDITORIAL_EXPEDITION, second.capture().requestedUrl(), false)
            .orElseThrow()
            .reason()
            .startsWith("TOPIC_COUNT_ROSTER_MISMATCH"));
  }

  @Test
  void countAndExpeditionAreSeparateTypedFactsAndNoiseKeepsMeaning() {
    var n = parser.json(fixture("iss-topic"));
    var r = parser.resource(n, Kind.NASA_TOPIC);
    var facts = parser.topic(n, r, NasaEditorialParser.TOPIC);
    for (int i = 0; i < 2; i++)
      repository.retain(
          capture(
              Stream.NASA_EDITORIAL_TOPIC,
              NasaEditorialParser.API + "topic/" + r.wpId(),
              n.toString().getBytes(),
              t.plusSeconds(i)),
          r,
          null,
          facts,
          Outcome.SUCCESS,
          "VALID_FACTS");
    assertEquals(2, count("crew_resource_topic_fact"));
    assertEquals(4, count("crew_resource_fact_capture"));
    var changed = n.deepCopy();
    ((ObjectNode) changed.path("content"))
        .put(
            "rendered", "<div>75<h4>Expedition</h4></div><div>8<h4>Crew Members Aboard</h4></div>");
    repository.retain(
        capture(
            Stream.NASA_EDITORIAL_TOPIC,
            NasaEditorialParser.API + "topic/" + r.wpId(),
            changed.toString().getBytes(),
            t.plusSeconds(2)),
        r,
        null,
        parser.topic(changed, r, NasaEditorialParser.TOPIC),
        Outcome.SUCCESS,
        "VALID_FACTS");
    assertEquals(3, count("crew_resource_topic_fact"));
    assertEquals(6, count("crew_resource_fact_capture"));
  }

  @Test
  void streamsAndResourceHealthAreIndependentAndFailuresPreserveGoodAt() {
    roster(t, current().toString());
    for (var s : List.of(Stream.NASA_EDITORIAL_TOPIC, Stream.NASA_PERSON_RESOURCE))
      repository.retain(
          capture(s, NasaEditorialParser.API + s, "error".getBytes(), t.plusSeconds(1)),
          null,
          null,
          null,
          Outcome.FAILURE,
          "HTTP_404");
    var h = repository.health();
    assertEquals(3, h.size());
    assertEquals(
        Outcome.DEGRADED,
        h.stream()
            .filter(x -> x.stream() == Stream.NASA_EDITORIAL_EXPEDITION)
            .findFirst()
            .orElseThrow()
            .outcome());
    assertEquals(2, h.stream().filter(x -> x.lastGoodAt() == null).count());
    assertEquals(0, count("crew_source_sync_run"));
    assertTrue(repository.latestRoster(t.plusSeconds(2)).isPresent());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "crew_resource_acquisition",
        "crew_resource",
        "crew_resource_roster_version",
        "crew_resource_roster_member",
        "crew_resource_topic_fact",
        "crew_resource_fact_capture",
        "crew_resource_relation"
      })
  void immutableRowsCannotBeUpdatedOrDeleted(String table) {
    var c = roster(t, current().toString());
    var topic = parser.json(fixture("iss-topic"));
    var r = parser.resource(topic, Kind.NASA_TOPIC);
    repository.retain(
        capture(
            Stream.NASA_EDITORIAL_TOPIC,
            NasaEditorialParser.API + "topic/" + r.wpId(),
            fixture("iss-topic"),
            t),
        r,
        null,
        parser.topic(topic, r, NasaEditorialParser.TOPIC),
        Outcome.SUCCESS,
        "OK");
    repository.retainRelation(
        new Relation(
            c.rosterId(),
            0,
            "Pyotr Dubrov",
            "https://www.nasa.gov/press-release/",
            "card",
            RelationStatus.OBSERVED_LINK,
            null,
            null,
            "ANCHOR_ONLY"));
    assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("DELETE FROM " + table));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE "
                    + table
                    + " SET "
                    + (table.equals("crew_resource_roster_member")
                        ? "member_index=member_index"
                        : table.equals("crew_resource_fact_capture")
                            ? "fact_id=fact_id"
                            : "id=id")));
  }

  @Test
  void parentTypingAndBoundsEnforced() {
    var a = roster(t, current().toString());
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO crew_resource(resource_kind,wp_id) VALUES ('PERSON',123)"));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "INSERT INTO"
                    + " crew_resource_roster_member(roster_id,member_index,display_name,role_text,mentions,conflicts,semantic_hash)"
                    + " VALUES (?,30,'TEST','TEST','[]','[]',?)",
                a.rosterId(),
                "a".repeat(64)));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            repository.retainRelation(
                new Relation(
                    a.rosterId(),
                    29,
                    "NO_PARENT",
                    "https://www.nasa.gov/",
                    "x",
                    RelationStatus.OBSERVED_LINK,
                    null,
                    null,
                    "TEST")));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            repository.retainRelation(
                new Relation(
                    a.rosterId(),
                    0,
                    "Pyotr Dubrov",
                    "https://www.nasa.gov/",
                    "x",
                    RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
                    null,
                    null,
                    "TEST")));
  }

  @Test
  void durableSchedulerRestartAndSharedPacingCooldown() {
    assertTrue(repository.claimRefresh(t, Duration.ofHours(2)));
    assertFalse(
        new JdbcCrewEditorialRepository(jdbc, JSON)
            .claimRefresh(t.plusSeconds(60), Duration.ofHours(2)));
    assertTrue(repository.claimRefresh(t.plusSeconds(7200), Duration.ofHours(2)));
    assertEquals(t, repository.reserveNasaRequest(t));
    assertEquals(t.plusSeconds(1), repository.reserveNasaRequest(t));
    repository.nasaCooldown(t.plusSeconds(60));
    assertEquals(t.plusSeconds(60), repository.reserveNasaRequest(t));
  }
}
