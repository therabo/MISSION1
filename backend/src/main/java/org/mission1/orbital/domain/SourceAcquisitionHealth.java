package org.mission1.orbital.domain;

import java.time.Instant;
import java.util.Objects;

/** Provider acquisition health; independent of computed orbital-state quality. */
public record SourceAcquisitionHealth(Status status, Instant lastAttemptAt,
                                      Instant lastSuccessfulFetchAt, Instant lastFailureAt,
                                      int consecutiveFailures, SourceFailureCategory lastFailureCategory,
                                      String lastSuccessfulResult) {
    public enum Status { UNKNOWN, HEALTHY, DEGRADED }

    public SourceAcquisitionHealth {
        Objects.requireNonNull(status);
        if (consecutiveFailures < 0) throw new IllegalArgumentException("Negative failure count");
        if (status == Status.HEALTHY && consecutiveFailures != 0) {
            throw new IllegalArgumentException("Healthy acquisition cannot have consecutive failures");
        }
    }

    public static SourceAcquisitionHealth unknown() {
        return new SourceAcquisitionHealth(Status.UNKNOWN, null, null, null, 0, null, null);
    }
}
