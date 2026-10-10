package org.mission1.crew.membership;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Explicit source-version-bound identity boundary. Never consults V7, names or profiles. */
public final class ShadowMembershipIdentity {
  public record Decision(
      long id,
      String source,
      String target,
      String outcome,
      long observation,
      JsonNode evidence,
      boolean currentHead,
      boolean inComponent) {}

  public record Binding(String human, Long decision, Long observation, String state) {}

  private final Map<String, Decision> decisions;
  private final Set<String> humans;

  public ShadowMembershipIdentity(Collection<Decision> decisions, Collection<String> humans) {
    Map<String, Decision> map = new TreeMap<>();
    for (var d : decisions)
      if (map.put(d.source(), d) != null)
        throw new IllegalArgumentException("Duplicate graph source decision");
    this.decisions = Map.copyOf(map);
    this.humans = Set.copyOf(humans);
  }

  public Binding bind(String source, String table, String referenceId, String hash) {
    var d = decisions.get(source);
    if (d == null) return new Binding(null, null, null, "NO_AUTOMATIC_DECISION");
    boolean own = false;
    for (var r : d.evidence().path("references"))
      if (table.equals(r.path("table").asText())
          && referenceId.equals(r.path("id").asText())
          && (hash == null || hash.equals(r.path("hash").asText()))) own = true;
    String state = !d.currentHead() || !own ? "SOURCE_VERSION_CHANGED" : d.outcome();
    boolean match = state.equals("AUTO_MATCH") && d.inComponent() && humans.contains(d.target());
    if (state.equals("AUTO_MATCH") && !match) state = "GRAPH_BINDING_UNAVAILABLE";
    return new Binding(match ? d.target() : null, d.id(), d.observation(), state);
  }
}
