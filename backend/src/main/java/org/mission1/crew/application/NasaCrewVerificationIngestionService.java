package org.mission1.crew.application;

import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

import java.net.URI;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Conditional fetch → immutable document/evidence. Parser and reconciler remain independent. */
public final class NasaCrewVerificationIngestionService {
    public record Result(
            long runId,
            CrewSyncRun.Outcome outcome,
            Long documentId,
            boolean documentInserted,
            int evidenceInserted) {}

    private final CrewVerificationHttpSource source;
    private final CrewPresenceVerificationSource parser;
    private final CrewVerificationRepository verification;
    private final CrewRepository runs;
    private final CrewIngestionPolicy policy;
    private final Clock clock;
    private final URI url;
    private final String parserName, parserVersion;
    private final AtomicBoolean running = new AtomicBoolean();

    public NasaCrewVerificationIngestionService(
            CrewVerificationHttpSource source,
            CrewPresenceVerificationSource parser,
            CrewVerificationRepository verification,
            CrewRepository runs,
            CrewIngestionPolicy policy,
            Clock clock,
            URI url,
            String parserName,
            String parserVersion) {
        this.source = source;
        this.parser = parser;
        this.verification = verification;
        this.runs = runs;
        this.policy = policy;
        this.clock = clock;
        this.url = url;
        this.parserName = parserName;
        this.parserVersion = parserVersion;
    }

    public Result ingest() {
        return execute(false);
    }

    public Result ingestScheduled() {
        return execute(true);
    }

    private Result execute(boolean scheduled) {
        Instant at = now();
        if (!running.compareAndSet(false, true))
            return skip(at, CrewSyncRun.Outcome.SKIPPED_OVERLAP, null);
        try {
            var retry = runs.retryAfterAt(CrewSource.NASA_OFFICIAL, Station.ISS).orElse(null);
            if (retry != null && at.isBefore(retry))
                return skip(at, CrewSyncRun.Outcome.SKIPPED_RATE_LIMIT, retry);
            var last = runs.lastFetchAttemptAt(CrewSource.NASA_OFFICIAL, Station.ISS).orElse(null);
            if (scheduled && last != null && at.isBefore(last.plus(policy.fixedDelay())))
                return skip(at, CrewSyncRun.Outcome.SKIPPED_NOT_DUE, null);
            long run = runs.startRun(CrewSource.NASA_OFFICIAL, Station.ISS, at, url);
            final CrewVerificationHttpSource.Fetch fetched;
            var old =
                    verification
                            .latestDocument(url, parserName, parserVersion)
                            .filter(CrewVerificationRepository.Document::parsed)
                            .orElse(null);
            try {
                fetched =
                        source.fetch(
                                url,
                                old == null ? null : old.source().observation().httpEtag(),
                                old == null ? null : old.source().observation().httpLastModified());
            } catch (RuntimeException e) {
                return fail(
                        run,
                        CrewSyncRun.Outcome.UNEXPECTED_FAILURE,
                        null,
                        null,
                        "SOURCE_EXCEPTION");
            }
            if (fetched.failure() != null) {
                var state =
                        fetched.status() != null && fetched.status() == 429
                                ? CrewSourceState.RATE_LIMITED
                                : fetched.status() != null && fetched.status() == 404
                                        ? CrewSourceState.NOT_FOUND
                                        : fetched.failure().code()
                                                        == CrewSourceResult.FailureCode
                                                                .INVALID_RESPONSE
                                                ? CrewSourceState.MALFORMED_RESPONSE
                                                : CrewSourceState.SOURCE_UNAVAILABLE;
                return fail(
                        run,
                        CrewSyncRun.Outcome.SOURCE_RESULT,
                        state,
                        fetched,
                        fetched.failure().code().name());
            }
            CrewSourceState parsedSourceState = null;
            try {
                if (fetched.status() != null && fetched.status() == 304) {
                    if (old == null)
                        return fail(
                                run,
                                CrewSyncRun.Outcome.SOURCE_RESULT,
                                CrewSourceState.MALFORMED_RESPONSE,
                                fetched,
                                "UNEXPECTED_304");
                    parsedSourceState = CrewSourceState.AVAILABLE;
                    verification.storeNotModified(run, old, fetched.retrievedAt(), now());
                    return new Result(run, CrewSyncRun.Outcome.SUCCESS, old.id(), false, 0);
                }
                if (fetched.contentType() == null
                        || !fetched.contentType().toLowerCase(Locale.ROOT).contains("xml"))
                    return fail(
                            run,
                            CrewSyncRun.Outcome.SOURCE_RESULT,
                            CrewSourceState.MALFORMED_RESPONSE,
                            fetched,
                            "CONTENT_TYPE");
                var o =
                        new CrewSourceObservation(
                                CrewSource.NASA_OFFICIAL,
                                url,
                                fetched.retrievedAt(),
                                null,
                                null,
                                fetched.etag(),
                                fetched.lastModified(),
                                CrewHttpReader.sha256(fetched.body()),
                                "NASA_RSS",
                                parserName + "/" + parserVersion);
                var document =
                        new CrewSourceDocument(
                                NasaSourceType.NASA_ISS_OPERATIONAL_FEED, o, fetched.body());
                var parsed = parser.verify(document);
                parsedSourceState = parsed.state();
                boolean success = parsed.state() == CrewSourceState.AVAILABLE;
                var stored =
                        verification.storeFetch(
                                run,
                                document,
                                fetched.status(),
                                fetched.contentType(),
                                parserName,
                                parserVersion,
                                success ? parsed.value() : List.of(),
                                success,
                                now());
                return new Result(
                        run,
                        success ? CrewSyncRun.Outcome.SUCCESS : CrewSyncRun.Outcome.SOURCE_RESULT,
                        stored.documentId(),
                        stored.inserted(),
                        stored.evidenceInserted());
            } catch (RuntimeException e) {
                return fail(
                        run,
                        CrewSyncRun.Outcome.PERSISTENCE_FAILURE,
                        parsedSourceState,
                        fetched,
                        "PERSISTENCE_FAILURE");
            }
        } finally {
            running.set(false);
        }
    }

    private Result skip(Instant at, CrewSyncRun.Outcome outcome, Instant retry) {
        long run = runs.startRun(CrewSource.NASA_OFFICIAL, Station.ISS, at, url);
        runs.completeRun(
                run,
                new CrewRepository.Completion(
                        now(), outcome, null, null, null, null, retry, null, null));
        return new Result(run, outcome, null, false, 0);
    }

    private Result fail(
            long run,
            CrewSyncRun.Outcome outcome,
            CrewSourceState state,
            CrewVerificationHttpSource.Fetch fetch,
            String code) {
        String retry =
                fetch == null || fetch.failure() == null ? null : fetch.failure().retryAfter();
        Instant retryAt =
                state == CrewSourceState.RATE_LIMITED
                        ? policy.retryAfter(retry, fetch.retrievedAt())
                        : null;
        if (state == CrewSourceState.RATE_LIMITED && retryAt == null)
            retryAt = now().plus(policy.fixedDelay());
        CrewSourceObservation observation = null;
        if (fetch != null && fetch.body() != null) {
            observation =
                    new CrewSourceObservation(
                            CrewSource.NASA_OFFICIAL,
                            url,
                            fetch.retrievedAt(),
                            null,
                            null,
                            fetch.etag(),
                            fetch.lastModified(),
                            CrewHttpReader.sha256(fetch.body()),
                            "NASA_RSS",
                            parserName + "/" + parserVersion);
        }
        runs.completeRun(
                run,
                new CrewRepository.Completion(
                        now(),
                        outcome,
                        state,
                        fetch == null ? null : fetch.status(),
                        observation,
                        retry,
                        retryAt,
                        code,
                        "NASA verification failed"));
        return new Result(run, outcome, null, false, 0);
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
