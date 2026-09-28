package org.mission1;

import org.mission1.orbital.application.CelesTrakRefreshService;
import org.springframework.scheduling.annotation.Scheduled;

/** The single-process scheduled trigger; refresh rules remain in the application service. */
final class CelesTrakRefreshScheduler {
    private final CelesTrakRefreshService service;

    CelesTrakRefreshScheduler(CelesTrakRefreshService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${mission1.orbital.celestrak.refresh.interval:PT2H10M}",
               initialDelayString = "${mission1.orbital.celestrak.refresh.initial-delay:PT2H10M}")
    void refresh() { service.refresh(); }
}
