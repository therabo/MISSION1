package org.mission1.crew.research;

import static org.mission1.crew.research.IdentityEvidence.*;

import java.util.*;

/** Bounded retrieval index, distinct from policy. A truncated block always defers. */
public final class IdentityCandidates {
  public static final int MAX_CANDIDATES = 32, MAX_IDENTITIES = 10000;

  public record Block(List<IdentityEvidence> candidates, boolean truncated) {}

  private final Map<String, List<IdentityEvidence>> names = new HashMap<>(),
      tokens = new HashMap<>(),
      missions = new HashMap<>();

  public IdentityCandidates(Collection<IdentityEvidence> inputs) {
    if (inputs.size() > MAX_IDENTITIES) throw new IllegalArgumentException("Identity index bound");
    for (var r : inputs)
      if (r.provider() == Provider.LL2) {
        for (var a : r.aliases()) {
          var t = IdentityFeatures.tokens(a).stream().map(IdentityFeatures::canonical).toList();
          names.computeIfAbsent(String.join(" ", t), k -> new ArrayList<>()).add(r);
          for (var x : t)
            if (x.length() > 2) tokens.computeIfAbsent(x, k -> new ArrayList<>()).add(r);
        }
        for (var x : r.missions()) missions.computeIfAbsent(x, k -> new ArrayList<>()).add(r);
      }
  }

  public Block retrieve(IdentityEvidence source) {
    Map<String, IdentityEvidence> found = new TreeMap<>();
    for (var a : source.aliases()) {
      var t = IdentityFeatures.tokens(a).stream().map(IdentityFeatures::canonical).toList();
      names.getOrDefault(String.join(" ", t), List.of()).forEach(r -> found.put(r.key(), r));
      for (var x : t) tokens.getOrDefault(x, List.of()).forEach(r -> found.put(r.key(), r));
    }
    for (var m : source.missions())
      missions.getOrDefault(m, List.of()).forEach(r -> found.put(r.key(), r));
    var rows =
        found.values().stream()
            .sorted(
                Comparator.<IdentityEvidence>comparingDouble(
                        r -> {
                          var z = IdentityFeatures.names(r, source);
                          return z[1] * 2 + z[3];
                        })
                    .reversed()
                    .thenComparing(IdentityEvidence::key))
            .toList();
    return new Block(rows.stream().limit(MAX_CANDIDATES).toList(), rows.size() > MAX_CANDIDATES);
  }
}
