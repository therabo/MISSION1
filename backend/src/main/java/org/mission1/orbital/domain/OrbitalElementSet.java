package org.mission1.orbital.domain;

import java.net.URI;
import java.time.Instant;
import java.util.Objects;

/** Validated source TLE. Epoch and receipt time have distinct meanings; publication time is unknown. */
public record OrbitalElementSet(
        int catalogNumber,
        String sourceFormat,
        String line1,
        String line2,
        Instant elementEpoch,
        String provider,
        String upstreamOrigin,
        URI sourceUri,
        Instant retrievedAt,
        Instant publishedAt,
        String sha256,
        DataClassification classification) {
    public static final String SEMANTIC_ID = "iss.orbit.gp_elements";

    public OrbitalElementSet {
        if (catalogNumber <= 0) throw new IllegalArgumentException("Catalog number must be positive");
        if (!"TLE".equals(sourceFormat)) throw new IllegalArgumentException("Only verified TLE input is supported");
        Objects.requireNonNull(line1);
        Objects.requireNonNull(line2);
        Objects.requireNonNull(elementEpoch);
        Objects.requireNonNull(provider);
        Objects.requireNonNull(upstreamOrigin);
        Objects.requireNonNull(sourceUri);
        Objects.requireNonNull(retrievedAt);
        Objects.requireNonNull(sha256);
        if (classification != DataClassification.SOURCE_PROVIDED_ORBITAL_ELEMENTS) {
            throw new IllegalArgumentException("Elements must be source-provided");
        }
    }
}
