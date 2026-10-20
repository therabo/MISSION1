package org.mission1.source.orbital.celestrak;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.HttpClient;
import java.time.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.mission1.orbital.application.*;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.orbital.persistence.JdbcCelesTrakRequestStore;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** TEST_ONLY transport fault + real adapter/parser/store, with virtual 130-minute UTC. */
@SpringBootTest
@Testcontainers
class JdbcCelesTrakRequestStoreTest {
    @Container static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16.10");
    @DynamicPropertySource static void db(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired CelesTrakRequestStore requests;
    @Autowired OrbitalElementSetRepository repository;
    @Autowired TleElementParser parser;
    private static final Instant T = Instant.parse("2026-09-28T15:00:00.936466Z");
    private static final Duration INTERVAL = Duration.ofMinutes(130);

    @BeforeEach void empty() {
        jdbc.execute("TRUNCATE orbital_element_sets CASCADE");
        jdbc.update("UPDATE celestrak_request_state SET next_eligible_at='epoch',suspended=false");
    }

    @Test void reservationSurvivesRestartAndPreventsDuplicateConcurrentOwners() throws Exception {
        var other = new JdbcCelesTrakRequestStore(jdbc);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(1);
            var a = pool.submit(() -> { ready.await(); return requests.reserve(T, T.plus(INTERVAL)); });
            var b = pool.submit(() -> { ready.await(); return other.reserve(T, T.plus(INTERVAL)); });
            ready.countDown();
            assertNotEquals(a.get(), b.get());
        }
        assertEquals(T.plus(INTERVAL), other.state().nextEligibleAt());
        assertFalse(other.reserve(T.plus(INTERVAL).minusMillis(377), T.plus(INTERVAL).plus(INTERVAL)));
        assertTrue(other.reserve(T.plus(INTERVAL), T.plus(INTERVAL).plus(INTERVAL)));
    }

    @Test void nanosecondPrecisionCannotRoundAnAttemptBeforeEligibility() {
        requests.reserve(T, T.plus(INTERVAL).plusNanos(1));
        Instant deadline = T.plus(INTERVAL).plusNanos(1000);
        assertEquals(deadline, requests.state().nextEligibleAt());
        assertFalse(requests.reserve(deadline.minusNanos(1), deadline.plus(INTERVAL)));
        assertTrue(requests.reserve(deadline, deadline.plus(INTERVAL)));
    }

    @Test void suspensionSurvivesRestartBeyondCooldown() {
        requests.reserve(T, T.plus(INTERVAL));
        requests.suspend();
        var restarted = new JdbcCelesTrakRequestStore(jdbc);
        assertTrue(restarted.state().suspended());
        assertFalse(restarted.reserve(T.plus(Duration.ofDays(1)), T.plus(Duration.ofDays(2))));
        var source = mock(OrbitalElementsSource.class);
        var service = new CelesTrakRefreshService(repository, source, new CelesTrakRefreshPolicy(INTERVAL),
                new CelesTrakSourceHealthTracker(), Clock.fixed(T.plus(Duration.ofDays(1)), ZoneOffset.UTC), restarted);
        assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_PROVIDER_SUSPENDED, service.refresh().outcome());
        verifyNoInteractions(source);
    }

    @Test void actualTransportFailureRestart377msSkipAndExactBoundaryRecoveryPreserveLineage() throws Exception {
        int port;
        try (var socket = new java.net.ServerSocket(0, 0, InetAddress.getLoopbackAddress())) { port = socket.getLocalPort(); }
        var clock = mock(Clock.class);
        when(clock.instant()).thenReturn(T);
        URI url = URI.create("http://127.0.0.1:" + port + "/test-only-gp");
        var source = new CelesTrakOrbitalElementsSource(HttpClient.newHttpClient(), clock, parser, url);
        var initial = new CelesTrakRefreshService(repository, source, new CelesTrakRefreshPolicy(INTERVAL),
                new CelesTrakSourceHealthTracker(), clock, requests);
        assertEquals(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, initial.refresh().outcome());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM orbital_element_sets", Integer.class));
        Instant eligible = T.plus(INTERVAL);
        assertEquals(eligible, requests.state().nextEligibleAt());
        var restarted = new CelesTrakRefreshService(repository, source, new CelesTrakRefreshPolicy(INTERVAL),
                new CelesTrakSourceHealthTracker(), clock, new JdbcCelesTrakRequestStore(jdbc));
        var calls = new AtomicInteger();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        byte[] tle;
        try (var input = getClass().getResourceAsStream("/iss-2026-09-28.tle")) { tle = input.readAllBytes(); }
        server.createContext("/test-only-gp", e -> {
            calls.incrementAndGet();
            e.sendResponseHeaders(200, tle.length);
            try (var out = e.getResponseBody()) { out.write(tle); }
        });
        server.start();
        try {
            when(clock.instant()).thenReturn(eligible.minusMillis(377));
            var skipped = restarted.refresh();
            assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, skipped.outcome());
            assertEquals(eligible, skipped.nextEligibleAt());
            assertEquals(0, calls.get());
            when(clock.instant()).thenReturn(eligible);
            var recovered = restarted.refresh();
            assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT, recovered.outcome());
            assertEquals(eligible.plus(INTERVAL), recovered.nextEligibleAt());
            assertEquals(1, calls.get());
            assertEquals(eligible, repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544).orElseThrow());
            assertEquals(url, repository.recent(1).getFirst().elements().sourceUri());
            assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, restarted.refresh().outcome());
            assertEquals(1, calls.get());
        } finally { server.stop(0); }
    }
}
