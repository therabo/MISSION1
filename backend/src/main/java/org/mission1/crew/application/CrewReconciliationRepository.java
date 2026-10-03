package org.mission1.crew.application;

import org.mission1.crew.domain.CrewReconciliationSnapshot;

import java.time.Instant;
import java.util.Optional;

public interface CrewReconciliationRepository {
    record Stored(long id, CrewReconciliationSnapshot value) {}

    record Result(long runId, long snapshotId, boolean inserted) {}

    long startRun(Instant asOf, String algorithmVersion);

    Result store(
            long runId, CrewReconciliationSnapshot snapshot, String stateKey, Instant completedAt);

    void fail(long runId, Instant completedAt, String errorCode);

    record Run(
            long id,
            Instant startedAt,
            Instant completedAt,
            String result,
            String errorCode,
            Long snapshotId,
            String algorithmVersion) {}

    Optional<Run> latestRun();

    Optional<Stored> latest();
}
