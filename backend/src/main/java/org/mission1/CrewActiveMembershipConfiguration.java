package org.mission1;

import java.time.*;
import org.mission1.crew.application.CrewReconciliationPolicy;
import org.mission1.crew.membership.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
class CrewActiveMembershipConfiguration {
  @Bean
  ActiveMembershipPolicy activeMembershipPolicy(
      CrewReconciliationPolicy temporal,
      @Value("${mission1.crew.membership.roster-max-age:PT6H}") Duration roster,
      @Value("${mission1.crew.membership.topic-max-age:PT6H}") Duration topic,
      @Value("${mission1.crew.membership.personal-max-age:P7D}") Duration personal) {
    return new ActiveMembershipPolicy(temporal, roster, topic, personal).production(true);
  }

  @Bean
  @ConditionalOnProperty(
      name = "mission1.crew.membership.enabled",
      havingValue = "true",
      matchIfMissing = true)
  ActiveScheduler activeScheduler(
      ActiveMembershipStore store,
      Clock utcClock,
      @Value("${mission1.crew.membership.fixed-delay:PT1M}") Duration delay) {
    if (delay.compareTo(Duration.ofMinutes(1)) < 0)
      throw new IllegalArgumentException("Bounded membership cadence required");
    return new ActiveScheduler(store, utcClock);
  }

  static final class ActiveScheduler {
    private final ActiveMembershipStore store;
    private final Clock clock;

    ActiveScheduler(ActiveMembershipStore store, Clock clock) {
      this.store = store;
      this.clock = clock;
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.membership.fixed-delay:PT1M}",
        initialDelayString = "${mission1.crew.membership.initial-delay:PT15M}")
    void reconcile() {
      try {
        store.materialize(clock.instant());
      } catch (RuntimeException e) {
        try {
          store.failure();
        } catch (RuntimeException ignored) {
          /* original failure remains visible */
        }
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "Crew membership projection failed: {0}",
                e.getClass().getSimpleName());
      }
    }
  }
}
