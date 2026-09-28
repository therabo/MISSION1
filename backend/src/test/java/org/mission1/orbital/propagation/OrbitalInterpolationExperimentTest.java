package org.mission1.orbital.propagation;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.domain.Vector3;

/** Reproducible visual interpolation comparison against the MISSION1 Orekit computation. */
class OrbitalInterpolationExperimentTest {
    private static final Instant START = Instant.parse("2026-09-28T15:00:00Z");

    @Test void earthFixedInterpolationDeviationOverTenMinutes() throws IOException {
        var data = new OrekitData();
        var parser = new TleElementParser(data);
        OrbitalElementSet elements;
        try (var input = getClass().getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            String[] lines = new String(input.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
            elements = parser.parse(lines[1], lines[2], START, "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK",
                    URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"));
        }
        var propagator = new OrekitOrbitalPropagator(data, parser);
        List<Instant> times = new ArrayList<>();
        for (int halfSeconds = 0; halfSeconds <= 1200; halfSeconds++) {
            times.add(START.plusMillis(500L * halfSeconds));
        }
        List<OrbitalState> reference = propagator.propagateAll(elements, times);
        for (int stepSeconds : new int[] {1, 2, 5, 10, 30}) {
            double linearMax = 0, linearSum = 0, hermiteMax = 0, hermiteSum = 0;
            int count = 0;
            int span = stepSeconds * 2;
            for (int index = 1; index < 1200; index++) {
                if (index % span == 0) continue;
                int left = (index / span) * span;
                int right = left + span;
                double fraction = (index - left) / (double) span;
                Vector3 actual = reference.get(index).earthFixed().positionMeters();
                var a = reference.get(left).earthFixed();
                var b = reference.get(right).earthFixed();
                double linearError = distance(actual, linear(a.positionMeters(), b.positionMeters(), fraction));
                double hermiteError = distance(actual, hermite(a.positionMeters(), a.velocityMetersPerSecond(),
                        b.positionMeters(), b.velocityMetersPerSecond(), fraction, stepSeconds));
                linearMax = Math.max(linearMax, linearError);
                linearSum += linearError;
                hermiteMax = Math.max(hermiteMax, hermiteError);
                hermiteSum += hermiteError;
                count++;
            }
            System.out.printf("INTERPOLATION step=%ds linearMax=%.3fm linearMean=%.3fm "
                            + "hermiteMax=%.6fm hermiteMean=%.6fm points=%d%n",
                    stepSeconds, linearMax, linearSum / count, hermiteMax, hermiteSum / count, count);
            if (stepSeconds == 10) assertTrue(linearMax < 250.0);
        }
    }

    private static Vector3 linear(Vector3 a, Vector3 b, double t) {
        return new Vector3(a.x() + (b.x() - a.x()) * t,
                a.y() + (b.y() - a.y()) * t,
                a.z() + (b.z() - a.z()) * t);
    }

    private static Vector3 hermite(Vector3 p0, Vector3 v0, Vector3 p1, Vector3 v1, double t, double seconds) {
        double h00 = 2 * t * t * t - 3 * t * t + 1;
        double h10 = t * t * t - 2 * t * t + t;
        double h01 = -2 * t * t * t + 3 * t * t;
        double h11 = t * t * t - t * t;
        return new Vector3(h00 * p0.x() + h10 * seconds * v0.x() + h01 * p1.x() + h11 * seconds * v1.x(),
                h00 * p0.y() + h10 * seconds * v0.y() + h01 * p1.y() + h11 * seconds * v1.y(),
                h00 * p0.z() + h10 * seconds * v0.z() + h01 * p1.z() + h11 * seconds * v1.z());
    }

    private static double distance(Vector3 a, Vector3 b) {
        return Math.sqrt(Math.pow(a.x() - b.x(), 2) + Math.pow(a.y() - b.y(), 2) + Math.pow(a.z() - b.z(), 2));
    }
}
