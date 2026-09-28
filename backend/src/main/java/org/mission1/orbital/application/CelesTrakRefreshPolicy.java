package org.mission1.orbital.application;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/** MISSION1 retrieval policy, separate from orbital-current-v1. */
public record CelesTrakRefreshPolicy(Duration minimumInterval) {
    public CelesTrakRefreshPolicy {
        Objects.requireNonNull(minimumInterval);
        if (minimumInterval.compareTo(Duration.ofHours(2)) < 0) {
            throw new IllegalArgumentException("CelesTrak GP refresh interval must be at least two hours");
        }
    }

    public boolean shouldFetch(Instant now, Instant lastSuccessfulRetrieval) {
        Objects.requireNonNull(now);
        return lastSuccessfulRetrieval == null
                || !now.isBefore(lastSuccessfulRetrieval.plus(minimumInterval));
    }
}
