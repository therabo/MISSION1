package org.mission1.crew.domain;

import java.util.List;
import java.util.Objects;
/** A source assertion, not a reconciled fact. Publication and event time remain distinct. */
public record CrewVerificationEvidence(Type type, Station station, List<PersonReference> people,
        Integer crewCount, NasaSourceType sourceType, CrewSourceObservation observation,
        String supportingExcerpt, String evidenceMethod, Completeness completeness, Assertion assertion) {
    public enum Completeness { EXHAUSTIVE, PARTIAL, EVENT_ONLY, COUNT_ONLY }
    public enum Assertion { OBSERVED, COMPLETED, PLANNED }
    public CrewVerificationEvidence(Type type, Station station, List<PersonReference> people, Integer crewCount,
            NasaSourceType sourceType, CrewSourceObservation observation, String excerpt, String method) {
        this(type, station, people, crewCount, sourceType, observation, excerpt, method,
                type == Type.CREW_COUNT_ABOARD ? Completeness.COUNT_ONLY : Completeness.PARTIAL, Assertion.OBSERVED);
    }
    public enum Type { PERSON_ENTERED_STATION, PERSON_DEPARTED_STATION, PERSON_CURRENTLY_ABOARD,
        CREW_COUNT_ABOARD, EXPEDITION_MEMBERSHIP, DOCKING_OCCURRED, UNDOCKING_OCCURRED, HATCH_OPENED }
    public CrewVerificationEvidence {
        Objects.requireNonNull(completeness); Objects.requireNonNull(assertion);
        Objects.requireNonNull(type); Objects.requireNonNull(station); Objects.requireNonNull(sourceType);
        Objects.requireNonNull(observation); Objects.requireNonNull(evidenceMethod);
        if (observation.source() != CrewSource.NASA_OFFICIAL) throw new IllegalArgumentException("NASA evidence required");
        people = List.copyOf(people);
        if (type == Type.CREW_COUNT_ABOARD && (crewCount == null || crewCount < 0))
            throw new IllegalArgumentException("Count assertion requires a count");
        if (type != Type.CREW_COUNT_ABOARD && crewCount != null)
            throw new IllegalArgumentException("Count belongs to a count assertion");
        if ((type == Type.PERSON_ENTERED_STATION || type == Type.PERSON_DEPARTED_STATION
                || type == Type.PERSON_CURRENTLY_ABOARD || type == Type.EXPEDITION_MEMBERSHIP) && people.isEmpty())
            throw new IllegalArgumentException("Named assertion requires subjects");
        if (supportingExcerpt == null || supportingExcerpt.isBlank()) throw new IllegalArgumentException("Evidence text required");
    }
}
