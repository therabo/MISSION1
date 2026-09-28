package org.mission1.orbital.application;

import java.time.Instant;

import org.mission1.orbital.domain.SourceAcquisitionHealth;
import org.mission1.orbital.domain.SourceFailureCategory;

/** Process-local failure state; durable success time is supplied by the repository. */
public final class CelesTrakSourceHealthTracker {
    private SourceAcquisitionHealth.Status status = SourceAcquisitionHealth.Status.UNKNOWN;
    private Instant lastAttemptAt;
    private Instant lastFailureAt;
    private int consecutiveFailures;
    private SourceFailureCategory lastFailureCategory;
    private String lastSuccessfulResult;
    private boolean suspendedForProviderResponse;

    public synchronized SourceAcquisitionHealth snapshot(Instant persistedLastSuccess) {
        return new SourceAcquisitionHealth(status, lastAttemptAt, persistedLastSuccess, lastFailureAt,
                consecutiveFailures, lastFailureCategory, lastSuccessfulResult);
    }

    public synchronized Instant lastAttemptAt() { return lastAttemptAt; }

    public synchronized boolean suspendedForProviderResponse() { return suspendedForProviderResponse; }

    public synchronized void succeeded(Instant attemptAt, CelesTrakRefreshResult.Outcome outcome) {
        lastAttemptAt = attemptAt;
        status = SourceAcquisitionHealth.Status.HEALTHY;
        consecutiveFailures = 0;
        lastSuccessfulResult = outcome.name();
        suspendedForProviderResponse = false;
    }

    public synchronized void sourceFailed(Instant attemptAt, SourceFailureCategory category,
                                          boolean nonHttp200) {
        lastAttemptAt = attemptAt;
        lastFailureAt = attemptAt;
        status = SourceAcquisitionHealth.Status.DEGRADED;
        consecutiveFailures++;
        lastFailureCategory = category;
        if (nonHttp200) suspendedForProviderResponse = true;
    }

    public synchronized void localPersistenceFailedAfterFetch(Instant attemptAt) {
        lastAttemptAt = attemptAt;
    }
}
