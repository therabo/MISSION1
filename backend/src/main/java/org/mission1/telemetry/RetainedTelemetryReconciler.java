package org.mission1.telemetry;

import java.time.*;
import java.util.*;
import org.slf4j.LoggerFactory;

/** One lifecycle owns both deadlines. Durable state and session ownership are authoritative. */
public final class RetainedTelemetryReconciler implements AutoCloseable {
    public record Policy(boolean enabled,Duration interval,Duration maximumBackoff) {
        public static final Policy DEFAULT=new Policy(true,Duration.ofMinutes(30),Duration.ofHours(6));
        public Policy {
            if (interval.compareTo(Duration.ofMinutes(1))<0 || interval.compareTo(Duration.ofDays(1))>0
                    || maximumBackoff.compareTo(interval)<0 || maximumBackoff.compareTo(Duration.ofDays(7))>0)
                throw new IllegalArgumentException("Invalid retained reconciliation pacing");
        }
    }
    @FunctionalInterface public interface Acquisition { RetainedTelemetryState.Result acquire(String provider,String kind) throws Exception; }
    private final RetainedTelemetryState state;
    private final Clock clock;
    private final TelemetryTimer timer;
    private final Policy policy;
    private final boolean bootstrap;
    private final TelemetryDiagnostics diagnostics;
    private final Acquisition acquisition;
    private final Map<String,Long> generations=new HashMap<>();
    private volatile boolean running;
    private boolean started,closed;
    public RetainedTelemetryReconciler(RetainedTelemetryState state,Clock clock,TelemetryTimer timer,Policy policy,
            boolean bootstrap,TelemetryDiagnostics diagnostics,Acquisition acquisition) {
        this.state=state;this.clock=clock;this.timer=timer;this.policy=policy;this.bootstrap=bootstrap;this.diagnostics=diagnostics;this.acquisition=acquisition;
        diagnostics.retainedEnabled=policy.enabled();diagnostics.clock=clock;
    }
    public synchronized void start() {
        if (started || closed) return;
        started=true;running=true;diagnostics.retainedRunning=policy.enabled() || bootstrap;
        if (policy.enabled() || bootstrap) for (String provider:List.of("SENSEDATA","ISS_LIVE")) arm(provider,clock.instant());
    }
    private synchronized void arm(String provider,Instant deadline) {
        if (!running) return;
        long owner=generations.merge(provider,1L,Long::sum);
        timer.schedule(() -> wake(provider,deadline,owner),deadline);
    }
    private void wake(String provider,Instant scheduled,long owner) {
        synchronized(this) {if (!running || !Objects.equals(generations.get(provider),owner)) return;generations.put(provider,owner+1);}
        boolean reschedule=true;
        Instant next=clock.instant().plus(Duration.ofMinutes(1)); // Local DB/ownership failure; no source retry.
        try {
            var current=state.initializeProvider(provider,clock.instant(),policy.interval(),policy.maximumBackoff());
            diagnostics.providers.put(provider,current);
            if (!policy.enabled() && (!bootstrap || current.bootstrapCompleted())) {reschedule=false;return;}
            next=current.nextEligibleAt();
            if (!next.isAfter(clock.instant())) {
                String kind=bootstrap && !current.bootstrapCompleted()?"RETAINED_BOOTSTRAP":"RETAINED_RECONCILIATION";
                try(var claim=state.claimProvider(provider,scheduled,clock.instant(),policy.interval(),policy.maximumBackoff(),kind)) {
                    if (claim!=null) {
                        diagnostics.providers.put(provider,state.providerState(provider));
                        var result=RetainedTelemetryState.Result.EMPTY;boolean success=false;
                        try { result=acquisition.acquire(provider,kind);success=true; }
                        catch(Exception failure) {
                            if (kind.equals("RETAINED_BOOTSTRAP")) diagnostics.bootstrapFailures.incrementAndGet();
                            LoggerFactory.getLogger(getClass()).warn("Telemetry retained {} {} failed: {}",provider,kind,failure.getClass().getSimpleName());
                            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
                        }
                        claim.complete(clock.instant(),success,result);
                    }
                }
                current=state.providerState(provider);diagnostics.providers.put(provider,current);next=current.nextEligibleAt();
                if (!policy.enabled() && current.bootstrapCompleted()) reschedule=false;
            }
        } catch(RuntimeException failure) {
            diagnostics.persistenceFailures.incrementAndGet();
            LoggerFactory.getLogger(getClass()).warn("Telemetry retained {} coordination failed: {}",provider,failure.getClass().getSimpleName());
        } finally {
            if (!next.isAfter(clock.instant())) next=clock.instant().plus(Duration.ofMinutes(1));
            if (reschedule) arm(provider,next);
            if (!policy.enabled() && diagnostics.providers.size()==2
                    && diagnostics.providers.values().stream().allMatch(RetainedTelemetryState.State::bootstrapCompleted))
                diagnostics.retainedRunning=false;
        }
    }
    @Override public void close() {
        synchronized(this) {
            if (closed) return;
            closed=true;running=false;diagnostics.retainedRunning=false;
        }
        timer.close();
    }
}
