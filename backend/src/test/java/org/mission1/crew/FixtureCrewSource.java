package org.mission1.crew;

import java.net.*;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.concurrent.atomic.AtomicInteger;
import com.sun.net.httpserver.HttpServer;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;

/** Recorded historical fixture or explicitly synthetic variations; loopback only, never LL2. */
public final class FixtureCrewSource implements AutoCloseable {
    public final AtomicInteger requests = new AtomicInteger();
    public final LaunchLibrary2CrewSource source;
    public final MutableClock clock = new MutableClock();
    public String body = fixture("active-iss-expedition-detailed");
    public int status = 200;
    public String retryAfter = "10800";
    private final HttpServer server;

    public FixtureCrewSource() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/2.3.0/expeditions/", e -> {
            requests.incrementAndGet();
            e.getResponseHeaders().add("ETag", "TEST_ETAG");
            e.getResponseHeaders().add("Last-Modified", "Sat, 03 Oct 2026 08:00:00 GMT");
            if (retryAfter != null) e.getResponseHeaders().add("Retry-After", retryAfter);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            e.sendResponseHeaders(status, bytes.length);
            try (var out = e.getResponseBody()) { out.write(bytes); }
        });
        server.start();
        source = new LaunchLibrary2CrewSource(new CrewHttpReader(HttpClient.newHttpClient(), clock, Duration.ofSeconds(2)),
                URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/2.3.0/"), 4);
    }
    public static String fixture(String name) {
        try (var input = FixtureCrewSource.class.getResourceAsStream("/fixtures/crew/ll2/" + name + ".json")) {
            return new String(java.util.Objects.requireNonNull(input).readAllBytes(), StandardCharsets.UTF_8);
        } catch (java.io.IOException e) { throw new AssertionError(e); }
    }
    @Override public void close() { server.stop(0); }
    public static final class MutableClock extends Clock {
        public Instant time = Instant.parse("2026-10-03T10:00:00Z");
        @Override public Instant instant() { return time; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }
}
