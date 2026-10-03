package org.mission1.api.crew;

/** Domain availability and resource existence, separate from infrastructure failures. */
public final class CrewReadException extends RuntimeException {
    public enum Reason {
        STATE_UNAVAILABLE,
        PRIMARY_UNAVAILABLE,
        PERSON_NOT_FOUND,
        BAD_REQUEST
    }

    private final Reason reason;

    public CrewReadException(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
