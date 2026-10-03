package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.application.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.net.URI;
import java.time.*;

class CrewRefreshConfigurationTest {
    private ApplicationContextRunner context() {
        var source = mock(LaunchLibrary2CrewSource.class);
        when(source.currentExpeditionUrl())
                .thenReturn(URI.create("https://example.invalid/TEST_ONLY"));
        return new ApplicationContextRunner()
                .withInitializer(
                        c ->
                                c.getBeanFactory()
                                        .setConversionService(
                                                org.springframework.boot.convert
                                                        .ApplicationConversionService
                                                        .getSharedInstance()))
                .withUserConfiguration(
                        CrewIngestionConfiguration.class,
                        CrewVerificationConfiguration.class,
                        CrewRefreshConfiguration.class)
                .withBean(
                        Clock.class,
                        () -> Clock.fixed(Instant.parse("2026-10-03T00:00:00Z"), ZoneOffset.UTC))
                .withBean(CrewHttpReader.class, () -> mock(CrewHttpReader.class))
                .withBean(LaunchLibrary2CrewSource.class, () -> source)
                .withBean(CrewRepository.class, () -> mock(CrewRepository.class))
                .withBean(
                        CrewVerificationRepository.class,
                        () -> mock(CrewVerificationRepository.class))
                .withBean(
                        CrewReconciliationRepository.class,
                        () -> mock(CrewReconciliationRepository.class))
                .withBean(CrewRefreshRepository.class, () -> mock(CrewRefreshRepository.class));
    }

    @Test
    void enablingCoordinatorReplacesBothBaselineSchedulers() {
        context()
                .withPropertyValues("mission1.crew.refresh.event-aware.enabled=true")
                .run(
                        c -> {
                            assertNull(c.getStartupFailure());
                            assertEquals(1, c.getBeansOfType(CrewRefreshScheduler.class).size());
                            assertTrue(c.getBeansOfType(CrewIngestionScheduler.class).isEmpty());
                            assertTrue(c.getBeansOfType(CrewVerificationScheduler.class).isEmpty());
                            verifyNoInteractions(c.getBean(CrewHttpReader.class));
                        });
    }

    @Test
    void featureDisabledRestoresAcceptedBaselineSchedulers() {
        context()
                .withPropertyValues("mission1.crew.refresh.event-aware.enabled=false")
                .run(
                        c -> {
                            assertNull(c.getStartupFailure());
                            assertTrue(c.getBeansOfType(CrewRefreshScheduler.class).isEmpty());
                            assertEquals(1, c.getBeansOfType(CrewIngestionScheduler.class).size());
                            assertEquals(
                                    1, c.getBeansOfType(CrewVerificationScheduler.class).size());
                            verifyNoInteractions(c.getBean(CrewHttpReader.class));
                        });
    }

    @Test
    void invalidFollowUpBudgetFailsConfiguration() {
        context()
                .withPropertyValues("mission1.crew.refresh.max-follow-up-attempts=7")
                .run(
                        c -> {
                            assertNotNull(c.getStartupFailure());
                        });
    }
}
