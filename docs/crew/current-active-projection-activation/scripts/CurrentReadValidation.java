import com.fasterxml.jackson.databind.ObjectMapper;

import org.mission1.Mission1Application;
import org.mission1.api.crew.CrewRestQueryService;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.*;

import java.lang.reflect.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

import javax.sql.DataSource;

/** Read-only actual retained-state benchmark; modes are selected by deliberate startup config. */
public class CurrentReadValidation {
    public static void main(String[] args) throws Exception {
        var application = new SpringApplication(Mission1Application.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.addInitializers(c -> c.getBeanFactory().addBeanPostProcessor(new SqlProbe()));
        try (var context =
                application.run(
                        "--mission1.crew.current.membership-mode=" + args[1],
                        "--mission1.orbital.celestrak.refresh.enabled=false",
                        "--mission1.crew.ingestion.enabled=false",
                        "--mission1.crew.verification.enabled=false",
                        "--mission1.crew.refresh.event-aware.enabled=false",
                        "--mission1.crew.editorial.enabled=false",
                        "--mission1.crew.automatic-shadow.enabled=false",
                        "--mission1.crew.active-shadow.enabled=false",
                        "--mission1.crew.identity.review-mode=OFF",
                        "--mission1.crew.occurrences.backfill-mode=OFF")) {
            var api = context.getBean(CrewRestQueryService.class);
            var json = context.getBean(ObjectMapper.class);
            for (int i = 0; i < 10; i++) api.crew();
            var samples = new ArrayList<Map<String, Object>>();
            for (int i = 0; i < 100; i++) {
                SqlProbe.queries.clear();
                long start = System.nanoTime();
                var value = api.crew();
                long read = System.nanoTime();
                byte[] bytes = json.writeValueAsBytes(value);
                long end = System.nanoTime();
                if (SqlProbe.queries.stream()
                        .anyMatch(
                                q ->
                                        !q.stripLeading()
                                                .toUpperCase(Locale.ROOT)
                                                .startsWith("SELECT")))
                    throw new AssertionError("non-SELECT during Current read");
                samples.add(
                        Map.of(
                                "readMillis",
                                (read - start) / 1e6,
                                "serializeMillis",
                                (end - read) / 1e6,
                                "statements",
                                SqlProbe.queries.size(),
                                "members",
                                value.members().size(),
                                "bytes",
                                bytes.length));
            }
            var output = new TreeMap<String, Object>();
            output.put("mode", args[1]);
            output.put("samples", samples);
            output.put("sql", List.copyOf(SqlProbe.queries));
            output.put("current", api.crew());
            Files.writeString(
                    Path.of(args[0]),
                    json.writerWithDefaultPrettyPrinter().writeValueAsString(output) + "\n");
            System.out.println("CURRENT_READ " + args[1] + " " + samples.getLast());
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
                        if (!(result instanceof Connection connection)
                                || !m.getName().equals("getConnection")) return result;
                        return Proxy.newProxyInstance(
                                Connection.class.getClassLoader(),
                                new Class<?>[] {Connection.class},
                                (cp, cm, ca) -> {
                                    if (cm.getName().equals("prepareStatement"))
                                        queries.add((String) ca[0]);
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
                                                            && sa[0] instanceof String q)
                                                        queries.add(q);
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
