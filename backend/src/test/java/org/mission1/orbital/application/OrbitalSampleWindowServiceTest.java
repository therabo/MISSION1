package org.mission1.orbital.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;

class OrbitalSampleWindowServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-28T15:00:00Z");

    @Test void fixedRequestSelectsOnceAndEverySampleHasTheSameElementLineage() throws IOException {
        var repository = mock(OrbitalElementSetRepository.class);
        var data = new OrekitData();
        var parser = new TleElementParser(data);
        OrbitalElementSet elements;
        try (var input = getClass().getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            String[] lines = new String(input.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
            elements = parser.parse(lines[1], lines[2], NOW.minusSeconds(60), "CELESTRAK_GP",
                    "USSF_GP_VIA_CELESTRAK",
                    URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"));
        }
        when(repository.latestUsable(NOW)).thenReturn(Optional.of(new OrbitalElementSetRepository.Stored(1, elements)));
        when(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544)).thenReturn(Optional.of(elements.retrievedAt()));
        var propagator = new OrekitOrbitalPropagator(data, parser);
        var service = new OrbitalSampleWindowService(repository, propagator,
                new OrbitalQualityEvaluator(propagator, OrbitalFreshnessPolicy.standardGpCurrent()),
                new CelesTrakSourceHealthTracker(), Clock.fixed(NOW, ZoneOffset.UTC));

        var result = service.generate(new OrbitalSampleWindow(120, 600, 10));
        assertEquals(NOW, result.generatedAt());
        assertEquals(73, result.samples().size());
        assertEquals(NOW.minusSeconds(120), result.samples().getFirst().propagationTime());
        assertEquals(NOW, result.samples().get(12).propagationTime());
        assertEquals(NOW.plusSeconds(600), result.samples().getLast().propagationTime());
        assertTrue(result.samples().stream().allMatch(state -> elements.sha256().equals(state.elementSha256())));
        assertEquals(elements.sha256(), result.evaluation().state().elementSha256());
        verify(repository, times(1)).latestUsable(NOW);
        verify(repository, never()).storeIfNew(any());
        verify(repository, times(1)).lastSuccessfulRetrieval("CELESTRAK_GP", 25544);
        verifyNoMoreInteractions(repository);
    }

    @Test void sampleCountLimitIsIndependentOfWindowDurationLimit() {
        assertEquals(181, new OrbitalSampleWindow(300, 600, 5).sampleCount());
        assertThrows(InvalidOrbitalSampleRequestException.class,
                () -> new OrbitalSampleWindow(300, 900, 5));
        assertThrows(InvalidOrbitalSampleRequestException.class,
                () -> new OrbitalSampleWindow(300, 1200, 30));
    }
}
