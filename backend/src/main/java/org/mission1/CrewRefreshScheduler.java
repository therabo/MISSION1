package org.mission1;

import org.mission1.crew.application.CrewRefreshCoordinator;
import org.springframework.scheduling.annotation.Scheduled;

/** Composition-level tick, no HTTP or domain decisions here. */
final class CrewRefreshScheduler {
    private static final System.Logger LOG = System.getLogger(CrewRefreshScheduler.class.getName());
    private final CrewRefreshCoordinator coordinator;

    CrewRefreshScheduler(CrewRefreshCoordinator coordinator) {
        this.coordinator = coordinator;
    }

    @Scheduled(
            fixedDelayString = "${mission1.crew.refresh.tick:PT1M}",
            initialDelayString = "${mission1.crew.refresh.tick:PT1M}")
    void refresh() {
        try {
            coordinator.tick();
        } catch (RuntimeException e) {
            LOG.log(
                    System.Logger.Level.WARNING,
                    "Crew refresh tick failed: {0}",
                    e.getClass().getSimpleName());
        }
    }
}
