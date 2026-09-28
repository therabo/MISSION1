package org.mission1.orbital.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalEvaluation;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.SourceAcquisitionHealth;

/** Current read path from observed source elements to a computed, assessed state. */
public final class CurrentOrbitalStateService {
    public record CurrentState(OrbitalElementSet elements, OrbitalEvaluation evaluation) { }

    private final OrbitalElementSetRepository repository;
    private final OrbitalQualityEvaluator evaluator;
    private final Clock clock;
    private final CelesTrakSourceHealthTracker health;

    public CurrentOrbitalStateService(OrbitalElementSetRepository repository,
                                     OrbitalQualityEvaluator evaluator, Clock clock,
                                     CelesTrakSourceHealthTracker health) {
        this.repository = Objects.requireNonNull(repository);
        this.evaluator = Objects.requireNonNull(evaluator);
        this.clock = Objects.requireNonNull(clock);
        this.health = Objects.requireNonNull(health);
    }

    public CurrentState current() {
        Instant now = clock.instant();
        OrbitalElementSet elements = repository.latestUsable(now)
                .orElseThrow(NoCurrentOrbitalStateException::new).elements();
        SourceAcquisitionHealth sourceHealth = health.snapshot(repository.lastSuccessfulRetrieval(
                CelesTrakRefreshService.PROVIDER, CelesTrakRefreshService.ISS_CATALOG_NUMBER).orElse(null));
        OrbitalEvaluation evaluation = evaluator.evaluate(elements, now, now, sourceHealth);
        if (evaluation.quality() == Quality.INVALID || evaluation.state() == null) {
            throw new CurrentOrbitalStateCalculationException(evaluation.reason());
        }
        return new CurrentState(elements, evaluation);
    }
}
