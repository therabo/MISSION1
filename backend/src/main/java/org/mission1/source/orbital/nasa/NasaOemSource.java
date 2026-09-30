package org.mission1.source.orbital.nasa;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/** Public NASA source adapter; source creation time is parsed separately from HTTP metadata. */
public final class NasaOemSource {
    public static final URI URI = java.net.URI.create(
            "https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml");
    public record Fetch(byte[] xml, Instant httpLastModified) { }
    private final HttpClient client;

    public NasaOemSource() {
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    public Fetch fetch() throws IOException, InterruptedException {
        var request = HttpRequest.newBuilder(URI).timeout(Duration.ofSeconds(20))
                .header("Accept", "application/xml, text/xml").GET().build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) throw new IOException("NASA OEM HTTP " + response.statusCode());
        byte[] bytes = response.body();
        if (bytes.length == 0 || bytes.length > NasaOemXmlParser.MAX_BYTES) throw new IOException("NASA OEM size invalid");
        Instant lastModified = response.headers().firstValue("Last-Modified")
                .map(value -> ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant())
                .orElse(null);
        return new Fetch(bytes, lastModified);
    }
}
