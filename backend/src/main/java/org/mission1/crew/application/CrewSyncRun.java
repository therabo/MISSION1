package org.mission1.crew.application;

import java.net.URI;
import java.time.Instant;
import org.mission1.crew.domain.*;

/** Operational history; source outcome and local processing outcome are separate. */
public record CrewSyncRun(long id, CrewSource source, Station station, Instant startedAt,
        Instant completedAt, Outcome outcome, CrewSourceState sourceState, URI sourceUrl,
        Integer httpStatus, CrewSourceObservation observation, String retryAfter,
        Instant retryAfterAt, String errorCode, String errorSummary, Long snapshotId) {
    public enum Outcome {
        IN_PROGRESS, SUCCESS, SOURCE_RESULT, INVALID_SNAPSHOT, PERSISTENCE_FAILURE,
        UNEXPECTED_FAILURE, SKIPPED_RATE_LIMIT, SKIPPED_NOT_DUE, SKIPPED_OVERLAP
    }
}
