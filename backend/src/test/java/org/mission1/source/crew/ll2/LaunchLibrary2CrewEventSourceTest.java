package org.mission1.source.crew.ll2;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.*;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

import java.net.*;
import java.net.http.HttpClient;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

class LaunchLibrary2CrewEventSourceTest {
    HttpServer server;
    LaunchLibrary2CrewEventSource source;
    ObjectNode page;
    int status = 200;
    String query;
    final AtomicInteger requests = new AtomicInteger();
    final Instant now = Instant.parse("2026-10-03T18:33:49Z");

    @BeforeEach
    void setup() throws Exception {
        page =
                (ObjectNode)
                        new JsonMapper()
                                .readTree(
                                        getClass()
                                                .getResourceAsStream(
                                                        "/fixtures/crew/ll2/events-calendar.json"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/2.3.0/events/",
                e -> {
                    requests.incrementAndGet();
                    query = e.getRequestURI().getRawQuery();
                    e.getResponseHeaders().add("Content-Type", "application/json");
                    e.getResponseHeaders().add("Retry-After", "3600");
                    byte[] b = page.toString().getBytes();
                    e.sendResponseHeaders(status, b.length);
                    try (var out = e.getResponseBody()) {
                        out.write(b);
                    }
                });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/2.3.0/");
        for (var row : page.withArray("results"))
            ((ObjectNode) row)
                    .put("url", base.resolve("events/" + row.get("id").asText() + "/").toString());
        source =
                new LaunchLibrary2CrewEventSource(
                        new CrewHttpReader(
                                HttpClient.newHttpClient(),
                                Clock.fixed(now, ZoneOffset.UTC),
                                Duration.ofSeconds(2)),
                        base,
                        4);
    }

    @AfterEach
    void close() {
        server.stop(0);
    }

    @Test
    void realRecordedContractUsesOneBoundedGetAndUnknownClassification() {
        var r = source.fetch(source.request(now));
        assertEquals(CrewSourceState.AVAILABLE, r.state());
        assertEquals(3, r.value().events().size());
        assertTrue(
                r.value().events().stream()
                        .allMatch(
                                e ->
                                        e.relevance() == CrewOperationalEvent.Relevance.UNKNOWN
                                                && e.status()
                                                        == CrewOperationalEvent.Status.UNKNOWN));
        assertEquals(1, requests.get());
        assertTrue(query.contains("spacestation__ids=4&type__ids=2%2C8"));
        assertTrue(query.contains("mode=detailed&ordering=date&limit=20"));
        assertFalse(query.contains("space_station="));
        assertEquals(now, r.observation().retrievedAt());
        assertNotNull(r.observation().contentHash());
    }

    @Test
    void nonemptyValidatedAstronautRelationIndicatesRelevanceOnly() {
        ((ObjectNode) page.withArray("results").get(0))
                .withArray("astronauts")
                .addObject()
                .put("id", 99999);
        var r = source.fetch(source.request(now));
        assertEquals(
                CrewOperationalEvent.Relevance.CREWED, r.value().events().getFirst().relevance());
        assertEquals(CrewOperationalEvent.Status.UNKNOWN, r.value().events().getFirst().status());
        assertEquals(1, requests.get());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "pagination",
                "count",
                "station",
                "type",
                "mode",
                "date",
                "duplicate",
                "missingAstronauts",
                "badAstronaut",
                "badUrl",
                "countOverflow",
                "integerLaunch"
            })
    void invalidOrIncompleteInputsFailClosed(String mutation) {
        ObjectNode row = (ObjectNode) page.withArray("results").get(0);
        switch (mutation) {
            case "pagination" -> page.put("next", "https://invalid.example/next");
            case "count" -> page.put("count", 100);
            case "station" -> row.set("spacestations", new JsonMapper().createArrayNode());
            case "type" -> ((ObjectNode) row.get("type")).put("id", 99);
            case "mode" -> row.put("response_mode", "list");
            case "date" -> row.put("date", "2026-10-01");
            case "duplicate" -> {
                page.withArray("results").add(row.deepCopy());
                page.put("count", 4);
            }
            case "missingAstronauts" -> row.remove("astronauts");
            case "badAstronaut" -> row.withArray("astronauts").addObject().put("id", "not-an-id");
            case "countOverflow" -> page.put("count", 4294967299L);
            case "integerLaunch" -> row.withArray("launches").addObject().put("id", 99999);
            case "badUrl" -> row.put("url", "https://invalid.example/events/1/");
        }
        assertEquals(CrewSourceState.MALFORMED_RESPONSE, source.fetch(source.request(now)).state());
        assertEquals(1, requests.get());
    }

    @Test
    void quotaAndFailureHaveNoRetryLoop() {
        status = 429;
        var r = source.fetch(source.request(now));
        assertEquals(CrewSourceState.RATE_LIMITED, r.state());
        assertEquals("3600", r.failure().retryAfter());
        assertEquals(1, requests.get());
    }

    @Test
    void nullDateAndPrecisionRemainUnknownWithoutCurrentTimeFallback() {
        ObjectNode row = (ObjectNode) page.withArray("results").get(0);
        row.putNull("date");
        row.putNull("date_precision");
        var r = source.fetch(source.request(now));
        assertEquals(CrewSourceState.AVAILABLE, r.state());
        assertNull(r.value().events().getFirst().scheduledAt());
        assertFalse(r.value().events().getFirst().precise());
    }

    @Test
    void pastDateAndUnverifiedCompletionCancellationCargoFieldsCannotBecomeFacts() {
        var row = (ObjectNode) page.withArray("results").get(0);
        row.put("status", "completed");
        row.put("cancelled", true);
        row.put("is_cargo", true);
        var r = source.fetch(source.request(now));
        assertEquals(CrewSourceState.AVAILABLE, r.state());
        assertEquals(CrewOperationalEvent.Status.UNKNOWN, r.value().events().getFirst().status());
        assertEquals(
                CrewOperationalEvent.Relevance.UNKNOWN, r.value().events().getFirst().relevance());
    }
}
