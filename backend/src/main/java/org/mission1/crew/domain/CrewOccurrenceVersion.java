package org.mission1.crew.domain;

import java.time.Instant;
import java.util.List;

/** Immutable evidence membership and successful capture lineage; independent of person identity. */
public record CrewOccurrenceVersion(String occurrenceKey, long evidenceId, String evidenceHash,
        List<Observation> observations) {
    public CrewOccurrenceVersion { observations = List.copyOf(observations); }
    public record Observation(long runId, long documentId, Instant retrievedAt,
            Instant startedAt, Instant completedAt) {}
}
