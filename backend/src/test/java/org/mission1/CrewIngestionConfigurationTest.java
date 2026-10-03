package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Clock;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mission1.crew.application.*;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.scheduling.config.FixedDelayTask;

class CrewIngestionConfigurationTest {
    @Configuration @EnableScheduling static class Scheduling { }
    ApplicationContextRunner context(CrewRepository repository) {
        return new ApplicationContextRunner().withUserConfiguration(CrewConfiguration.class, CrewIngestionConfiguration.class, Scheduling.class)
                .withInitializer(c -> c.getBeanFactory().setConversionService(ApplicationConversionService.getSharedInstance()))
                .withBean(Clock.class, Clock::systemUTC).withBean(CrewRepository.class, () -> repository);
    }
    @Test void disabledSchedulerRegistersServicesWithoutAnyFetchOrDatabaseWork() {
        var repository = mock(CrewRepository.class);
        context(repository).withPropertyValues("mission1.crew.ingestion.enabled=false").run(c -> {
            assertNull(c.getStartupFailure()); assertNotNull(c.getBean(CrewIngestionService.class));
            assertNotNull(c.getBean(CrewQueryService.class)); assertTrue(c.getBeansOfType(CrewIngestionScheduler.class).isEmpty());
            verifyNoInteractions(repository);
        });
    }
    @Test void enabledSchedulerUsesConfiguredInitialDelayAndMakesNoStartupRequest() {
        var repository = mock(CrewRepository.class);
        context(repository).withPropertyValues("mission1.crew.ingestion.enabled=true", "mission1.crew.ingestion.fixed-delay=PT3H",
                "mission1.crew.ingestion.initial-delay=PT7M").run(c -> {
            assertNull(c.getStartupFailure()); assertNotNull(c.getBean(CrewIngestionScheduler.class));
            var tasks = c.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks();
            assertEquals(1, tasks.size());
            var task = (FixedDelayTask) tasks.iterator().next().getTask();
            assertEquals(7 * 60 * 1000, task.getInitialDelay()); assertEquals(3 * 60 * 60 * 1000, task.getInterval());
            verifyNoInteractions(repository);
        });
    }
    @Test void schedulerCatchesDatabaseFailureAndCanRunAgain() {
        var service = mock(CrewIngestionService.class);
        when(service.ingestScheduled()).thenThrow(new IllegalStateException("TEST database unavailable"))
                .thenReturn(new CrewIngestionService.Result(2, CrewSyncRun.Outcome.SOURCE_RESULT, null, false));
        var scheduler = new CrewIngestionScheduler(service);
        assertDoesNotThrow(scheduler::refresh); assertDoesNotThrow(scheduler::refresh);
        verify(service, times(2)).ingestScheduled();
    }
    @Test void invalidConfigurationFailsBeforeSourceCalls() {
        var repository = mock(CrewRepository.class);
        context(repository).withPropertyValues("mission1.crew.ingestion.initial-delay=PT0S").run(c -> {
            assertNotNull(c.getStartupFailure()); verifyNoInteractions(repository);
        });
    }
}
