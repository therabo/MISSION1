package org.mission1.crew.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import org.mission1.crew.domain.*;

/** Internal source-aware reads; no canonical presence or public API. */
public final class CrewQueryService {
    public record Latest(CrewRepository.StoredSnapshot snapshot, CrewSyncRun successfulRun) {
        public Instant latestSuccessfulFetchAt() { return successfulRun.observation().retrievedAt(); }
    }
    public record Status(Optional<CrewSyncRun> lastAttempt, Optional<CrewSyncRun> lastSuccess,
            Optional<CrewSyncRun> lastFailure, Optional<Instant> retryAfterAt, boolean rateLimited) { }
    private final CrewRepository repository;
    private final Clock clock;

    public CrewQueryService(CrewRepository repository, Clock clock) {
        this.repository = Objects.requireNonNull(repository); this.clock = Objects.requireNonNull(clock);
    }

    public Optional<Latest> latest(CrewSource source, Station station) {
        return repository.latestSuccess(source, station).map(run -> new Latest(
                repository.findSnapshot(run.snapshotId()).orElseThrow(
                        () -> new IllegalStateException("Successful Crew run has no snapshot")), run));
    }

    public Status status(CrewSource source, Station station) {
        var retry = repository.retryAfterAt(source, station);
        return new Status(repository.latestRun(source, station), repository.latestSuccess(source, station),
                repository.latestFailure(source, station), retry, retry.filter(t -> clock.instant().isBefore(t)).isPresent());
    }
}
