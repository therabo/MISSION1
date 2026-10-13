package org.mission1.crew.research;

import static org.mission1.crew.research.IdentityEvidence.*;

import java.util.*;

/**
 * Probability is only one gate. Source authority, personal scope and graph safety remain explicit.
 */
public final class IdentityPolicy {
  public static final String VERSION = "balanced-0.991-margin-0.20-scoped-1";
  public static final double THRESHOLD = .991, MARGIN = .20, SEPARATE = .001;

  public enum Outcome {
    AUTO_MATCH,
    AUTO_SEPARATE,
    AUTO_DEFER
  }

  public record Result(
      Outcome outcome, List<String> witnesses, List<String> conflicts, List<String> reasons) {}

  public Result decide(
      IdentityEvidence ll2,
      IdentityEvidence nasa,
      double[] z,
      double p,
      double runner,
      List<String> componentConflicts) {
    List<String> conflicts = new ArrayList<>(componentConflicts);
    conflicts.addAll(ll2.conflicts().stream().filter(c -> c.startsWith("HARD:")).toList());
    conflicts.addAll(nasa.conflicts().stream().filter(c -> c.startsWith("HARD:")).toList());
    if (z[8] > .5 && ll2.authoritativeDob() && nasa.authoritativeDob())
      conflicts.add("HARD:AUTHORITY_QUALIFIED_DOB");
    List<String> witnesses = new ArrayList<>();
    if (z[7] > .5 && nasa.qualifications().contains(Witness.PRECISE_DOB))
      witnesses.add("PRECISE_DOB");
    if (z[9] > .5 && nasa.qualifications().contains(Witness.VALIDATED_BIOGRAPHY))
      witnesses.add("BIOGRAPHICAL_SELECTION");
    if (z[10] > .5
        && (nasa.qualifications().contains(Witness.PERSONAL_FLIGHT_CAPTION)
            || nasa.qualifications().contains(Witness.PERSON_SCOPED_HISTORY)))
      witnesses.add("PERSON_SCOPED_SHARED_FLIGHT");
    if (z[11] > .12 && nasa.qualifications().contains(Witness.VALIDATED_BIOGRAPHY))
      witnesses.add("VALIDATED_BIOGRAPHY_LEXICAL");
    boolean nameFit =
        z[1] > .5 || z[3] > .8 && z[4] > .7 && z[5] > .7 || z[7] > .5 && z[4] > .9 && z[5] > .9;
    List<String> reasons = new ArrayList<>();
    if (!conflicts.isEmpty()) reasons.add("BLOCKING_CONTRADICTION");
    if (p < THRESHOLD) reasons.add("BELOW_THRESHOLD");
    if (p < runner + MARGIN) reasons.add("AMBIGUOUS_RUNNER_UP");
    if (!nameFit) reasons.add("INCOMPATIBLE_NAME_FEATURES");
    if (witnesses.isEmpty()) reasons.add("MISSING_QUALIFIED_PERSONAL_CORROBORATION");
    Outcome outcome = reasons.isEmpty() ? Outcome.AUTO_MATCH : Outcome.AUTO_DEFER;
    // Low probability is never permanent different-human evidence. Only explicit qualified
    // exclusions.
    if (conflicts.stream()
        .anyMatch(
            c ->
                c.equals("HARD:KNOWN_DIFFERENT_HUMANS")
                    || c.equals("HARD:AUTHORITY_QUALIFIED_DOB"))) outcome = Outcome.AUTO_SEPARATE;
    return new Result(
        outcome,
        List.copyOf(witnesses),
        conflicts.stream().distinct().sorted().toList(),
        List.copyOf(reasons));
  }
}
