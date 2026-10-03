package org.mission1.crew.domain;

import java.util.List;
import java.util.Objects;
import java.time.Instant;
/** Evidence-backed claim about an interval/as-of instant; UNKNOWN is representable. */
public record StationPresence(Station station, PersonReference person, State state, Instant asOf,
        Instant enteredAt, Instant departedAt, List<CrewVerificationEvidence> evidence) {
    public enum State { PRESENT, DEPARTED, UNKNOWN }
    public StationPresence {
        Objects.requireNonNull(station); Objects.requireNonNull(person); Objects.requireNonNull(state);
        Objects.requireNonNull(asOf); evidence = List.copyOf(evidence);
        if (evidence.stream().anyMatch(e -> e.station() != station))
            throw new IllegalArgumentException("Evidence must concern the same station");
        if (state != State.UNKNOWN && evidence.stream().noneMatch(e -> e.people().contains(person)
                && (state == State.PRESENT
                    ? e.type() == CrewVerificationEvidence.Type.PERSON_ENTERED_STATION
                        || e.type() == CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD
                    : e.type() == CrewVerificationEvidence.Type.PERSON_DEPARTED_STATION)))
            throw new IllegalArgumentException("Presence requires a compatible named assertion");
        if (enteredAt != null && departedAt != null && departedAt.isBefore(enteredAt))
            throw new IllegalArgumentException("Invalid presence interval");
    }
}
