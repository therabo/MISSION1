package org.mission1.crew.domain;

import java.util.UUID;
import java.util.List;
import java.net.URI;
/** An unresolved named subject can carry an official URL without inventing a NASA ID. */
public record PersonReference(UUID mission1Id, String displayName, List<ExternalId> externalIds,
        URI officialProfileUrl) {
    public PersonReference {
        if (displayName == null || displayName.isBlank()) throw new IllegalArgumentException("Person name required");
        externalIds = List.copyOf(externalIds);
    }
}
