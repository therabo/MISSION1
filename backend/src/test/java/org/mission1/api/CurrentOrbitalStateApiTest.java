package org.mission1.api;

import static org.hamcrest.Matchers.closeTo;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.application.OrbitalSampleWindow;
import org.mission1.orbital.application.OrbitalSampleWindowService;
import org.mission1.orbital.oem.NasaOemTrajectoryService;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.source.orbital.celestrak.CelesTrakOrbitalElementsSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Offline PostgreSQL → repository → Orekit/quality → HTTP read slice. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CurrentOrbitalStateApiTest {
    private static final Instant RETRIEVED = Instant.parse("2026-09-28T13:58:32Z");
    private static final Instant NOW = RETRIEVED.plus(Duration.ofHours(1));
    private static final URI SOURCE = URI.create(
            "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10")
            .withDatabaseName("mission1_api_test")
            .withUsername("mission1_api_test")
            .withPassword("test_only");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired OrbitalElementSetRepository repository;
    @Autowired TleElementParser parser;
    @Autowired JdbcTemplate jdbc;
    @Autowired OrbitalSampleWindowService windowService;
    @MockitoBean Clock clock;
    @MockitoBean CelesTrakOrbitalElementsSource source;
    @MockitoBean NasaOemTrajectoryService nasaOem;

    @BeforeEach
    void emptyHistory() {
        jdbc.execute("TRUNCATE orbital_element_observations, orbital_element_sets RESTART IDENTITY CASCADE");
        reset(clock, source, nasaOem);
        when(clock.instant()).thenReturn(NOW);
    }

    @Test
    void currentEndpointReturnsNumericallyCheckedComputedStateAndLineage() throws Exception {
        OrbitalElementSet elements = fixture(RETRIEVED);
        repository.storeIfNew(elements);

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.satellite.noradCatalogNumber").value(25544))
                .andExpect(jsonPath("$.propagationTime").value(NOW.toString()))
                .andExpect(jsonPath("$.state.frame").value("TEME"))
                // Independent python-sgp4 2.25 reference at NOW, in SI units.
                .andExpect(jsonPath("$.state.positionMeters.x", closeTo(5_204_857.861561, 0.01)))
                .andExpect(jsonPath("$.state.positionMeters.y", closeTo(-4_232_393.007102, 0.01)))
                .andExpect(jsonPath("$.state.positionMeters.z", closeTo(1_074_731.935090, 0.01)))
                .andExpect(jsonPath("$.state.velocityMetersPerSecond.x", closeTo(3_774.405231, 0.0001)))
                .andExpect(jsonPath("$.state.velocityMetersPerSecond.y", closeTo(3_139.285907, 0.0001)))
                .andExpect(jsonPath("$.state.velocityMetersPerSecond.z", closeTo(-5_887.302950, 0.0001)))
                .andExpect(jsonPath("$.geodetic.datum").value("WGS84"))
                // Independent Skyfield 1.53 ITRS/WGS84 path has different EOP handling.
                .andExpect(jsonPath("$.geodetic.latitudeDegrees", closeTo(9.158314655, 0.002)))
                .andExpect(jsonPath("$.geodetic.longitudeDegrees", closeTo(88.848788318, 0.002)))
                .andExpect(jsonPath("$.geodetic.altitudeMeters", closeTo(416_423.251846, 100.0)))
                .andExpect(jsonPath("$.source.provider").value("CELESTRAK_GP"))
                .andExpect(jsonPath("$.source.upstreamOrigin").value("USSF_GP_VIA_CELESTRAK"))
                .andExpect(jsonPath("$.source.elementEpoch").value(elements.elementEpoch().toString()))
                .andExpect(jsonPath("$.source.retrievedAt").value(RETRIEVED.toString()))
                .andExpect(jsonPath("$.source.elementSha256").value(elements.sha256()))
                .andExpect(jsonPath("$.source.classification").value("SOURCE_PROVIDED_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.classification").value("COMPUTED_FROM_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.quality.status").value("GOOD"))
                .andExpect(jsonPath("$.quality.reason").value("NONE"))
                .andExpect(jsonPath("$.quality.policy").value("orbital-current-v1"))
                .andExpect(jsonPath("$.sourceHealth.status").value("UNKNOWN"))
                .andExpect(jsonPath("$.sourceHealth.lastSuccessAt").value(RETRIEVED.toString()))
                .andExpect(jsonPath("$.sourceHealth.consecutiveFailures").value(0))
                .andExpect(jsonPath("$.quality.retrievalAgeSeconds").value(3600.0))
                .andExpect(jsonPath("$.quality.elementAgeSeconds",
                        closeTo(Duration.between(elements.elementEpoch(), NOW).toNanos() / 1e9, 1e-6)))
                .andExpect(jsonPath("$.quality.propagationOffsetSeconds",
                        closeTo(Duration.between(elements.elementEpoch(), NOW).toNanos() / 1e9, 1e-6)));
        verify(clock, times(1)).instant();
        verifyNoInteractions(source);
    }

    @Test
    void oldElementsReturnStaleCoordinatesWithHttp200() throws Exception {
        OrbitalElementSet elements = fixture(RETRIEVED);
        repository.storeIfNew(elements);
        Instant staleNow = elements.elementEpoch().plus(Duration.ofHours(25));
        when(clock.instant()).thenReturn(staleNow);

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.propagationTime").value(staleNow.toString()))
                .andExpect(jsonPath("$.state.positionMeters.x").isNumber())
                .andExpect(jsonPath("$.quality.status").value("STALE"))
                .andExpect(jsonPath("$.quality.reason").value("ELEMENT_TOO_OLD"));
        verifyNoInteractions(source);
    }

    @Test
    void longitudeUsesOrekitSignedDegreeConventionAtWesternPosition() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        when(clock.instant()).thenReturn(Instant.parse("2026-09-28T15:42:33.884625Z"));

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isOk())
                // Independent Skyfield 1.53 WGS84 longitude for the same frozen TLE/time.
                .andExpect(jsonPath("$.geodetic.longitudeDegrees", closeTo(-108.557887850, 0.002)));
        verifyNoInteractions(source);
    }

    @Test
    void emptyHistoryReturnsStructured503WithoutCoordinates() throws Exception {
        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:no-orbital-elements"))
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.title").value("Orbital state unavailable"))
                .andExpect(jsonPath("$.detail").isString())
                .andExpect(jsonPath("$.state").doesNotExist());
        verifyNoInteractions(source);
    }

    @Test
    void futureOrUnobservedElementsDoNotSupplyTheCurrentState() throws Exception {
        repository.storeIfNew(fixture(NOW.plusSeconds(1)));
        // Test-only altered TLE epoch: a future solution is not eligible even if observed.
        repository.storeIfNew(revisionWithEpoch("26272.14212772", RETRIEVED));

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:no-orbital-elements"));
        verifyNoInteractions(source);
    }

    @Test
    void latestEligibleEpochWinsRegardlessOfInsertionOrder() throws Exception {
        OrbitalElementSet current = fixture(RETRIEVED);
        OrbitalElementSet older = revisionWithEpoch("26270.14212772", RETRIEVED.minusSeconds(1));
        repository.storeIfNew(current);
        repository.storeIfNew(older);

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source.elementSha256").value(current.sha256()))
                .andExpect(jsonPath("$.source.elementEpoch").value(current.elementEpoch().toString()));
        verifyNoInteractions(source);
    }

    @Test
    void corruptStoredMetadataReturnsSanitized500() throws Exception {
        long id = repository.storeIfNew(fixture(RETRIEVED)).id();
        jdbc.update("UPDATE orbital_element_sets SET sha256 = ? WHERE id = ?", "0".repeat(64), id);

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:orbital-data-integrity-error"))
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.detail").isString())
                .andExpect(jsonPath("$.state").doesNotExist());
        verifyNoInteractions(source);
    }

    @Test
    void propagationFailureReturnsSanitized500() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        when(clock.instant()).thenReturn(Instant.parse("2050-01-01T00:00:00Z"));

        mvc.perform(get("/api/iss/state"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:orbital-calculation-failed"))
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.state").doesNotExist());
        verifyNoInteractions(source);
    }

    @Test
    void sampleWindowReturnsOneNamedElementSetAndEarthFixedPositions() throws Exception {
        OrbitalElementSet elements = fixture(RETRIEVED);
        repository.storeIfNew(elements);
        mvc.perform(get("/api/iss/orbit/samples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedAt").value(NOW.toString()))
                .andExpect(jsonPath("$.windowStart").value(NOW.minusSeconds(120).toString()))
                .andExpect(jsonPath("$.windowEnd").value(NOW.plusSeconds(600).toString()))
                .andExpect(jsonPath("$.stepSeconds").value(10))
                .andExpect(jsonPath("$.samples.length()").value(73))
                .andExpect(jsonPath("$.samples[0].time").value(NOW.minusSeconds(120).toString()))
                .andExpect(jsonPath("$.samples[12].time").value(NOW.toString()))
                .andExpect(jsonPath("$.samples[72].time").value(NOW.plusSeconds(600).toString()))
                .andExpect(jsonPath("$.frame").value("ITRF_2020_IERS_2010"))
                .andExpect(jsonPath("$.positionUnit").value("m"))
                // Independent Skyfield ITRS/WGS84 reference at NOW; its EOP handling differs.
                .andExpect(jsonPath("$.samples[12].xMeters", closeTo(134_780.612238, 150)))
                .andExpect(jsonPath("$.samples[12].yMeters", closeTo(6_707_125.324273, 150)))
                .andExpect(jsonPath("$.samples[12].zMeters", closeTo(1_074_731.933559, 150)))
                .andExpect(jsonPath("$.currentGeodetic.latitudeDegrees", closeTo(9.158314655, 0.002)))
                .andExpect(jsonPath("$.currentGeodetic.longitudeDegrees", closeTo(88.848788318, 0.002)))
                .andExpect(jsonPath("$.source.elementSha256").value(elements.sha256()))
                .andExpect(jsonPath("$.source.elementEpoch").value(elements.elementEpoch().toString()))
                .andExpect(jsonPath("$.source.retrievedAt").value(RETRIEVED.toString()))
                .andExpect(jsonPath("$.source.provider").value("CELESTRAK_GP"))
                .andExpect(jsonPath("$.source.propagationMethod").value("OREKIT_TLE_SGP4_SDP4"))
                .andExpect(jsonPath("$.classification").value("COMPUTED_FROM_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.timeSemantics.past").value("RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.timeSemantics.future").value("COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.qualityAtGeneratedAt.status").value("GOOD"))
                .andExpect(jsonPath("$.qualityAtGeneratedAt.policy").value("orbital-current-v1"))
                .andExpect(jsonPath("$.sourceHealth.status").value("UNKNOWN"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM orbital_element_sets", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM orbital_element_observations", Integer.class));
        verify(clock, times(1)).instant();
        verifyNoInteractions(source);
    }

    @Test
    void staleElementsStillYieldSampleWindowAndExplicitStaleQuality() throws Exception {
        OrbitalElementSet elements = fixture(RETRIEVED);
        repository.storeIfNew(elements);
        Instant staleNow = elements.elementEpoch().plus(Duration.ofHours(25));
        when(clock.instant()).thenReturn(staleNow);
        mvc.perform(get("/api/iss/orbit/samples"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qualityAtGeneratedAt.status").value("STALE"))
                .andExpect(jsonPath("$.qualityAtGeneratedAt.reason").value("ELEMENT_TOO_OLD"))
                .andExpect(jsonPath("$.samples.length()").value(73));
        verifyNoInteractions(source);
    }

    @Test
    void noElementsReturns503ForSampleWindow() throws Exception {
        mvc.perform(get("/api/iss/orbit/samples"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:no-orbital-elements"))
                .andExpect(jsonPath("$.samples").doesNotExist());
        verifyNoInteractions(source);
    }

    @Test
    void comparisonEndpointSeparatesPrimaryAndUnavailableOem() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        when(nasaOem.comparison(any())).thenReturn(new NasaOemTrajectoryService.Result(
                "UNAVAILABLE", "NO_VALID_OEM_FILE", null, java.util.List.of()));
        mvc.perform(get("/api/iss/orbit/comparison"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.primary.classification").value("COMPUTED_FROM_ORBITAL_ELEMENTS"))
                .andExpect(jsonPath("$.primary.samples.length()").value(181))
                .andExpect(jsonPath("$.primary.currentSampleIndex").value(90))
                .andExpect(jsonPath("$.primary.samples[90].time").value(NOW.toString()))
                .andExpect(jsonPath("$.oem.classification").value("SOURCE_PROVIDED_PREDICTED_EPHEMERIS"))
                .andExpect(jsonPath("$.oem.availability").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.oem.samples.length()").value(0));
        verifyNoInteractions(source);
    }

    @Test
    void explicitShortWindowUsesInclusiveTimeGrid() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        mvc.perform(get("/api/iss/orbit/samples?pastSeconds=0&futureSeconds=30&stepSeconds=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.samples.length()").value(7))
                .andExpect(jsonPath("$.windowStart").value(NOW.toString()))
                .andExpect(jsonPath("$.windowEnd").value(NOW.plusSeconds(30).toString()))
                .andExpect(jsonPath("$.samples[0].time").value(NOW.toString()))
                .andExpect(jsonPath("$.samples[6].time").value(NOW.plusSeconds(30).toString()));
        verifyNoInteractions(source);
    }

    @Test
    void invalidSampleBoundsReturn400ProblemDetail() throws Exception {
        for (String path : new String[] {
                "/api/iss/orbit/samples?pastSeconds=-1",
                "/api/iss/orbit/samples?futureSeconds=1201",
                "/api/iss/orbit/samples?stepSeconds=0",
                "/api/iss/orbit/samples?stepSeconds=31",
                "/api/iss/orbit/samples?pastSeconds=121",
                "/api/iss/orbit/samples?pastSeconds=300&futureSeconds=1200&stepSeconds=30",
                "/api/iss/orbit/samples?pastSeconds=300&futureSeconds=900&stepSeconds=5",
                "/api/iss/orbit/samples?futureSeconds=abc"
        }) {
            mvc.perform(get(path))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                    .andExpect(jsonPath("$.type").value("urn:mission1:problem:invalid-orbital-sample-window"));
        }
        verifyNoInteractions(source);
    }

    @Test
    void samplePropagationFailureReturnsSanitized500() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        when(clock.instant()).thenReturn(Instant.parse("2050-01-01T00:00:00Z"));
        mvc.perform(get("/api/iss/orbit/samples"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.type").value("urn:mission1:problem:orbital-calculation-failed"))
                .andExpect(jsonPath("$.samples").doesNotExist());
        verifyNoInteractions(source);
    }

    @Test
    void defaultWindowCostAndPayloadStaySmall() throws Exception {
        repository.storeIfNew(fixture(RETRIEVED));
        var bounds = new OrbitalSampleWindow(120, 600, 10);
        windowService.generate(bounds); // Warm class loading and Orekit data access.
        long[] nanoseconds = new long[10];
        for (int index = 0; index < nanoseconds.length; index++) {
            long began = System.nanoTime();
            windowService.generate(bounds);
            nanoseconds[index] = System.nanoTime() - began;
        }
        java.util.Arrays.sort(nanoseconds);
        byte[] body = mvc.perform(get("/api/iss/orbit/samples"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertTrue(body.length < 20_000);
        System.out.printf("ORBIT_WINDOW samples=%d payloadBytes=%d medianGenerationMs=%.2f%n",
                bounds.sampleCount(), body.length, nanoseconds[5] / 1_000_000.0);
        var maximumCount = new OrbitalSampleWindow(300, 600, 5);
        windowService.generate(maximumCount);
        long beganMaximum = System.nanoTime();
        windowService.generate(maximumCount);
        double maximumGenerationMs = (System.nanoTime() - beganMaximum) / 1_000_000.0;
        byte[] maximumBody = mvc.perform(get("/api/iss/orbit/samples?pastSeconds=300&futureSeconds=600&stepSeconds=5"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertTrue(maximumBody.length < 35_000);
        System.out.printf("ORBIT_WINDOW samples=%d payloadBytes=%d warmGenerationMs=%.2f%n",
                maximumCount.sampleCount(), maximumBody.length, maximumGenerationMs);
        verifyNoInteractions(source);
    }

    private OrbitalElementSet fixture(Instant retrievedAt) {
        String[] lines = fixtureLines();
        return parser.parse(lines[1], lines[2], retrievedAt, "CELESTRAK_GP",
                "USSF_GP_VIA_CELESTRAK", SOURCE);
    }

    private OrbitalElementSet revisionWithEpoch(String day, Instant retrievedAt) {
        String[] lines = fixtureLines();
        String changed = lines[1].replace("26271.14212772", day);
        assertNotEquals(lines[1], changed);
        return parser.parse(withChecksum(changed), lines[2], retrievedAt, "CELESTRAK_GP",
                "USSF_GP_VIA_CELESTRAK", SOURCE);
    }

    private static String[] fixtureLines() {
        try (var input = CurrentOrbitalStateApiTest.class.getResourceAsStream("/iss-2026-09-28.tle")) {
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
}
