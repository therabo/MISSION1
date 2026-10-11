package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.net.http.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mission1.crew.operational.OperationalResources;

class OperationalResourceHttpTest {
  static final String URL = "https://www.nasa.gov/people/test/";
  final Clock clock = Clock.fixed(Instant.parse("2026-10-11T18:00:00Z"), ZoneOffset.UTC);

  HttpClient client() {
    var c = mock(HttpClient.class);
    when(c.followRedirects()).thenReturn(HttpClient.Redirect.NEVER);
    return c;
  }

  @SuppressWarnings("unchecked")
  HttpResponse<byte[]> response(int status, String body, Map<String, List<String>> headers) {
    var r = (HttpResponse<byte[]>) mock(HttpResponse.class);
    when(r.statusCode()).thenReturn(status);
    when(r.body()).thenReturn(body.getBytes());
    when(r.headers()).thenReturn(HttpHeaders.of(headers, (a, b) -> true));
    return r;
  }

  OperationalResourceHttp http(HttpClient c) {
    return new OperationalResourceHttp(c, clock, (h, at) -> true, null, u -> {});
  }

  @Test
  void arbitraryUrlsAndEncodedTraversalAreRejected() {
    for (String url :
        List.of(
            "http://www.nasa.gov/people/a/",
            "https://evil.test/people/a/",
            "https://user@www.nasa.gov/people/a/",
            "https://www.nasa.gov:8080/people/a/",
            "https://www.nasa.gov/people/%2e%2e/a",
            "https://www.nasa.gov/people/a/?target=localhost",
            "https://ll.thespacedevs.com/2.3.0/astronauts/?search=Anna"))
      assertThrows(IllegalArgumentException.class, () -> OperationalResources.allowed(url));
  }

  @Test
  void checkedRedirectPreservesExactAcquisitionChain() throws Exception {
    var c = client();
    doReturn(
            response(301, "", Map.of("Location", List.of("/people/final/"))),
            response(200, "<h1>Test Person</h1>", Map.of("Content-Type", List.of("text/html"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    var result = http(c).fetch(URL);
    assertNull(result.error());
    assertEquals(List.of("https://www.nasa.gov/people/final/"), result.redirects());
    assertEquals(result.redirects().getLast(), result.finalUrl());
    verify(c, times(2)).send(any(), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void offsiteRedirectLoopAndPrivateAddressNeverGetFollowed() throws Exception {
    for (String target :
        List.of(
            "https://example.invalid/person", URL, "https://www.nasa.gov/mission/../../private")) {
      var c = client();
      doReturn(response(301, "", Map.of("Location", List.of(target))))
          .when(c)
          .send(any(), any(HttpResponse.BodyHandler.class));
      assertNotNull(http(c).fetch(URL).error());
      verify(c, times(1)).send(any(), any(HttpResponse.BodyHandler.class));
    }
    var c = client();
    var h =
        new OperationalResourceHttp(
            c,
            clock,
            (host, at) -> true,
            null,
            u -> {
              throw new java.io.IOException("TEST_PRIVATE_ADDRESS");
            });
    assertEquals("TRANSPORT_ERROR", h.fetch(URL).error());
    verify(c, never()).send(any(), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void sizeTypeTimeoutAndBudgetFailuresAreBounded() throws Exception {
    var c = client();
    doReturn(response(200, "x".repeat(2097153), Map.of("Content-Type", List.of("text/html"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals("BODY_BOUND", http(c).fetch(URL).error());
    c = client();
    doReturn(response(200, "x", Map.of("Content-Type", List.of("application/pdf"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals("UNSUPPORTED_CONTENT_TYPE", http(c).fetch(URL).error());
    c = client();
    when(c.send(any(), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new HttpTimeoutException("TEST_ONLY"));
    assertEquals("TIMEOUT", http(c).fetch(URL).error());
    c = client();
    assertEquals(
        "SOURCE_BUDGET_EXHAUSTED",
        new OperationalResourceHttp(c, clock, (h, at) -> false, null, u -> {}).fetch(URL).error());
    verify(c, never()).send(any(), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void retryAfterIsRetainedWithoutAnImmediateRetry() throws Exception {
    var c = client();
    doReturn(response(429, "", Map.of("Retry-After", List.of("7200"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    var result = http(c).fetch(URL);
    assertEquals("HTTP_429", result.error());
    assertEquals(clock.instant().plusSeconds(7200), result.retryAt());
    verify(c, times(1)).send(any(), any(HttpResponse.BodyHandler.class));
  }
}
