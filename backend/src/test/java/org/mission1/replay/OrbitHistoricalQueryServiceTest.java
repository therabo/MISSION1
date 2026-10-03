package org.mission1.replay;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.*;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.domain.*;
import org.mission1.orbital.propagation.*;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;

import java.net.URI;
import java.time.*;
import java.util.*;

class OrbitHistoricalQueryServiceTest {
    final OrekitData data = new OrekitData();
    final TleElementParser parser = new TleElementParser(data);
    final OrekitOrbitalPropagator propagator = new OrekitOrbitalPropagator(data, parser);
    final OrbitalElementSetRepository gp = mock(OrbitalElementSetRepository.class);
    final ReplayHistoryRepository history = mock(ReplayHistoryRepository.class);
    final Instant now = Instant.parse("2026-10-03T21:00:00Z");
    OrbitalElementSet one, two;
    OrbitHistoricalQueryService query;
    byte[] xml;

    @BeforeEach
    void setup() throws Exception {
        one = tle("151bdb4cf2b7128ac815aa975736ffec0c28211751963e8be7263aad7b7abc71");
        two = tle("c1278ac312d701dc21def7fbdefa271c7629648e65365277c17962c2d09086ea");
        when(gp.history())
                .thenReturn(
                        List.of(
                                new OrbitalElementSetRepository.Stored(1, one),
                                new OrbitalElementSetRepository.Stored(2, two)));
        when(history.oem()).thenReturn(List.of());
        query =
                new OrbitHistoricalQueryService(
                        history,
                        gp,
                        propagator,
                        data,
                        new NasaOemXmlParser(),
                        Duration.ofHours(24));
        xml =
                getClass()
                        .getResourceAsStream("/replay/nasa-oem-2026-09-28-excerpt.xml")
                        .readAllBytes();
    }

    OrbitalElementSet tle(String hash) throws Exception {
        var lines =
                new String(
                                getClass()
                                        .getResourceAsStream("/replay/" + hash + ".tle")
                                        .readAllBytes(),
                                java.nio.charset.StandardCharsets.US_ASCII)
                        .lines()
                        .toList();
        return parser.parse(
                lines.get(1),
                lines.get(2),
                now,
                "CELESTRAK_GP",
                "USSF_GP_VIA_CELESTRAK",
                URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"));
    }

    void oem() {
        var doc = new NasaOemXmlParser().parse(xml);
        when(history.oem())
                .thenReturn(
                        List.of(
                                new ReplayHistoryRepository.Oem(
                                        doc.sha256(),
                                        doc.creationDate(),
                                        doc.startTime(),
                                        doc.stopTime(),
                                        now,
                                        null)));
        when(history.oemBody(doc.sha256())).thenReturn(xml);
    }

    @Test
    void exactEpochUsesAcceptedPropagationAndPreservesSignedOffset() {
        var t = one.elementEpoch();
        var replay = query.at(t, now).primary();
        var expected = propagator.propagate(one, t);
        assertEquals(expected.earthFixed().positionMeters(), replay.position());
        assertEquals(expected.earthFixed().velocityMetersPerSecond(), replay.velocity());
        assertEquals(t, replay.effectiveAt());
        assertEquals(0, replay.source().signedPropagationOffsetSeconds());
        assertEquals("UNKNOWN", replay.quality());
    }

    @Test
    void nearestSelectionBetweenEpochsIsIndependentOfRetrievalAndListOrder() {
        var t =
                one.elementEpoch()
                        .plus(
                                Duration.between(one.elementEpoch(), two.elementEpoch())
                                        .dividedBy(2));
        assertEquals(one.sha256(), query.at(t, now).primary().source().contentHash());
        when(gp.history())
                .thenReturn(
                        List.of(
                                new OrbitalElementSetRepository.Stored(2, two),
                                new OrbitalElementSetRepository.Stored(1, one)));
        assertEquals(one.sha256(), query.at(t, now).primary().source().contentHash());
        assertEquals(
                two.sha256(), query.at(t.plusSeconds(1), now).primary().source().contentHash());
        assertTrue(
                query.at(t.plusSeconds(1), now).primary().source().signedPropagationOffsetSeconds()
                        < 0);
    }

    @Test
    void absolutePropagationBoundaryIsInclusiveAndBeyondItUnavailable() {
        assertNotNull(query.at(one.elementEpoch().minusSeconds(86400), now).primary());
        assertNull(query.at(one.elementEpoch().minusSeconds(86401), now).primary());
        assertNotNull(query.at(two.elementEpoch().plusSeconds(86400), now).primary());
        assertNull(query.at(two.elementEpoch().plusSeconds(86401), now).primary());
        verify(gp, never()).latestUsable(any());
    }

    @Test
    void oemIsBoundedByActualVectorsAndSuppliesRotatingFrameVelocity() {
        oem();
        when(gp.history()).thenReturn(List.of());
        var doc = new NasaOemXmlParser().parse(xml);
        var t = doc.vectors().getFirst().epoch().plusSeconds(30);
        var state = query.at(t, now).primary();
        assertEquals("SOURCE_PROVIDED_PREDICTED_EPHEMERIS", state.source().classification());
        var a = query.at(t.minusMillis(100), now).primary().position();
        var b = query.at(t.plusMillis(100), now).primary().position();
        var v = state.velocity();
        assertEquals(v.x(), (b.x() - a.x()) / .2, .1);
        assertEquals(v.y(), (b.y() - a.y()) / .2, .1);
        assertEquals(v.z(), (b.z() - a.z()) / .2, .1);
        assertNull(query.at(doc.vectors().getFirst().epoch().minusSeconds(1), now).primary());
        assertNull(query.at(doc.vectors().getLast().epoch().plusSeconds(1), now).primary());
        assertNotNull(query.at(doc.vectors().getLast().epoch(), now).primary());
    }

    @Test
    void overlappingSourcesRemainSeparateAndReportNeutralSeparation() {
        oem();
        var t = new NasaOemXmlParser().parse(xml).vectors().getFirst().epoch();
        var r = query.at(t, now);
        assertEquals("GP_TLE", r.primary().source().kind());
        assertEquals("NASA_OEM", r.secondary().source().kind());
        assertTrue(r.sourceSeparationMeters() >= 0);
        assertNotEquals(r.primary().position(), r.secondary().position());
    }

    @Test
    void persistedSourceInputsReconstructIdenticalStateAfterNewServiceInstance() {
        var t = one.elementEpoch().plusSeconds(3600);
        var a = query.at(t, now);
        var restarted =
                new OrbitHistoricalQueryService(
                        history,
                        gp,
                        propagator,
                        data,
                        new NasaOemXmlParser(),
                        Duration.ofHours(24));
        assertEquals(a, restarted.at(t, now));
    }

    @Test
    void invalidPolicyCannotExtendGpPastReviewed24HourLimit() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        new OrbitHistoricalQueryService(
                                history,
                                gp,
                                propagator,
                                data,
                                new NasaOemXmlParser(),
                                Duration.ofHours(25)));
    }

    @Test
    void coverageKeepsRealGpGapInsteadOfExtendingLatestElements() {
        when(gp.history()).thenReturn(List.of(new OrbitalElementSetRepository.Stored(1, one)));
        assertFalse(query.coverage(now).contains(now));
    }
}
