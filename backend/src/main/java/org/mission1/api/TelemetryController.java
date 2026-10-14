package org.mission1.api;

import java.time.*;
import org.mission1.telemetry.TelemetryQueryService;
import org.springframework.http.*;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/iss")
@Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
public class TelemetryController {
    private final TelemetryQueryService query;
    public TelemetryController(TelemetryQueryService query) { this.query=query; }
    @GetMapping("/components/{componentId}/telemetry")
    public ResponseEntity<TelemetryQueryService.Component> component(@PathVariable String componentId,@RequestParam(required=false) String at) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(query.component(componentId,at==null?null:instant(at)));
    }
    @GetMapping("/telemetry/parameters/{parameterId}/history")
    public ResponseEntity<TelemetryQueryService.History> history(@PathVariable String parameterId,@RequestParam String from,@RequestParam String to,
            @RequestParam(defaultValue="100") int limit,@RequestParam(required=false) String cursor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(query.history(parameterId,instant(from),instant(to),cursor,limit));
    }
    private static Instant instant(String value) {
        try { if (!value.endsWith("Z")) throw new IllegalArgumentException();return Instant.parse(value); }
        catch (DateTimeException | IllegalArgumentException e) { throw new IllegalArgumentException("Expected UTC ISO-8601 instant ending in Z"); }
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> invalid(IllegalArgumentException error) {
        var status=error instanceof TelemetryQueryService.UnknownResource?HttpStatus.NOT_FOUND:HttpStatus.BAD_REQUEST;
        var detail=ProblemDetail.forStatusAndDetail(status,error.getMessage());detail.setTitle("Telemetry request error");
        return ResponseEntity.status(status).body(detail);
    }
}
