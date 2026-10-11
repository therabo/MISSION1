package org.mission1.replay;

import static org.mission1.api.crew.CrewRestQueryService.*;

import org.mission1.api.crew.CrewResponses;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;

import java.time.*;
import java.util.*;

/**
 * Effective-time reconstruction. Reads immutable evidence; never reconciles/persists identities.
 */
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
    private final CrewRepository runs;
    private final CrewVerificationRepository verification;
    private final CrewReadRepository people;
    private final CrewReconciliationPolicy policy;
    private final CrewReconciliationEngine engine;

    private CrewIdentityRepository identities = CrewIdentityRepository.EMPTY;

    public CrewReplayQueryService(
            ReplayHistoryRepository history,
            CrewRepository runs,
            CrewVerificationRepository verification,
            CrewReadRepository people,
            CrewReconciliationPolicy policy) {
        this.history = history;
        this.runs = runs;
        this.verification = verification;
        this.people = people;
        this.policy = policy;
        this.engine = new CrewReconciliationEngine(policy);
    }

    public CrewReplayQueryService(
            ReplayHistoryRepository h,
            CrewRepository r,
            CrewVerificationRepository v,
            CrewReadRepository p,
            CrewReconciliationPolicy policy,
            CrewIdentityRepository identities) {
        this(h, r, v, p, policy);
        this.identities = identities;
    }

    public ReplayCoverage coverage(Instant knownAt) {
        return coverage(history.structured(), new CrewCompatibleVersionSelector().select(
                verification.publicEvidenceAsOf(knownAt), verification.occurrenceVersionsAsOf(knownAt)).evidence(), knownAt);
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
        var structured = history.structured();
        var evidence = new CrewCompatibleVersionSelector().select(
                verification.publicEvidenceAsOf(knownAt), verification.occurrenceVersionsAsOf(knownAt)).evidence();
        var coverage = coverage(structured, evidence, knownAt);
        if (!coverage.contains(at))
            return new Result(
                    at,
                    at,
                    "UNAVAILABLE",
                    "NO_DATA",
                    coverage,
                    "LATEST_AVAILABLE_CANONICAL_METADATA",
                    null,
                    List.of());
        var selected =
                structured.stream()
                        .filter(s -> !s.observedAt().isAfter(at))
                        .max(
                                Comparator.comparing(ReplayHistoryRepository.Structured::observedAt)
                                        .thenComparingLong(
                                                ReplayHistoryRepository.Structured::runId))
                        .orElse(null);
        boolean noActive =
                selected != null
                        && selected.noActive()
                        && policy.fresh(selected.observedAt(), policy.primaryMaxAge(), at);
        var noActiveRun = noActive ? runs.findRun(selected.runId()).orElseThrow() : null;
        CrewQueryService.Latest primary = null;
        if (selected != null
                && !selected.noActive()
                && policy.fresh(selected.observedAt(), policy.primaryMaxAge(), at)) {
            var run = runs.findRun(selected.runId()).orElseThrow();
            var stored = runs.findSnapshot(run.snapshotId()).orElseThrow();
            var s = stored.snapshot();
            var assignments =
                    s.assignments().stream()
                            .filter(
                                    a ->
                                            (a.validFrom() == null || !at.isBefore(a.validFrom()))
                                                    && (a.validUntil() == null
                                                            || at.isBefore(a.validUntil())))
                            .toList();
            var filtered =
                    new CrewSourceSnapshot(
                            s.station(),
                            s.totalActiveExpeditions(),
                            s.candidatesComplete(),
                            s.expeditions(),
                            assignments,
                            s.profiles(),
                            s.observation(),
                            s.sourceStationExternalId());
            primary =
                    new CrewQueryService.Latest(
                            new CrewRepository.StoredSnapshot(stored.id(), filtered), run);
        }
        var identity = identities.knowledge(knownAt);
        primary = identity.project(primary);
        var verified = verification.latestSuccess().orElse(null);
        var state =
                engine.evaluateEffectiveTime(
                        new CrewReconciliationEngine.Inputs(
                                primary,
                                primary != null,
                                verified,
                                true,
                                evidence,
                                identity.project(verification.resolutionsAsOf(knownAt)),
                                at));
        var used = evidence.stream().filter(e -> state.evidenceIds().contains(e.id())).toList();
        var persons =
                people.findPeople(
                        state.people().stream()
                                .map(CrewReconciliationSnapshot.PersonState::personId)
                                .toList(),
                        knownAt);
        var members = new ArrayList<CrewResponses.Member>();
        var profiles = new ArrayList<CrewResponses.Person>();
        var recon =
                new CrewResponses.Reconciliation(
                        state.status().name(),
                        at,
                        null,
                        state.algorithmVersion(),
                        null,
                        null,
                        null);
        var snapshot = primary == null ? null : primary.snapshot().snapshot();
        for (var s : state.people()) {
            var p =
                    Objects.requireNonNull(
                            persons.get(s.personId()), "Historical identity missing");
            var profile = p.profile();
            var assertions =
                    used.stream()
                            .filter(e -> s.evidenceIds().contains(e.id()))
                            .map(e -> assertion(e.value()))
                            .toList();
            var presence =
                    new CrewResponses.Presence(
                            s.presence().name(),
                            s.lastKnownPresence() == null ? null : s.lastKnownPresence().name(),
                            s.assertionAsOf(),
                            assertions.isEmpty() ? null : "NASA_OFFICIAL",
                            assertions);
            CrewResponses.Assignment assignment = null;
            if (snapshot != null)
                assignment =
                        snapshot.assignments().stream()
                                .filter(a -> a.person().mission1Id().equals(p.id()))
                                .findFirst()
                                .map(
                                        a ->
                                                new CrewResponses.Assignment(
                                                        snapshot.expeditions()
                                                                .getFirst()
                                                                .mission1Id(),
                                                        a.sourceRoleLabel(),
                                                        a.role().name(),
                                                        a.validFrom(),
                                                        a.validUntil()))
                                .orElse(null);
            var agency = profile == null ? null : agency(profile.agency());
            var nations =
                    profile == null ? List.<CrewResponses.Nationality>of() : nationalities(profile);
            var media = profile == null ? null : media(profile.media());
            members.add(
                    new CrewResponses.Member(
                            p.id(),
                            p.name(),
                            agency,
                            nations,
                            media,
                            assignment,
                            presence,
                            externalIds(p.externalIds()),
                            org.mission1.api.crew.CrewCanonicalProfileMetadata.describe(
                                    p,
                                    p.id(),
                                    identity,
                                    snapshot == null
                                            ? null
                                            : snapshot.assignments().stream()
                                                    .filter(
                                                            a ->
                                                                    a.person()
                                                                            .mission1Id()
                                                                            .equals(p.id()))
                                                    .map(
                                                            org.mission1.crew.domain.CrewAssignment
                                                                    ::observation)
                                                    .findFirst()
                                                    .orElse(null),
                                    assertions)));
            profiles.add(
                    new CrewResponses.Person(
                            p.id(),
                            p.name(),
                            p.officialProfileUrl(),
                            externalIds(p.externalIds()),
                            agency,
                            nations,
                            profile == null ? null : profile.biography(),
                            media,
                            profile == null ? null : career(profile.career()),
                            profile == null ? "UNAVAILABLE" : "AVAILABLE",
                            assignment,
                            presence,
                            recon,
                            profile == null ? null : observation(profile.observation()),
                            p.profileFetchedAt(),
                            org.mission1.api.crew.CrewCanonicalProfileMetadata.describe(
                                    p,
                                    p.id(),
                                    identity,
                                    snapshot == null
                                            ? null
                                            : snapshot.assignments().stream()
                                                    .filter(
                                                            a ->
                                                                    a.person()
                                                                            .mission1Id()
                                                                            .equals(p.id()))
                                                    .map(
                                                            org.mission1.crew.domain.CrewAssignment
                                                                    ::observation)
                                                    .findFirst()
                                                    .orElse(null),
                                    assertions)));
        }
        var byId = new HashMap<Long, CrewVerificationRepository.Evidence>();
        used.forEach(e -> byId.put(e.id(), e));
        var unresolved =
                state.unresolved().stream()
                        .map(
                                u ->
                                        new CrewResponses.UnresolvedSubject(
                                                u.displayName(),
                                                u.method().name(),
                                                assertion(byId.get(u.evidenceId()).value()),
                                                policy.applicableEffectiveTime(
                                                        byId.get(u.evidenceId()).value(), at)))
                        .toList();
        var countEvidence =
                used.stream()
                        .map(CrewVerificationRepository.Evidence::value)
                        .filter(e -> e.type() == CrewVerificationEvidence.Type.CREW_COUNT_ABOARD)
                        .max(Comparator.comparing(CrewReconciliationEngine::effectiveTime))
                        .orElse(null);
        boolean currentCount =
                state.officialCrewCount() != null
                        && countEvidence != null
                        && policy.applicableEffectiveTime(countEvidence, at);
        int aboard =
                (int)
                        state.people().stream()
                                .filter(
                                        s ->
                                                s.presence()
                                                        == CrewReconciliationSnapshot.Presence
                                                                .CONFIRMED_ABOARD)
                                .count();
        var counts =
                new CrewResponses.Counts(
                        currentCount ? state.officialCrewCount() : null,
                        state.officialCrewCount(),
                        aboard,
                        unresolved.size(),
                        currentCount ? state.unidentifiedCount() : 0,
                        snapshot == null ? (noActive ? Integer.valueOf(0) : null) : Integer.valueOf(snapshot.assignments().size()));
        var provenance =
                new CrewResponses.Provenance(
                        snapshot == null
                                ? (noActiveRun == null
                                        ? null
                                        : observation(noActiveRun.observation()))
                                : observation(snapshot.observation()),
                        null,
                        used.stream().map(e -> assertion(e.value())).distinct().toList());
        var crew =
                new CrewResponses.Crew(
                        new CrewResponses.Station("ISS", "International Space Station"),
                        expedition(snapshot),
                        counts,
                        members,
                        unresolved,
                        recon,
                        new CrewResponses.Freshness(
                                at,
                                new CrewResponses.SourceHealth(
                                        "LAUNCH_LIBRARY_2",
                                        snapshot == null
                                                ? (noActive
                                                        ? "NO_ACTIVE_EXPEDITION"
                                                        : "UNAVAILABLE")
                                                : "AVAILABLE",
                                        null,
                                        null,
                                        primary == null
                                                ? (noActive ? selected.observedAt() : null)
                                                : primary.latestSuccessfulFetchAt(),
                                        null,
                                        false,
                                        false,
                                        null,
                                        snapshot == null && !noActive),
                                new CrewResponses.SourceHealth(
                                        "NASA_OFFICIAL",
                                        used.isEmpty() ? "UNAVAILABLE" : "AVAILABLE",
                                        null,
                                        null,
                                        verified == null ? null : verified.fetchedAt(),
                                        null,
                                        false,
                                        false,
                                        null,
                                        used.stream()
                                                .noneMatch(
                                                        e ->
                                                                policy.applicableEffectiveTime(
                                                                        e.value(), at))),
                                state.status() == ReconciliationStatus.STALE),
                        provenance);
        return new Result(
                at,
                at,
                "PARTIAL",
                "PARTIAL",
                coverage,
                "LATEST_AVAILABLE_CANONICAL_METADATA; OPERATIONAL_FIELDS_AT_REQUESTED_TIME",
                crew,
                List.copyOf(profiles));
    }
}
