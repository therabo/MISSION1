package org.mission1.source.crew.ll2;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.mission1.crew.domain.*;

final class Ll2CrewMapper {
    CrewSourceSnapshot snapshot(Ll2Dtos.Page page, int stationId, CrewSourceObservation observation) {
        if (page.count() == null || page.count() < 0 || page.results() == null
                || page.count() < page.results().size()) throw new IllegalArgumentException("Invalid result page");
        if (page.results().size() != page.count() && page.next() == null)
            throw new IllegalArgumentException("Incomplete page without pagination metadata");
        if (page.count() == page.results().size() && page.next() != null)
            throw new IllegalArgumentException("Inconsistent pagination metadata");
        if (page.count() > 0 && page.results().isEmpty()) throw new IllegalArgumentException("Missing candidates");
        var expeditions = new ArrayList<Expedition>();
        var assignments = new ArrayList<CrewAssignment>();
        var profiles = new ArrayList<AstronautProfile>();
        for (var dto : page.results()) {
            if (!"detailed".equals(dto.responseMode()) || dto.spaceStation() == null
                    || dto.spaceStation().id() == null || dto.spaceStation().id() != stationId || dto.crew() == null)
                throw new IllegalArgumentException("Wrong station or incomplete detailed expedition");
            var expeditionId = id(dto.id());
            if (expeditions.stream().anyMatch(e -> e.externalId().equals(expeditionId)))
                throw new IllegalArgumentException("Duplicate expedition candidate");
            if (dto.start() == null || dto.start().isAfter(observation.retrievedAt())
                    || (dto.end() != null && !dto.end().isAfter(observation.retrievedAt())))
                throw new IllegalArgumentException("Non-active expedition returned");
            expeditions.add(new Expedition(null, expeditionId, dto.name(), dto.start(), dto.end(), Station.ISS, observation));
            for (var assignment : dto.crew()) {
                var profile = profile(assignment.astronaut(), observation);
                var roleLabel = assignment.role() == null ? null : assignment.role().role();
                var role = roleLabel == null ? CrewRole.UNKNOWN : switch (roleLabel) {
                    case "Commander" -> CrewRole.COMMANDER;
                    case "Flight Engineer" -> CrewRole.FLIGHT_ENGINEER;
                    default -> CrewRole.OTHER;
                };
                var assignmentId = id(assignment.id());
                if (assignments.stream().anyMatch(a -> a.externalId().equals(assignmentId)))
                    throw new IllegalArgumentException("Duplicate assignment");
                assignments.add(new CrewAssignment(assignmentId, expeditionId, profile.person(), role,
                        roleLabel, null, null, observation));
                // Retain each candidate's profile observation; identity alone cannot discard differing values.
                profiles.add(profile);
            }
        }
        return new CrewSourceSnapshot(Station.ISS, page.count(), page.next() == null, expeditions, assignments, profiles, observation);
    }

    AstronautProfile profile(Ll2Dtos.AstronautDto dto, CrewSourceObservation observation) {
        if (dto == null) throw new IllegalArgumentException("Missing astronaut");
        var person = new PersonReference(null, dto.name(), List.of(id(dto.id())), null);
        var a = dto.agency();
        Agency agency = a == null ? null : new Agency(a.name(), a.abbrev(),
                a.type() == null ? null : a.type().name(), a.id() == null ? List.of() : List.of(id(a.id())));
        var nationalities = dto.nationality() == null ? List.<Nationality>of() : dto.nationality().stream()
                .map(c -> new Nationality(c.alpha2Code(), c.alpha3Code(), c.name())).toList();
        var image = dto.image();
        CrewMediaAsset media = image == null ? null : new CrewMediaAsset(uri(image.imageUrl()), uri(image.thumbnailUrl()),
                image.credit(), image.license() == null ? null : image.license().name(),
                image.license() == null ? null : uri(image.license().link()), image.singleUse());
        return new AstronautProfile(person, agency, nationalities, dto.bio(),
                new CareerStatistics(dto.timeInSpace(), dto.evaTime(), dto.flightsCount(), dto.spacewalksCount(),
                        dto.firstFlight(), dto.lastFlight()), media, dto.inSpace(), observation);
    }

    static ExternalId id(Integer id) {
        if (id == null || id < 1) throw new IllegalArgumentException("Missing positive LL2 ID");
        return new ExternalId(CrewSource.LAUNCH_LIBRARY_2, id.toString());
    }
    private static URI uri(String value) {
        if (value == null || value.isBlank()) return null;
        URI uri = URI.create(value);
        if (!uri.isAbsolute() || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())))
            throw new IllegalArgumentException("Invalid source URL");
        return uri;
    }
}
