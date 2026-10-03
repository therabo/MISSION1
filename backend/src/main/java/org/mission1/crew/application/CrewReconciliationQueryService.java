package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.util.List;
import java.util.Optional;

/**
 * Future REST entry point. Effective freshness is evaluated at read time, historical snapshots stay
 * immutable.
 */
public final class CrewReconciliationQueryService {
    public record Current(
            CrewReconciliationSnapshot interpretation,
            Optional<CrewQueryService.Latest> structuredPrimary,
            CrewQueryService.Status primaryHealth,
            CrewQueryService.Status verificationHealth,
            Optional<CrewReconciliationRepository.Stored> lastPersistedInterpretation,
            Optional<CrewVerificationRepository.ParseFailure> lastParseFailure,
            Optional<CrewReconciliationRepository.Run> lastReconciliationAttempt,
            List<CrewVerificationRepository.Evidence> verificationEvidence,
            List<CrewIdentityResolution> identityResolutions) {}

    private final CrewReconciliationService service;
    private final CrewQueryService query;
    private final CrewReconciliationRepository repository;
    private final CrewVerificationRepository verification;
    private final CrewRepository primary;

    public CrewReconciliationQueryService(
            CrewReconciliationService service,
            CrewQueryService query,
            CrewReconciliationRepository repository,
            CrewVerificationRepository verification,
            CrewRepository primary) {
        this.service = service;
        this.query = query;
        this.repository = repository;
        this.verification = verification;
        this.primary = primary;
    }

    public Current current() {
        var state = service.current();
        // Read the exact input referenced by the interpretation, even if a new ingest completes
        // during this query.
        Optional<CrewQueryService.Latest> structured =
                state.primaryRunId() == null
                        ? Optional.empty()
                        : primary.findRun(state.primaryRunId())
                                .map(
                                        run ->
                                                new CrewQueryService.Latest(
                                                        primary.findSnapshot(
                                                                        state.primarySnapshotId())
                                                                .orElseThrow(),
                                                        run));
        var evidence =
                verification.evidenceAsOf(state.reconciliationAsOf()).stream()
                        .filter(e -> state.evidenceIds().contains(e.id()))
                        .toList();
        var resolution =
                verification.resolutionsAsOf(state.reconciliationAsOf()).stream()
                        .filter(e -> state.resolutionIds().contains(e.id()))
                        .toList();
        return new Current(
                state,
                structured,
                query.status(CrewSource.LAUNCH_LIBRARY_2, Station.ISS),
                query.status(CrewSource.NASA_OFFICIAL, Station.ISS),
                repository.latest(),
                verification.latestParseFailure(),
                repository.latestRun(),
                evidence,
                resolution);
    }
}
