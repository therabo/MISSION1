package org.mission1.crew.application;

/** Bounded Current availability diagnostic, independent of orbital readiness. */
public final class CurrentProjectionUnavailable extends RuntimeException {
    public enum Reason {
        MISSING,
        INCOMPATIBLE,
        INVALID,
        UNAVAILABLE,
        FUTURE
    }

    private final Reason reason;

    public CurrentProjectionUnavailable(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
