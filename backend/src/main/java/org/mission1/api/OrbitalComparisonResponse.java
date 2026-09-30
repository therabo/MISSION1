package org.mission1.api;

import java.time.Instant;
import java.util.List;

import org.mission1.orbital.application.OrbitalSampleWindowService.FullOrbit;
import org.mission1.orbital.oem.NasaOemTrajectoryService;

/** Two separately classified trajectories; each can supply a bounded visualization position. */
public record OrbitalComparisonResponse(Instant generatedAt, Primary primary, Oem oem) {
    public record Primary(String classification, String frame, String positionUnit,
            double orbitalPeriodSeconds, int currentSampleIndex,
            OrbitalSamplesResponse.Source source,
            OrbitalSamplesResponse.Assessment qualityAtGeneratedAt,
            CurrentOrbitalStateResponse.SourceHealth sourceHealth,
            List<OrbitalSamplesResponse.Sample> samples) { }
    public record Oem(String classification, String sampleMethod, String sourceFrame,
            String frame, String positionUnit, String availability, String reason,
            NasaOemTrajectoryService.Source source, List<NasaOemTrajectoryService.Sample> samples) { }

    public static OrbitalComparisonResponse from(FullOrbit orbit, NasaOemTrajectoryService.Result oem) {
        var elements = orbit.elements();
        var evaluation = orbit.evaluation();
        var primary = new Primary("COMPUTED_FROM_ORBITAL_ELEMENTS", "ITRF_2020_IERS_2010", "m",
                orbit.orbitalPeriodSeconds(), 0,
                new OrbitalSamplesResponse.Source(elements.catalogNumber(), elements.provider(), elements.upstreamOrigin(),
                        elements.sourceFormat(), elements.elementEpoch(), elements.retrievedAt(), elements.publishedAt(),
                        elements.sha256(), elements.classification().name(), "OREKIT_TLE_SGP4_SDP4"),
                new OrbitalSamplesResponse.Assessment(evaluation.quality().name(), evaluation.reason().name(),
                        evaluation.policyId(), evaluation.elementEpochAge().toNanos() / 1e9,
                        evaluation.retrievalAge().toNanos() / 1e9),
                CurrentOrbitalStateResponse.SourceHealth.from(evaluation.sourceHealth()),
                orbit.samples().stream().map(OrbitalSamplesResponse.Sample::from).toList());
        return new OrbitalComparisonResponse(orbit.generatedAt(), primary,
                new Oem("SOURCE_PROVIDED_PREDICTED_EPHEMERIS", "CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY",
                        "EME2000", "ITRF_2020_IERS_2010", "m", oem.availability(), oem.reason(),
                        oem.source(), oem.samples()));
    }
}
