import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.mission1.Mission1Application;
import org.mission1.crew.membership.*;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.*;

/** Explicit retained-state acceptance runner. No scoring, source acquisition or V7 mutation. */
public class ActiveMembershipValidation {
  public static void main(String[] args) throws Exception {
    var application = new SpringApplication(Mission1Application.class);
    application.setWebApplicationType(WebApplicationType.NONE);
    application.addInitializers(c -> c.getBeanFactory().addBeanPostProcessor(new SqlProbe()));
    try (var context =
        application.run(
            "--mission1.orbital.celestrak.refresh.enabled=false",
            "--mission1.crew.ingestion.enabled=false",
            "--mission1.crew.verification.enabled=false",
            "--mission1.crew.refresh.event-aware.enabled=false",
            "--mission1.crew.editorial.enabled=false",
            "--mission1.crew.automatic-shadow.enabled=false",
            "--mission1.crew.active-shadow.enabled=false",
            "--mission1.crew.identity.review-mode=OFF",
            "--mission1.crew.occurrences.backfill-mode=OFF")) {
      var store = context.getBean(ActiveMembershipStore.class);
      var json = context.getBean(ObjectMapper.class);
      Instant at = Instant.now();
      SqlProbe.queries.clear();
      var run = store.materialize(at);
      var firstQueries = List.copyOf(SqlProbe.queries);
      var times = new ArrayList<Double>();
      var selects = new ArrayList<Long>();
      for (int i = 0; i < 10; i++) {
        SqlProbe.queries.clear();
        var again = store.materialize(at.plusMillis(i + 1));
        if (again.inserted())
          throw new IllegalStateException("Unchanged cut created a duplicate revision");
        times.add(again.millis());
        selects.add(
            SqlProbe.queries.stream()
                .filter(s -> s.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT"))
                .count());
      }
      var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
      var work =
          jdbc.queryForMap(
              "SELECT notified_at,last_success_at FROM crew_active_projection_work WHERE"
                  + " singleton");
      var notified = ((Timestamp) work.get("notified_at")).toInstant();
      Map<String, Object> result = new TreeMap<>();
      result.put("evaluationTime", at);
      result.put("materialized", run);
      result.put("latest", store.latest().orElseThrow());
      result.put("legacyComparison", context.getBean(LegacyMembershipComparison.class).read());
      result.put("health", store.health(at));
      result.put("materializationMillis", run.millis());
      result.put("repeatMillis", times);
      result.put("repeatSelectQueries", selects);
      result.put(
          "initialSelectQueries",
          firstQueries.stream()
              .filter(s -> s.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT"))
              .count());
      result.put("initialSqlStatements", firstQueries.size());
      result.put("sourceNetworkCalls", 0);
      result.put("identityEvaluations", 0);
      result.put(
          "notificationToEvaluationMillis", Math.max(0, Duration.between(notified, at).toMillis()));
      result.put(
          "supports", run.result().members().stream().mapToInt(m -> m.supports().size()).sum());
      result.put(
          "acceptedCompletedDepartureEvidence",
          jdbc.queryForObject(
              "SELECT count(*) FROM crew_verification_evidence WHERE"
                  + " evidence_type='PERSON_DEPARTED_STATION' AND assertion='COMPLETED'",
              Long.class));
      Files.writeString(
          Path.of(args[0]),
          json.writerWithDefaultPrettyPrinter().writeValueAsString(result) + "\n");
      System.out.println(
          "ACTIVE_SHADOW revision="
              + run.revision()
              + " counts="
              + run.result().counts()
              + " millis="
              + run.millis());
    }
  }

  static final class SqlProbe implements BeanPostProcessor {
    static final List<String> queries = new ArrayList<>();

    @Override
    public Object postProcessAfterInitialization(Object bean, String name) {
      if (!(bean instanceof DataSource source)) return bean;
      return Proxy.newProxyInstance(
          DataSource.class.getClassLoader(),
          new Class<?>[] {DataSource.class},
          (p, m, a) -> {
            Object result = invoke(m, source, a);
            if (!(result instanceof Connection connection) || !m.getName().equals("getConnection"))
              return result;
            return Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (cp, cm, ca) -> {
                  if (cm.getName().equals("prepareStatement")) queries.add((String) ca[0]);
                  Object called = invoke(cm, connection, ca);
                  if (called instanceof Statement statement
                      && cm.getName().equals("createStatement"))
                    return Proxy.newProxyInstance(
                        Statement.class.getClassLoader(),
                        new Class<?>[] {Statement.class},
                        (sp, sm, sa) -> {
                          if (sm.getName().startsWith("execute")
                              && sa != null
                              && sa.length > 0
                              && sa[0] instanceof String q) queries.add(q);
                          return invoke(sm, statement, sa);
                        });
                  return called;
                });
          });
    }

    static Object invoke(Method m, Object target, Object[] args) throws Throwable {
      try {
        return m.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }
  }
}
