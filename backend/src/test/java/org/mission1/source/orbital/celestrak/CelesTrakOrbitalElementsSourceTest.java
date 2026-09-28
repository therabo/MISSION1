package org.mission1.source.orbital.celestrak;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.SourceFailureCategory;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.TleElementParser;

class CelesTrakOrbitalElementsSourceTest {
    private static final Instant RECEIPT = Instant.parse("2026-09-28T14:26:25Z");
    private final TleElementParser parser = new TleElementParser(new OrekitData());

    @Test void fetchesOnceAndUsesApplicationReceiptTime() throws IOException {
        withResponse(200, fixture(), (source, requests) -> {
            var elements = source.fetch();
            assertEquals(1, requests.get());
            assertEquals(RECEIPT, elements.retrievedAt());
            assertEquals(Instant.parse("2026-09-28T03:24:39.835008Z"), elements.elementEpoch());
            assertNull(elements.publishedAt());
            assertEquals(DataClassification.SOURCE_PROVIDED_ORBITAL_ELEMENTS, elements.classification());
        });
    }

    @Test void rejectsMalformedAndEmptyResponses() throws IOException {
        withResponse(200, "<html>error</html>", (source, requests) -> {
            assertEquals(SourceFailureCategory.INVALID_RESPONSE,
                    assertThrows(SourceFetchException.class, source::fetch).category());
            assertEquals(1, requests.get());
        });
        withResponse(200, "", (source, requests) -> {
            assertEquals(SourceFailureCategory.INVALID_RESPONSE,
                    assertThrows(SourceFetchException.class, source::fetch).category());
            assertEquals(1, requests.get());
        });
    }

    @Test void rejectsWrongSatelliteResponse() throws IOException {
        String[] lines = fixture().lines().toArray(String[]::new);
        String wrongCatalog = "OTHER OBJECT\n"
                + withChecksum(lines[1].substring(0, 2) + "99999" + lines[1].substring(7)) + "\n"
                + withChecksum(lines[2].substring(0, 2) + "99999" + lines[2].substring(7)) + "\n";
        withResponse(200, wrongCatalog, (source, requests) -> {
            assertEquals(SourceFailureCategory.WRONG_SATELLITE,
                    assertThrows(SourceFetchException.class, source::fetch).category());
            assertEquals(1, requests.get());
        });
    }

    @Test void exposesNon200WithoutRetry() throws IOException {
        withResponse(403, "blocked", (source, requests) -> {
            SourceFetchException failure = assertThrows(SourceFetchException.class, source::fetch);
            assertEquals(403, failure.httpStatus());
            assertEquals(SourceFailureCategory.RATE_LIMITED_OR_BLOCKED, failure.category());
            assertEquals(1, requests.get());
        });
    }

    private static String fixture() throws IOException {
        try (var input = CelesTrakOrbitalElementsSourceTest.class.getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            return new String(input.readAllBytes(), StandardCharsets.US_ASCII);
        }
    }

    private static String withChecksum(String line) {
        int sum = 0;
        for (int i = 0; i < 68; i++) {
            char c = line.charAt(i);
            if (c >= '0' && c <= '9') sum += c - '0';
            else if (c == '-') sum++;
        }
        return line.substring(0, 68) + (sum % 10);
    }

    private void withResponse(int status, String body, TestAction action) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger requests = new AtomicInteger();
        server.createContext("/tle", exchange -> {
            requests.incrementAndGet();
            byte[] bytes = body.getBytes(StandardCharsets.US_ASCII);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        try {
            URI local = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/tle");
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
            var source = new CelesTrakOrbitalElementsSource(client, Clock.fixed(RECEIPT, ZoneOffset.UTC), parser, local);
            action.run(source, requests);
        } finally {
            server.stop(0);
        }
    }

    @FunctionalInterface
    private interface TestAction {
        void run(CelesTrakOrbitalElementsSource source, AtomicInteger requests);
    }
}
