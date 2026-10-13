package org.mission1.crew.research;

import java.time.Instant;
import java.util.*;

/** Unfused source facts. Keys denote resources/mentions, never a public canonical human. */
public record IdentityEvidence(
    String key,
    Provider provider,
    Kind kind,
    String name,
    List<String> aliases,
    String biography,
    String agency,
    String dob,
    boolean authoritativeDob,
    Set<String> selections,
    Set<String> missions,
    Set<Witness> qualifications,
    List<String> conflicts,
    List<Reference> references) {
  public enum Provider {
    LL2,
    NASA
  }

  public enum Kind {
    PERSON,
    EDITORIAL_SLOT,
    OPERATIONAL_SUBJECT,
    PERSONAL_RESOURCE
  }

  public enum Witness {
    VALIDATED_BIOGRAPHY,
    TYPED_PEOPLE_RELATION,
    PERSONAL_FLIGHT_CAPTION,
    PERSON_SCOPED_HISTORY,
    NATIVE_NAME_FACTS,
    PRECISE_DOB
  }

  public record Reference(
      String table, String id, String hash, String locator, Instant capturedAt) {
    public Reference {
      Objects.requireNonNull(table);
      Objects.requireNonNull(id);
      Objects.requireNonNull(locator);
      if (hash == null || !hash.matches("[0-9a-f]{64}"))
        throw new IllegalArgumentException("Evidence hash");
      Objects.requireNonNull(capturedAt);
    }
  }

  public IdentityEvidence {
    Objects.requireNonNull(provider);
    Objects.requireNonNull(kind);
    if (key == null
        || key.isBlank()
        || key.length() > 240
        || name == null
        || name.isBlank()
        || name.length() > 200
        || biography == null
        || biography.length() > 100000
        || aliases.size() > 16
        || references.isEmpty()
        || references.size() > 128)
      throw new IllegalArgumentException("Bounded identity source facts required");
    aliases = List.copyOf(aliases);
    selections = Collections.unmodifiableSet(new TreeSet<>(selections));
    missions = Collections.unmodifiableSet(new TreeSet<>(missions));
    qualifications = Collections.unmodifiableSet(new TreeSet<>(qualifications));
    conflicts = conflicts.stream().distinct().sorted().toList();
    references = List.copyOf(references);
    if (provider == Provider.LL2 && kind != Kind.PERSON)
      throw new IllegalArgumentException("LL2 person kind");
  }
}
