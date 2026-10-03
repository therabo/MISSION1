package org.mission1;

import org.mission1.crew.application.*;
import org.springframework.scheduling.annotation.Scheduled;

final class CrewVerificationScheduler {
    private static final System.Logger LOG =
            System.getLogger(CrewVerificationScheduler.class.getName());
    private final NasaCrewVerificationIngestionService service;
    private final CrewReconciliationService reconciliation;

    CrewVerificationScheduler(
            NasaCrewVerificationIngestionService service,
            CrewReconciliationService reconciliation) {
        this.service = service;
        this.reconciliation = reconciliation;
    }

    @Scheduled(
            fixedDelayString = "${mission1.crew.verification.fixed-delay:PT2H}",
            initialDelayString = "${mission1.crew.verification.initial-delay:PT10M}")
    void refresh() {
        try {
            var result = service.ingestScheduled();
            LOG.log(
                    System.Logger.Level.INFO,
                    "NASA Crew verification run {0}: {1}, document {2}, new evidence {3}",
                    result.runId(),
                    result.outcome(),
                    result.documentId(),
                    result.evidenceInserted());
            if (!result.outcome().name().startsWith("SKIPPED")) reconciliation.reconcile();
        } catch (RuntimeException e) {
            LOG.log(
                    System.Logger.Level.WARNING,
                    "NASA verification/reconciliation failed: {0}",
                    e.getClass().getSimpleName());
        }
    }
}
