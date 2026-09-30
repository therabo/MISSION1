package org.mission1.orbital.oem;

import java.time.Instant;
import java.util.List;

import org.hipparchus.geometry.euclidean.threed.Vector3D;

/** Validated NASA OEM source vectors; positions are metres, velocities metres/second in EME2000. */
public record NasaOemDocument(Instant creationDate, Instant startTime, Instant stopTime,
        List<StateVector> vectors, String sha256) {
    public record StateVector(Instant epoch, Vector3D positionMeters, Vector3D velocityMetersPerSecond) { }
}
