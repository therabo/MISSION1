package org.mission1.crew.domain;

/** Field-aware reconciliation outcome; source health and per-person presence remain separate. */
public enum ReconciliationStatus {
    MATCH, NASA_AHEAD, LL2_AHEAD, PARTIAL_MATCH, PRIMARY_UNAVAILABLE,
    VERIFICATION_UNAVAILABLE, STALE, AMBIGUOUS
}
