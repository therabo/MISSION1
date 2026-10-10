package org.mission1.source.crew.nasa;

import org.mission1.crew.application.CrewVerificationHttpSource;
import org.mission1.crew.domain.CrewSourceResult;
import org.mission1.source.crew.CrewHttpReader;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.*;

/** One conditional official-feed GET. No redirect following, retry or article acquisition. */
public final class NasaOperationalFeedHttpSource implements CrewVerificationHttpSource {
    public static final URI URL = URI.create("https://www.nasa.gov/blogs/spacestation/feed/");
    private final HttpClient client;
    private final Clock clock;
    private final Duration timeout;
    private final NasaRequestGate gate;

    public NasaOperationalFeedHttpSource(HttpClient client, Clock clock, Duration timeout) {
        this(client,clock,timeout,null);
    }

    public NasaOperationalFeedHttpSource(HttpClient client, Clock clock, Duration timeout,NasaRequestGate gate) {
        this.client = client;
        this.clock = clock;
        this.timeout = timeout;
        this.gate = gate;
    }

    @Override
    public Fetch fetch(URI url, String etag, String lastModified) {
        if (!URL.equals(url))
            throw new IllegalArgumentException("Validated official feed required");
        var builder =
                HttpRequest.newBuilder(url)
                        .timeout(timeout)
                        .header("Accept", "application/rss+xml")
                        .header("User-Agent", "MISSION1-crew/1")
                        .GET();
        if (etag != null) builder.header("If-None-Match", etag);
        if (lastModified != null) builder.header("If-Modified-Since", lastModified);
        try (AutoCloseable permit=gate==null?()->{}:gate.acquire()) {
            var r = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            int status = r.statusCode();
            if(status==429 && gate!=null) gate.cooldown(NasaRequestGate.retryAfter(r.headers().firstValue("Retry-After").orElse(null),clock.instant()));
            var failure =
                    status == 200 || status == 304
                            ? null
                            : new CrewSourceResult.Failure(
                                    CrewSourceResult.FailureCode.HTTP_ERROR,
                                    status,
                                    r.headers().firstValue("Retry-After").orElse(null));
            if (status == 200
                    && (r.body().length == 0 || r.body().length > CrewHttpReader.MAX_BYTES))
                failure =
                        new CrewSourceResult.Failure(
                                CrewSourceResult.FailureCode.INVALID_RESPONSE, status, null);
            return new Fetch(
                    r.body(),
                    failure,
                    status,
                    r.headers().firstValue("Content-Type").orElse(null),
                    r.headers().firstValue("ETag").orElse(null),
                    r.headers().firstValue("Last-Modified").orElse(null),
                    clock.instant());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failed(CrewSourceResult.FailureCode.INTERRUPTED);
        } catch (HttpTimeoutException e) {
            return failed(CrewSourceResult.FailureCode.TIMEOUT);
        } catch (IOException e) {
            return failed(CrewSourceResult.FailureCode.NETWORK_ERROR);
        } catch (Exception e) {
            return failed(CrewSourceResult.FailureCode.NETWORK_ERROR);
        }
    }

    private Fetch failed(CrewSourceResult.FailureCode code) {
        return new Fetch(
                null,
                new CrewSourceResult.Failure(code, null, null),
                null,
                null,
                null,
                null,
                clock.instant());
    }
}
