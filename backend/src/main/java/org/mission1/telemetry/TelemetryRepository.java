package org.mission1.telemetry;

import java.time.Instant;
import java.util.*;

public interface TelemetryRepository {
    record Acquisition(UUID id, String provider, String method, String endpoint, Instant acquiredAt,
            String outcome, String diagnostic, int itemCount) {}
    record StoreResult(int inserted, int accepted, int conflicts) {}
    void initialize(TelemetryCatalog catalog);
    StoreResult store(Acquisition acquisition, List<TelemetryRecord> records);
    Map<String,TelemetryRecord> selected(String componentId, Instant at);
    List<TelemetryRecord> history(String parameterId, Instant from, Instant to, String cursor, int limit);
    boolean claimBootstrap(String provider, Instant now);
    void completeBootstrap(String provider);
}
