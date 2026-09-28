package org.mission1.orbital.propagation;

import org.mission1.orbital.domain.OrbitalQualityReason;

/** No substitute coordinates are returned when propagation or frame conversion fails. */
public class OrbitalCalculationException extends RuntimeException {
    private final OrbitalQualityReason reason;

    public OrbitalCalculationException(OrbitalQualityReason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public OrbitalCalculationException(OrbitalQualityReason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public OrbitalQualityReason reason() { return reason; }
}
