package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.atomic.*;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/**
 * TEST_ONLY lifecycle and transport. The captured resource shapes retain their identity fields, but
 * provider flight windows are explicitly rebased for this constructed scenario. This is not
 * evidence of a real 7→11→7 handover or of real acquisition cadence.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {

      "mission1.crew.operational-binding.resource-seeds=https://www.gctc.ru/main.php?id=154,https://www.asc-csa.gc.ca/eng/astronauts/canadian/active/bio-joshua-kutryk.asp,https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Sophie_Adenot,https://www.nasa.gov/wp-json/wp/v2/mission/939897,https://www.nasa.gov/wp-json/wp/v2/mission/992288"
    })
@AutoConfigureMockMvc
@Testcontainers
@Import(UnifiedCrewLifecyclePostgresTest.FixtureConfiguration.class)
class UnifiedCrewLifecyclePostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }

  static final List<String> ORIGINAL = List.of("650", "713", "649", "582", "710", "642", "915");
  static final List<String> INCOMING = List.of("573", "712", "747", "732");
  static final List<String> OUTGOING = ORIGINAL.subList(3, 7);
  static final List<String> ALL =
      java.util.stream.Stream.concat(ORIGINAL.stream(), INCOMING.stream()).toList();

  static class ScenarioClock extends Clock {
    volatile Instant now = Instant.now().plusSeconds(2).truncatedTo(ChronoUnit.SECONDS);

    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    public Clock withZone(ZoneId zone) {
      return this;
    }

    public Instant instant() {
      return now;
    }
  }

  /** Scheduled only inside this test; the test method never invokes a pipeline stage. */
  static final class AcceleratedDriver {
    final AtomicBoolean enabled = new AtomicBoolean();
    final AtomicBoolean feedChanged = new AtomicBoolean();
    final AtomicInteger acquisitions = new AtomicInteger();
    final AtomicInteger resourceFetches = new AtomicInteger();
    final AtomicReference<Throwable> failure = new AtomicReference<>();
    volatile byte[] feed;
    @Autowired ScenarioClock clock;
    @Autowired CrewRepository runs;
    @Autowired CrewVerificationRepository verification;
    @Autowired OperationalBindingWorker bindingWorker;
    @Autowired ActiveMembershipStore membership;
    @Autowired CrewReconciliationService reconciliation;

    NasaCrewVerificationIngestionService ingestion() {
      return new NasaCrewVerificationIngestionService(
          (url, etag, modified) -> {
            acquisitions.incrementAndGet();
            return new CrewVerificationHttpSource.Fetch(
                feed, null, 200, "application/rss+xml", null, null, clock.instant());
          },
          new NasaOperationalFeedParser(),
          verification,
          runs,
          new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
          clock,
          NasaOperationalFeedHttpSource.URL,
          NasaOperationalFeedParser.NAME,
          NasaOperationalFeedParser.VERSION);
    }

    synchronized void disable() {
      enabled.set(false);
    }

    synchronized void next(Instant at, byte[] nextFeed) {
      // Advance virtual time only between scheduled cycles. A two-hour jump in the middle of a
      // claimed S10 lease would correctly invalidate that lease and would test an artificial race.
      clock.now = at;
      feed = nextFeed;
      feedChanged.set(true);
    }

    @Scheduled(fixedDelay = 25, initialDelay = 25)
    synchronized void tick() {
      if (!enabled.get()) return;
      try {
        if (feedChanged.compareAndSet(true, false)) ingestion().ingestScheduled();
        if (bindingWorker.acquire()) resourceFetches.incrementAndGet();
        bindingWorker.evaluate();
        reconciliation.reconcile();
        membership.materialize(clock.instant());
      } catch (Throwable e) {
        failure.compareAndSet(null, e);
      }
    }
  }

  @TestConfiguration
  static class FixtureConfiguration {
    @Bean
    @Primary
    ScenarioClock scenarioClock() {
      return new ScenarioClock();
    }

    @Bean
    AcceleratedDriver acceleratedDriver() {
      return new AcceleratedDriver();
    }
  }

  @Autowired ScenarioClock clock;
  @Autowired AcceleratedDriver scheduled;
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper json;
  @Autowired MockMvc http;
  @LocalServerPort int serverPort;
  @Autowired OperationalBindingStore bindings;
  @Autowired OperationalBindingWorker bindingWorker;
  @Autowired RetainedOperationalInputs operationalInputs;
  @Autowired ActiveMembershipStore membership;
  @Autowired ActiveMembershipPolicy membershipPolicy;
  @Autowired RetainedMembershipInputs membershipInputs;
  @Autowired CrewReconciliationService reconciliation;
  @Autowired CrewIdentityRepository canonicalIdentities;
  @Autowired CrewEditorialRepository editorial;
  @Autowired NasaEditorialParser editorialParser;
  @MockitoBean OperationalResourceHttp resourceHttp;
  Instant start;
  Integer baselineBindings;
  final Map<String, OperationalResources.Capture> captures = new HashMap<>();

  static OffsetDateTime utc(Instant t) {
    return t.atOffset(ZoneOffset.UTC);
  }

  UUID human(String id) {
    UUID person =
        jdbc.queryForObject(
            "SELECT person_id FROM crew_person_external_id WHERE source='LAUNCH_LIBRARY_2' AND"
                + " external_id=?",
            UUID.class,
            id);
    return canonicalIdentities.knowledge(clock.instant()).canonicalize(person);
  }

  @BeforeEach
  void reset() throws Exception {
    scheduled.disable();
    scheduled.failure.set(null);
    scheduled.feedChanged.set(false);
    scheduled.acquisitions.set(0);
    scheduled.resourceFetches.set(0);
    jdbc.execute(
        "TRUNCATE crew_operational_subject_binding_release,crew_operational_resource_version,"
            + "crew_operational_resource_work,crew_membership_projection_revision,crew_identity_research_identity,"
            + "crew_identity_research_release,crew_source_snapshot,crew_person,crew_document_body,"
            + "crew_resource RESTART IDENTITY CASCADE");
    jdbc.update(
        "UPDATE crew_operational_subject_binding_work SET generation=1,completed_generation=0,"
            + "claimed_until='epoch',claim_token=NULL,next_at='epoch'");
    start = Instant.now().plusSeconds(2).truncatedTo(ChronoUnit.SECONDS);
    baselineBindings = null;
    clock.now = start;
    captures.clear();
    for (var n : OperationalFixtures.CORPUS.path("captures")) {
      byte[] body = n.path("body").binaryValue();
      if (n.path("url").asText().startsWith("https://ll.thespacedevs.com/2.3.0/astronauts/")) {
        var provider = (ObjectNode) json.readTree(body);
        for (var flight : provider.path("flights"))
          ((ObjectNode) flight).put("net", start.minus(Duration.ofDays(1)).toString());
        for (var landing : provider.path("landings"))
          ((ObjectNode) landing).put("mission_end", start.plus(Duration.ofDays(30)).toString());
        provider.put("bio", provider.path("bio").asText() + " TEST_ONLY_REBASED_FLIGHT_WINDOWS");
        body = json.writeValueAsBytes(provider);
      }
      var c =
          new OperationalResources.Capture(
              n.path("url").asText(),
              n.path("finalUrl").asText(),
              json.convertValue(
                  n.path("redirects"),
                  new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}),
              start.minusSeconds(1),
              200,
              n.path("contentType").asText(),
              null,
              body);
      captures.put(c.url(), c);
    }
    org.mockito.Mockito.when(resourceHttp.fetch(org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(
            inv -> {
              String url = inv.getArgument(0);
              var retained = captures.get(url);
              return retained == null
                  ? new OperationalResources.Capture(
                      url,
                      url,
                      List.of(),
                      clock.instant(),
                      404,
                      "text/html",
                      "TEST_ONLY_MISSING_RESOURCE",
                      null)
                  : new OperationalResources.Capture(
                      url,
                      retained.finalUrl(),
                      retained.redirects(),
                      clock.instant(),
                      200,
                      retained.contentType(),
                      null,
                      retained.body());
            });
  }

  @AfterEach
  void stopScheduler() {
    scheduled.disable();
  }

  String name(String id) {
    return captures.values().stream()
        .filter(c -> c.url().endsWith("/astronauts/" + id + "/"))
        .map(
            c -> {
              try {
                return json.readTree(c.body()).path("name").asText();
              } catch (Exception e) {
                throw new IllegalStateException(e);
              }
            })
        .findFirst()
        .orElseThrow();
  }

  String introduction(String id) {
    String agency = OperationalFixtures.provider("LL2:PERSON:" + id).agency();
    return switch (agency) {
      case "RFSA" -> "Roscosmos cosmonaut ";
      case "ESA" -> "ESA (European Space Agency) astronaut ";
      case "CSA" -> "CSA (Canadian Space Agency) astronaut ";
      default -> "NASA astronaut ";
    };
  }

  void ll2(List<String> assigned, List<String> retained) {
    // Known visitor identities come from an earlier successful provider acquisition, not from
    // handcrafted human rows or mappings. The scenario being asserted begins at start, after
    // the subsequent ORIGINAL roster acquisition. Later omissions leave retained profiles.
    boolean missing =
        retained.stream()
            .anyMatch(
                id ->
                    jdbc.queryForObject(
                        "SELECT count(*)=0 FROM crew_person_external_id WHERE"
                            + " source='LAUNCH_LIBRARY_2' AND external_id=?",
                        Boolean.class,
                        id));
    Instant current = clock.instant();
    if (missing && !retained.equals(assigned)) {
      clock.now = current.minusSeconds(60);
      ingestLl2(retained);
      clock.now = current;
    }
    ingestLl2(assigned);
  }

  void ingestLl2(List<String> assigned) {
    ingestLl2(assigned, Duration.ZERO);
  }

  void ingestLl2(List<String> assigned, Duration completionLag) {
    URI url = URI.create("https://example.test/TEST_ONLY/ll2");
    var observation =
        new CrewSourceObservation(
            CrewSource.LAUNCH_LIBRARY_2,
            url,
            clock.instant(),
            null,
            null,
            null,
            null,
            OperationalBindingStore.hash("TEST_ONLY_PROVIDER:" + assigned + ":" + clock.instant()),
            "TEST_ONLY",
            "TEST_ONLY");
    var expedition = new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "test-expedition");
    var profiles = new ArrayList<AstronautProfile>();
    var assignments = new ArrayList<CrewAssignment>();
    for (String id : assigned) {
      var person =
          new PersonReference(
              null, name(id), List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, id)), null);
      String abbreviation =
          new OperationalResources(json)
              .parse(
                  captures.get("https://ll.thespacedevs.com/2.3.0/astronauts/" + id + "/"),
                  "TEST_ONLY_METADATA")
              .getFirst()
              .agency();
      profiles.add(
          new AstronautProfile(
              person,
              new Agency(abbreviation, abbreviation, null, List.of()),
              List.of(),
              "TEST_ONLY canonical profile",
              null,
              null,
              null,
              observation));
      assignments.add(
          new CrewAssignment(
              new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "assignment-" + id),
              expedition,
              person,
              CrewRole.FLIGHT_ENGINEER,
              "Flight Engineer",
              null,
              null,
              observation));
    }
    var snapshot =
        new CrewSourceSnapshot(
            Station.ISS,
            1,
            true,
            List.of(
                new Expedition(
                    null,
                    expedition,
                    "TEST_ONLY Expedition",
                    null,
                    null,
                    Station.ISS,
                    observation)),
            assignments,
            profiles,
            observation,
            "4");
    var result =
        new CrewIngestionService(
                station -> {
                  clock.now = clock.instant().plus(completionLag);
                  return new CrewSourceResult<>(
                      CrewSourceState.AVAILABLE, snapshot, observation, null, 200);
                },
                scheduled.runs,
                new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
                clock,
                url)
            .ingest();
    assertEquals(CrewSyncRun.Outcome.SUCCESS, result.outcome());
  }

  byte[] feed(List<String> ids, String type, Instant effective) {
    String clause =
        switch (type) {
          case "arrival" -> " have entered the International Space Station.";
          case "departure" -> " have departed the International Space Station.";
          default -> " worked aboard the International Space Station.";
        };
    StringBuilder paragraphs = new StringBuilder();
    for (String id : ids)
      paragraphs
          .append("<p>")
          .append(introduction(id))
          .append(name(id))
          .append(clause)
          .append("</p>");
    if (ids.isEmpty()) paragraphs.append("<p>TEST_ONLY station research continues.</p>");
    String article =
        "https://www.nasa.gov/blogs/spacestation/"
            + effective.atZone(ZoneOffset.UTC).toLocalDate().toString().replace('-', '/')
            + "/test-only-"
            + type
            + "-"
            + effective.toEpochMilli()
            + "/";
    return ("<rss xmlns:content='http://purl.org/rss/1.0/modules/content/'><channel><title>International"
                + " Space Station - NASA</title><item><title>TEST_ONLY Station"
                + " activities</title><guid>"
            + article
            + "</guid><link>"
            + article
            + "</link><pubDate>"
            + effective
                .atZone(ZoneOffset.UTC)
                .format(java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME)
            + "</pubDate><content:encoded><![CDATA["
            + paragraphs
            + "]]></content:encoded></item></channel></rss>")
        .getBytes(StandardCharsets.UTF_8);
  }

  void acquireResources() {
    captures.values().forEach(c -> bindings.retain(c, clock.instant()));
  }

  void publish(List<String> ids, String type, Instant effective) {
    scheduled.feed = feed(ids, type, effective);
    assertEquals(CrewSyncRun.Outcome.SUCCESS, scheduled.ingestion().ingest().outcome());
    bindingWorker.evaluate();
    reconciliation.reconcile();
    membership.materialize(clock.instant());
  }

  JsonNode read(String path) throws Exception {
    var result = http.perform(get(path)).andReturn();
    if (result.getResolvedException() != null) throw result.getResolvedException();
    assertEquals(200, result.getResponse().getStatus());
    return json.readTree(result.getResponse().getContentAsString());
  }

  Set<String> ids(JsonNode crew) {
    var ids = new TreeSet<String>();
    for (var member : crew.path("members"))
      assertTrue(ids.add(member.path("id").asText()), "duplicate human");
    return ids;
  }

  JsonNode current(int n) throws Exception {
    var c = read("/api/iss/crew");
    assertEquals(n, c.path("members").size(), c.toPrettyString());
    assertEquals(n, ids(c).size());
    for (var m : c.path("members")) read("/api/iss/crew/" + m.path("id").asText());
    assertEquals(
        0, jdbc.queryForObject("SELECT count(*) FROM crew_identity_research_decision_revision", Integer.class));
    int mappings =
        jdbc.queryForObject("SELECT count(*) FROM crew_identity_binding_version", Integer.class);
    if (baselineBindings == null) baselineBindings = mappings;
    else assertEquals(baselineBindings, mappings, "S10 must not mutate V7 identity bindings");
    return c;
  }

  JsonNode historical(Instant at, int n) throws Exception {
    var r = read("/api/iss/replay?at=" + at);
    assertEquals(n, r.at("/crew/state/members").size(), r.toPrettyString());
    assertEquals(n, r.at("/crew/profiles").size());
    assertEquals("EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION", r.path("semantics").asText());
    return r.at("/crew/state");
  }

  @Test
  void sameCommittedEventsGiveSevenElevenSevenAndReentryAtInclusiveUtcBoundaries()
      throws Exception {
    ll2(ORIGINAL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    var before = current(7);
    clock.now = start.plusSeconds(60);
    Instant entry = clock.instant();
    publish(INCOMING, "arrival", entry);
    var overlap = current(11);
    clock.now = start.plusSeconds(120);
    Instant departure = clock.instant();
    publish(OUTGOING, "departure", departure);
    var after = current(7);
    assertEquals(
        4,
        membership.latest().orElseThrow().result().members().stream()
            .filter(m -> m.departureVeto() != null)
            .count());
    assertEquals(ids(before), ids(historical(entry.minusSeconds(1), 7)));
    assertEquals(ids(overlap), ids(historical(entry, 11)));
    assertEquals(ids(overlap), ids(historical(departure.minusSeconds(1), 11)));
    assertEquals(ids(after), ids(historical(departure, 7)));
    clock.now = start.plusSeconds(180);
    Instant reentry = clock.instant();
    publish(List.of(OUTGOING.getFirst()), "arrival", reentry);
    var returned = current(8);
    assertEquals(ids(after), ids(historical(reentry.minusSeconds(1), 7)));
    assertEquals(ids(returned), ids(historical(reentry, 8)));
    // Seek backward after reading a future reentry must not keep its membership cached.
    assertEquals(ids(before), ids(historical(entry.minusSeconds(1), 7)));
    assertEquals(ids(overlap), ids(historical(departure.minusSeconds(1), 11)));
    assertEquals(11, jdbc.queryForObject("SELECT count(*) FROM crew_person", Integer.class));
  }

  @Test
  void unresolvedDepartureCannotGuessAHumanAndSuccessfulOmissionRemovesOnlyItsSupport()
      throws Exception {
    ll2(ALL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    current(11);
    clock.now = start.plusSeconds(60);
    // Missing every qualified flight witness is an actual resolver DEFER, not a mocked result.
    jdbc.execute("TRUNCATE crew_operational_resource_version RESTART IDENTITY CASCADE");
    publish(OUTGOING, "departure", clock.instant());
    current(11);
    historical(clock.instant(), 11);
    assertTrue(
        membership.latest().orElseThrow().result().members().stream()
            .noneMatch(m -> m.departureVeto() != null));
    clock.now = start.plusSeconds(120);
    ll2(ALL.stream().filter(id -> !OUTGOING.contains(id)).toList(), ALL);
    membership.materialize(clock.instant());
    current(7);
    historical(clock.instant(), 7);
  }

  @Test
  void knownVisitorNeedsNoAssignmentWhileUnknownVisitorCreatesNoCanonicalHuman() throws Exception {
    ll2(
        ORIGINAL,
        java.util.stream.Stream.concat(ORIGINAL.stream(), INCOMING.stream().limit(1)).toList());
    acquireResources();
    membership.materialize(clock.instant());
    current(7);
    clock.now = start.plusSeconds(60);
    publish(List.of(INCOMING.getFirst()), "arrival", clock.instant());
    current(8);
    var visitor =
        membership.latest().orElseThrow().result().members().stream()
            .filter(m -> m.human().key().equals("LL2:PERSON:" + INCOMING.getFirst()))
            .findFirst()
            .orElseThrow();
    assertNull(visitor.assignment());
    assertEquals(Membership.State.ACTIVE, visitor.state());
    historical(clock.instant(), 8);
    clock.now = start.plusSeconds(120);
    // Resource identity may exist without a publishable V7 person. Such a subject stays unresolved.
    int humans = jdbc.queryForObject("SELECT count(*) FROM crew_person", Integer.class);
    publish(List.of(INCOMING.get(1)), "arrival", clock.instant());
    current(8);
    historical(clock.instant(), 8);
    assertEquals(humans, jdbc.queryForObject("SELECT count(*) FROM crew_person", Integer.class));
  }

  @Test
  void sourceFailuresCannotInventDeparturesAndReadSeeksDoNotAppendLifecycleRows() throws Exception {
    ll2(ORIGINAL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    current(7);
    clock.now = start.plusSeconds(60);
    var failed =
        new CrewIngestionService(
            station ->
                new CrewSourceResult<>(
                    CrewSourceState.SOURCE_UNAVAILABLE,
                    null,
                    null,
                    new CrewSourceResult.Failure(CrewSourceResult.FailureCode.TIMEOUT, null, null)),
            scheduled.runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5)),
            clock,
            URI.create("https://example.test/TEST_ONLY/failure"));
    assertEquals(CrewSyncRun.Outcome.SOURCE_RESULT, failed.ingest().outcome());
    membership.materialize(clock.instant());
    current(7);
    assertTrue(
        membership.latest().orElseThrow().result().members().stream()
            .noneMatch(m -> m.departureVeto() != null));
    var before =
        jdbc.queryForList("SELECT id,input_hash FROM crew_membership_projection_revision ORDER BY id");
    for (var t : List.of(start, start.plusSeconds(30), clock.instant(), start)) historical(t, 7);
    assertEquals(
        before,
        jdbc.queryForList("SELECT id,input_hash FROM crew_membership_projection_revision ORDER BY id"));
  }

  @ParameterizedTest
  @ValueSource(ints = {500, 200})
  void failedOrMalformedNasaAcquisitionKeepsQualifiedVisitorSupport(int status) throws Exception {
    ll2(ORIGINAL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    clock.now = start.plusSeconds(60);
    publish(List.of(INCOMING.getFirst()), "arrival", clock.instant());
    var good = current(8);
    clock.now = start.plusSeconds(120);
    var failed =
        new NasaCrewVerificationIngestionService(
            (url, etag, modified) ->
                new CrewVerificationHttpSource.Fetch(
                    "TEST_ONLY malformed response".getBytes(StandardCharsets.UTF_8),
                    null,
                    status,
                    "application/rss+xml",
                    null,
                    null,
                    clock.instant()),
            new NasaOperationalFeedParser(),
            scheduled.verification,
            scheduled.runs,
            new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(10)),
            clock,
            NasaOperationalFeedHttpSource.URL,
            NasaOperationalFeedParser.NAME,
            NasaOperationalFeedParser.VERSION);
    assertNotEquals(CrewSyncRun.Outcome.SUCCESS, failed.ingest().outcome());
    reconciliation.reconcile();
    membership.materialize(clock.instant());
    assertEquals(ids(good), ids(current(8)));
    var reconstructed = historical(clock.instant(), 8);
    assertEquals(ids(good), ids(reconstructed));
    var visitor =
        reconstructed.path("members").findValues("name").stream()
            .anyMatch(n -> n.asText().equals(name(INCOMING.getFirst())));
    assertTrue(visitor);
    for (var member : reconstructed.path("members"))
      if (member.path("name").asText().equals(name(INCOMING.getFirst()))) {
        // T equals the fixed known-at clock; Historical still evaluates the event, independent of
        // today's failed feed attempt. The adapter must set an explicit Historical context.
        assertEquals("CONFIRMED_ABOARD", member.at("/presence/state").asText());
        assertEquals("CONFIRMED_ABOARD", member.at("/presence/lastKnownState").asText());
      }
    assertTrue(
        membership.latest().orElseThrow().result().members().stream()
            .noneMatch(m -> m.departureVeto() != null));
  }

  @Test
  void bindingCorrectionRetractsAndReassignsCurrentAndHistoricalWithoutRewritingHistory()
      throws Exception {
    String a = INCOMING.getFirst(), b = "998573";
    String aUrl = "https://ll.thespacedevs.com/2.3.0/astronauts/" + a + "/";
    String bUrl = "https://ll.thespacedevs.com/2.3.0/astronauts/" + b + "/";
    var original = captures.get(aUrl);
    var initialB = (ObjectNode) json.readTree(original.body());
    initialB
        .put("id", Integer.parseInt(b))
        .put("name", "TEST ONLY Correction Human")
        .put("date_of_birth", "1900-02-02");
    captures.put(
        bUrl,
        new OperationalResources.Capture(
            bUrl,
            bUrl,
            List.of(),
            start.minusSeconds(1),
            200,
            "application/json",
            null,
            json.writeValueAsBytes(initialB)));
    var retained = new ArrayList<>(ALL);
    retained.add(b);
    ll2(ORIGINAL, retained);
    acquireResources();
    membership.materialize(clock.instant());
    current(7);
    clock.now = start.plusSeconds(60);
    Instant entry = clock.instant();
    publish(List.of(a), "arrival", entry);
    var matched = current(8);
    assertTrue(ids(matched).contains(human(a).toString()));
    assertFalse(ids(matched).contains(human(b).toString()));
    long oldBinding =
        jdbc.queryForObject(
            "SELECT max(id) FROM crew_operational_subject_binding_revision WHERE outcome='AUTO_MATCH'",
            Long.class);
    var oldRow =
        jdbc.queryForMap("SELECT * FROM crew_operational_subject_binding_revision WHERE id=?", oldBinding);
    var batch = operationalInputs.load(clock.instant());
    var resolver =
        new OperationalResolver(
            org.mission1.crew.research.FrozenIdentityModel.load(json),
            OperationalPolicy.PRODUCTION);
    var subject = batch.subjects().getFirst();
    var conflict =
        resolver
            .evaluate(subject, batch.resources(), clock.instant(), batch.complete())
            .conflict("TEST_ONLY_CHANGED_PERSON_FACTS");
    clock.now = clock.now.plusSeconds(1);
    var comparison =
        new OperationalShadowComparison(membershipPolicy)
            .compare(membershipInputs.load(clock.instant()), List.of(conflict), clock.instant());
    bindings.save(
        List.of(conflict),
        batch.resources(),
        comparison,
        clock.instant(),
        null,
        OperationalPolicy.PRODUCTION);
    reconciliation.reconcile();
    membership.materialize(clock.instant());
    current(7);
    historical(entry, 7); // Best reconstruction knows the later withdrawal.

    clock.now = clock.now.plusSeconds(1);
    var changedA = (ObjectNode) json.readTree(original.body());
    changedA.put("name", "TEST ONLY Superseded Provider Person");
    bindings.retain(
        new OperationalResources.Capture(
            aUrl,
            aUrl,
            List.of(),
            clock.instant(),
            200,
            "application/json",
            null,
            json.writeValueAsBytes(changedA)),
        clock.instant());
    var correctedB = (ObjectNode) json.readTree(original.body());
    correctedB.put("id", Integer.parseInt(b));
    bindings.retain(
        new OperationalResources.Capture(
            bUrl,
            bUrl,
            List.of(),
            clock.instant(),
            200,
            "application/json",
            null,
            json.writeValueAsBytes(correctedB)),
        clock.instant());
    bindingWorker.evaluate();
    reconciliation.reconcile();
    membership.materialize(clock.instant());
    var corrected = current(8);
    assertFalse(ids(corrected).contains(human(a).toString()));
    assertTrue(ids(corrected).contains(human(b).toString()));
    assertEquals(ids(corrected), ids(historical(entry, 8)));
    assertEquals(
        oldRow,
        jdbc.queryForMap("SELECT * FROM crew_operational_subject_binding_revision WHERE id=?", oldBinding));
    assertEquals(12, jdbc.queryForObject("SELECT count(*) FROM crew_person", Integer.class));
  }

  void refresh(Instant effective) {
    clock.now = effective;
    ll2(ORIGINAL, ALL);
    publish(List.of(), "refresh", effective);
  }

  @Test
  void currentAndHistoricalShareInclusiveSevenDayObservationAndFourteenDayArrivalExpiry()
      throws Exception {
    ll2(ORIGINAL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    current(7);
    clock.now = start.plusSeconds(60);
    Instant observed = clock.instant();
    publish(List.of(INCOMING.getFirst()), "observation", observed);
    current(8);
    clock.now = start.plusSeconds(120);
    Instant entered = clock.instant();
    publish(List.of(INCOMING.get(1)), "arrival", entered);
    current(9);
    refresh(observed.plus(Duration.ofDays(7)));
    var observationBoundary = current(9);
    assertEquals(ids(observationBoundary), ids(historical(clock.instant(), 9)));
    refresh(clock.instant().plusSeconds(1));
    var observationExpired = current(8);
    assertEquals(ids(observationExpired), ids(historical(clock.instant(), 8)));
    refresh(entered.plus(Duration.ofDays(14)));
    var arrivalBoundary = current(8);
    assertEquals(ids(arrivalBoundary), ids(historical(clock.instant(), 8)));
    refresh(clock.instant().plusSeconds(1));
    var arrivalExpired = current(7);
    assertEquals(ids(arrivalExpired), ids(historical(clock.instant(), 7)));
    // Best current reconstruction must still recover the old event cuts after both events expire.
    historical(observed.minusSeconds(1), 7);
    historical(observed, 8);
    historical(entered.minusSeconds(1), 8);
    historical(entered, 9);
  }

  @Test
  void restartedWorkerAndProjectionRepairDoNotCreateS10V10FeedbackChurn() throws Exception {
    ll2(ORIGINAL, ALL);
    acquireResources();
    membership.materialize(clock.instant());
    clock.now = start.plusSeconds(60);
    publish(INCOMING, "arrival", clock.instant());
    var before = current(11);
    var revisions =
        jdbc.queryForList(
            "SELECT id,input_hash,result_hash FROM crew_operational_subject_binding_revision ORDER BY id");
    long projection = membership.latest().orElseThrow().revision();
    var restarted =
        new OperationalBindingWorker(
            bindings,
            operationalInputs,
            membershipInputs,
            membershipPolicy,
            json,
            clock,
            resourceHttp,
            List.of(),
            OperationalPolicy.PRODUCTION);
    for (int i = 0; i < 3; i++) {
      // Simulates a repaired/delivered notification after application restart; evaluation must
      // coalesce the unchanged factual cut rather than depend on diagnostic V10 revision IDs.
      jdbc.update(
          "UPDATE crew_operational_subject_binding_work SET"
              + " generation=generation+1,next_at='epoch',claimed_until='epoch',claim_token=NULL");
      assertEquals(0, restarted.evaluate().inserted());
      reconciliation.reconcile();
      assertFalse(membership.materialize(clock.instant()).inserted());
    }
    assertEquals(
        revisions,
        jdbc.queryForList(
            "SELECT id,input_hash,result_hash FROM crew_operational_subject_binding_revision ORDER BY id"));
    assertEquals(projection, membership.latest().orElseThrow().revision());
    assertEquals(ids(before), ids(current(11)));
    assertEquals(ids(before), ids(historical(clock.instant(), 11)));
  }

  @Test
  void historicalCaptureStartsAtRetrievedTimeWhileCompletionIsLaterKnowledge() throws Exception {
    ingestLl2(ORIGINAL, Duration.ofSeconds(30));
    assertEquals(start.plusSeconds(30), clock.instant());
    membership.materialize(clock.instant());
    var now = current(7);
    assertEquals(ids(now), ids(historical(start, 7)));
    assertEquals(ids(now), ids(historical(start.plusSeconds(5), 7)));
    assertEquals(
        "UNAVAILABLE",
        read("/api/iss/replay?at=" + start.minusSeconds(1)).at("/crew/availability").asText());
  }

  CrewEditorial.Capture editorialCapture(CrewEditorial.Stream stream, String url, byte[] body) {
    return new CrewEditorial.Capture(
        stream,
        URI.create(url),
        URI.create(url),
        List.of(),
        clock.instant(),
        clock.instant(),
        200,
        Map.of("Content-Type", List.of("application/json")),
        body,
        null);
  }

  @Test
  void editorialOnlyV7SupportProvidesHistoricalCoverageWithoutStructuredOrOperationalSupport()
      throws Exception {
    clock.now = start.minus(Duration.ofDays(1));
    ll2(ORIGINAL, ORIGINAL); // Normal historical provider acquisition establishes V7 targets.
    var person = json.readTree(NasaEditorialParserTest.fixture("people-watkins"));
    if (person.isArray()) person = person.get(0);
    var personalResource =
        editorialParser.resource(person, CrewEditorial.Kind.NASA_PEOPLE_RESOURCE);
    // Establish the pre-existing V7 typed NASA provider identity through its normal source-write
    // and reviewed synchronization boundaries. This fixture fact is not an aboard assertion and
    // cannot supply operational membership or a current operational coverage interval.
    byte[] personBody = json.writeValueAsBytes(person);
    var observed =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            personalResource.canonicalUrl(),
            clock.instant(),
            personalResource.publishedAt(),
            null,
            null,
            null,
            org.mission1.source.crew.CrewHttpReader.sha256(personBody),
            "TEST_ONLY",
            "TEST_ONLY_TYPED_PERSON_RESOURCE");
    var reference =
        new PersonReference(null, "Jessica Watkins", List.of(), personalResource.canonicalUrl());
    var providerFact =
        new CrewVerificationEvidence(
            CrewVerificationEvidence.Type.EXPEDITION_MEMBERSHIP,
            Station.ISS,
            List.of(reference),
            null,
            NasaSourceType.NASA_PERSON_RESOURCE,
            observed,
            "TEST_ONLY typed provider identity; no aboard assertion",
            "TEST_ONLY_TYPED_PERSON_RESOURCE");
    long run =
        scheduled.runs.startRun(
            CrewSource.NASA_OFFICIAL,
            Station.ISS,
            clock.instant(),
            personalResource.canonicalUrl());
    scheduled.verification.storeFetch(
        run,
        new CrewSourceDocument(NasaSourceType.NASA_PERSON_RESOURCE, observed, personBody),
        200,
        "application/json",
        "TEST_ONLY_TYPED_PERSON_RESOURCE",
        "1",
        List.of(providerFact),
        true,
        clock.instant());
    scheduled.verification.resolve(
        scheduled.verification.evidenceAsOf(clock.instant()), clock.instant());
    clock.now = start;
    var mission = NasaEditorialParserTest.current();
    var missionResource = editorialParser.resource(mission, CrewEditorial.Kind.NASA_MISSION);
    var roster = editorialParser.roster(mission, 75);
    var stored =
        editorial.retain(
            editorialCapture(
                CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION,
                NasaEditorialParser.API + "mission/" + missionResource.wpId(),
                json.writeValueAsBytes(mission)),
            missionResource,
            roster,
            null,
            CrewEditorial.Outcome.SUCCESS,
            "TEST_ONLY_EDITORIAL_SUPPORT");
    var topic = json.readTree(NasaEditorialParserTest.fixture("iss-topic"));
    if (topic.isArray()) topic = topic.get(0);
    var topicResource = editorialParser.resource(topic, CrewEditorial.Kind.NASA_TOPIC);
    editorial.retain(
        editorialCapture(
            CrewEditorial.Stream.NASA_EDITORIAL_TOPIC,
            NasaEditorialParser.API + "topic/" + topicResource.wpId(),
            json.writeValueAsBytes(topic)),
        topicResource,
        null,
        editorialParser.topic(topic, topicResource, NasaEditorialParser.TOPIC),
        CrewEditorial.Outcome.SUCCESS,
        "TEST_ONLY_EDITORIAL_SUPPORT");
    var personal =
        editorial.retain(
            editorialCapture(
                CrewEditorial.Stream.NASA_PERSON_RESOURCE,
                NasaEditorialParser.API + "people/" + personalResource.wpId(),
                json.writeValueAsBytes(person)),
            personalResource,
            null,
            null,
            CrewEditorial.Outcome.SUCCESS,
            "TEST_ONLY_EDITORIAL_SUPPORT");
    var watkins =
        roster.members().stream()
            .filter(m -> m.name().equals("Jessica Watkins"))
            .findFirst()
            .orElseThrow();
    editorial.retainRelation(
        new CrewEditorial.Relation(
            stored.rosterId(),
            watkins.index(),
            watkins.name(),
            personalResource.canonicalUrl().toString(),
            "Biography",
            CrewEditorial.RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
            personalResource,
            personal.id(),
            "TEST_ONLY_VERIFIED_PERSON_RESOURCE"));
    membership.materialize(clock.instant());
    var current = current(1);
    assertEquals("Jessica Watkins", current.path("members").get(0).path("name").asText());
    var historical = historical(clock.instant(), 1);
    assertEquals(ids(current), ids(historical));
    var staleAssignment =
        membership.latest().orElseThrow().result().members().stream()
            .filter(m -> m.state() == Membership.State.ACTIVE)
            .findFirst()
            .orElseThrow()
            .assignment();
    assertTrue(staleAssignment == null || !staleAssignment.eligible());
    assertTrue(historical.path("members").get(0).path("assignment").isNull());
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_verification_evidence WHERE evidence_type IN"
                + " ('PERSON_CURRENTLY_ABOARD','PERSON_ENTERED_STATION','PERSON_DEPARTED_STATION')",
            Integer.class));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM crew_operational_subject_binding_revision", Integer.class));
  }

  @Test
  void automaticAcceleratedSchedulerDeliversAcquisitionParserS10V10RestAndHistorical()
      throws Exception {
    // Unlike the other integration tests, nothing below calls an
    // ingestion/evaluation/materialization
    // stage. The scheduled driver performs all those calls through unchanged production services.
    ll2(ORIGINAL, ALL);
    scheduled.feed = feed(List.of(), "initial", clock.instant());
    scheduled.feedChanged.set(true);
    scheduled.enabled.set(true);
    awaitCurrent(7);
    Instant entry = start.plus(Duration.ofHours(2)).plusSeconds(1);
    Instant departure = start.plus(Duration.ofHours(4)).plusSeconds(2);
    scheduled.next(entry, feed(INCOMING, "arrival", entry));
    awaitCurrent(11);
    scheduled.next(departure, feed(OUTGOING, "departure", departure));
    awaitCurrent(7);
    scheduled.disable();
    assertNull(scheduled.failure.get());
    assertTrue(scheduled.acquisitions.get() >= 3);
    assertTrue(scheduled.resourceFetches.get() > 0);
    assertTrue(
        jdbc.queryForObject("SELECT count(*)>0 FROM crew_verification_evidence", Boolean.class));
    assertTrue(
        jdbc.queryForObject(
            "SELECT count(*)>0 FROM crew_operational_resource_version", Boolean.class));
    assertTrue(
        jdbc.queryForObject(
            "SELECT count(*)>=8 FROM crew_operational_subject_binding_revision WHERE outcome='AUTO_MATCH'",
            Boolean.class));
    assertTrue(
        jdbc.queryForObject(
            "SELECT count(*)>=3 FROM crew_membership_projection_revision", Boolean.class));
    historical(entry.minusSeconds(1), 7);
    historical(entry, 11);
    historical(departure.minusSeconds(1), 11);
    historical(departure, 7);
  }

  void awaitCurrent(int expected) {
    Duration timeout = Duration.ofSeconds(30);
    Awaitility.await()
        .ignoreException(CurrentProjectionUnavailable.class)
        .pollInterval(Duration.ofMillis(25))
        .atMost(timeout)
        .untilAsserted(
            () -> {
              assertNull(scheduled.failure.get());
              current(expected);
            });
  }

}
