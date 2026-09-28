package org.mission1.api;

import java.time.Duration;
import java.time.Instant;

import org.mission1.orbital.application.CurrentOrbitalStateService.CurrentState;
import org.mission1.orbital.domain.Vector3;

/** Public units and lineage for a current computation; no domain or Orekit type is serialized. */
public record CurrentOrbitalStateResponse(
        Satellite satellite,
        Instant propagationTime,
        Cartesian state,
        Geodetic geodetic,
        Source source,
        String classification,
        Assessment quality) {

    public record Satellite(int noradCatalogNumber) { }
    public record Components(double x, double y, double z) {
        static Components from(Vector3 value) { return new Components(value.x(), value.y(), value.z()); }
    }
    public record Cartesian(String frame, Components positionMeters, Components velocityMetersPerSecond) { }
    public record Geodetic(String datum, double latitudeDegrees, double longitudeDegrees,
                           double altitudeMeters) { }
    public record Source(String provider, String upstreamOrigin, Instant elementEpoch,
                         Instant retrievedAt, Instant publishedAt, String elementSha256,
                         String classification) { }
    public record Assessment(String status, String reason, String policy,
                             double elementAgeSeconds, double retrievalAgeSeconds,
                             double propagationOffsetSeconds) { }

    public static CurrentOrbitalStateResponse from(CurrentState current) {
        var elements = current.elements();
        var evaluation = current.evaluation();
        var state = evaluation.state();
        return new CurrentOrbitalStateResponse(
                new Satellite(elements.catalogNumber()),
                state.propagationTime(),
                new Cartesian(state.teme().frame(), Components.from(state.teme().positionMeters()),
                        Components.from(state.teme().velocityMetersPerSecond())),
                new Geodetic("WGS84", Math.toDegrees(state.wgs84().latitudeRadians()),
                        Math.toDegrees(state.wgs84().longitudeRadians()), state.wgs84().altitudeMeters()),
                new Source(elements.provider(), elements.upstreamOrigin(), elements.elementEpoch(),
                        elements.retrievedAt(), elements.publishedAt(), elements.sha256(),
                        elements.classification().name()),
                state.classification().name(),
                new Assessment(evaluation.quality().name(), evaluation.reason().name(), evaluation.policyId(),
                        seconds(evaluation.elementEpochAge()), seconds(evaluation.retrievalAge()),
                        seconds(evaluation.propagationOffset())));
    }

    private static double seconds(Duration duration) {
        return duration.getSeconds() + duration.getNano() / 1_000_000_000.0;
    }
}
