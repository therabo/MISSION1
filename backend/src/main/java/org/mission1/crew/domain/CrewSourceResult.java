package org.mission1.crew.domain;

import java.util.Objects;
public record CrewSourceResult<T>(CrewSourceState state, T value, CrewSourceObservation observation,
        Failure failure) {
    public enum FailureCode { TIMEOUT, NETWORK_ERROR, INTERRUPTED, HTTP_ERROR, INVALID_RESPONSE }
    public record Failure(FailureCode code, Integer httpStatus, String retryAfter) { }
    public CrewSourceResult {
        Objects.requireNonNull(state);
        boolean dataState = state == CrewSourceState.AVAILABLE || state == CrewSourceState.NO_ACTIVE_EXPEDITION
                || state == CrewSourceState.AMBIGUOUS || state == CrewSourceState.STALE;
        if (dataState && (value == null || failure != null || observation == null))
            throw new IllegalArgumentException("Data result requires observation and value");
        if (!dataState && (value != null || failure == null)) throw new IllegalArgumentException("Failure result invalid");
    }
}
