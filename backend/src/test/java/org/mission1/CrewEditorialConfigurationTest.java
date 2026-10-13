package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.source.crew.nasa.NasaEditorialParserTest.JSON;
import static org.mockito.Mockito.*;

import java.time.*;
import org.junit.jupiter.api.Test;
import org.mission1.crew.application.*;
import org.mission1.source.crew.nasa.*;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class CrewEditorialConfigurationTest {
  ApplicationContextRunner context(CrewEditorialRepository r) {
    return new ApplicationContextRunner()
        .withUserConfiguration(CrewEditorialConfiguration.class)
        .withInitializer(
            c ->
                c.getBeanFactory()
                    .setConversionService(ApplicationConversionService.getSharedInstance()))
        .withBean(com.fasterxml.jackson.databind.ObjectMapper.class, () -> JSON)
        .withBean(Clock.class, Clock::systemUTC)
        .withBean(CrewEditorialRepository.class, () -> r)
        .withBean(CrewQueryService.class, () -> mock(CrewQueryService.class))
        .withBean(CrewIdentityRepository.class, () -> CrewIdentityRepository.EMPTY)
        .withBean(CrewReadQueryService.class, () -> mock(CrewReadQueryService.class));
  }

  @Test
  void startupRegistersOnlyCapabilitiesAndDelayedSchedulerWithoutDatabaseOrHttp() {
    var r = mock(CrewEditorialRepository.class);
    context(r)
        .run(
            c -> {
              assertNull(c.getStartupFailure());
              assertNotNull(c.getBean(NasaEditorialSource.class));
              assertNotNull(c.getBean(CrewEditorialConfiguration.EditorialScheduler.class));
              verifyNoInteractions(r);
            });
  }

  @Test
  void disabledKeepsReadAndExplicitAcquisitionCapabilities() {
    var r = mock(CrewEditorialRepository.class);
    context(r)
        .withPropertyValues("mission1.crew.editorial.enabled=false")
        .run(
            c -> {
              assertNull(c.getStartupFailure());
              assertTrue(
                  c.getBeansOfType(CrewEditorialConfiguration.EditorialScheduler.class).isEmpty());
              assertNotNull(c.getBean(NasaEditorialSource.class));
              assertTrue(c.getBeansOfType(CrewResourceHealthDiagnostic.class).isEmpty());
              assertTrue(c.getBeansOfType(CrewResourceComparison.class).isEmpty());
              verifyNoInteractions(r);
            });
  }

  @Test
  void leaseProtectsSchedulerRestartAndFailureDoesNotAlterPublicReconciliation() {
    var r = mock(CrewEditorialRepository.class);
    var source = mock(NasaEditorialSource.class);
    var now = Instant.parse("2026-10-10T12:00:00Z");
    when(r.claimRefresh(now, Duration.ofHours(2))).thenReturn(true, false, true);
    when(source.acquire())
        .thenThrow(new IllegalStateException("TEST DB outage"))
        .thenReturn(new NasaEditorialSource.Result(1L, 75, 7, 7, 2, "DEGRADED"));
    var scheduler =
        new CrewEditorialConfiguration.EditorialScheduler(
            source, r, Clock.fixed(now, ZoneOffset.UTC), Duration.ofHours(2));
    for (int i = 0; i < 3; i++) assertDoesNotThrow(scheduler::refresh);
    verify(source, times(2)).acquire();
  }
}
