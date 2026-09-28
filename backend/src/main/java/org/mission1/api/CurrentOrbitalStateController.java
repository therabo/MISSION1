package org.mission1.api;

import org.mission1.orbital.application.CurrentOrbitalStateService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The read operation has no source acquisition or persistence logic. */
@RestController
@RequestMapping("/api/iss")
public final class CurrentOrbitalStateController {
    private final CurrentOrbitalStateService service;

    public CurrentOrbitalStateController(CurrentOrbitalStateService service) {
        this.service = service;
    }

    @GetMapping("/state")
    public CurrentOrbitalStateResponse current() {
        return CurrentOrbitalStateResponse.from(service.current());
    }
}
