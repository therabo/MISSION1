package org.mission1.telemetry;

import java.util.concurrent.atomic.AtomicLong;
import java.util.Map;
import java.time.*;
import java.util.concurrent.ConcurrentHashMap;

/** Internal source/worker diagnostics, independent of normal record presentation. */
public final class TelemetryDiagnostics {
    public record Bootstrap(int fetched,int componentMatched,int malformed,int unboundComponentRecords,
            int normalized,int rejected,int inserted,int admitted,int conflicts,int duplicates,int eventBytes,
            double parseMilliseconds,double databaseMilliseconds,Map<String,Long> classifications) {}
    public record Snapshot(String nativeStatus,String subscriptionStatus,long callbacks,long queueDrops,long parseRejects,long persistenceFailures,long bootstrapFailures,long conflicts,long serverLostUpdates,Bootstrap senseData,Retained retained) {}
    public record Provider(RetainedTelemetryState.State state,boolean eligible) {}
    public record Retained(boolean enabled,boolean running,Map<String,Provider> providers) {}
    public volatile boolean retainedEnabled,retainedRunning;
    public volatile Clock clock=Clock.systemUTC();
    public final Map<String,RetainedTelemetryState.State> providers=new ConcurrentHashMap<>();
    public volatile Bootstrap senseData;
    public volatile String nativeStatus="NOT_STARTED", subscriptionStatus="NOT_STARTED";
    public final AtomicLong callbacks=new AtomicLong(), queueDrops=new AtomicLong(), parseRejects=new AtomicLong(),
            persistenceFailures=new AtomicLong(), bootstrapFailures=new AtomicLong(), conflicts=new AtomicLong(), serverLostUpdates=new AtomicLong();
    public Snapshot snapshot() { return new Snapshot(nativeStatus,subscriptionStatus,callbacks.get(),queueDrops.get(),parseRejects.get(),persistenceFailures.get(),bootstrapFailures.get(),conflicts.get(),serverLostUpdates.get(),senseData,new Retained(retainedEnabled,retainedRunning,providers.entrySet().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getKey,e -> new Provider(e.getValue(),!e.getValue().nextEligibleAt().isAfter(clock.instant())))))); }
}
