package org.mission1.orbital.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.SourceAcquisitionHealth;
import org.mission1.orbital.domain.SourceFailureCategory;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.source.orbital.celestrak.SourceFetchException;

class CelesTrakRefreshServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-28T15:00:00Z");
    private static final Duration INTERVAL = Duration.ofMinutes(130);
    private final OrbitalElementSetRepository repository = mock(OrbitalElementSetRepository.class);
    private final OrbitalElementsSource source = mock(OrbitalElementsSource.class);
    private final Clock clock = mock(Clock.class);
    private final CelesTrakSourceHealthTracker health = new CelesTrakSourceHealthTracker();
    private final CelesTrakRefreshPolicy policy = new CelesTrakRefreshPolicy(INTERVAL);
    private final CelesTrakRequestStore requests = mock(CelesTrakRequestStore.class);
    private final CelesTrakRefreshService service = new CelesTrakRefreshService(
            repository, source, policy, health, clock, requests);

    @BeforeEach void fixedTime() {
        when(clock.instant()).thenReturn(NOW);
        when(requests.state()).thenReturn(new CelesTrakRequestStore.State(Instant.EPOCH, false));
        when(requests.reserve(any(), any())).thenReturn(true);
    }

    @Test void noPreviousRetrievalIsEligibleAndStoresNewSet() {
        OrbitalElementSet elements = fixture(NOW);
        when(source.fetch()).thenReturn(elements);
        when(repository.storeIfNew(elements)).thenReturn(new OrbitalElementSetRepository.StoreResult(1, true, true));
        var result = service.refresh();
        assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT, result.outcome());
        assertEquals(NOW.plus(INTERVAL), result.nextEligibleAt());
        assertTrue(result.observationInserted());
        assertEquals(SourceAcquisitionHealth.Status.HEALTHY, health.snapshot(NOW).status());
        assertEquals("FETCHED_NEW_ELEMENT", health.snapshot(NOW).lastSuccessfulResult());
        verify(clock, times(1)).instant();
        verify(source).fetch();
    }

    @Test void recentRetrievalSkipsWithoutProviderCall() {
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544))
                .thenReturn(Optional.of(NOW.minusSeconds(60)));
        var result = service.refresh();
        assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, result.outcome());
        assertEquals(NOW.minusSeconds(60).plus(INTERVAL), result.nextEligibleAt());
        assertEquals(SourceAcquisitionHealth.Status.UNKNOWN, health.snapshot(NOW.minusSeconds(60)).status());
        verifyNoInteractions(source);
    }

    @Test void exactlyAtBoundaryFetches() {
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544))
                .thenReturn(Optional.of(NOW.minus(INTERVAL)));
        when(source.fetch()).thenReturn(fixture(NOW));
        when(repository.storeIfNew(any())).thenReturn(new OrbitalElementSetRepository.StoreResult(1, true, true));
        assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT, service.refresh().outcome());
        verify(source).fetch();
    }

    @Test void justBeforeBoundarySkips() {
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544))
                .thenReturn(Optional.of(NOW.minus(INTERVAL).plusNanos(1)));
        assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, service.refresh().outcome());
        verifyNoInteractions(source);
    }

    @Test void policyRejectsIntervalsBelowProviderMinimumAndIgnoresElementEpoch() {
        assertThrows(IllegalArgumentException.class, () -> new CelesTrakRefreshPolicy(Duration.ofMinutes(119)));
        assertTrue(policy.shouldFetch(NOW, null));
        assertTrue(policy.shouldFetch(NOW, NOW.minus(INTERVAL)));
        assertFalse(policy.shouldFetch(NOW, NOW.minus(INTERVAL).plusNanos(1)));
    }

    @Test void validDuplicateIsHealthyAndCanCreateObservation() {
        OrbitalElementSet same = fixture(NOW);
        when(source.fetch()).thenReturn(same);
        when(repository.storeIfNew(same)).thenReturn(new OrbitalElementSetRepository.StoreResult(7, false, true));
        var result = service.refresh();
        assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_ALREADY_KNOWN_ELEMENT, result.outcome());
        assertTrue(result.observationInserted());
        assertEquals(SourceAcquisitionHealth.Status.HEALTHY, health.snapshot(NOW).status());
    }

    @Test void networkFailureDegradesHealthAndDoesNotWrite() {
        failSource(SourceFailureCategory.NETWORK_ERROR, null);
        assertEquals(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, service.refresh().outcome());
        assertDegraded(SourceFailureCategory.NETWORK_ERROR);
        verify(repository, never()).storeIfNew(any());
    }

    @Test void timeoutDegradesHealthWithoutImmediateRetry() {
        failSource(SourceFailureCategory.TIMEOUT, null);
        assertEquals(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, service.refresh().outcome());
        assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_TOO_SOON, service.refresh().outcome());
        verify(source, times(1)).fetch();
        assertDegraded(SourceFailureCategory.TIMEOUT);
    }

    @Test void http403SuspendsFurtherAutomaticRequests() {
        failSource(SourceFailureCategory.RATE_LIMITED_OR_BLOCKED, 403);
        var first = service.refresh();
        assertEquals(CelesTrakRefreshResult.Outcome.SOURCE_FAILURE, first.outcome());
        assertEquals(SourceFailureCategory.RATE_LIMITED_OR_BLOCKED, first.failureCategory());
        assertEquals(CelesTrakRefreshResult.Outcome.SKIPPED_PROVIDER_SUSPENDED, service.refresh().outcome());
        verify(source, times(1)).fetch();
        assertDegraded(SourceFailureCategory.RATE_LIMITED_OR_BLOCKED);
    }

    @Test void malformedResponseIsInvalidSourceData() {
        failSource(SourceFailureCategory.INVALID_RESPONSE, 200);
        assertEquals(CelesTrakRefreshResult.Outcome.INVALID_SOURCE_DATA, service.refresh().outcome());
        assertDegraded(SourceFailureCategory.INVALID_RESPONSE);
    }

    @Test void wrongCatalogIsInvalidSourceData() {
        failSource(SourceFailureCategory.WRONG_SATELLITE, 200);
        assertEquals(CelesTrakRefreshResult.Outcome.INVALID_SOURCE_DATA, service.refresh().outcome());
        assertDegraded(SourceFailureCategory.WRONG_SATELLITE);
    }

    @Test void validSuccessResetsProviderFailures() {
        failSource(SourceFailureCategory.NETWORK_ERROR, null);
        service.refresh();
        reset(source);
        when(clock.instant()).thenReturn(NOW.plus(INTERVAL));
        OrbitalElementSet elements = fixture(NOW.plus(INTERVAL));
        when(source.fetch()).thenReturn(elements);
        when(repository.storeIfNew(elements)).thenReturn(new OrbitalElementSetRepository.StoreResult(1, true, true));
        assertEquals(CelesTrakRefreshResult.Outcome.FETCHED_NEW_ELEMENT, service.refresh().outcome());
        var snapshot = health.snapshot(NOW.plus(INTERVAL));
        assertEquals(SourceAcquisitionHealth.Status.HEALTHY, snapshot.status());
        assertEquals(0, snapshot.consecutiveFailures());
        assertEquals(SourceFailureCategory.NETWORK_ERROR, snapshot.lastFailureCategory());
        assertEquals(NOW, snapshot.lastFailureAt());
    }

    @Test void localWriteFailureDoesNotBlameProviderOrClaimDurableSuccess() {
        OrbitalElementSet elements = fixture(NOW);
        when(source.fetch()).thenReturn(elements);
        when(repository.storeIfNew(elements)).thenThrow(new IllegalStateException("local database error"));
        assertEquals(CelesTrakRefreshResult.Outcome.PERSISTENCE_FAILURE, service.refresh().outcome());
        var snapshot = health.snapshot(null);
        assertEquals(SourceAcquisitionHealth.Status.UNKNOWN, snapshot.status());
        assertNull(snapshot.lastSuccessfulFetchAt());
        assertNull(snapshot.lastFailureCategory());
        assertEquals(NOW, snapshot.lastAttemptAt());
    }

    @Test void failedRetrievalHistoryReadMakesNoProviderRequest() {
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544))
                .thenThrow(new IllegalStateException("local database error"));
        assertEquals(CelesTrakRefreshResult.Outcome.PERSISTENCE_FAILURE, service.refresh().outcome());
        verifyNoInteractions(source);
    }

    private void failSource(SourceFailureCategory category, Integer httpStatus) {
        when(source.fetch()).thenThrow(new SourceFetchException("safe test failure", httpStatus, category, null));
    }

    private void assertDegraded(SourceFailureCategory category) {
        var snapshot = health.snapshot(null);
        assertEquals(SourceAcquisitionHealth.Status.DEGRADED, snapshot.status());
        assertEquals(1, snapshot.consecutiveFailures());
        assertEquals(NOW, snapshot.lastFailureAt());
        assertEquals(category, snapshot.lastFailureCategory());
    }

    private static OrbitalElementSet fixture(Instant retrievedAt) {
        try (var input = CelesTrakRefreshServiceTest.class.getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            String[] lines = new String(input.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
            return new TleElementParser(new OrekitData()).parse(lines[1], lines[2], retrievedAt,
                    "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK",
                    URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"));
        } catch (IOException failure) {
            throw new AssertionError(failure);
        }
    }
}
