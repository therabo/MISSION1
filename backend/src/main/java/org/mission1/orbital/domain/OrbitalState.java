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
        Duration elementAge,
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
        Objects.requireNonNull(elementAge);
        Objects.requireNonNull(elementSha256);
        Objects.requireNonNull(elementProvider);
        Objects.requireNonNull(elementUpstreamOrigin);
        Objects.requireNonNull(elementSourceUri);
        Objects.requireNonNull(elementRetrievedAt);
        if (!"TEME".equals(teme.frame()) || !"ITRF_2020_IERS_2010".equals(earthFixed.frame())) {
            throw new IllegalArgumentException("Orbital state frame mismatch");
        }
        if (!Duration.between(elementEpoch, propagationTime).equals(elementAge)) {
            throw new IllegalArgumentException("Element age must use element epoch");
        }
        if (classification != DataClassification.COMPUTED_FROM_ORBITAL_ELEMENTS || quality != Quality.UNKNOWN) {
            throw new IllegalArgumentException("Unexpected state classification or quality");
        }
    }
}
