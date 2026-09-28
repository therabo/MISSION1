package org.mission1.orbital.domain;

import java.util.Objects;

/** SI Cartesian state in the explicitly named frame. */
public record CartesianState(Vector3 positionMeters, Vector3 velocityMetersPerSecond, String frame) {
    public CartesianState {
        Objects.requireNonNull(positionMeters);
        Objects.requireNonNull(velocityMetersPerSecond);
        if (!"TEME".equals(frame) && !"ITRF_2020_IERS_2010".equals(frame)) {
            throw new IllegalArgumentException("Unsupported orbital frame: " + frame);
        }
    }
}
