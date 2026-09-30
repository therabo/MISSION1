package org.mission1.orbital.oem;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.mission1.orbital.application.OrbitalSampleWindowService.FullOrbit;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.source.orbital.nasa.NasaOemSource;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;
import org.orekit.time.AbsoluteDate;

/** Optional comparison read path. NASA failures never change the GP/TLE current state. */
public final class NasaOemTrajectoryService {
    public record Sample(Instant time, double xMeters, double yMeters, double zMeters) { }
    public record Source(Instant creationDate, Instant startTime, Instant stopTime,
            Instant retrievedAt, Instant httpLastModified, String sha256, String sourceUrl) { }
    public record Result(String availability, String reason, Source source, List<Sample> samples) { }
    private record Cached(NasaOemDocument document, Instant retrievedAt, Instant httpLastModified) { }

    private final NasaOemRepository repository;
    private final NasaOemSource source;
    private final NasaOemXmlParser parser;
    private final OrekitData data;
    private final Clock clock;
    private Cached cached;
    private Instant nextAttempt = Instant.MIN;
    private boolean lastFetchFailed;

    public NasaOemTrajectoryService(NasaOemRepository repository, NasaOemSource source,
                                    NasaOemXmlParser parser, OrekitData data, Clock clock) {
        this.repository = repository;
        this.source = source;
        this.parser = parser;
        this.data = data;
        this.clock = clock;
    }

    public synchronized Result comparison(FullOrbit orbit) {
        Instant now = clock.instant();
        if (cached == null) {
            repository.latest().ifPresent(stored -> {
                try {
                    cached = new Cached(parser.parse(stored.xml()), stored.retrievedAt(), stored.httpLastModified());
                } catch (IllegalArgumentException ignored) {
                    // A corrupt stored file cannot become a comparison path.
                }
            });
        }
        if (!now.isBefore(nextAttempt) && (cached == null ||
                !now.isBefore(cached.retrievedAt().plus(Duration.ofHours(2))))) {
            try {
                var fetched = source.fetch();
                var document = parser.parse(fetched.xml());
                Instant retrievedAt = clock.instant().truncatedTo(ChronoUnit.MICROS);
                repository.store(document, fetched.xml(), retrievedAt, fetched.httpLastModified());
                cached = new Cached(document, retrievedAt, fetched.httpLastModified());
                nextAttempt = retrievedAt.plus(Duration.ofHours(2));
                lastFetchFailed = false;
            } catch (Exception failure) {
                if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
                lastFetchFailed = true;
                nextAttempt = now.plus(Duration.ofMinutes(15));
            }
        }
        if (cached == null) return new Result("UNAVAILABLE", "NO_VALID_OEM_FILE", null, List.of());
        var document = cached.document();
        List<Sample> samples;
        try {
            samples = sample(document, orbit);
        } catch (RuntimeException failure) {
            return new Result("UNAVAILABLE", "OEM_TRANSFORMATION_FAILED", sourceOf(cached), List.of());
        }
        if (samples.size() < 2) {
            return new Result("UNAVAILABLE", "OEM_WINDOW_NOT_COVERED", sourceOf(cached), List.of());
        }
        if (lastFetchFailed) return new Result("DEGRADED", "SOURCE_FETCH_FAILED_USING_STORED_FILE", sourceOf(cached), samples);
        if (samples.size() < orbit.samples().size()) return new Result("DEGRADED", "OEM_WINDOW_PARTIAL", sourceOf(cached), samples);
        return new Result("AVAILABLE", "NONE", sourceOf(cached), samples);
    }

    private Source sourceOf(Cached item) {
        var doc = item.document();
        return new Source(doc.creationDate(), doc.startTime(), doc.stopTime(), item.retrievedAt(),
                item.httpLastModified(), doc.sha256(), NasaOemSource.URI.toString());
    }

    private List<Sample> sample(NasaOemDocument document, FullOrbit orbit) {
        var vectors = document.vectors();
        var output = new ArrayList<Sample>();
        int before = 0;
        for (var state : orbit.samples()) {
            Instant time = state.propagationTime();
            if (time.isBefore(vectors.getFirst().epoch()) || time.isAfter(vectors.getLast().epoch())) continue;
            while (before + 1 < vectors.size() && vectors.get(before + 1).epoch().isBefore(time)) before++;
            if (before + 1 >= vectors.size()) break;
            var a = vectors.get(before);
            var b = vectors.get(before + 1);
            double span = Duration.between(a.epoch(), b.epoch()).toNanos() / 1e9;
            if (span > 600) throw new IllegalArgumentException("Unexplained OEM source gap");
            double u = Duration.between(a.epoch(), time).toNanos() / 1e9 / span;
            Vector3D position = hermite(a, b, span, u);
            AbsoluteDate date = new AbsoluteDate(time, data.utc());
            data.requireEopCoverage(date);
            Vector3D fixed = data.eme2000().getTransformTo(data.earthFixed(), date).transformPosition(position);
            output.add(new Sample(time, fixed.getX(), fixed.getY(), fixed.getZ()));
        }
        return List.copyOf(output);
    }

    private static Vector3D hermite(NasaOemDocument.StateVector a, NasaOemDocument.StateVector b,
                                    double span, double u) {
        double u2 = u * u;
        double u3 = u2 * u;
        return a.positionMeters().scalarMultiply(2 * u3 - 3 * u2 + 1)
                .add(a.velocityMetersPerSecond().scalarMultiply((u3 - 2 * u2 + u) * span))
                .add(b.positionMeters().scalarMultiply(-2 * u3 + 3 * u2))
                .add(b.velocityMetersPerSecond().scalarMultiply((u3 - u2) * span));
    }
}
