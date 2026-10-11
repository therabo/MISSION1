package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import java.time.Instant;
import java.util.*;
import org.mission1.crew.membership.*;
import org.mission1.crew.membership.Membership.*;

/** Detached what-if calculation only. Cannot call ActiveMembershipStore or publish a projection. */
public final class OperationalShadowComparison {
  public record Differential(
      Membership.Result before, Membership.Result after, Map<String, List<String>> effects) {}

  private final ActiveMembershipPolicy policy;

  public OperationalShadowComparison(ActiveMembershipPolicy policy) {
    this.policy = policy;
  }

  public Differential compare(Input in, List<Evaluation> decisions, Instant cut) {
    var matches = new HashMap<String, Evaluation>();
    for (var e : decisions)
      if (e.outcome() == Outcome.AUTO_MATCH)
        matches.put(e.subject().evidenceId() + ":" + e.subject().index(), e);
    var events = new ArrayList<Event>();
    for (var event : in.operational()) {
      var s = event.slot();
      var e = matches.get(s.evidence() + ":" + s.subjectIndex());
      if (e == null) {
        events.add(event);
        continue;
      }
      var slot =
          new Slot(
              s.key(),
              s.name(),
              s.stream(),
              s.roster(),
              s.memberIndex(),
              s.acquisition(),
              s.evidence(),
              s.subjectIndex(),
              s.capturedAt(),
              s.effectiveAt(),
              s.precision(),
              s.expedition(),
              s.freshness(),
              s.positive(),
              e.candidate(),
              null,
              null,
              "S10_QUALIFIED_SHADOW_ONLY",
              s.fieldConflicts());
      events.add(new Event(slot, event.type(), event.assertion(), event.applicable()));
    }
    var afterInput =
        new Input(
            in.cut(),
            in.humans(),
            in.assignments(),
            in.editorial(),
            events,
            in.websiteCount(),
            in.officialCount(),
            in.lastKnownCount(),
            in.ll2Current(),
            in.editorialCurrent());
    var before = policy.evaluate(in, cut);
    var after = policy.evaluate(afterInput, cut);
    var effects = new TreeMap<String, List<String>>();
    for (var e : decisions) {
      var codes = new ArrayList<String>();
      if (e.outcome() == Outcome.AUTO_MATCH) {
        codes.add(
            e.subject().departure()
                ? "WOULD_APPLY_V10_DEPARTURE_VETO_CANDIDATE"
                : e.subject().type().equals("PERSON_ENTERED_STATION")
                    ? "WOULD_CREATE_ENTRY_SUPPORT"
                    : "WOULD_BIND_OPERATIONAL_OBSERVATION");
        var old =
            before.members().stream()
                .filter(m -> m.human().key().equals(e.candidate()))
                .findFirst();
        var next =
            after.members().stream().filter(m -> m.human().key().equals(e.candidate())).findFirst();
        if (old.map(Member::state).equals(next.map(Member::state)))
          codes.add("WOULD_NOT_CHANGE_CURRENT");
        else codes.add("WOULD_CHANGE_SHADOW_CURRENT");
        if (!old.map(Member::departureVeto).equals(next.map(Member::departureVeto)))
          codes.add("WOULD_CHANGE_SHADOW_EPISODE_VETO");
        if (!old.map(Member::presenceEffectiveAt).equals(next.map(Member::presenceEffectiveAt)))
          codes.add("WOULD_CHANGE_SHADOW_EPISODE_PRESENCE");
      } else codes.add("NO_ELIGIBLE_SHADOW_BINDING");
      effects.put(e.subject().identity(), List.copyOf(codes));
    }
    return new Differential(before, after, Collections.unmodifiableMap(effects));
  }
}
