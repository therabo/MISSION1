package org.mission1.crew.domain;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Planning observation, never a presence assertion or an actual transfer timestamp. */
public record CrewOperationalEvent(
        String externalId,
        URI sourceUrl,
        Kind kind,
        Instant scheduledAt,
        String datePrecision,
        Instant sourceUpdatedAt,
        Relevance relevance,
        Status status,
        List<String> astronautIds,
        List<String> launchIds) {
    public enum Kind {
        DOCKING,
        UNDOCKING
    }

    public enum Relevance {
        CREWED,
        CARGO,
        UNKNOWN
    }

    public enum Status {
        UNKNOWN,
        CANCELLED
    }

    public CrewOperationalEvent {
        Objects.requireNonNull(externalId);
        Objects.requireNonNull(sourceUrl);
        Objects.requireNonNull(kind);
        Objects.requireNonNull(relevance);
        Objects.requireNonNull(status);
        astronautIds = List.copyOf(astronautIds);
        launchIds = List.copyOf(launchIds);
        if (!externalId.matches("[1-9][0-9]*") || !sourceUrl.isAbsolute())
            throw new IllegalArgumentException("Source event identity required");
    }

    public boolean precise() {
        return "Minute".equals(datePrecision);
    }
}
