package org.mission1.replay;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.domain.*;
import org.mission1.orbital.oem.*;
import org.mission1.orbital.propagation.*;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;
import org.orekit.bodies.OneAxisEllipsoid;
import org.orekit.time.AbsoluteDate;
import org.orekit.utils.*;

import java.time.*;
import java.util.*;

/**
 * Historical calculation from retained source state only. No acquisition dependency or live
 * fallback.
 */
public final class OrbitHistoricalQueryService {
    public static final String POLICY = "orbit-replay-nearest-gp-bounded-oem-v1";

    public record Source(
            String kind,
            String classification,
            String contentHash,
            String sourceUrl,
            String provider,
            Instant epoch,
            Instant creationAt,
            Instant retrievedAt,
            String httpLastModified,
            Instant coverageStart,
            Instant coverageEnd,
            Double signedPropagationOffsetSeconds,
            String method) {}

    public record State(
            Instant effectiveAt,
            String quality,
            String frame,
            String positionUnit,
            String velocityUnit,
            Vector3 position,
            Vector3 velocity,
            double latitudeDegrees,
            double longitudeDegrees,
            double altitudeMeters,
            Source source) {}

    public record Result(
            Instant requestedAt,
            Instant effectiveAt,
            String availability,
            String reason,
            ReplayCoverage coverage,
            State primary,
            State secondary,
            Double sourceSeparationMeters,
            String policy) {}

    private final ReplayHistoryRepository history;
    private final OrbitalElementSetRepository elements;
    private final OrekitOrbitalPropagator propagator;
    private final OrekitData data;
    private final NasaOemXmlParser parser;
    private final Duration maxOffset;
    // Source bodies are immutable by hash. Bounded cache holds parsed source vectors only, never
    // replay answers.
    private final Map<String, NasaOemDocument> documents = new LinkedHashMap<>(16, 0.75f, true);

    public OrbitHistoricalQueryService(
            ReplayHistoryRepository history,
            OrbitalElementSetRepository elements,
            OrekitOrbitalPropagator propagator,
            OrekitData data,
            NasaOemXmlParser parser,
            Duration maxOffset) {
        if (maxOffset.isZero()
                || maxOffset.isNegative()
                || maxOffset.compareTo(Duration.ofHours(24)) > 0)
            throw new IllegalArgumentException(
                    "Replay GP limit must be positive and at most 24 hours");
        this.history = history;
        this.elements = elements;
        this.propagator = propagator;
        this.data = data;
        this.parser = parser;
        this.maxOffset = maxOffset;
    }

    private synchronized NasaOemDocument document(ReplayHistoryRepository.Oem item) {
        var d = documents.get(item.hash());
        if (d == null) {
            d = parser.parse(history.oemBody(item.hash()));
            if (!d.sha256().equals(item.hash()))
                throw new IllegalArgumentException("Retained OEM hash mismatch");
            documents.put(item.hash(), d);
            if (documents.size() > 8) documents.remove(documents.keySet().iterator().next());
        }
        return d;
    }

    private List<ReplayCoverage.Interval> oemIntervals(NasaOemDocument d) {
        var output = new ArrayList<ReplayCoverage.Interval>();
        var v = d.vectors();
        for (int i = 1; i < v.size(); i++)
            if (Duration.between(v.get(i - 1).epoch(), v.get(i).epoch())
                            .compareTo(Duration.ofSeconds(600))
                    <= 0)
                output.add(new ReplayCoverage.Interval(v.get(i - 1).epoch(), v.get(i).epoch()));
        return output;
    }

    public ReplayCoverage coverage(Instant now) {
        return coverage(elements.history(), history.oem(), now);
    }

    private ReplayCoverage coverage(
            List<OrbitalElementSetRepository.Stored> gp,
            List<ReplayHistoryRepository.Oem> oem,
            Instant now) {
        var intervals = new ArrayList<ReplayCoverage.Interval>();
        gp.forEach(
                s ->
                        intervals.add(
                                new ReplayCoverage.Interval(
                                        s.elements().elementEpoch().minus(maxOffset),
                                        s.elements().elementEpoch().plus(maxOffset))));
        for (var item : oem) {
            try {
                intervals.addAll(oemIntervals(document(item)));
            } catch (IllegalArgumentException ignored) {
                /* Invalid retained product supplies no coverage. */
            }
        }
        var source =
                ReplayCoverage.of(
                        intervals,
                        now,
                        false,
                        List.of(
                                "Finite retained source coverage; accuracy UNKNOWN",
                                "GP absolute epoch offset <= " + maxOffset,
                                "OEM no extrapolation; adjacent vectors <= PT10M"));
        var eop =
                ReplayCoverage.of(
                        List.of(
                                new ReplayCoverage.Interval(
                                        data.coverageStart(), data.coverageEnd())),
                        now,
                        false,
                        List.of());
        var clipped = ReplayCoverage.intersect(source, eop, now);
        return new ReplayCoverage(
                clipped.intervals().isEmpty() ? "UNAVAILABLE" : "AVAILABLE",
                clipped.start(),
                clipped.end(),
                clipped.intervals(),
                source.limitations());
    }

    public Result at(Instant at, Instant now) {
        var gp = elements.history();
        var oem = history.oem();
        var coverage = coverage(gp, oem, now);
        if (!coverage.contains(at))
            return new Result(
                    at,
                    at,
                    "UNAVAILABLE",
                    "OUTSIDE_RETAINED_SOURCE_OR_EOP_COVERAGE",
                    coverage,
                    null,
                    null,
                    null,
                    POLICY);
        var candidates =
                gp.stream()
                        .filter(
                                s ->
                                        Duration.between(s.elements().elementEpoch(), at)
                                                        .abs()
                                                        .compareTo(maxOffset)
                                                <= 0)
                        .sorted(
                                Comparator.<OrbitalElementSetRepository.Stored, Duration>comparing(
                                                s ->
                                                        Duration.between(
                                                                        s.elements().elementEpoch(),
                                                                        at)
                                                                .abs())
                                        .thenComparing(s -> s.elements().elementEpoch().isAfter(at))
                                        .thenComparing(s -> s.elements().elementEpoch())
                                        .thenComparing(s -> s.elements().sha256()))
                        .toList();
        State primary = null, secondary = null;
        if (!candidates.isEmpty()) {
            try {
                var s = propagator.propagate(candidates.getFirst().elements(), at);
                var e = candidates.getFirst().elements();
                primary =
                        new State(
                                at,
                                "UNKNOWN",
                                "ITRF_2020_IERS_2010",
                                "m",
                                "m/s",
                                s.earthFixed().positionMeters(),
                                s.earthFixed().velocityMetersPerSecond(),
                                Math.toDegrees(s.wgs84().latitudeRadians()),
                                Math.toDegrees(s.wgs84().longitudeRadians()),
                                s.wgs84().altitudeMeters(),
                                new Source(
                                        "GP_TLE",
                                        s.classification().name(),
                                        e.sha256(),
                                        e.sourceUri().toString(),
                                        e.provider(),
                                        e.elementEpoch(),
                                        null,
                                        e.retrievedAt(),
                                        null,
                                        e.elementEpoch().minus(maxOffset),
                                        e.elementEpoch().plus(maxOffset),
                                        Duration.between(e.elementEpoch(), at).toNanos() / 1e9,
                                        "Orekit TLEPropagator TEME to ITRF2020/IERS2010 to WGS84"));
            } catch (OrbitalCalculationException ignored) {
                /* Expose unavailable; never call current state. */
            }
        }
        var covering =
                oem.stream()
                        .filter(o -> !at.isBefore(o.start()) && !at.isAfter(o.end()))
                        .sorted(
                                (a, b) -> {
                                    boolean pa = !a.creation().isAfter(at),
                                            pb = !b.creation().isAfter(at);
                                    if (pa != pb) return pa ? -1 : 1;
                                    int c =
                                            pa
                                                    ? b.creation().compareTo(a.creation())
                                                    : a.creation().compareTo(b.creation());
                                    return c == 0 ? a.hash().compareTo(b.hash()) : c;
                                })
                        .toList();
        for (var item : covering) {
            try {
                secondary = oemState(document(item), item, at);
                break;
            } catch (IllegalArgumentException | OrbitalCalculationException ignored) {
                /* Try another retained covering product, never extrapolate. */
            }
        }
        Double separation =
                primary != null && secondary != null
                        ? distance(primary.position(), secondary.position())
                        : null;
        if (primary == null) {
            primary = secondary;
            secondary = null;
        }
        return new Result(
                at,
                at,
                primary == null ? "UNAVAILABLE" : "AVAILABLE",
                primary == null ? "RETAINED_SOURCE_CALCULATION_UNAVAILABLE" : "NONE",
                coverage,
                primary,
                secondary,
                separation,
                POLICY);
    }

    private State oemState(NasaOemDocument d, ReplayHistoryRepository.Oem item, Instant at) {
        var v = d.vectors();
        if (at.isBefore(v.getFirst().epoch()) || at.isAfter(v.getLast().epoch()))
            throw new IllegalArgumentException("OEM vector coverage");
        int lo = 0, hi = v.size() - 1;
        while (lo + 1 < hi) {
            int mid = (lo + hi) / 2;
            if (v.get(mid).epoch().isAfter(at)) hi = mid;
            else lo = mid;
        }
        var a = v.get(lo);
        var b = v.get(hi);
        double span = Duration.between(a.epoch(), b.epoch()).toNanos() / 1e9;
        if (span > 600) throw new IllegalArgumentException("OEM vector gap");
        double u = Duration.between(a.epoch(), at).toNanos() / 1e9 / span;
        var nativePv =
                new PVCoordinates(
                        NasaOemInterpolation.hermite(a, b, span, u),
                        NasaOemInterpolation.hermiteVelocity(a, b, span, u));
        var date = new AbsoluteDate(at, data.utc());
        data.requireEopCoverage(date);
        var fixed =
                data.eme2000()
                        .getTransformTo(data.earthFixed(), date)
                        .transformPVCoordinates(nativePv);
        var earth =
                new OneAxisEllipsoid(
                        Constants.WGS84_EARTH_EQUATORIAL_RADIUS,
                        Constants.WGS84_EARTH_FLATTENING,
                        data.earthFixed());
        var geo = earth.transform(fixed.getPosition(), data.earthFixed(), date);
        return new State(
                at,
                "UNKNOWN",
                "ITRF_2020_IERS_2010",
                "m",
                "m/s",
                vector(fixed.getPosition()),
                vector(fixed.getVelocity()),
                Math.toDegrees(geo.getLatitude()),
                Math.toDegrees(geo.getLongitude()),
                geo.getAltitude(),
                new Source(
                        "NASA_OEM",
                        "SOURCE_PROVIDED_PREDICTED_EPHEMERIS",
                        d.sha256(),
                        org.mission1.source.orbital.nasa.NasaOemSource.URI.toString(),
                        "NASA/JSC",
                        null,
                        d.creationDate(),
                        item.retrievedAt(),
                        item.httpLastModified(),
                        v.getFirst().epoch(),
                        v.getLast().epoch(),
                        null,
                        "Bounded EME2000 cubic Hermite PV; Orekit ITRF2020/IERS2010; WGS84"));
    }

    private static Vector3 vector(Vector3D v) {
        return new Vector3(v.getX(), v.getY(), v.getZ());
    }

    private static double distance(Vector3 a, Vector3 b) {
        return Math.sqrt(
                Math.pow(a.x() - b.x(), 2)
                        + Math.pow(a.y() - b.y(), 2)
                        + Math.pow(a.z() - b.z(), 2));
    }
}
