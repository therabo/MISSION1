package org.mission1.orbital.application;

import java.time.Duration;
import java.util.Objects;

/** MISSION1-defined current-display policy, never a position-error bound. */
public record OrbitalFreshnessPolicy(String id, Duration maxCurrentElementAge) {
    public OrbitalFreshnessPolicy {
        Objects.requireNonNull(id);
        Objects.requireNonNull(maxCurrentElementAge);
        if (id.isBlank() || maxCurrentElementAge.isNegative() || maxCurrentElementAge.isZero()) {
            throw new IllegalArgumentException("Policy ID and positive age limit required");
        }
    }

    public static OrbitalFreshnessPolicy standardGpCurrent() {
        return new OrbitalFreshnessPolicy("orbital-current-v1", Duration.ofHours(24));
    }
}
