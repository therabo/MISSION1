package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.*;
import java.util.*;
import java.util.concurrent.ScheduledFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.application.*;
import org.mission1.orbital.domain.SourceFailureCategory;
import org.mission1.source.orbital.celestrak.SourceFetchException;
import org.springframework.scheduling.TaskScheduler;

/** TEST_ONLY virtual UTC with the real refresh service; no public provider calls. */
class CelesTrakRefreshSchedulerTest {
    private static final Instant T = Instant.parse("2026-10-13T12:00:00.936466Z");
    private static final Duration INTERVAL = Duration.ofMinutes(130);
    private final Clock clock = mock(Clock.class);
    private final TaskScheduler timers = mock(TaskScheduler.class);
    private final OrbitalElementSetRepository repository = mock(OrbitalElementSetRepository.class);
    private final OrbitalElementsSource source = mock(OrbitalElementsSource.class);
    private final CelesTrakRequestStore requests = mock(CelesTrakRequestStore.class);
    private final List<Timer> scheduled = new ArrayList<>();
    private CelesTrakRequestStore.State state = new CelesTrakRequestStore.State(Instant.EPOCH, false);
    private final CelesTrakRefreshService service = new CelesTrakRefreshService(repository, source,
            new CelesTrakRefreshPolicy(INTERVAL), new CelesTrakSourceHealthTracker(), clock, requests);
    private final CelesTrakRefreshScheduler scheduler = new CelesTrakRefreshScheduler(service, timers, clock);
    private record Timer(Runnable task, Instant at) { }

    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(T);
        when(requests.state()).thenAnswer(i -> state);
        when(requests.reserve(any(), any())).thenAnswer(i -> {
            Instant at = i.getArgument(0);
            if (state.suspended() || at.isBefore(state.nextEligibleAt())) return false;
            state = new CelesTrakRequestStore.State(i.getArgument(1), false);
            return true;
        });
        when(timers.schedule(any(Runnable.class), any(Instant.class))).thenAnswer(i -> {
            scheduled.add(new Timer(i.getArgument(0), i.getArgument(1)));
            return mock(ScheduledFuture.class);
        });
        when(source.fetch()).thenThrow(new SourceFetchException("TEST_ONLY transport failure", null,
                SourceFailureCategory.NETWORK_ERROR, null));
    }

    private void execute(int index, Instant at) {
        when(clock.instant()).thenReturn(at);
        scheduled.get(index).task().run();
    }

    @Test void emptyInstallationChecksImmediatelyInsteadOfWaitingAnInterval() {
        scheduler.start();
        assertEquals(T, scheduled.getFirst().at());
        execute(0, T);
        verify(source).fetch();
        assertEquals(T.plus(INTERVAL), scheduled.get(1).at());
    }

    @Test void validObservationOnRestartSchedulesRemainingCooldownWithoutFetching() {
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544)).thenReturn(Optional.of(T.minusSeconds(60)));
        scheduler.start();
        execute(0, T);
        verifyNoInteractions(source);
        assertEquals(T.minusSeconds(60).plus(INTERVAL), scheduled.get(1).at());
    }

    @Test void failedAttemptAt377msBeforeEligibilityRearmsExactDeadlineAndRecoversOnce() {
        // First transport attempt reserves T; simulate restart with persisted request state.
        state = new CelesTrakRequestStore.State(T, false);
        when(clock.instant()).thenReturn(T.minusMillis(377));
        scheduler.start();
        execute(0, T.minusMillis(377));
        verifyNoInteractions(source);
        assertEquals(T, scheduled.get(1).at());
        execute(1, T);
        verify(source, times(1)).fetch();
        assertEquals(T.plus(INTERVAL), scheduled.get(2).at());
        // Redelivery of either old timer is inert, even at an eligible wall time.
        execute(0, T.plus(INTERVAL));
        execute(1, T.plus(INTERVAL));
        verify(source, times(1)).fetch();
    }

    @Test void liveTransportFailureUsesSameDeadlineAndNeverRetriesBeforeIt() {
        scheduler.start();
        execute(0, T);
        assertEquals(T.plus(INTERVAL), scheduled.get(1).at());
        execute(1, T.plus(INTERVAL).minusMillis(377));
        verify(source, times(1)).fetch();
        assertEquals(T.plus(INTERVAL), scheduled.get(2).at());
        execute(2, T.plus(INTERVAL));
        verify(source, times(2)).fetch();
    }

    @Test void subMillisecondEarlyTimerUsesBoundedOneMillisecondCeiling() {
        state = new CelesTrakRequestStore.State(T, false);
        scheduler.start();
        execute(0, T.minusNanos(1));
        verifyNoInteractions(source);
        assertEquals(T.minusNanos(1).plusMillis(1), scheduled.get(1).at());
        execute(1, scheduled.get(1).at());
        verify(source).fetch();
    }

    @Test void repeatedReadyEventsDoNotDuplicateTimersAndShutdownCancelsOwnership() {
        scheduler.start();
        scheduler.start();
        assertEquals(1, scheduled.size());
        scheduler.stop();
        execute(0, T);
        verifyNoInteractions(source);
        scheduler.start();
        assertEquals(1, scheduled.size());
    }

    @Test void non200SuspendsWithoutRearming() {
        doThrow(new SourceFetchException("TEST_ONLY blocked", 403,
                SourceFailureCategory.RATE_LIMITED_OR_BLOCKED, null)).when(source).fetch();
        scheduler.start();
        execute(0, T);
        verify(requests).suspend();
        assertEquals(1, scheduled.size());
    }

    @Test void databaseReadFailureRetriesLocallyAfterOneMinuteWithoutProviderCall() {
        when(requests.state()).thenThrow(new IllegalStateException("TEST_ONLY db outage"));
        scheduler.start();
        execute(0, T);
        verifyNoInteractions(source);
        assertEquals(T.plusSeconds(60), scheduled.get(1).at());
    }
}
