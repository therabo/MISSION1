package org.mission1.crew.membership;

import java.time.*;
import java.util.*;

/** Internal shadow contracts. A source slot never acquires a human UUID. ADR-0016. */
public final class Membership {
  private Membership() {}

  public static final String PRODUCTION_MODE = "S10_SCOPED_BINDING";
  public static final String MODE = "V9_AUTOMATIC_SHADOW";

  public enum State {
    ACTIVE,
    RETAINED
  }

  public enum Freshness {
    FRESH,
    STALE,
    NO_DATA
  }

  public enum HealthState {
    HEALTHY,
    DEGRADED,
    UNAVAILABLE
  }

  public enum Type {
    LL2_ASSIGNMENT,
    NASA_EDITORIAL_ROSTER,
    NASA_OPERATIONAL_POSITIVE,
    QUALIFIED_REENTRY
  }

  public record Human(String key, UUID anchor, String name, Long profileSnapshot) {}

  public record Health(
      String stream,
      String resource,
      String outcome,
      String reason,
      Long attemptId,
      Instant attemptedAt,
      Instant lastGoodAt,
      Freshness freshness) {}

  public record Cut(
      Long ll2Run,
      Long ll2Snapshot,
      Long rosterAcquisition,
      Long roster,
      Long topicAcquisition,
      Long topicCountFact,
      Long graph,
      Long operationalRun,
      Long operationalAttempt,
      List<Long> evidence,
      List<Map<String, Object>> occurrenceChoices,
      List<Health> health,
      Map<String, Object> identityHealth) {}

  public record Assignment(
      String human,
      long snapshot,
      UUID expeditionId,
      String assignmentId,
      String expedition,
      String role,
      Instant validFrom,
      Instant validUntil,
      Instant capturedAt,
      Freshness freshness,
      boolean eligible) {}

  public record Slot(
      String key,
      String name,
      String stream,
      Long roster,
      Integer memberIndex,
      Long acquisition,
      Long evidence,
      Integer subjectIndex,
      Instant capturedAt,
      Instant effectiveAt,
      String precision,
      Integer expedition,
      Freshness freshness,
      boolean positive,
      String human,
      Long decision,
      Long observation,
      String identityState,
      List<String> fieldConflicts) {}

  public record Event(Slot slot, String type, String assertion, boolean applicable) {}

  public record Input(
      Cut cut,
      List<Human> humans,
      List<Assignment> assignments,
      List<Slot> editorial,
      List<Event> operational,
      Integer websiteCount,
      Integer officialCount,
      Integer lastKnownCount,
      boolean ll2Current,
      boolean editorialCurrent) {}

  public record Support(
      String key,
      Type type,
      String stream,
      Instant capturedAt,
      Instant effectiveAt,
      String precision,
      Freshness freshness,
      boolean eligible,
      Long snapshot,
      UUID expeditionId,
      Long acquisition,
      Long roster,
      Integer memberIndex,
      Long evidence,
      Integer subjectIndex,
      Long decision,
      Long observation,
      Long supersededByDeparture) {}

  public record Member(
      Human human,
      State state,
      List<Support> supports,
      Assignment assignment,
      String presence,
      Instant presenceEffectiveAt,
      List<Long> presenceEvidence,
      Long departureVeto,
      Instant departureAt,
      String departurePrecision,
      String reason) {}

  public record Unresolved(Slot slot, String state) {}

  public record Finding(String namespace, String code, String subject, String detail) {}

  public record Counts(
      int resolvedActiveHumans,
      int retainedHumans,
      int unresolvedActiveSlots,
      int unresolvedRetainedSlots,
      int ll2Assignments,
      int editorialSlots,
      int resolvedEditorialMemberships,
      Integer websiteReportedAboard,
      Integer operationalOfficialAboard,
      Integer lastKnownOperationalAboard) {}

  public record Result(
      Cut cut,
      String policy,
      List<Member> members,
      List<Unresolved> unresolved,
      List<Finding> findings,
      Counts counts,
      HealthState health,
      Map<String, String> consistency) {}
}
