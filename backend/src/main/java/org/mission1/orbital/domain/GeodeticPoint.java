package org.mission1.orbital.domain;

/** WGS84 geodetic angles in radians and ellipsoidal altitude in meters. */
public record GeodeticPoint(double latitudeRadians, double longitudeRadians, double altitudeMeters) {
    public GeodeticPoint {
        if (!Double.isFinite(latitudeRadians) || !Double.isFinite(longitudeRadians)
                || !Double.isFinite(altitudeMeters)
                || Math.abs(latitudeRadians) > Math.PI / 2 || Math.abs(longitudeRadians) > Math.PI) {
            throw new IllegalArgumentException("Invalid WGS84 geodetic point");
        }
    }
}
