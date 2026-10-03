package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.time.*;
import java.util.*;

/**
 * Pure eligibility and event-specific settlement. All times are UTC instants supplied by callers.
 */
public final class CrewRefreshPolicy {
    public enum Target {
        LL2_ROSTER,
        NASA_VERIFICATION,
        LL2_EVENT_CATALOG
    }

    public enum Reason {
        BASELINE_SCHEDULE,
        BASELINE_CATALOG_REFRESH,
        UPCOMING_CREWED_EVENT,
        UNKNOWN_EVENT_WINDOW,
        NASA_COMPLETED_ARRIVAL,
        NASA_COMPLETED_DEPARTURE,
        STRUCTURED_SOURCE_LAG_FOLLOW_UP,
        MANUAL_OR_TEST
    }

    public record Settings(
            Duration roster,
            Duration nasa,
            Duration catalog,
            Duration pre,
            Duration post,
            Duration crewed,
            Duration unknown,
            Duration followUp,
            Duration horizon,
            Duration catalogMaxAge,
            int maxAttempts,
            int ll2HourlyBudget) {
        public static Settings defaults() {
            return new Settings(
                    Duration.ofHours(2),
                    Duration.ofHours(2),
                    Duration.ofHours(6),
                    Duration.ofHours(6),
                    Duration.ofHours(6),
                    Duration.ofMinutes(30),
                    Duration.ofHours(1),
                    Duration.ofHours(1),
                    Duration.ofHours(24),
                    Duration.ofHours(12),
                    6,
                    12);
        }

        public Settings {
            for (var d :
                    List.of(
                            roster,
                            nasa,
                            catalog,
                            pre,
                            post,
                            crewed,
                            unknown,
                            followUp,
                            horizon,
                            catalogMaxAge))
                if (d.isNegative() || d.isZero())
                    throw new IllegalArgumentException("Positive durations required");
            if (roster.compareTo(Duration.ofHours(1)) < 0
                    || nasa.compareTo(Duration.ofHours(1)) < 0
                    || catalog.compareTo(Duration.ofHours(4)) < 0
                    || followUp.compareTo(Duration.ofHours(1)) < 0
                    || crewed.compareTo(Duration.ofMinutes(15)) < 0
                    || unknown.compareTo(crewed) < 0
                    || horizon.compareTo(Duration.ofHours(24)) > 0
                    || pre.plus(post).compareTo(Duration.ofHours(24)) > 0
                    || maxAttempts < 1
                    || maxAttempts > 6
                    || ll2HourlyBudget < 1
                    || ll2HourlyBudget > 12)
                throw new IllegalArgumentException(
                        "Refresh policy exceeds bounded provider-use limits");
        }
    }

    public record Candidate(long observationId, CrewOperationalEvent event) {}

    public record FollowUp(
            long id,
            long evidenceId,
            Instant contextAt,
            Instant deadline,
            String state,
            int attempts) {}

    public record Decision(
            Target target,
            Reason reason,
            Duration interval,
            Long eventObservationId,
            Long evidenceId,
            Long followUpId,
            Instant eligibleAt) {
        public boolean due(Instant now) {
            return !now.isBefore(eligibleAt);
        }
    }

    private final Settings settings;

    public CrewRefreshPolicy(Settings settings) {
        this.settings = Objects.requireNonNull(settings);
    }

    public Settings settings() {
        return settings;
    }

    public Decision nasa(
            Instant now,
            Instant last,
            Instant startupGate,
            Instant retry,
            Instant catalogFetchedAt,
            List<Candidate> candidates) {
        Duration interval = settings.nasa();
        Reason reason = Reason.BASELINE_SCHEDULE;
        Long event = null;
        if (catalogFetchedAt != null
                && !catalogFetchedAt.isAfter(now)
                && !now.isAfter(catalogFetchedAt.plus(settings.catalogMaxAge()))) {
            for (var c :
                    candidates.stream()
                            .sorted(Comparator.comparingLong(Candidate::observationId))
                            .toList()) {
                var e = c.event();
                if (e.status() == CrewOperationalEvent.Status.CANCELLED
                        || !e.precise()
                        || e.scheduledAt() == null
                        || now.isBefore(e.scheduledAt().minus(settings.pre()))
                        || now.isAfter(e.scheduledAt().plus(settings.post()))) continue;
                Duration selected =
                        switch (e.relevance()) {
                            case CREWED -> settings.crewed();
                            case UNKNOWN -> settings.unknown();
                            case CARGO -> settings.nasa();
                        };
                if (selected.compareTo(interval) < 0) {
                    interval = selected;
                    event = c.observationId();
                    reason =
                            e.relevance() == CrewOperationalEvent.Relevance.CREWED
                                    ? Reason.UPCOMING_CREWED_EVENT
                                    : Reason.UNKNOWN_EVENT_WINDOW;
                }
            }
        }
        return decision(
                Target.NASA_VERIFICATION,
                reason,
                interval,
                event,
                null,
                null,
                last,
                startupGate,
                retry);
    }

    public Decision roster(
            Instant now,
            Instant last,
            Instant startupGate,
            Instant retry,
            List<FollowUp> followUps,
            Map<Long, CrewVerificationRepository.Evidence> evidence) {
        var selected =
                followUps.stream()
                        .filter(f -> evidence.containsKey(f.evidenceId()))
                        .filter(
                                f ->
                                        "OPEN".equals(f.state())
                                                && f.attempts() < settings.maxAttempts()
                                                && !now.isBefore(f.contextAt())
                                                && now.isBefore(f.deadline()))
                        .min(
                                Comparator.comparing(FollowUp::deadline)
                                        .thenComparingLong(FollowUp::id))
                        .orElse(null);
        if (selected == null)
            return decision(
                    Target.LL2_ROSTER,
                    Reason.BASELINE_SCHEDULE,
                    settings.roster(),
                    null,
                    null,
                    null,
                    last,
                    startupGate,
                    retry);
        var ev = evidence.get(selected.evidenceId());
        var reason =
                selected.attempts() > 0
                        ? Reason.STRUCTURED_SOURCE_LAG_FOLLOW_UP
                        : ev.value().type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                                ? Reason.NASA_COMPLETED_ARRIVAL
                                : Reason.NASA_COMPLETED_DEPARTURE;
        return decision(
                Target.LL2_ROSTER,
                reason,
                settings.followUp(),
                null,
                selected.evidenceId(),
                selected.id(),
                last,
                startupGate,
                retry);
    }

    public Decision catalog(Instant last, Instant gate, Instant retry) {
        return decision(
                Target.LL2_EVENT_CATALOG,
                Reason.BASELINE_CATALOG_REFRESH,
                settings.catalog(),
                null,
                null,
                null,
                last,
                gate,
                retry);
    }

    private static Decision decision(
            Target t,
            Reason r,
            Duration interval,
            Long event,
            Long evidence,
            Long follow,
            Instant last,
            Instant gate,
            Instant retry) {
        Instant eligible = last == null ? gate : max(last.plus(interval), gate);
        return new Decision(
                t,
                r,
                interval,
                event,
                evidence,
                follow,
                retry == null ? eligible : max(eligible, retry));
    }

    private static Instant max(Instant a, Instant b) {
        return a.isAfter(b) ? a : b;
    }

    public Optional<Instant> completedContext(
            CrewVerificationRepository.Evidence evidence, Instant now) {
        var e = evidence.value();
        if (e.station() != Station.ISS
                || e.assertion() != CrewVerificationEvidence.Assertion.COMPLETED
                || e.people().isEmpty()
                || (e.type() != CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                        && e.type() != CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION))
            return Optional.empty();
        var at =
                e.observation().sourceEventAt() == null
                        ? e.observation().sourcePublishedAt()
                        : e.observation().sourceEventAt();
        return at == null || at.isAfter(now) || !now.isBefore(at.plus(settings.horizon()))
                ? Optional.empty()
                : Optional.of(at);
    }

    /**
     * A later confirmed opposite assertion for every safely identified subject makes this transfer
     * obsolete.
     */
    public boolean superseded(
            CrewVerificationRepository.Evidence evidence,
            Instant context,
            CrewReconciliationSnapshot state,
            List<CrewIdentityResolution> resolutions) {
        if (evidence.value().people().isEmpty()) return false;
        var opposite =
                evidence.value().type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                        ? CrewReconciliationSnapshot.Presence.CONFIRMED_NOT_ABOARD
                        : CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD;
        for (int i = 0; i < evidence.value().people().size(); i++) {
            int index = i;
            var r =
                    resolutions.stream()
                            .filter(
                                    v ->
                                            v.evidenceId() == evidence.id()
                                                    && v.subjectIndex() == index)
                            .max(Comparator.comparingLong(CrewIdentityResolution::id))
                            .orElse(null);
            if (r == null
                    || r.personId() == null
                    || r.method() == CrewIdentityResolution.Method.UNRESOLVED
                    || r.method() == CrewIdentityResolution.Method.AMBIGUOUS) return false;
            var p =
                    state.people().stream()
                            .filter(v -> v.personId().equals(r.personId()))
                            .findFirst()
                            .orElse(null);
            if (p == null
                    || p.presence() != opposite
                    || p.assertionAsOf() == null
                    || !p.assertionAsOf().isAfter(context)) return false;
        }
        return true;
    }

    public boolean settled(
            CrewVerificationRepository.Evidence evidence,
            Instant context,
            CrewReconciliationSnapshot state,
            List<CrewIdentityResolution> resolutions) {
        if (List.of(
                        ReconciliationStatus.PRIMARY_UNAVAILABLE,
                        ReconciliationStatus.VERIFICATION_UNAVAILABLE,
                        ReconciliationStatus.STALE,
                        ReconciliationStatus.AMBIGUOUS)
                .contains(state.status())) return false;
        if (state.primaryFetchedAt() == null
                || state.primaryFetchedAt().isBefore(context)
                || !state.evidenceIds().contains(evidence.id())) return false;
        boolean arrival =
                evidence.value().type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION;
        var expected =
                arrival
                        ? CrewReconciliationSnapshot.Presence.CONFIRMED_ABOARD
                        : CrewReconciliationSnapshot.Presence.CONFIRMED_NOT_ABOARD;
        for (int i = 0; i < evidence.value().people().size(); i++) {
            int index = i;
            var resolution =
                    resolutions.stream()
                            .filter(
                                    r ->
                                            r.evidenceId() == evidence.id()
                                                    && r.subjectIndex() == index)
                            .max(Comparator.comparingLong(CrewIdentityResolution::id))
                            .orElse(null);
            if (resolution == null
                    || resolution.personId() == null
                    || resolution.method() == CrewIdentityResolution.Method.AMBIGUOUS
                    || resolution.method() == CrewIdentityResolution.Method.UNRESOLVED)
                return false;
            var person =
                    state.people().stream()
                            .filter(p -> p.personId().equals(resolution.personId()))
                            .findFirst()
                            .orElse(null);
            if (person == null
                    || person.presence() != expected
                    || person.ll2Assigned() != arrival
                    || !person.evidenceIds().contains(evidence.id())) return false;
        }
        return true;
    }
}
