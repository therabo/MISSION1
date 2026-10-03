package org.mission1.orbital.oem;

import org.hipparchus.geometry.euclidean.threed.Vector3D;

/** Shared pure source-vector Hermite polynomial and its analytic time derivative. */
public final class NasaOemInterpolation {
    private NasaOemInterpolation() {}

    public static Vector3D hermite(
            NasaOemDocument.StateVector a, NasaOemDocument.StateVector b, double span, double u) {
        double u2 = u * u;
        double u3 = u2 * u;
        return a.positionMeters()
                .scalarMultiply(2 * u3 - 3 * u2 + 1)
                .add(a.velocityMetersPerSecond().scalarMultiply((u3 - 2 * u2 + u) * span))
                .add(b.positionMeters().scalarMultiply(-2 * u3 + 3 * u2))
                .add(b.velocityMetersPerSecond().scalarMultiply((u3 - u2) * span));
    }

    /** Analytic time derivative of the existing bounded source-position Hermite polynomial. */
    public static Vector3D hermiteVelocity(
            NasaOemDocument.StateVector a, NasaOemDocument.StateVector b, double span, double u) {
        double u2 = u * u;
        return a.positionMeters()
                .scalarMultiply((6 * u2 - 6 * u) / span)
                .add(a.velocityMetersPerSecond().scalarMultiply(3 * u2 - 4 * u + 1))
                .add(b.positionMeters().scalarMultiply((-6 * u2 + 6 * u) / span))
                .add(b.velocityMetersPerSecond().scalarMultiply(3 * u2 - 2 * u));
    }
}
