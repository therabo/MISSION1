package org.mission1.source.crew.nasa;

import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.operational.*;
import org.mission1.crew.operational.OperationalResources.Capture;

/**
 * Uses the existing bounded subscriber and public-address check. Only verified resource classes.
 */
public final class OperationalResourceHttp {
  @FunctionalInterface
  public interface Budget {
    boolean reserve(String host, Instant at);
  }

  @FunctionalInterface
  public interface AddressCheck {
    void check(URI url) throws java.io.IOException;
  }

  private final HttpClient client;
  private final Clock clock;
  private final Budget budget;
  private final NasaRequestGate nasa;
  private final AddressCheck addresses;

  public OperationalResourceHttp(
      HttpClient client, Clock clock, Budget budget, NasaRequestGate nasa) {
    this(client, clock, budget, nasa, NasaEditorialHttp::publicAddress);
  }

  public OperationalResourceHttp(
      HttpClient client, Clock clock, Budget budget, NasaRequestGate nasa, AddressCheck addresses) {
    if (client.followRedirects() != HttpClient.Redirect.NEVER)
      throw new IllegalArgumentException("Checked redirects required");
    this.client = client;
    this.clock = clock;
    this.budget = budget;
    this.nasa = nasa;
    this.addresses = addresses;
  }

  public Capture fetch(String rawUrl) {
    Instant started = clock.instant();
    URI url = OperationalResources.allowed(rawUrl), current = url;
    var redirects = new ArrayList<String>();
    Integer status = null;
    String contentType = null;
    Instant retryAt = null;
    try {
      for (int hop = 0; hop <= 5; hop++) {
        OperationalResources.allowed(current.toString());
        addresses.check(current);
        if (!budget.reserve(current.getHost(), clock.instant()))
          throw new IllegalArgumentException("SOURCE_BUDGET_EXHAUSTED");
        var request =
            HttpRequest.newBuilder(current)
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json,text/html;q=0.9")
                .header("User-Agent", "MISSION1-operational-subject-binding/1")
                .GET()
                .build();
        try (AutoCloseable permit =
            current.getHost().equals("www.nasa.gov") && nasa != null ? nasa.acquire() : () -> {}) {
          var response =
              client.send(request, info -> new NasaEditorialHttp.BoundedBodySubscriber());
          status = response.statusCode();
          if (response.headers().map().size() > 100
              || response.headers().map().entrySet().stream()
                      .mapToLong(
                          e ->
                              e.getKey().length()
                                  + e.getValue().stream().mapToLong(String::length).sum())
                      .sum()
                  > 65536) throw new IllegalArgumentException("HEADER_BOUND");
          contentType = response.headers().firstValue("Content-Type").orElse(null);
          if (Set.of(301, 302, 303, 307, 308).contains(status)) {
            if (hop == 5) throw new IllegalArgumentException("REDIRECT_BOUND");
            var next = current.resolve(response.headers().firstValue("Location").orElseThrow());
            OperationalResources.allowed(next.toString());
            if (!url.getHost().equals(next.getHost()))
              throw new IllegalArgumentException("REDIRECT_HOST_CHANGE");
            if (next.equals(url) || redirects.contains(next.toString()))
              throw new IllegalArgumentException("REDIRECT_LOOP");
            redirects.add(next.toString());
            current = next;
            continue;
          }
          if (status == 429) {
            retryAt =
                NasaRequestGate.retryAfter(
                    response.headers().firstValue("Retry-After").orElse(null), clock.instant());
            if (current.getHost().equals("www.nasa.gov") && nasa != null) nasa.cooldown(retryAt);
          }
          if (status < 200 || status >= 300) throw new IllegalArgumentException("HTTP_" + status);
          if (contentType == null
              || !(contentType.toLowerCase(Locale.ROOT).contains("json")
                  || contentType.toLowerCase(Locale.ROOT).contains("html")))
            throw new IllegalArgumentException("UNSUPPORTED_CONTENT_TYPE");
          if (response.body().length > 2097152) throw new IllegalArgumentException("BODY_BOUND");
          return new Capture(
              url.toString(),
              current.toString(),
              redirects,
              started,
              status,
              contentType,
              null,
              response.body());
        }
      }
      throw new IllegalArgumentException("REDIRECT_BOUND");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return new Capture(
          rawUrl,
          current.toString(),
          redirects,
          started,
          status,
          contentType,
          "INTERRUPTED",
          null,
          retryAt);
    } catch (Exception e) {
      return new Capture(
          rawUrl,
          current.toString(),
          redirects,
          started,
          status,
          contentType,
          e instanceof HttpTimeoutException
              ? "TIMEOUT"
              : e instanceof IllegalArgumentException ? e.getMessage() : "TRANSPORT_ERROR",
          null,
          retryAt);
    }
  }
}
