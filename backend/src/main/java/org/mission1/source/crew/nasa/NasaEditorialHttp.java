package org.mission1.source.crew.nasa;

import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.domain.CrewEditorial.*;

/** Bounded official-origin HTTP with every redirect checked and raw metadata retained. */
public final class NasaEditorialHttp implements NasaEditorialSource.Transport {
  private final HttpClient client;
  private final Clock clock;
  private final Duration timeout;
  private final NasaRequestGate gate;

  @FunctionalInterface
  interface AddressCheck {
    void verify(URI url) throws java.io.IOException;
  }

  private final AddressCheck addressCheck;

  public NasaEditorialHttp(HttpClient client, Clock clock, Duration timeout, NasaRequestGate gate) {
    this(client, clock, timeout, gate, NasaEditorialHttp::publicAddress);
  }

  NasaEditorialHttp(
      HttpClient client, Clock clock, Duration timeout, NasaRequestGate gate, AddressCheck check) {
    if (client.followRedirects() != HttpClient.Redirect.NEVER)
      throw new IllegalArgumentException("Redirects must be checked");
    this.client = client;
    this.clock = clock;
    this.timeout = timeout;
    this.gate = gate;
    this.addressCheck = check;
  }

  public static void publicAddress(URI u) throws java.io.IOException {
    for (var a : InetAddress.getAllByName(u.getHost())) {
      byte[] b = a.getAddress();
      if (a.isAnyLocalAddress()
          || a.isLoopbackAddress()
          || a.isLinkLocalAddress()
          || a.isSiteLocalAddress()
          || a.isMulticastAddress()
          || (b.length == 16 && (b[0] & 0xfe) == 0xfc))
        throw new java.io.IOException("Private address rejected");
    }
  }

  @Override
  public Capture fetch(Stream stream, URI url, StoredCapture cached) {
    Instant start = clock.instant();
    URI current = url;
    var redirects = new ArrayList<String>();
    Map<String, List<String>> headers = Map.of();
    Integer status = null;
    try {
      for (int hop = 0; hop <= 5; hop++) {
        NasaEditorialParser.nasaUrl(current.toString());
        addressCheck.verify(current);
        var request =
            HttpRequest.newBuilder(current)
                .timeout(timeout)
                .header("Accept", "application/json,text/html;q=0.9")
                .header("User-Agent", "MISSION1-crew-editorial/1")
                .GET();
        if (cached != null && hop == 0) {
          var c = cached.capture();
          if (c.header("ETag") != null) request.header("If-None-Match", c.header("ETag"));
          if (c.header("Last-Modified") != null)
            request.header("If-Modified-Since", c.header("Last-Modified"));
        }
        try (var permit = gate.acquire()) {
          var responseBody = send(request.build());
          status = responseBody.status;
          headers = responseBody.headers;
          long headerCharacters =
              headers.entrySet().stream()
                  .mapToLong(
                      e ->
                          e.getKey().length()
                              + e.getValue().stream().mapToLong(String::length).sum())
                  .sum();
          if (headers.size() > 100 || headerCharacters > 65536) {
            headers = Map.of();
            throw new IllegalArgumentException("HEADER_BOUND");
          }
          if (Set.of(301, 302, 303, 307, 308).contains(status)) {
            if (hop == 5) throw new IllegalArgumentException("REDIRECT_BOUND");
            String location = first(headers, "Location");
            if (location == null) throw new IllegalArgumentException("REDIRECT_WITHOUT_LOCATION");
            URI next = NasaEditorialParser.nasaUrl(current.resolve(location).toString());
            if (next.equals(url) || redirects.contains(next.toString()))
              throw new IllegalArgumentException("REDIRECT_LOOP");
            redirects.add(next.toString());
            current = next;
            continue;
          }
          byte[] body = responseBody.body;
          if (body.length > 2097152) throw new IllegalArgumentException("BODY_BOUND");
          if (status == 429)
            gate.cooldown(
                NasaRequestGate.retryAfter(first(headers, "Retry-After"), clock.instant()));
          if (status == 304) {
            if (cached == null || cached.capture().body() == null)
              throw new IllegalArgumentException("304_WITHOUT_COMPATIBLE_BODY");
            body = cached.capture().body();
            var merged = new TreeMap<String, List<String>>(String.CASE_INSENSITIVE_ORDER);
            merged.putAll(cached.capture().headers());
            merged.putAll(headers);
            headers = merged;
          }
          return new Capture(
              stream, url, current, redirects, start, clock.instant(), status, headers, body, null);
        }
      }
      throw new IllegalArgumentException("REDIRECT_BOUND");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return failed(stream, url, current, redirects, start, status, headers, "INTERRUPTED");
    } catch (java.net.http.HttpTimeoutException e) {
      return failed(stream, url, current, redirects, start, status, headers, "TIMEOUT");
    } catch (IllegalArgumentException | IllegalStateException e) {
      return failed(stream, url, current, redirects, start, status, headers, e.getMessage());
    } catch (Exception e) {
      Throwable cause = e;
      while (cause.getCause() != null) cause = cause.getCause();
      return failed(
          stream,
          url,
          current,
          redirects,
          start,
          status,
          headers,
          "BODY_BOUND".equals(cause.getMessage()) ? "BODY_BOUND" : "TRANSPORT_ERROR");
    }
  }

  private Capture failed(
      Stream s,
      URI url,
      URI end,
      List<String> redirects,
      Instant start,
      Integer status,
      Map<String, List<String>> headers,
      String error) {
    return new Capture(
        s, url, end, redirects, start, clock.instant(), status, headers, null, error);
  }

  private Response send(HttpRequest request) throws Exception {
    var r = client.send(request, info -> new BoundedBodySubscriber());
    return new Response(r.statusCode(), r.headers().map(), r.body());
  }

  private record Response(int status, Map<String, List<String>> headers, byte[] body) {}

  /** Complete-body response keeps the request timeout active; cancel before buffering >2 MiB. */
  static final class BoundedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final java.util.concurrent.CompletableFuture<byte[]> result =
        new java.util.concurrent.CompletableFuture<>();
    private final java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
    private java.util.concurrent.Flow.Subscription subscription;

    public java.util.concurrent.CompletionStage<byte[]> getBody() {
      return result;
    }

    public void onSubscribe(java.util.concurrent.Flow.Subscription s) {
      subscription = s;
      s.request(1);
    }

    public void onNext(List<java.nio.ByteBuffer> chunks) {
      if (result.isDone()) return;
      long incoming = chunks.stream().mapToLong(java.nio.ByteBuffer::remaining).sum();
      if (incoming > 2097152 - bytes.size()) {
        subscription.cancel();
        result.completeExceptionally(new IllegalArgumentException("BODY_BOUND"));
        return;
      }
      for (var b : chunks) {
        byte[] part = new byte[b.remaining()];
        b.get(part);
        bytes.writeBytes(part);
      }
      subscription.request(1);
    }

    public void onError(Throwable t) {
      result.completeExceptionally(t);
    }

    public void onComplete() {
      result.complete(bytes.toByteArray());
    }
  }

  private static String first(Map<String, List<String>> h, String key) {
    return h.entrySet().stream()
        .filter(e -> e.getKey().equalsIgnoreCase(key))
        .flatMap(e -> e.getValue().stream())
        .findFirst()
        .orElse(null);
  }
}
