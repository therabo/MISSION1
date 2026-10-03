package org.mission1.source.crew.ll2;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;

import org.mission1.crew.application.CrewEventSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

/** Verified LL2 /events/ contract; no enrichment, vehicle-name heuristics or presence inference. */
public final class LaunchLibrary2CrewEventSource implements CrewEventSource {
    public static final String VERSION = "ll2-crew-events-v1";
    private final CrewHttpReader http;
    private final URI base;
    private final int station;
    private final JsonMapper json =
            JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();

    public LaunchLibrary2CrewEventSource(CrewHttpReader http, URI base, int station) {
        this.http = Objects.requireNonNull(http);
        this.base = Objects.requireNonNull(base);
        if (!base.isAbsolute()
                || base.getHost() == null
                || !base.getPath().endsWith("/2.3.0/")
                || base.getQuery() != null
                || base.getFragment() != null
                || station < 1)
            throw new IllegalArgumentException(
                    "LL2 2.3.0 base and verified station mapping required");
        this.station = station;
    }

    @Override
    public Request request(Instant now) {
        var from = now.minus(Duration.ofDays(2));
        var until = now.plus(Duration.ofDays(30));
        return new Request(
                base.resolve(
                        "events/?spacestation__ids="
                                + station
                                + "&type__ids=2%2C8&date__gte="
                                + encode(from)
                                + "&date__lte="
                                + encode(until)
                                + "&mode=detailed&ordering=date&limit=20"),
                from,
                until);
    }

    @Override
    public CrewSourceResult<Catalog> fetch(Request request) {
        var f =
                http.fetch(
                        request.url(),
                        CrewSource.LAUNCH_LIBRARY_2,
                        "application/json",
                        "2.3.0",
                        VERSION);
        if (f.failure() != null)
            return new CrewSourceResult<>(
                    f.state(), null, f.observation(), f.failure(), f.httpStatus());
        try {
            var page = json.readTree(f.value());
            var rows = page.get("results");
            if (!page.path("count").isIntegralNumber()
                    || !page.path("count").canConvertToInt()
                    || page.path("count").intValue() < 0
                    || !page.has("next")
                    || !page.get("next").isNull()
                    || rows == null
                    || !rows.isArray()
                    || rows.size() > 20
                    || page.path("count").intValue() != rows.size())
                throw new IllegalArgumentException("Incomplete bounded calendar");
            List<CrewOperationalEvent> events = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (var row : rows) {
                String id = id(row.get("id"));
                if (!seen.add(id) || !"detailed".equals(text(row.get("response_mode"))))
                    throw new IllegalArgumentException("Duplicate or wrong representation");
                URI url = URI.create(text(row.get("url")));
                if (!url.equals(base.resolve("events/" + id + "/")))
                    throw new IllegalArgumentException("Wrong event identity URL");
                var stations = ids(row.get("spacestations"), false);
                if (!stations.contains(Integer.toString(station)))
                    throw new IllegalArgumentException("Wrong station");
                String type = id(row.path("type").get("id"));
                var kind =
                        switch (type) {
                            case "2" -> CrewOperationalEvent.Kind.DOCKING;
                            case "8" -> CrewOperationalEvent.Kind.UNDOCKING;
                            default -> throw new IllegalArgumentException("Unrequested event type");
                        };
                Instant scheduled = instant(row.get("date"));
                if (scheduled != null
                        && (scheduled.isBefore(request.from())
                                || scheduled.isAfter(request.until())))
                    throw new IllegalArgumentException("Event outside requested UTC coverage");
                String precision =
                        row.path("date_precision").isObject()
                                ? text(row.path("date_precision").get("name"))
                                : null;
                var astronauts = ids(row.get("astronauts"), false);
                var launches = ids(row.get("launches"), true);
                // Launch IDs are UUIDs, unlike integer event/astronaut IDs.
                events.add(
                        new CrewOperationalEvent(
                                id,
                                url,
                                kind,
                                scheduled,
                                precision,
                                instant(row.get("last_updated")),
                                astronauts.isEmpty()
                                        ? CrewOperationalEvent.Relevance.UNKNOWN
                                        : CrewOperationalEvent.Relevance.CREWED,
                                CrewOperationalEvent.Status.UNKNOWN,
                                astronauts,
                                launches));
            }
            return new CrewSourceResult<>(
                    CrewSourceState.AVAILABLE,
                    new Catalog(events, f.value()),
                    f.observation(),
                    null,
                    f.httpStatus());
        } catch (java.io.IOException
                | IllegalArgumentException
                | java.time.DateTimeException
                | NullPointerException e) {
            return CrewHttpReader.failed(
                    CrewSourceState.MALFORMED_RESPONSE,
                    CrewSourceResult.FailureCode.INVALID_RESPONSE,
                    f.httpStatus(),
                    null,
                    f.observation());
        }
    }

    private static String encode(Instant at) {
        return URLEncoder.encode(at.toString(), StandardCharsets.UTF_8);
    }

    private static String id(JsonNode n) {
        if (n == null || !n.isIntegralNumber() || !n.canConvertToLong() || n.longValue() < 1)
            throw new IllegalArgumentException("Positive source ID required");
        return n.asText();
    }

    private static List<String> ids(JsonNode n, boolean uuid) {
        if (n == null || !n.isArray())
            throw new IllegalArgumentException("Explicit relation array required");
        Set<String> out = new LinkedHashSet<>();
        for (var item : n) {
            JsonNode v = item.get("id");
            String id;
            if (uuid) {
                if (v == null || !v.isTextual())
                    throw new IllegalArgumentException("UUID launch relation required");
                id = v.textValue();
                UUID.fromString(id);
            } else id = id(v);
            if (!out.add(id)) throw new IllegalArgumentException("Duplicate relation");
        }
        return List.copyOf(out);
    }

    private static String text(JsonNode n) {
        if (n == null || !n.isTextual() || n.textValue().isBlank())
            throw new IllegalArgumentException("Text required");
        return n.textValue();
    }

    private static Instant instant(JsonNode n) {
        return n == null || n.isNull() ? null : Instant.parse(text(n));
    }
}
