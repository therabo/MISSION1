package org.mission1.replay;

import static org.mission1.api.crew.CrewRestQueryService.*;

import java.time.*;
import java.util.*;
import org.mission1.api.crew.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.crew.membership.*;

/** Read-only effective-time context for the same Crew membership lifecycle and canonical identity publication boundary. */
public final class UnifiedCrewReplay {
  private final RetainedMembershipInputs inputs;
  private final ActiveMembershipPolicy policy;
  private final CrewReadQueryService people;
  private final CrewRepository runs;
  private final CrewVerificationRepository verification;

  public UnifiedCrewReplay(
      RetainedMembershipInputs inputs,
      ActiveMembershipPolicy policy,
      CrewReadQueryService people,
      CrewRepository runs,
      CrewVerificationRepository verification) {
    this.inputs = inputs;
    this.policy = policy;
    this.people = people;
    this.runs = runs;
    this.verification = verification;
  }

  public List<ReplayCoverage.Interval> editorialIntervals(Instant knownAt) {
    return inputs.editorialCaptures(knownAt).stream()
        .map(t -> new ReplayCoverage.Interval(t, t.plus(policy.rosterAge())))
        .toList();
  }

  public CrewReplayQueryService.Result at(Instant at, Instant knownAt, ReplayCoverage coverage) {
    var input = inputs.load(at, knownAt);
    var result = policy.evaluate(input, at);
    if (!coverage.contains(at) || result.health() == Membership.HealthState.UNAVAILABLE)
      return new CrewReplayQueryService.Result(
          at,
          at,
          "UNAVAILABLE",
          "NO_DATA",
          coverage,
          "LATEST_AVAILABLE_CANONICAL_METADATA",
          null,
          List.of());
    var identity = people.identityAt(knownAt);
    var active =
        result.members().stream().filter(m -> m.state() == Membership.State.ACTIVE).toList();
    var profiles =
        people.findPeople(active.stream().map(m -> m.human().anchor()).toList(), knownAt);
    var published = new LinkedHashMap<UUID, Membership.Member>();
    var persons = new HashMap<UUID, CrewReadRepository.Person>();
    int nonPublishable = 0, collisions = 0;
    for (var m : active) {
      var p = profiles.get(m.human().anchor());
      if (p == null
          || !p.id().equals(identity.canonicalize(m.human().anchor()))
          || p.externalIds().stream()
              .noneMatch(
                  e ->
                      e.source() == CrewSource.LAUNCH_LIBRARY_2
                          && m.human().key().equals("LL2:PERSON:" + e.value()))) {
        nonPublishable++;
        continue;
      }
      if (published.putIfAbsent(p.id(), m) != null) collisions++;
      persons.put(p.id(), p);
    }
    var evidence =
        new CrewCompatibleVersionSelector()
                .select(
                    verification.evidenceAsOf(knownAt),
                    verification.occurrenceVersionsAsOf(knownAt))
                .evidence()
                .stream()
                .filter(
                    e -> {
                      var t = CrewReconciliationEngine.effectiveTime(e.value());
                      return t != null
                          && !t.isAfter(at)
                          && e.value().assertion() != CrewVerificationEvidence.Assertion.PLANNED;
                    })
                .toList();
    var byId = new HashMap<Long, CrewVerificationRepository.Evidence>();
    evidence.forEach(e -> byId.put(e.id(), e));
    CrewSourceSnapshot snapshot = null;
    if (input.ll2Current() && input.cut().ll2Snapshot() != null)
      snapshot =
          identity
              .project(
                  new CrewQueryService.Latest(
                      runs.findSnapshot(input.cut().ll2Snapshot()).orElseThrow(),
                      runs.findRun(input.cut().ll2Run()).orElseThrow()))
              .snapshot()
              .snapshot();
    final var structured = snapshot;
    var recon =
        new CrewResponses.Reconciliation(
            result.health() == Membership.HealthState.HEALTHY ? "MATCH" : "PARTIAL_MATCH",
            at,
            null,
            result.policy(),
            null,
            null,
            null);
    var members = new ArrayList<CrewResponses.Member>();
    var details = new ArrayList<CrewResponses.Person>();
    for (var entry : published.entrySet()) {
      var m = entry.getValue();
      var p = persons.get(entry.getKey());
      var profile = p.profile();
      var assertions =
          m.presenceEvidence().stream()
              .map(byId::get)
              .filter(Objects::nonNull)
              .map(e -> assertion(e.value()))
              .toList();
      boolean departureEvidence =
          assertions.stream().anyMatch(e -> e.type().equals("PERSON_DEPARTED_STATION"));
      boolean positiveEvidence =
          assertions.stream().anyMatch(e -> !e.type().equals("PERSON_DEPARTED_STATION"));
      String lastKnown =
          assertions.isEmpty()
              ? null
              : departureEvidence && positiveEvidence
                  ? "AMBIGUOUS"
                  : departureEvidence ? "CONFIRMED_NOT_ABOARD" : "CONFIRMED_ABOARD";
      var presence =
          new CrewResponses.Presence(
              m.presence(),
              lastKnown,
              m.presenceEffectiveAt(),
              assertions.isEmpty() ? null : "NASA_OFFICIAL",
              assertions);
      var a = m.assignment();
      var sourceAssignment =
          structured == null
              ? null
              : structured.assignments().stream()
                  .filter(x -> x.person().mission1Id().equals(p.id()))
                  .findFirst()
                  .orElse(null);
      var assignment =
          a == null || !a.eligible()
              ? null
              : new CrewResponses.Assignment(
                  a.expeditionId(),
                  sourceAssignment == null ? a.role() : sourceAssignment.sourceRoleLabel(),
                  a.role(),
                  a.validFrom(),
                  a.validUntil());
      var metadata =
          CrewCanonicalProfileMetadata.describe(
              p,
              p.id(),
              identity,
              structured == null
                  ? null
                  : structured.assignments().stream()
                      .filter(x -> x.person().mission1Id().equals(p.id()))
                      .map(CrewAssignment::observation)
                      .findFirst()
                      .orElse(null),
              assertions);
      var agency = profile == null ? null : agency(profile.agency());
      var nations = profile == null ? List.<CrewResponses.Nationality>of() : nationalities(profile);
      var media = profile == null ? null : media(profile.media());
      members.add(
          new CrewResponses.Member(
              p.id(),
              p.name(),
              agency,
              nations,
              media,
              assignment,
              presence,
              externalIds(p.externalIds()),
              metadata));
      details.add(
          new CrewResponses.Person(
              p.id(),
              p.name(),
              p.officialProfileUrl(),
              externalIds(p.externalIds()),
              agency,
              nations,
              profile == null ? null : profile.biography(),
              media,
              profile == null ? null : career(profile.career()),
              profile == null ? "UNAVAILABLE" : "AVAILABLE",
              assignment,
              presence,
              recon,
              profile == null ? null : observation(profile.observation()),
              p.profileFetchedAt(),
              metadata));
    }
    members.sort(
        Comparator.comparing(CrewResponses.Member::name).thenComparing(m -> m.id().toString()));
    var unresolved =
        result.unresolved().stream()
            .filter(u -> u.slot().evidence() != null && byId.containsKey(u.slot().evidence()))
            .map(
                u ->
                    new CrewResponses.UnresolvedSubject(
                        u.slot().name(),
                        u.slot().identityState().contains("CONFLICT") ? "AMBIGUOUS" : "UNRESOLVED",
                        assertion(byId.get(u.slot().evidence()).value()),
                        u.slot().freshness() == Membership.Freshness.FRESH))
            .toList();
    var counts =
        new CrewResponses.Counts(
            input.officialCount(),
            input.lastKnownCount(),
            (int)
                members.stream()
                    .filter(m -> m.presence().state().equals("CONFIRMED_ABOARD"))
                    .count(),
            unresolved.size(),
            0,
            input.ll2Current() ? input.assignments().size() : null);
    var metadata =
        new CrewResponses.MembershipProjection(
            "UNIFIED_HISTORICAL",
            0,
            at,
            result.policy(),
            result.health().name(),
            0,
            members.size(),
            nonPublishable,
            collisions,
            result.counts().unresolvedActiveSlots());
    var state =
        new CrewResponses.Crew(
            new CrewResponses.Station("ISS", "International Space Station"),
            expedition(snapshot),
            counts,
            members,
            unresolved,
            recon,
            new CrewResponses.Freshness(
                at,
                health(input, "LL2_STRUCTURED_CREW", "LAUNCH_LIBRARY_2"),
                health(input, "NASA_OPERATIONAL_FEED", "NASA_OFFICIAL"),
                false),
            new CrewResponses.Provenance(
                snapshot == null ? null : observation(snapshot.observation()),
                null,
                evidence.stream().map(e -> assertion(e.value())).distinct().toList()),
            metadata);
    return new CrewReplayQueryService.Result(
        at,
        at,
        "PARTIAL",
        "PARTIAL",
        coverage,
        "LATEST_AVAILABLE_CANONICAL_METADATA; MEMBERSHIP_LIFECYCLE_AT_REQUESTED_TIME; OPERATIONAL_BINDING_KNOWLEDGE_TODAY",
        state,
        List.copyOf(details));
  }

  private static CrewResponses.SourceHealth health(
      Membership.Input input, String stream, String source) {
    var h =
        input.cut().health().stream()
            .filter(x -> x.stream().equals(stream))
            .findFirst()
            .orElse(null);
    return new CrewResponses.SourceHealth(
        source,
        h == null ? "UNAVAILABLE" : h.reason(),
        h == null ? null : h.attemptedAt(),
        h == null ? null : h.outcome(),
        h == null ? null : h.lastGoodAt(),
        null,
        false,
        false,
        null,
        h == null || h.freshness() != Membership.Freshness.FRESH);
  }
}
