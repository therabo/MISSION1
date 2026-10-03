package org.mission1.crew.domain;

import java.util.List;
import java.util.Objects;
/** Structured source candidates only. Never a canonical currently-aboard roster. */
public record CrewSourceSnapshot(Station station, int totalActiveExpeditions, boolean candidatesComplete,
        List<Expedition> expeditions, List<CrewAssignment> assignments, List<AstronautProfile> profiles,
        CrewSourceObservation observation, String sourceStationExternalId) {
    public CrewSourceSnapshot {
        Objects.requireNonNull(station); Objects.requireNonNull(observation);
        expeditions = List.copyOf(expeditions); assignments = List.copyOf(assignments); profiles = List.copyOf(profiles);
        if (totalActiveExpeditions < expeditions.size()) throw new IllegalArgumentException("Invalid candidate count");
    }
}
