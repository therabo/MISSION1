package org.mission1;

import org.mission1.crew.application.CrewIngestionService;
import org.springframework.scheduling.annotation.Scheduled;

/** Low-frequency Spring trigger; the coordinator owns eligibility and overlap. */
final class CrewIngestionScheduler {
    private static final System.Logger LOG = System.getLogger(CrewIngestionScheduler.class.getName());
    private final CrewIngestionService service;
    CrewIngestionScheduler(CrewIngestionService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${mission1.crew.ingestion.fixed-delay:PT2H}",
               initialDelayString = "${mission1.crew.ingestion.initial-delay:PT5M}")
    void refresh() {
        try {
            var result = service.ingestScheduled();
            LOG.log(result.outcome() == org.mission1.crew.application.CrewSyncRun.Outcome.SUCCESS
                    ? System.Logger.Level.INFO : System.Logger.Level.WARNING,
                    "Crew ingestion run {0}: {1}, snapshot {2}, inserted {3}",
                    result.runId(), result.outcome(), result.snapshotId(), result.snapshotInserted());
        } catch (RuntimeException e) {
            LOG.log(System.Logger.Level.WARNING, "Crew ingestion could not record/complete a run: {0}", e.getClass().getSimpleName());
        }
    }
}
