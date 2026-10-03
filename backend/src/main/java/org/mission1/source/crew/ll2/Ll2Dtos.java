package org.mission1.source.crew.ll2;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Private upstream representations; absent optional fields remain null. */
final class Ll2Dtos {
    record Page(Integer count, String next, List<ExpeditionDto> results) { }
    record StationDto(Integer id, String name) { }
    record ExpeditionDto(Integer id, String name, Instant start, Instant end, String responseMode,
            @JsonProperty("spacestation") StationDto spaceStation, List<AssignmentDto> crew) { }
    record AssignmentDto(Integer id, RoleDto role, AstronautDto astronaut) { }
    record RoleDto(Integer id, String role, Integer priority) { }
    record NamedDto(Integer id, String name) { }
    record AgencyDto(Integer id, String name, String abbrev, NamedDto type) { }
    record CountryDto(String name, @JsonProperty("alpha_2_code") String alpha2Code, @JsonProperty("alpha_3_code") String alpha3Code) { }
    record LicenseDto(String name, String link) { }
    record ImageDto(String imageUrl, String thumbnailUrl, String credit, LicenseDto license, Boolean singleUse) { }
    record AstronautDto(Integer id, String name, String responseMode, NamedDto status, NamedDto type,
            AgencyDto agency, ImageDto image, Boolean inSpace, Duration timeInSpace, Duration evaTime,
            List<CountryDto> nationality, String bio, Instant firstFlight, Instant lastFlight,
            Integer flightsCount, Integer spacewalksCount) { }
    private Ll2Dtos() { }
}
