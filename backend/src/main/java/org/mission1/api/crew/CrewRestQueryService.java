package org.mission1.api.crew;

import static org.mission1.api.crew.CrewReadException.Reason.*;
import static org.mission1.api.crew.CrewResponses.*;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

/** Application-facing REST composition. Reads persisted state; no ingestion/source dependencies. */
@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class CrewRestQueryService {
    private static final CrewResponses.Station ISS =
            new CrewResponses.Station("ISS", "International Space Station");
    private final CrewQueryService structured;
    private final CrewReconciliationQueryService reconciled;
    private final CrewReadQueryService people;
    private final CrewReconciliationPolicy policy;
    private final Clock clock;
    private final ProductionCurrentMembership membership;

    public CrewRestQueryService(
            CrewQueryService structured,
            CrewReconciliationQueryService reconciled,
            CrewReadQueryService people,
            CrewReconciliationPolicy policy,
            Clock clock,
            ProductionCurrentMembership membership) {
        this.structured = structured;
        this.reconciled = reconciled;
        this.people = people;
        this.policy = policy;
        this.clock = clock;
        this.membership = membership;
    }

    public Crew crew() {
        var current = reconciled.current();
        var state = current.interpretation();
        boolean activeMode =
                membership.mode() == ProductionCurrentMembership.Mode.ACTIVE_PROJECTION;
        if (!activeMode
                && current.structuredPrimary().isEmpty()
                && state.people().isEmpty()
                && state.unresolved().isEmpty()
                && state.officialCrewCount() == null)
            throw new CrewReadException(STATE_UNAVAILABLE);
        var identity = people.identityAt(state.reconciliationAsOf());
        var selected = activeMode ? membership.select(state.reconciliationAsOf(), identity) : null;
        var persons =
                activeMode
                        ? Map.<UUID, CrewReadRepository.Person>of()
                        : people.findPeople(
                                state.people().stream()
                                        .map(CrewReconciliationSnapshot.PersonState::personId)
                                        .toList(),
                                state.reconciliationAsOf());
        var members =
                activeMode
                        ? selected.members().stream()
                                .sorted(
                                        Comparator.comparingInt(
                                                        (CrewReadRepository.Person p) ->
                                                                assignmentOrder(p.id(), current))
                                                .thenComparing(p -> p.id().toString()))
                                .map(
                                        p ->
                                                member(
                                                        p,
                                                        state.people().stream()
                                                                .filter(
                                                                        s ->
                                                                                s.personId()
                                                                                        .equals(
                                                                                                p
                                                                                                        .id()))
                                                                .findFirst()
                                                                .orElse(null),
                                                        current,
                                                        identity))
                                .toList()
                        : state.people().stream()
                                .map(
                                        p ->
                                                member(
                                                        requirePerson(persons, p.personId()),
                                                        p,
                                                        current,
                                                        identity))
                                .toList();
        Map<Long, CrewVerificationRepository.Evidence> evidence = new HashMap<>();
        current.verificationEvidence().forEach(e -> evidence.put(e.id(), e));
        var unresolved =
                activeMode
                        ? List.<UnresolvedSubject>of()
                        : state.unresolved().stream()
                                .map(
                                        u -> {
                                            var e =
                                                    Objects.requireNonNull(
                                                                    evidence.get(u.evidenceId()),
                                                                    "Missing interpretation"
                                                                        + " evidence")
                                                            .value();
                                            return new UnresolvedSubject(
                                                    u.displayName(),
                                                    u.method().name(),
                                                    assertion(e),
                                                    healthy(current.verificationHealth())
                                                            && policy.applicable(
                                                                    e,
                                                                    state.verificationFetchedAt(),
                                                                    state.reconciliationAsOf()));
                                        })
                                .toList();
        boolean currentCount =
                state.officialCrewCount() != null
                        && healthy(current.verificationHealth())
                        && current.verificationEvidence().stream()
                                .map(CrewVerificationRepository.Evidence::value)
                                .filter(
                                        e ->
                                                e.type()
                                                        == CrewVerificationEvidence.Type
                                                                .CREW_COUNT_ABOARD)
                                .filter(
                                        e ->
                                                Objects.equals(
                                                        e.crewCount(), state.officialCrewCount()))
                                .anyMatch(
                                        e ->
                                                policy.applicable(
                                                        e,
                                                        state.verificationFetchedAt(),
                                                        state.reconciliationAsOf()));
        var snapshot = current.structuredPrimary().map(x -> x.snapshot().snapshot()).orElse(null);
        return new Crew(
                ISS,
                expedition(snapshot),
                new Counts(
                        currentCount ? state.officialCrewCount() : null,
                        state.officialCrewCount(),
                        (int)
                                state.people().stream()
                                        .filter(
                                                p ->
                                                        p.presence()
                                                                == CrewReconciliationSnapshot
                                                                        .Presence.CONFIRMED_ABOARD)
                                        .count(),
                        unresolved.size(),
                        state.unidentifiedCount(),
                        snapshot == null ? null : snapshot.assignments().size()),
                members,
                unresolved,
                reconciliation(current),
                freshness(current),
                provenance(current),
                selected == null
                        ? null
                        : new MembershipProjection(
                                membership.mode().name(),
                                selected.projection().revision(),
                                selected.projection().evaluatedAt(),
                                selected.projection().result().policy(),
                                selected.health().name(),
                                Math.max(
                                        0,
                                        Duration.between(
                                                        selected.projection().evaluatedAt(),
                                                        state.reconciliationAsOf())
                                                .toSeconds()),
                                members.size(),
                                selected.nonPublishableActive(),
                                selected.canonicalCollisions(),
                                selected.projection().result().counts().unresolvedActiveSlots()));
    }

    private static int assignmentOrder(UUID id, CrewReconciliationQueryService.Current current) {
        var assignments =
                current.structuredPrimary()
                        .map(x -> x.snapshot().snapshot().assignments())
                        .orElse(List.of());
        for (int i = 0; i < assignments.size(); i++)
            if (assignments.get(i).person().mission1Id().equals(id)) return i;
        return Integer.MAX_VALUE;
    }

    public CurrentExpedition expedition() {
        Instant at = clock.instant();
        var health =
                structured.status(
                        CrewSource.LAUNCH_LIBRARY_2, org.mission1.crew.domain.Station.ISS);
        var latest =
                structured
                        .latest(CrewSource.LAUNCH_LIBRARY_2, org.mission1.crew.domain.Station.ISS)
                        .orElse(null);
        // NO_ACTIVE is an explicit persisted semantic outcome; subsequent transport failures retain
        // it.
        var outcome = people.latestStructuredOutcome().orElse(null);
        if (outcome != null && outcome.sourceState() == CrewSourceState.NO_ACTIVE_EXPEDITION)
            return new CurrentExpedition(
                    ISS,
                    null,
                    0,
                    List.of(),
                    "NO_ACTIVE_EXPEDITION",
                    health(health, CrewSource.LAUNCH_LIBRARY_2, policy.primaryMaxAge(), at),
                    outcome.observation() == null ? null : observation(outcome.observation()));
        if (latest == null) throw new CrewReadException(PRIMARY_UNAVAILABLE);
        var s = people.identityAt(at).project(latest).snapshot().snapshot();
        var profiles = new HashMap<UUID, AstronautProfile>();
        s.profiles().forEach(p -> profiles.put(p.person().mission1Id(), p));
        var assignments =
                s.assignments().stream()
                        .map(
                                a -> {
                                    var p = profiles.get(a.person().mission1Id());
                                    return new ExpeditionAssignment(
                                            a.person().mission1Id(),
                                            a.person().displayName(),
                                            a.sourceRoleLabel(),
                                            a.role().name(),
                                            p == null ? null : agency(p.agency()),
                                            p == null ? List.of() : nationalities(p));
                                })
                        .toList();
        return new CurrentExpedition(
                ISS,
                expedition(s),
                assignments.size(),
                assignments,
                "AVAILABLE",
                health(health, CrewSource.LAUNCH_LIBRARY_2, policy.primaryMaxAge(), at),
                observation(s.observation()));
    }

    public Person person(UUID id) {
        var current = reconciled.current();
        var at = current.interpretation().reconciliationAsOf();
        var p = people.findPeople(List.of(id), at).get(id);
        if (p == null) throw new CrewReadException(PERSON_NOT_FOUND);
        var state =
                current.interpretation().people().stream()
                        .filter(x -> x.personId().equals(p.id()))
                        .findFirst()
                        .orElse(null);
        var profile = p.profile();
        return new Person(
                p.id(),
                p.name(),
                p.officialProfileUrl(),
                externalIds(p.externalIds()),
                profile == null ? null : agency(profile.agency()),
                profile == null ? List.of() : nationalities(profile),
                profile == null ? null : profile.biography(),
                profile == null ? null : media(profile.media()),
                profile == null ? null : career(profile.career()),
                profile == null ? "UNAVAILABLE" : "AVAILABLE",
                assignment(p.id(), current),
                presence(state, current),
                reconciliation(current),
                profile == null ? null : observation(profile.observation()),
                p.profileFetchedAt(),
                metadata(p, id, current, people.identityAt(at)));
    }

    private Member member(
            CrewReadRepository.Person p,
            CrewReconciliationSnapshot.PersonState state,
            CrewReconciliationQueryService.Current current,
            CrewCanonicalIdentity identity) {
        var profile = p.profile();
        return new Member(
                p.id(),
                profile == null ? p.name() : profile.person().displayName(),
                profile == null ? null : agency(profile.agency()),
                profile == null ? List.of() : nationalities(profile),
                profile == null ? null : media(profile.media()),
                assignment(p.id(), current),
                presence(state, current),
                externalIds(p.externalIds()),
                metadata(p, p.id(), current, identity));
    }

    private CrewCanonicalProfileMetadata.Metadata metadata(
            CrewReadRepository.Person p,
            UUID requested,
            CrewReconciliationQueryService.Current current,
            CrewCanonicalIdentity identity) {
        var assignmentObservation =
                current.structuredPrimary().stream()
                        .flatMap(l -> l.snapshot().snapshot().assignments().stream())
                        .filter(a -> a.person().mission1Id().equals(p.id()))
                        .map(CrewAssignment::observation)
                        .findFirst()
                        .orElse(null);
        var state =
                current.interpretation().people().stream()
                        .filter(s -> s.personId().equals(p.id()))
                        .findFirst()
                        .orElse(null);
        return CrewCanonicalProfileMetadata.describe(
                p, requested, identity, assignmentObservation, presence(state, current).evidence());
    }

    private static CrewReadRepository.Person requirePerson(
            Map<UUID, CrewReadRepository.Person> people, UUID id) {
        return Objects.requireNonNull(people.get(id), "Missing persisted Crew person");
    }

    private static Assignment assignment(UUID id, CrewReconciliationQueryService.Current current) {
        var s = current.structuredPrimary().map(x -> x.snapshot().snapshot()).orElse(null);
        if (s == null) return null;
        return s.assignments().stream()
                .filter(a -> a.person().mission1Id().equals(id))
                .findFirst()
                .map(
                        a ->
                                new Assignment(
                                        s.expeditions().getFirst().mission1Id(),
                                        a.sourceRoleLabel(),
                                        a.role().name(),
                                        a.validFrom(),
                                        a.validUntil()))
                .orElse(null);
    }

    private static Presence presence(
            CrewReconciliationSnapshot.PersonState state,
            CrewReconciliationQueryService.Current current) {
        if (state == null) return new Presence("UNKNOWN", null, null, null, List.of());
        var evidence =
                current.verificationEvidence().stream()
                        .filter(e -> state.evidenceIds().contains(e.id()))
                        .map(e -> assertion(e.value()))
                        .toList();
        return new Presence(
                state.presence().name(),
                name(state.lastKnownPresence()),
                state.assertionAsOf(),
                evidence.isEmpty() ? null : "NASA_OFFICIAL",
                evidence);
    }

    public static CrewResponses.Expedition expedition(CrewSourceSnapshot s) {
        if (s == null || s.expeditions().isEmpty()) return null;
        var e = s.expeditions().getFirst();
        return new CrewResponses.Expedition(
                e.mission1Id(), e.name(), e.start(), e.end(), externalIds(List.of(e.externalId())));
    }

    private Reconciliation reconciliation(CrewReconciliationQueryService.Current c) {
        var s = c.interpretation();
        var run = c.lastReconciliationAttempt().orElse(null);
        return new Reconciliation(
                s.status().name(),
                s.reconciliationAsOf(),
                c.lastPersistedInterpretation()
                        .map(x -> x.value().reconciliationAsOf())
                        .orElse(null),
                s.algorithmVersion(),
                run == null ? null : run.startedAt(),
                run == null ? null : run.completedAt(),
                run == null ? null : run.result());
    }

    private Freshness freshness(CrewReconciliationQueryService.Current c) {
        var at = c.interpretation().reconciliationAsOf();
        return new Freshness(
                at,
                health(c.primaryHealth(), CrewSource.LAUNCH_LIBRARY_2, policy.primaryMaxAge(), at),
                health(
                        c.verificationHealth(),
                        CrewSource.NASA_OFFICIAL,
                        policy.verificationMaxAge(),
                        at),
                c.interpretation().status() == ReconciliationStatus.STALE);
    }

    private SourceHealth health(
            CrewQueryService.Status h, CrewSource source, Duration max, Instant at) {
        var attempt = h.lastAttempt().orElse(null);
        var failure = h.lastFailure().orElse(null);
        var fetched =
                h.lastSuccess()
                        .map(CrewSyncRun::observation)
                        .map(CrewSourceObservation::retrievedAt)
                        .orElse(null);
        return new SourceHealth(
                source.name(),
                attempt == null ? null : name(attempt.sourceState()),
                attempt == null ? null : attempt.startedAt(),
                attempt == null ? null : attempt.outcome().name(),
                fetched,
                failure == null ? null : failure.startedAt(),
                failure != null
                        && failure.sourceState() != CrewSourceState.NO_ACTIVE_EXPEDITION
                        && !healthy(h),
                h.rateLimited(),
                h.retryAfterAt().orElse(null),
                fetched != null && !policy.fresh(fetched, max, at));
    }

    private static boolean healthy(CrewQueryService.Status h) {
        var success = h.lastSuccess().orElse(null);
        var failure = h.lastFailure().orElse(null);
        return success != null && (failure == null || !newer(failure, success));
    }

    private static boolean newer(CrewSyncRun a, CrewSyncRun b) {
        return a.startedAt().isAfter(b.startedAt())
                || (a.startedAt().equals(b.startedAt()) && a.id() > b.id());
    }

    private static Provenance provenance(CrewReconciliationQueryService.Current c) {
        return new Provenance(
                c.structuredPrimary()
                        .map(x -> observation(x.snapshot().snapshot().observation()))
                        .orElse(null),
                c.verificationHealth()
                        .lastSuccess()
                        .map(CrewSyncRun::observation)
                        .map(CrewRestQueryService::observation)
                        .orElse(null),
                c.verificationEvidence().stream()
                        .map(e -> assertion(e.value()))
                        .distinct()
                        .toList());
    }

    public static Assertion assertion(CrewVerificationEvidence e) {
        return new Assertion(
                e.observation().source().name(),
                e.sourceType().name(),
                e.type().name(),
                e.assertion().name(),
                e.completeness().name(),
                CrewReconciliationEngine.effectiveTime(e),
                observation(e.observation(), e.sourceType().name()));
    }

    public static Observation observation(CrewSourceObservation o) {
        return observation(
                o, o.source() == CrewSource.NASA_OFFICIAL ? "NASA_ISS_OPERATIONAL_FEED" : null);
    }

    public static Observation observation(CrewSourceObservation o, String sourceType) {
        return new Observation(
                o.source().name(),
                sourceType,
                o.sourceUrl(),
                o.retrievedAt(),
                o.sourcePublishedAt(),
                o.sourceEventAt(),
                o.contentHash(),
                o.sourceVersion(),
                o.adapterVersion());
    }

    public static List<CrewResponses.ExternalId> externalIds(
            List<org.mission1.crew.domain.ExternalId> ids) {
        return ids.stream()
                .map(x -> new CrewResponses.ExternalId(x.source().name(), x.value()))
                .toList();
    }

    public static CrewResponses.Agency agency(org.mission1.crew.domain.Agency a) {
        return a == null
                ? null
                : new CrewResponses.Agency(
                        a.name(), a.abbreviation(), a.type(), externalIds(a.externalIds()));
    }

    public static List<CrewResponses.Nationality> nationalities(AstronautProfile p) {
        return p.nationalities().stream()
                .map(n -> new CrewResponses.Nationality(n.alpha2(), n.alpha3(), n.displayName()))
                .toList();
    }

    public static Media media(CrewMediaAsset m) {
        return m == null
                ? null
                : new Media(
                        m.url(),
                        m.thumbnailUrl(),
                        m.credit(),
                        m.licenseName(),
                        m.licenseUrl(),
                        m.singleUse());
    }

    public static Career career(CareerStatistics c) {
        return c == null
                ? null
                : new Career(
                        string(c.timeInSpace()),
                        string(c.evaTime()),
                        c.flightsCount(),
                        c.spacewalksCount(),
                        c.firstFlight(),
                        c.lastFlight());
    }

    private static String string(Object value) {
        return value == null ? null : value.toString();
    }

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
