package org.mission1.crew.domain;

import java.net.URI;
import java.time.Instant;
import java.util.Objects;
/** HTTP modification time is transport metadata, not publication or event time. */
public record CrewSourceObservation(CrewSource source, URI sourceUrl, Instant retrievedAt,
        Instant sourcePublishedAt, Instant sourceEventAt, String httpEtag, String httpLastModified,
        String contentHash, String sourceVersion, String adapterVersion) {
    public CrewSourceObservation {
        Objects.requireNonNull(source); Objects.requireNonNull(sourceUrl); Objects.requireNonNull(retrievedAt);
        if (contentHash == null || !contentHash.matches("[a-f0-9]{64}"))
            throw new IllegalArgumentException("SHA-256 required");
        Objects.requireNonNull(sourceVersion); Objects.requireNonNull(adapterVersion);
    }
}
