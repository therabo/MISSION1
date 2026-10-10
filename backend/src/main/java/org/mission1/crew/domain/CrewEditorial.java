package org.mission1.crew.domain;

import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Attributed editorial facts only. A slot is not a person, assignment or presence. ADR-0014. */
public final class CrewEditorial {
  private CrewEditorial() {}

  public static final String PARSER = "nasa-editorial-roster";
  public static final String VERSION = "1";

  public enum Stream {
    NASA_EDITORIAL_TOPIC,
    NASA_EDITORIAL_EXPEDITION,
    NASA_PERSON_RESOURCE
  }

  public enum Kind {
    NASA_TOPIC,
    NASA_MISSION,
    NASA_PEOPLE_RESOURCE,
    NASA_MISSION_STATUS,
    NASA_MISSION_TARGET
  }

  public enum Outcome {
    SUCCESS,
    DEGRADED,
    FAILURE
  }

  public enum RelationStatus {
    OBSERVED_LINK,
    VERIFIED_ABOUT_PERSON_RELATION,
    REJECTED_MISMATCH
  }

  public enum CaptionKind {
    PERSONAL_FLIGHT_CAPTION,
    GENERIC_ROLE_TEXT
  }

  public record Resource(
      Kind kind,
      long wpId,
      String slug,
      URI canonicalUrl,
      String title,
      Instant publishedAt,
      Instant modifiedAt) {
    public Resource {
      Objects.requireNonNull(kind);
      Objects.requireNonNull(canonicalUrl);
      if (wpId <= 0 || slug == null || slug.isBlank() || title == null || title.length() > 1000)
        throw new IllegalArgumentException("Invalid typed NASA resource");
    }

    public String key() {
      return kind + ":" + wpId;
    }
  }

  public record Link(String text, String url) {}

  public record Mention(
      String section,
      String locator,
      String name,
      String role,
      String agency,
      String imageUrl,
      String caption,
      CaptionKind captionKind,
      List<Link> links) {
    public Mention {
      links = List.copyOf(links);
    }
  }

  public record Member(
      int index,
      String name,
      String role,
      String agency,
      List<Mention> mentions,
      List<String> conflicts) {
    public Member {
      if (index < 0 || index >= 30 || name == null || name.isBlank() || name.length() > 200)
        throw new IllegalArgumentException("Invalid roster slot");
      mentions = List.copyOf(mentions);
      conflicts = List.copyOf(conflicts);
    }

    public List<Link> links() {
      return mentions.stream().flatMap(m -> m.links().stream()).distinct().toList();
    }
  }

  public record Roster(int expedition, List<Member> members, List<String> conflicts) {
    public Roster {
      if (expedition < 1 || expedition > 999 || members.isEmpty() || members.size() > 30)
        throw new IllegalArgumentException("Invalid editorial roster");
      members = List.copyOf(members);
      conflicts = List.copyOf(conflicts);
    }
  }

  public record Stat(String kind, Integer value, String text, String locator, String error) {}

  public record TopicFacts(Stat expedition, Stat aboardCount) {}

  public record Capture(
      Stream stream,
      URI requestedUrl,
      URI finalUrl,
      List<String> redirects,
      Instant startedAt,
      Instant completedAt,
      Integer status,
      Map<String, List<String>> headers,
      byte[] body,
      String transportError) {
    public Capture {
      redirects = List.copyOf(redirects);
      headers = Map.copyOf(headers);
      body = body == null ? null : body.clone();
      if (completedAt.isBefore(startedAt))
        throw new IllegalArgumentException("Invalid capture time");
    }

    @Override
    public byte[] body() {
      return body == null ? null : body.clone();
    }

    public String header(String name) {
      return headers.entrySet().stream()
          .filter(e -> e.getKey().equalsIgnoreCase(name))
          .flatMap(e -> e.getValue().stream())
          .findFirst()
          .orElse(null);
    }
  }

  public record Relation(
      long rosterId,
      int memberIndex,
      String subjectName,
      String observedUrl,
      String locator,
      RelationStatus status,
      Resource target,
      Long acquisitionId,
      String reason) {}

  public record StoredCapture(
      long id, Long rosterId, Capture capture, Resource resource, Outcome outcome, String reason) {}

  public record StoredRoster(
      long id,
      long acquisitionId,
      Instant capturedAt,
      Resource resource,
      Roster roster,
      List<Relation> relations) {}

  public record Health(
      Stream stream,
      String resourceUrl,
      Outcome outcome,
      String reason,
      Instant lastAttemptAt,
      Instant lastGoodAt,
      Instant retryAfterAt) {}
}
