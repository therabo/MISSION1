package org.mission1;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.mission1.crew.automatic.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
class CrewAutomaticIdentityConfiguration {
  @Bean
  AutomaticIdentityWorker automaticIdentityWorker(
      AutomaticIdentityStore store,
      RetainedIdentityEvidence evidence,
      Clock utcClock,
      ObjectMapper json) {
    return new AutomaticIdentityWorker(store, evidence, utcClock, json);
  }

  @Bean
  @ConditionalOnProperty(
      name = "mission1.crew.automatic-shadow.enabled",
      havingValue = "true",
      matchIfMissing = true)
  AutomaticScheduler automaticScheduler(AutomaticIdentityWorker worker) {
    return new AutomaticScheduler(worker);
  }

  static final class AutomaticScheduler {
    private final AutomaticIdentityWorker worker;

    AutomaticScheduler(AutomaticIdentityWorker worker) {
      this.worker = worker;
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.automatic-shadow.fixed-delay:PT1M}",
        initialDelayString = "${mission1.crew.automatic-shadow.initial-delay:PT15M}")
    void work() {
      try {
        worker.run(16);
      } catch (RuntimeException e) {
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "Automatic shadow worker failed: {0}",
                e.getClass().getSimpleName());
      }
    }
  }
}
