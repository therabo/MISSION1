package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.mission1.crew.automatic.FrozenIdentityModel;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.nasa.OperationalResourceHttp;

/** Durable coalesced evaluation and separately bounded acquisition; neither is on any GET path. */
public final class OperationalBindingWorker {
  private final OperationalBindingStore store;
  private final RetainedOperationalInputs inputs;
  private final RetainedMembershipInputs membership;
  private final OperationalShadowComparison comparison;
  private final OperationalResolver resolver;
  private final OperationalPolicy release;
  private final Clock clock;
  private final OperationalResourceHttp http;
  private final List<String> agencySeeds;

  public OperationalBindingWorker(
      OperationalBindingStore store,
      RetainedOperationalInputs inputs,
      RetainedMembershipInputs membership,
      ActiveMembershipPolicy membershipPolicy,
      ObjectMapper json,
      Clock clock,
      OperationalResourceHttp http,
      List<String> agencySeeds) {
    this(
        store,
        inputs,
        membership,
        membershipPolicy,
        json,
        clock,
        http,
        agencySeeds,
        OperationalPolicy.SHADOW);
  }

  public OperationalBindingWorker(
      OperationalBindingStore store,
      RetainedOperationalInputs inputs,
      RetainedMembershipInputs membership,
      ActiveMembershipPolicy membershipPolicy,
      ObjectMapper json,
      Clock clock,
      OperationalResourceHttp http,
      List<String> agencySeeds,
      OperationalPolicy release) {
    this.release = release;
    this.store = store;
    this.inputs = inputs;
    this.membership = membership;
    this.clock = clock;
    this.http = http;
    comparison = new OperationalShadowComparison(membershipPolicy);
    resolver = new OperationalResolver(FrozenIdentityModel.load(json), release);
    this.agencySeeds = List.copyOf(agencySeeds);
    agencySeeds.forEach(OperationalResources::allowed);
  }

  public record Run(
      int subjects,
      int inserted,
      int matches,
      int deferred,
      int conflicts,
      int selects,
      long loadNanos,
      long batchNanos,
      long queueLatencyMillis,
      List<OperationalBindingStore.Saved> results,
      List<Evaluation> evaluations) {}

  public Run evaluate() {
    store.install(clock.instant(), release);
    var next = store.claim(clock.instant());
    if (next.isEmpty()) return new Run(0, 0, 0, 0, 0, 0, 0, 0, 0, List.of(), List.of());
    var job = next.get();
    long start = System.nanoTime();
    try {
      Instant cut = clock.instant();
      var batch = inputs.load(cut);
      if (batch.subjects().size() > 256) throw new IllegalStateException("S10_SUBJECT_BATCH_BOUND");
      store.discover(OperationalResourceDiscovery.candidates(batch, agencySeeds, cut), cut);
      var evaluated =
          OperationalResolver.consistent(
              batch.subjects().stream()
                  .map(s -> resolver.evaluate(s, batch.resources(), cut, batch.complete()))
                  .toList());
      var diff = comparison.compare(membership.load(cut), evaluated, cut);
      var saved = store.save(evaluated, batch.resources(), diff, clock.instant(), job, release);
      store.finish(job, clock.instant(), false);
      int matches = (int) saved.stream().filter(s -> s.outcome().equals("AUTO_MATCH")).count(),
          conflicts = (int) saved.stream().filter(s -> s.outcome().equals("CONFLICT")).count();
      int inserted = (int) saved.stream().filter(OperationalBindingStore.Saved::inserted).count();
      System.getLogger(getClass().getName())
          .log(
              System.Logger.Level.INFO,
              "s10_binding release="
                  + release.version()
                  + " evaluated={0} match={1} defer={2} conflict={3} revisions={4}"
                  + " truncated={5} missing_proof={6} threshold_failures={7} margin_failures={8}",
              evaluated.size(),
              matches,
              evaluated.size() - matches - conflicts,
              conflicts,
              inserted,
              evaluated.stream().filter(Evaluation::truncated).count(),
              evaluated.stream()
                  .filter(e -> e.reasons().contains("MISSING_QUALIFIED_WITNESS"))
                  .count(),
              evaluated.stream().filter(e -> e.reasons().contains("BELOW_THRESHOLD")).count(),
              evaluated.stream().filter(e -> e.reasons().contains("INSUFFICIENT_MARGIN")).count());
      return new Run(
          evaluated.size(),
          inserted,
          matches,
          evaluated.size() - matches - conflicts,
          conflicts,
          batch.queries(),
          batch.loadNanos(),
          System.nanoTime() - start,
          Math.max(0, Duration.between(job.notifiedAt(), cut).toMillis()),
          saved,
          evaluated);
    } catch (RuntimeException e) {
      store.finish(job, clock.instant(), true);
      throw e;
    }
  }

  public boolean acquire() {
    var job = store.claimResource(clock.instant());
    if (job.isEmpty()) return false;
    var j = job.get();
    if (store.hasFreshResource(j.url(), clock.instant())) {
      store.finishResource(j, clock.instant(), true, clock.instant());
      return true;
    }
    var capture = http.fetch(j.url());
    Long id = store.retain(capture, clock.instant());
    Instant retry = clock.instant().plusSeconds(3600);
    if (capture.retryAt() != null && capture.retryAt().isAfter(retry)) retry = capture.retryAt();
    store.finishResource(j, clock.instant(), id != null, retry);
    if (id == null)
      System.getLogger(getClass().getName())
          .log(
              System.Logger.Level.WARNING,
              "s10_resource_validation_failed category={0}",
              capture.error() == null ? "SEMANTIC_VALIDATION" : capture.error());
    return true;
  }
}
