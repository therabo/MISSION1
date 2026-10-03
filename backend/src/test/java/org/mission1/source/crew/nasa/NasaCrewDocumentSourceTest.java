package org.mission1.source.crew.nasa;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

class NasaCrewDocumentSourceTest {
    private static final Instant NOW = Instant.parse("2026-10-03T08:40:00Z");
    private static final URI URL = URI.create("https://www.nasa.gov/mission/expedition-75/");

    @Test void capturesOfficialDocumentMetadataWithoutInventingSemanticExtraction() throws Exception {
        byte[] body;
        try (var in = getClass().getResourceAsStream("/fixtures/crew/nasa/expedition-roster-fragment.html")) {
            assertNotNull(in); body = in.readAllBytes();
        }
        var client = mock(HttpClient.class);
        @SuppressWarnings("unchecked") HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.body()).thenReturn(body); when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("ETag", List.of("TEST"),
                "Last-Modified", List.of("Thu, 01 Oct 2026 12:00:00 GMT")), (a,b) -> true));
        when(client.send(any(HttpRequest.class), org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<byte[]>>any())).thenReturn(response);
        var source = new NasaCrewDocumentSource(new CrewHttpReader(client, Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofSeconds(1)));
        for (var type : NasaSourceType.values()) {
            var result = source.fetchDocument(type, URL);
            assertEquals(CrewSourceState.AVAILABLE, result.state()); assertEquals(type, result.value().sourceType());
            assertEquals(CrewHttpReader.sha256(body), result.observation().contentHash());
            assertEquals("TEST", result.observation().httpEtag());
            assertNotNull(result.observation().httpLastModified());
            assertNull(result.observation().sourcePublishedAt()); assertNull(result.observation().sourceEventAt());
            assertArrayEquals(body, result.value().body());
        }
    }

    @Test void rejectsUnofficialUrlsWithoutCallingHttp() {
        var client = mock(HttpClient.class);
        var source = new NasaCrewDocumentSource(new CrewHttpReader(client, Clock.systemUTC(), Duration.ofSeconds(1)));
        for (String url : List.of("http://www.nasa.gov/", "https://www.nasa.gov.example.org/", "https://evil.test/", "https://user@www.nasa.gov/"))
            assertThrows(IllegalArgumentException.class, () -> source.fetchDocument(NasaSourceType.NASA_STATION_OVERVIEW, URI.create(url)));
        verifyNoInteractions(client);
    }
}
