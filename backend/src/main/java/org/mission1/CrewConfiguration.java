package org.mission1;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.mission1.source.crew.nasa.NasaCrewDocumentSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Registers inert read-only capabilities; it never fetches or schedules Crew data. */
@Configuration
class CrewConfiguration {
    @Bean CrewHttpReader crewHttpReader(Clock utcClock,
            @Value("${mission1.crew.request-timeout:PT20S}") Duration timeout) {
        return new CrewHttpReader(HttpClient.newBuilder().connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NEVER).build(), utcClock, timeout);
    }
    @Bean LaunchLibrary2CrewSource launchLibrary2CrewSource(CrewHttpReader http,
            @Value("${mission1.crew.ll2.base-url:https://ll.thespacedevs.com/2.3.0/}") URI baseUrl,
            @Value("${mission1.crew.ll2.iss-external-id:4}") int stationId) {
        return new LaunchLibrary2CrewSource(http, baseUrl, stationId);
    }
    @Bean NasaCrewDocumentSource nasaCrewDocumentSource(CrewHttpReader http) {
        return new NasaCrewDocumentSource(http);
    }
}
