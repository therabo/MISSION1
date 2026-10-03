package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.time.*;

/** Configurable MISSION1 applicability policy, not provider cadence or accuracy. */
public record CrewReconciliationPolicy(
        Duration primaryMaxAge,
        Duration verificationMaxAge,
        Duration currentAssertionMaxAge,
        Duration eventImplicationMaxAge) {
    public static final String VERSION = "crew-freshness-v1";

    public CrewReconciliationPolicy {
        for (var d :
                new Duration[] {
                    primaryMaxAge,
                    verificationMaxAge,
                    currentAssertionMaxAge,
                    eventImplicationMaxAge
                })
            if (d == null || d.isNegative() || d.isZero())
                throw new IllegalArgumentException("Positive age limit required");
    }

    public static CrewReconciliationPolicy defaults() {
        return new CrewReconciliationPolicy(
                Duration.ofHours(6),
                Duration.ofHours(6),
                Duration.ofHours(72),
                Duration.ofDays(14));
    }

    public boolean fresh(Instant timestamp, Duration max, Instant asOf) {
        return timestamp != null && !timestamp.isAfter(asOf) && !asOf.isAfter(timestamp.plus(max));
    }

    public boolean applicable(CrewVerificationEvidence e, Instant verifiedAt, Instant asOf) {
        var max =
                e.type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                                || e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION
                        ? eventImplicationMaxAge
                        : currentAssertionMaxAge;
        return fresh(verifiedAt, verificationMaxAge, asOf)
                && fresh(e.observation().sourcePublishedAt(), max, asOf);
    }

    public Duration effectiveMaxAge(CrewVerificationEvidence e) {
        return e.type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                || e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION
                ? eventImplicationMaxAge : currentAssertionMaxAge;
    }

    public boolean applicableEffectiveTime(CrewVerificationEvidence e, Instant at) {
        return fresh(CrewReconciliationEngine.effectiveTime(e), effectiveMaxAge(e), at);
    }

    public String key() {
        return VERSION
                + ":"
                + primaryMaxAge
                + ":"
                + verificationMaxAge
                + ":"
                + currentAssertionMaxAge
                + ":"
                + eventImplicationMaxAge;
    }
}
