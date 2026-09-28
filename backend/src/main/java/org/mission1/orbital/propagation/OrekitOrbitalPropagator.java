package org.mission1.orbital.propagation;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.mission1.orbital.domain.CartesianState;
import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.GeodeticPoint;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalState;
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
        Objects.requireNonNull(elements);
        Objects.requireNonNull(propagationTime);
        try {
            TLE tle = parser.parseTle(elements.line1(), elements.line2());
            Instant parsedEpoch = tle.getDate().toInstant(data.timeScales());
            if (tle.getSatelliteNumber() != elements.catalogNumber() || !parsedEpoch.equals(elements.elementEpoch())
                    || !TleElementParser.digest(elements.line1(), elements.line2()).equals(elements.sha256())) {
                throw new IllegalArgumentException("Element metadata differs from TLE content");
            }
            AbsoluteDate date = new AbsoluteDate(propagationTime, data.utc());
            data.requireEopCoverage(date);
            // A new propagator per call avoids sharing its mutable state across callers.
            TLEPropagator propagator = TLEPropagator.selectExtrapolator(tle, data.teme());
            SpacecraftState state = propagator.propagate(date);
            if (state.getFrame() != data.teme()) {
                throw new IllegalStateException("Unexpected TLE propagation frame");
            }
            PVCoordinates temePv = state.getPVCoordinates();
            PVCoordinates itrfPv = state.getPVCoordinates(data.earthFixed());
            org.orekit.bodies.GeodeticPoint point = earth.transform(itrfPv.getPosition(), data.earthFixed(), date);
            return new OrbitalState(propagationTime,
                    new CartesianState(vector(temePv.getPosition()), vector(temePv.getVelocity()), "TEME"),
                    new CartesianState(vector(itrfPv.getPosition()), vector(itrfPv.getVelocity()), "ITRF_2020_IERS_2010"),
                    new GeodeticPoint(point.getLatitude(), point.getLongitude(), point.getAltitude()),
                    elements.elementEpoch(), Duration.between(elements.elementEpoch(), propagationTime),
                    elements.sha256(), elements.provider(), elements.upstreamOrigin(), elements.sourceUri(),
                    elements.retrievedAt(),
                    DataClassification.COMPUTED_FROM_ORBITAL_ELEMENTS, Quality.UNKNOWN);
        } catch (RuntimeException failure) {
            if (failure instanceof OrbitalCalculationException alreadyExplicit) throw alreadyExplicit;
            throw new OrbitalCalculationException("ISS orbital propagation failed", failure);
        }
    }

    private static Vector3 vector(Vector3D source) {
        return new Vector3(source.getX(), source.getY(), source.getZ());
    }
}
