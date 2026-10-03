package org.mission1.crew.domain;

import java.util.Objects;
/** Source identity only; never a public MISSION1 identity. */
public record ExternalId(CrewSource source, String value) {
    public ExternalId {
        Objects.requireNonNull(source);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("External ID required");
    }
}
