import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.mission1.Mission1Application;
import org.mission1.crew.application.*;
import org.mission1.source.crew.nasa.NasaEditorialSource;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** Explicit local writer smoke. No production endpoint or startup runner is registered. */
public class EditorialLiveValidation {
  public static void main(String[] args) throws Exception {
    if (args.length < 1 || args.length > 2)
      throw new IllegalArgumentException("Absolute output path required; optional --read-only");
    boolean readOnly = args.length == 2 && args[1].equals("--read-only");
    var application = new SpringApplication(Mission1Application.class);
    application.setWebApplicationType(WebApplicationType.NONE);
    try (var context =
        application.run(
            "--mission1.orbital.celestrak.refresh.enabled=false",
            "--mission1.crew.ingestion.enabled=false",
            "--mission1.crew.verification.enabled=false",
            "--mission1.crew.refresh.event-aware.enabled=false",
            "--mission1.crew.editorial.enabled=false",
            "--mission1.crew.identity.review-mode=OFF",
            "--mission1.crew.occurrences.backfill-mode=OFF")) {
      var source = context.getBean(NasaEditorialSource.class);
      var first = readOnly ? null : source.acquire();
      var second = readOnly ? null : source.acquire();
      var repository = context.getBean(CrewEditorialRepository.class);
      var report = new LinkedHashMap<String, Object>();
      report.put("first", first);
      report.put("second", second);
      report.put("roster", repository.latestRoster(java.time.Instant.now()));
      report.put("health", context.getBean(CrewEditorialHealthService.class).read());
      report.put("shadow", context.getBean(CrewEditorialShadowService.class).compare());
      report.put(
          "captures",
          context
              .getBean(JdbcTemplate.class)
              .queryForList(
                  """
                  SELECT a.id,a.stream,a.requested_url,a.final_url,a.redirects,a.started_at,a.completed_at,a.http_status,
                  a.outcome,a.reason,a.resource_metadata,d.content_hash,a.roster_id
                  FROM crew_editorial_acquisition a LEFT JOIN crew_source_document d ON d.id=a.document_id ORDER BY a.id
                  """));
      var path = Path.of(args[0]);
      Files.createDirectories(path.getParent());
      Files.writeString(
          path,
          context
                  .getBean(ObjectMapper.class)
                  .writerWithDefaultPrettyPrinter()
                  .writeValueAsString(report)
              + "\n");
      System.out.println("EDITORIAL_LIVE_FIRST=" + first + " SECOND=" + second);
    }
  }
}
