package org.mission1.crew.application;

import java.net.URI;
import java.time.Instant;
import java.util.Optional;
import org.mission1.crew.domain.*;

/** Atomic storage boundary. No SQL or framework types escape this port. */
public interface CrewRepository {
    record StoredSnapshot(long id, CrewSourceSnapshot snapshot) { }
    record StoreResult(long snapshotId, boolean inserted) { }
    record Completion(Instant completedAt, CrewSyncRun.Outcome outcome, CrewSourceState sourceState,
            Integer httpStatus, CrewSourceObservation observation, String retryAfter,
            Instant retryAfterAt, String errorCode, String errorSummary) { }

    long startRun(CrewSource source, Station station, Instant startedAt, URI sourceUrl);
    void completeRun(long id, Completion completion);
    StoreResult storeSuccessfulRun(long runId, CrewSourceSnapshot snapshot, Completion completion);
    Optional<StoredSnapshot> findSnapshot(long id);
    Optional<CrewSyncRun> findRun(long id);
    Optional<CrewSyncRun> latestRun(CrewSource source, Station station);
    Optional<CrewSyncRun> latestSuccess(CrewSource source, Station station);
    Optional<CrewSyncRun> latestFailure(CrewSource source, Station station);
    Optional<Instant> lastFetchAttemptAt(CrewSource source, Station station);
    Optional<Instant> retryAfterAt(CrewSource source, Station station);
}
