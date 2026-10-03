package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** One evaluation over persisted inputs, never provider network I/O. */
public final class CrewReconciliationService {
    private final CrewRepository primary;
    private final CrewQueryService query;
    private final CrewVerificationRepository verification;
    private final CrewReconciliationRepository repository;
    private final CrewReconciliationEngine engine;
    private final CrewReconciliationPolicy policy;
    private final Clock clock;

    public CrewReconciliationService(
            CrewRepository primary,
            CrewQueryService query,
            CrewVerificationRepository verification,
            CrewReconciliationRepository repository,
            CrewReconciliationPolicy policy,
            Clock clock) {
        this.primary = primary;
        this.query = query;
        this.verification = verification;
        this.repository = repository;
        this.policy = policy;
        this.engine = new CrewReconciliationEngine(policy);
        this.clock = clock;
    }

    public synchronized CrewReconciliationRepository.Result reconcile() {
        Instant at = now();
        long run = repository.startRun(at, CrewReconciliationEngine.VERSION + "/" + policy.key());
        try {
            var state = evaluate(at, true);
            return repository.store(run, state, stateKey(state), now());
        } catch (RuntimeException e) {
            repository.fail(run, now(), "RECONCILIATION_FAILURE");
            throw e;
        }
    }

    public synchronized CrewReconciliationSnapshot current() {
        return evaluate(now(), false);
    }

    private CrewReconciliationSnapshot evaluate(Instant at, boolean resolve) {
        var ll2 = query.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).orElse(null);
        var nasa = verification.latestSuccess().orElse(null);
        var evidence = verification.evidenceAsOf(at);
        var resolved =
                resolve ? verification.resolve(evidence, at) : verification.resolutionsAsOf(at);
        return engine.evaluate(
                new CrewReconciliationEngine.Inputs(
                        ll2,
                        healthy(CrewSource.LAUNCH_LIBRARY_2),
                        nasa,
                        healthy(CrewSource.NASA_OFFICIAL),
                        evidence,
                        resolved,
                        at));
    }

    private boolean healthy(CrewSource source) {
        var success = primary.latestSuccess(source, Station.ISS).orElse(null);
        if (success == null) return false;
        var failure = primary.latestFailure(source, Station.ISS).orElse(null);
        // Failed attempts degrade verification independently of retained last successful evidence.
        return failure == null
                || failure.startedAt().isBefore(success.startedAt())
                || (failure.startedAt().equals(success.startedAt()) && failure.id() < success.id());
    }

    public static String stateKey(CrewReconciliationSnapshot s) {
        // Operational fetch times/run IDs do not duplicate identical interpretation. Current
        // queries expose latest operations separately.
        String material =
                Arrays.asList(
                                s.algorithmVersion(),
                                s.primarySnapshotId(),
                                s.status(),
                                s.officialCrewCount(),
                                s.unidentifiedCount(),
                                s.people(),
                                s.unresolved(),
                                s.evidenceIds(),
                                s.resolutionIds(),
                                s.documentIds())
                        .toString();
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(material.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
