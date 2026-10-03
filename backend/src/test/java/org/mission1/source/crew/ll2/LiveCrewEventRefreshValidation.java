package org.mission1.source.crew.ll2;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;

import java.nio.file.Path;
import java.time.*;
import java.util.*;

/** Opt-in live source/persistence probe; never discovered as a default test. */
public final class LiveCrewEventRefreshValidation {
    public static void main(String[] args) throws Exception {
        if (!"1".equals(System.getenv("MISSION1_CREW_EVENT_LIVE_VALIDATION")) || args.length != 1)
            throw new IllegalArgumentException(
                    "Explicit live-validation flag and report path required");
        var application =
                new org.springframework.boot.SpringApplication(
                        org.mission1.Mission1Application.class);
        application.setWebApplicationType(org.springframework.boot.WebApplicationType.NONE);
        try (var context =
                application.run(
                        "--mission1.crew.refresh.event-aware.enabled=false",
                        "--mission1.crew.ingestion.enabled=false",
                        "--mission1.crew.verification.enabled=false",
                        "--mission1.orbital.celestrak.refresh.enabled=false")) {
            var clock = context.getBean(Clock.class);
            var now = clock.instant();
            var refresh = context.getBean(CrewRefreshRepository.class);
            var source = context.getBean(CrewEventSource.class);
            if (refresh.ll2EligibleAt(now, 12).isAfter(now))
                throw new IllegalStateException("LL2 cooldown/quota prevents live probe");
            var d =
                    new CrewRefreshPolicy.Decision(
                            CrewRefreshPolicy.Target.LL2_EVENT_CATALOG,
                            CrewRefreshPolicy.Reason.MANUAL_OR_TEST,
                            Duration.ofHours(6),
                            null,
                            null,
                            null,
                            now);
            long trigger = refresh.trigger("EXPLICIT_LIVE_VALIDATION:" + now, d, now);
            var request = source.request(now);
            long run = refresh.startCatalog(request, now, trigger);
            var result = source.fetch(request);
            Instant retry =
                    result.state() == CrewSourceState.RATE_LIMITED
                            ? new CrewIngestionPolicy(Duration.ofHours(2), Duration.ofMinutes(5))
                                    .retryAfter(result.failure().retryAfter(), now)
                            : null;
            if (result.state() == CrewSourceState.RATE_LIMITED && retry == null)
                retry = now.plusSeconds(7200);
            refresh.completeCatalog(run, result, clock.instant(), retry);
            var report = new LinkedHashMap<String, Object>();
            report.put("validationUtc", now);
            report.put("request", request);
            report.put("eventCatalogRunId", run);
            report.put("triggerId", trigger);
            report.put("eventSourceState", result.state());
            report.put("httpStatus", result.httpStatus());
            report.put("observation", result.observation());
            report.put("persistedCatalog", refresh.latestCatalog());
            var roster =
                    context.getBean(CrewIngestionService.class)
                            .ingestTriggered(
                                    manual(
                                            refresh,
                                            CrewRefreshPolicy.Target.LL2_ROSTER,
                                            clock.instant()));
            report.put("rosterResult", roster);
            var runs = context.getBean(CrewRepository.class);
            report.put("rosterSyncRun", runs.findRun(roster.runId()));
            var nasa = context.getBean(NasaCrewVerificationIngestionService.class);
            var verificationRuns = new ArrayList<Object>();
            var first =
                    nasa.ingestTriggered(
                            manual(
                                    refresh,
                                    CrewRefreshPolicy.Target.NASA_VERIFICATION,
                                    clock.instant()));
            var firstRun = runs.findRun(first.runId()).orElseThrow();
            verificationRuns.add(firstRun);
            if (first.outcome() == CrewSyncRun.Outcome.SUCCESS
                    && Integer.valueOf(200).equals(firstRun.httpStatus()))
                verificationRuns.add(
                        runs.findRun(
                                        nasa.ingestTriggered(
                                                        manual(
                                                                refresh,
                                                                CrewRefreshPolicy.Target
                                                                        .NASA_VERIFICATION,
                                                                clock.instant()))
                                                .runId())
                                .orElseThrow());
            report.put("nasaSyncRuns", verificationRuns);
            report.put(
                    "reconciliation", context.getBean(CrewReconciliationService.class).reconcile());
            report.put(
                    "requestBudget",
                    "One event catalog GET; one roster GET; one NASA conditional GET (second only"
                        + " after 200, to verify 304). No retries or enrichment.");
            JsonMapper.builder()
                    .addModule(new JavaTimeModule())
                    .addModule(new com.fasterxml.jackson.datatype.jdk8.Jdk8Module())
                    .disable(
                            com.fasterxml.jackson.databind.SerializationFeature
                                    .WRITE_DATES_AS_TIMESTAMPS)
                    .build()
                    .writerWithDefaultPrettyPrinter()
                    .writeValue(Path.of(args[0]).toFile(), report);
            System.out.println(
                    "Bounded live probe: events="
                            + result.state()
                            + ", roster="
                            + roster.outcome()
                            + ", NASA="
                            + first.outcome());
            if (result.state() != CrewSourceState.AVAILABLE
                    || roster.outcome() != CrewSyncRun.Outcome.SUCCESS
                    || first.outcome() != CrewSyncRun.Outcome.SUCCESS)
                throw new IllegalStateException("Inspect persisted source failures and report");
        }
    }

    private static long manual(
            CrewRefreshRepository repository, CrewRefreshPolicy.Target target, Instant now) {
        return repository.trigger(
                "EXPLICIT_LIVE_VALIDATION:" + target + ":" + now,
                new CrewRefreshPolicy.Decision(
                        target,
                        CrewRefreshPolicy.Reason.MANUAL_OR_TEST,
                        Duration.ofHours(2),
                        null,
                        null,
                        null,
                        now),
                now);
    }
}
