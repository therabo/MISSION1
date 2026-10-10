package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.source.crew.nasa.NasaEditorialParserTest.*;
import static org.mockito.Mockito.*;

import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewEditorial.*;
import org.mission1.source.crew.nasa.*;

class CrewEditorialShadowServiceTest {
  final Instant now = Instant.parse("2026-10-10T12:00:00Z");
  final NasaEditorialParser parser = new NasaEditorialParser(JSON);
  CrewEditorialRepository editorial;
  CrewQueryService ll2;
  CrewIdentityRepository identities;
  CrewReadQueryService people;
  CrewEditorialShadowService service;
  Roster nasa;
  List<CrewAssignment> assignments;
  Resource resource;

  @BeforeEach
  void setup() {
    editorial = mock(CrewEditorialRepository.class);
    ll2 = mock(CrewQueryService.class);
    identities = mock(CrewIdentityRepository.class);
    people = mock(CrewReadQueryService.class);
    when(identities.knowledge(any())).thenReturn(CrewCanonicalIdentity.EMPTY);
    when(people.findPeople(any(), any())).thenReturn(Map.of());
    nasa = parser.roster(current(), 75);
    resource = parser.resource(current(), Kind.NASA_MISSION);
    var obs =
        new CrewSourceObservation(
            CrewSource.LAUNCH_LIBRARY_2,
            URI.create("https://ll.thespacedevs.com/2.3.0/expeditions/"),
            now,
            null,
            null,
            null,
            null,
            "a".repeat(64),
            "TEST",
            "TEST");
    assignments = new ArrayList<>();
    for (var m : nasa.members())
      assignments.add(
          new CrewAssignment(
              null,
              new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "TEST_EXP"),
              new PersonReference(new UUID(0, m.index() + 1), m.name(), List.of(), null),
              m.role().equals("Commander") ? CrewRole.COMMANDER : CrewRole.FLIGHT_ENGINEER,
              m.role(),
              null,
              null,
              obs));
    service =
        new CrewEditorialShadowService(
            editorial, ll2, identities, people, Clock.fixed(now, ZoneOffset.UTC));
  }

  void inputs(List<Relation> relations) {
    when(editorial.latestRoster(any()))
        .thenReturn(Optional.of(new StoredRoster(1, 1, now, resource, nasa, relations)));
    var obs = assignments.getFirst().observation();
    var snapshot =
        new CrewSourceSnapshot(Station.ISS, 0, true, List.of(), assignments, List.of(), obs, "4");
    when(ll2.latest(any(), any()))
        .thenReturn(
            Optional.of(
                new CrewQueryService.Latest(new CrewRepository.StoredSnapshot(1, snapshot), null)));
  }

  @Test
  void sevenSameNamesAreCandidatesAndOnlyExistingApprovedResourceBindingIsCanonical() {
    var luke = parser.resource(parser.json(fixture("people-luke")), Kind.NASA_PEOPLE_RESOURCE);
    var key =
        new CrewCanonicalIdentity.Key(
            CrewSource.NASA_OFFICIAL, "PERSON_PROFILE_RESOURCE", "profile:" + luke.slug());
    when(identities.knowledge(any()))
        .thenReturn(new CrewCanonicalIdentity(List.of(), Map.of(key, new UUID(0, 5))));
    inputs(
        List.of(
            new Relation(
                1,
                4,
                "Luke Delaney",
                luke.canonicalUrl().toString(),
                "TEST",
                RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
                luke,
                1L,
                "TEST_EXISTING_APPROVAL")));
    var result = service.compare();
    assertEquals(7, result.nasaSlots());
    assertEquals(7, result.ll2Assignments());
    assertEquals(7, result.exactNameAgreements());
    assertEquals(
        1,
        result.slots().stream()
            .filter(
                s ->
                    s.classification()
                        == CrewEditorialShadowService.Classification.MATCHED_EXISTING_CANONICAL)
            .count());
    assertEquals(6, result.slots().stream().filter(s -> s.canonicalId() == null).count());
    verify(editorial, never()).retainRelation(any());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "NASA7_LL2_6",
        "NASA6_LL2_7",
        "SAME_COUNT_DIFFERENT",
        "EXTRA_UNRESOLVED",
        "ROLE_CONFLICT",
        "AGENCY_CONFLICT"
      })
  void disagreementRemainsShadowAndAttributed(String scenario) {
    switch (scenario) {
      case "NASA7_LL2_6" -> assignments.removeLast();
      case "NASA6_LL2_7" -> nasa = new Roster(75, nasa.members().subList(0, 6), List.of());
      case "SAME_COUNT_DIFFERENT", "EXTRA_UNRESOLVED" -> {
        var members = new ArrayList<>(nasa.members());
        members.set(
            6,
            new Member(
                6,
                "SYNTHETIC Different Person",
                "Flight Engineer",
                null,
                List.of(nasa.members().get(6).mentions().getFirst()),
                List.of()));
        nasa = new Roster(75, members, List.of());
      }
      case "ROLE_CONFLICT" -> {
        var a = assignments.get(0);
        assignments.set(
            0,
            new CrewAssignment(
                a.externalId(),
                a.expeditionId(),
                a.person(),
                CrewRole.FLIGHT_ENGINEER,
                "Flight Engineer",
                null,
                null,
                a.observation()));
      }
      case "AGENCY_CONFLICT" -> {
        /* source card/caption agency conflict is independently preserved */
      }
    }
    inputs(List.of());
    var result = service.compare();
    if (scenario.equals("NASA7_LL2_6"))
      assertEquals(
          1,
          result.slots().stream()
              .filter(
                  s ->
                      s.classification()
                          == CrewEditorialShadowService.Classification.NASA_ONLY_SLOT)
              .count());
    if (scenario.equals("NASA6_LL2_7"))
      assertEquals(
          1,
          result.slots().stream()
              .filter(
                  s ->
                      s.classification()
                          == CrewEditorialShadowService.Classification.LL2_ONLY_MEMBER)
              .count());
    if (scenario.startsWith("SAME") || scenario.startsWith("EXTRA")) {
      assertEquals(6, result.exactNameAgreements());
      assertEquals(8, result.slots().size());
    }
    if (scenario.equals("ROLE_CONFLICT"))
      assertTrue(result.slots().getFirst().conflicts().contains("NASA_LL2_ROLE"));
    if (scenario.equals("AGENCY_CONFLICT"))
      assertTrue(result.slots().get(5).conflicts().contains("AGENCY_CARD_CAPTION"));
    verify(editorial, never()).retain(any(), any(), any(), any(), any(), any());
    verify(editorial, never()).claimRefresh(any(), any());
  }

  @Test
  void operationalFailureAndEditorialSuccessHaveSeparateHealthOwnership() {
    var operational =
        new CrewQueryService.Status(
            Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty(), false);
    when(ll2.status(CrewSource.NASA_OFFICIAL, Station.ISS)).thenReturn(operational);
    when(editorial.health())
        .thenReturn(
            List.of(
                new Health(
                    Stream.NASA_EDITORIAL_TOPIC, "TEST", Outcome.SUCCESS, "OK", now, now, null)));
    var result = new CrewEditorialHealthService(editorial, ll2).read();
    assertSame(operational, result.nasaOperationalFeed());
    assertEquals(Outcome.SUCCESS, result.editorialResources().getFirst().outcome());
    verify(editorial, never()).retain(any(), any(), any(), any(), any(), any());
  }

  @Test
  void latestExplicitNoActiveLl2OutcomeDoesNotResurrectLastGoodAssignments() {
    inputs(List.of());
    when(people.latestStructuredOutcome())
        .thenReturn(
            Optional.of(
                new CrewSyncRun(
                    1,
                    CrewSource.LAUNCH_LIBRARY_2,
                    Station.ISS,
                    now,
                    now,
                    CrewSyncRun.Outcome.SOURCE_RESULT,
                    CrewSourceState.NO_ACTIVE_EXPEDITION,
                    assignments.getFirst().observation().sourceUrl(),
                    200,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null)));
    var result = service.compare();
    assertEquals(0, result.ll2Assignments());
    assertEquals(0, result.exactNameAgreements());
    assertEquals(7, result.nasaSlots());
  }

  @ParameterizedTest
  @ValueSource(strings = {"operational", "topic", "mission", "people", "count", "all"})
  void eachFailureOwnsOnlyItsHealthAndNeverChangesPublicInputs(String failed) {
    var opFailure =
        new CrewSyncRun(
            1,
            CrewSource.NASA_OFFICIAL,
            Station.ISS,
            now,
            now,
            CrewSyncRun.Outcome.SOURCE_RESULT,
            CrewSourceState.MALFORMED_RESPONSE,
            URI.create("https://www.nasa.gov/blogs/spacestation/feed/"),
            200,
            null,
            null,
            null,
            "TEST_MALFORMED",
            null,
            null);
    var op =
        new CrewQueryService.Status(
            Optional.of(opFailure),
            Optional.empty(),
            Optional.of(opFailure),
            Optional.empty(),
            false);
    when(ll2.status(CrewSource.NASA_OFFICIAL, Station.ISS)).thenReturn(op);
    var resources = new ArrayList<Health>();
    for (var stream : Stream.values()) {
      boolean fail =
          failed.equals("all")
              || failed.equals("topic") && stream == Stream.NASA_EDITORIAL_TOPIC
              || failed.equals("mission") && stream == Stream.NASA_EDITORIAL_EXPEDITION
              || failed.equals("people") && stream == Stream.NASA_PERSON_RESOURCE;
      resources.add(
          new Health(
              stream,
              "TEST_" + stream,
              fail
                  ? Outcome.FAILURE
                  : failed.equals("count") && stream == Stream.NASA_EDITORIAL_TOPIC
                      ? Outcome.DEGRADED
                      : Outcome.SUCCESS,
              fail ? "TEST_UNAVAILABLE" : "TEST_VALID_OR_COUNT_ONLY",
              now,
              now.minusSeconds(60),
              null));
    }
    when(editorial.health()).thenReturn(resources);
    var result = new CrewEditorialHealthService(editorial, ll2).read();
    assertEquals(
        CrewSourceState.MALFORMED_RESPONSE,
        result.nasaOperationalFeed().lastFailure().orElseThrow().sourceState());
    assertEquals(resources, result.editorialResources());
    assertTrue(result.editorialResources().stream().allMatch(h -> h.lastGoodAt() != null));
    verifyNoInteractions(people, identities);
  }
}
