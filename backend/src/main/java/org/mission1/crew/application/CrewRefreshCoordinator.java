package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Single bounded source operation per tick. Network calls stay inside their accepted ingestion
 * paths.
 */
public final class CrewRefreshCoordinator {
    private final CrewRefreshPolicy policy;
    private final CrewRefreshRepository refresh;
    private final CrewRepository runs;
    private final CrewVerificationRepository verification;
    private final CrewReconciliationQueryService query;
    private final CrewReconciliationService reconciliation;
    private final CrewIngestionService roster;
    private final NasaCrewVerificationIngestionService nasa;
    private final CrewEventSource events;
    private final Clock clock;
    private final boolean rosterEnabled, nasaEnabled, catalogEnabled;
    private final Instant rosterGate, nasaGate, catalogGate;
    private final AtomicBoolean running = new AtomicBoolean();

    public CrewRefreshCoordinator(
            CrewRefreshPolicy policy,
            CrewRefreshRepository refresh,
            CrewRepository runs,
            CrewVerificationRepository verification,
            CrewReconciliationQueryService query,
            CrewReconciliationService reconciliation,
            CrewIngestionService roster,
            NasaCrewVerificationIngestionService nasa,
            CrewEventSource events,
            Clock clock,
            boolean rosterEnabled,
            boolean nasaEnabled,
            boolean catalogEnabled,
            Duration rosterInitial,
            Duration nasaInitial,
            Duration catalogInitial) {
        this.policy = policy;
        this.refresh = refresh;
        this.runs = runs;
        this.verification = verification;
        this.query = query;
        this.reconciliation = reconciliation;
        this.roster = roster;
        this.nasa = nasa;
        this.events = events;
        this.clock = clock;
        this.rosterEnabled = rosterEnabled;
        this.nasaEnabled = nasaEnabled;
        this.catalogEnabled = catalogEnabled;
        if (rosterInitial.compareTo(Duration.ofMinutes(1)) < 0
                || nasaInitial.compareTo(Duration.ofMinutes(6)) < 0
                || catalogInitial.compareTo(Duration.ofMinutes(11)) < 0)
            throw new IllegalArgumentException("Staggered startup gates required");
        Instant at = clock.instant();
        rosterGate = at.plus(rosterInitial);
        nasaGate = at.plus(nasaInitial);
        catalogGate = at.plus(catalogInitial);
    }

    public boolean tick() {
        if (!running.compareAndSet(false, true)) return false;
        try {
            return refresh.withCoordinatorLock(this::lockedTick);
        } finally {
            running.set(false);
        }
    }

    private void lockedTick() {
        Instant now = clock.instant();
        var evidence = new LinkedHashMap<Long, CrewVerificationRepository.Evidence>();
        for (var e : verification.evidenceAsOf(now)) evidence.put(e.id(), e);
        updateFollowUps(now, evidence);
        Instant ll2Retry = refresh.ll2EligibleAt(now, policy.settings().ll2HourlyBudget());
        List<CrewRefreshPolicy.Decision> decisions = new ArrayList<>();
        if (rosterEnabled)
            decisions.add(
                    policy.roster(
                            now,
                            last(CrewSource.LAUNCH_LIBRARY_2),
                            rosterGate,
                            ll2Retry,
                            refresh.followUps(),
                            evidence));
        var catalog = refresh.latestCatalog().orElse(null);
        if (nasaEnabled)
            decisions.add(
                    policy.nasa(
                            now,
                            last(CrewSource.NASA_OFFICIAL),
                            nasaGate,
                            runs.retryAfterAt(CrewSource.NASA_OFFICIAL, Station.ISS).orElse(null),
                            catalog != null && "SUCCESS".equals(catalog.result())
                                    ? catalog.retrievedAt()
                                    : null,
                            catalog == null ? List.of() : catalog.candidates()));
        if (catalogEnabled)
            decisions.add(
                    policy.catalog(
                            refresh.lastCatalogAttempt().orElse(null), catalogGate, ll2Retry));
        // Persist accelerated intent even while startup/cooldown delays its actual source call.
        for (var pending : decisions) {
            if (pending.reason() != CrewRefreshPolicy.Reason.BASELINE_SCHEDULE
                    && pending.reason() != CrewRefreshPolicy.Reason.BASELINE_CATALOG_REFRESH)
                trigger(pending, now);
        }
        var decision =
                decisions.stream()
                        .filter(d -> d.due(now))
                        .min(
                                Comparator.comparing(CrewRefreshPolicy.Decision::eligibleAt)
                                        .thenComparing(d -> d.target().ordinal()))
                        .orElse(null);
        if (decision == null) return;
        long trigger = trigger(decision, now);
        if (decision.target() == CrewRefreshPolicy.Target.LL2_EVENT_CATALOG) {
            var request = events.request(now);
            long run = refresh.startCatalog(request, now, trigger);
            final CrewSourceResult<CrewEventSource.Catalog> fetched;
            try {
                fetched = events.fetch(request);
            } catch (RuntimeException e) {
                refresh.failCatalog(run, clock.instant(), "SOURCE_EXCEPTION", null, null);
                return;
            }
            Instant retry = null;
            if (fetched.state() == CrewSourceState.RATE_LIMITED) {
                retry =
                        new CrewIngestionPolicy(policy.settings().roster(), Duration.ofMinutes(5))
                                .retryAfter(
                                        fetched.failure().retryAfter(),
                                        fetched.observation() == null
                                                ? now
                                                : fetched.observation().retrievedAt());
                if (retry == null) retry = now.plus(policy.settings().roster());
            }
            try {
                refresh.completeCatalog(run, fetched, clock.instant(), retry);
            } catch (RuntimeException e) {
                refresh.failCatalog(run, clock.instant(), "PERSISTENCE_FAILURE", fetched, retry);
            }
            return;
        }
        var outcome =
                decision.target() == CrewRefreshPolicy.Target.LL2_ROSTER
                        ? roster.ingestWhenDue(decision.interval(), trigger).outcome()
                        : nasa.ingestWhenDue(decision.interval(), trigger).outcome();
        if (!outcome.name().startsWith("SKIPPED")) {
            reconciliation.reconcile();
            evidence.clear();
            for (var e : verification.evidenceAsOf(clock.instant())) evidence.put(e.id(), e);
            updateFollowUps(clock.instant(), evidence);
        }
    }

    private long trigger(CrewRefreshPolicy.Decision decision, Instant now) {
        var catalog = refresh.latestCatalog().orElse(null);
        String generation =
                decision.target() == CrewRefreshPolicy.Target.LL2_EVENT_CATALOG
                        ? String.valueOf(catalog == null ? null : catalog.id())
                        : String.valueOf(
                                runs.latestRun(
                                                decision.target()
                                                                == CrewRefreshPolicy.Target
                                                                        .LL2_ROSTER
                                                        ? CrewSource.LAUNCH_LIBRARY_2
                                                        : CrewSource.NASA_OFFICIAL,
                                                Station.ISS)
                                        .map(CrewSyncRun::id)
                                        .orElse(null));
        String key =
                decision.target()
                        + ":"
                        + decision.reason()
                        + ":"
                        + decision.eventObservationId()
                        + ":"
                        + decision.followUpId()
                        + ":"
                        + generation;
        return refresh.trigger(key, decision, now);
    }

    private Instant last(CrewSource source) {
        return runs.lastFetchAttemptAt(source, Station.ISS).orElse(null);
    }

    private void updateFollowUps(
            Instant now, Map<Long, CrewVerificationRepository.Evidence> evidence) {
        for (var e : evidence.values())
            policy.completedContext(e, now)
                    .ifPresent(
                            context ->
                                    refresh.openFollowUp(
                                            e.id(),
                                            context,
                                            context.plus(policy.settings().horizon()),
                                            now));
        var open = refresh.followUps().stream().filter(f -> "OPEN".equals(f.state())).toList();
        if (open.isEmpty()) return;
        var current = query.current();
        var identities = verification.resolutionsAsOf(now);
        for (var f : open) {
            var e = evidence.get(f.evidenceId());
            String terminal =
                    e != null
                                    && policy.superseded(
                                            e, f.contextAt(), current.interpretation(), identities)
                            ? "SUPERSEDED"
                            : e != null
                                            && policy.settled(
                                                    e,
                                                    f.contextAt(),
                                                    current.interpretation(),
                                                    current.identityResolutions())
                                    ? "SETTLED"
                                    : !now.isBefore(f.deadline())
                                            ? "EXPIRED"
                                            : f.attempts() >= policy.settings().maxAttempts()
                                                    ? "ATTEMPTS_EXHAUSTED"
                                                    : null;
            if (terminal != null) refresh.closeFollowUp(f.id(), terminal, now);
        }
    }
}
