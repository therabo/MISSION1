package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import java.time.*;
import java.util.*;
import org.mission1.crew.automatic.*;

/**
 * Pure local resolver. No JDBC, V7 relationship bits, HTTP, canonical writes or production
 * consumer.
 */
public final class OperationalResolver {
  private final FrozenIdentityModel model;
  private final OperationalPolicy policy;

  public OperationalResolver(FrozenIdentityModel model, OperationalPolicy policy) {
    this.model = model;
    this.policy = policy;
  }

  private static IdentityEvidence identity(Resource r, String name, List<String> aliases) {
    return new IdentityEvidence(
        r.providerKey() == null ? r.ref() : r.providerKey(),
        r.kind() == Kind.PROVIDER_PERSON
            ? IdentityEvidence.Provider.LL2
            : IdentityEvidence.Provider.NASA,
        r.kind() == Kind.PROVIDER_PERSON
            ? IdentityEvidence.Kind.PERSON
            : IdentityEvidence.Kind.OPERATIONAL_SUBJECT,
        name,
        aliases,
        "",
        r.agency(),
        r.dob(),
        false,
        r.selections(),
        r.missions(),
        Set.of(),
        List.of(),
        List.of(
            new IdentityEvidence.Reference(
                "s10_resource", r.ref(), r.hash(), r.locator(), r.capturedAt())));
  }

  private static double[] features(
      Subject s,
      Resource c,
      String name,
      String dob,
      Set<String> selections,
      Set<String> missions) {
    var source =
        new IdentityEvidence(
            "NASA:OPERATIONAL_SUBJECT:" + s.key(),
            IdentityEvidence.Provider.NASA,
            IdentityEvidence.Kind.OPERATIONAL_SUBJECT,
            name,
            List.of(name),
            "",
            s.agency(),
            dob,
            false,
            selections,
            missions,
            Set.of(),
            List.of(),
            List.of(
                new IdentityEvidence.Reference(
                    "crew_evidence_subject",
                    s.evidenceId() + ":" + s.index(),
                    s.evidenceHash(),
                    s.article(),
                    s.capturedAt())));
    var aliases = new ArrayList<String>(List.of(c.name()));
    aliases.addAll(c.aliases());
    var z =
        Arrays.copyOf(
            IdentityFeatures.names(
                identity(c, c.name(), aliases.stream().distinct().toList()), source),
            13);
    z[6] = s.agency() != null && s.agency().equals(c.agency()) ? 1 : 0;
    boolean precise =
        dob != null && c.dob() != null && !dob.endsWith("-01-01") && !c.dob().endsWith("-01-01");
    z[7] = precise && dob.equals(c.dob()) ? 1 : 0;
    z[8] = precise && !dob.equals(c.dob()) ? 1 : 0;
    z[9] = Collections.disjoint(selections, c.selections()) ? 0 : 1;
    z[10] = Collections.disjoint(missions, c.missions()) ? 0 : 1;
    // Research operational formulation: authority signals are hard gates, lexical/bridge=0.
    return z;
  }

  private static boolean namefit(double[] z) {
    return z[1] > .5 || z[3] > .8 && z[4] > .7 && z[5] > .7;
  }

  private static boolean flight(Resource c, Instant at, Set<String> missions) {
    return c.flights().stream()
        .anyMatch(
            f ->
                f.overlaps(at)
                    && (missions.isEmpty() || !Collections.disjoint(f.missions(), missions)));
  }

  private static Proof proof(
      Resource r, Authority a, String relation, boolean required, Instant from, Instant until) {
    String family =
        r.kind() == Kind.PROVIDER_PERSON
            ? "LL2_PROVIDER_DATASET"
            : Objects.toString(r.agency(), "NASA") + "_EDITORIAL";
    return new Proof(
        r.ref(),
        r.hash(),
        r.locator(),
        a,
        relation,
        family,
        r.capturedAt(),
        from,
        until,
        required,
        null);
  }

  public record LinkValidation(List<Resource> people, List<Proof> path, List<String> rejected) {}

  /** A same-subject HTML/topic chain ends only at a typed single-person resource. */
  public LinkValidation personalLinks(Subject s, List<Resource> resources, Instant cut) {
    var people = new ArrayList<Resource>();
    var proofs = new ArrayList<Proof>();
    var rejected = new ArrayList<String>();
    for (var anchor : s.anchors()) {
      if (anchor.url() == null
          || !OperationalNames.normalize(anchor.text())
              .equals(OperationalNames.normalize(s.name()))) {
        rejected.add("RAW_PERSONAL_URL_SCOPE_MISMATCH");
        continue;
      }
      try {
        OperationalResources.allowed(anchor.url());
      } catch (IllegalArgumentException e) {
        rejected.add("UNSUPPORTED_HOST_OR_RESOURCE");
        continue;
      }
      record Step(String url, List<Resource> path, int depth) {}
      var queue = new ArrayDeque<Step>();
      queue.add(new Step(anchor.url(), List.of(), 0));
      var visited = new HashSet<String>();
      boolean found = false;
      while (!queue.isEmpty()) {
        var step = queue.removeFirst();
        if (!visited.add(step.url()) || step.depth() > 5) continue;
        var targets =
            resources.stream()
                .filter(
                    r ->
                        r.available(cut)
                            && (r.url().equals(step.url())
                                || r.finalUrl().equals(step.url())
                                || r.links().contains(step.url()))
                            && r.kind() != Kind.NATIVE_DIRECTORY
                            && r.kind() != Kind.PROVIDER_PERSON)
                .toList();
        for (var target : targets) {
          try {
            var origin = OperationalResources.allowed(target.url());
            var end = OperationalResources.allowed(target.finalUrl());
            if (!origin.getHost().equals(end.getHost())
                || target.redirects().size() > 5
                || new HashSet<>(target.redirects()).size() != target.redirects().size())
              throw new IllegalArgumentException("UNSUPPORTED_REDIRECT");
            for (var redirect : target.redirects())
              if (!origin.getHost().equals(OperationalResources.allowed(redirect).getHost()))
                throw new IllegalArgumentException("UNSUPPORTED_REDIRECT");
          } catch (IllegalArgumentException error) {
            rejected.add("UNSUPPORTED_TARGET_OR_REDIRECT");
            continue;
          }
          if (!OperationalNames.compatible(s.name(), target.name(), false)) {
            rejected.add("TARGET_NAME_MISMATCH");
            continue;
          }
          if (target.kind() != Kind.NASA_PEOPLE
              && target.kind() != Kind.NASA_TOPIC
              && target.kind() != Kind.NASA_HTML) {
            rejected.add("TARGET_NOT_SINGLE_PERSON");
            continue;
          }
          var path = new ArrayList<>(step.path());
          path.add(target);
          if (target.kind() == Kind.NASA_PEOPLE) {
            people.add(target);
            found = true;
            for (var r : path)
              proofs.add(
                  proof(
                      r,
                      Authority.VERIFIED_OFFICIAL_PERSON_RESOURCE,
                      "SAME_SUBJECT_DOM_TO_TYPED_PERSON:" + anchor.locator(),
                      true,
                      null,
                      null));
          } else
            for (var url : target.links())
              if (!url.equals(step.url())) queue.addLast(new Step(url, path, step.depth() + 1));
        }
      }
      if (!found) rejected.add("NO_VALIDATED_SOURCE_SCOPED_PERSON_RESOURCE");
    }
    return new LinkValidation(
        people.stream().distinct().toList(),
        proofs.stream().distinct().toList(),
        rejected.stream().distinct().sorted().toList());
  }

  public Candidate compare(
      Subject s, Resource c, List<Resource> resources, Instant cut, List<String> blocks) {
    long featureStart = System.nanoTime();
    double[] raw = features(s, c, s.name(), null, Set.of(), s.missions());
    boolean fit = namefit(raw), agency = raw[6] == 1;
    boolean temporal = flight(c, s.effectiveAt(), s.missions());
    boolean explicit = !Collections.disjoint(s.missions(), c.missions());
    var proof = new ArrayList<Proof>();
    var contradictions = new ArrayList<String>();
    var links = personalLinks(s, resources, cut);
    Resource personal = null, nativePerson = null;
    boolean scoped = false;
    String enrichedName = s.name(), dob = null;
    var selections = new TreeSet<String>();
    var missions = new TreeSet<>(s.missions());
    for (var p : links.people())
      if (agency && OperationalNames.compatible(c.name(), p.name(), false)) {
        personal = p;
        proof.addAll(links.path());
        break;
      }
    if (personal == null && agency)
      for (var p : resources) {
        if (p.kind() != Kind.AGENCY_PERSON
            || !p.available(cut)
            || !Objects.equals(p.agency(), s.agency())
            || !OperationalNames.compatible(s.name(), p.name(), true)
            || !OperationalNames.compatible(c.name(), p.name(), false)) continue;
        boolean shortened =
            !OperationalNames.clean(s.name())
                .split(" ")[0]
                .equals(OperationalNames.clean(p.name()).split(" ")[0]);
        if (p.dob() == null || p.dob().endsWith("-01-01") || !p.dob().equals(c.dob())) {
          if (p.dob() != null
              && c.dob() != null
              && !p.dob().endsWith("-01-01")
              && !c.dob().endsWith("-01-01")) contradictions.add("PRECISE_AGENCY_DOB_CONFLICT");
          continue;
        }
        if (shortened && (!explicit || Collections.disjoint(p.missions(), s.missions()))) continue;
        personal = p;
        scoped = shortened;
        if (shortened) enrichedName = OperationalNames.clean(p.name());
        proof.add(
            proof(
                p,
                Authority.AGENCY_OWN_PERSON_RESOURCE,
                "AGENCY_PERSON_AND_PROVIDER_PRECISE_DOB",
                true,
                null,
                null));
        break;
      }
    var nativeMatches = new ArrayList<Resource>();
    if (agency && "RFSA".equals(s.agency()) && temporal)
      for (var p : resources) {
        if (p.kind() != Kind.NATIVE_DIRECTORY || !p.available(cut)) continue;
        var latin = OperationalNames.normalize(p.aliases().getFirst()).split(" ");
        var name = OperationalNames.normalize(c.name()).split(" ");
        double given =
            Arrays.stream(latin)
                .skip(1)
                .mapToDouble(t -> OperationalNames.jaro(name[0], t))
                .max()
                .orElse(0);
        if (Objects.equals(p.dob(), c.dob())
            && Arrays.asList(latin).contains(name[name.length - 1])
            && !Collections.disjoint(p.selections(), c.selections())
            && given >= .75) nativeMatches.add(p);
      }
    if (nativeMatches.size() == 1) {
      nativePerson = nativeMatches.getFirst();
      dob = nativePerson.dob();
      selections.addAll(nativePerson.selections());
      proof.add(
          proof(
              nativePerson,
              Authority.AGENCY_OWN_PERSON_RESOURCE,
              "NATIVE_NAME_DOB_SELECTION",
              true,
              null,
              null));
    }
    var rosters = new ArrayList<Resource>();
    if (agency && fit)
      for (var r : resources)
        if (r.kind() == Kind.NASA_MISSION
            && r.available(cut)
            && !Collections.disjoint(r.missions(), c.missions())
            && r.roster().stream().anyMatch(n -> OperationalNames.compatible(s.name(), n, false))
            && flight(c, s.effectiveAt(), r.missions())) {
          rosters.add(r);
          missions.addAll(r.missions());
          proof.add(
              proof(
                  r,
                  Authority.OFFICIAL_NAMED_MISSION_ROSTER,
                  "NAMED_MEMBER_WITH_PERSON_SPECIFIC_FLIGHT",
                  true,
                  s.effectiveAt(),
                  s.effectiveAt()));
        }
    boolean missionWitness = !rosters.isEmpty() && (s.missions().isEmpty() || explicit);
    // A paragraph's mission token alone is deliberately not an official named-roster witness.
    if (personal != null) {
      dob = personal.dob();
      selections.addAll(personal.selections());
      var pm = new TreeSet<>(personal.missions());
      pm.retainAll(c.missions());
      missions.addAll(pm);
      if (personal.dob() != null
          && c.dob() != null
          && !personal.dob().endsWith("-01-01")
          && !c.dob().endsWith("-01-01")
          && !personal.dob().equals(c.dob())) contradictions.add("PRECISE_PERSON_DOB_CONFLICT");
    }
    boolean qualified =
        agency && temporal && (personal != null || missionWitness || nativePerson != null && fit);
    if (qualified) {
      proof.add(
          proof(c, Authority.PROVIDER_STABLE_ID, "EXISTING_PROVIDER_PERSON", true, null, null));
      for (var f : c.flights())
        if (f.overlaps(s.effectiveAt())
            && (s.missions().isEmpty() || !Collections.disjoint(f.missions(), s.missions())))
          proof.add(
              proof(
                  c,
                  Authority.OFFICIAL_PERSON_FLIGHT_RELATION,
                  "PERSON_FLIGHT:" + f.id(),
                  true,
                  f.start(),
                  f.end()));
    }
    double[] z = features(s, c, enrichedName, dob, selections, missions);
    if (z[8] > .5) contradictions.add("PRECISE_DOB_CONFLICT");
    if (s.agency() != null && c.agency() != null && !agency)
      contradictions.add("SOURCE_AGENCY_CONFLICT");
    if (explicit && !temporal && !c.flights().isEmpty()) contradictions.add("FLIGHT_TIME_CONFLICT");
    var signals = new TreeMap<String, Boolean>();
    signals.put("validatedPersonalResource", personal != null);
    signals.put("inlineSameSubjectAnchor", !links.people().isEmpty());
    signals.put("officialMissionMembership", !rosters.isEmpty());
    signals.put("providerFlightMembership", temporal);
    signals.put("namedMissionFlight", missionWitness && temporal);
    signals.put("agencyCompatibility", agency);
    signals.put("qualifiedDobCompatibility", z[7] == 1);
    signals.put("sourceTypedRole", s.role() != null);
    signals.put("temporalOverlap", temporal);
    signals.put("providerNameCompatibility", fit || scoped);
    signals.put("officialSourceAlias", raw[1] == 1 && raw[0] == 0);
    signals.put("transliterationCompatibility", nativePerson != null);
    signals.put("sourceScopedShortForm", scoped);
    signals.put(
        "independentAgencyCorroboration",
        personal != null && personal.kind() == Kind.AGENCY_PERSON || nativePerson != null);
    signals.put("personalResourceCorroboration", personal != null || nativePerson != null);
    long featureNanos = System.nanoTime() - featureStart, scoreStart = System.nanoTime();
    double p = model.score(z).probability();
    return new Candidate(
        c.providerKey(),
        c.name(),
        blocks,
        raw,
        z,
        p,
        fit || scoped,
        temporal,
        qualified,
        scoped,
        signals,
        contradictions.stream().distinct().sorted().toList(),
        links.rejected(),
        proof.stream().distinct().toList(),
        featureNanos,
        System.nanoTime() - scoreStart);
  }

  public Evaluation evaluate(
      Subject s, List<Resource> resources, Instant cut, boolean inputsComplete) {
    long start = System.nanoTime();
    var providers =
        resources.stream()
            .filter(r -> r.kind() == Kind.PROVIDER_PERSON && r.available(cut))
            .toList();
    var blocked = new LinkedHashMap<Resource, List<String>>();
    for (var c : providers) {
      var blocks = new ArrayList<String>();
      var raw = features(s, c, s.name(), null, Set.of(), s.missions());
      if (namefit(raw) || OperationalNames.compatible(s.name(), c.name(), true))
        blocks.add("COMPATIBLE_NAME_OR_SCOPED_SHORT_FORM");
      if (s.agency() != null && s.agency().equals(c.agency())) blocks.add("RETAINED_AGENCY");
      if (!Collections.disjoint(s.missions(), c.missions())) blocks.add("PERSON_FLIGHT_MISSION");
      if (flight(c, s.effectiveAt(), Set.of())) blocks.add("SOURCE_TIME_FLIGHT_COHORT");
      if (!blocks.isEmpty()) blocked.put(c, blocks);
    }
    long candidateNanos = System.nanoTime() - start;
    boolean truncated =
        !inputsComplete
            || providers.size() > policy.maxPeople()
            || blocked.size() > policy.maxCandidates();
    var candidates =
        blocked.entrySet().stream()
            .limit(policy.maxCandidates())
            .map(e -> compare(s, e.getKey(), resources, cut, e.getValue()))
            .sorted(
                Comparator.comparingDouble(Candidate::probability)
                    .reversed()
                    .thenComparing(Candidate::key))
            .toList();
    if (candidates.isEmpty())
      return new Evaluation(
          s,
          Outcome.AUTO_DEFER,
          null,
          0,
          null,
          0,
          0,
          truncated,
          List.of("NO_PROVIDER_CANDIDATE"),
          candidates,
          cut,
          candidateNanos,
          System.nanoTime() - start);
    var best = candidates.getFirst();
    var runner = candidates.size() > 1 ? candidates.get(1) : null;
    double rp = runner == null ? 0 : runner.probability();
    var reasons = policy.gates(s, best, rp, !truncated, true);
    var outcome = reasons.isEmpty() ? Outcome.AUTO_MATCH : Outcome.AUTO_DEFER;
    if (!best.contradictions().isEmpty() && best.compatibleName() && best.qualifiedWitness())
      outcome = Outcome.CONFLICT;
    return new Evaluation(
        s,
        outcome,
        outcome == Outcome.AUTO_MATCH ? best.key() : null,
        best.probability(),
        runner == null ? null : runner.key(),
        rp,
        best.probability() - rp,
        truncated,
        reasons,
        candidates,
        cut,
        candidateNanos,
        System.nanoTime() - start);
  }

  /** Distinct source people colliding is a conflict. Never assign the remaining candidate. */
  public static List<Evaluation> consistent(List<Evaluation> input) {
    var owners = new HashMap<String, Set<String>>();
    for (var e : input)
      if (e.outcome() == Outcome.AUTO_MATCH)
        owners
            .computeIfAbsent(e.subject().evidenceId() + ":" + e.candidate(), k -> new HashSet<>())
            .add(e.subject().key());
    return input.stream()
        .map(
            e ->
                e.outcome() == Outcome.AUTO_MATCH
                        && owners.get(e.subject().evidenceId() + ":" + e.candidate()).size() > 1
                    ? e.conflict("DISTINCT_SOURCE_SUBJECTS_SAME_HUMAN")
                    : e)
        .toList();
  }
}
