package org.mission1.api;

import org.mission1.telemetry.TelemetryDiagnostics;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;

/** Operational source state only. No per-value freshness classification. */
@RestController
public class TelemetryDiagnosticsController {
    private final TelemetryDiagnostics diagnostics;
    public TelemetryDiagnosticsController(TelemetryDiagnostics diagnostics) { this.diagnostics=diagnostics; }
    @GetMapping("/api/iss/telemetry/diagnostics")
    public ResponseEntity<TelemetryDiagnostics.Snapshot> status() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(diagnostics.snapshot());
    }
}
