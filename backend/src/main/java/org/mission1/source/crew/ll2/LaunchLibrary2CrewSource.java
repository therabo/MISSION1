package org.mission1.source.crew.ll2;

import java.net.URI;
import java.util.Objects;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.mission1.crew.application.CrewProfileSource;
import org.mission1.crew.application.StructuredCrewSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

/** LL2 2.3.0 only. See ADR-0007. A snapshot never requests per-person enrichment. */
public final class LaunchLibrary2CrewSource implements StructuredCrewSource, CrewProfileSource {
    public static final String API_VERSION = "2.3.0";
    public static final String ADAPTER_VERSION = "ll2-crew-v1";
    private final CrewHttpReader http;
    private final URI baseUrl;
    private final int issExternalId;
    private final Ll2CrewMapper mapper = new Ll2CrewMapper();
    private final JsonMapper json = JsonMapper.builder().addModule(new JavaTimeModule())
            .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();

    public LaunchLibrary2CrewSource(CrewHttpReader http, URI baseUrl, int issExternalId) {
        this.http = Objects.requireNonNull(http); this.baseUrl = Objects.requireNonNull(baseUrl);
        if (!baseUrl.isAbsolute() || baseUrl.getHost() == null || !baseUrl.getPath().endsWith("/2.3.0/")
                || baseUrl.getQuery() != null || baseUrl.getFragment() != null || issExternalId < 1)
            throw new IllegalArgumentException("LL2 2.3.0 base URL and station ID required");
        this.issExternalId = issExternalId;
    }

    @Override public CrewSourceResult<CrewSourceSnapshot> fetchCurrentExpedition(Station station) {
        if (station != Station.ISS) throw new IllegalArgumentException("Only ISS mapping is configured");
        URI url = baseUrl.resolve("expeditions/?space_station=" + issExternalId
                + "&is_active=true&mode=detailed&ordering=-start&limit=10");
        var fetched = http.fetch(url, CrewSource.LAUNCH_LIBRARY_2, "application/json", API_VERSION, ADAPTER_VERSION);
        if (fetched.failure() != null) return copyFailure(fetched);
        try {
            var snapshot = mapper.snapshot(json.readValue(fetched.value(), Ll2Dtos.Page.class), issExternalId, fetched.observation());
            var state = snapshot.totalActiveExpeditions() == 0 ? CrewSourceState.NO_ACTIVE_EXPEDITION
                    : snapshot.totalActiveExpeditions() == 1 ? CrewSourceState.AVAILABLE : CrewSourceState.AMBIGUOUS;
            return new CrewSourceResult<>(state, snapshot, fetched.observation(), null);
        } catch (java.io.IOException | IllegalArgumentException | NullPointerException e) { return malformed(fetched); }
    }

    @Override public CrewSourceResult<AstronautProfile> fetchAstronautProfile(ExternalId id) {
        if (id.source() != CrewSource.LAUNCH_LIBRARY_2 || !id.value().matches("[1-9][0-9]*"))
            throw new IllegalArgumentException("LL2 astronaut external ID required");
        var fetched = http.fetch(baseUrl.resolve("astronauts/" + id.value() + "/"), CrewSource.LAUNCH_LIBRARY_2,
                "application/json", API_VERSION, ADAPTER_VERSION);
        if (fetched.failure() != null) return copyFailure(fetched);
        try {
            var dto = json.readValue(fetched.value(), Ll2Dtos.AstronautDto.class);
            if (!"detailed".equals(dto.responseMode()) || !Ll2CrewMapper.id(dto.id()).equals(id))
                throw new IllegalArgumentException("Wrong astronaut or response mode");
            var profile = mapper.profile(dto, fetched.observation());
            return new CrewSourceResult<>(CrewSourceState.AVAILABLE, profile, fetched.observation(), null);
        } catch (java.io.IOException | IllegalArgumentException | NullPointerException e) { return malformed(fetched); }
    }

    private static <T> CrewSourceResult<T> copyFailure(CrewSourceResult<byte[]> fetched) {
        return new CrewSourceResult<>(fetched.state(), null, fetched.observation(), fetched.failure());
    }
    private static <T> CrewSourceResult<T> malformed(CrewSourceResult<byte[]> fetched) {
        return CrewHttpReader.failed(CrewSourceState.MALFORMED_RESPONSE,
                CrewSourceResult.FailureCode.INVALID_RESPONSE, 200, null, fetched.observation());
    }
}
