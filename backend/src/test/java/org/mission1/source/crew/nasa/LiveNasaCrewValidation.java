package org.mission1.source.crew.nasa;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;

/** Explicit two-request validation, never a JUnit test or runtime fallback. */
public final class LiveNasaCrewValidation {
    public static void main(String[] args) throws Exception {
        if (!"1".equals(System.getenv("MISSION1_NASA_CREW_LIVE_VALIDATION"))
                || (args.length != 1 && (args.length != 2 || !"--report-only".equals(args[1]))))
            throw new IllegalArgumentException(
                    "Set MISSION1_NASA_CREW_LIVE_VALIDATION=1 and supply an external report path");
        var app = new SpringApplication(org.mission1.Mission1Application.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        try (var context =
                app.run(
                        "--mission1.crew.ingestion.enabled=false",
                        "--mission1.crew.verification.enabled=false",
                        "--mission1.orbital.celestrak.refresh.enabled=false")) {
            var ingestion = context.getBean(NasaCrewVerificationIngestionService.class);
            var verification = context.getBean(CrewVerificationRepository.class);
            var reconciliation = context.getBean(CrewReconciliationService.class);
            var query = context.getBean(CrewReconciliationQueryService.class);
            var runs = context.getBean(CrewRepository.class);
            var jdbc = context.getBean(JdbcTemplate.class);
            var report = new LinkedHashMap<String, Object>();
            report.put("validationStartedUtc", Instant.now());
            if (args.length == 2) {
                report.put("mode", "READ_ONLY_RECOVERY_ZERO_REQUESTS");
                report.put(
                        "recordedSyncRuns",
                        jdbc.queryForList(
                                "SELECT"
                                    + " id,started_at,completed_at,http_status,verification_document_id,content_hash,http_etag,http_last_modified"
                                    + " FROM crew_source_sync_run WHERE source='NASA_OFFICIAL'"
                                    + " ORDER BY id"));
                report.put(
                        "recordedReconciliationRuns",
                        jdbc.queryForList("SELECT * FROM crew_reconciliation_run ORDER BY id"));
                var success = verification.latestSuccess().orElseThrow();
                var saved = verification.document(success.documentId()).orElseThrow();
                report.put("documentId", success.documentId());
                report.put("documentObservation", saved.observation());
                report.put("bodyBytes", saved.body().length);
                long parseStart = System.nanoTime();
                report.put(
                        "parsedEvidence",
                        context.getBean(NasaOperationalFeedParser.class).verify(saved).value());
                report.put("offlineParserDurationMs", millis(parseStart));
                long queryStart = System.nanoTime();
                report.put("currentAfterConditional", query.current());
                report.put("currentQueryDurationMs", millis(queryStart));
                report.put(
                        "identityResolutionCounts",
                        jdbc.queryForList(
                                "SELECT method,count(*) AS subjects FROM crew_identity_resolution"
                                    + " GROUP BY method ORDER BY method"));
                var counts = new LinkedHashMap<String, Integer>();
                for (String table :
                        List.of(
                                "crew_source_sync_run",
                                "crew_source_snapshot",
                                "crew_person",
                                "crew_person_external_id",
                                "crew_document_body",
                                "crew_source_document",
                                "crew_verification_evidence",
                                "crew_evidence_subject",
                                "crew_identity_resolution",
                                "crew_reconciliation_run",
                                "crew_reconciliation_snapshot"))
                    counts.put(
                            table,
                            jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class));
                report.put("rowCounts", counts);
                report.put("validationCompletedUtc", Instant.now());
                report.put(
                        "requestBudget",
                        "Two previously completed official RSS GETs; this recovery makes zero"
                            + " external requests or writes");
                JsonMapper.builder()
                        .addModule(new JavaTimeModule())
                        .addModule(new Jdk8Module())
                        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                        .build()
                        .writerWithDefaultPrettyPrinter()
                        .writeValue(Path.of(args[0]).toFile(), report);
                return;
            }
            long start = System.nanoTime();
            var first = ingestion.ingest();
            report.put("firstIngestionDurationMs", millis(start));
            report.put("firstIngestion", first);
            report.put("firstRun", runs.findRun(first.runId()));
            if (first.outcome() != CrewSyncRun.Outcome.SUCCESS)
                throw new IllegalStateException(
                        "NASA verification failed; inspect persisted run " + first.runId());
            var doc = verification.document(first.documentId()).orElseThrow();
            report.put("documentObservation", doc.observation());
            report.put("bodyBytes", doc.body().length);
            start = System.nanoTime();
            var parsed = context.getBean(NasaOperationalFeedParser.class).verify(doc);
            report.put("parserDurationMs", millis(start));
            report.put("parsedEvidence", parsed.value());
            start = System.nanoTime();
            var derived = reconciliation.reconcile();
            report.put("reconciliationDurationMs", millis(start));
            report.put("firstReconciliation", derived);
            report.put("currentAfterFirstFetch", query.current());
            report.put(
                    "identityResolutionCounts",
                    jdbc.queryForList(
                            "SELECT method,count(*) AS subjects FROM crew_identity_resolution GROUP"
                                    + " BY method ORDER BY method"));
            var second = ingestion.ingest();
            report.put("conditionalIngestion", second);
            report.put("conditionalRun", runs.findRun(second.runId()));
            report.put("secondReconciliation", reconciliation.reconcile());
            report.put("currentAfterConditional", query.current());
            var counts = new LinkedHashMap<String, Integer>();
            for (String table :
                    List.of(
                            "crew_source_sync_run",
                            "crew_source_snapshot",
                            "crew_person",
                            "crew_person_external_id",
                            "crew_document_body",
                            "crew_source_document",
                            "crew_verification_evidence",
                            "crew_evidence_subject",
                            "crew_identity_resolution",
                            "crew_reconciliation_run",
                            "crew_reconciliation_snapshot"))
                counts.put(
                        table, jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class));
            report.put("rowCounts", counts);
            report.put("validationCompletedUtc", Instant.now());
            report.put(
                    "requestBudget",
                    "Two official RSS GETs, second conditional; zero article/profile/LL2 requests,"
                            + " zero retries");
            JsonMapper.builder()
                    .addModule(new JavaTimeModule())
                    .addModule(new Jdk8Module())
                    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                    .build()
                    .writerWithDefaultPrettyPrinter()
                    .writeValue(Path.of(args[0]).toFile(), report);
            if (second.outcome() != CrewSyncRun.Outcome.SUCCESS)
                throw new IllegalStateException("Conditional verification failed; see report");
            System.out.println("Two NASA verification requests; report " + args[0]);
        }
    }

    private static double millis(long start) {
        return (System.nanoTime() - start) / 1_000_000.0;
    }
}
