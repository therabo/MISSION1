package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.membership.Membership.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import java.util.stream.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

/** Synthetic assumed identity bindings test lifecycle, never identity accuracy. */
class ActiveMembershipPolicyTest {
  static final Instant T = Instant.parse("2026-10-11T00:00:00Z");
  static final ActiveMembershipPolicy POLICY = ActiveMembershipPolicy.defaults();

  static Human human(String k) {
    return new Human(k, UUID.nameUUIDFromBytes(k.getBytes()), k, null);
  }

  static Assignment assignment(String k, Freshness f) {
    return new Assignment(
        k,
        1,
        UUID.nameUUIDFromBytes("exp".getBytes()),
        "source-assignment",
        "Expedition fixture",
        "FLIGHT_ENGINEER",
        null,
        null,
        T.minusSeconds(60),
        f,
        f == Freshness.FRESH);
  }

  static Slot slot(String k, String h, Freshness f) {
    return new Slot(
        k,
        k,
        "NASA_EDITORIAL_EXPEDITION",
        1L,
        0,
        1L,
        null,
        null,
        T.minusSeconds(50),
        null,
        "UNDATED_EDITORIAL_CAPTURE",
        75,
        f,
        true,
        h,
        h == null ? null : 1L,
        h == null ? null : 1L,
        h == null ? "AUTO_DEFER" : "AUTO_MATCH",
        List.of());
  }

  static Event event(
      String h, String type, String assertion, Instant time, boolean fresh, long id) {
    var s =
        new Slot(
            "event:" + id,
            h,
            "NASA_OPERATIONAL_FEED",
            null,
            null,
            null,
            id,
            0,
            T.minusSeconds(10),
            time,
            "SOURCE_EVENT_TIME_PRECISION_UNSPECIFIED",
            null,
            fresh ? Freshness.FRESH : Freshness.STALE,
            !type.equals("PERSON_DEPARTED_STATION"),
            h,
            1L,
            1L,
            "AUTO_MATCH",
            List.of());
    return new Event(s, type, assertion, fresh);
  }

  static Cut cut(List<Health> h) {
    return new Cut(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        List.of(),
        List.of(),
        h,
        Map.of("degraded", false));
  }

  static Input input(
      List<String> humans,
      List<Assignment> a,
      List<Slot> s,
      List<Event> e,
      Integer count,
      boolean ll,
      boolean nasa) {
    return new Input(
        cut(List.of()),
        humans.stream().distinct().map(ActiveMembershipPolicyTest::human).toList(),
        a,
        s,
        e,
        count,
        null,
        11,
        ll,
        nasa);
  }

  static Member member(Result r, String k) {
    return r.members().stream().filter(m -> m.human().key().equals(k)).findFirst().orElseThrow();
  }

  static List<String> seven =
      List.of("ll2:582", "ll2:642", "ll2:649", "ll2:650", "ll2:710", "ll2:713", "ll2:915");

  static Stream<Arguments> researched() throws Exception {
    var json =
        new ObjectMapper()
            .readTree(
                ActiveMembershipPolicyTest.class.getResourceAsStream(
                    "/crew/membership/researched-policy-scenarios.json"));
    return StreamSupport.stream(json.spliterator(), false)
        .map(n -> Arguments.of(n.path("scenario").asText(), n));
  }

  @ParameterizedTest
  @MethodSource("researched")
  void researchedFourteenScenariosUseProductionPolicy(String scenario, JsonNode expected) {
    var ll = new ArrayList<>(seven);
    var nasa = new ArrayList<>(seven);
    var known = new ArrayList<>(seven);
    var ev = new ArrayList<Event>();
    Freshness lf = Freshness.FRESH, nf = Freshness.FRESH;
    Integer count = 7;
    switch (scenario) {
      case "NASA7-LL2-6" -> ll.remove("ll2:915");
      case "NASA6-LL2-7", "NASA-removal-LL2-lag" -> {
        nasa.remove("ll2:915");
        count = 6;
      }
      case "same-count-different-humans" -> {
        nasa.remove("ll2:915");
        nasa.add("ll2:573");
        known.add("ll2:573");
      }
      case "completed-departure-overrides-retained-roster" -> {
        ll.add("ll2:573");
        nasa.add("ll2:573");
        known.add("ll2:573");
        count = 8;
        ev.add(
            event("ll2:573", "PERSON_DEPARTED_STATION", "COMPLETED", T.minusSeconds(5), true, 1));
      }
      case "both-remove-without-departure" -> {
        ll.remove("ll2:915");
        nasa.remove("ll2:915");
        count = 6;
      }
      case "visitor-arrival-not-in-expedition" -> {
        known.add("visitor:source-person");
        ev.add(
            event(
                "visitor:source-person",
                "PERSON_ENTERED_STATION",
                "COMPLETED",
                T.minusSeconds(5),
                true,
                1));
      }
      case "NASA-updated-first-new-person" -> {
        known.add("new:provisional");
        nasa.add("new:provisional");
        count = 8;
      }
      case "NASA-outage" -> nf = Freshness.STALE;
      case "LL2-outage" -> lf = Freshness.STALE;
      case "count-roster-mismatch" -> count = 8;
    }
    final var llFresh = lf;
    final var nasaFresh = nf;
    var slots =
        nasa.stream()
            .map(
                k ->
                    slot(
                        "roster:" + k,
                        scenario.equals("unresolved-roster-identities") ? null : k,
                        nasaFresh))
            .toList();
    var in =
        input(
            known,
            ll.stream().map(k -> assignment(k, llFresh)).toList(),
            slots,
            ev,
            count,
            lf == Freshness.FRESH,
            nf == Freshness.FRESH);
    if (scenario.equals("operational-malformed"))
      in =
          new Input(
              cut(
                  List.of(
                      new Health(
                          "NASA_OPERATIONAL_FEED",
                          "fixture",
                          "FAILURE",
                          "MALFORMED_RESPONSE",
                          1L,
                          T,
                          T,
                          Freshness.FRESH))),
              in.humans(),
              in.assignments(),
              in.editorial(),
              in.operational(),
              count,
              null,
              11,
              true,
              true);
    var result = POLICY.evaluate(in, T);
    var expectedNames = new TreeSet<String>();
    expected.path("result").path("activeCanonicalRows").forEach(n -> expectedNames.add(n.asText()));
    assertEquals(
        expectedNames,
        new TreeSet<>(
            result.members().stream()
                .filter(m -> m.state() == State.ACTIVE)
                .map(m -> m.human().key())
                .toList()));
    assertEquals(
        expected.path("result").path("activeCount").asInt(),
        result.counts().resolvedActiveHumans());
    assertEquals(count, result.counts().websiteReportedAboard());
    assertNull(result.counts().operationalOfficialAboard());
    if (scenario.equals("both-remove-without-departure")) {
      assertEquals(State.RETAINED, member(result, "ll2:915").state());
      assertNull(member(result, "ll2:915").departureVeto());
    }
    if (scenario.equals("same-count-different-humans"))
      assertEquals("CONFLICT", result.consistency().get("membershipSets"));
    if (scenario.equals("unresolved-roster-identities"))
      assertEquals(7, result.counts().unresolvedActiveSlots());
    if (scenario.equals("operational-malformed"))
      assertEquals(HealthState.DEGRADED, result.health());
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
  void sevenLl2HumansNeverInflatedByUnresolvedNasaSlots(int resolved) {
    var slots =
        IntStream.range(0, 7)
            .mapToObj(i -> slot("nasa:" + i, i < resolved ? seven.get(i) : null, Freshness.FRESH))
            .toList();
    var r =
        POLICY.evaluate(
            input(
                seven,
                seven.stream().map(k -> assignment(k, Freshness.FRESH)).toList(),
                slots,
                List.of(),
                7,
                true,
                true),
            T);
    assertEquals(7, r.counts().resolvedActiveHumans());
    assertEquals(7 - resolved, r.counts().unresolvedActiveSlots());
    assertEquals(resolved, r.counts().resolvedEditorialMemberships());
    assertTrue(r.members().stream().allMatch(m -> m.presence().equals("UNKNOWN")));
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 2, 3, 4, 5, 6, 7})
  void allIndependentSupportCombinations(int mask) {
    String h = "human";
    var r =
        POLICY.evaluate(
            input(
                List.of(h),
                (mask & 1) > 0 ? List.of(assignment(h, Freshness.FRESH)) : List.of(),
                (mask & 2) > 0 ? List.of(slot("nasa", h, Freshness.FRESH)) : List.of(),
                (mask & 4) > 0
                    ? List.of(
                        event(h, "PERSON_CURRENTLY_ABOARD", "OBSERVED", T.minusSeconds(1), true, 1))
                    : List.of(),
                null,
                true,
                true),
            T);
    assertEquals(1, r.counts().resolvedActiveHumans());
    assertEquals(Integer.bitCount(mask), member(r, h).supports().size());
    assertEquals((mask & 4) > 0 ? "CONFIRMED_ABOARD" : "UNKNOWN", member(r, h).presence());
  }

  @ParameterizedTest
  @ValueSource(longs = {-1, 0, 1, 864000})
  void departureReentryTemporalEpisodes(long reentryDelta) {
    String h = "human";
    Instant departure = T.minusSeconds(864001);
    var events =
        List.of(
            event(h, "PERSON_DEPARTED_STATION", "COMPLETED", departure, false, 1),
            event(
                h,
                "PERSON_ENTERED_STATION",
                "COMPLETED",
                departure.plusSeconds(reentryDelta),
                true,
                2));
    var r =
        POLICY.evaluate(
            input(
                List.of(h),
                List.of(assignment(h, Freshness.FRESH)),
                List.of(slot("nasa", h, Freshness.FRESH)),
                events,
                1,
                true,
                true),
            T);
    assertEquals(reentryDelta > 0 ? State.ACTIVE : State.RETAINED, member(r, h).state());
    assertEquals(reentryDelta > 0 ? null : 1L, member(r, h).departureVeto());
  }

  @Test
  void revalidatedRosterCannotUndoOldDeparture() {
    var r =
        POLICY.evaluate(
            input(
                List.of("h"),
                List.of(assignment("h", Freshness.FRESH)),
                List.of(slot("nasa", "h", Freshness.FRESH)),
                List.of(
                    event(
                        "h",
                        "PERSON_DEPARTED_STATION",
                        "COMPLETED",
                        T.minus(Duration.ofDays(90)),
                        false,
                        1)),
                1,
                true,
                true),
            T);
    assertEquals(State.RETAINED, member(r, "h").state());
    assertEquals("STALE", member(r, "h").presence());
    assertTrue(
        member(r, "h").supports().stream().allMatch(s -> s.supersededByDeparture().equals(1L)));
  }

  @Test
  void plannedDepartureIsNotVetoAndPlannedArrivalIsNotSupport() {
    var r =
        POLICY.evaluate(
            input(
                List.of("h"),
                List.of(assignment("h", Freshness.FRESH)),
                List.of(),
                List.of(
                    event("h", "PERSON_DEPARTED_STATION", "PLANNED", T.minusSeconds(1), true, 1)),
                null,
                true,
                false),
            T);
    assertEquals(State.ACTIVE, member(r, "h").state());
    assertNull(member(r, "h").departureVeto());
    var r2 =
        POLICY.evaluate(
            input(
                List.of("h"),
                List.of(),
                List.of(),
                List.of(
                    event("h", "PERSON_ENTERED_STATION", "PLANNED", T.minusSeconds(1), true, 1)),
                null,
                false,
                false),
            T);
    assertEquals(State.RETAINED, member(r2, "h").state());
  }

  @Test
  void staleOnlyNeverMeansEmptyStation() {
    var r =
        POLICY.evaluate(
            input(
                List.of("h"),
                List.of(assignment("h", Freshness.STALE)),
                List.of(slot("nasa", "h", Freshness.STALE)),
                List.of(),
                7,
                false,
                false),
            T);
    assertEquals(HealthState.UNAVAILABLE, r.health());
    assertEquals(State.RETAINED, member(r, "h").state());
    assertNull(member(r, "h").departureVeto());
    assertEquals(7, r.counts().websiteReportedAboard());
  }

  @Test
  void nullPersonalValidityDoesNotUseExpeditionStart() {
    var r =
        POLICY.evaluate(
            input(
                List.of("h"),
                List.of(assignment("h", Freshness.FRESH)),
                List.of(),
                List.of(),
                null,
                true,
                false),
            T);
    assertNull(member(r, "h").assignment().validFrom());
    assertNull(member(r, "h").assignment().validUntil());
  }

  @Test
  void sourceFailureKeepsFreshLastGoodAndDegradesIndependently() {
    var in =
        input(
            List.of("h"),
            List.of(assignment("h", Freshness.FRESH)),
            List.of(),
            List.of(),
            null,
            true,
            false);
    var bad =
        new Input(
            cut(
                List.of(
                    new Health(
                        "LL2_STRUCTURED_CREW",
                        "fixture",
                        "FAILURE",
                        "SOURCE_UNAVAILABLE",
                        1L,
                        T,
                        T.minusSeconds(60),
                        Freshness.FRESH))),
            in.humans(),
            in.assignments(),
            in.editorial(),
            in.operational(),
            null,
            null,
            null,
            true,
            false);
    var r = POLICY.evaluate(bad, T);
    assertEquals(State.ACTIVE, member(r, "h").state());
    assertEquals(HealthState.DEGRADED, r.health());
  }

  @ParameterizedTest
  @ValueSource(longs = {-1, 0, 1})
  void freshnessBoundary(long delta) {
    assertEquals(
        delta <= 0 ? Freshness.FRESH : Freshness.STALE,
        POLICY.freshness(T.minus(Duration.ofHours(6)).minusSeconds(delta), Duration.ofHours(6), T));
  }

  @Test
  void futureCaptureCannotBecomeFresh() {
    assertEquals(Freshness.STALE, POLICY.freshness(T.plusSeconds(1), Duration.ofHours(6), T));
  }

  @Test
  void noPositiveSupportRetainsIdentity() {
    assertEquals(
        State.RETAINED,
        member(
                POLICY.evaluate(
                    input(List.of("h"), List.of(), List.of(), List.of(), null, true, true), T),
                "h")
            .state());
  }
}
