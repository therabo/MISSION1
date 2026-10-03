package org.mission1.api.replay;

import org.mission1.replay.MissionReplayQueryService;
import org.springframework.http.*;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.*;

import java.time.*;

@RestController
@RequestMapping("/api/iss/replay")
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class ReplayController {
    private final MissionReplayQueryService query;

    public ReplayController(MissionReplayQueryService query) {
        this.query = query;
    }

    @GetMapping
    public ResponseEntity<MissionReplayQueryService.Result> at(@RequestParam String at) {
        Instant t;
        try {
            t = Instant.parse(at);
            if (t.isBefore(Instant.parse("1900-01-01T00:00:00Z")))
                throw new IllegalArgumentException();
        } catch (DateTimeException | IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "at must be a UTC ISO-8601 instant from 1900 onwards");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(query.at(t));
    }

    @GetMapping("/coverage")
    public ResponseEntity<MissionReplayQueryService.Coverage> coverage() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(query.coverage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> invalid(IllegalArgumentException e) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        detail.setTitle("Invalid replay time");
        return ResponseEntity.badRequest().body(detail);
    }
}
