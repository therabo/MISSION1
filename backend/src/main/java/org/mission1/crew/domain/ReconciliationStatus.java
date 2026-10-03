package org.mission1.crew.domain;

/** Vocabulary only: no reconciliation algorithm or source winner exists yet. */
public enum ReconciliationStatus {
    MATCH, NASA_AHEAD, LL2_AHEAD, PARTIAL_MATCH, PRIMARY_UNAVAILABLE,
    VERIFICATION_UNAVAILABLE, STALE, AMBIGUOUS
}
