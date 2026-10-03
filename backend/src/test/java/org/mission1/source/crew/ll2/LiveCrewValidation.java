package org.mission1.source.crew.ll2;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.mission1.crew.domain.Station;
import org.mission1.crew.domain.CrewSourceState;
import org.mission1.source.crew.CrewHttpReader;

/** Explicit manual probe, never a JUnit test. Exactly one request; no profile enrichment or retry. */
public final class LiveCrewValidation {
    public static void main(String[] args) throws Exception {
        if (!"1".equals(System.getenv("MISSION1_CREW_LIVE_VALIDATION")) || args.length != 1)
            throw new IllegalArgumentException("Set MISSION1_CREW_LIVE_VALIDATION=1 and supply an external report path");
        var source = new LaunchLibrary2CrewSource(new CrewHttpReader(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8)).followRedirects(HttpClient.Redirect.NEVER).build(),
                Clock.systemUTC(), Duration.ofSeconds(20)), URI.create("https://ll.thespacedevs.com/2.3.0/"), 4);
        var result = source.fetchCurrentExpedition(Station.ISS);
        JsonMapper.builder().addModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build().writerWithDefaultPrettyPrinter()
                .writeValue(Path.of(args[0]).toFile(), result);
        System.out.println("One LL2 request: " + result.state() + "; report " + args[0]);
        if (result.state() != CrewSourceState.AVAILABLE) System.exit(1);
    }
}
