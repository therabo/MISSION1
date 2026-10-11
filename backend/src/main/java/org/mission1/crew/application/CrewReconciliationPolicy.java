package org.mission1.crew.application;

import java.time.*;
import java.util.Set;
import org.mission1.crew.domain.*;

/** Configurable MISSION1 applicability policy, not provider cadence or accuracy. */
public record CrewReconciliationPolicy(
    Duration primaryMaxAge,
    Duration verificationMaxAge,
    Duration currentAssertionMaxAge,
    Duration eventImplicationMaxAge,
    String version) {
  public static final String VERSION = "crew-freshness-v2";
  private static final Duration COUNT_MAX_AGE = Duration.ofHours(72);

  public CrewReconciliationPolicy(
      Duration primary, Duration verification, Duration observation, Duration event) {
    this(primary, verification, observation, event, VERSION);
  }

  /** Historical reference policy; immutable v1 revisions are never relabeled as v2. */
  public static CrewReconciliationPolicy legacy() {
    return new CrewReconciliationPolicy(
        Duration.ofHours(6),
        Duration.ofHours(6),
        Duration.ofHours(72),
        Duration.ofDays(14),
        "crew-freshness-v1");
  }

  /** This Current milestone does not change the accepted public Replay applicability contract. */
  public CrewReconciliationPolicy forReplay() {
    return new CrewReconciliationPolicy(
        primaryMaxAge,
        verificationMaxAge,
        Duration.ofHours(72),
        eventImplicationMaxAge,
        "crew-freshness-v1");
  }

  public CrewReconciliationPolicy {
    if (!Set.of("crew-freshness-v1", VERSION).contains(version))
      throw new IllegalArgumentException("Known freshness policy required");
    for (var d :
        new Duration[] {
          primaryMaxAge, verificationMaxAge, currentAssertionMaxAge, eventImplicationMaxAge
        })
      if (d == null || d.isNegative() || d.isZero())
        throw new IllegalArgumentException("Positive age limit required");
  }

  public static CrewReconciliationPolicy defaults() {
    return new CrewReconciliationPolicy(
        Duration.ofHours(6), Duration.ofHours(6), Duration.ofDays(7), Duration.ofDays(14));
  }

  public boolean fresh(Instant timestamp, Duration max, Instant asOf) {
    return timestamp != null && !timestamp.isAfter(asOf) && !asOf.isAfter(timestamp.plus(max));
  }

  public boolean applicable(CrewVerificationEvidence e, Instant verifiedAt, Instant asOf) {
    return fresh(verifiedAt, verificationMaxAge, asOf)
        && fresh(
            version.equals("crew-freshness-v1")
                ? e.observation().sourcePublishedAt()
                : CrewReconciliationEngine.effectiveTime(e),
            effectiveMaxAge(e),
            asOf);
  }

  public Duration effectiveMaxAge(CrewVerificationEvidence e) {
    return e.type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
            || e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION
        ? eventImplicationMaxAge
        : e.type() == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD
            ? COUNT_MAX_AGE
            : currentAssertionMaxAge;
  }

  public boolean applicableEffectiveTime(CrewVerificationEvidence e, Instant at) {
    return fresh(CrewReconciliationEngine.effectiveTime(e), effectiveMaxAge(e), at);
  }

  public String key() {
    return version
        + ":"
        + primaryMaxAge
        + ":"
        + verificationMaxAge
        + ":"
        + currentAssertionMaxAge
        + ":"
        + eventImplicationMaxAge
        + (version.equals(VERSION) ? "/count=" + COUNT_MAX_AGE : "");
  }
}
