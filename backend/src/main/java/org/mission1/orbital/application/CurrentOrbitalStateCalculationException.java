package org.mission1.orbital.application;

import java.util.Objects;

import org.mission1.orbital.domain.OrbitalQualityReason;

/** A selected persisted set could not produce a coordinate-bearing state. */
public final class CurrentOrbitalStateCalculationException extends RuntimeException {
    private final OrbitalQualityReason reason;

    public CurrentOrbitalStateCalculationException(OrbitalQualityReason reason) {
        super("Current orbital state calculation failed: " + Objects.requireNonNull(reason));
        this.reason = reason;
    }

    public OrbitalQualityReason reason() { return reason; }
}
