package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial.*;

class NasaEditorialHttpTest {
  final Instant now = Instant.parse("2026-10-10T12:00:00Z");
  final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
  final URI url = URI.create("https://www.nasa.gov/people/test/");

  @SuppressWarnings("unchecked")
  HttpResponse<byte[]> response(int status, String body, Map<String, List<String>> headers) {
    var r = (HttpResponse<byte[]>) mock(HttpResponse.class);
    when(r.statusCode()).thenReturn(status);
    when(r.body()).thenReturn(body.getBytes());
    when(r.headers()).thenReturn(HttpHeaders.of(headers, (a, b) -> true));
    return r;
  }

  HttpClient client() {
    var c = mock(HttpClient.class);
    when(c.followRedirects()).thenReturn(HttpClient.Redirect.NEVER);
    return c;
  }

  CrewEditorialRepository repo() {
    var r = mock(CrewEditorialRepository.class);
    when(r.reserveNasaRequest(any())).thenReturn(now);
    return r;
  }

  NasaEditorialHttp http(HttpClient c, CrewEditorialRepository r) {
    return new NasaEditorialHttp(
        c, clock, Duration.ofSeconds(20), new NasaRequestGate(r, clock), u -> {});
  }

  @Test
  void correctRedirectPreservesPathHeadersAndFinalUrl() throws Exception {
    var c = client();
    var r = repo();
    doReturn(
            response(301, "", Map.of("Location", List.of("/people/final/"))),
            response(200, "TEST", Map.of("Content-Type", List.of("text/html"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    var capture = http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null);
    assertNull(capture.transportError());
    assertEquals(URI.create("https://www.nasa.gov/people/final/"), capture.finalUrl());
    assertEquals(1, capture.redirects().size());
    verify(r, times(2)).reserveNasaRequest(any());
  }

  @Test
  void crossOriginAndLoopRejectedBeforeFollowing() throws Exception {
    for (String target :
        List.of("https://evil.test/people/", "https://localhost/people/", url.toString())) {
      var c = client();
      var r = repo();
      doReturn(response(301, "", Map.of("Location", List.of(target))))
          .when(c)
          .send(any(), any(HttpResponse.BodyHandler.class));
      assertNotNull(http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null).transportError());
      verify(c, times(1)).send(any(), any(HttpResponse.BodyHandler.class));
    }
  }

  @Test
  void redirectBoundAndOversizedBody() throws Exception {
    var c = client();
    var r = repo();
    var n = new java.util.concurrent.atomic.AtomicInteger();
    when(c.send(any(), any(HttpResponse.BodyHandler.class)))
        .thenAnswer(
            a ->
                response(
                    301,
                    "",
                    Map.of("Location", List.of("/people/hop" + n.incrementAndGet() + "/"))));
    assertEquals(
        "REDIRECT_BOUND",
        http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null).transportError());
    assertEquals(6, n.get());
    c = client();
    doReturn(response(200, "x".repeat(2097153), Map.of()))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals(
        "BODY_BOUND", http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null).transportError());
  }

  @Test
  void conditional304RequiresCompatibleBodyAndUsesItsValidators() throws Exception {
    var c = client();
    var r = repo();
    doReturn(response(304, "", Map.of())).when(c).send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals(
        "304_WITHOUT_COMPATIBLE_BODY",
        http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null).transportError());
    var old =
        new Capture(
            Stream.NASA_PERSON_RESOURCE,
            url,
            url,
            List.of(),
            now,
            now,
            200,
            Map.of("ETag", List.of("TEST_ETAG"), "Content-Type", List.of("text/html")),
            "TEST_BODY".getBytes(),
            null);
    var got =
        http(c, r)
            .fetch(
                Stream.NASA_PERSON_RESOURCE,
                url,
                new StoredCapture(1, null, old, null, Outcome.SUCCESS, "OK"));
    assertEquals(304, got.status());
    assertArrayEquals(old.body(), got.body());
    assertEquals("text/html", got.header("Content-Type"));
    verify(c, times(2))
        .send(argThat(q -> q.uri().equals(url)), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void rateLimitHasDurableRetryAfterAndNoSynchronousRetry() throws Exception {
    var c = client();
    var r = repo();
    doReturn(response(429, "limited", Map.of("Retry-After", List.of("3600"))))
        .when(c)
        .send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals(429, http(c, r).fetch(Stream.NASA_EDITORIAL_TOPIC, url, null).status());
    verify(r).nasaCooldown(now.plusSeconds(3600));
    verify(c, times(1)).send(any(), any(HttpResponse.BodyHandler.class));
    assertEquals(
        now.plusSeconds(60), NasaRequestGate.retryAfter("Sat, 10 Oct 2026 12:01:00 GMT", now));
    assertEquals(now.plusSeconds(900), NasaRequestGate.retryAfter("invalid", now));
  }

  @Test
  void timeoutAndBudgetCooldownAreResourceSpecificFailures() throws Exception {
    var c = client();
    var r = repo();
    when(c.send(any(), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new HttpTimeoutException("TEST"));
    assertEquals(
        "TIMEOUT", http(c, r).fetch(Stream.NASA_PERSON_RESOURCE, url, null).transportError());
    c = client();
    when(r.reserveNasaRequest(any())).thenReturn(now.plusSeconds(3600));
    assertEquals(
        "NASA_BUDGET_COOLDOWN",
        http(c, r).fetch(Stream.NASA_EDITORIAL_TOPIC, url, null).transportError());
    verify(c, never()).send(any(), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void subscriberCancelsBeforeBufferingOversizedStreamAndRetainsOnlyBoundedBytes() {
    var subscriber = new NasaEditorialHttp.BoundedBodySubscriber();
    var subscription = mock(java.util.concurrent.Flow.Subscription.class);
    subscriber.onSubscribe(subscription);
    subscriber.onNext(List.of(java.nio.ByteBuffer.wrap("TEST".getBytes())));
    subscriber.onComplete();
    assertArrayEquals("TEST".getBytes(), subscriber.getBody().toCompletableFuture().join());
    var oversized = new NasaEditorialHttp.BoundedBodySubscriber();
    oversized.onSubscribe(subscription);
    oversized.onNext(List.of(java.nio.ByteBuffer.allocate(2097153)));
    assertThrows(
        java.util.concurrent.CompletionException.class,
        () -> oversized.getBody().toCompletableFuture().join());
    verify(subscription).cancel();
  }
}
