package org.mission1.orbital.propagation;

/** No substitute coordinates are returned when propagation or frame conversion fails. */
public class OrbitalCalculationException extends RuntimeException {
    public OrbitalCalculationException(String message, Throwable cause) {
        super(message, cause);
    }

    public OrbitalCalculationException(String message) {
        super(message);
    }
}
