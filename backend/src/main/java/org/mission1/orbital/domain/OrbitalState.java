package org.mission1.orbital.domain;

import java.time.Duration;
import java.time.Instant;
import java.net.URI;
import java.util.Objects;

/** A successful calculation from one named element set, never an onboard measurement. */
public record OrbitalState(
        Instant propagationTime,
        CartesianState teme,
        CartesianState earthFixed,
        GeodeticPoint wgs84,
        Instant elementEpoch,
        Duration propagationOffset,
        String elementSha256,
        String elementProvider,
        String elementUpstreamOrigin,
        URI elementSourceUri,
        Instant elementRetrievedAt,
        DataClassification classification,
        Quality quality) {
    public static final String SEMANTIC_ID = "iss.orbit.propagated_state";

    public OrbitalState {
        Objects.requireNonNull(propagationTime);
        Objects.requireNonNull(teme);
        Objects.requireNonNull(earthFixed);
        Objects.requireNonNull(wgs84);
        Objects.requireNonNull(elementEpoch);
        Objects.requireNonNull(propagationOffset);
        Objects.requireNonNull(elementSha256);
        Objects.requireNonNull(elementProvider);
        Objects.requireNonNull(elementUpstreamOrigin);
        Objects.requireNonNull(elementSourceUri);
        Objects.requireNonNull(elementRetrievedAt);
        if (!"TEME".equals(teme.frame()) || !"ITRF_2020_IERS_2010".equals(earthFixed.frame())) {
            throw new IllegalArgumentException("Orbital state frame mismatch");
        }
        if (!Duration.between(elementEpoch, propagationTime).equals(propagationOffset)) {
            throw new IllegalArgumentException("Propagation offset must use element epoch");
        }
        if (classification != DataClassification.COMPUTED_FROM_ORBITAL_ELEMENTS
                || (quality != Quality.GOOD && quality != Quality.STALE && quality != Quality.UNKNOWN)) {
            throw new IllegalArgumentException("Unexpected state classification or quality");
        }
    }

    public OrbitalState withQuality(Quality assessedQuality) {
        if (assessedQuality != Quality.GOOD && assessedQuality != Quality.STALE && assessedQuality != Quality.UNKNOWN) {
            throw new IllegalArgumentException("A coordinate-bearing state cannot have this quality");
        }
        return new OrbitalState(propagationTime, teme, earthFixed, wgs84, elementEpoch, propagationOffset,
                elementSha256, elementProvider, elementUpstreamOrigin, elementSourceUri, elementRetrievedAt,
                classification, assessedQuality);
    }
}
