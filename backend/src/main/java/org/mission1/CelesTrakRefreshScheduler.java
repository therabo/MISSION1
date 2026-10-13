package org.mission1;

import org.mission1.orbital.application.CelesTrakRefreshService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ScheduledFuture;
import org.mission1.orbital.application.CelesTrakRefreshResult;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import jakarta.annotation.PreDestroy;

/** One cancellable deadline. The durable service gate is always authoritative. */
final class CelesTrakRefreshScheduler {
    private final CelesTrakRefreshService service;
    private final TaskScheduler scheduler;
    private final Clock clock;
    private ScheduledFuture<?> pending;
    private long generation;
    private boolean started;
    private boolean stopped;

    CelesTrakRefreshScheduler(CelesTrakRefreshService service, TaskScheduler scheduler, Clock clock) {
        this.service = service;
        this.scheduler = scheduler;
        this.clock = clock;
    }

    @EventListener(ApplicationReadyEvent.class)
    synchronized void start() {
        if (started || stopped) return;
        started = true;
        arm(clock.instant());
    }

    private void arm(Instant at) {
        if (pending != null) pending.cancel(false);
        long owner = ++generation;
        pending = scheduler.schedule(() -> refresh(owner), at);
    }

    private synchronized void refresh(long owner) {
        if (stopped || owner != generation) return;
        CelesTrakRefreshResult result = service.refresh();
        if (result.outcome() == CelesTrakRefreshResult.Outcome.SKIPPED_PROVIDER_SUSPENDED
                || result.nextEligibleAt() == null && result.failureCategory() != null) return;
        // Missing deadline means local DB failure before HTTP, not provider eligibility.
        Instant deadline = result.nextEligibleAt() == null
                ? clock.instant().plus(Duration.ofMinutes(1)) : result.nextEligibleAt();
        // Timer implementations may floor sub-ms delays. A 1ms ceiling prevents a spin.
        Instant earliest = clock.instant().plusMillis(1);
        arm(deadline.isBefore(earliest) ? earliest : deadline);
    }

    @PreDestroy synchronized void stop() {
        stopped = true;
        generation++;
        if (pending != null) pending.cancel(false);
    }
}
