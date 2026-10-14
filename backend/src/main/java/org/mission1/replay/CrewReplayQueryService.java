package org.mission1.replay;

import java.time.Instant;
import java.util.*;
import org.mission1.api.crew.CrewResponses;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.CrewVerificationEvidence;

/** Installation-relative Historical over the same pure membership lifecycle as Current. */
public final class CrewReplayQueryService {
    public record Result(
            Instant requestedAt,
            Instant effectiveAt,
            String availability,
            String quality,
            ReplayCoverage coverage,
            String profilePolicy,
            CrewResponses.Crew state,
            List<CrewResponses.Person> profiles) {}

    private final ReplayHistoryRepository history;
    private final CrewVerificationRepository verification;
    private final CrewReconciliationPolicy policy;
    private final UnifiedCrewReplay unified;

    public CrewReplayQueryService(ReplayHistoryRepository history, CrewVerificationRepository verification,
            CrewReconciliationPolicy policy, UnifiedCrewReplay unified) {
        this.history = Objects.requireNonNull(history);
        this.verification = Objects.requireNonNull(verification);
        this.policy = Objects.requireNonNull(policy);
        this.unified = Objects.requireNonNull(unified);
    }

    public ReplayCoverage coverage(Instant knownAt) {
        return coverage(history.structured(), new CrewCompatibleVersionSelector().select(
                verification.evidenceAsOf(knownAt), verification.occurrenceVersionsAsOf(knownAt)).evidence(), knownAt);
    }

    private ReplayCoverage coverage(
            List<ReplayHistoryRepository.Structured> structured,
            List<CrewVerificationRepository.Evidence> evidence,
            Instant now) {
        var intervals = new ArrayList<ReplayCoverage.Interval>();
        structured.forEach(
                s ->
                        intervals.add(
                                new ReplayCoverage.Interval(
                                        s.observedAt(),
                                        s.observedAt().plus(policy.primaryMaxAge()))));
        evidence.stream()
                .map(CrewVerificationRepository.Evidence::value)
                .filter(CrewReplayQueryService::operational)
                .forEach(
                        e -> {
                            var t = CrewReconciliationEngine.effectiveTime(e);
                            if (t != null)
                                intervals.add(
                                        new ReplayCoverage.Interval(
                                                t, t.plus(policy.effectiveMaxAge(e))));
                        });
        intervals.addAll(unified.editorialIntervals(now));
        return ReplayCoverage.of(
                intervals,
                now,
                true,
                List.of(
                        "Partial assertions do not establish a complete roster",
                        "Structured state begins at capture; gaps preserve unknown assignments and"
                                + " expedition",
                        "Effective-time applicability is bounded; profiles use latest retained"
                                + " metadata"));
    }

    private static boolean operational(CrewVerificationEvidence e) {
        if (e.assertion() == CrewVerificationEvidence.Assertion.PLANNED) return false;
        return switch (e.type()) {
            case PERSON_ENTERED_STATION, PERSON_DEPARTED_STATION ->
                    e.assertion() == CrewVerificationEvidence.Assertion.COMPLETED;
            case PERSON_CURRENTLY_ABOARD, CREW_COUNT_ABOARD -> true;
            default -> false;
        };
    }

    public Result at(Instant at, Instant knownAt) {
        return unified.at(at, knownAt, coverage(knownAt));
    }
}
