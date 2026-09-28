package org.mission1.api;

import org.mission1.orbital.application.OrbitalSampleWindow;
import org.mission1.orbital.application.OrbitalSampleWindowService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only computed orbit positions for a bounded Cesium visual buffer. */
@RestController
@RequestMapping("/api/iss/orbit")
public final class OrbitalSamplesController {
    private final OrbitalSampleWindowService service;

    public OrbitalSamplesController(OrbitalSampleWindowService service) { this.service = service; }

    @GetMapping("/samples")
    public OrbitalSamplesResponse samples(@RequestParam(defaultValue = "120") int pastSeconds,
                                          @RequestParam(defaultValue = "600") int futureSeconds,
                                          @RequestParam(defaultValue = "10") int stepSeconds) {
        return OrbitalSamplesResponse.from(service.generate(
                new OrbitalSampleWindow(pastSeconds, futureSeconds, stepSeconds)));
    }
}
