package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.*;
import org.mission1.crew.research.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/**
 * TEST_ONLY transport and qualified identity evidence; production ingestion, jobs, V10 and HTTP.
 */
@SpringBootTest(properties={"mission1.crew.operational-binding.mode=LEGACY_OPERATIONAL_BINDING", "mission1.replay.crew.mode=LEGACY"})
@AutoConfigureMockMvc
@Testcontainers
@Import(CrewTurnoverPostgresTest.TimeConfiguration.class)
class CrewTurnoverPostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  static class TestClock extends Clock {
    Instant now;

    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    public Clock withZone(ZoneId z) {
      return this;
    }

    public Instant instant() {
      return now;
    }
  }

  @TestConfiguration
  static class TimeConfiguration {
    @Bean
    @Primary
    TestClock scenarioClock() {
      return new TestClock();
    }
  }

  @Autowired TestClock clock;
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper json;
  @Autowired CrewRepository runs;
  @Autowired CrewVerificationRepository verification;
  @Autowired CrewReconciliationService reconciliation;
  @Autowired IdentityResearchStore auto;
  @Autowired IdentityResearchWorker worker;

  @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
  RetainedIdentityEvidence loader;

  @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
  final Map<String, IdentityEvidence> qualifiedFacts = new HashMap<>();
  @Autowired ActiveMembershipStore store;
  @Autowired ActiveMembershipPolicy policy;
  @Autowired MockMvc http;
  @Autowired CrewEditorialRepository editorial;
  @Autowired NasaEditorialParser editorialParser;
  ActiveMembershipPostgresTest fixture;
  Integer baselineBindings;
  final List<String> original = List.of("650", "713", "649", "582", "710", "642", "915");
  final List<String> incoming = List.of("573", "712", "747", "732");
  final List<String> outgoing = original.subList(0, 4);

  List<String> eleven() {
    var r = new ArrayList<>(original);
    r.addAll(incoming);
    return r;
  }

  @BeforeEach
  void clean() {
    fixture = new ActiveMembershipPostgresTest();
    fixture.jdbc = jdbc;
    fixture.json = json;
    fixture.store = store;
    fixture.editorial = editorial;
    fixture.parser = editorialParser;
    fixture.auto = auto;
    fixture.worker = worker;
    fixture.clean();
    baselineBindings = null;
    qualifiedFacts.clear();
    org.mockito.Mockito.doAnswer(
            inv -> {
              var batch = (RetainedIdentityEvidence.Batch) inv.callRealMethod();
              return new RetainedIdentityEvidence.Batch(
                  batch.evidence().stream()
                      .map(e -> qualifiedFacts.getOrDefault(e.key(), e))
                      .toList(),
                  batch.queries());
            })
        .when(loader)
        .load(org.mockito.ArgumentMatchers.any(Instant.class));
    clock.now = Instant.now().plusSeconds(2).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
  }

  void advance(Duration d) {
    clock.now = clock.now.plus(d);
  }

  String name(String id) throws Exception {
    return fixture.records().path("ll2:" + id).path("name").asText();
  }

  void ll2(List<String> ids) throws Exception {
    var o =
        new CrewSourceObservation(
            CrewSource.LAUNCH_LIBRARY_2,
            URI.create("https://example.test/TEST_ONLY/ll2"),
            clock.now,
            null,
            null,
            null,
            null,
            CrewHttpReader.sha256((ids + clock.now.toString()).getBytes()),
            "TEST_ONLY",
            "TEST_ONLY");
    var ex = new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "test-expedition");
    var people = new ArrayList<AstronautProfile>();
    var assignments = new ArrayList<CrewAssignment>();
    for (String id : ids) {
      var p =
          new PersonReference(
              null, name(id), List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, id)), null);
      people.add(
          new AstronautProfile(
              p,
              null,
              List.of(),
              fixture.records().path("ll2:" + id).path("bio").asText(),
              null,
              null,
              null,
              o));
      assignments.add(
          new CrewAssignment(
              new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "assignment-" + id),
              ex,
              p,
              CrewRole.FLIGHT_ENGINEER,
              "Flight Engineer",
              null,
              null,
              o));
    }
    var snapshot =
        new CrewSourceSnapshot(
            Station.ISS,
            1,
            true,
            List.of(new Expedition(null, ex, "TEST_ONLY Expedition", null, null, Station.ISS, o)),
            assignments,
            people,
            o,
            "4");
    var service =
        new CrewIngestionService(
            s -> new CrewSourceResult<>(CrewSourceState.AVAILABLE, snapshot, o, null, 200),
            runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
            clock,
            o.sourceUrl());
    assertEquals(CrewSyncRun.Outcome.SUCCESS, service.ingest().outcome());
  }

  void operational(List<String> ids, String type, boolean qualified) throws Exception {
    String people =
        "NASA astronauts "
            + String.join(
                " and ",
                ids.stream()
                    .map(
                        id -> {
                          try {
                            return name(id);
                          } catch (Exception e) {
                            throw new RuntimeException(e);
                          }
                        })
                    .toList());
    String clause =
        switch (type) {
          case "arrival" -> " have entered the International Space Station.";
          case "departure" -> " have departed the International Space Station.";
          default -> " worked aboard the International Space Station.";
        };
    String raw =
        "<rss xmlns:content='http://purl.org/rss/1.0/modules/content/'><channel><title>International"
            + " Space Station - NASA</title><item><title>TEST_ONLY Station activities</title>"
            + "<guid>https://www.nasa.gov/?post_type=nasa-blog&amp;p="
            + Math.abs(clock.now.toEpochMilli())
            + "</guid><link>https://www.nasa.gov/blogs/spacestation/"
            + clock.now.atZone(ZoneOffset.UTC).toLocalDate().toString().replace('-', '/')
            + "/test-only-"
            + type
            + "-"
            + clock.now.toEpochMilli()
            + "/</link><pubDate>"
            + clock
                .now
                .atZone(ZoneOffset.UTC)
                .format(java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
            + "</pubDate><content:encoded><![CDATA[<p>"
            + people
            + clause
            + "</p>]]></content:encoded></item></channel></rss>";
    byte[] bytes = raw.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    var o =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            NasaOperationalFeedHttpSource.URL,
            clock.now,
            null,
            null,
            null,
            null,
            CrewHttpReader.sha256(bytes),
            "TEST_ONLY",
            "NasaOperationalFeedParser/1.2.0");
    var source = new CrewSourceDocument(NasaSourceType.NASA_ISS_OPERATIONAL_FEED, o, bytes);
    var ingestion =
        new NasaCrewVerificationIngestionService(
            (url, etag, lastModified) ->
                new CrewVerificationHttpSource.Fetch(
                    bytes, null, 200, "application/rss+xml", null, null, clock.now),
            new NasaOperationalFeedParser(),
            verification,
            runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
            clock,
            o.sourceUrl(),
            NasaOperationalFeedParser.NAME,
            NasaOperationalFeedParser.VERSION);
    assertEquals(CrewSyncRun.Outcome.SUCCESS, ingestion.ingest().outcome());
    assertEquals(0, worker.run(256).failed());
    if (qualified) {
      var newly =
          jdbc.queryForList(
              "SELECT e.id,e.evidence_hash,s.subject_index,v.subject_key FROM"
                  + " crew_verification_evidence e JOIN crew_evidence_subject s ON"
                  + " s.evidence_id=e.id JOIN crew_subject_version_link v ON v.evidence_id=e.id AND"
                  + " v.subject_index=s.subject_index WHERE e.assertion_url LIKE ? ORDER BY"
                  + " s.subject_index",
              "%test-only-" + type + "-" + clock.now.toEpochMilli() + "/");
      assertEquals(ids.size(), newly.size());
      var facts = new ArrayList<IdentityEvidence>();
      for (int i = 0; i < ids.size(); i++) {
        var row = newly.get(i);
        String id = ids.get(i), name = name(id), hash = (String) row.get("evidence_hash");
        // Explicit qualified TEST_ONLY adapter evidence, no V7 mapping, no manual rescore.
        String bio = name + " selected in 2021 for Crew-13";
        facts.add(
            new IdentityEvidence(
                "NASA:OPERATIONAL_SUBJECT:" + row.get("subject_key"),
                IdentityEvidence.Provider.NASA,
                IdentityEvidence.Kind.OPERATIONAL_SUBJECT,
                name,
                List.of(name),
                bio,
                null,
                null,
                false,
                Set.of("2021"),
                Set.of("crew-13"),
                Set.of(IdentityEvidence.Witness.VALIDATED_BIOGRAPHY),
                List.of(),
                List.of(
                    new IdentityEvidence.Reference(
                        "crew_evidence_subject",
                        row.get("id") + ":" + row.get("subject_index"),
                        hash,
                        "TEST_ONLY_TYPED_PERSONAL_CONTEXT",
                        clock.now))));
        facts.add(
            new IdentityEvidence(
                "LL2:PERSON:" + id,
                IdentityEvidence.Provider.LL2,
                IdentityEvidence.Kind.PERSON,
                name,
                List.of(name),
                bio,
                null,
                null,
                false,
                Set.of("2021"),
                Set.of("crew-13"),
                Set.of(IdentityEvidence.Witness.PERSON_SCOPED_HISTORY),
                List.of(),
                List.of(
                    new IdentityEvidence.Reference(
                        "crew_person_observation", "TEST_ONLY", hash, "TEST_ONLY", clock.now))));
      }
      facts.forEach(f -> qualifiedFacts.put(f.key(), f));
      auto.retain(facts, clock.now);
      var worked = worker.run(256);
      assertEquals(0, worked.failed());
      assertTrue(
          worked.evaluations().stream()
                  .filter(e -> e.result().outcome() == IdentityPolicy.Outcome.AUTO_MATCH)
                  .count()
              >= ids.size());
    }
    reconciliation.reconcile();
  }

  JsonNode current(int expected) throws Exception {
    store.materialize(clock.now);
    var c =
        json.readTree(
            http.perform(get("/api/iss/crew"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertEquals(expected, c.path("members").size());
    var ids = new HashSet<String>();
    c.path("members").forEach(m -> assertTrue(ids.add(m.path("id").asText())));
    for (var m : c.path("members"))
      http.perform(get("/api/iss/crew/" + m.path("id").asText())).andExpect(status().isOk());
    int bindings =
        jdbc.queryForObject("SELECT count(*) FROM crew_identity_binding_version", Integer.class);
    if (baselineBindings == null) baselineBindings = bindings;
    else assertEquals(baselineBindings, bindings);
    return c;
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void sevenElevenSevenQualifiedArrivalDepartureAndLaterReentry(boolean arrivalFirst)
      throws Exception {
    ll2(original);
    fixture.roster(clock.now, true);
    assertEquals(0, worker.run(256).failed());
    current(7);
    advance(Duration.ofMinutes(1));
    if (arrivalFirst) {
      operational(incoming, "arrival", false);
      current(7);
      ll2(eleven());
    } else ll2(eleven());
    operational(incoming, "arrival", true);
    current(11);
    advance(Duration.ofMinutes(1));
    operational(outgoing, "departure", true);
    var after = current(7);
    assertEquals(
        4,
        store.latest().orElseThrow().result().members().stream()
            .filter(m -> m.departureVeto() != null)
            .count());
    advance(Duration.ofMinutes(1));
    fixture.roster(clock.now, true);
    assertEquals(0, worker.run(256).failed());
    current(7);
    assertEquals(
        4,
        store.latest().orElseThrow().result().members().stream()
            .filter(m -> m.departureVeto() != null)
            .count());
    long evidence =
        jdbc.queryForObject("SELECT count(*) FROM crew_verification_evidence", Long.class);
    // Strictly later operational episode reopens; lists never determine the event.
    advance(Duration.ofMinutes(1));
    operational(List.of(outgoing.getFirst()), "arrival", true);
    current(8);
    advance(Duration.ofMinutes(1));
    operational(List.of(outgoing.getFirst()), "observation", true);
    current(8);
    assertTrue(
        jdbc.queryForObject("SELECT count(*) FROM crew_verification_evidence", Long.class)
            > evidence);
    var old = after.path("members").get(0).path("id").asText();
    assertTrue(current(8).path("members").toString().contains(old));
    long revisions =
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Long.class);
    store.materialize(clock.now);
    assertEquals(
        revisions,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Long.class));
  }

  @Test
  void unresolvedDepartureDoesNotGuessAndSuccessfulSupportRemovalStillConverges() throws Exception {
    ll2(eleven());
    current(11);
    advance(Duration.ofMinutes(1));
    operational(outgoing, "departure", false);
    current(11);
    assertTrue(
        store.latest().orElseThrow().result().members().stream()
            .noneMatch(m -> m.departureVeto() != null));
    var remaining = eleven().stream().filter(id -> !outgoing.contains(id)).toList();
    advance(Duration.ofMinutes(1));
    ll2(remaining);
    current(7);
    assertTrue(store.latest().orElseThrow().result().unresolved().size() >= outgoing.size());
  }

  @Test
  void observationSuccessionImmutableExpiryCannotCancelFreshAssignment() throws Exception {
    ll2(original);
    operational(List.of(original.getFirst()), "observation", true);
    current(7);
    advance(Duration.ofDays(3));
    ll2(original);
    operational(List.of(original.getFirst()), "observation", true);
    advance(Duration.ofDays(5));
    ll2(original);
    operational(List.of(original.getFirst()), "observation", true);
    current(7);
    var latest =
        store.latest().orElseThrow().result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:" + original.getFirst()))
            .findFirst()
            .orElseThrow();
    assertEquals(
        clock.now.truncatedTo(java.time.temporal.ChronoUnit.SECONDS), latest.presenceEffectiveAt());
    assertEquals("CONFIRMED_ABOARD", latest.presence());
    assertEquals(
        3,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_verification_evidence WHERE"
                + " evidence_type='PERSON_CURRENTLY_ABOARD'",
            Integer.class));
    advance(Duration.ofDays(7).plusNanos(1000));
    ll2(original);
    current(7);
    assertEquals(
        0,
        store.latest().orElseThrow().result().members().stream()
            .filter(m -> m.departureVeto() != null)
            .count());
    assertEquals(
        3,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_verification_evidence WHERE"
                + " evidence_type='PERSON_CURRENTLY_ABOARD'",
            Integer.class));
  }

  @Test
  void realProviderFailurePreservesLastGoodAndGetsAreReadOnly() throws Exception {
    ll2(original);
    current(7);
    advance(Duration.ofMinutes(1));
    var service =
        new CrewIngestionService(
            s ->
                new CrewSourceResult<>(
                    CrewSourceState.SOURCE_UNAVAILABLE,
                    null,
                    null,
                    new CrewSourceResult.Failure(CrewSourceResult.FailureCode.TIMEOUT, null, null)),
            runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
            clock,
            URI.create("https://example.test/TEST_ONLY/failure"));
    assertEquals(CrewSyncRun.Outcome.SOURCE_RESULT, service.ingest().outcome());
    current(7);
    var before =
        jdbc.queryForList("SELECT id,state_key FROM crew_reconciliation_snapshot ORDER BY id");
    long
        projections =
            jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Long.class),
        decisions =
            jdbc.queryForObject("SELECT count(*) FROM crew_auto_decision_revision", Long.class);
    http.perform(get("/api/iss/crew")).andExpect(status().isOk());
    assertEquals(
        before,
        jdbc.queryForList("SELECT id,state_key FROM crew_reconciliation_snapshot ORDER BY id"));
    assertEquals(
        projections,
        jdbc.queryForObject("SELECT count(*) FROM crew_active_projection_revision", Long.class));
    assertEquals(
        decisions,
        jdbc.queryForObject("SELECT count(*) FROM crew_auto_decision_revision", Long.class));
  }

  @Test
  void knownVisitorNeedsNoCurrentAssignmentAndUnknownVisitorGetsNoPublicHuman() throws Exception {
    ll2(eleven());
    current(11);
    advance(Duration.ofMinutes(1));
    ll2(original);
    current(7);
    operational(List.of(incoming.getFirst()), "arrival", true);
    current(8);
    var visitor =
        store.latest().orElseThrow().result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:" + incoming.getFirst()))
            .findFirst()
            .orElseThrow();
    assertNull(visitor.assignment());
    assertEquals(Membership.State.ACTIVE, visitor.state());
    // Another source subject can score against an explicit fixture counterpart, but lacks a
    // retained provider anchor.
    fixture.clean();
    qualifiedFacts.clear();
    baselineBindings = null;
    advance(Duration.ofMinutes(1));
    ll2(original);
    current(7);
    long humans = jdbc.queryForObject("SELECT count(*) FROM crew_person", Long.class);
    operational(List.of(incoming.getFirst()), "arrival", true);
    current(7);
    assertEquals(humans, jdbc.queryForObject("SELECT count(*) FROM crew_person", Long.class));
    assertFalse(store.latest().orElseThrow().result().unresolved().isEmpty());
  }

  @ParameterizedTest
  @ValueSource(ints = {500, 200})
  void nasaHttpFailureAndMalformedBodyCannotRetractMembership(int status) throws Exception {
    ll2(original);
    current(7);
    advance(Duration.ofMinutes(1));
    var source =
        (CrewVerificationHttpSource)
            (url, etag, lastModified) ->
                new CrewVerificationHttpSource.Fetch(
                    "TEST_ONLY malformed".getBytes(),
                    null,
                    status,
                    "application/rss+xml",
                    null,
                    null,
                    clock.now);
    var ingestion =
        new NasaCrewVerificationIngestionService(
            source,
            new NasaOperationalFeedParser(),
            verification,
            runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
            clock,
            NasaOperationalFeedHttpSource.URL,
            NasaOperationalFeedParser.NAME,
            NasaOperationalFeedParser.VERSION);
    assertNotEquals(CrewSyncRun.Outcome.SUCCESS, ingestion.ingest().outcome());
    current(7);
    assertTrue(
        store.latest().orElseThrow().result().members().stream()
            .noneMatch(m -> m.departureVeto() != null));
  }

  @Test
  void independentLl2AndEditorialOmissionsRetractOnlyTheirOwnSupports() throws Exception {
    ll2(original);
    fixture.editorial = editorial;
    fixture.parser = editorialParser;
    fixture.auto = auto;
    fixture.worker = worker;
    fixture.roster(clock.now, true);
    assertEquals(0, worker.run(256).failed());
    current(7);
    String removed = "713";
    advance(Duration.ofMinutes(1));
    ll2(original.stream().filter(id -> !id.equals(removed)).toList());
    assertEquals(0, worker.run(256).failed());
    current(7); // qualified NASA editorial support survives LL2 omission.
    var old = editorial.latestRoster(clock.now).orElseThrow();
    var retained =
        old.roster().members().stream()
            .filter(m -> !m.name().equals(nameUnchecked(removed)))
            .toList();
    var reindexed = new ArrayList<CrewEditorial.Member>();
    for (int i = 0; i < retained.size(); i++) {
      var m = retained.get(i);
      reindexed.add(
          new CrewEditorial.Member(i, m.name(), m.role(), m.agency(), m.mentions(), m.conflicts()));
    }
    advance(Duration.ofMinutes(1));
    var body =
        json.writeValueAsBytes(
            Map.of("TEST_ONLY", "successful editorial omission", "members", reindexed));
    editorial.retain(
        fixture.capture(
            CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION,
            NasaEditorialParser.API + "mission/" + old.resource().wpId(),
            body,
            clock.now),
        old.resource(),
        new CrewEditorial.Roster(old.roster().expedition(), reindexed, List.of()),
        null,
        CrewEditorial.Outcome.SUCCESS,
        "TEST_ONLY_OMISSION");
    assertEquals(0, worker.run(256).failed());
    current(6); // both supports ended; no physical departure fabricated.
    ll2(original);
    current(7); // LL2 alone suffices despite editorial omission.
  }

  @ParameterizedTest
  @ValueSource(ints = {500, 200})
  void failedEditorialAcquisitionPreservesItsSoleRemainingMembershipSupport(int status)
      throws Exception {
    ll2(original);
    fixture.roster(clock.now, true);
    assertEquals(0, worker.run(256).failed());
    current(7);
    advance(Duration.ofMinutes(1));
    ll2(original.stream().filter(id -> !id.equals("713")).toList());
    assertEquals(0, worker.run(256).failed());
    current(7);
    long retainedRoster = editorial.latestRoster(clock.now).orElseThrow().id();
    var topicBytes = NasaEditorialParserTest.fixture("iss-topic");
    var topic =
        editorialParser.resource(editorialParser.json(topicBytes), CrewEditorial.Kind.NASA_TOPIC);
    byte[] topicHtml =
        ("<link rel='canonical' href='"
                + NasaEditorialParser.TOPIC
                + "'><link rel='alternate' href='"
                + NasaEditorialParser.API
                + "topic/"
                + topic.wpId()
                + "'><h1>Station Research News</h1>")
            .getBytes();
    advance(Duration.ofMinutes(1));
    var source =
        new NasaEditorialSource(
            (stream, url, cached) -> {
              boolean failedStream = stream == CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION;
              byte[] body =
                  failedStream
                      ? "TEST_ONLY malformed editorial response".getBytes()
                      : url.equals(NasaEditorialParser.TOPIC)
                          ? topicHtml
                          : url.toString().contains("mission-status")
                              ? NasaEditorialParserTest.fixture("active-taxonomy-slug")
                              : url.toString().contains("mission-target")
                                  ? NasaEditorialParserTest.fixture("target-slug")
                                  : topicBytes;
              return new CrewEditorial.Capture(
                  stream,
                  url,
                  url,
                  List.of(),
                  clock.now,
                  clock.now,
                  failedStream ? status : 200,
                  Map.of(
                      "Content-Type",
                      List.of(
                          url.getPath().startsWith("/wp-json/")
                              ? "application/json"
                              : "text/html")),
                  body,
                  null);
            },
            editorial,
            editorialParser,
            clock,
            NasaEditorialParser.TOPIC);
    source.acquire();
    assertEquals(retainedRoster, editorial.latestRoster(clock.now).orElseThrow().id());
    assertTrue(
        jdbc.queryForObject(
            "SELECT count(*)>0 FROM crew_editorial_acquisition WHERE"
                + " stream='NASA_EDITORIAL_EXPEDITION' AND outcome='FAILURE'",
            Boolean.class));
    assertEquals(0, worker.run(256).failed());
    current(7);
  }

  String nameUnchecked(String id) {
    try {
      return name(id);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @Test
  void restartWorkerDrainsPendingJobsAndPolicyChangeAppendsWithoutRewriting() throws Exception {
    ll2(original);
    var oldPolicy =
        new ActiveMembershipPolicy(
            CrewReconciliationPolicy.legacy(),
            Duration.ofHours(6),
            Duration.ofHours(6),
            Duration.ofDays(7));
    // Production repository persists a genuine old-policy cut, then the v2 store appends its new
    // cut.
    var legacyStore =
        new ActiveMembershipStore(
            jdbc,
            json,
            new RetainedMembershipInputs(jdbc, json, editorial, verification, oldPolicy),
            oldPolicy);
    var old =
        new org.springframework.transaction.support.TransactionTemplate(transactions)
            .execute(tx -> legacyStore.materialize(clock.now));
    var oldRow =
        jdbc.queryForMap(
            "SELECT * FROM crew_active_projection_revision WHERE id=?", old.revision());
    var restarted = new IdentityResearchWorker(auto, loader, clock, json);
    assertEquals(0, restarted.run(256).failed());
    current(7);
    assertEquals(
        oldRow,
        jdbc.queryForMap(
            "SELECT * FROM crew_active_projection_revision WHERE id=?", old.revision()));
    assertTrue(store.latest().orElseThrow().result().policy().contains("crew-freshness-v2"));
  }
}
