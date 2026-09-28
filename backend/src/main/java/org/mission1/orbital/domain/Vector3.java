package org.mission1.orbital.domain;

/** Components use the unit named by the owning field. */
public record Vector3(double x, double y, double z) {
    public Vector3 {
        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) {
            throw new IllegalArgumentException("Vector components must be finite");
        }
    }
}
