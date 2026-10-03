package org.mission1.source.crew.ll2;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.concurrent.atomic.AtomicInteger;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

class LaunchLibrary2CrewSourceTest {
    private static final Instant NOW = Instant.parse("2026-10-03T08:40:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private final ObjectMapper json = new ObjectMapper();

    @Test void mapsDetailedExpeditionWithOneRequestAndNoPresenceInference() throws Exception {
        withResponse(200, fixture("active-iss-expedition-detailed"), (source, requests) -> {
            var result = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.AVAILABLE, result.state());
            var snapshot = result.value();
            assertEquals(1, snapshot.totalActiveExpeditions()); assertTrue(snapshot.candidatesComplete());
            assertEquals(7, snapshot.assignments().size()); assertEquals(7, snapshot.profiles().size());
            assertEquals(CrewRole.COMMANDER, snapshot.assignments().getFirst().role());
            assertEquals(CrewRole.FLIGHT_ENGINEER, snapshot.assignments().get(1).role());
            assertTrue(snapshot.profiles().getFirst().inSpace());
            assertNull(snapshot.expeditions().getFirst().mission1Id());
            assertNull(snapshot.profiles().getFirst().person().mission1Id());
            assertNull(snapshot.assignments().getFirst().validFrom());
            assertEquals("168", snapshot.expeditions().getFirst().externalId().value()); // frozen source evidence only
            assertEquals(NOW, result.observation().retrievedAt());
            assertNull(result.observation().sourcePublishedAt()); assertNull(result.observation().sourceEventAt());
            assertEquals("test-etag", result.observation().httpEtag());
            assertEquals(1, requests.get()); // no station discovery or N astronaut calls
            assertEquals(CrewHttpReader.sha256(fixture("active-iss-expedition-detailed").getBytes(StandardCharsets.UTF_8)),
                    result.observation().contentHash());
        });
    }

    @Test void mapsDetailedProfileDurationsCountsAndUnknownRights() throws Exception {
        withResponse(200, fixture("astronaut-detail"), (source, requests) -> {
            var p = source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "573")).value();
            assertNotNull(p);
            assertEquals(Duration.parse("P436DT6H28M11S"), p.career().timeInSpace());
            assertEquals(Duration.parse("P1DT18H29M"), p.career().evaTime());
            assertEquals(2, p.career().flightsCount());
            assertEquals("US", p.nationalities().getFirst().alpha2());
            assertEquals("USA", p.nationalities().getFirst().alpha3());
            assertNull(p.media().credit()); assertEquals("Unknown", p.media().licenseName());
            assertNull(p.media().licenseUrl()); assertTrue(p.media().singleUse());
            assertNotNull(p.media().url()); assertNotNull(p.media().thumbnailUrl());
            assertEquals(1, requests.get());
        });
    }

    @Test void preservesCreditLicenseUrlAndRestrictionFromNestedProfile() throws Exception {
        withResponse(200, fixture("active-iss-expedition-detailed"), (source, requests) -> {
            var media = source.fetchCurrentExpedition(Station.ISS).value().profiles().get(1).media();
            assertEquals("NASA", media.credit()); assertEquals("NASA Image and Media Guidelines", media.licenseName());
            assertEquals(URI.create("https://www.nasa.gov/nasa-brand-center/images-and-media/"), media.licenseUrl());
            assertFalse(media.singleUse());
        });
    }

    @Test void retainsStructuredRosterAlongsideReviewedNasaCountWithoutOverridingEither() throws Exception {
        com.fasterxml.jackson.databind.JsonNode nasa;
        try (var in = getClass().getResourceAsStream("/fixtures/crew/nasa/reviewed-count-evidence.json")) {
            assertNotNull(in); nasa = json.readTree(in);
        }
        var observation = new CrewSourceObservation(CrewSource.NASA_OFFICIAL, URI.create(nasa.get("sourceUrl").asText()),
                Instant.parse(nasa.get("retrievedAt").asText()), Instant.parse(nasa.get("sourcePublishedAt").asText()),
                null, null, null, nasa.get("rawBodySha256").asText(), "NASA_HTML", "reviewed-evidence-v1");
        var evidence = new CrewVerificationEvidence(CrewVerificationEvidence.Type.CREW_COUNT_ABOARD, Station.ISS,
                java.util.List.of(), nasa.get("crewCount").asInt(), NasaSourceType.NASA_ISS_OPERATIONAL_POST,
                observation, nasa.get("supportingExcerpt").asText(), "MANUALLY_REVIEWED_TEST_EVIDENCE_V1");
        withResponse(200, fixture("active-iss-expedition-detailed"), (source, requests) -> {
            var snapshot = source.fetchCurrentExpedition(Station.ISS).value();
            assertEquals(7, snapshot.assignments().size()); assertEquals(11, evidence.crewCount());
            assertNotEquals(snapshot.assignments().size(), evidence.crewCount());
            assertEquals(CrewSource.LAUNCH_LIBRARY_2, snapshot.observation().source());
            assertEquals(CrewSource.NASA_OFFICIAL, evidence.observation().source());
            assertEquals(7, snapshot.assignments().size());
        });
    }

    @Test void toleratesNullableOptionalFieldsAndAdditionalJson() throws Exception {
        withResponse(200, fixture("astronaut-nullable-fields"), (source, requests) -> {
            var r = source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "573"));
            assertEquals(CrewSourceState.AVAILABLE, r.state());
            assertNull(r.value().agency()); assertNull(r.value().media()); assertNull(r.value().biography());
            assertNull(r.value().inSpace()); assertTrue(r.value().nationalities().isEmpty());
            assertNull(r.value().career().timeInSpace()); assertNull(r.value().career().flightsCount());
        });
    }

    @Test void supportsMultipleNationalitiesAsSyntheticContractVariation() throws Exception {
        var dto = json.readTree(fixture("astronaut-detail"));
        ((com.fasterxml.jackson.databind.node.ArrayNode) dto.get("nationality"))
                .add(json.readTree("{\"name\":\"Test country\",\"alpha_2_code\":null,\"alpha_3_code\":null}"));
        withResponse(200, dto.toString(), (source, requests) -> {
            var p = source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "573")).value();
            assertEquals(2, p.nationalities().size()); assertNull(p.nationalities().get(1).alpha2());
        });
    }

    @Test void returnsExplicitNoActiveExpedition() throws Exception {
        withResponse(200, "{\"count\":0,\"next\":null,\"results\":[]}", (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.NO_ACTIVE_EXPEDITION, r.state());
            assertTrue(r.value().assignments().isEmpty()); assertNotNull(r.observation()); assertNull(r.failure());
        });
    }

    @Test void preservesMultipleCandidatesWithoutSelectingFirst() throws Exception {
        var page = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture("active-iss-expedition-detailed"));
        var second = page.get("results").get(0).deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)second).put("id", 99999).put("name", "SYNTHETIC_TEST_CANDIDATE");
        ((com.fasterxml.jackson.databind.node.ArrayNode)second.get("crew")).removeAll();
        ((com.fasterxml.jackson.databind.node.ArrayNode)page.get("results")).add(second); page.put("count", 2);
        withResponse(200, page.toString(), (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.AMBIGUOUS, r.state()); assertEquals(2, r.value().expeditions().size());
            assertEquals(2, r.value().totalActiveExpeditions()); assertTrue(r.value().candidatesComplete());
            assertEquals(1, requests.get());
        });
    }

    @Test void reportsIncompleteCandidatePageWithoutFollowingNextUrl() throws Exception {
        var page = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture("active-iss-expedition-detailed"));
        page.put("count", 11).put("next", "https://example.invalid/next");
        withResponse(200, page.toString(), (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.AMBIGUOUS, r.state()); assertFalse(r.value().candidatesComplete());
            assertEquals(11, r.value().totalActiveExpeditions()); assertEquals(1, requests.get());
        });
    }

    @Test void preservesDifferingProfilesForTheSameIdentityAcrossCandidates() throws Exception {
        var page = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture("active-iss-expedition-detailed"));
        var second = (com.fasterxml.jackson.databind.node.ObjectNode) page.get("results").get(0).deepCopy();
        second.put("id", 99999).put("name", "SYNTHETIC_TEST_CANDIDATE");
        var crew = (com.fasterxml.jackson.databind.node.ArrayNode) second.get("crew");
        while (crew.size() > 1) crew.remove(1);
        ((com.fasterxml.jackson.databind.node.ObjectNode) crew.get(0)).put("id", 99999);
        ((com.fasterxml.jackson.databind.node.ObjectNode) crew.get(0).get("astronaut")).put("bio", "SYNTHETIC_DIFFERING_OBSERVATION");
        ((com.fasterxml.jackson.databind.node.ArrayNode) page.get("results")).add(second); page.put("count", 2);
        withResponse(200, page.toString(), (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.AMBIGUOUS, r.state());
            assertEquals(8, r.value().profiles().size());
            assertEquals(r.value().profiles().getFirst().person(), r.value().profiles().getLast().person());
            assertNotEquals(r.value().profiles().getFirst().biography(), r.value().profiles().getLast().biography());
            assertEquals(1, requests.get());
        });
    }

    @ParameterizedTest @ValueSource(strings = {"", "<html>error</html>", "{}", "null",
            "{\"count\":1,\"results\":[]}", "{\"count\":\"0\",\"results\":[]}",
            "{\"count\":0,\"results\":[]} {}"})
    void malformedResponsesNeverBecomeEmptySuccess(String body) throws Exception {
        withResponse(200, body, (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.MALFORMED_RESPONSE, r.state()); assertNull(r.value());
            assertEquals(1, requests.get());
        });
    }

    @Test void rejectsWrongStationAndMissingRequiredCrew() throws Exception {
        var page = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture("active-iss-expedition-detailed"));
        ((com.fasterxml.jackson.databind.node.ObjectNode)page.get("results").get(0).get("spacestation")).put("id", 99);
        withResponse(200, page.toString(), (source, requests) -> assertEquals(CrewSourceState.MALFORMED_RESPONSE,
                source.fetchCurrentExpedition(Station.ISS).state()));
        page = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(fixture("active-iss-expedition-detailed"));
        ((com.fasterxml.jackson.databind.node.ObjectNode)page.get("results").get(0)).remove("crew");
        withResponse(200, page.toString(), (source, requests) -> assertEquals(CrewSourceState.MALFORMED_RESPONSE,
                source.fetchCurrentExpedition(Station.ISS).state()));
    }

    @Test void rejectsWrongPersonAndMalformedOptionalDuration() throws Exception {
        withResponse(200, fixture("astronaut-detail-2"), (source, requests) -> assertEquals(CrewSourceState.MALFORMED_RESPONSE,
                source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "573")).state()));
        var dto = (com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(fixture("astronaut-detail"));
        dto.put("time_in_space", "many years");
        withResponse(200, dto.toString(), (source, requests) -> assertEquals(CrewSourceState.MALFORMED_RESPONSE,
                source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "573")).state()));
    }

    @ParameterizedTest @ValueSource(ints = {404, 429, 500, 503, 403, 302})
    void exposesHttpFailureAndRetryAfterWithoutRetry(int status) throws Exception {
        withResponse(status, "error", (source, requests) -> {
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(status == 429 ? CrewSourceState.RATE_LIMITED : status == 404
                    ? CrewSourceState.NOT_FOUND : CrewSourceState.SOURCE_UNAVAILABLE, r.state());
            assertEquals(status, r.failure().httpStatus()); assertEquals("3600", r.failure().retryAfter());
            assertNull(r.value()); assertEquals(1, requests.get());
        });
    }

    @Test void distinguishesTimeoutNetworkFailureAndInterruption() throws Exception {
        for (Exception error : new Exception[]{new HttpTimeoutException("test"), new IOException("DNS test"), new InterruptedException("test")}) {
            HttpClient client = mock(HttpClient.class);
            when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<byte[]>>any())).thenThrow(error);
            var source = new LaunchLibrary2CrewSource(new CrewHttpReader(client, CLOCK, Duration.ofSeconds(1)),
                    URI.create("https://example.invalid/2.3.0/"), 4);
            var r = source.fetchCurrentExpedition(Station.ISS);
            assertEquals(CrewSourceState.SOURCE_UNAVAILABLE, r.state());
            assertEquals(error instanceof HttpTimeoutException ? CrewSourceResult.FailureCode.TIMEOUT
                    : error instanceof InterruptedException ? CrewSourceResult.FailureCode.INTERRUPTED
                    : CrewSourceResult.FailureCode.NETWORK_ERROR, r.failure().code());
            assertNull(r.observation()); assertNull(r.value());
            verify(client, times(1)).send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<byte[]>>any());
            if (error instanceof InterruptedException) assertTrue(Thread.interrupted());
        }
    }

    @Test void invalidExternalIdentityNeverMakesARequest() throws Exception {
        withResponse(200, "{}", (source, requests) -> {
            assertThrows(IllegalArgumentException.class, () -> source.fetchAstronautProfile(new ExternalId(CrewSource.NASA_OFFICIAL, "573")));
            assertThrows(IllegalArgumentException.class, () -> source.fetchAstronautProfile(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, "../other")));
            assertEquals(0, requests.get());
        });
    }

    static String fixture(String name) throws IOException {
        try (var input = LaunchLibrary2CrewSourceTest.class.getResourceAsStream("/fixtures/crew/ll2/" + name + ".json")) {
            assertNotNull(input); return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
    private void withResponse(int status, String body, Action action) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var requests = new AtomicInteger();
        server.createContext("/2.3.0/", exchange -> {
            requests.incrementAndGet();
            if (exchange.getRequestURI().getPath().endsWith("expeditions/"))
                assertEquals("space_station=4&is_active=true&mode=detailed&ordering=-start&limit=10", exchange.getRequestURI().getQuery());
            exchange.getResponseHeaders().add("ETag", "test-etag"); exchange.getResponseHeaders().add("Retry-After", "3600");
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8); exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
        server.start();
        try {
            var reader = new CrewHttpReader(HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build(), CLOCK, Duration.ofSeconds(2));
            var source = new LaunchLibrary2CrewSource(reader, URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/2.3.0/"), 4);
            action.run(source, requests);
        } finally { server.stop(0); }
    }
    @FunctionalInterface interface Action { void run(LaunchLibrary2CrewSource source, AtomicInteger requests) throws Exception; }
}
