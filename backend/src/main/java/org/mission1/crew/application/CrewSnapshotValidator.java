package org.mission1.crew.application;

import java.util.HashMap;
import java.util.HashSet;
import org.mission1.crew.domain.*;

/** Validate the graph at the durable boundary; never derive station presence. */
public final class CrewSnapshotValidator {
    private CrewSnapshotValidator() { }

    public static void validate(CrewSourceSnapshot snapshot) {
        if (snapshot == null || snapshot.station() != Station.ISS
                || snapshot.observation().source() != CrewSource.LAUNCH_LIBRARY_2
                || snapshot.sourceStationExternalId() == null || snapshot.sourceStationExternalId().isBlank()
                || !snapshot.candidatesComplete() || snapshot.totalActiveExpeditions() != 1
                || snapshot.expeditions().size() != 1)
            throw new IllegalArgumentException("Complete single LL2 ISS expedition required");
        var expedition = snapshot.expeditions().getFirst();
        if (expedition.station() != snapshot.station() || expedition.externalId().source() != snapshot.observation().source()
                || !expedition.observation().equals(snapshot.observation()))
            throw new IllegalArgumentException("Expedition lineage mismatch");
        var people = new HashMap<ExternalId, PersonReference>();
        for (var profile : snapshot.profiles()) {
            var id = sourcePersonId(profile.person(), snapshot.observation().source());
            if (!profile.observation().equals(snapshot.observation()) || people.putIfAbsent(id, profile.person()) != null)
                throw new IllegalArgumentException("Duplicate/conflicting person observation or lineage");
        }
        var assigned = new HashSet<ExternalId>();
        var assignmentIds = new HashSet<ExternalId>();
        for (var assignment : snapshot.assignments()) {
            var id = sourcePersonId(assignment.person(), snapshot.observation().source());
            if (!assignment.expeditionId().equals(expedition.externalId())
                    || !assignment.observation().equals(snapshot.observation())
                    || !assignment.person().equals(people.get(id)) || !assigned.add(id)
                    || (assignment.externalId() != null && (assignment.externalId().source() != snapshot.observation().source()
                        || !assignmentIds.add(assignment.externalId()))))
                throw new IllegalArgumentException("Invalid/duplicate assignment reference or lineage");
        }
        if (!assigned.equals(people.keySet())) throw new IllegalArgumentException("Profiles and assignments differ");
    }

    public static ExternalId sourcePersonId(PersonReference person, CrewSource source) {
        if (person.externalIds().size() != 1 || person.externalIds().getFirst().source() != source)
            throw new IllegalArgumentException("One explicit source person identity required; no name matching");
        return person.externalIds().getFirst();
    }
}
