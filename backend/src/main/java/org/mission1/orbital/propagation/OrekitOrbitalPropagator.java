package org.mission1.orbital.propagation;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.mission1.orbital.domain.CartesianState;
import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.GeodeticPoint;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.domain.OrbitalQualityReason;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.Vector3;
import org.orekit.bodies.OneAxisEllipsoid;
import org.orekit.propagation.SpacecraftState;
import org.orekit.propagation.analytical.tle.TLE;
import org.orekit.propagation.analytical.tle.TLEPropagator;
import org.orekit.time.AbsoluteDate;
import org.orekit.utils.Constants;
import org.orekit.utils.PVCoordinates;

/** Pure calculation boundary. Position: m; velocity: m/s; WGS84 angles: rad; altitude: m. */
public final class OrekitOrbitalPropagator {
    private final OrekitData data;
    private final TleElementParser parser;
    private final OneAxisEllipsoid earth;

    public OrekitOrbitalPropagator(OrekitData data, TleElementParser parser) {
        this.data = Objects.requireNonNull(data);
        this.parser = Objects.requireNonNull(parser);
        earth = new OneAxisEllipsoid(Constants.WGS84_EARTH_EQUATORIAL_RADIUS,
                Constants.WGS84_EARTH_FLATTENING, data.earthFixed());
    }

    public OrbitalState propagate(OrbitalElementSet elements, Instant propagationTime) {
        return propagateAll(elements, List.of(propagationTime)).getFirst();
    }

    /** Period from the selected TLE mean motion, used only to size a visual revolution. */
    public double orbitalPeriodSeconds(OrbitalElementSet elements) {
        return 2 * Math.PI / parser.parseTle(elements.line1(), elements.line2()).getMeanMotion();
    }

    /** One validated TLE and one request-local propagator for a coherent sample window. */
    public List<OrbitalState> propagateAll(OrbitalElementSet elements, List<Instant> times) {
        Objects.requireNonNull(elements);
        Objects.requireNonNull(times);
        if (times.isEmpty()) throw new IllegalArgumentException("At least one propagation time is required");
        final TLE tle;
        try {
            tle = parser.parseTle(elements.line1(), elements.line2());
            Instant parsedEpoch = tle.getDate().toInstant(data.timeScales());
            if (tle.getSatelliteNumber() != elements.catalogNumber() || !parsedEpoch.equals(elements.elementEpoch())
                    || !TleElementParser.digest(elements.line1(), elements.line2()).equals(elements.sha256())) {
                throw new IllegalArgumentException("Element metadata differs from TLE content");
            }
        } catch (RuntimeException failure) {
            throw new OrbitalCalculationException(OrbitalQualityReason.INVALID_ORBITAL_ELEMENTS,
                    "Invalid ISS orbital elements", failure);
        }
        final TLEPropagator propagator;
        try {
            propagator = TLEPropagator.selectExtrapolator(tle, data.teme());
        } catch (RuntimeException failure) {
            throw new OrbitalCalculationException(OrbitalQualityReason.PROPAGATION_FAILED,
                    "ISS TLE propagator could not be constructed", failure);
        }
        List<OrbitalState> results = new ArrayList<>(times.size());
        for (Instant propagationTime : times) {
            Objects.requireNonNull(propagationTime);
            final AbsoluteDate date;
            try {
                date = new AbsoluteDate(propagationTime, data.utc());
                data.requireEopCoverage(date);
            } catch (OrbitalCalculationException failure) {
                throw failure;
            } catch (RuntimeException failure) {
                throw new OrbitalCalculationException(OrbitalQualityReason.EOP_DATA_UNAVAILABLE,
                        "Required orbital time/EOP data unavailable", failure);
            }
            final SpacecraftState state;
            final PVCoordinates temePv;
            try {
                state = propagator.propagate(date);
                if (state.getFrame() != data.teme()) {
                    throw new IllegalStateException("Unexpected TLE propagation frame");
                }
                temePv = state.getPVCoordinates();
            } catch (RuntimeException failure) {
                throw new OrbitalCalculationException(OrbitalQualityReason.PROPAGATION_FAILED,
                        "ISS TLE propagation failed", failure);
            }
            try {
                PVCoordinates itrfPv = state.getPVCoordinates(data.earthFixed());
                org.orekit.bodies.GeodeticPoint point = earth.transform(itrfPv.getPosition(), data.earthFixed(), date);
                results.add(new OrbitalState(propagationTime,
                        new CartesianState(vector(temePv.getPosition()), vector(temePv.getVelocity()), "TEME"),
                        new CartesianState(vector(itrfPv.getPosition()), vector(itrfPv.getVelocity()), "ITRF_2020_IERS_2010"),
                        new GeodeticPoint(point.getLatitude(), point.getLongitude(), point.getAltitude()),
                        elements.elementEpoch(), Duration.between(elements.elementEpoch(), propagationTime),
                        elements.sha256(), elements.provider(), elements.upstreamOrigin(), elements.sourceUri(),
                        elements.retrievedAt(),
                        DataClassification.COMPUTED_FROM_ORBITAL_ELEMENTS, Quality.UNKNOWN));
            } catch (RuntimeException failure) {
                throw new OrbitalCalculationException(OrbitalQualityReason.TRANSFORMATION_FAILED,
                        "ISS frame or WGS84 transformation failed", failure);
            }
        }
        return List.copyOf(results);
    }

    private static Vector3 vector(Vector3D source) {
        return new Vector3(source.getX(), source.getY(), source.getZ());
    }
}
