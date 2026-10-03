package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.application.*;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.scheduling.config.FixedDelayTask;

import java.time.*;

class CrewVerificationConfigurationTest {
    @Configuration
    @EnableScheduling
    static class Scheduling {}

    ApplicationContextRunner context(
            CrewRepository runs,
            CrewVerificationRepository verification,
            CrewReconciliationRepository reconciliation) {
        return new ApplicationContextRunner()
                .withUserConfiguration(CrewVerificationConfiguration.class, Scheduling.class)
                .withInitializer(
                        c ->
                                c.getBeanFactory()
                                        .setConversionService(
                                                ApplicationConversionService.getSharedInstance()))
                .withBean(Clock.class, Clock::systemUTC)
                .withBean(CrewRepository.class, () -> runs)
                .withBean(
                        CrewQueryService.class, () -> new CrewQueryService(runs, Clock.systemUTC()))
                .withBean(CrewVerificationRepository.class, () -> verification)
                .withBean(CrewReconciliationRepository.class, () -> reconciliation);
    }

    @Test
    void delayedRegistrationHasNoSourceOrDatabaseWork() {
        var runs = mock(CrewRepository.class);
        var verification = mock(CrewVerificationRepository.class);
        var reconciliation = mock(CrewReconciliationRepository.class);
        context(runs, verification, reconciliation)
                .withPropertyValues(
                        "mission1.crew.verification.fixed-delay=PT3H",
                        "mission1.crew.verification.initial-delay=PT12M")
                .run(
                        c -> {
                            assertNull(c.getStartupFailure());
                            assertNotNull(c.getBean(CrewVerificationScheduler.class));
                            var tasks =
                                    c.getBean(ScheduledAnnotationBeanPostProcessor.class)
                                            .getScheduledTasks();
                            assertEquals(1, tasks.size());
                            var task = (FixedDelayTask) tasks.iterator().next().getTask();
                            assertEquals(12 * 60 * 1000, task.getInitialDelay());
                            assertEquals(3 * 60 * 60 * 1000, task.getInterval());
                            verifyNoInteractions(runs, verification, reconciliation);
                        });
    }

    @Test
    void disabledKeepsInternalCapabilities() {
        var runs = mock(CrewRepository.class);
        var verification = mock(CrewVerificationRepository.class);
        var reconciliation = mock(CrewReconciliationRepository.class);
        context(runs, verification, reconciliation)
                .withPropertyValues("mission1.crew.verification.enabled=false")
                .run(
                        c -> {
                            assertNull(c.getStartupFailure());
                            assertTrue(c.getBeansOfType(CrewVerificationScheduler.class).isEmpty());
                            assertNotNull(c.getBean(CrewReconciliationQueryService.class));
                            verifyNoInteractions(runs, verification, reconciliation);
                        });
    }

    @Test
    void invalidDelayFailsBeforeNetwork() {
        var runs = mock(CrewRepository.class);
        var verification = mock(CrewVerificationRepository.class);
        var reconciliation = mock(CrewReconciliationRepository.class);
        context(runs, verification, reconciliation)
                .withPropertyValues("mission1.crew.verification.initial-delay=PT1M")
                .run(
                        c -> {
                            assertNotNull(c.getStartupFailure());
                            verifyNoInteractions(runs, verification, reconciliation);
                        });
    }

    @Test
    void sourceFailureReconcilesPersistedInputsAndNextTickCanRecover() {
        var source = mock(NasaCrewVerificationIngestionService.class);
        var reconciliation = mock(CrewReconciliationService.class);
        when(source.ingestScheduled())
                .thenThrow(new IllegalStateException("TEST outage"))
                .thenReturn(
                        new NasaCrewVerificationIngestionService.Result(
                                2, CrewSyncRun.Outcome.SOURCE_RESULT, null, false, 0))
                .thenReturn(
                        new NasaCrewVerificationIngestionService.Result(
                                3, CrewSyncRun.Outcome.SUCCESS, 1L, true, 3));
        var scheduler = new CrewVerificationScheduler(source, reconciliation);
        for (int i = 0; i < 3; i++) assertDoesNotThrow(scheduler::refresh);
        verify(source, times(3)).ingestScheduled();
        verify(reconciliation, times(2)).reconcile();
    }

    @Test
    void skippedAttemptsDoNotTriggerDerivedRuns() {
        var source = mock(NasaCrewVerificationIngestionService.class);
        var reconciliation = mock(CrewReconciliationService.class);
        when(source.ingestScheduled())
                .thenReturn(
                        new NasaCrewVerificationIngestionService.Result(
                                1, CrewSyncRun.Outcome.SKIPPED_NOT_DUE, null, false, 0));
        new CrewVerificationScheduler(source, reconciliation).refresh();
        verifyNoInteractions(reconciliation);
    }

    @Test
    void reconciliationFailureIsIsolatedFromFutureSourceTicks() {
        var source = mock(NasaCrewVerificationIngestionService.class);
        var reconciliation = mock(CrewReconciliationService.class);
        when(source.ingestScheduled())
                .thenReturn(
                        new NasaCrewVerificationIngestionService.Result(
                                1, CrewSyncRun.Outcome.SUCCESS, 1L, true, 3));
        when(reconciliation.reconcile())
                .thenThrow(new IllegalStateException("TEST database failure"));
        var scheduler = new CrewVerificationScheduler(source, reconciliation);
        assertDoesNotThrow(scheduler::refresh);
        assertDoesNotThrow(scheduler::refresh);
        verify(source, times(2)).ingestScheduled();
    }
}
