package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.operational.OperationalBindingWorker;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;

class CrewOperationalBindingConfigurationTest {
  @Test
  void scheduledDispatchIsIndependentAndFailureDoesNotDisableFutureRuns() {
    var worker = mock(OperationalBindingWorker.class);
    var scheduler = new CrewOperationalBindingConfiguration.Scheduler(worker);
    when(worker.evaluate())
        .thenThrow(new IllegalStateException("TEST_ONLY_FAILURE"))
        .thenReturn(null);
    scheduler.evaluate();
    scheduler.acquire();
    scheduler.evaluate();
    verify(worker, times(2)).evaluate();
    verify(worker).acquire();
  }

  @Test
  void defaultShadowOnHasSeparateBoundedDispatchAndInitialDelay() throws Exception {
    var annotation =
        CrewOperationalBindingConfiguration.class
            .getDeclaredMethod("operationalBindingScheduler", OperationalBindingWorker.class, boolean.class)
            .getAnnotation(ConditionalOnProperty.class);
    assertTrue(annotation.matchIfMissing());
    assertEquals("true", annotation.havingValue());
    var evaluation =
        CrewOperationalBindingConfiguration.Scheduler.class
            .getDeclaredMethod("evaluate")
            .getAnnotation(Scheduled.class);
    var acquisition =
        CrewOperationalBindingConfiguration.Scheduler.class
            .getDeclaredMethod("acquire")
            .getAnnotation(Scheduled.class);
    assertEquals(
        "${mission1.crew.operational-binding.fixed-delay:PT1M}", evaluation.fixedDelayString());
    assertEquals(
        "${mission1.crew.operational-binding.acquisition-delay:PT5M}",
        acquisition.fixedDelayString());
    assertEquals(
        "${mission1.crew.operational-binding.initial-delay:PT15M}", evaluation.initialDelayString());
  }
}
