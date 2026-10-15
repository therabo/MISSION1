package org.mission1.telemetry;

import java.time.*;
import java.util.concurrent.*;

/** Small controllable deadline abstraction; two providers cannot block each other's timer. */
public interface TelemetryTimer extends AutoCloseable {
    void schedule(Runnable action,Instant at);
    @Override void close();
    static TelemetryTimer owned(Clock clock) {
        return new TelemetryTimer() {
            private final ScheduledThreadPoolExecutor executor=new ScheduledThreadPoolExecutor(2,r -> {
                var thread=new Thread(r,"telemetry-retained");thread.setDaemon(true);return thread;
            });
            { executor.setRemoveOnCancelPolicy(true);executor.setExecuteExistingDelayedTasksAfterShutdownPolicy(false); }
            public void schedule(Runnable action,Instant at) {
                executor.schedule(action,Math.max(1,Duration.between(clock.instant(),at).toMillis()),TimeUnit.MILLISECONDS);
            }
            public void close() {
                executor.shutdownNow();
                try { executor.awaitTermination(5,TimeUnit.SECONDS); }
                catch (InterruptedException stop) { Thread.currentThread().interrupt(); }
            }
        };
    }
}
