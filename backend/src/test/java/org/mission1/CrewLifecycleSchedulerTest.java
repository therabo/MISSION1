package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.*;
import org.junit.jupiter.api.*;
import org.mission1.crew.application.*;
import org.mission1.crew.research.IdentityResearchWorker;
import org.mission1.crew.membership.ActiveMembershipStore;
import org.springframework.scheduling.annotation.Scheduled;

/** Actual scheduled entry points, not duplicate simulated job functions. */
class CrewLifecycleSchedulerTest {
  @Test
  void durableIdentityJobsAreConsumedByTheBoundedProductionTick() throws Exception {
    var worker = mock(IdentityResearchWorker.class);
    new CrewIdentityResearchConfiguration.IdentityResearchScheduler(worker).work();
    verify(worker).run(16);
    var schedule =
        CrewIdentityResearchConfiguration.IdentityResearchScheduler.class
            .getDeclaredMethod("work")
            .getAnnotation(Scheduled.class);
    assertTrue(schedule.fixedDelayString().contains("PT1M"));
    assertTrue(schedule.initialDelayString().contains("PT15M"));
  }

  @Test
  void productionMembershipTickMaterializesOutsideGetAndRecordsFailure() throws Exception {
    var store = mock(ActiveMembershipStore.class);
    var t = Instant.parse("2026-10-11T00:00:00Z");
    var scheduler =
        new CrewActiveMembershipConfiguration.ActiveScheduler(
            store, Clock.fixed(t, ZoneOffset.UTC));
    scheduler.reconcile();
    verify(store).materialize(t);
    when(store.materialize(t)).thenThrow(new IllegalStateException("TEST_ONLY"));
    scheduler.reconcile();
    verify(store).failure();
    assertTrue(
        CrewActiveMembershipConfiguration.ActiveScheduler.class
            .getDeclaredMethod("reconcile")
            .getAnnotation(Scheduled.class)
            .fixedDelayString()
            .contains("PT1M"));
  }

  @Test
  void sourceSchedulersUseScheduledIngestionAndReconcileOnlyAfterAnAttempt() {
    var source = mock(CrewIngestionService.class);
    var reconciliation = mock(CrewReconciliationService.class);
    when(source.ingestScheduled())
        .thenReturn(new CrewIngestionService.Result(1, CrewSyncRun.Outcome.SUCCESS, 1L, true));
    new CrewIngestionScheduler(source, reconciliation::reconcile).refresh();
    verify(source).ingestScheduled();
    verify(reconciliation).reconcile();
    var nasa = mock(NasaCrewVerificationIngestionService.class);
    reset(reconciliation);
    when(nasa.ingestScheduled())
        .thenReturn(
            new NasaCrewVerificationIngestionService.Result(
                2, CrewSyncRun.Outcome.SUCCESS, 2L, true, 1));
    new CrewVerificationScheduler(nasa, reconciliation).refresh();
    verify(nasa).ingestScheduled();
    verify(reconciliation).reconcile();
  }
}
