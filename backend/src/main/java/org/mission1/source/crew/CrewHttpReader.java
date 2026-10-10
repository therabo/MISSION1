package org.mission1.source.crew;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Objects;
import org.mission1.crew.domain.*;

/** One explicit GET, no retry, pagination, caching or background acquisition. */
public final class CrewHttpReader {
    public static final int MAX_BYTES = 2 * 1024 * 1024;
    private final HttpClient client;
    private final Clock clock;
    private final Duration timeout;
    private final org.mission1.source.crew.nasa.NasaRequestGate nasaGate;

    public CrewHttpReader(HttpClient client, Clock clock, Duration timeout) {
        this(client,clock,timeout,null);
    }

    public CrewHttpReader(HttpClient client, Clock clock, Duration timeout,org.mission1.source.crew.nasa.NasaRequestGate nasaGate) {
        this.client = Objects.requireNonNull(client); this.clock = Objects.requireNonNull(clock);
        if (timeout == null || timeout.isZero() || timeout.isNegative()) throw new IllegalArgumentException("Positive timeout required");
        this.timeout = timeout;
        this.nasaGate=nasaGate;
    }

    public CrewSourceResult<byte[]> fetch(URI url, CrewSource source, String accept,
            String sourceVersion, String adapterVersion) {
        var request = HttpRequest.newBuilder(url).timeout(timeout).header("Accept", accept)
                .header("User-Agent", "MISSION1-crew/1").GET().build();
        final HttpResponse<byte[]> response;
        try (AutoCloseable permit=source==CrewSource.NASA_OFFICIAL && nasaGate!=null?nasaGate.acquire():()->{}) {
            response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if(source==CrewSource.NASA_OFFICIAL && nasaGate!=null && response.statusCode()==429)
                nasaGate.cooldown(org.mission1.source.crew.nasa.NasaRequestGate.retryAfter(response.headers().firstValue("Retry-After").orElse(null),clock.instant()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failed(CrewSourceState.SOURCE_UNAVAILABLE, CrewSourceResult.FailureCode.INTERRUPTED, null, null, null);
        } catch (HttpTimeoutException e) {
            return failed(CrewSourceState.SOURCE_UNAVAILABLE, CrewSourceResult.FailureCode.TIMEOUT, null, null, null);
        } catch (IOException e) {
            return failed(CrewSourceState.SOURCE_UNAVAILABLE, CrewSourceResult.FailureCode.NETWORK_ERROR, null, null, null);
        } catch (Exception e) {
            return failed(CrewSourceState.SOURCE_UNAVAILABLE, CrewSourceResult.FailureCode.NETWORK_ERROR, null, null, null);
        }
        byte[] bytes = response.body();
        var observation = new CrewSourceObservation(source, url, clock.instant(), null, null,
                response.headers().firstValue("ETag").orElse(null),
                response.headers().firstValue("Last-Modified").orElse(null), sha256(bytes), sourceVersion, adapterVersion);
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            var state = status == 429 ? CrewSourceState.RATE_LIMITED
                    : status == 404 ? CrewSourceState.NOT_FOUND : CrewSourceState.SOURCE_UNAVAILABLE;
            return failed(state, CrewSourceResult.FailureCode.HTTP_ERROR, status,
                    response.headers().firstValue("Retry-After").orElse(null), observation);
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES)
            return failed(CrewSourceState.MALFORMED_RESPONSE, CrewSourceResult.FailureCode.INVALID_RESPONSE, status, null, observation);
        return new CrewSourceResult<>(CrewSourceState.AVAILABLE, bytes, observation, null, status);
    }

    public static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable", e); }
    }

    public static <T> CrewSourceResult<T> failed(CrewSourceState state, CrewSourceResult.FailureCode code,
            Integer status, String retryAfter, CrewSourceObservation observation) {
        return new CrewSourceResult<>(state, null, observation, new CrewSourceResult.Failure(code, status, retryAfter));
    }
}
