package org.mission1.orbital.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalEvaluation;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.propagation.OrbitalCalculationException;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;

/** One request-time snapshot and one TLE for the entire computed visual sample window. */
public final class OrbitalSampleWindowService {
    public record Window(Instant generatedAt, OrbitalElementSet elements, OrbitalEvaluation evaluation,
                         OrbitalSampleWindow bounds, List<OrbitalState> samples) { }
    public record FullOrbit(Instant generatedAt, OrbitalElementSet elements, OrbitalEvaluation evaluation,
                            double orbitalPeriodSeconds, List<OrbitalState> samples) { }

    private final OrbitalElementSetRepository repository;
    private final OrekitOrbitalPropagator propagator;
    private final OrbitalQualityEvaluator evaluator;
    private final CelesTrakSourceHealthTracker health;
    private final Clock clock;

    public OrbitalSampleWindowService(OrbitalElementSetRepository repository, OrekitOrbitalPropagator propagator,
                                      OrbitalQualityEvaluator evaluator, CelesTrakSourceHealthTracker health,
                                      Clock clock) {
        this.repository = Objects.requireNonNull(repository);
        this.propagator = Objects.requireNonNull(propagator);
        this.evaluator = Objects.requireNonNull(evaluator);
        this.health = Objects.requireNonNull(health);
        this.clock = Objects.requireNonNull(clock);
    }

    public Window generate(OrbitalSampleWindow bounds) {
        Objects.requireNonNull(bounds);
        Instant now = clock.instant();
        OrbitalElementSet elements = repository.latestUsable(now)
                .orElseThrow(NoCurrentOrbitalStateException::new).elements();
        var sourceHealth = health.snapshot(repository.lastSuccessfulRetrieval(
                CelesTrakRefreshService.PROVIDER, CelesTrakRefreshService.ISS_CATALOG_NUMBER).orElse(null));
        Instant start = now.minusSeconds(bounds.pastSeconds());
        List<Instant> times = new ArrayList<>(bounds.sampleCount());
        for (int index = 0; index < bounds.sampleCount(); index++) {
            times.add(start.plusSeconds((long) index * bounds.stepSeconds()));
        }
        final List<OrbitalState> states;
        try {
            states = propagator.propagateAll(elements, times);
        } catch (OrbitalCalculationException failure) {
            throw new CurrentOrbitalStateCalculationException(failure.reason());
        }
        OrbitalState atGeneratedAt = states.get(bounds.pastSeconds() / bounds.stepSeconds());
        OrbitalEvaluation evaluation = evaluator.assessComputed(elements, now, atGeneratedAt, sourceHealth);
        return new Window(now, elements, evaluation, bounds, states);
    }

    /** 181 actual TLE propagations from now through one mean-motion revolution.
     * The extra 15% beyond the visible 85% horizon supports ordinary scene-clock advance. */
    public FullOrbit generateFullOrbit() {
        Instant now = clock.instant();
        OrbitalElementSet elements = repository.latestUsable(now)
                .orElseThrow(NoCurrentOrbitalStateException::new).elements();
        double period = propagator.orbitalPeriodSeconds(elements);
        if (!Double.isFinite(period) || period < 5_000 || period > 7_000) {
            throw new CurrentOrbitalStateCalculationException(
                    org.mission1.orbital.domain.OrbitalQualityReason.INVALID_ORBITAL_ELEMENTS);
        }
        List<Instant> times = new ArrayList<>(181);
        for (int index = 0; index <= 180; index++) {
            times.add(now.plusNanos(Math.round(index * period / 180.0 * 1_000_000_000.0)));
        }
        final List<OrbitalState> states;
        try {
            states = propagator.propagateAll(elements, times);
        } catch (OrbitalCalculationException failure) {
            throw new CurrentOrbitalStateCalculationException(failure.reason());
        }
        var sourceHealth = health.snapshot(repository.lastSuccessfulRetrieval(
                CelesTrakRefreshService.PROVIDER, CelesTrakRefreshService.ISS_CATALOG_NUMBER).orElse(null));
        OrbitalEvaluation evaluation = evaluator.assessComputed(elements, now, states.getFirst(), sourceHealth);
        return new FullOrbit(now, elements, evaluation, period, states);
    }
}
