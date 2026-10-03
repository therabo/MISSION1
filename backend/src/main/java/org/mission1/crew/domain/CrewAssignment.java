package org.mission1.crew.domain;

import java.time.Instant;
import java.util.Objects;
/** Assignment validity is unknown unless supplied; expedition dates are not personal presence dates. */
public record CrewAssignment(ExternalId externalId, ExternalId expeditionId, PersonReference person,
        CrewRole role, String sourceRoleLabel, Instant validFrom, Instant validUntil,
        CrewSourceObservation observation) {
    public CrewAssignment {
        Objects.requireNonNull(expeditionId); Objects.requireNonNull(person);
        Objects.requireNonNull(role); Objects.requireNonNull(observation);
        if (validFrom != null && validUntil != null && validUntil.isBefore(validFrom))
            throw new IllegalArgumentException("Invalid assignment interval");
    }
}
