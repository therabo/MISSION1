package org.mission1.crew.domain;

/** Source operation state, separate from future value quality and reconciliation. */
public enum CrewSourceState {
    AVAILABLE, NO_ACTIVE_EXPEDITION, SOURCE_UNAVAILABLE, NOT_FOUND, RATE_LIMITED,
    MALFORMED_RESPONSE, STALE, AMBIGUOUS
}
