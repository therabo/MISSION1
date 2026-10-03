package org.mission1.source.crew.ll2;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.mission1.crew.domain.Station;
import org.mission1.crew.domain.CrewSourceState;
import org.mission1.source.crew.CrewHttpReader;

/** Explicit manual probe, never a JUnit test. Exactly one request; no profile enrichment or retry. */
public final class LiveCrewValidation {
    public static void main(String[] args) throws Exception {
        if (!"1".equals(System.getenv("MISSION1_CREW_LIVE_VALIDATION")) || (args.length != 1 && args.length != 2))
            throw new IllegalArgumentException("Set MISSION1_CREW_LIVE_VALIDATION=1 and supply an external report path [--persist]");
        if (args.length == 2) {
            if (!"--persist".equals(args[1])) throw new IllegalArgumentException("Unknown live probe option");
            persistOnce(Path.of(args[0]));
            return;
        }
        var source = new LaunchLibrary2CrewSource(new CrewHttpReader(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8)).followRedirects(HttpClient.Redirect.NEVER).build(),
                Clock.systemUTC(), Duration.ofSeconds(20)), URI.create("https://ll.thespacedevs.com/2.3.0/"), 4);
        var result = source.fetchCurrentExpedition(Station.ISS);
        JsonMapper.builder().addModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build().writerWithDefaultPrettyPrinter()
                .writeValue(Path.of(args[0]).toFile(), result);
        System.out.println("One LL2 request: " + result.state() + "; report " + args[0]);
        if (result.state() != CrewSourceState.AVAILABLE) System.exit(1);
    }

    /** One authorized request through the actual application service and PostgreSQL adapter. */
    private static void persistOnce(Path report) throws Exception {
        var application = new org.springframework.boot.SpringApplication(org.mission1.Mission1Application.class);
        application.setWebApplicationType(org.springframework.boot.WebApplicationType.NONE);
        try (var context = application.run("--mission1.crew.ingestion.enabled=false",
                "--mission1.orbital.celestrak.refresh.enabled=false")) {
            var service = context.getBean(org.mission1.crew.application.CrewIngestionService.class);
            var repository = context.getBean(org.mission1.crew.application.CrewRepository.class);
            long start = System.nanoTime();
            var result = service.ingest();
            double elapsedMs = (System.nanoTime() - start) / 1_000_000.0;
            var run = repository.findRun(result.runId()).orElseThrow();
            var output = new java.util.LinkedHashMap<String, Object>();
            output.put("validationUtc", java.time.Instant.now()); output.put("result", result);
            output.put("syncRun", run); output.put("ingestionDurationMs", elapsedMs);
            output.put("requestBudget", "One expedition request, zero retries, zero astronaut enrichment requests");
            if (result.snapshotId() != null) output.put("snapshot", repository.findSnapshot(result.snapshotId()).orElseThrow());
            var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
            var counts = new java.util.LinkedHashMap<String, Integer>();
            for (String table : java.util.List.of("crew_source_sync_run", "crew_source_snapshot", "crew_person",
                    "crew_person_external_id", "crew_expedition", "crew_expedition_external_id",
                    "crew_person_observation", "crew_expedition_observation", "crew_assignment_observation"))
                counts.put(table, jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class));
            output.put("rowCounts", counts);
            JsonMapper.builder().addModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                    .build().writerWithDefaultPrettyPrinter().writeValue(report.toFile(), output);
            System.out.println("One LL2 ingestion: " + result.outcome() + "; report " + report);
            if (result.outcome() != org.mission1.crew.application.CrewSyncRun.Outcome.SUCCESS)
                throw new IllegalStateException("Live source did not yield a persisted snapshot; inspect the recorded run");
        }
    }
}
