package org.mission1.orbital.oem;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mission1.orbital.application.OrbitalSampleWindowService;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.application.OrbitalQualityEvaluator;
import org.mission1.orbital.application.OrbitalFreshnessPolicy;
import org.mission1.orbital.application.CelesTrakSourceHealthTracker;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.source.orbital.nasa.NasaOemSource;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;

class NasaOemTrajectoryServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-30T10:30:00Z");

    @Test void returnsSeparateBoundedPredictedWindowWithoutMovingPrimary() throws Exception {
        var data = new OrekitData();
        var orbit = orbit(data);
        var source = mock(NasaOemSource.class);
        var repository = mock(NasaOemRepository.class);
        when(repository.latest()).thenReturn(Optional.empty());
        when(source.fetch()).thenReturn(new NasaOemSource.Fetch(fixture(), Instant.parse("2026-09-28T17:27:12Z")));
        var service = new NasaOemTrajectoryService(repository, source, new NasaOemXmlParser(), data,
                Clock.fixed(NOW, ZoneOffset.UTC));
        var result = service.comparison(orbit);
        assertEquals("DEGRADED", result.availability());
        assertEquals("OEM_WINDOW_PARTIAL", result.reason());
        assertEquals("EME2000", data.eme2000().getName());
        assertTrue(result.samples().size() > 100);
        assertTrue(result.samples().size() <= orbit.samples().size());
        assertEquals(NOW, result.samples().getFirst().time());
        assertTrue(result.samples().stream().allMatch(s -> Math.sqrt(s.xMeters() * s.xMeters()
                + s.yMeters() * s.yMeters() + s.zMeters() * s.zMeters()) > 6_000_000));
        assertEquals(orbit.evaluation().state().elementSha256(), orbit.elements().sha256());
        assertEquals(NOW, orbit.samples().getFirst().propagationTime());
        verify(repository).store(any(), any(), eq(NOW), any());
    }

    @Test void failedSourceLeavesPrimaryIndependentAndReportsOemUnavailable() throws Exception {
        var data = new OrekitData();
        var orbit = orbit(data);
        var source = mock(NasaOemSource.class);
        when(source.fetch()).thenThrow(new IOException("test outage"));
        var repository = mock(NasaOemRepository.class);
        when(repository.latest()).thenReturn(Optional.empty());
        var result = new NasaOemTrajectoryService(repository, source, new NasaOemXmlParser(), data,
                Clock.fixed(NOW, ZoneOffset.UTC)).comparison(orbit);
        assertEquals("UNAVAILABLE", result.availability());
        assertTrue(result.samples().isEmpty());
        assertEquals(181, orbit.samples().size());
    }

    @Test void sourceOutageUsesStoredFileWithIndependentDegradedAvailability() throws Exception {
        var data = new OrekitData();
        var orbit = orbit(data);
        var source = mock(NasaOemSource.class);
        when(source.fetch()).thenThrow(new IOException("test outage"));
        var repository = mock(NasaOemRepository.class);
        Instant oldReceipt = NOW.minusSeconds(10_800);
        when(repository.latest()).thenReturn(Optional.of(new NasaOemRepository.Stored(fixture(), oldReceipt, null)));
        var service = new NasaOemTrajectoryService(repository, source, new NasaOemXmlParser(), data,
                Clock.fixed(NOW, ZoneOffset.UTC));
        var first = service.comparison(orbit);
        var second = service.comparison(orbit);
        assertEquals("DEGRADED", first.availability());
        assertEquals("SOURCE_FETCH_FAILED_USING_STORED_FILE", second.reason());
        assertEquals(172, second.samples().size());
        assertEquals(Instant.parse("2026-09-30T11:58:00Z"), second.samples().getLast().time());
        assertTrue(second.samples().getLast().time().isBefore(orbit.samples().getLast().propagationTime()));
        assertEquals(oldReceipt, second.source().retrievedAt());
        assertEquals("COMPUTED_FROM_ORBITAL_ELEMENTS", orbit.samples().getFirst().classification().name());
        verify(source, times(1)).fetch(); // 15-minute retry backoff
    }

    private OrbitalSampleWindowService.FullOrbit orbit(OrekitData data) throws IOException {
        var parser = new TleElementParser(data);
        String[] lines;
        try (var stream = getClass().getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(stream);
            lines = new String(stream.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
        }
        var elements = parser.parse(lines[1], lines[2], NOW.minusSeconds(60), "CELESTRAK_GP",
                "USSF_GP_VIA_CELESTRAK", URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"));
        var repository = mock(OrbitalElementSetRepository.class);
        when(repository.latestUsable(NOW)).thenReturn(Optional.of(new OrbitalElementSetRepository.Stored(1, elements)));
        var propagator = new OrekitOrbitalPropagator(data, parser);
        return new OrbitalSampleWindowService(repository, propagator,
                new OrbitalQualityEvaluator(propagator, OrbitalFreshnessPolicy.standardGpCurrent()),
                new CelesTrakSourceHealthTracker(), Clock.fixed(NOW, ZoneOffset.UTC)).generateFullOrbit();
    }

    private byte[] fixture() throws IOException {
        try (var stream = getClass().getResourceAsStream("/nasa-oem-2026-09-30-excerpt.xml")) {
            assertNotNull(stream);
            return stream.readAllBytes();
        }
    }
}
