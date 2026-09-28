package org.mission1.source.orbital.celestrak;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Objects;

import org.mission1.orbital.application.OrbitalElementsSource;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.propagation.TleElementParser;

/** Single explicit CelesTrak GET. A non-200 response is surfaced and never retried here. */
public final class CelesTrakOrbitalElementsSource implements OrbitalElementsSource {
    public static final URI ISS_TLE_URI = URI.create(
            "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");
    private final HttpClient client;
    private final Clock clock;
    private final TleElementParser parser;
    private final URI endpoint;

    public CelesTrakOrbitalElementsSource(Clock clock, TleElementParser parser) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build(), clock, parser, ISS_TLE_URI);
    }

    CelesTrakOrbitalElementsSource(HttpClient client, Clock clock, TleElementParser parser, URI endpoint) {
        this.client = Objects.requireNonNull(client);
        this.clock = Objects.requireNonNull(clock);
        this.parser = Objects.requireNonNull(parser);
        this.endpoint = Objects.requireNonNull(endpoint);
    }

    @Override
    public OrbitalElementSet fetch() {
        HttpRequest request = HttpRequest.newBuilder(endpoint).GET().timeout(Duration.ofSeconds(10))
                .header("Accept", "text/plain").build();
        final HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new SourceFetchException("CelesTrak request interrupted", null, interrupted);
        } catch (IOException failure) {
            throw new SourceFetchException("CelesTrak request failed", null, failure);
        }
        if (response.statusCode() != 200) {
            throw new SourceFetchException("CelesTrak returned HTTP " + response.statusCode(), response.statusCode(), null);
        }
        try {
            String body = response.body();
            if (body == null || body.isBlank() || body.length() > 1024) {
                throw new IllegalArgumentException("Empty or oversized TLE response");
            }
            List<String> lines = body.lines().toList();
            if (lines.size() != 3 || lines.stream().anyMatch(String::isBlank)) {
                throw new IllegalArgumentException("Expected one ISS three-line TLE");
            }
            return parser.parse(lines.get(1), lines.get(2), clock.instant(),
                    "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", endpoint);
        } catch (RuntimeException invalid) {
            throw new SourceFetchException("Invalid CelesTrak ISS TLE response", 200, invalid);
        }
    }
}
