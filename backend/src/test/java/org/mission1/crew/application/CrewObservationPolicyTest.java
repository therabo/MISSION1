package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mission1.crew.domain.*;

class CrewObservationPolicyTest {
  final Instant t = Instant.parse("2026-10-01T00:00:00Z");

  CrewVerificationEvidence evidence(CrewVerificationEvidence.Type type, Instant event) {
    return new CrewVerificationEvidence(
        type,
        Station.ISS,
        List.of(new PersonReference(null, "Synthetic Person", List.of(), null)),
        null,
        NasaSourceType.NASA_ISS_OPERATIONAL_POST,
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            URI.create("https://example.test/TEST_ONLY"),
            t,
            t,
            event,
            null,
            null,
            "0".repeat(64),
            "TEST_ONLY",
            "TEST_ONLY"),
        "TEST_ONLY",
        "TEST_ONLY",
        CrewVerificationEvidence.Completeness.PARTIAL,
        type == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
            ? CrewVerificationEvidence.Assertion.COMPLETED
            : CrewVerificationEvidence.Assertion.OBSERVED);
  }

  @Test
  void legacyAndNewPolicyAreIdentifiableAndDifferent() {
    var observed = evidence(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD, null);
    assertTrue(CrewReconciliationPolicy.legacy().key().startsWith("crew-freshness-v1:"));
    assertTrue(CrewReconciliationPolicy.defaults().key().contains("PT168H"));
    assertTrue(CrewReconciliationPolicy.defaults().key().startsWith("crew-freshness-v2:"));
    var at = t.plus(Duration.ofDays(4));
    assertFalse(CrewReconciliationPolicy.legacy().applicable(observed, at, at));
    assertTrue(CrewReconciliationPolicy.defaults().applicable(observed, at, at));
    assertEquals(
        CrewReconciliationPolicy.legacy().key(),
        CrewReconciliationPolicy.defaults().forReplay().key());
  }

  @Test
  void sevenDaysInclusiveToNanosecondAndFutureRejected() {
    var policy = CrewReconciliationPolicy.defaults();
    var e = evidence(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD, null);
    var boundary = t.plus(Duration.ofDays(7));
    assertTrue(policy.applicable(e, boundary.minusNanos(1), boundary.minusNanos(1)));
    assertTrue(policy.applicable(e, boundary, boundary));
    assertFalse(policy.applicable(e, boundary.plusNanos(1), boundary.plusNanos(1)));
    assertFalse(policy.applicable(e, t, t.minusNanos(1)));
  }

  @Test
  void entryFourteenDaysUnchangedAndEventTimePrecedesPublicationProxy() {
    var p = CrewReconciliationPolicy.defaults();
    var e = evidence(CrewVerificationEvidence.Type.PERSON_ENTERED_STATION, null);
    var end = t.plus(Duration.ofDays(14));
    assertTrue(p.applicable(e, end, end));
    assertFalse(p.applicable(e, end.plusNanos(1), end.plusNanos(1)));
    var observed =
        evidence(CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD, t.minusSeconds(3600));
    var at = t.plus(Duration.ofDays(7));
    assertFalse(p.applicable(observed, at, at));
    assertTrue(CrewReconciliationPolicy.legacy().applicable(e, t, t));
  }
}
