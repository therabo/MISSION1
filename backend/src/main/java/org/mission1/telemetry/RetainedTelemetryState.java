package org.mission1.telemetry;

import java.time.*;

/** Acquisition coordination only; never spacecraft state or a mutable value head. */
public interface RetainedTelemetryState {
    record Result(int fetched,int mapped,int admitted,int duplicates,int rejected,int headsAdvanced,
            int responseBytes,double fetchMilliseconds,double parseMilliseconds,double databaseMilliseconds) {
        public static final Result EMPTY=new Result(0,0,0,0,0,0,0,0,0,0);
    }
    record State(String provider,Instant lastAttemptAt,Instant lastSuccessAt,Instant nextEligibleAt,
            int consecutiveFailures,String lastOutcome,String lastKind,Instant scheduledAt,Instant completedAt,
            boolean bootstrapCompleted,Result result) {}
    interface Claim extends AutoCloseable {
        void complete(Instant now,boolean success,Result result);
        @Override void close();
    }
    State initializeProvider(String provider,Instant now,Duration interval,Duration maximumBackoff);
    State providerState(String provider);
    /** Null means another owner or not eligible. A claim commits pacing before any external request. */
    Claim claimProvider(String provider,Instant scheduledAt,Instant now,Duration interval,Duration maximumBackoff,String kind);
}
