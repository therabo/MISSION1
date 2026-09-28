package org.mission1.orbital.application;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalEvaluation;
import org.mission1.orbital.domain.OrbitalQualityReason;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.SourceAcquisitionHealth;
import org.mission1.orbital.propagation.OrbitalCalculationException;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;

/** Evaluates current-display quality as of an explicit time after validating and computing. */
public final class OrbitalQualityEvaluator {
    private final OrekitOrbitalPropagator propagator;
    private final OrbitalFreshnessPolicy policy;

    public OrbitalQualityEvaluator(OrekitOrbitalPropagator propagator, OrbitalFreshnessPolicy policy) {
        this.propagator = Objects.requireNonNull(propagator);
        this.policy = Objects.requireNonNull(policy);
    }

    public OrbitalEvaluation evaluate(OrbitalElementSet elements, Instant evaluationTime,
                                      Instant propagationTime, SourceAcquisitionHealth sourceHealth) {
        Objects.requireNonNull(evaluationTime);
        Objects.requireNonNull(propagationTime);
        Objects.requireNonNull(sourceHealth);
        if (elements == null) {
            return result(null, null, Quality.NO_DATA, OrbitalQualityReason.NO_ORBITAL_ELEMENTS,
                    evaluationTime, propagationTime, sourceHealth);
        }

        final OrbitalState computed;
        try {
            computed = propagator.propagate(elements, propagationTime);
        } catch (OrbitalCalculationException failure) {
            return result(elements, null, Quality.INVALID, failure.reason(),
                    evaluationTime, propagationTime, sourceHealth);
        }

        Duration epochAge = Duration.between(elements.elementEpoch(), evaluationTime);
        if (!evaluationTime.equals(propagationTime)) {
            return result(elements, computed.withQuality(Quality.UNKNOWN), Quality.UNKNOWN,
                    OrbitalQualityReason.NOT_CURRENT_EVALUATION, evaluationTime, propagationTime, sourceHealth);
        }
        if (epochAge.isNegative()) {
            return result(elements, computed.withQuality(Quality.UNKNOWN), Quality.UNKNOWN,
                    OrbitalQualityReason.ELEMENT_EPOCH_IN_FUTURE, evaluationTime, propagationTime, sourceHealth);
        }
        if (epochAge.compareTo(policy.maxCurrentElementAge()) > 0) {
            return result(elements, computed.withQuality(Quality.STALE), Quality.STALE,
                    OrbitalQualityReason.ELEMENT_TOO_OLD, evaluationTime, propagationTime, sourceHealth);
        }
        return result(elements, computed.withQuality(Quality.GOOD), Quality.GOOD,
                OrbitalQualityReason.NONE, evaluationTime, propagationTime, sourceHealth);
    }

    private OrbitalEvaluation result(OrbitalElementSet elements, OrbitalState state,
                                     Quality quality, OrbitalQualityReason reason,
                                     Instant evaluationTime, Instant propagationTime,
                                     SourceAcquisitionHealth sourceHealth) {
        return new OrbitalEvaluation(state, quality, reason, evaluationTime, propagationTime,
                elements == null ? null : Duration.between(elements.retrievedAt(), evaluationTime),
                elements == null ? null : Duration.between(elements.elementEpoch(), evaluationTime),
                elements == null ? null : Duration.between(elements.elementEpoch(), propagationTime),
                elements == null ? null : elements.sha256(),
                elements == null ? null : elements.elementEpoch(),
                elements == null ? null : elements.retrievedAt(),
                elements == null ? null : elements.provider(), sourceHealth, policy.id());
    }
}
