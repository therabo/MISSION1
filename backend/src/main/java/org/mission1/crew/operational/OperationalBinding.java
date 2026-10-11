package org.mission1.crew.operational;

import java.time.Instant;
import java.util.*;

/** Source-scoped SHADOW interpretations. None of these types is a canonical identity command. */
public final class OperationalBinding {
  private OperationalBinding() {}

  public enum Outcome {
    AUTO_DEFER,
    AUTO_MATCH,
    CONFLICT,
    SUPERSEDED
  }

  public enum Authority {
    PROVIDER_STABLE_ID,
    VERIFIED_OFFICIAL_PERSON_RESOURCE,
    AGENCY_OWN_PERSON_RESOURCE,
    OFFICIAL_NAMED_MISSION_ROSTER,
    OFFICIAL_PERSON_FLIGHT_RELATION,
    OFFICIAL_EXPEDITION_RELATION,
    STRUCTURED_LL2_METADATA,
    SOURCE_TYPED_AGENCY,
    SOURCE_TYPED_ROLE,
    OFFICIAL_NAME_VARIANT,
    TRANSLITERATION_VARIANT,
    FUZZY_NAME_COMPATIBILITY
  }

  public enum Kind {
    PROVIDER_PERSON,
    NASA_PEOPLE,
    NASA_TOPIC,
    NASA_MISSION,
    NASA_HTML,
    AGENCY_PERSON,
    NATIVE_DIRECTORY,
    AGENCY_INDEX,
    UNKNOWN
  }

  public record Anchor(String text, String rawUrl, String url, String locator) {}

  public record Subject(
      String key,
      String version,
      long evidenceId,
      int index,
      long documentId,
      String evidenceHash,
      String documentHash,
      String article,
      String title,
      String name,
      String paragraph,
      String inlineHtml,
      String type,
      String assertion,
      Instant effectiveAt,
      Instant publishedAt,
      Instant capturedAt,
      String parser,
      String agency,
      String role,
      Set<String> missions,
      List<Anchor> anchors,
      boolean integrity) {
    public Subject {
      missions = Collections.unmodifiableSet(new TreeSet<>(missions));
      anchors = List.copyOf(anchors);
    }

    public String identity() {
      return key + ":" + version + ":" + evidenceHash;
    }

    public boolean departure() {
      return type.equals("PERSON_DEPARTED_STATION");
    }
  }

  public record Flight(
      String id,
      Set<String> missions,
      Instant start,
      Instant end,
      boolean launched,
      String vehicle,
      String operator) {
    public Flight {
      missions = Collections.unmodifiableSet(new TreeSet<>(missions));
    }

    public boolean overlaps(Instant at) {
      return at != null
          && launched
          && start != null
          && !at.isBefore(start)
          && (end == null || !at.isAfter(end));
    }
  }

  /** Locator/row and version identify a resource, never a global human. */
  public record Resource(
      String ref,
      String url,
      String finalUrl,
      List<String> redirects,
      String hash,
      Instant capturedAt,
      Instant validUntil,
      Kind kind,
      String agency,
      String name,
      String dob,
      Set<String> selections,
      Set<String> missions,
      List<String> aliases,
      String providerKey,
      List<Flight> flights,
      List<String> roster,
      List<String> links,
      String biography,
      String locator) {
    public Resource {
      redirects = List.copyOf(redirects);
      selections = Collections.unmodifiableSet(new TreeSet<>(selections));
      missions = Collections.unmodifiableSet(new TreeSet<>(missions));
      aliases = List.copyOf(aliases);
      flights = List.copyOf(flights);
      roster = List.copyOf(roster);
      links = List.copyOf(links);
      if (!hash.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Resource hash");
    }

    public Resource validated(long attempt, Instant at) {
      return new Resource(
          ref + ":attempt:" + attempt,
          url,
          finalUrl,
          redirects,
          hash,
          capturedAt,
          at.plus(java.time.Duration.ofDays(30)),
          kind,
          agency,
          name,
          dob,
          selections,
          missions,
          aliases,
          providerKey,
          flights,
          roster,
          links,
          biography,
          locator);
    }

    public boolean available(Instant cut) {
      return !capturedAt.isAfter(cut) && !validUntil.isBefore(cut);
    }
  }

  public record Proof(
      String resourceRef,
      String hash,
      String locator,
      Authority authority,
      String relation,
      String independenceGroup,
      Instant capturedAt,
      Instant effectiveFrom,
      Instant effectiveUntil,
      boolean required,
      String contradiction) {}

  public record Candidate(
      String key,
      String name,
      List<String> blocks,
      double[] rawFeatures,
      double[] features,
      double probability,
      boolean compatibleName,
      boolean temporal,
      boolean qualifiedWitness,
      boolean scopedVariant,
      Map<String, Boolean> signals,
      List<String> contradictions,
      List<String> linkRejects,
      List<Proof> proofs,
      long featureNanos,
      long scoreNanos) {
    public Candidate {
      blocks = List.copyOf(blocks);
      rawFeatures = rawFeatures.clone();
      features = features.clone();
      signals = Collections.unmodifiableMap(new TreeMap<>(signals));
      contradictions = List.copyOf(contradictions);
      linkRejects = List.copyOf(linkRejects);
      proofs = List.copyOf(proofs);
    }

    @Override
    public double[] rawFeatures() {
      return rawFeatures.clone();
    }

    @Override
    public double[] features() {
      return features.clone();
    }
  }

  public record Evaluation(
      Subject subject,
      Outcome outcome,
      String candidate,
      double probability,
      String runner,
      double runnerProbability,
      double margin,
      boolean truncated,
      List<String> reasons,
      List<Candidate> candidates,
      Instant cut,
      long candidateNanos,
      long totalNanos) {
    public Evaluation {
      reasons = List.copyOf(reasons);
      candidates = List.copyOf(candidates);
    }

    public Evaluation conflict(String reason) {
      return new Evaluation(
          subject,
          Outcome.CONFLICT,
          null,
          probability,
          runner,
          runnerProbability,
          margin,
          truncated,
          List.of(reason),
          candidates,
          cut,
          candidateNanos,
          totalNanos);
    }
  }
}
