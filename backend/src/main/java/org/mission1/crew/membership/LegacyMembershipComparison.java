package org.mission1.crew.membership;

import java.util.*;
import org.mission1.api.crew.CrewRestQueryService;
import org.mission1.crew.application.CrewIdentityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Post-materialization diagnostic only. V7 never supplies evidence to the automatic policy. */
@Service
public class LegacyMembershipComparison {
  public record Person(
      String human,
      UUID shadowAnchor,
      UUID productionCanonical,
      String name,
      String classification,
      String shadowReason) {}

  public record Report(
      long projection,
      List<Person> people,
      List<Membership.Unresolved> unresolved,
      int legacyCount,
      int shadowActiveCount) {}

  private final ActiveMembershipStore store;
  private final CrewRestQueryService legacy;
  private final CrewIdentityRepository v7;

  public LegacyMembershipComparison(
      ActiveMembershipStore store, CrewRestQueryService legacy, CrewIdentityRepository v7) {
    this.store = store;
    this.legacy = legacy;
    this.v7 = v7;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Report read() {
    var shadow = store.latest().orElseThrow(); // obtain independent persisted result first
    var current = legacy.crew();
    var identity = v7.knowledge(shadow.evaluatedAt());
    Set<UUID> publicIds = new HashSet<>();
    current.members().forEach(m -> publicIds.add(m.id()));
    var people = new ArrayList<Person>();
    for (var m : shadow.result().members()) {
      UUID canonical = identity.canonicalize(m.human().anchor());
      boolean active = m.state() == Membership.State.ACTIVE, old = publicIds.contains(canonical);
      String classification =
          active && old
              ? "ACTIVE_IN_BOTH"
              : old
                  ? "LEGACY_ONLY_RETAINED_IN_SHADOW"
                  : active ? "SHADOW_ONLY_ACTIVE" : "RETAINED_IN_SHADOW";
      people.add(
          new Person(
              m.human().key(),
              m.human().anchor(),
              canonical,
              m.human().name(),
              classification,
              m.reason()));
    }
    return new Report(
        shadow.revision(),
        List.copyOf(people),
        shadow.result().unresolved(),
        current.members().size(),
        shadow.result().counts().resolvedActiveHumans());
  }
}
