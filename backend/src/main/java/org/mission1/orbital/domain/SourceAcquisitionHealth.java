package org.mission1.orbital.domain;

import java.time.Instant;
import java.util.Objects;

/** Provider acquisition status, independent of quality of an already retained element set. */
public record SourceAcquisitionHealth(Status status, Instant lastAttemptAt,
                                      Instant lastSuccessfulFetchAt, String failureCode) {
    public enum Status { UNKNOWN, HEALTHY, DEGRADED }

    public SourceAcquisitionHealth {
        Objects.requireNonNull(status);
        if (status == Status.HEALTHY && failureCode != null) {
            throw new IllegalArgumentException("Healthy acquisition cannot have a current failure");
        }
    }
}
