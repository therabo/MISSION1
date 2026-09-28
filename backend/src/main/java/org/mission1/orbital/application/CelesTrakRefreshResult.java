package org.mission1.orbital.application;

import java.time.Instant;

import org.mission1.orbital.domain.SourceFailureCategory;

/** Outcome of one scheduled evaluation; a skip makes no provider request. */
public record CelesTrakRefreshResult(Outcome outcome, Instant evaluatedAt,
                                    Instant nextEligibleAt, SourceFailureCategory failureCategory,
                                    boolean observationInserted) {
    public enum Outcome {
        FETCHED_NEW_ELEMENT, FETCHED_ALREADY_KNOWN_ELEMENT, SKIPPED_TOO_SOON,
        SKIPPED_PROVIDER_SUSPENDED, SOURCE_FAILURE, INVALID_SOURCE_DATA, PERSISTENCE_FAILURE
    }
}
