package org.mission1.api;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.mission1.orbital.application.OrbitalSampleWindowService.Window;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.domain.Vector3;

/** Compact Earth-fixed positions with response-level lineage and current-time quality. */
public record OrbitalSamplesResponse(
        Instant generatedAt, Instant windowStart, Instant windowEnd, int stepSeconds,
        String frame, String positionUnit, String velocityUnit, String classification, TimeSemantics timeSemantics,
        Source source, Assessment qualityAtGeneratedAt,
        CurrentOrbitalStateResponse.SourceHealth sourceHealth,
        CurrentGeodetic currentGeodetic, List<Sample> samples) {

    public record TimeSemantics(String past, String atGeneratedAt, String future) { }
    public record Source(int noradCatalogNumber, String provider, String upstreamOrigin,
                         String sourceFormat, Instant elementEpoch, Instant retrievedAt,
                         Instant publishedAt, String elementSha256, String classification,
                         String propagationMethod) { }
    public record Assessment(String status, String reason, String policy,
                             double elementAgeSeconds, double retrievalAgeSeconds) { }
    public record CurrentGeodetic(String datum, double latitudeDegrees, double longitudeDegrees,
                                  double altitudeMeters) { }
    public record Sample(Instant time, double xMeters, double yMeters, double zMeters,
                         double vxMetersPerSecond, double vyMetersPerSecond, double vzMetersPerSecond) {
        static Sample from(OrbitalState state) {
            Vector3 point = state.earthFixed().positionMeters();
            Vector3 velocity = state.earthFixed().velocityMetersPerSecond();
            return new Sample(state.propagationTime(), point.x(), point.y(), point.z(),
                    velocity.x(), velocity.y(), velocity.z());
        }
    }

    public static OrbitalSamplesResponse from(Window window) {
        var elements = window.elements();
        var evaluation = window.evaluation();
        var current = evaluation.state();
        List<Sample> samples = window.samples().stream().map(Sample::from).toList();
        return new OrbitalSamplesResponse(window.generatedAt(), samples.getFirst().time(), samples.getLast().time(),
                window.bounds().stepSeconds(), "ITRF_2020_IERS_2010", "m", "m/s",
                "COMPUTED_FROM_ORBITAL_ELEMENTS",
                new TimeSemantics("RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS",
                        "COMPUTED_CURRENT_FROM_ORBITAL_ELEMENTS", "COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS"),
                new Source(elements.catalogNumber(), elements.provider(), elements.upstreamOrigin(),
                        elements.sourceFormat(), elements.elementEpoch(), elements.retrievedAt(),
                        elements.publishedAt(), elements.sha256(), elements.classification().name(),
                        "OREKIT_TLE_SGP4_SDP4"),
                new Assessment(evaluation.quality().name(), evaluation.reason().name(), evaluation.policyId(),
                        seconds(evaluation.elementEpochAge()), seconds(evaluation.retrievalAge())),
                CurrentOrbitalStateResponse.SourceHealth.from(evaluation.sourceHealth()),
                new CurrentGeodetic("WGS84", Math.toDegrees(current.wgs84().latitudeRadians()),
                        Math.toDegrees(current.wgs84().longitudeRadians()), current.wgs84().altitudeMeters()),
                samples);
    }

    private static double seconds(Duration duration) {
        return duration.getSeconds() + duration.getNano() / 1_000_000_000.0;
    }
}
