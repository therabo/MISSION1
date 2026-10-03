package org.mission1;

import org.mission1.crew.application.CrewIngestionService;
import org.springframework.scheduling.annotation.Scheduled;

/** Low-frequency Spring trigger; the coordinator owns eligibility and overlap. */
final class CrewIngestionScheduler {
    private static final System.Logger LOG = System.getLogger(CrewIngestionScheduler.class.getName());
    private final CrewIngestionService service;
    private final Runnable afterAttempt;
    CrewIngestionScheduler(CrewIngestionService service) { this(service, () -> { }); }
    CrewIngestionScheduler(CrewIngestionService service, Runnable afterAttempt) { this.service = service; this.afterAttempt = afterAttempt; }

    @Scheduled(fixedDelayString = "${mission1.crew.ingestion.fixed-delay:PT2H}",
               initialDelayString = "${mission1.crew.ingestion.initial-delay:PT5M}")
    void refresh() {
        try {
            var result = service.ingestScheduled();
            LOG.log(result.outcome() == org.mission1.crew.application.CrewSyncRun.Outcome.SUCCESS
                    ? System.Logger.Level.INFO : System.Logger.Level.WARNING,
                    "Crew ingestion run {0}: {1}, snapshot {2}, inserted {3}",
                    result.runId(), result.outcome(), result.snapshotId(), result.snapshotInserted());
            if (!result.outcome().name().startsWith("SKIPPED")) afterAttempt.run();
        } catch (RuntimeException e) {
            LOG.log(System.Logger.Level.WARNING, "Crew ingestion could not record/complete a run: {0}", e.getClass().getSimpleName());
        }
    }
}
