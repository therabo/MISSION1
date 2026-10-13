package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ResearchMembershipIdentityTest {
  @ParameterizedTest
  @ValueSource(strings = {"AUTO_MATCH", "AUTO_DEFER", "AUTO_SEPARATE"})
  void onlyCurrentMatchInGraphBinds(String outcome) throws Exception {
    var evidence =
        new ObjectMapper()
            .readTree(
                "{\"references\":[{\"table\":\"crew_editorial_roster_member\",\"id\":\"1:0\",\"hash\":\"HASH\"}]}");
    var d =
        new ResearchMembershipIdentity.Decision(
            1, "source", "LL2:PERSON:1", outcome, 1, evidence, true, true);
    var b = new ResearchMembershipIdentity(List.of(d), List.of("LL2:PERSON:1"));
    assertEquals(
        outcome.equals("AUTO_MATCH") ? "LL2:PERSON:1" : null,
        b.bind("source", "crew_editorial_roster_member", "1:0", "HASH").human());
    assertNull(b.bind("source", "crew_editorial_roster_member", "2:0", "HASH").human());
    assertNull(b.bind("source", "crew_editorial_roster_member", "1:0", "CHANGED").human());
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 1, 2})
  void failClosedWithoutHeadComponentOrHuman(int missing) throws Exception {
    var e =
        new ObjectMapper()
            .readTree("{\"references\":[{\"table\":\"source\",\"id\":\"1\",\"hash\":\"HASH\"}]}");
    var b =
        new ResearchMembershipIdentity(
            List.of(
                new ResearchMembershipIdentity.Decision(
                    1, "source", "LL2:PERSON:1", "AUTO_MATCH", 1, e, missing != 0, missing != 1)),
            missing == 2 ? List.of() : List.of("LL2:PERSON:1"));
    assertNull(b.bind("source", "source", "1", "HASH").human());
  }

  @Test
  void missingDecisionNeverUsesNamesOrReviewedBindings() {
    assertNull(
        new ResearchMembershipIdentity(List.of(), List.of("LL2:PERSON:1"))
            .bind("same-name", "source", "1", "hash")
            .human());
  }

  @Test
  void randomizedInputOrderAndDuplicateDeliveryKeepProjectionDeterministic() {
    var h = ActiveMembershipPolicyTest.seven;
    var base =
        ActiveMembershipPolicyTest.input(
            h,
            h.stream()
                .map(k -> ActiveMembershipPolicyTest.assignment(k, Membership.Freshness.FRESH))
                .toList(),
            h.stream()
                .map(k -> ActiveMembershipPolicyTest.slot(k, k, Membership.Freshness.FRESH))
                .toList(),
            List.of(),
            7,
            true,
            true);
    var expected = ActiveMembershipPolicyTest.POLICY.evaluate(base, ActiveMembershipPolicyTest.T);
    for (int seed = 0; seed < 1000; seed++) {
      var humans = new ArrayList<>(base.humans());
      var assignments = new ArrayList<>(base.assignments());
      var slots = new ArrayList<>(base.editorial());
      var random = new Random(seed);
      Collections.shuffle(humans, random);
      Collections.shuffle(assignments, random);
      Collections.shuffle(slots, random);
      var in =
          new Membership.Input(
              base.cut(), humans, assignments, slots, List.of(), 7, null, 11, true, true);
      assertEquals(
          expected, ActiveMembershipPolicyTest.POLICY.evaluate(in, ActiveMembershipPolicyTest.T));
    }
  }
}
