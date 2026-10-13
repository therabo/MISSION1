package org.mission1.source.orbital.celestrak;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.application.CelesTrakRefreshPolicy;
import org.mission1.orbital.application.CelesTrakRequestStore;
import org.mission1.orbital.application.CelesTrakRefreshResult;
import org.mission1.orbital.application.CelesTrakRefreshService;
import org.mission1.orbital.application.CelesTrakSourceHealthTracker;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.propagation.TleElementParser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Offline local HTTP → real adapter → orchestration → PostgreSQL → Orekit → REST. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CelesTrakRefreshIntegrationTest {
    private static final Instant FIRST = Instant.parse("2026-09-28T15:00:00Z");

    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10")
            .withDatabaseName("mission1_refresh_test")
            .withUsername("mission1_refresh_test")
            .withPassword("test_only");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired OrbitalElementSetRepository repository;
    @Autowired CelesTrakRequestStore requestStore;
    @Autowired TleElementParser parser;
    @Autowired CelesTrakRefreshPolicy policy;
    @Autowired CelesTrakSourceHealthTracker health;
    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationContext context;
    @MockitoBean Clock clock;

    @Test void offlineFullPipelinePreservesDuplicateObservationsAndIndependentHealth() throws Exception {
        assertFalse(context.containsBean("celesTrakRefreshScheduler"));
        jdbc.execute("TRUNCATE orbital_element_observations, orbital_element_sets RESTART IDENTITY CASCADE");
        AtomicInteger responseStatus = new AtomicInteger(200);
        AtomicInteger requests = new AtomicInteger();
        String tle = fixture();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/iss", exchange -> {
            requests.incrementAndGet();
            int status = responseStatus.get();
            byte[] bytes = (status == 200 ? tle : "blocked").getBytes(StandardCharsets.US_ASCII);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        try {
            URI local = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/iss");
            var adapter = new CelesTrakOrbitalElementsSource(HttpClient.newHttpClient(), clock, parser, local);
            var refresh = new CelesTrakRefreshService(repository, adapter, policy, health, clock, requestStore);

            when(clock.instant()).thenReturn(FIRST);
            assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT, refresh.refresh().outcome());
            assertEquals(1, requests.get());
            assertEquals(1, count("orbital_element_sets"));
            assertEquals(1, count("orbital_element_observations"));
            mvc.perform(get("/api/iss/state"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.quality.status").value("GOOD"))
                    .andExpect(jsonPath("$.classification").value("COMPUTED_FROM_ORBITAL_ELEMENTS"))
                    .andExpect(jsonPath("$.source.classification").value("SOURCE_PROVIDED_ORBITAL_ELEMENTS"))
                    .andExpect(jsonPath("$.sourceHealth.status").value("HEALTHY"))
                    .andExpect(jsonPath("$.sourceHealth.lastSuccessAt").value(FIRST.toString()));

            // A new process-local tracker must still respect the durable observation.
            when(clock.instant()).thenReturn(FIRST.plusSeconds(60));
            var restarted = new CelesTrakRefreshService(repository, adapter, policy,
                    new CelesTrakSourceHealthTracker(), clock, requestStore);
            assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, restarted.refresh().outcome());
            assertEquals(1, requests.get());

            Instant second = FIRST.plus(Duration.ofMinutes(130));
            when(clock.instant()).thenReturn(second);
            assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_ALREADY_KNOWN_ELEMENT,
                    refresh.refresh().outcome());
            assertEquals(2, requests.get());
            assertEquals(1, count("orbital_element_sets"));
            assertEquals(2, count("orbital_element_observations"));
            assertEquals(second, repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544).orElseThrow());

            Instant third = second.plus(Duration.ofMinutes(130));
            when(clock.instant()).thenReturn(third);
            responseStatus.set(403);
            assertEquals(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, refresh.refresh().outcome());
            assertEquals(3, requests.get());
            assertEquals(1, count("orbital_element_sets"));
            assertEquals(2, count("orbital_element_observations"));
            mvc.perform(get("/api/iss/state"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.quality.status").value("GOOD"))
                    .andExpect(jsonPath("$.sourceHealth.status").value("DEGRADED"))
                    .andExpect(jsonPath("$.sourceHealth.lastFailureCategory").value("RATE_LIMITED_OR_BLOCKED"))
                    .andExpect(jsonPath("$.sourceHealth.lastSuccessAt").value(second.toString()));
            assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_PROVIDER_SUSPENDED,
                    refresh.refresh().outcome());
            assertEquals(3, requests.get());
        } finally {
            server.stop(0);
        }
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private static String fixture() throws IOException {
        try (var input = CelesTrakRefreshIntegrationTest.class.getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            return new String(input.readAllBytes(), StandardCharsets.US_ASCII);
        }
    }
}
