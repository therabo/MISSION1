package org.mission1.orbital.propagation;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.DataClassification;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalState;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.Vector3;

class OrbitalCoreTest {
    private static final Instant EPOCH = Instant.parse("2026-09-28T03:24:39.835008Z");
    private static final Instant LATER = Instant.parse("2026-09-28T04:24:39.835008Z");
    private static final Instant RETRIEVED = Instant.parse("2026-09-28T13:58:32Z");
    private static final URI SOURCE = URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");
    private final OrekitData data = new OrekitData();
    private final TleElementParser parser = new TleElementParser(data);
    private final OrekitOrbitalPropagator propagator = new OrekitOrbitalPropagator(data, parser);

    @Test void parsesVerifiedIssTleAndPreservesSourceMetadata() {
        OrbitalElementSet elements = fixture();
        assertAll(
                () -> assertEquals(25544, elements.catalogNumber()),
                () -> assertEquals("TLE", elements.sourceFormat()),
                () -> assertEquals(EPOCH, elements.elementEpoch()),
                () -> assertEquals(RETRIEVED, elements.retrievedAt()),
                () -> assertNull(elements.publishedAt()),
                () -> assertEquals("CELESTRAK_GP", elements.provider()),
                () -> assertEquals("USSF_GP_VIA_CELESTRAK", elements.upstreamOrigin()),
                () -> assertEquals(SOURCE, elements.sourceUri()),
                () -> assertEquals(64, elements.sha256().length()),
                () -> assertEquals(DataClassification.SOURCE_PROVIDED_ORBITAL_ELEMENTS, elements.classification()));
    }

    @Test void rejectsBadChecksumAndMalformedTle() {
        String[] lines = lines();
        String corruptChecksum = lines[1].substring(0, 68) + (lines[1].charAt(68) == '0' ? '1' : '0');
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse(corruptChecksum, lines[2], RETRIEVED, "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", SOURCE));
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse("garbage", lines[2], RETRIEVED, "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", SOURCE));
    }

    @Test void rejectsWrongCatalogEvenWithValidChecksums() {
        String[] lines = lines();
        String other1 = withChecksum(lines[1].substring(0, 2) + "99999" + lines[1].substring(7));
        String other2 = withChecksum(lines[2].substring(0, 2) + "99999" + lines[2].substring(7));
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse(other1, other2, RETRIEVED, "TEST", "TEST", SOURCE));
    }

    @Test void propagatesAtEpochAgainstIndependentSgp4AndSkyfieldReference() {
        OrbitalState state = propagator.propagate(fixture(), EPOCH);
        assertEquals(Duration.ZERO, state.propagationOffset());
        assertEquals("TEME", state.teme().frame());
        assertEquals("ITRF_2020_IERS_2010", state.earthFixed().frame());
        // Independent python-sgp4 2.25 TEME state, converted km→m and km/s→m/s.
        assertVectorNear(new Vector3(-5_925_448.756951, 3_344_383.401309, -3.544407),
                state.teme().positionMeters(), 0.01);
        assertVectorNear(new Vector3(-2_330.000050, -4_138.411222, 6_003.050757),
                state.teme().velocityMetersPerSecond(), 0.0001);
        // Independent Skyfield 1.53 ITRS/WGS84 reference; its Earth-orientation path differs.
        assertVectorNear(new Vector3(-292_870.707437, 6_797_798.912510, -3.544408),
                state.earthFixed().positionMeters(), 150);
        assertEquals(-3.0035107514121615e-05, Math.toDegrees(state.wgs84().latitudeRadians()), 0.002);
        assertEquals(92.46695805018736, Math.toDegrees(state.wgs84().longitudeRadians()), 0.002);
        assertEquals(425_967.886480, state.wgs84().altitudeMeters(), 100);
    }

    @Test void propagatesAtKnownLaterInstantAndPreservesLineageAndAge() {
        OrbitalElementSet elements = fixture();
        OrbitalState state = propagator.propagate(elements, LATER);
        assertEquals(Duration.ofHours(1), state.propagationOffset());
        assertVectorNear(new Vector3(5_245_553.221649, 875_882.115212, -4_235_873.375230),
                state.teme().positionMeters(), 0.01);
        assertVectorNear(new Vector3(-3_859.158777, 5_515.945720, -3_646.518240),
                state.teme().velocityMetersPerSecond(), 0.0001);
        assertVectorNear(new Vector3(2_360_181.378210, -4_765_767.718096, -4_235_873.375230),
                state.earthFixed().positionMeters(), 150);
        assertEquals(-38.712791370705325, Math.toDegrees(state.wgs84().latitudeRadians()), 0.002);
        assertEquals(-63.65371454628173, Math.toDegrees(state.wgs84().longitudeRadians()), 0.002);
        assertEquals(429_129.640797, state.wgs84().altitudeMeters(), 100);
        assertEquals(elements.sha256(), state.elementSha256());
        assertEquals(elements.provider(), state.elementProvider());
        assertEquals(elements.upstreamOrigin(), state.elementUpstreamOrigin());
        assertEquals(SOURCE, state.elementSourceUri());
        assertEquals(RETRIEVED, state.elementRetrievedAt());
        assertEquals(DataClassification.COMPUTED_FROM_ORBITAL_ELEMENTS, state.classification());
        assertEquals(Quality.UNKNOWN, state.quality());
        assertNotEquals(state.teme().positionMeters(), state.earthFixed().positionMeters());
    }

    @Test void fixedTimeIsDeterministicAndAgeIsSigned() {
        OrbitalElementSet elements = fixture();
        assertEquals(propagator.propagate(elements, LATER), propagator.propagate(elements, LATER));
        assertEquals(Duration.ofHours(-1), propagator.propagate(elements, EPOCH.minusSeconds(3600)).propagationOffset());
    }

    @Test void rejectsTimeOutsideBundledEarthOrientationData() {
        assertThrows(OrbitalCalculationException.class,
                () -> propagator.propagate(fixture(), Instant.parse("2050-01-01T00:00:00Z")));
    }

    @Test void missingOrekitDataFailsExplicitly() {
        assertThrows(IllegalStateException.class,
                () -> new OrekitData("missing-utc.dat", "orekit-data/finals2000A.all"));
        assertThrows(IllegalStateException.class,
                () -> new OrekitData("orekit-data/tai-utc.dat", "missing-eop.all"));
    }

    private OrbitalElementSet fixture() {
        String[] lines = lines();
        return parser.parse(lines[1], lines[2], RETRIEVED, "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", SOURCE);
    }

    private static String[] lines() {
        try (var input = OrbitalCoreTest.class.getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            return new String(input.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
        } catch (IOException failure) {
            throw new AssertionError(failure);
        }
    }

    private static String withChecksum(String line) {
        int sum = 0;
        for (int i = 0; i < 68; i++) {
            char c = line.charAt(i);
            if (c >= '0' && c <= '9') sum += c - '0';
            else if (c == '-') sum++;
        }
        return line.substring(0, 68) + (sum % 10);
    }

    private static void assertVectorNear(Vector3 expected, Vector3 actual, double componentTolerance) {
        assertAll(() -> assertEquals(expected.x(), actual.x(), componentTolerance),
                () -> assertEquals(expected.y(), actual.y(), componentTolerance),
                () -> assertEquals(expected.z(), actual.z(), componentTolerance));
    }
}
