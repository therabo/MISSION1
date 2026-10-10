package org.mission1.crew.automatic;

import static org.mission1.crew.automatic.IdentityEvidence.*;

import java.util.*;

/**
 * Equality edges only. Resource references, names, rosters and context never become union edges.
 */
public final class ShadowIdentityGraph {
  public record Edge(
      String source, String candidate, IdentityPolicy.Outcome outcome, long revision) {}

  public record Component(String representative, List<String> members, List<Long> decisions) {}

  public static List<Component> project(Collection<String> keys, Collection<Edge> edges) {
    Map<String, Set<String>> groups = new TreeMap<>();
    for (var k : keys) groups.put(k, new TreeSet<>(Set.of(k)));
    for (var e : edges)
      if (e.outcome() == IdentityPolicy.Outcome.AUTO_MATCH
          && groups.containsKey(e.source())
          && groups.containsKey(e.candidate())) {
        var merged = new TreeSet<>(groups.get(e.source()));
        merged.addAll(groups.get(e.candidate()));
        for (var k : merged) groups.put(k, merged);
      }
    Set<List<String>> unique = new HashSet<>();
    List<Component> out = new ArrayList<>();
    for (var g : groups.values())
      if (unique.add(List.copyOf(g))) {
        String representative =
            g.stream()
                .filter(k -> k.startsWith("LL2:PERSON:"))
                .findFirst()
                .orElse(g.iterator().next());
        out.add(
            new Component(
                representative,
                List.copyOf(g),
                edges.stream()
                    .filter(
                        e ->
                            e.outcome() == IdentityPolicy.Outcome.AUTO_MATCH
                                && g.contains(e.source())
                                && g.contains(e.candidate()))
                    .map(Edge::revision)
                    .sorted()
                    .toList()));
      }
    return out.stream().sorted(Comparator.comparing(Component::representative)).toList();
  }

  public static List<String> validate(
      String source,
      String target,
      Map<String, IdentityEvidence> evidence,
      Collection<Edge> edges) {
    // Replace this source's old association before validating its proposed corrected association.
    var active = edges.stream().filter(e -> !e.source().equals(source)).toList();
    var proposed = new ArrayList<>(active);
    proposed.add(new Edge(source, target, IdentityPolicy.Outcome.AUTO_MATCH, 0));
    var component =
        project(evidence.keySet(), proposed).stream()
            .filter(c -> c.members().contains(source))
            .findFirst()
            .orElseThrow();
    List<String> conflicts = new ArrayList<>();
    // LL2 IDs are distinct strong catalogue identities for this incarnation, guarded
    // conservatively.
    long persons =
        component.members().stream()
            .map(evidence::get)
            .filter(Objects::nonNull)
            .filter(r -> r.provider() == Provider.LL2)
            .count();
    if (persons > 1) conflicts.add("HARD:INCOMPATIBLE_LL2_PERSON_IDS");
    for (var k : component.members()) {
      var r = evidence.get(k);
      if (r != null)
        conflicts.addAll(r.conflicts().stream().filter(x -> x.startsWith("HARD:")).toList());
    }
    for (var e : active)
      if (e.outcome() == IdentityPolicy.Outcome.AUTO_SEPARATE
          && component.members().contains(e.source())
          && component.members().contains(e.candidate()))
        conflicts.add("HARD:KNOWN_DIFFERENT_HUMANS");
    var rows =
        component.members().stream()
            .map(evidence::get)
            .filter(Objects::nonNull)
            .filter(r -> r.authoritativeDob() && r.dob() != null)
            .toList();
    if (rows.stream().map(IdentityEvidence::dob).distinct().count() > 1)
      conflicts.add("HARD:AUTHORITY_QUALIFIED_DOB");
    return conflicts.stream().distinct().sorted().toList();
  }
}
