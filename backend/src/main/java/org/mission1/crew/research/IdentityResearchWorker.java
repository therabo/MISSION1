package org.mission1.crew.research;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;

/** Bounded durable worker. No source client or HTTP dependency can be called by this class. */
public final class IdentityResearchWorker {
  private final IdentityResearchStore store;
  private final RetainedIdentityEvidence evidence;
  private final Clock clock;
  private final FrozenIdentityModel model;
  private final String modelError;

  public IdentityResearchWorker(
      IdentityResearchStore store,
      RetainedIdentityEvidence evidence,
      Clock clock,
      ObjectMapper json) {
    this.store = store;
    this.evidence = evidence;
    this.clock = clock;
    FrozenIdentityModel loaded = null;
    String error = null;
    try {
      loaded = FrozenIdentityModel.load(json);
    } catch (RuntimeException e) {
      error = e.getClass().getSimpleName() + ":" + e.getMessage();
    }
    model = loaded;
    modelError = error;
  }

  public Map<String, Object> health() {
    return store.health(model != null, modelError, clock.instant());
  }

  public record Run(
      int claimed,
      int imported,
      int evaluated,
      int failed,
      List<IdentityResearchStore.Evaluation> evaluations) {}

  public Run run(int budget) {
    if (budget < 1 || budget > 256) throw new IllegalArgumentException("Worker budget 1..256");
    if (model == null)
      return new Run(0, 0, 0, 0, List.of()); // fail closed without touching queue/model history
    var now = clock.instant();
    store.installRelease(FrozenIdentityModel.VERSION, IdentityPolicy.VERSION, now);
    store.safetySweep(now, FrozenIdentityModel.VERSION, IdentityPolicy.VERSION);
    int claimed = 0, imported = 0, evaluated = 0, failed = 0;
    List<IdentityResearchStore.Evaluation> results = new ArrayList<>();
    for (int i = 0; i < budget; i++) {
      var next = store.claim(clock.instant());
      if (next.isEmpty()) break;
      var job = next.get();
      claimed++;
      try {
        if (job.identity() == null) {
          var input = evidence.load(clock.instant());
          imported += store.retain(input.evidence(), clock.instant());
          store.finish(job, clock.instant(), false);
        } else {
          var result =
              store.evaluate(
                  job.identity(),
                  model,
                  FrozenIdentityModel.VERSION,
                  IdentityPolicy.VERSION,
                  clock.instant());
          results.add(result);
          evaluated++;
          store.finish(
              job, clock.instant(), result.result().outcome() == IdentityPolicy.Outcome.AUTO_DEFER);
        }
      } catch (RuntimeException error) {
        failed++;
        store.fail(job, clock.instant(), error);
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "auto_identity job={0} failure={1}",
                job.key(),
                error.getClass().getSimpleName());
      }
    }
    return new Run(claimed, imported, evaluated, failed, List.copyOf(results));
  }
}
