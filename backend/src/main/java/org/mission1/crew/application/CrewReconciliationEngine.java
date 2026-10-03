package org.mission1.crew.application;

import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewReconciliationSnapshot.*;
import org.mission1.crew.domain.CrewVerificationEvidence.*;

import java.time.Instant;
import java.util.*;

/** Time-ordered field-aware interpretation; no source mutation or source acquisition. */
public final class CrewReconciliationEngine {
    public static final String VERSION = "crew-reconciliation-v1";

    public record Inputs(
            CrewQueryService.Latest primary,
            boolean primaryAvailable,
            CrewVerificationRepository.Verification verification,
            boolean verificationAvailable,
            List<CrewVerificationRepository.Evidence> evidence,
            List<CrewIdentityResolution> resolutions,
            Instant asOf) {}

    private record Claim(Instant at, Presence state, long evidenceId, boolean fresh, Type type) {}

    private final CrewReconciliationPolicy policy;

    public CrewReconciliationEngine(CrewReconciliationPolicy policy) {
        this.policy = policy;
    }

    public CrewReconciliationSnapshot evaluate(Inputs in) {
        var assigned = new TreeSet<UUID>();
        if (in.primary() != null)
            in.primary()
                    .snapshot()
                    .snapshot()
                    .assignments()
                    .forEach(a -> assigned.add(a.person().mission1Id()));
        Map<String, CrewIdentityResolution> resolved = new HashMap<>();
        in.resolutions().forEach(r -> resolved.put(r.evidenceId() + ":" + r.subjectIndex(), r));
        Map<UUID, List<Claim>> claims = new TreeMap<>();
        var unresolved = new ArrayList<UnresolvedSubject>();
        var usedEvidence = new TreeSet<Long>();
        var usedDocuments = new TreeSet<Long>();
        var usedResolution = new TreeSet<Long>();
        var counts = new ArrayList<CrewVerificationRepository.Evidence>();
        var transitions = new ArrayList<Instant>();
        var exhaustive = new ArrayList<CrewVerificationRepository.Evidence>();
        Instant verifiedAt = in.verification() == null ? null : in.verification().fetchedAt();
        boolean ambiguousIdentity = false;
        for (var item : in.evidence()) {
            var e = item.value();
            var at = effectiveTime(e);
            if (e.assertion() == Assertion.PLANNED
                    || at == null
                    || at.isAfter(in.asOf())
                    || e.observation().retrievedAt().isAfter(in.asOf())) continue;
            boolean personClaim =
                    e.type() == Type.PERSON_CURRENTLY_ABOARD
                            || e.type() == Type.PERSON_ENTERED_STATION
                            || e.type() == Type.PERSON_DEPARTED_STATION;
            if (!personClaim && e.type() != Type.CREW_COUNT_ABOARD) continue;
            boolean transition =
                    e.type() == Type.PERSON_ENTERED_STATION
                            || e.type() == Type.PERSON_DEPARTED_STATION;
            if (transition && e.assertion() != Assertion.COMPLETED) continue;
            if (transition) transitions.add(at);
            usedEvidence.add(item.id());
            usedDocuments.add(item.documentId());
            if (e.type() == Type.CREW_COUNT_ABOARD) {
                counts.add(item);
                continue;
            }
            if (e.type() == Type.PERSON_CURRENTLY_ABOARD
                    && e.completeness() == Completeness.EXHAUSTIVE) exhaustive.add(item);
            for (int i = 0; i < e.people().size(); i++) {
                var r = resolved.get(item.id() + ":" + i);
                if (r != null) usedResolution.add(r.id());
                if (r == null || r.personId() == null) {
                    var method = r == null ? CrewIdentityResolution.Method.UNRESOLVED : r.method();
                    unresolved.add(
                            new UnresolvedSubject(
                                    item.id(),
                                    i,
                                    e.people().get(i).displayName(),
                                    method,
                                    r == null ? List.of() : r.candidates()));
                    if (method == CrewIdentityResolution.Method.AMBIGUOUS) ambiguousIdentity = true;
                    continue;
                }
                Presence state =
                        e.type() == Type.PERSON_DEPARTED_STATION
                                ? Presence.CONFIRMED_NOT_ABOARD
                                : Presence.CONFIRMED_ABOARD;
                claims.computeIfAbsent(r.personId(), x -> new ArrayList<>())
                        .add(
                                new Claim(
                                        at,
                                        state,
                                        item.id(),
                                        in.verificationAvailable()
                                                && policy.applicable(e, verifiedAt, in.asOf()),
                                        e.type()));
            }
        }
        // Exhaustive omission is negative only for a previously evidenced person; live parser never
        // emits EXHAUSTIVE.
        for (var roster : exhaustive) {
            Instant at = effectiveTime(roster.value());
            var rosterIds = new HashSet<UUID>();
            boolean allResolved = true;
            for (int i = 0; i < roster.value().people().size(); i++) {
                var r = resolved.get(roster.id() + ":" + i);
                if (r == null || r.personId() == null) allResolved = false;
                else rosterIds.add(r.personId());
            }
            if (!allResolved) continue;
            for (var entry : claims.entrySet())
                if (!rosterIds.contains(entry.getKey())
                        && entry.getValue().stream()
                                .anyMatch(
                                        c ->
                                                c.state() == Presence.CONFIRMED_ABOARD
                                                        && c.at().isBefore(at)))
                    entry.getValue()
                            .add(
                                    new Claim(
                                            at,
                                            Presence.CONFIRMED_NOT_ABOARD,
                                            roster.id(),
                                            in.verificationAvailable()
                                                    && policy.applicable(
                                                            roster.value(), verifiedAt, in.asOf()),
                                            Type.PERSON_CURRENTLY_ABOARD));
        }
        var ids = new TreeSet<>(assigned);
        ids.addAll(claims.keySet());
        var states = new ArrayList<PersonState>();
        var aboard = new TreeSet<UUID>();
        boolean conflicts = false, stale = false;
        for (var id : ids) {
            var all = claims.getOrDefault(id, List.of());
            if (all.isEmpty()) {
                states.add(
                        new PersonState(
                                id,
                                assigned.contains(id) ? Presence.UNVERIFIED : Presence.UNKNOWN,
                                null,
                                null,
                                List.of(),
                                assigned.contains(id)));
                continue;
            }
            Instant latest = all.stream().map(Claim::at).max(Instant::compareTo).orElseThrow();
            var last = all.stream().filter(c -> c.at().equals(latest)).toList();
            var distinct = last.stream().map(Claim::state).distinct().toList();
            Presence previous = distinct.size() == 1 ? distinct.getFirst() : Presence.AMBIGUOUS;
            Presence state = previous;
            if (distinct.size() > 1) conflicts = true;
            else if (!in.verificationAvailable()) state = Presence.UNVERIFIED;
            else if (last.stream().noneMatch(Claim::fresh)) {
                state = Presence.STALE;
                stale = true;
            }
            if (state == Presence.CONFIRMED_ABOARD) aboard.add(id);
            states.add(
                    new PersonState(
                            id,
                            state,
                            previous,
                            latest,
                            last.stream().map(Claim::evidenceId).distinct().sorted().toList(),
                            assigned.contains(id)));
        }
        Integer count = null;
        boolean countConflict = false;
        if (!counts.isEmpty()) {
            Instant newest =
                    counts.stream()
                            .map(e -> effectiveTime(e.value()))
                            .max(Instant::compareTo)
                            .orElseThrow();
            var latest =
                    counts.stream().filter(e -> effectiveTime(e.value()).equals(newest)).toList();
            var values = latest.stream().map(e -> e.value().crewCount()).distinct().toList();
            countConflict = values.size() > 1;
            if (!countConflict) count = values.getFirst();
            // A later arrival/departure invalidates an older count, but never fabricates a new
            // count.
            if (transitions.stream().anyMatch(t -> t.isAfter(newest))) count = null;
            if (count != null
                    && latest.stream()
                            .noneMatch(e -> policy.applicable(e.value(), verifiedAt, in.asOf())))
                stale = true;
        }
        var both = intersection(assigned, aboard);
        var ll2Only = difference(assigned, aboard);
        var nasaOnly = difference(aboard, assigned);
        boolean primaryFresh =
                in.primary() != null
                        && policy.fresh(
                                in.primary().latestSuccessfulFetchAt(),
                                policy.primaryMaxAge(),
                                in.asOf());
        boolean comparable =
                exhaustive.stream()
                        .anyMatch(e -> policy.applicable(e.value(), verifiedAt, in.asOf()));
        boolean countMismatch = count != null && count != aboard.size();
        ReconciliationStatus status;
        if (ambiguousIdentity
                || conflicts
                || countConflict
                || (count != null && count < aboard.size()))
            status = ReconciliationStatus.AMBIGUOUS;
        else if (in.verification() == null || !in.verificationAvailable() || usedEvidence.isEmpty())
            status = ReconciliationStatus.VERIFICATION_UNAVAILABLE;
        else if (stale || !policy.fresh(verifiedAt, policy.verificationMaxAge(), in.asOf()))
            status = ReconciliationStatus.STALE;
        else if (in.primary() == null || !in.primaryAvailable())
            status = ReconciliationStatus.PRIMARY_UNAVAILABLE;
        else if (!primaryFresh) status = ReconciliationStatus.STALE;
        else if (comparable
                && ll2Only.isEmpty()
                && nasaOnly.isEmpty()
                && unresolved.isEmpty()
                && !countMismatch) status = ReconciliationStatus.MATCH;
        else if (!nasaOnly.isEmpty()
                && unresolved.isEmpty()
                && nasaOnly.stream()
                        .allMatch(
                                id ->
                                        claims.get(id).stream()
                                                .anyMatch(
                                                        c ->
                                                                c.type()
                                                                                == Type
                                                                                        .PERSON_ENTERED_STATION
                                                                        && c.fresh()
                                                                        && c.at().isAfter(
                                                                                        in.primary()
                                                                                                .latestSuccessfulFetchAt()))))
            status = ReconciliationStatus.NASA_AHEAD;
        else if (comparable
                && nasaOnly.isEmpty()
                && !ll2Only.isEmpty()
                && unresolved.isEmpty()
                && in.primary().snapshot().snapshot().assignments().stream()
                        .filter(a -> ll2Only.contains(a.person().mission1Id()))
                        .allMatch(
                                a ->
                                        a.validFrom() != null
                                                && a.validFrom()
                                                        .isAfter(
                                                                exhaustive.stream()
                                                                        .map(
                                                                                e ->
                                                                                        effectiveTime(
                                                                                                e
                                                                                                        .value()))
                                                                        .max(Instant::compareTo)
                                                                        .orElseThrow())))
            status = ReconciliationStatus.LL2_AHEAD;
        else status = ReconciliationStatus.PARTIAL_MATCH;
        int unidentified = count == null ? 0 : Math.max(0, count - aboard.size());
        unresolved.sort(
                Comparator.comparingLong(UnresolvedSubject::evidenceId)
                        .thenComparingInt(UnresolvedSubject::subjectIndex));
        return new CrewReconciliationSnapshot(
                VERSION + "/" + policy.key(),
                in.asOf(),
                in.primary() == null ? null : in.primary().snapshot().id(),
                in.primary() == null ? null : in.primary().successfulRun().id(),
                in.verification() == null ? null : in.verification().runId(),
                in.primary() == null ? null : in.primary().latestSuccessfulFetchAt(),
                verifiedAt,
                status,
                count,
                unidentified,
                states,
                unresolved,
                both,
                ll2Only,
                nasaOnly,
                List.copyOf(usedEvidence),
                List.copyOf(usedResolution),
                List.copyOf(usedDocuments));
    }

    public static Instant effectiveTime(CrewVerificationEvidence e) {
        return e.observation().sourceEventAt() == null
                ? e.observation().sourcePublishedAt()
                : e.observation().sourceEventAt();
    }

    private static List<UUID> intersection(Set<UUID> a, Set<UUID> b) {
        return a.stream().filter(b::contains).sorted().toList();
    }

    private static List<UUID> difference(Set<UUID> a, Set<UUID> b) {
        return a.stream().filter(x -> !b.contains(x)).sorted().toList();
    }
}
