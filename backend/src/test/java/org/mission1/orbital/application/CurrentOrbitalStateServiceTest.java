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

import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalQualityReason;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.SourceAcquisitionHealth;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;

class CurrentOrbitalStateServiceTest {
    private static final Instant RETRIEVED = Instant.parse("2026-09-28T13:58:32Z");
    private static final Instant NOW = RETRIEVED.plus(Duration.ofHours(1));
    private static final URI SOURCE = URI.create(
            "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");

    private final OrbitalElementSetRepository repository = mock(OrbitalElementSetRepository.class);
    private final Clock clock = mock(Clock.class);
    private final OrekitData data = new OrekitData();
    private final TleElementParser parser = new TleElementParser(data);
    private final OrbitalQualityEvaluator evaluator = new OrbitalQualityEvaluator(
            new OrekitOrbitalPropagator(data, parser), OrbitalFreshnessPolicy.standardGpCurrent());
    private final CurrentOrbitalStateService service = new CurrentOrbitalStateService(repository, evaluator, clock);

    @Test
    void selectsAtOneCapturedInstantAndComputesGoodStateFromSelectedElements() {
        OrbitalElementSet selected = fixture();
        when(clock.instant()).thenReturn(NOW, NOW.plusSeconds(1));
        when(repository.latestUsable(NOW)).thenReturn(Optional.of(new OrbitalElementSetRepository.Stored(42, selected)));

        var result = service.current();

        verify(clock, times(1)).instant();
        verify(repository).latestUsable(NOW);
        verifyNoMoreInteractions(repository);
        assertEquals(selected, result.elements());
        assertEquals(NOW, result.evaluation().evaluationTime());
        assertEquals(NOW, result.evaluation().propagationTime());
        assertEquals(NOW, result.evaluation().state().propagationTime());
        assertEquals(selected.sha256(), result.evaluation().state().elementSha256());
        assertEquals(Quality.GOOD, result.evaluation().quality());
        assertEquals(OrbitalQualityReason.NONE, result.evaluation().reason());
        assertEquals("orbital-current-v1", result.evaluation().policyId());
        assertEquals(Duration.ofHours(1), result.evaluation().retrievalAge());
        assertEquals(Duration.between(selected.elementEpoch(), NOW), result.evaluation().elementEpochAge());
        assertEquals(result.evaluation().elementEpochAge(), result.evaluation().propagationOffset());
        assertEquals(SourceAcquisitionHealth.Status.UNKNOWN, result.evaluation().sourceHealth().status());
        assertNull(result.evaluation().sourceHealth().lastAttemptAt());
    }

    @Test
    void staleSetStillProducesCoordinates() {
        Instant staleNow = fixture().elementEpoch().plus(Duration.ofHours(25));
        when(clock.instant()).thenReturn(staleNow);
        when(repository.latestUsable(staleNow)).thenReturn(Optional.of(
                new OrbitalElementSetRepository.Stored(1, fixture())));

        var result = service.current();

        assertNotNull(result.evaluation().state());
        assertEquals(Quality.STALE, result.evaluation().quality());
        assertEquals(OrbitalQualityReason.ELEMENT_TOO_OLD, result.evaluation().reason());
    }

    @Test
    void noObservedUsableElementsFailsExplicitlyWithoutAcquisition() {
        when(clock.instant()).thenReturn(NOW);
        when(repository.latestUsable(NOW)).thenReturn(Optional.empty());

        assertThrows(NoCurrentOrbitalStateException.class, service::current);
        verify(repository).latestUsable(NOW);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void invalidSelectedElementsAreNotMistakenForNoData() {
        OrbitalElementSet good = fixture();
        OrbitalElementSet corrupt = new OrbitalElementSet(good.catalogNumber(), good.sourceFormat(),
                good.line1(), good.line2(), good.elementEpoch(), good.provider(), good.upstreamOrigin(),
                good.sourceUri(), good.retrievedAt(), good.publishedAt(), "0".repeat(64), good.classification());
        when(clock.instant()).thenReturn(NOW);
        when(repository.latestUsable(NOW)).thenReturn(Optional.of(
                new OrbitalElementSetRepository.Stored(1, corrupt)));

        var failure = assertThrows(CurrentOrbitalStateCalculationException.class, service::current);
        assertEquals(OrbitalQualityReason.INVALID_ORBITAL_ELEMENTS, failure.reason());
    }

    private OrbitalElementSet fixture() {
        try (var input = getClass().getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            String[] lines = new String(input.readAllBytes(), StandardCharsets.US_ASCII)
                    .lines().toArray(String[]::new);
            return parser.parse(lines[1], lines[2], RETRIEVED, "CELESTRAK_GP",
                    "USSF_GP_VIA_CELESTRAK", SOURCE);
        } catch (IOException failure) {
            throw new AssertionError(failure);
        }
    }
}
