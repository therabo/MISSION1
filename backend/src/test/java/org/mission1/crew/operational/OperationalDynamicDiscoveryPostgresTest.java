package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mission1.crew.FixtureCrewSource;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** Entirely SYNTHETIC future missions, transported through normal adapters and durable workers. */
@SpringBootTest
@Testcontainers
class OperationalDynamicDiscoveryPostgresTest {
  @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");
  @DynamicPropertySource static void db(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", PG::getJdbcUrl);
    r.add("spring.datasource.username", PG::getUsername);
    r.add("spring.datasource.password", PG::getPassword);
  }
  @Autowired CrewRepository crew;
  @Autowired CrewVerificationRepository verification;
  @Autowired CrewEditorialRepository editorial;
  @Autowired OperationalBindingStore store;
  @Autowired RetainedOperationalInputs inputs;
  @Autowired RetainedMembershipInputs membership;
  @Autowired ActiveMembershipPolicy membershipPolicy;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  FixtureCrewSource fixture;
  OperationalBindingWorker worker;
  final List<String> exchanges = new ArrayList<>();
  final Map<String, String> bodies = new HashMap<>();
  final CrewIngestionPolicy policy = new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5));
  static final Instant T = Instant.parse("2026-10-13T18:00:00Z");
  static final String PERSON = "https://ll.thespacedevs.com/2.3.0/astronauts/990042/";
  static final String MISSION = "https://www.nasa.gov/mission/nasas-spacex-crew-42/";
  static final String TYPED = "https://www.nasa.gov/wp-json/wp/v2/mission/999042";

  @BeforeEach @SuppressWarnings("unchecked") void empty() throws Exception {
    jdbc.execute("TRUNCATE crew_person,crew_source_snapshot,crew_source_document,crew_operational_binding_release,"
        + "crew_operational_resource_version,crew_operational_resource_work,crew_operational_request_permit RESTART IDENTITY CASCADE");
    jdbc.update("UPDATE crew_operational_binding_work SET generation=1,completed_generation=0,claimed_until='epoch',claim_token=NULL,next_at='epoch'");
    fixture = new FixtureCrewSource();
    fixture.clock.time = T;
    var client = mock(HttpClient.class);
    when(client.followRedirects()).thenReturn(HttpClient.Redirect.NEVER);
    when(client.send(any(), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
      String url = ((HttpRequest) call.getArgument(0)).uri().toString();
      exchanges.add(url);
      var response = (HttpResponse<byte[]>) mock(HttpResponse.class);
      when(response.statusCode()).thenReturn(bodies.containsKey(url) ? 200 : 404);
      when(response.body()).thenReturn(bodies.getOrDefault(url, "TEST_ONLY missing").getBytes(StandardCharsets.UTF_8));
      when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Type", List.of(url.contains("wp-json")
          || url.contains("thespacedevs") ? "application/json" : "text/html")), (a,b) -> true));
      return response;
    });
    var http = new OperationalResourceHttp(client, fixture.clock, store::permit,
        new NasaRequestGate(editorial, fixture.clock), u -> {});
    worker = new OperationalBindingWorker(store, inputs, membership, membershipPolicy, json,
        fixture.clock, http, List.of(), OperationalPolicy.PRODUCTION); // deliberately ZERO static seeds
  }
  @AfterEach void close() { fixture.close(); }
  int count(String table) { return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class); }

  void structured(int mission, int expedition, int astronaut) throws Exception {
    var page = (ObjectNode) json.readTree(FixtureCrewSource.fixture("active-iss-expedition-detailed"));
    var exp = (ObjectNode) page.path("results").get(0);
    exp.put("id", 9000 + expedition).put("name", "Expedition " + expedition);
    var assignment = (ObjectNode) exp.path("crew").get(0).deepCopy();
    assignment.put("id", 800000 + astronaut);
    var person = (ObjectNode) assignment.path("astronaut");
    person.put("id", astronaut).put("name", "Avery Example").put("bio",
        "SYNTHETIC TEST_ONLY. Selected in 2013 for NASA. Assigned to Crew-" + mission + ".");
    exp.putArray("crew").add(assignment);
    fixture.body = json.writeValueAsString(page);
    var ingestion = new CrewIngestionService(fixture.source, crew, policy, fixture.clock, fixture.source.currentExpeditionUrl());
    assertEquals(CrewSyncRun.Outcome.SUCCESS, ingestion.ingestScheduled().outcome());
  }

  void resources() throws Exception {
    bodies.put(PERSON, """
        {"id":990042,"name":"Avery Example","agency":{"abbrev":"NASA"},"date_of_birth":"1984-04-03",
         "bio":"SYNTHETIC TEST_ONLY. Selected in 2013.","flights_count":1,"landings":[],
         "flights":[{"id":"TEST_ONLY_FLIGHT_42","net":"2026-10-01T12:00:00Z","status":{"id":3},
           "mission":{"name":"SpaceX Crew-42"},"rocket":{"configuration":{"full_name":"Falcon 9"}},
           "launch_service_provider":{"name":"SpaceX"}}]}
        """);
    bodies.put(MISSION, "<html><head><link rel='alternate' href='" + TYPED
        + "'></head><main><h1>NASA's SpaceX Crew-42</h1><p>SYNTHETIC TEST_ONLY</p></main></html>");
    bodies.put("https://www.nasa.gov/mission/expedition-94/", "<main><h1>Expedition 94</h1><p>SYNTHETIC TEST_ONLY</p></main>");
    bodies.put(TYPED, """
        {"id":999042,"type":"mission","status":"publish","slug":"nasas-spacex-crew-42",
         "link":"https://www.nasa.gov/mission/nasas-spacex-crew-42/","title":{"rendered":"NASA's SpaceX Crew-42"},
         "content":{"rendered":"<h2>Meet the Crew</h2><p>Avery Example</p><h2>Launch</h2><p>SYNTHETIC TEST_ONLY</p>"}}
        """);
  }

  void observation() {
    var source = mock(CrewVerificationHttpSource.class);
    String rss = """
        <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>International Space Station - NASA</title><item>
        <title>TEST_ONLY Crew-42 research</title><link>https://www.nasa.gov/blogs/spacestation/2026/10/13/test-only/</link>
        <guid>https://www.nasa.gov/blogs/spacestation/2026/10/13/test-only/</guid>
        <pubDate>Tue, 13 Oct 2026 18:00:00 GMT</pubDate>
        <content:encoded><![CDATA[<p>NASA astronaut Avery Example is working aboard the International Space Station during Crew-42.</p>]]></content:encoded>
        </item></channel></rss>
        """;
    when(source.fetch(any(), any(), any())).thenReturn(new CrewVerificationHttpSource.Fetch(
        rss.getBytes(StandardCharsets.UTF_8), null, 200, "application/rss+xml", null, null, fixture.clock.instant()));
    var ingestion = new NasaCrewVerificationIngestionService(source, new NasaOperationalFeedParser(), verification, crew,
        policy, fixture.clock, NasaOperationalFeedHttpSource.URL, NasaOperationalFeedParser.NAME, NasaOperationalFeedParser.VERSION);
    var result = ingestion.ingestScheduled();
    assertEquals(CrewSyncRun.Outcome.SUCCESS, result.outcome());
    assertEquals(1, result.evidenceInserted());
  }

  void nextEvaluation() { fixture.clock.time = fixture.clock.time.plusSeconds(900); worker.evaluate(); }
  void acquire() { fixture.clock.time = fixture.clock.time.plusSeconds(300); assertTrue(worker.acquire()); }

  @Test void unknownFutureMissionTraversesNormalIntakeQueueTypedGraphAndUnchangedS10Gates() throws Exception {
    structured(42,94,990042);
    resources();
    observation();
    var initial = worker.evaluate();
    assertEquals(1, initial.deferred());
    assertEquals(3, count("crew_operational_resource_work"));
    assertTrue(jdbc.queryForList("SELECT requested_url FROM crew_operational_resource_work", String.class).contains(MISSION));
    assertEquals(0, exchanges.size());
    acquire(); // structured person detail, using real S10/LL2 budget
    acquire(); // bounded Expedition HTML
    acquire(); // source-directed mission HTML
    nextEvaluation(); // advertised typed mission is now durable work
    assertEquals(4, count("crew_operational_resource_work"));
    acquire();
    fixture.clock.time = fixture.clock.time.plusSeconds(900);
    var qualified = worker.evaluate();
    assertEquals(1, qualified.matches(), qualified.evaluations().toString());
    var decision = qualified.evaluations().getFirst();
    assertEquals(OperationalBinding.Outcome.AUTO_MATCH, decision.outcome());
    assertEquals("LL2:PERSON:990042", decision.candidate());
    assertTrue(decision.candidates().getFirst().proofs().stream().anyMatch(p ->
        p.authority() == OperationalBinding.Authority.OFFICIAL_NAMED_MISSION_ROSTER));
    assertEquals(4, count("crew_operational_resource_attempt"));
    assertEquals(4, count("crew_operational_request_permit"));
    assertEquals(1, count("crew_person")); // only the structured source created the V7 target
    assertFalse(worker.acquire());
    int work = count("crew_operational_resource_work"), versions = count("crew_operational_resource_version");
    nextEvaluation();
    assertEquals(work, count("crew_operational_resource_work"));
    assertEquals(versions, count("crew_operational_resource_version"));
    assertEquals(4, exchanges.size());
    assertEquals(OperationalPolicy.PRODUCTION.version(), jdbc.queryForObject(
        "SELECT release_version FROM crew_operational_binding_revision ORDER BY id DESC LIMIT 1", String.class));
    System.out.println("SYNTHETIC Crew-42: normal LL2 -> discovery -> paced official HTML/typed mission -> S10 MATCH; zero static seeds");
  }

  @Test void laterAssignmentMissionAndExpeditionRefreshQueueNewWorkWithoutRedeployOrDuplicates() throws Exception {
    structured(42,94,990042);
    worker.evaluate();
    var before = jdbc.queryForList("SELECT * FROM crew_operational_resource_work ORDER BY requested_url");
    nextEvaluation();
    assertEquals(before, jdbc.queryForList("SELECT * FROM crew_operational_resource_work ORDER BY requested_url"));
    fixture.clock.time = fixture.clock.time.plusSeconds(7200);
    structured(73,95,990073);
    worker.evaluate();
    var urls = jdbc.queryForList("SELECT requested_url FROM crew_operational_resource_work", String.class);
    assertTrue(urls.contains("https://www.nasa.gov/mission/nasas-spacex-crew-73/"));
    assertTrue(urls.contains("https://www.nasa.gov/mission/expedition-95/"));
    assertTrue(urls.contains("https://ll.thespacedevs.com/2.3.0/astronauts/990073/"));
    assertEquals(6, urls.size());
    nextEvaluation();
    assertEquals(6, count("crew_operational_resource_work"));
    assertEquals(0, exchanges.size());
  }

  @Test void sameProviderWithChangedMissionRelationDiscoversNewMissionOnLaterStructuredRefresh() throws Exception {
    structured(42,94,990042);
    worker.evaluate();
    fixture.clock.time = fixture.clock.time.plusSeconds(7200);
    structured(73,94,990042);
    worker.evaluate();
    assertEquals(4, count("crew_operational_resource_work"));
    assertTrue(jdbc.queryForList("SELECT requested_url FROM crew_operational_resource_work", String.class)
        .contains("https://www.nasa.gov/mission/nasas-spacex-crew-73/"));
  }

  @Test void providerBudgetLeaseAndRestartPreserveBoundedIdempotentWork() throws Exception {
    structured(42,94,990042); worker.evaluate();
    var lease = store.claimResource(fixture.clock.instant()).orElseThrow();
    assertNotEquals(lease.url(), store.claimResource(fixture.clock.instant()).orElseThrow().url());
    assertTrue(store.permit("ll.thespacedevs.com", fixture.clock.instant()));
    assertTrue(store.permit("ll.thespacedevs.com", fixture.clock.instant()));
    assertTrue(store.permit("ll.thespacedevs.com", fixture.clock.instant()));
    assertFalse(store.permit("ll.thespacedevs.com", fixture.clock.instant()));
    nextEvaluation(); // periodic restart-equivalent reread does not reset pacing/leases
    assertEquals(3, count("crew_operational_resource_work"));
    assertFalse(store.permit("ll.thespacedevs.com", fixture.clock.instant()));
  }

  void editorialLink(String url, CrewEditorial.RelationStatus status) {
    URI api = URI.create("https://www.nasa.gov/wp-json/wp/v2/mission/998094");
    var resource = new CrewEditorial.Resource(CrewEditorial.Kind.NASA_MISSION,998094,"expedition-94",
        URI.create("https://www.nasa.gov/mission/expedition-94/"),"Expedition 94",null,null);
    var mention = new CrewEditorial.Mention("Crew Members","TEST_ONLY/member","Avery Example","Flight Engineer","NASA",
        null,"TEST_ONLY",CrewEditorial.CaptionKind.GENERIC_ROLE_TEXT,List.of(new CrewEditorial.Link("Avery Example",url)));
    var roster = new CrewEditorial.Roster(94,List.of(new CrewEditorial.Member(0,"Avery Example","Flight Engineer","NASA",List.of(mention),List.of())),List.of());
    byte[] bytes = ("SYNTHETIC TEST_ONLY V8 relation " + url).getBytes(StandardCharsets.UTF_8);
    var captured = editorial.retain(new CrewEditorial.Capture(CrewEditorial.Stream.NASA_EDITORIAL_EXPEDITION,api,api,List.of(),
        fixture.clock.instant(),fixture.clock.instant(),200,Map.of("Content-Type",List.of("application/json")),bytes,null),
        resource,roster,null,CrewEditorial.Outcome.SUCCESS,"TEST_ONLY");
    editorial.retainRelation(new CrewEditorial.Relation(captured.rosterId(),0,"Avery Example",url,"TEST_ONLY/member",
        status,null,null,"TEST_ONLY source locator, never identity proof"));
  }

  @Test void changedOfficialV8RelationImmediatelyGeneratesNewWorkButRejectedLinksDoNot() throws Exception {
    String first = "https://www.nasa.gov/people/test-only-original/";
    String next = "https://www.nasa.gov/people/test-only-revised/";
    editorialLink(first,CrewEditorial.RelationStatus.OBSERVED_LINK);
    worker.evaluate();
    assertEquals(List.of(first),jdbc.queryForList("SELECT requested_url FROM crew_operational_resource_work",String.class));
    fixture.clock.time = fixture.clock.time.plusSeconds(900);
    editorialLink(next,CrewEditorial.RelationStatus.OBSERVED_LINK);
    worker.evaluate();
    assertEquals(2,count("crew_operational_resource_work"));
    assertTrue(jdbc.queryForList("SELECT requested_url FROM crew_operational_resource_work",String.class).contains(next));
    fixture.clock.time = fixture.clock.time.plusSeconds(900);
    editorialLink("https://www.nasa.gov/people/test-only-wrong/",CrewEditorial.RelationStatus.REJECTED_MISMATCH);
    worker.evaluate();
    assertEquals(2,count("crew_operational_resource_work"));
    assertEquals(0,exchanges.size());
  }
}
