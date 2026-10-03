package org.mission1.crew.domain;

import java.util.List;
import java.util.Objects;
/** inSpace is a source observation; it cannot establish station presence. */
public record AstronautProfile(PersonReference person, Agency agency, List<Nationality> nationalities,
        String biography, CareerStatistics career, CrewMediaAsset media, Boolean inSpace,
        CrewSourceObservation observation, String sourceProfileMode) {
    public AstronautProfile(PersonReference person, Agency agency, List<Nationality> nationalities,
            String biography, CareerStatistics career, CrewMediaAsset media, Boolean inSpace,
            CrewSourceObservation observation) {
        this(person, agency, nationalities, biography, career, media, inSpace, observation, null);
    }
    public AstronautProfile {
        Objects.requireNonNull(person); Objects.requireNonNull(observation);
        nationalities = List.copyOf(nationalities);
    }
}
