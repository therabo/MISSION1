package org.mission1.crew.operational;

import java.util.*;
import org.mission1.crew.automatic.FrozenIdentityModel;

/** Immutable SHADOW starting policy. Independent operational calibration precedes activation. */
public record OperationalPolicy(
    String version,
    double observation,
    double departure,
    double margin,
    int maxCandidates,
    int maxPeople,
    String schema,
    String scorer,
    String normalization,
    String authority) {
  public static final OperationalPolicy SHADOW =
      new OperationalPolicy(
          "s10-scoped-shadow-v1",
          .991,
          .999,
          .20,
          256,
          10000,
          "s10-research13-qualified-signals-v1",
          FrozenIdentityModel.VERSION,
          OperationalNames.VERSION,
          "s10-research-authority-matrix-v1");

  public OperationalPolicy {
    if (observation < 0
        || observation > 1
        || departure < observation
        || departure > 1
        || margin < 0
        || margin > 1
        || maxCandidates < 1
        || maxCandidates > 256
        || maxPeople < 1
        || maxPeople > 10000) throw new IllegalArgumentException("Operational policy bounds");
  }

  public double threshold(OperationalBinding.Subject s) {
    return s.departure() ? departure : observation;
  }

  public List<String> gates(
      OperationalBinding.Subject s,
      OperationalBinding.Candidate c,
      double runner,
      boolean complete,
      boolean target) {
    var reasons = new ArrayList<String>();
    if (!s.integrity()) reasons.add("SOURCE_LINEAGE_INCOMPLETE");
    if (!complete) reasons.add("CANDIDATE_SET_INCOMPLETE");
    if (!target) reasons.add("NO_PUBLISHABLE_V7_TARGET");
    if (!c.compatibleName()) reasons.add("NAME_INCOMPATIBLE");
    if (!c.qualifiedWitness()) reasons.add("MISSING_QUALIFIED_WITNESS");
    if (!c.contradictions().isEmpty()) reasons.add("AUTHORITY_CONTRADICTION");
    if (!c.temporal()) reasons.add("SOURCE_TIME_INCOMPATIBLE_OR_UNKNOWN");
    if (c.probability() < threshold(s)) reasons.add("BELOW_THRESHOLD");
    if (c.probability() - runner < margin) reasons.add("INSUFFICIENT_MARGIN");
    if (s.departure()
        && (!s.assertion().equals("COMPLETED")
            || !c.signals().getOrDefault("namedMissionFlight", false)))
      reasons.add("DEPARTURE_REQUIRES_COMPLETED_NAMED_MISSION_FLIGHT");
    if (!Set.of("PERSON_CURRENTLY_ABOARD", "PERSON_ENTERED_STATION", "PERSON_DEPARTED_STATION")
            .contains(s.type())
        || s.assertion().equals("PLANNED")) reasons.add("UNSUPPORTED_OR_PLANNED_ASSERTION");
    return List.copyOf(reasons);
  }
}
