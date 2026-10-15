package org.mission1.telemetry;

import java.time.Instant;
import java.util.*;

public interface TelemetryRepository {
    record Acquisition(UUID id, String provider, String method, String endpoint, Instant acquiredAt,
            String outcome, String diagnostic, int itemCount) {}
    record StoreResult(int inserted,int accepted,int conflicts,Set<String> advancedParameters,int quarantined) {
        public StoreResult(int inserted,int accepted,int conflicts) {this(inserted,accepted,conflicts,Set.of(),0);}
    }
    void initialize(TelemetryCatalog catalog);
    StoreResult store(Acquisition acquisition, List<TelemetryRecord> records);
    default StoreResult store(Acquisition acquisition,List<TelemetryRecord> records,List<TelemetryRecord> futureRejected) {
        if (!futureRejected.isEmpty()) throw new UnsupportedOperationException("Durable time rejection required");
        return store(acquisition,records);
    }
    Map<String,TelemetryRecord> selected(String componentId, Instant at);
    List<TelemetryRecord> history(String parameterId, Instant from, Instant to, String cursor, int limit);
}
