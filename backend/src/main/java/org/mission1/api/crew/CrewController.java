package org.mission1.api.crew;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** HTTP mapping only. Source/reconciliation writes are not reachable through this controller. */
@RestController
@RequestMapping("/api/iss")
public final class CrewController {
    private final CrewRestQueryService query;

    public CrewController(CrewRestQueryService query) {
        this.query = query;
    }

    @GetMapping("/crew")
    public ResponseEntity<CrewResponses.Crew> crew() {
        return read(query.crew());
    }

    @GetMapping("/expedition/current")
    public ResponseEntity<CrewResponses.CurrentExpedition> expedition() {
        return read(query.expedition());
    }

    @GetMapping("/crew/{astronautId}")
    public ResponseEntity<CrewResponses.Person> person(@PathVariable String astronautId) {
        // UUID.fromString accepts shortened groups; enforce the documented canonical resource
        // syntax.
        if (!astronautId.matches(
                "(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
            throw new CrewReadException(CrewReadException.Reason.BAD_REQUEST);
        return read(query.person(UUID.fromString(astronautId)));
    }

    private static <T> ResponseEntity<T> read(T value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }
}
