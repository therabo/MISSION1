package org.mission1.orbital.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.SourceFailureCategory;
import org.mission1.source.orbital.celestrak.SourceFetchException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** One provider-specific refresh iteration, with no scheduler or REST dependency. */
public final class CelesTrakRefreshService {
    public static final String PROVIDER = "CELESTRAK_GP";
    public static final int ISS_CATALOG_NUMBER = 25544;
    private static final Logger LOG = LoggerFactory.getLogger(CelesTrakRefreshService.class);

    private final OrbitalElementSetRepository repository;
    private final OrbitalElementsSource source;
    private final CelesTrakRefreshPolicy policy;
    private final CelesTrakSourceHealthTracker health;
    private final Clock clock;

    public CelesTrakRefreshService(OrbitalElementSetRepository repository, OrbitalElementsSource source,
                                  CelesTrakRefreshPolicy policy, CelesTrakSourceHealthTracker health, Clock clock) {
        this.repository = Objects.requireNonNull(repository);
        this.source = Objects.requireNonNull(source);
        this.policy = Objects.requireNonNull(policy);
        this.health = Objects.requireNonNull(health);
        this.clock = Objects.requireNonNull(clock);
    }

    /** Synchronized to prevent overlapping attempts in this one application instance. */
    public synchronized CelesTrakRefreshResult refresh() {
        Instant now = clock.instant();
        if (health.suspendedForProviderResponse()) {
            LOG.warn("CelesTrak refresh suspended after non-200 response; operator review required");
            return result(CelesTrakRefreshResult.Outcome.SKIPPED_PROVIDER_SUSPENDED, now, null, null, false);
        }

        final Instant lastSuccess;
        try {
            lastSuccess = repository.lastSuccessfulRetrieval(PROVIDER, ISS_CATALOG_NUMBER).orElse(null);
        } catch (RuntimeException failure) {
            LOG.error("CelesTrak refresh could not read local retrieval history");
            return result(CelesTrakRefreshResult.Outcome.PERSISTENCE_FAILURE, now, null, null, false);
        }
        Instant lastRequest = health.lastAttemptAt();
        Instant lastActivity = lastSuccess == null ? lastRequest
                : lastRequest == null || lastSuccess.isAfter(lastRequest) ? lastSuccess : lastRequest;
        if (!policy.shouldFetch(now, lastActivity)) {
            Instant next = lastActivity.plus(policy.minimumInterval());
            LOG.info("CelesTrak refresh skipped; next eligible at {}", next);
            return result(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, now, next, null, false);
        }

        LOG.info("Eligible CelesTrak ISS GP refresh started");
        final OrbitalElementSet elements;
        try {
            elements = source.fetch();
        } catch (SourceFetchException failure) {
            SourceFailureCategory category = failure.category();
            health.sourceFailed(now, category, failure.httpStatus() != null && failure.httpStatus() != 200);
            LOG.warn("CelesTrak refresh failed: category={}, httpStatus={}", category, failure.httpStatus());
            var outcome = switch (category) {
                case INVALID_RESPONSE, INVALID_TLE, WRONG_SATELLITE -> CelesTrakRefreshResult.Outcome.INVALID_SOURCE_DATA;
                default -> CelesTrakRefreshResult.Outcome.SOURCE_FAILURE;
            };
            return result(outcome, now,
                    failure.httpStatus() != null && failure.httpStatus() != 200
                            ? null : now.plus(policy.minimumInterval()), category, false);
        } catch (RuntimeException failure) {
            health.sourceFailed(now, SourceFailureCategory.UNKNOWN_ERROR, false);
            LOG.warn("CelesTrak refresh failed: category=UNKNOWN_ERROR");
            return result(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, now,
                    now.plus(policy.minimumInterval()), SourceFailureCategory.UNKNOWN_ERROR, false);
        }

        try {
            OrbitalElementSetRepository.StoreResult stored = repository.storeIfNew(elements);
            var outcome = stored.elementInserted()
                    ? CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT
                    : CelesTrakRefreshResult.Outcome.FETCHED_ALREADY_KNOWN_ELEMENT;
            health.succeeded(now, outcome);
            LOG.info("CelesTrak valid fetch: outcome={}, observationInserted={}",
                    outcome, stored.observationInserted());
            return result(outcome, now, elements.retrievedAt().plus(policy.minimumInterval()),
                    null, stored.observationInserted());
        } catch (RuntimeException failure) {
            health.localPersistenceFailedAfterFetch(now);
            LOG.error("CelesTrak valid fetch could not be persisted locally");
            return result(CelesTrakRefreshResult.Outcome.PERSISTENCE_FAILURE, now,
                    now.plus(policy.minimumInterval()), null, false);
        }
    }

    private static CelesTrakRefreshResult result(CelesTrakRefreshResult.Outcome outcome, Instant now,
                                                Instant next, SourceFailureCategory category, boolean observation) {
        return new CelesTrakRefreshResult(outcome, now, next, category, observation);
    }
}
