package org.mission1;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.mission1.crew.research.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
class CrewIdentityResearchConfiguration {
  @Bean
  IdentityResearchWorker identityResearchWorker(
      IdentityResearchStore store,
      RetainedIdentityEvidence evidence,
      Clock utcClock,
      ObjectMapper json) {
    return new IdentityResearchWorker(store, evidence, utcClock, json);
  }

  @Bean
  @ConditionalOnProperty(
      name = "mission1.crew.identity-research.enabled",
      havingValue = "true",
      matchIfMissing = true)
  IdentityResearchScheduler identityResearchScheduler(IdentityResearchWorker worker) {
    return new IdentityResearchScheduler(worker);
  }

  static final class IdentityResearchScheduler {
    private final IdentityResearchWorker worker;

    IdentityResearchScheduler(IdentityResearchWorker worker) {
      this.worker = worker;
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.identity-research.fixed-delay:PT1M}",
        initialDelayString = "${mission1.crew.identity-research.initial-delay:PT15M}")
    void work() {
      try {
        worker.run(16);
      } catch (RuntimeException e) {
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "Identity research worker failed: {0}",
                e.getClass().getSimpleName());
      }
    }
  }
}
