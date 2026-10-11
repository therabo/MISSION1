package org.mission1;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.*;
import java.util.*;
import org.mission1.crew.membership.*;
import org.mission1.crew.operational.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;

/** S10 background SHADOW ON; a production consumer deliberately does not exist. */
@Configuration
class CrewOperationalBindingConfiguration {
  @Bean
  OperationalResourceHttp operationalResourceHttp(
      Clock utcClock, OperationalBindingStore store, NasaRequestGate gate) {
    return new OperationalResourceHttp(
        HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build(),
        utcClock,
        store::permit,
        gate);
  }

  @Bean
  OperationalBindingWorker operationalBindingWorker(
      OperationalBindingStore store,
      RetainedOperationalInputs inputs,
      RetainedMembershipInputs membership,
      ActiveMembershipPolicy policy,
      ObjectMapper json,
      Clock utcClock,
      OperationalResourceHttp http,
      @Value(
              "${mission1.crew.operational-shadow.resource-seeds:https://www.gctc.ru/main.php?id=154,https://www.asc-csa.gc.ca/eng/astronauts/canadian/active/bio-joshua-kutryk.asp,https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Sophie_Adenot,https://www.nasa.gov/mission/nasas-spacex-crew-12/,https://www.nasa.gov/mission/nasas-spacex-crew-13/}")
          String seeds) {
    return new OperationalBindingWorker(
        store,
        inputs,
        membership,
        policy,
        json,
        utcClock,
        http,
        seeds.isBlank() ? List.of() : Arrays.stream(seeds.split(",")).map(String::strip).toList());
  }

  @Bean
  @ConditionalOnProperty(
      name = "mission1.crew.operational-shadow.enabled",
      havingValue = "true",
      matchIfMissing = true)
  Scheduler operationalBindingScheduler(OperationalBindingWorker worker) {
    return new Scheduler(worker);
  }

  static final class Scheduler {
    private final OperationalBindingWorker worker;

    Scheduler(OperationalBindingWorker w) {
      worker = w;
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.operational-shadow.fixed-delay:PT1M}",
        initialDelayString = "${mission1.crew.operational-shadow.initial-delay:PT15M}")
    void evaluate() {
      try {
        worker.evaluate();
      } catch (RuntimeException e) {
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "s10_worker_failed category={0}",
                e.getClass().getSimpleName());
      }
    }

    @Scheduled(
        fixedDelayString = "${mission1.crew.operational-shadow.acquisition-delay:PT5M}",
        initialDelayString = "${mission1.crew.operational-shadow.initial-delay:PT15M}")
    void acquire() {
      try {
        worker.acquire();
      } catch (RuntimeException e) {
        System.getLogger(getClass().getName())
            .log(
                System.Logger.Level.WARNING,
                "s10_acquisition_failed category={0}",
                e.getClass().getSimpleName());
      }
    }
  }
}
