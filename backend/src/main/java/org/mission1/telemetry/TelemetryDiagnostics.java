package org.mission1.telemetry;

import java.util.concurrent.atomic.AtomicLong;

/** Internal source/worker diagnostics, independent of normal record presentation. */
public final class TelemetryDiagnostics {
    public record Snapshot(String nativeStatus,String subscriptionStatus,long callbacks,long queueDrops,long parseRejects,long persistenceFailures,long bootstrapFailures,long conflicts,long serverLostUpdates) {}
    public volatile String nativeStatus="NOT_STARTED", subscriptionStatus="NOT_STARTED";
    public final AtomicLong callbacks=new AtomicLong(), queueDrops=new AtomicLong(), parseRejects=new AtomicLong(),
            persistenceFailures=new AtomicLong(), bootstrapFailures=new AtomicLong(), conflicts=new AtomicLong(), serverLostUpdates=new AtomicLong();
    public Snapshot snapshot() { return new Snapshot(nativeStatus,subscriptionStatus,callbacks.get(),queueDrops.get(),parseRejects.get(),persistenceFailures.get(),bootstrapFailures.get(),conflicts.get(),serverLostUpdates.get()); }
}
