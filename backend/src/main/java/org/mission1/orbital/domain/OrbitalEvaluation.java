package org.mission1.orbital.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/** As-of-time assessment; state and element lineage are absent when no usable set exists. */
public record OrbitalEvaluation(
        OrbitalState state,
        Quality quality,
        OrbitalQualityReason reason,
        Instant evaluationTime,
        Instant propagationTime,
        Duration retrievalAge,
        Duration elementEpochAge,
        Duration propagationOffset,
        String elementSha256,
        Instant elementEpoch,
        Instant retrievedAt,
        String provider,
        SourceAcquisitionHealth sourceHealth,
        String policyId) {
    public OrbitalEvaluation {
        Objects.requireNonNull(quality);
        Objects.requireNonNull(reason);
        Objects.requireNonNull(evaluationTime);
        Objects.requireNonNull(propagationTime);
        Objects.requireNonNull(sourceHealth);
        Objects.requireNonNull(policyId);
        if (state == null && quality != Quality.NO_DATA && quality != Quality.INVALID) {
            throw new IllegalArgumentException("This quality requires a computed state");
        }
        if (state != null && quality != Quality.GOOD && quality != Quality.STALE && quality != Quality.UNKNOWN) {
            throw new IllegalArgumentException("This quality cannot carry coordinates");
        }
        if (state != null && state.quality() != quality) {
            throw new IllegalArgumentException("State and evaluation quality differ");
        }
    }
}
