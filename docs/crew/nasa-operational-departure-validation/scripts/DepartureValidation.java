import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.mission1.Mission1Application;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Explicit application command: retained reinterpretation or one normal live acquisition. */
public class DepartureValidation {
  public static void main(String[] args) throws Exception {
    var app = new SpringApplication(Mission1Application.class);
    app.setWebApplicationType(WebApplicationType.NONE);
    app.addInitializers(
        c -> c.getBeanFactory().addBeanPostProcessor(new ActiveMembershipValidation.SqlProbe()));
    try (var ctx =
        app.run(
            "--mission1.orbital.celestrak.refresh.enabled=false",
            "--mission1.crew.ingestion.enabled=false",
            "--mission1.crew.verification.enabled=false",
            "--mission1.crew.refresh.event-aware.enabled=false",
            "--mission1.crew.editorial.enabled=false",
            "--mission1.crew.automatic-shadow.enabled=false",
            "--mission1.crew.active-shadow.enabled=false",
            "--mission1.crew.identity.review-mode=OFF",
            "--mission1.crew.occurrences.backfill-mode=OFF")) {
      var json = ctx.getBean(ObjectMapper.class);
      var jdbc = ctx.getBean(JdbcTemplate.class);
      var repo = ctx.getBean(CrewVerificationRepository.class);
      var parser = ctx.getBean(NasaOperationalFeedParser.class);
      var store = ctx.getBean(ActiveMembershipStore.class);
      Map<String, Object> report = new TreeMap<>();
      report.put("beforeLatestSuccess", repo.latestSuccess());
      report.put("beforeLatestParseFailure", repo.latestParseFailure());
      report.put(
          "beforeSourceHealth",
          ctx.getBean(CrewQueryService.class).status(CrewSource.NASA_OFFICIAL, Station.ISS));
      ActiveMembershipValidation.SqlProbe.queries.clear();
      long start = System.nanoTime();
      boolean live = Arrays.asList(args).contains("--live");
      if (live)
        report.put("acquisition", ctx.getBean(NasaCrewVerificationIngestionService.class).ingest());
      else
        report.put(
            "reprocessing", new NasaOperationalReprocessingService(repo, parser).reprocess(32));
      report.put("operationMillis", (System.nanoTime() - start) / 1_000_000.0);
      report.put("operationSql", List.copyOf(ActiveMembershipValidation.SqlProbe.queries));
      report.put("networkCallsDuringRetainedReprocessing", 0);
      report.put("mode", live ? "ONE_NORMAL_LIVE_ACQUISITION" : "RETAINED_REINTERPRETATION");
      report.put("afterLatestSuccess", repo.latestSuccess());
      report.put("afterLatestParseFailure", repo.latestParseFailure());
      report.put(
          "afterSourceHealth",
          ctx.getBean(CrewQueryService.class).status(CrewSource.NASA_OFFICIAL, Station.ISS));
      Instant at = Instant.now();
      ActiveMembershipValidation.SqlProbe.queries.clear();
      var materialized = store.materialize(at);
      report.put("shadow", materialized);
      report.put("shadowSql", List.copyOf(ActiveMembershipValidation.SqlProbe.queries));
      report.put("shadowHealth", store.health(at));
      var again = store.materialize(at.plusMillis(1));
      if (again.inserted()) throw new IllegalStateException("Duplicate shadow revision");
      report.put("idempotentShadowRevision", again.revision());
      report.put(
          "departures",
          repo.evidenceAsOf(at).stream()
              .filter(
                  e -> e.value().type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION)
              .toList());
      report.put(
          "occurrences",
          jdbc.queryForList(
              """
              SELECT e.id evidence_id,e.document_id,e.evidence_hash,e.parser_version,e.source_event_at,e.source_published_at,
                  e.evidence_method,v.occurrence_key,s.subject_index,s.display_name,l.subject_key,o.paragraph_index,o.article_key
              FROM crew_verification_evidence e JOIN crew_assertion_version v ON v.evidence_id=e.id
              JOIN crew_evidence_subject s ON s.evidence_id=e.id JOIN crew_subject_version_link l
                ON l.evidence_id=s.evidence_id AND l.subject_index=s.subject_index
              JOIN crew_assertion_observation o ON o.evidence_id=e.id
              WHERE e.evidence_type='PERSON_DEPARTED_STATION' ORDER BY e.id,s.subject_index,o.document_id
              """));
      report.put(
          "sourceDocuments",
          jdbc.queryForList(
              "SELECT id,content_hash,retrieved_at,http_status,parser_name,parser_version,parsed"
                  + " FROM crew_source_document WHERE source_type='NASA_ISS_OPERATIONAL_FEED' ORDER"
                  + " BY id"));
      var retained = repo.retainedOperationalDocuments(32);
      if (!retained.isEmpty()) {
        var sample =
            retained.stream()
                .filter(
                    d ->
                        d.source()
                            .observation()
                            .contentHash()
                            .equals(
                                "312a35ef56856f9081731b0fb505eff999291d134ee1100778951424a712f54c"))
                .findFirst()
                .orElse(retained.getFirst());
        var times = new ArrayList<Double>();
        for (int i = 0; i < 20; i++) {
          long n = System.nanoTime();
          parser.verify(sample.source());
          times.add((System.nanoTime() - n) / 1_000_000.0);
        }
        report.put("feedParseMillis", times);
        var parsedSample = parser.verify(sample.source());
        var departure =
            (parsedSample.value() == null
                    ? List.<CrewVerificationEvidence>of()
                    : parsedSample.value())
                .stream()
                    .filter(e -> e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION)
                    .findFirst();
        if (departure.isPresent()) {
          times = new ArrayList<>();
          var e = departure.get();
          for (int i = 0; i < 20; i++) {
            long n = System.nanoTime();
            new NasaOperationalPostParser()
                .parse(
                    "Crew undocks from station",
                    "<p>" + e.supportingExcerpt() + "</p>",
                    e.observation());
            times.add((System.nanoTime() - n) / 1_000_000.0);
          }
          report.put("singleItemParseMillis", times);
        }
      }
      Files.writeString(
          Path.of(args[0]),
          json.writerWithDefaultPrettyPrinter().writeValueAsString(report) + "\n");
      System.out.println(
          "DEPARTURE_VALIDATION revision="
              + materialized.revision()
              + " counts="
              + materialized.result().counts());
    }
  }
}
