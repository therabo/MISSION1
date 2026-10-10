import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.mission1.Mission1Application;
import org.mission1.crew.automatic.*;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.*;

/** Explicit shadow-only local acceptance runner. Does not acquire or promote source identities. */
public class AutomaticShadowValidation {
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
            "--mission1.crew.identity.review-mode=OFF",
            "--mission1.crew.occurrences.backfill-mode=OFF")) {
      var worker = context.getBean(AutomaticIdentityWorker.class);
      var store = context.getBean(AutomaticIdentityStore.class);
      var before = store.report();
      store.requestImport(Instant.now());
      long start = System.nanoTime();
      var run = worker.run(256);
      double millis = (System.nanoTime() - start) / 1e6;
      var model = FrozenIdentityModel.load(context.getBean(ObjectMapper.class));
      var inputs = store.inputs();
      List<Map<String, Object>> timings = new ArrayList<>();
      for (var input : inputs)
        if (input.evidence().provider() == IdentityEvidence.Provider.NASA) {
          SqlProbe.queries.clear();
          long began = System.nanoTime();
          var evaluation =
              store.evaluate(
                  input.evidence().key(),
                  model,
                  FrozenIdentityModel.VERSION,
                  IdentityPolicy.VERSION,
                  Instant.now());
          long selects =
              SqlProbe.queries.stream()
                  .filter(q -> q.stripLeading().toUpperCase(Locale.ROOT).startsWith("SELECT"))
                  .count();
          timings.add(
              Map.of(
                  "source",
                  input.evidence().key(),
                  "name",
                  input.evidence().name(),
                  "millis",
                  (System.nanoTime() - began) / 1e6,
                  "selectQueries",
                  selects,
                  "totalStatements",
                  SqlProbe.queries.size(),
                  "candidates",
                  evaluation.candidateCount()));
        }
      var report = new TreeMap<String, Object>();
      report.put("run", run);
      report.put("before", before);
      report.put("decisions", store.report());
      report.put("inputs", store.inputs());
      report.put("health", worker.health());
      report.put(
          "comparison", context.getBean(ProductionShadowComparison.class).read(Instant.now()));
      report.put("wallMillis", millis);
      report.put("timings", timings);
      report.put(
          "importSelectQueries",
          context.getBean(RetainedIdentityEvidence.class).load(Instant.now()).queries());
      report.put("resolverNetworkCalls", 0);
      report.put("productionMode", "SHADOW");
      Files.writeString(
          Path.of(args[0]),
          context
                  .getBean(ObjectMapper.class)
                  .writerWithDefaultPrettyPrinter()
                  .writeValueAsString(report)
              + "\n");
      System.out.println("AUTOMATIC_SHADOW " + run + " millis=" + millis);
      if (run.failed() > 0) throw new IllegalStateException("Shadow jobs failed");
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
