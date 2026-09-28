package org.mission1.orbital.application;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.mission1.orbital.domain.OrbitalElementSet;
import org.mission1.orbital.domain.OrbitalEvaluation;
import org.mission1.orbital.domain.OrbitalQualityReason;
import org.mission1.orbital.domain.Quality;
import org.mission1.orbital.domain.SourceAcquisitionHealth;
import org.mission1.orbital.domain.SourceAcquisitionHealth.Status;
import org.mission1.orbital.propagation.OrekitData;
import org.mission1.orbital.propagation.OrekitOrbitalPropagator;
import org.mission1.orbital.propagation.TleElementParser;

class OrbitalQualityEvaluatorTest {
    private static final Instant EPOCH = Instant.parse("2026-09-28T03:24:39.835008Z");
    private static final Instant RETRIEVED = Instant.parse("2026-09-28T13:58:32Z");
    private static final URI SOURCE = URI.create("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE");
    private static final Duration GOOD_LIMIT = Duration.ofHours(24);
    private final OrekitData data = new OrekitData();
    private final TleElementParser parser = new TleElementParser(data);
    private final OrbitalQualityEvaluator evaluator = new OrbitalQualityEvaluator(
            new OrekitOrbitalPropagator(data, parser), OrbitalFreshnessPolicy.standardGpCurrent());

    @Test void noElementsMeansNoDataEvenAfterFailedFetch() {
        OrbitalEvaluation result = evaluate(null, EPOCH.plusSeconds(1), degraded());
        assertAll(
                () -> assertEquals(Quality.NO_DATA, result.quality()),
                () -> assertEquals(OrbitalQualityReason.NO_ORBITAL_ELEMENTS, result.reason()),
                () -> assertNull(result.state()),
                () -> assertNull(result.elementEpochAge()),
                () -> assertNull(result.retrievalAge()),
                () -> assertEquals(Status.DEGRADED, result.sourceHealth().status()));
    }

    @Test void malformedChecksumAndWrongIdentityAreInvalid() {
        OrbitalElementSet good = fixture();
        String badLine = good.line2().substring(0, 68) + (good.line2().charAt(68) == '0' ? '1' : '0');
        OrbitalElementSet malformed = copy(good, good.catalogNumber(), good.line1(), badLine,
                good.elementEpoch(), good.retrievedAt(), good.sha256());
        OrbitalElementSet wrongIdentity = copy(good, 99999, good.line1(), good.line2(),
                good.elementEpoch(), good.retrievedAt(), good.sha256());
        for (OrbitalElementSet invalid : new OrbitalElementSet[] {malformed, wrongIdentity}) {
            OrbitalEvaluation result = evaluate(invalid, EPOCH.plus(Duration.ofHours(48)), healthy());
            assertEquals(Quality.INVALID, result.quality());
            assertEquals(OrbitalQualityReason.INVALID_ORBITAL_ELEMENTS, result.reason());
            assertNull(result.state());
            assertTrue(result.elementEpochAge().compareTo(GOOD_LIMIT) > 0);
        }
    }

    @Test void freshSetIsGoodAndCarriesLineageAndPolicyVersion() {
        OrbitalElementSet elements = fixture();
        Instant now = EPOCH.plus(Duration.ofHours(12));
        OrbitalEvaluation result = evaluate(elements, now, healthy());
        assertAll(
                () -> assertEquals(Quality.GOOD, result.quality()),
                () -> assertEquals(Quality.GOOD, result.state().quality()),
                () -> assertEquals(OrbitalQualityReason.NONE, result.reason()),
                () -> assertEquals("orbital-current-v1", result.policyId()),
                () -> assertEquals(now, result.evaluationTime()),
                () -> assertEquals(elements.sha256(), result.elementSha256()),
                () -> assertEquals(elements.provider(), result.provider()),
                () -> assertEquals(EPOCH, result.elementEpoch()),
                () -> assertEquals(RETRIEVED, result.retrievedAt()),
                () -> assertEquals(Duration.ofHours(12), result.elementEpochAge()),
                () -> assertEquals(Duration.between(RETRIEVED, now), result.retrievalAge()),
                () -> assertEquals(Duration.ofHours(12), result.propagationOffset()));
    }

    @Test void goodBoundaryIsInclusiveAndOneNanosecondBeyondIsStale() {
        OrbitalElementSet elements = fixture();
        OrbitalEvaluation boundary = evaluate(elements, EPOCH.plus(GOOD_LIMIT), healthy());
        OrbitalEvaluation beyond = evaluate(elements, EPOCH.plus(GOOD_LIMIT).plusNanos(1), healthy());
        assertEquals(Quality.GOOD, boundary.quality());
        assertEquals(OrbitalQualityReason.NONE, boundary.reason());
        assertEquals(Quality.STALE, beyond.quality());
        assertEquals(Quality.STALE, beyond.state().quality());
        assertEquals(OrbitalQualityReason.ELEMENT_TOO_OLD, beyond.reason());
    }

    @Test void recentRetrievalDoesNotMakeOldElementGood() {
        OrbitalElementSet original = fixture();
        Instant now = EPOCH.plus(Duration.ofHours(30));
        OrbitalElementSet recentlyRetrieved = copy(original, original.catalogNumber(), original.line1(),
                original.line2(), original.elementEpoch(), now.minusSeconds(1), original.sha256());
        OrbitalEvaluation result = evaluate(recentlyRetrieved, now, healthy());
        assertEquals(Duration.ofSeconds(1), result.retrievalAge());
        assertEquals(Duration.ofHours(30), result.elementEpochAge());
        assertEquals(Quality.STALE, result.quality());
        assertEquals(OrbitalQualityReason.ELEMENT_TOO_OLD, result.reason());
    }

    @Test void oldRetrievalDoesNotReplaceFreshElementAge() {
        OrbitalElementSet original = fixture();
        Instant now = EPOCH.plus(Duration.ofHours(3));
        OrbitalElementSet oldReceipt = copy(original, original.catalogNumber(), original.line1(),
                original.line2(), original.elementEpoch(), EPOCH.minus(Duration.ofDays(5)), original.sha256());
        OrbitalEvaluation result = evaluate(oldReceipt, now, healthy());
        assertEquals(Duration.ofDays(5).plusHours(3), result.retrievalAge());
        assertEquals(Duration.ofHours(3), result.elementEpochAge());
        assertEquals(Quality.GOOD, result.quality());
    }

    @Test void nonCurrentPropagationKeepsBothClocksAndSignedOffset() {
        Instant evaluationTime = EPOCH.plus(Duration.ofHours(3));
        Instant propagationTime = EPOCH.minus(Duration.ofHours(1));
        OrbitalEvaluation result = evaluator.evaluate(fixture(), evaluationTime, propagationTime, healthy());
        assertEquals(Quality.UNKNOWN, result.quality());
        assertEquals(OrbitalQualityReason.NOT_CURRENT_EVALUATION, result.reason());
        assertEquals(Duration.ofHours(3), result.elementEpochAge());
        assertEquals(Duration.ofHours(-1), result.propagationOffset());
        assertEquals(propagationTime, result.state().propagationTime());
        assertEquals(Duration.ofHours(-1), result.state().propagationOffset());
    }

    @Test void futureElementEpochHasUnknownCurrentFreshness() {
        OrbitalEvaluation result = evaluate(fixture(), EPOCH.minusSeconds(1), healthy());
        assertEquals(Quality.UNKNOWN, result.quality());
        assertEquals(OrbitalQualityReason.ELEMENT_EPOCH_IN_FUTURE, result.reason());
        assertEquals(Duration.ofSeconds(-1), result.elementEpochAge());
    }

    @Test void providerOutageAndStateQualityAreIndependent() {
        OrbitalEvaluation cachedFresh = evaluate(fixture(), EPOCH.plus(Duration.ofHours(3)), degraded());
        OrbitalEvaluation cachedStale = evaluate(fixture(), EPOCH.plus(Duration.ofHours(48)), degraded());
        OrbitalEvaluation newlyFetchedStale = evaluate(fixture(), EPOCH.plus(Duration.ofHours(48)), healthy());
        assertEquals(Quality.GOOD, cachedFresh.quality());
        assertEquals(Status.DEGRADED, cachedFresh.sourceHealth().status());
        assertEquals(Quality.STALE, cachedStale.quality());
        assertEquals(Status.DEGRADED, cachedStale.sourceHealth().status());
        assertEquals(Quality.STALE, newlyFetchedStale.quality());
        assertEquals(Status.HEALTHY, newlyFetchedStale.sourceHealth().status());
    }

    @Test void computationFailureTakesPrecedenceOverStaleness() {
        Instant outsideEop = Instant.parse("2050-01-01T00:00:00Z");
        OrbitalEvaluation result = evaluate(fixture(), outsideEop, degraded());
        assertEquals(Quality.INVALID, result.quality());
        assertEquals(OrbitalQualityReason.EOP_DATA_UNAVAILABLE, result.reason());
        assertNull(result.state());
        assertTrue(result.elementEpochAge().compareTo(GOOD_LIMIT) > 0);
    }

    @Test void explicitEvaluationTimeIsDeterministic() {
        OrbitalElementSet elements = fixture();
        Instant now = EPOCH.plus(Duration.ofHours(13));
        assertEquals(evaluate(elements, now, healthy()), evaluate(elements, now, healthy()));
        assertEquals(Quality.STALE, evaluate(elements, EPOCH.plus(Duration.ofHours(25)), healthy()).quality());
    }

    @Test void policyRejectsNonpositiveLimit() {
        assertThrows(IllegalArgumentException.class,
                () -> new OrbitalFreshnessPolicy("orbital-current-v1", Duration.ZERO));
    }

    private OrbitalEvaluation evaluate(OrbitalElementSet elements, Instant now, SourceAcquisitionHealth health) {
        return evaluator.evaluate(elements, now, now, health);
    }

    private OrbitalElementSet fixture() {
        try (var input = getClass().getResourceAsStream("/iss-2026-09-28.tle")) {
            assertNotNull(input);
            String[] lines = new String(input.readAllBytes(), StandardCharsets.US_ASCII).lines().toArray(String[]::new);
            return parser.parse(lines[1], lines[2], RETRIEVED, "CELESTRAK_GP", "USSF_GP_VIA_CELESTRAK", SOURCE);
        } catch (IOException failure) {
            throw new AssertionError(failure);
        }
    }

    private static OrbitalElementSet copy(OrbitalElementSet original, int catalog, String line1, String line2,
                                          Instant epoch, Instant retrieved, String hash) {
        return new OrbitalElementSet(catalog, original.sourceFormat(), line1, line2, epoch,
                original.provider(), original.upstreamOrigin(), original.sourceUri(), retrieved,
                original.publishedAt(), hash, original.classification());
    }

    private static SourceAcquisitionHealth healthy() {
        return new SourceAcquisitionHealth(Status.HEALTHY, RETRIEVED, RETRIEVED, null);
    }

    private static SourceAcquisitionHealth degraded() {
        return new SourceAcquisitionHealth(Status.DEGRADED, RETRIEVED.plusSeconds(3600), RETRIEVED, "HTTP_503");
    }
}
