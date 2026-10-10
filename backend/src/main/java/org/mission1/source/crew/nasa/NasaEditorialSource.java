package org.mission1.source.crew.nasa;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial.*;

/**
 * Generic source-directed discovery and explicit linked-resource acquisition. No person resolver.
 */
public final class NasaEditorialSource {
  @FunctionalInterface
  public interface Transport {
    Capture fetch(Stream stream, URI url, StoredCapture cached);
  }

  public record Result(
      Long rosterId,
      Integer expedition,
      Integer websiteCount,
      int members,
      int requests,
      String outcome) {}

  private final Transport http;
  private final CrewEditorialRepository repository;
  private final NasaEditorialParser parser;
  private final Clock clock;
  private final URI canonicalTopic;
  private int requests;

  public NasaEditorialSource(
      Transport http,
      CrewEditorialRepository repository,
      NasaEditorialParser parser,
      Clock clock,
      URI canonicalTopic) {
    this.http = http;
    this.repository = repository;
    this.parser = parser;
    this.clock = clock;
    this.canonicalTopic = NasaEditorialParser.nasaUrl(canonicalTopic.toString());
  }

  private record Parsed(
      Resource resource, Roster roster, TopicFacts facts, Outcome outcome, String reason) {
    static Parsed plain(String reason) {
      return new Parsed(null, null, null, Outcome.SUCCESS, reason);
    }
  }

  private StoredCapture get(Stream stream, URI url, Duration ttl, Function<Capture, Parsed> parse) {
    var good = repository.latest(stream, url, true);
    if (ttl != null
        && good.isPresent()
        && !good.get().capture().completedAt().plus(ttl).isBefore(clock.instant())) {
      try {
        parse.apply(good.get().capture());
        return good.get();
      } catch (IllegalArgumentException incompatibleContext) {
        /* changed topic N forces fresh discovery */
      }
    }
    var last = repository.latest(stream, url, false);
    if (last.isPresent() && last.get().outcome() == Outcome.FAILURE) {
      Instant until =
          last.get().capture().status() != null && last.get().capture().status() == 429
              ? NasaRequestGate.retryAfter(
                  last.get().capture().header("Retry-After"), last.get().capture().completedAt())
              : last.get()
                  .capture()
                  .completedAt()
                  .plusSeconds(
                      stream == Stream.NASA_PERSON_RESOURCE
                              && Integer.valueOf(404).equals(last.get().capture().status())
                          ? 21600
                          : 900);
      if (until.isAfter(clock.instant())) throw NasaEditorialParser.invalid("RESOURCE_BACKOFF");
    }
    requests++;
    Capture c = http.fetch(stream, url, good.orElse(null));
    Parsed p;
    try {
      if (c.transportError() != null) throw NasaEditorialParser.invalid(c.transportError());
      if (c.status() == null || (c.status() != 200 && c.status() != 304))
        throw NasaEditorialParser.invalid("HTTP_" + c.status());
      String type = c.header("Content-Type");
      if (type == null
          || (!type.toLowerCase(Locale.ROOT).contains("json")
              && !type.toLowerCase(Locale.ROOT).contains("html")))
        throw NasaEditorialParser.invalid("CONTENT_TYPE");
      if (url.getPath().startsWith("/wp-json/") && !type.toLowerCase(Locale.ROOT).contains("json"))
        throw NasaEditorialParser.invalid("REST_CONTENT_TYPE");
      p = parse.apply(c);
    } catch (IllegalArgumentException e) {
      p = new Parsed(null, null, null, Outcome.FAILURE, e.getMessage());
    }
    var stored = repository.retain(c, p.resource(), p.roster(), p.facts(), p.outcome(), p.reason());
    if (p.outcome() == Outcome.FAILURE) throw NasaEditorialParser.invalid(p.reason());
    return stored;
  }

  /** Explicit writer boundary; scheduler serializes routine calls. */
  public synchronized Result acquire() {
    requests = 0;
    Integer number = null, count = null;
    try {
      var html =
          get(
              Stream.NASA_EDITORIAL_TOPIC,
              canonicalTopic,
              Duration.ofHours(6),
              c -> {
                parser.advertised(c.body(), canonicalTopic, "topic");
                return Parsed.plain("VERIFIED_CANONICAL_TOPIC_HTML");
              });
      URI topicApi = parser.advertised(html.capture().body(), canonicalTopic, "topic");
      var topic =
          get(
              Stream.NASA_EDITORIAL_TOPIC,
              topicApi,
              null,
              c -> {
                var n = parser.json(c.body());
                var r = parser.resource(n, Kind.NASA_TOPIC);
                if (!topicApi.getPath().endsWith("/" + r.wpId()))
                  throw NasaEditorialParser.invalid("ADVERTISED_ID_MISMATCH");
                var facts = parser.topic(n, r, canonicalTopic);
                // A valid field survives an independent field error.
                return new Parsed(
                    r,
                    null,
                    facts,
                    facts.expedition().error() != null || facts.aboardCount().error() != null
                        ? Outcome.DEGRADED
                        : Outcome.SUCCESS,
                    facts.expedition().error() != null
                        ? "EXPEDITION_" + facts.expedition().error()
                        : facts.aboardCount().error() != null
                            ? "COUNT_" + facts.aboardCount().error()
                            : "VALID_TOPIC_FACTS");
              });
      var facts =
          parser.topic(parser.json(topic.capture().body()), topic.resource(), canonicalTopic);
      number = facts.expedition().value();
      count = facts.aboardCount().value();
      if (number == null) return blocked(null, count, "INVALID_TOPIC_EXPEDITION");
      var active = term(Kind.NASA_MISSION_STATUS, "mission-status", "active", "Active");
      var iss =
          term(
              Kind.NASA_MISSION_TARGET,
              "mission-target",
              "international-space-station",
              "International Space Station");
      final int n = number;
      final Integer reported = count;
      URI broad =
          URI.create(
              NasaEditorialParser.API
                  + "mission?mission-status="
                  + active.wpId()
                  + "&mission-target="
                  + iss.wpId()
                  + "&search=Expedition&per_page=100");
      var discovery =
          get(
              Stream.NASA_EDITORIAL_EXPEDITION,
              broad,
              Duration.ofHours(6),
              c -> {
                JsonNode list = parser.json(c.body());
                if (!list.isArray() || list.size() > 100)
                  throw NasaEditorialParser.invalid("DISCOVERY_SCHEMA");
                for (var item : list)
                  if (item.path("slug").asText().matches("expedition-[0-9]+")) {
                    var r = parser.resource(item, Kind.NASA_MISSION);
                    if (!r.slug().equals("expedition-" + n))
                      throw NasaEditorialParser.invalid("MULTIPLE_ACTIVE_EXPEDITIONS");
                    parser.mission(
                        parser.json(
                            ("[" + item + "]").getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                        n,
                        active,
                        iss);
                  }
                boolean complete =
                    String.valueOf(list.size()).equals(c.header("X-WP-Total"))
                        && "1".equals(c.header("X-WP-TotalPages"));
                return new Parsed(
                    null,
                    null,
                    null,
                    complete ? Outcome.SUCCESS : Outcome.DEGRADED,
                    complete ? "BOUNDED_DISCOVERY" : "DISCOVERY_COVERAGE_UNKNOWN");
              });
      URI exact =
          URI.create(
              NasaEditorialParser.API
                  + "mission?slug=expedition-"
                  + n
                  + "&mission-status="
                  + active.wpId()
                  + "&mission-target="
                  + iss.wpId()
                  + "&per_page=100");
      var mission =
          get(
              Stream.NASA_EDITORIAL_EXPEDITION,
              exact,
              null,
              c -> {
                if (!"1".equals(c.header("X-WP-Total")) || !"1".equals(c.header("X-WP-TotalPages")))
                  throw NasaEditorialParser.invalid("EXACT_DISCOVERY_TOTAL_CONFLICT");
                JsonNode m = parser.mission(parser.json(c.body()), n, active, iss);
                var r = parser.resource(m, Kind.NASA_MISSION);
                var roster = parser.roster(m, n);
                boolean countConflict = reported != null && reported != roster.members().size();
                // Cross-resource count consistency belongs to this acquisition, not mission
                // meaning.
                boolean degraded =
                    countConflict
                        || !roster.conflicts().isEmpty()
                        || discovery.outcome() == Outcome.DEGRADED;
                return new Parsed(
                    r,
                    roster,
                    null,
                    degraded ? Outcome.DEGRADED : Outcome.SUCCESS,
                    countConflict
                        ? "TOPIC_COUNT_ROSTER_MISMATCH:reported="
                            + reported
                            + ",roster="
                            + roster.members().size()
                        : degraded ? "VALID_ROSTER_WITH_ATTRIBUTED_CONFLICTS" : "VALID_ROSTER");
              });
      // Use this capture's slots even if another explicit writer completed a newer capture.
      var capturedRoster =
          parser.roster(parser.mission(parser.json(mission.capture().body()), n, active, iss), n);
      var selected =
          new StoredRoster(
              mission.rosterId(),
              mission.id(),
              mission.capture().completedAt(),
              mission.resource(),
              capturedRoster,
              List.of());
      // Profiles cannot invalidate a retained mission roster or its health.
      int personal = 0;
      for (Member member : selected.roster().members())
        for (Link link : member.links()) {
          repository.retainRelation(
              new Relation(
                  selected.id(),
                  member.index(),
                  member.name(),
                  link.url(),
                  locator(member, link),
                  RelationStatus.OBSERVED_LINK,
                  null,
                  null,
                  "SOURCE_ANCHOR_ONLY"));
          if (!personalPath(link.url())) continue;
          if (++personal > 6) continue;
          personal(selected.id(), member, link);
        }
      return new Result(
          mission.rosterId(),
          number,
          count,
          selected.roster().members().size(),
          requests,
          mission.outcome().name());
    } catch (IllegalArgumentException e) {
      return blocked(number, count, e.getMessage());
    }
  }

  private Result blocked(Integer number, Integer count, String reason) {
    // Topic/taxonomy failures belong to their original resource; this records blocked mission
    // discovery independently.
    var c =
        new Capture(
            Stream.NASA_EDITORIAL_EXPEDITION,
            URI.create(NasaEditorialParser.API + "mission"),
            URI.create(NasaEditorialParser.API + "mission"),
            List.of(),
            clock.instant(),
            clock.instant(),
            null,
            Map.of(),
            null,
            null);
    repository.retain(c, null, null, null, Outcome.FAILURE, "BLOCKED_" + reason);
    return new Result(null, number, count, 0, requests, "FAILURE:" + reason);
  }

  private Resource term(Kind kind, String route, String slug, String name) {
    var url = URI.create(NasaEditorialParser.API + route + "?slug=" + slug + "&per_page=100");
    return get(
            Stream.NASA_EDITORIAL_EXPEDITION,
            url,
            Duration.ofDays(7),
            c ->
                new Parsed(
                    parser.taxonomy(parser.json(c.body()), kind, slug, name),
                    null,
                    null,
                    Outcome.SUCCESS,
                    "VALIDATED_TAXONOMY"))
        .resource();
  }

  private static boolean personalPath(String url) {
    try {
      var u = NasaEditorialParser.nasaUrl(url);
      return u.getPath().startsWith("/people/")
          || u.getPath().startsWith("/humans-in-space/astronauts/");
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private StoredCapture personResource(URI url, Kind kind, String subject) {
    String type = kind == Kind.NASA_TOPIC ? "topic" : "people";
    var html =
        get(
            Stream.NASA_PERSON_RESOURCE,
            url,
            Duration.ofDays(7),
            c -> {
              parser.advertised(c.body(), c.finalUrl(), type);
              return Parsed.plain("PERSON_RESOURCE_HTML");
            });
    URI api = parser.advertised(html.capture().body(), html.capture().finalUrl(), type);
    // Successful transport cache is reused; subject compatibility is checked for EACH relation
    // below.
    return get(
        Stream.NASA_PERSON_RESOURCE,
        api,
        Duration.ofDays(7),
        c -> {
          var r = parser.resource(parser.json(c.body()), kind);
          if (!r.canonicalUrl().equals(html.capture().finalUrl())
              || !api.getPath().endsWith("/" + r.wpId()))
            throw NasaEditorialParser.invalid("PERSON_RESOURCE_CANONICAL_MISMATCH");
          return new Parsed(r, null, null, Outcome.SUCCESS, "VALID_TYPED_PERSON_RESOURCE");
        });
  }

  private void personal(long rosterId, Member member, Link link) {
    StoredCapture target = null;
    try {
      URI url = NasaEditorialParser.nasaUrl(link.url());
      Kind kind =
          url.getPath().startsWith("/people/") ? Kind.NASA_PEOPLE_RESOURCE : Kind.NASA_TOPIC;
      target = personResource(url, kind, member.name());
      if (!parser.about(target.resource(), member.name())) {
        relation(
            rosterId,
            member,
            link,
            RelationStatus.REJECTED_MISMATCH,
            target,
            "TARGET_ABOUT_DIFFERENT_PERSON");
        return;
      }
      relation(
          rosterId,
          member,
          link,
          RelationStatus.VERIFIED_ABOUT_PERSON_RELATION,
          target,
          "EXPLICIT_LINK_ABOUT_NAMED_SUBJECT");
      if (kind == Kind.NASA_TOPIC) {
        URI bio = parser.biography(parser.json(target.capture().body()));
        if (bio != null) {
          var people = personResource(bio, Kind.NASA_PEOPLE_RESOURCE, member.name());
          relation(
              rosterId,
              member,
              new Link("Biography", bio.toString()),
              parser.about(people.resource(), member.name())
                  ? RelationStatus.VERIFIED_ABOUT_PERSON_RELATION
                  : RelationStatus.REJECTED_MISMATCH,
              people,
              parser.about(people.resource(), member.name())
                  ? "TOPIC_BIOGRAPHY_ABOUT_NAMED_SUBJECT"
                  : "BIOGRAPHY_ABOUT_DIFFERENT_PERSON",
              "NASA_TOPIC:"
                  + target.resource().wpId()
                  + "@acquisition:"
                  + target.id()
                  + "/content/rendered:Biography");
        }
      }
    } catch (IllegalArgumentException e) {
      relation(
          rosterId,
          member,
          link,
          RelationStatus.OBSERVED_LINK,
          target,
          "UNVERIFIED_" + e.getMessage());
    }
  }

  private void relation(
      long roster, Member m, Link l, RelationStatus status, StoredCapture target, String reason) {
    relation(roster, m, l, status, target, reason, locator(m, l));
  }

  private static String locator(Member m, Link l) {
    return m.mentions().stream()
        .filter(x -> x.links().contains(l))
        .map(Mention::locator)
        .findFirst()
        .orElse(m.mentions().getFirst().locator());
  }

  private void relation(
      long roster,
      Member m,
      Link l,
      RelationStatus status,
      StoredCapture target,
      String reason,
      String locator) {
    repository.retainRelation(
        new Relation(
            roster,
            m.index(),
            m.name(),
            l.url(),
            locator,
            status,
            target == null ? null : target.resource(),
            target == null ? null : target.id(),
            reason));
  }
}
