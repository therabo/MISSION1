package org.mission1.crew.membership;

import static org.mission1.crew.membership.Membership.*;

import java.time.*;
import java.util.*;
import org.mission1.crew.application.CrewReconciliationPolicy;

/** Pure positive-support lifecycle; no identity inference, acquisition or clock reads. */
public final class ActiveMembershipPolicy {
  public static final String VERSION = "crew-active-shadow-v1";
  private final CrewReconciliationPolicy temporal;
  private final Duration rosterAge, topicAge, personalAge;

  public ActiveMembershipPolicy(
      CrewReconciliationPolicy temporal,
      Duration rosterAge,
      Duration topicAge,
      Duration personalAge) {
    this.temporal = Objects.requireNonNull(temporal);
    for (var d : List.of(rosterAge, topicAge, personalAge))
      if (d.isZero() || d.isNegative())
        throw new IllegalArgumentException("Positive stream age required");
    this.rosterAge = rosterAge;
    this.topicAge = topicAge;
    this.personalAge = personalAge;
  }

  public static ActiveMembershipPolicy defaults() {
    return new ActiveMembershipPolicy(
        CrewReconciliationPolicy.defaults(),
        Duration.ofHours(6),
        Duration.ofHours(6),
        Duration.ofDays(7));
  }

  public CrewReconciliationPolicy temporal() {
    return temporal;
  }

  public Duration rosterAge() {
    return rosterAge;
  }

  public Duration topicAge() {
    return topicAge;
  }

  public Duration personalAge() {
    return personalAge;
  }

  public String key() {
    return VERSION
        + "/"
        + temporal.key()
        + "/roster="
        + rosterAge
        + "/topic="
        + topicAge
        + "/personal="
        + personalAge;
  }

  public Freshness freshness(Instant capture, Duration age, Instant at) {
    return capture == null
        ? Freshness.NO_DATA
        : temporal.fresh(capture, age, at) ? Freshness.FRESH : Freshness.STALE;
  }

  private boolean positive(Event e) {
    return e.type().equals("PERSON_CURRENTLY_ABOARD") && !e.assertion().equals("PLANNED")
        || e.type().equals("PERSON_ENTERED_STATION") && e.assertion().equals("COMPLETED");
  }

  public Result evaluate(Input in, Instant at) {
    var members = new ArrayList<Member>();
    var unresolved = new ArrayList<Unresolved>();
    var findings =
        new TreeSet<Finding>(
            Comparator.comparing(Finding::namespace)
                .thenComparing(Finding::code)
                .thenComparing(Finding::subject)
                .thenComparing(Finding::detail));
    var assigned = new TreeSet<String>();
    var editorial = new TreeSet<String>();
    Map<String, Assignment> assignmentByHuman = new TreeMap<>();
    for (var a : in.assignments()) {
      if (assignmentByHuman.put(a.human(), a) != null)
        throw new IllegalArgumentException("Multiple selected assignments per human");
      if (a.eligible()) assigned.add(a.human());
    }
    for (var s : in.editorial()) {
      if (s.human() != null && s.positive() && s.freshness() == Freshness.FRESH)
        editorial.add(s.human());
      slotFindings(s, findings);
      if (s.human() == null)
        unresolved.add(
            new Unresolved(
                s,
                s.positive() && s.freshness() == Freshness.FRESH
                    ? "UNRESOLVED_ACTIVE_SOURCE_SLOT"
                    : "RETAINED_SOURCE_SLOT"));
    }
    for (var e : in.operational()) {
      var s = e.slot();
      slotFindings(s, findings);
      if (s.human() == null)
        unresolved.add(
            new Unresolved(
                s,
                positive(e) && e.applicable()
                    ? "UNRESOLVED_ACTIVE_SOURCE_SLOT"
                    : "RETAINED_OPERATIONAL_SLOT"));
    }
    for (var h : in.humans().stream().sorted(Comparator.comparing(Human::key)).toList()) {
      var supports = new ArrayList<Support>();
      var a = assignmentByHuman.get(h.key());
      if (a != null)
        supports.add(
            new Support(
                "assignment:" + a.snapshot() + ":" + h.key(),
                Type.LL2_ASSIGNMENT,
                "LL2_STRUCTURED_CREW",
                a.capturedAt(),
                a.validFrom(),
                a.validFrom() == null ? "UNKNOWN_PERSONAL_VALIDITY" : "SOURCE_PERSONAL_VALIDITY",
                a.freshness(),
                a.eligible(),
                a.snapshot(),
                a.expeditionId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null));
      for (var s : in.editorial())
        if (h.key().equals(s.human()))
          supports.add(
              support(
                  s, Type.NASA_EDITORIAL_ROSTER, s.positive() && s.freshness() == Freshness.FRESH));
      var events =
          in.operational().stream()
              .filter(
                  e ->
                      h.key().equals(e.slot().human())
                          && e.slot().effectiveAt() != null
                          && !e.slot().effectiveAt().isAfter(at)
                          && !e.assertion().equals("PLANNED"))
              .toList();
      var departures =
          events.stream()
              .filter(
                  e ->
                      e.type().equals("PERSON_DEPARTED_STATION")
                          && e.assertion().equals("COMPLETED"))
              .toList();
      Instant departed =
          departures.stream().map(e -> e.slot().effectiveAt()).max(Instant::compareTo).orElse(null);
      var positives = events.stream().filter(this::positive).toList();
      // A later accepted operational episode reopens membership, never a page/assignment fetch.
      boolean reentered =
          departed != null
              && positives.stream().anyMatch(e -> e.slot().effectiveAt().isAfter(departed));
      Event veto =
          departed == null || reentered
              ? null
              : departures.stream()
                  .filter(e -> e.slot().effectiveAt().equals(departed))
                  .min(Comparator.comparingLong(e -> e.slot().evidence()))
                  .orElseThrow();
      for (var e : positives)
        supports.add(
            support(
                e.slot(),
                departed != null && e.slot().effectiveAt().isAfter(departed)
                    ? Type.QUALIFIED_REENTRY
                    : Type.NASA_OPERATIONAL_POSITIVE,
                e.applicable()));
      Instant latest =
          events.stream()
              .filter(
                  e ->
                      positive(e)
                          || e.type().equals("PERSON_DEPARTED_STATION")
                              && e.assertion().equals("COMPLETED"))
              .map(e -> e.slot().effectiveAt())
              .max(Instant::compareTo)
              .orElse(null);
      var latestEvents =
          latest == null
              ? List.<Event>of()
              : events.stream()
                  .filter(
                      e ->
                          e.slot().effectiveAt().equals(latest)
                              && (positive(e)
                                  || e.type().equals("PERSON_DEPARTED_STATION")
                                      && e.assertion().equals("COMPLETED")))
                  .toList();
      boolean ambiguity =
          latestEvents.stream().anyMatch(this::positive)
              && latestEvents.stream().anyMatch(e -> e.type().equals("PERSON_DEPARTED_STATION"));
      String presence =
          latestEvents.isEmpty()
              ? "UNKNOWN"
              : ambiguity
                  ? "AMBIGUOUS"
                  : latestEvents.stream().noneMatch(Event::applicable)
                      ? "STALE"
                      : positive(latestEvents.getFirst())
                          ? "CONFIRMED_ABOARD"
                          : "CONFIRMED_NOT_ABOARD";
      if (!latestEvents.isEmpty()
          && !ambiguity
          && in.cut().health().stream()
              .anyMatch(
                  streamHealth ->
                      streamHealth.stream().equals("NASA_OPERATIONAL_FEED")
                          && !streamHealth.outcome().equals("SUCCESS"))) presence = "UNVERIFIED";
      if (ambiguity)
        findings.add(
            new Finding(
                "MEMBERSHIP",
                "AMBIGUOUS_OPERATIONAL_EPISODE",
                h.key(),
                "Equal-time positive and completed departure"));
      if (veto != null) {
        final long departureId = veto.slot().evidence();
        supports.replaceAll(
            s ->
                new Support(
                    s.key(),
                    s.type(),
                    s.stream(),
                    s.capturedAt(),
                    s.effectiveAt(),
                    s.precision(),
                    s.freshness(),
                    false,
                    s.snapshot(),
                    s.expeditionId(),
                    s.acquisition(),
                    s.roster(),
                    s.memberIndex(),
                    s.evidence(),
                    s.subjectIndex(),
                    s.decision(),
                    s.observation(),
                    departureId));
        if (a != null)
          findings.add(
              new Finding(
                  "MEMBERSHIP",
                  "DEPARTURE_OVERRIDES_ASSIGNMENT",
                  h.key(),
                  "Completed evidence:" + departureId));
        if (!supports.isEmpty())
          findings.add(
              new Finding(
                  "MEMBERSHIP",
                  "DEPARTURE_OVERRIDES_SUPPORT",
                  h.key(),
                  "Revalidation cannot reopen operational episode"));
      }
      boolean active = !ambiguity && supports.stream().anyMatch(Support::eligible);
      if (!active
          && veto == null
          && supports.stream().anyMatch(s -> s.freshness() == Freshness.STALE))
        findings.add(
            new Finding(
                "MEMBERSHIP", "STALE_ONLY_SUPPORT", h.key(), "Last-known context retained"));
      members.add(
          new Member(
              h,
              active ? State.ACTIVE : State.RETAINED,
              supports.stream().sorted(Comparator.comparing(Support::key)).toList(),
              a,
              presence,
              latest,
              latestEvents.stream().map(e -> e.slot().evidence()).distinct().sorted().toList(),
              veto == null ? null : veto.slot().evidence(),
              departed,
              veto == null ? null : veto.slot().precision(),
              active
                  ? "FRESH_POSITIVE_SUPPORT"
                  : veto != null ? "COMPLETED_DEPARTURE_VETO" : "NO_FRESH_POSITIVE_SUPPORT"));
    }
    if (in.ll2Current() && in.editorialCurrent()) {
      for (var id : editorial)
        if (!assigned.contains(id))
          findings.add(
              new Finding(
                  "MEMBERSHIP",
                  "NASA_MEMBER_NOT_IN_LL2",
                  id,
                  "Resolved positive editorial support only"));
      boolean incomplete = in.editorial().stream().anyMatch(s -> s.human() == null);
      for (var id : assigned)
        if (!editorial.contains(id))
          findings.add(
              new Finding(
                  "MEMBERSHIP",
                  incomplete ? "NASA_MEMBERSHIP_UNVERIFIED" : "LL2_MEMBER_NOT_IN_NASA",
                  id,
                  incomplete
                      ? "Unresolved NASA slots prevent a claim of omission"
                      : "No resolved NASA roster support"));
    }
    Map<String, String> consistency = new TreeMap<>();
    consistency.put(
        "editorialInternal",
        in.websiteCount() == null
            ? "UNAVAILABLE"
            : in.websiteCount() == in.editorial().size() ? "COHERENT" : "CONFLICT");
    if ("CONFLICT".equals(consistency.get("editorialInternal")))
      findings.add(
          new Finding(
              "COUNT",
              "COUNT_MISMATCH",
              "NASA_EDITORIAL_TOPIC",
              "Website:" + in.websiteCount() + ", slots:" + in.editorial().size()));
    int active = (int) members.stream().filter(m -> m.state() == State.ACTIVE).count();
    consistency.put(
        "structuredProjection",
        !in.ll2Current()
            ? "UNAVAILABLE"
            : assigned.size() == active ? "COHERENT_CARDINALITY" : "DIFFERENT_CARDINALITY");
    consistency.put(
        "membershipSets",
        !in.ll2Current() || !in.editorialCurrent()
            ? "UNAVAILABLE"
            : in.editorial().stream().anyMatch(s -> s.human() == null)
                ? "INCOMPLETE_IDENTITY_COVERAGE"
                : assigned.equals(editorial) ? "AGREEMENT" : "CONFLICT");
    consistency.put(
        "operationalCount",
        in.officialCount() == null
            ? "UNAVAILABLE"
            : in.officialCount() == active ? "COHERENT_CARDINALITY" : "CONFLICT");
    if (in.officialCount() != null && in.officialCount() != active)
      findings.add(
          new Finding(
              "COUNT",
              "COUNT_MISMATCH",
              "NASA_OPERATIONAL_FEED",
              "Official:" + in.officialCount() + ", resolved active:" + active));
    for (var h : in.cut().health())
      if (!h.outcome().equals("SUCCESS") || h.freshness() != Freshness.FRESH)
        findings.add(
            new Finding(
                "SOURCE_HEALTH",
                "SOURCE_UNAVAILABLE",
                h.stream() + ":" + h.resource(),
                h.outcome() + ":" + h.reason() + ":" + h.freshness()));
    boolean sourceUsable =
        in.ll2Current()
            || in.editorialCurrent()
            || in.operational().stream().anyMatch(e -> positive(e) && e.applicable());
    boolean identityBad = Boolean.TRUE.equals(in.cut().identityHealth().get("degraded"));
    if (identityBad)
      findings.add(
          new Finding(
              "IDENTITY",
              "RESOLVER_DEGRADED",
              "V9_IDENTITY_RESOLVER",
              "Pending, failed or incompatible retained evidence"));
    var health =
        !sourceUsable
            ? HealthState.UNAVAILABLE
            : findings.isEmpty() ? HealthState.HEALTHY : HealthState.DEGRADED;
    unresolved.sort(Comparator.comparing(u -> u.slot().key()));
    var counts =
        new Counts(
            active,
            members.size() - active,
            (int)
                unresolved.stream()
                    .filter(u -> u.state().equals("UNRESOLVED_ACTIVE_SOURCE_SLOT"))
                    .count(),
            (int)
                unresolved.stream()
                    .filter(u -> !u.state().equals("UNRESOLVED_ACTIVE_SOURCE_SLOT"))
                    .count(),
            in.assignments().size(),
            in.editorial().size(),
            editorial.size(),
            in.websiteCount(),
            in.officialCount(),
            in.lastKnownCount());
    return new Result(
        in.cut(),
        key(),
        List.copyOf(members),
        List.copyOf(unresolved),
        List.copyOf(findings),
        counts,
        health,
        Collections.unmodifiableMap(consistency));
  }

  private static Support support(Slot s, Type type, boolean eligible) {
    return new Support(
        s.key(),
        type,
        s.stream(),
        s.capturedAt(),
        s.effectiveAt(),
        s.precision(),
        s.freshness(),
        eligible,
        null,
        null,
        s.acquisition(),
        s.roster(),
        s.memberIndex(),
        s.evidence(),
        s.subjectIndex(),
        s.decision(),
        s.observation(),
        null);
  }

  private static void slotFindings(Slot s, Set<Finding> findings) {
    for (var conflict : s.fieldConflicts())
      findings.add(
          new Finding("SOURCE_FIELD", conflict, s.key(), "Retained source field conflict"));
    if (s.human() == null) {
      findings.add(new Finding("IDENTITY", "IDENTITY_DEFERRED", s.key(), s.identityState()));
      if (s.positive() && s.freshness() == Freshness.FRESH)
        findings.add(
            new Finding(
                "MEMBERSHIP",
                "UNRESOLVED_NASA_SLOT",
                s.key(),
                "No fabricated human; source slot retained separately"));
    }
  }
}
