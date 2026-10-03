package org.mission1.crew.domain;

import java.util.UUID;
import java.util.Objects;
import java.time.Instant;
public record Expedition(UUID mission1Id, ExternalId externalId, String name, Instant start,
        Instant end, Station station, CrewSourceObservation observation) {
    public Expedition {
        Objects.requireNonNull(externalId); Objects.requireNonNull(station); Objects.requireNonNull(observation);
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Expedition name required");
        if (start != null && end != null && end.isBefore(start)) throw new IllegalArgumentException("Invalid interval");
    }
}
