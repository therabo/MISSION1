package org.mission1.crew.domain;

import java.time.Duration;
import java.time.Instant;
public record CareerStatistics(Duration timeInSpace, Duration evaTime, Integer flightsCount,
        Integer spacewalksCount, Instant firstFlight, Instant lastFlight) {
    public CareerStatistics {
        if ((timeInSpace != null && timeInSpace.isNegative()) || (evaTime != null && evaTime.isNegative())
                || (flightsCount != null && flightsCount < 0) || (spacewalksCount != null && spacewalksCount < 0))
            throw new IllegalArgumentException("Career statistics must be nonnegative");
    }
}
