package org.mission1.api;

import org.mission1.orbital.application.OrbitalSampleWindow;
import org.mission1.orbital.application.OrbitalSampleWindowService;
import org.mission1.orbital.oem.NasaOemTrajectoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only computed orbit positions for a bounded Cesium visual buffer. */
@RestController
@RequestMapping("/api/iss/orbit")
public final class OrbitalSamplesController {
    private final OrbitalSampleWindowService service;
    private final NasaOemTrajectoryService oem;

    public OrbitalSamplesController(OrbitalSampleWindowService service, NasaOemTrajectoryService oem) {
        this.service = service;
        this.oem = oem;
    }

    @GetMapping("/samples")
    public OrbitalSamplesResponse samples(@RequestParam(defaultValue = "120") int pastSeconds,
                                          @RequestParam(defaultValue = "600") int futureSeconds,
                                          @RequestParam(defaultValue = "10") int stepSeconds) {
        return OrbitalSamplesResponse.from(service.generate(
                new OrbitalSampleWindow(pastSeconds, futureSeconds, stepSeconds)));
    }

    @GetMapping("/comparison")
    public OrbitalComparisonResponse comparison() {
        var primary = service.generateFullOrbit();
        return OrbitalComparisonResponse.from(primary, oem.comparison(primary));
    }
}
