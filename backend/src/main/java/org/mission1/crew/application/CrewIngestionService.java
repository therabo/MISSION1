package org.mission1.crew.application;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import org.mission1.crew.domain.*;

/** Process-local coordinator; all manual and scheduled callers share overlap/rate-limit rules. */
public final class CrewIngestionService {
    public record Result(long runId, CrewSyncRun.Outcome outcome, Long snapshotId, boolean snapshotInserted) { }
    private static final System.Logger LOG = System.getLogger(CrewIngestionService.class.getName());
    private final StructuredCrewSource source;
    private final CrewRepository repository;
    private final CrewIngestionPolicy policy;
    private final Clock clock;
    private final URI sourceUrl;
    private final AtomicBoolean running = new AtomicBoolean();

    public CrewIngestionService(StructuredCrewSource source, CrewRepository repository,
            CrewIngestionPolicy policy, Clock clock, URI sourceUrl) {
        this.source = Objects.requireNonNull(source); this.repository = Objects.requireNonNull(repository);
        this.policy = Objects.requireNonNull(policy); this.clock = Objects.requireNonNull(clock);
        this.sourceUrl = Objects.requireNonNull(sourceUrl);
    }

    public Result ingest() { return execute(false); }
    public Result ingestScheduled() { return execute(true); }

    private Result execute(boolean scheduled) {
        Instant started = now();
        if (!running.compareAndSet(false, true)) return skipped(started, CrewSyncRun.Outcome.SKIPPED_OVERLAP, null);
        try {
            var retry = repository.retryAfterAt(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElse(null);
            if (retry != null && started.isBefore(retry)) return skipped(started, CrewSyncRun.Outcome.SKIPPED_RATE_LIMIT, retry);
            var last = repository.lastFetchAttemptAt(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElse(null);
            if (scheduled && last != null && started.isBefore(last.plus(policy.fixedDelay())))
                return skipped(started, CrewSyncRun.Outcome.SKIPPED_NOT_DUE, null);
            long run = repository.startRun(CrewSource.LAUNCH_LIBRARY_2, Station.ISS, started, sourceUrl);
            CrewSourceResult<CrewSourceSnapshot> fetched;
            try { fetched = source.fetchCurrentExpedition(Station.ISS); }
            catch (RuntimeException e) {
                return fail(run, CrewSyncRun.Outcome.UNEXPECTED_FAILURE, null, "SOURCE_EXCEPTION", "Crew source call failed");
            }
            if (fetched.state() != CrewSourceState.AVAILABLE) {
                String code = fetched.failure() == null ? fetched.state().name() : fetched.failure().code().name();
                return fail(run, CrewSyncRun.Outcome.SOURCE_RESULT, fetched, code, "Crew source returned " + fetched.state());
            }
            try {
                CrewSnapshotValidator.validate(fetched.value());
                if (!fetched.value().observation().equals(fetched.observation()))
                    throw new IllegalArgumentException("Result and snapshot lineage differ");
            } catch (IllegalArgumentException e) {
                return fail(run, CrewSyncRun.Outcome.INVALID_SNAPSHOT, fetched, "INVALID_SNAPSHOT", "Crew snapshot failed semantic validation");
            }
            final CrewRepository.StoreResult stored;
            try {
                stored = repository.storeSuccessfulRun(run, fetched.value(), completion(
                        CrewSyncRun.Outcome.SUCCESS, fetched, null, null));
            } catch (RuntimeException e) {
                LOG.log(System.Logger.Level.WARNING, "Crew snapshot transaction failed for run {0}: {1}", run, e.getClass().getSimpleName());
                return fail(run, CrewSyncRun.Outcome.PERSISTENCE_FAILURE, fetched, "PERSISTENCE_FAILURE", "Crew snapshot transaction rolled back");
            }
            return new Result(run, CrewSyncRun.Outcome.SUCCESS, stored.snapshotId(), stored.inserted());
        } finally { running.set(false); }
    }

    private Result skipped(Instant started, CrewSyncRun.Outcome outcome, Instant retry) {
        long run = repository.startRun(CrewSource.LAUNCH_LIBRARY_2, Station.ISS, started, sourceUrl);
        repository.completeRun(run, new CrewRepository.Completion(now(), outcome, null, null, null, null, retry, null, null));
        return new Result(run, outcome, null, false);
    }

    private Result fail(long run, CrewSyncRun.Outcome outcome, CrewSourceResult<?> result, String code, String summary) {
        repository.completeRun(run, completion(outcome, result, code, summary));
        return new Result(run, outcome, null, false);
    }

    private CrewRepository.Completion completion(CrewSyncRun.Outcome outcome, CrewSourceResult<?> result,
            String code, String summary) {
        var observation = result == null ? null : result.observation();
        var failure = result == null ? null : result.failure();
        String retry = failure == null ? null : failure.retryAfter();
        Instant retryAt = result != null && result.state() == CrewSourceState.RATE_LIMITED
                ? policy.retryAfter(retry, observation == null ? now() : observation.retrievedAt()) : null;
        // A missing/invalid Retry-After still applies the conservative normal delay to manual callers.
        if (result != null && result.state() == CrewSourceState.RATE_LIMITED && retryAt == null)
            retryAt = now().plus(policy.fixedDelay());
        return new CrewRepository.Completion(now(), outcome, result == null ? null : result.state(),
                result == null ? null : result.httpStatus(), observation, retry, retryAt, code, summary);
    }

    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
}
