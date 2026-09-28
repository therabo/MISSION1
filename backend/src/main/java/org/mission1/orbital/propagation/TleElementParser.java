package org.mission1.orbital.propagation;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;

import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.orekit.propagation.analytical.tle.TLE;

/** Orekit owns TLE parsing, including fixed-width fields and both checksums. */
public final class TleElementParser {
    public static final int ISS_CATALOG_NUMBER = 25544;
    private final OrekitData data;

    public TleElementParser(OrekitData data) {
        this.data = Objects.requireNonNull(data);
    }

    public OrbitalElementSet parse(String line1, String line2, Instant retrievedAt,
                                    String provider, String upstreamOrigin, URI sourceUri) {
        Objects.requireNonNull(retrievedAt);
        Objects.requireNonNull(provider);
        Objects.requireNonNull(upstreamOrigin);
        Objects.requireNonNull(sourceUri);
        TLE tle = parseTle(line1, line2);
        return new OrbitalElementSet(
                tle.getSatelliteNumber(), "TLE", line1, line2, tle.getDate().toInstant(data.timeScales()),
                provider, upstreamOrigin, sourceUri, retrievedAt, null, digest(line1, line2),
                DataClassification.SOURCE_PROVIDED_ORBITAL_ELEMENTS);
    }

    TLE parseTle(String line1, String line2) {
        try {
            if (!TLE.isFormatOK(line1, line2)) {
                throw new IllegalArgumentException("Malformed TLE lines");
            }
            TLE tle = new TLE(line1, line2, data.utc());
            if (tle.getSatelliteNumber() != ISS_CATALOG_NUMBER) {
                throw new IllegalArgumentException("TLE catalog number is not ISS 25544");
            }
            return tle;
        } catch (RuntimeException failure) {
            throw new IllegalArgumentException("Invalid ISS TLE", failure);
        }
    }

    static String digest(String line1, String line2) {
        try {
            byte[] bytes = (line1 + "\n" + line2).getBytes(StandardCharsets.US_ASCII);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }
}
