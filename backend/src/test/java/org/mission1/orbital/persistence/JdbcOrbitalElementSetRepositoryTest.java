package org.mission1.orbital.persistence;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mission1.orbital.application.OrbitalElementSetRepository;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.oem.NasaOemRepository;
import org.mission1.orbital.propagation.TleElementParser;
import org.mission1.source.orbital.nasa.NasaOemXmlParser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class JdbcOrbitalElementSetRepositoryTest {
    private static final Instant RETRIEVED = Instant.parse("2026-09-28T13:58:32Z");
    private static final URI SOURCE = URI.create(
            "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.10")
            .withDatabaseName("mission1_test")
            .withUsername("mission1_test")
            .withPassword("test_only");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired OrbitalElementSetRepository repository;
    @Autowired TleElementParser parser;
    @Autowired NasaOemRepository oemRepository;
    @Autowired NasaOemXmlParser oemParser;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void emptyHistory() {
        jdbc.execute("TRUNCATE orbital_element_observations, orbital_element_sets, nasa_oem_ephemerides RESTART IDENTITY CASCADE");
    }

    @Test
    void flywayMigratesAnEmptyPostgresDatabase() {
        assertEquals(11, jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = true", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT count(*) FROM orbital_element_sets", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT count(*) FROM orbital_element_observations", Integer.class));
        assertNotNull(jdbc.queryForObject("SELECT count(*) FROM nasa_oem_ephemerides", Integer.class));
        assertTrue(repository.recent(10).isEmpty());
        assertTrue(repository.latestUsable(RETRIEVED).isEmpty());
        assertTrue(repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544).isEmpty());
    }

    @Test
    void storesNasaOemSourceBytesAndSeparateRetrievalAndCreationTimes() throws IOException {
        byte[] xml;
        try (var input = getClass().getResourceAsStream("/nasa-oem-2026-09-30-excerpt.xml")) {
            assertNotNull(input);
            xml = input.readAllBytes();
        }
        var document = oemParser.parse(xml);
        Instant retrieved = Instant.parse("2026-09-30T10:30:00Z");
        Instant modified = Instant.parse("2026-09-28T17:27:12Z");
        oemRepository.store(document, xml, retrieved, modified);
        var stored = oemRepository.latest().orElseThrow();
        assertArrayEquals(xml, stored.xml());
        assertEquals(retrieved, stored.retrievedAt());
        assertEquals(modified, stored.httpLastModified());
        assertNotEquals(document.creationDate(), stored.retrievedAt());
    }

    @Test
    void storesAndReconstructsAllDomainFieldsIncludingRawLinesAndDistinctTimes() {
        OrbitalElementSet original = realFixture();
        var stored = repository.storeIfNew(original);
        assertTrue(stored.elementInserted());
        assertTrue(stored.observationInserted());
        assertEquals(original, repository.findById(stored.id()).orElseThrow().elements());
        assertEquals(original.line1(), repository.findById(stored.id()).orElseThrow().elements().line1());
        assertEquals(original.line2(), repository.findById(stored.id()).orElseThrow().elements().line2());
        assertEquals(original.elementEpoch(), repository.findById(stored.id()).orElseThrow().elements().elementEpoch());
        assertEquals(RETRIEVED, repository.findById(stored.id()).orElseThrow().elements().retrievedAt());
        assertNull(repository.findById(stored.id()).orElseThrow().elements().publishedAt());
        assertNotEquals(original.elementEpoch(), original.retrievedAt());
        assertEquals(1, count("orbital_element_sets"));
        assertEquals(1, count("orbital_element_observations"));
    }

    @Test
    void duplicateFetchIsIdempotentButNewRetrievalIsPreserved() {
        OrbitalElementSet original = realFixture();
        var first = repository.storeIfNew(original);
        var duplicate = repository.storeIfNew(original);
        Instant later = RETRIEVED.plus(Duration.ofHours(2));
        var repeated = repository.storeIfNew(withRetrieval(original, later));

        assertEquals(first.id(), duplicate.id());
        assertEquals(first.id(), repeated.id());
        assertFalse(duplicate.elementInserted());
        assertFalse(duplicate.observationInserted());
        assertFalse(repeated.elementInserted());
        assertTrue(repeated.observationInserted());
        assertEquals(1, count("orbital_element_sets"));
        assertEquals(2, count("orbital_element_observations"));
        assertEquals(later, repository.lastSuccessfulRetrieval("CELESTRAK_GP", 25544).orElseThrow());
        assertTrue(repository.lastSuccessfulRetrieval("OTHER_PROVIDER", 25544).isEmpty());
        assertEquals(later, repository.findById(first.id()).orElseThrow().elements().retrievedAt());
        assertEquals(RETRIEVED, repository.latestUsable(RETRIEVED).orElseThrow().elements().retrievedAt());
    }

    @Test
    void concurrentStoresStillProduceOneSetAndOneObservation() throws Exception {
        OrbitalElementSet fixture = realFixture();
        CountDownLatch start = new CountDownLatch(1);
        try (var threads = Executors.newFixedThreadPool(2)) {
            var first = threads.submit(() -> {
                start.await();
                return repository.storeIfNew(fixture);
            });
            var second = threads.submit(() -> {
                start.await();
                return repository.storeIfNew(fixture);
            });
            start.countDown();
            var a = first.get(10, TimeUnit.SECONDS);
            var b = second.get(10, TimeUnit.SECONDS);
            assertEquals(a.id(), b.id());
            assertNotEquals(a.elementInserted(), b.elementInserted());
            assertEquals(1, count("orbital_element_sets"));
            assertEquals(1, count("orbital_element_observations"));
        }
    }

    @Test
    void postgresEnforcesBothElementAndObservationUniqueness() {
        var result = repository.storeIfNew(realFixture());
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO orbital_element_sets
                    (catalog_number, source_format, line1, line2, element_epoch, provider,
                     upstream_origin, source_uri, published_at, sha256, classification)
                SELECT catalog_number, source_format, line1, line2, element_epoch, provider,
                       upstream_origin, source_uri, published_at, sha256, classification
                FROM orbital_element_sets WHERE id = ?
                """, result.id()));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO orbital_element_observations (element_set_id, retrieved_at)
                VALUES (?, ?)
                """, result.id(), java.sql.Timestamp.from(RETRIEVED)));
    }

    @Test
    void distinctRevisionsRemainAndHistoryUsesEpochRatherThanInsertionOrder() {
        OrbitalElementSet first = realFixture();
        OrbitalElementSet second = testOnlyNextEpochRevision(first, RETRIEVED.plus(Duration.ofDays(1)));
        repository.storeIfNew(second);
        repository.storeIfNew(first);
        assertEquals(2, count("orbital_element_sets"));
        assertEquals(second.sha256(), repository.recent(2).getFirst().elements().sha256());
        assertEquals(first.sha256(), repository.recent(2).get(1).elements().sha256());
        assertEquals(second.sha256(), repository.recent(1).getFirst().elements().sha256());
    }

    @Test
    void latestUsableRequiresObservationAndEpochNoLaterThanAsOf() {
        OrbitalElementSet first = realFixture();
        OrbitalElementSet second = testOnlyNextEpochRevision(first, RETRIEVED.plus(Duration.ofDays(1)));
        repository.storeIfNew(first);
        repository.storeIfNew(second);

        assertTrue(repository.latestUsable(RETRIEVED.minusSeconds(1)).isEmpty());
        assertEquals(first.sha256(), repository.latestUsable(RETRIEVED).orElseThrow().elements().sha256());
        assertEquals(first.sha256(), repository.latestUsable(second.elementEpoch()).orElseThrow().elements().sha256());
        assertEquals(second.sha256(), repository.latestUsable(second.retrievedAt()).orElseThrow().elements().sha256());
        assertEquals(second.sha256(), repository.latestUsable(second.retrievedAt().plus(Duration.ofDays(3)))
                .orElseThrow().elements().sha256());
    }

    @Test
    void sourceMetadataConflictCannotSilentlyOverwriteExistingSet() {
        OrbitalElementSet original = realFixture();
        repository.storeIfNew(original);
        OrbitalElementSet conflicting = new OrbitalElementSet(original.catalogNumber(), original.sourceFormat(),
                original.line1(), original.line2(), original.elementEpoch(), original.provider(),
                "OTHER_UPSTREAM_TEST_ONLY", original.sourceUri(), original.retrievedAt().plusSeconds(10),
                original.publishedAt(), original.sha256(), original.classification());
        assertThrows(IllegalStateException.class, () -> repository.storeIfNew(conflicting));
        assertEquals(1, count("orbital_element_observations"));
    }

    @Test
    void invalidCatalogAndHashCannotEnterThroughRepository() {
        OrbitalElementSet original = realFixture();
        OrbitalElementSet wrongCatalog = new OrbitalElementSet(99999, original.sourceFormat(),
                original.line1(), original.line2(), original.elementEpoch(), original.provider(),
                original.upstreamOrigin(), original.sourceUri(), original.retrievedAt(),
                original.publishedAt(), original.sha256(), original.classification());
        OrbitalElementSet wrongHash = new OrbitalElementSet(original.catalogNumber(), original.sourceFormat(),
                original.line1(), original.line2(), original.elementEpoch(), original.provider(),
                original.upstreamOrigin(), original.sourceUri(), original.retrievedAt(),
                original.publishedAt(), "0".repeat(64), original.classification());
        assertThrows(IllegalArgumentException.class, () -> repository.storeIfNew(wrongCatalog));
        assertThrows(IllegalArgumentException.class, () -> repository.storeIfNew(wrongHash));
        assertEquals(0, count("orbital_element_sets"));
    }

    @Test
    void postgresCatalogConstraintAndCorruptRowErrorsAreSurfaced() {
        var stored = repository.storeIfNew(realFixture());
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE orbital_element_sets SET catalog_number = 99999 WHERE id = ?", stored.id()));
        jdbc.update("UPDATE orbital_element_sets SET sha256 = ? WHERE id = ?", "0".repeat(64), stored.id());
        assertThrows(IllegalArgumentException.class, () -> repository.findById(stored.id()));
    }

    @Test
    void timestampPrecisionIsExplicitRatherThanSilentlyRounded() {
        OrbitalElementSet original = realFixture();
        assertThrows(IllegalArgumentException.class,
                () -> repository.storeIfNew(withRetrieval(original, RETRIEVED.plusNanos(1))));
        assertEquals(0, count("orbital_element_sets"));
    }

    @Test
    void optionalPublicationTimeRoundTripsWithoutBecomingRetrievalTime() {
        OrbitalElementSet real = realFixture();
        // Publication is unavailable in the real source; this is mapping test data only.
        Instant testPublication = RETRIEVED.minusSeconds(30);
        OrbitalElementSet withTestPublication = new OrbitalElementSet(real.catalogNumber(),
                real.sourceFormat(), real.line1(), real.line2(), real.elementEpoch(), real.provider(),
                real.upstreamOrigin(), real.sourceUri(), real.retrievedAt(), testPublication,
                real.sha256(), real.classification());
        long id = repository.storeIfNew(withTestPublication).id();
        OrbitalElementSet restored = repository.findById(id).orElseThrow().elements();
        assertEquals(testPublication, restored.publishedAt());
        assertEquals(RETRIEVED, restored.retrievedAt());
        assertEquals(real.elementEpoch(), restored.elementEpoch());
    }

    @Test
    void historyLimitIsBounded() {
        assertThrows(IllegalArgumentException.class, () -> repository.recent(0));
        assertThrows(IllegalArgumentException.class, () -> repository.recent(101));
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    private OrbitalElementSet realFixture() {
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

    private static OrbitalElementSet withRetrieval(OrbitalElementSet original, Instant retrievedAt) {
        return new OrbitalElementSet(original.catalogNumber(), original.sourceFormat(),
                original.line1(), original.line2(), original.elementEpoch(), original.provider(),
                original.upstreamOrigin(), original.sourceUri(), retrievedAt, original.publishedAt(),
                original.sha256(), original.classification());
    }

    /** A test-only synthetic revision of the frozen real fixture; never offered as ISS source data. */
    private OrbitalElementSet testOnlyNextEpochRevision(OrbitalElementSet original, Instant retrievedAt) {
        String changed = original.line1().replace("26271.14212772", "26272.14212772");
        assertNotEquals(original.line1(), changed);
        return parser.parse(withChecksum(changed), original.line2(), retrievedAt,
                original.provider(), original.upstreamOrigin(), original.sourceUri());
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
