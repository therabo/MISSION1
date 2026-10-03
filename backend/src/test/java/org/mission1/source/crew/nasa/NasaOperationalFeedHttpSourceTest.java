package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.CrewSourceResult;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.*;

class NasaOperationalFeedHttpSourceTest {
    final HttpClient client = mock(HttpClient.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-10-03T12:00:00Z"), ZoneOffset.UTC);
    final NasaOperationalFeedHttpSource source =
            new NasaOperationalFeedHttpSource(client, clock, Duration.ofSeconds(20));

    @SuppressWarnings("unchecked")
    HttpResponse<byte[]> response(int status, byte[] body) {
        var r = (HttpResponse<byte[]>) mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body);
        when(r.headers())
                .thenReturn(
                        HttpHeaders.of(
                                java.util.Map.of(
                                        "Content-Type",
                                        java.util.List.of("application/rss+xml"),
                                        "ETag",
                                        java.util.List.of("test-etag"),
                                        "Last-Modified",
                                        java.util.List.of("Fri, 02 Oct 2026 18:14:15 GMT"),
                                        "Retry-After",
                                        java.util.List.of("7200")),
                                (a, b) -> true));
        return r;
    }

    @Test
    void conditionalHeadersAnd304ArePreservedWithoutRetry() throws Exception {
        var response = response(304, new byte[0]);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(response);
        var fetched = source.fetch(NasaOperationalFeedHttpSource.URL, "old-etag", "old-modified");
        assertEquals(304, fetched.status());
        assertNull(fetched.failure());
        var captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client, times(1)).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals(
                "old-etag", captor.getValue().headers().firstValue("If-None-Match").orElseThrow());
        assertEquals(
                "old-modified",
                captor.getValue().headers().firstValue("If-Modified-Since").orElseThrow());
    }

    @ParameterizedTest
    @ValueSource(ints = {404, 429, 500, 503})
    void httpFailuresHaveActualStatusAndNoRetry(int status) throws Exception {
        var response = response(status, new byte[0]);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(response);
        var fetched = source.fetch(NasaOperationalFeedHttpSource.URL, null, null);
        assertEquals(status, fetched.failure().httpStatus());
        assertEquals("7200", fetched.failure().retryAfter());
        verify(client, times(1)).send(any(), any());
    }

    @Test
    void timeoutAndNetworkFailureDoNotFabricateStatus() throws Exception {
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(
                        new HttpTimeoutException("TEST timeout"), new IOException("TEST network"));
        var a = source.fetch(NasaOperationalFeedHttpSource.URL, null, null);
        assertNull(a.status());
        assertEquals(CrewSourceResult.FailureCode.TIMEOUT, a.failure().code());
        assertEquals(
                CrewSourceResult.FailureCode.NETWORK_ERROR,
                source.fetch(NasaOperationalFeedHttpSource.URL, null, null).failure().code());
        verify(client, times(2)).send(any(), any());
    }

    @Test
    void emptyBodyAndUnsupportedUrlFailSafely() throws Exception {
        var response = response(200, new byte[0]);
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(response);
        assertEquals(
                CrewSourceResult.FailureCode.INVALID_RESPONSE,
                source.fetch(NasaOperationalFeedHttpSource.URL, null, null).failure().code());
        assertThrows(
                IllegalArgumentException.class,
                () -> source.fetch(URI.create("https://unofficial.example/feed/"), null, null));
    }
}
