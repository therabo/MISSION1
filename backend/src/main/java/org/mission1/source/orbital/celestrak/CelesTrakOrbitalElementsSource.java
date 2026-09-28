package org.mission1.source.orbital.celestrak;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

import org.mission1.orbital.application.OrbitalElementsSource;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.SourceFailureCategory;
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
            throw new SourceFetchException("CelesTrak request interrupted", null,
                    SourceFailureCategory.NETWORK_ERROR, interrupted);
        } catch (HttpTimeoutException timeout) {
            throw new SourceFetchException("CelesTrak request timed out", null,
                    SourceFailureCategory.TIMEOUT, timeout);
        } catch (IOException failure) {
            throw new SourceFetchException("CelesTrak request failed", null,
                    SourceFailureCategory.NETWORK_ERROR, failure);
        }
        if (response.statusCode() != 200) {
            var category = response.statusCode() == 403 || response.statusCode() == 429
                    ? SourceFailureCategory.RATE_LIMITED_OR_BLOCKED
                    : SourceFailureCategory.HTTP_ERROR;
            throw new SourceFetchException("CelesTrak returned HTTP " + response.statusCode(),
                    response.statusCode(), category, null);
        }
        String body = response.body();
        if (body == null || body.isBlank() || body.length() > 1024) {
            throw new SourceFetchException("Empty or oversized CelesTrak response", 200,
                    SourceFailureCategory.INVALID_RESPONSE, null);
        }
        List<String> lines = body.lines().toList();
        if (lines.size() != 3 || lines.stream().anyMatch(String::isBlank)) {
            throw new SourceFetchException("Expected one ISS three-line TLE", 200,
                    SourceFailureCategory.INVALID_RESPONSE, null);
        }
        String line1 = lines.get(1);
        String line2 = lines.get(2);
        if (line1.length() == 69 && line2.length() == 69
                && (!line1.substring(2, 7).equals("25544") || !line2.substring(2, 7).equals("25544"))) {
            throw new SourceFetchException("CelesTrak response names a different satellite", 200,
                    SourceFailureCategory.WRONG_SATELLITE, null);
        }
        try {
            return parser.parse(line1, line2, clock.instant().truncatedTo(ChronoUnit.MICROS),
                    "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", endpoint);
        } catch (RuntimeException invalid) {
            throw new SourceFetchException("Invalid CelesTrak ISS TLE", 200,
                    SourceFailureCategory.INVALID_TLE, invalid);
        }
    }
}
