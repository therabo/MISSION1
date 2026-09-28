package org.mission1.orbital.application;

/** No orbital set was both old enough and observed by the evaluation time. */
public final class NoCurrentOrbitalStateException extends RuntimeException {
    public NoCurrentOrbitalStateException() {
        super("No usable orbital elements have been observed");
    }
}
