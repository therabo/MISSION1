package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.time.*;
import java.util.*;

/** Durable planning observations and operational decisions, separate from roster truth. */
public interface CrewRefreshRepository {
    record CatalogRun(
            long id,
            Instant startedAt,
            Instant retrievedAt,
            String result,
            Instant retryAfterAt,
            List<CrewRefreshPolicy.Candidate> candidates) {}

    boolean withCoordinatorLock(Runnable work);

    Optional<CatalogRun> latestCatalog();

    Optional<Instant> lastCatalogAttempt();

    Instant ll2EligibleAt(Instant now, int hourlyBudget);

    long startCatalog(CrewEventSource.Request request, Instant at, long triggerId);

    void completeCatalog(
            long runId,
            CrewSourceResult<CrewEventSource.Catalog> result,
            Instant at,
            Instant retryAt);

    void failCatalog(
            long runId,
            Instant at,
            String code,
            CrewSourceResult<CrewEventSource.Catalog> fetched,
            Instant retryAt);

    long trigger(String key, CrewRefreshPolicy.Decision decision, Instant createdAt);

    void openFollowUp(long evidenceId, Instant context, Instant deadline, Instant at);

    List<CrewRefreshPolicy.FollowUp> followUps();

    void closeFollowUp(long id, String state, Instant at);
}
