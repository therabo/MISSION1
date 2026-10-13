package org.mission1.crew.application;

import java.time.*;
import java.util.*;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewEditorial.*;
import org.springframework.transaction.annotation.*;

/** Internal persisted-input diagnostics. Candidate text agreement is never an identity decision. */
public class CrewResourceComparison {
  public enum Classification {
    MATCHED_EXISTING_CANONICAL,
    NASA_ONLY_SLOT,
    LL2_ONLY_MEMBER,
    UNRESOLVED_SLOT,
    SOURCE_FIELD_CONFLICT
  }

  public record Slot(
      String name,
      UUID canonicalId,
      Classification classification,
      String basis,
      List<String> conflicts,
      UUID nameCandidate) {}

  public record Comparison(
      Long rosterId,
      Instant capturedAt,
      int nasaSlots,
      int ll2Assignments,
      int exactNameAgreements,
      List<Slot> slots) {}

  private final CrewEditorialRepository editorial;
  private final CrewQueryService structured;
  private final CrewIdentityRepository identities;
  private final CrewReadQueryService people;
  private final Clock clock;

  public CrewResourceComparison(
      CrewEditorialRepository editorial,
      CrewQueryService structured,
      CrewIdentityRepository identities,
      CrewReadQueryService people,
      Clock clock) {
    this.editorial = editorial;
    this.structured = structured;
    this.identities = identities;
    this.people = people;
    this.clock = clock;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Comparison compare() {
    var now = clock.instant();
    var retained = editorial.latestRoster(now);
    var knowledge = identities.knowledge(now);
    var latest =
        structured.latest(CrewSource.LAUNCH_LIBRARY_2, Station.ISS).map(knowledge::project);
    List<CrewAssignment> assignments =
        latest.map(l -> l.snapshot().snapshot().assignments()).orElse(List.of());
    if (people
        .latestStructuredOutcome()
        .filter(r -> r.sourceState() == CrewSourceState.NO_ACTIVE_EXPEDITION)
        .isPresent()) assignments = List.of();
    var profiles =
        people.findPeople(assignments.stream().map(a -> a.person().mission1Id()).toList(), now);
    if (retained.isEmpty())
      return new Comparison(
          null,
          null,
          0,
          assignments.size(),
          0,
          assignments.stream()
              .map(
                  a ->
                      new Slot(
                          a.person().displayName(),
                          a.person().mission1Id(),
                          Classification.LL2_ONLY_MEMBER,
                          "LL2",
                          List.of(),
                          null))
              .toList());
    var r = retained.get();
    var slots = new ArrayList<Slot>();
    var covered = new HashSet<UUID>();
    int names = 0;
    for (var m : r.roster().members()) {
      var candidates =
          assignments.stream()
              .filter(a -> name(a.person().displayName()).equals(name(m.name())))
              .toList();
      UUID candidate = candidates.size() == 1 ? candidates.getFirst().person().mission1Id() : null;
      if (candidate != null) {
        names++;
        covered.add(candidate);
      }
      // Existing profile URLs plus reviewed typed bindings only. No name-based canonical
      // association.
      var resourceUrls =
          r.relations().stream()
              .filter(
                  x ->
                      x.memberIndex() == m.index()
                          && x.status() == RelationStatus.VERIFIED_ABOUT_PERSON_RELATION
                          && x.target() != null)
              .map(x -> x.target().canonicalUrl())
              .toList();
      var owners =
          profiles.values().stream()
              .filter(
                  p ->
                      p.officialProfileUrl() != null
                          && resourceUrls.contains(p.officialProfileUrl()))
              .map(p -> knowledge.canonicalize(p.id()))
              .distinct()
              .toList();
      var approved =
          r.relations().stream()
              .filter(
                  x ->
                      x.memberIndex() == m.index()
                          && x.status() == RelationStatus.VERIFIED_ABOUT_PERSON_RELATION
                          && x.target() != null
                          && x.target().kind() == Kind.NASA_PEOPLE_RESOURCE)
              .map(
                  x ->
                      knowledge.resolveProviderIdentity(
                          new CrewCanonicalIdentity.Key(
                              CrewSource.NASA_OFFICIAL,
                              "PERSON_PROFILE_RESOURCE",
                              "profile:" + x.target().slug())))
              .filter(Objects::nonNull)
              .distinct()
              .toList();
      UUID canonical =
          approved.size() == 1
              ? approved.getFirst()
              : owners.size() == 1 ? owners.getFirst() : null;
      var conflicts = new ArrayList<>(m.conflicts());
      if (candidates.size() == 1) {
        var a = candidates.getFirst();
        if (!name(a.sourceRoleLabel()).equals(name(m.role()))) conflicts.add("NASA_LL2_ROLE");
        var profile = profiles.get(candidate);
        if (m.agency() != null
            && profile != null
            && profile.profile() != null
            && profile.profile().agency() != null
            && !m.agency().equalsIgnoreCase(profile.profile().agency().abbreviation())
            && !name(profile.profile().agency().name()).contains(name(m.agency())))
          conflicts.add("NASA_LL2_AGENCY");
      }
      Classification status =
          canonical != null
              ? (conflicts.isEmpty()
                  ? Classification.MATCHED_EXISTING_CANONICAL
                  : Classification.SOURCE_FIELD_CONFLICT)
              : candidate != null ? Classification.UNRESOLVED_SLOT : Classification.NASA_ONLY_SLOT;
      slots.add(
          new Slot(
              m.name(),
              canonical,
              status,
              canonical != null
                  ? "EXISTING_RESOURCE_OWNER"
                  : candidate != null ? "UNIQUE_NAME_CANDIDATE_ONLY" : "NO_LL2_CANDIDATE",
              conflicts,
              candidate));
    }
    for (var a : assignments)
      if (!covered.contains(a.person().mission1Id()))
        slots.add(
            new Slot(
                a.person().displayName(),
                a.person().mission1Id(),
                Classification.LL2_ONLY_MEMBER,
                "LL2",
                List.of(),
                null));
    return new Comparison(
        r.id(),
        r.capturedAt(),
        r.roster().members().size(),
        assignments.size(),
        names,
        List.copyOf(slots));
  }

  private static String name(String value) {
    return value == null
        ? ""
        : java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFC)
            .trim()
            .replaceAll("(?U)\\s+", " ")
            .toLowerCase(Locale.ROOT);
  }
}
