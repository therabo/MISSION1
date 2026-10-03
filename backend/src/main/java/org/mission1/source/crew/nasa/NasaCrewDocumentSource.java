package org.mission1.source.crew.nasa;

import java.net.URI;
import java.util.Objects;
import org.mission1.crew.application.CrewSourceDocumentSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;

/** Official document capture only. No inferred publication time, roster extraction or verification boolean. */
public final class NasaCrewDocumentSource implements CrewSourceDocumentSource {
    public static final String CONTRACT_VERSION = "nasa-crew-document-v1";
    private final CrewHttpReader http;
    public NasaCrewDocumentSource(CrewHttpReader http) { this.http = Objects.requireNonNull(http); }

    @Override public CrewSourceResult<CrewSourceDocument> fetchDocument(NasaSourceType type, URI url) {
        Objects.requireNonNull(type); Objects.requireNonNull(url);
        if (!"https".equals(url.getScheme()) || !"www.nasa.gov".equals(url.getHost())
                || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443))
            throw new IllegalArgumentException("Explicit official www.nasa.gov HTTPS URL required");
        var fetched = http.fetch(url, CrewSource.NASA_OFFICIAL, "text/html", "NASA_HTML", CONTRACT_VERSION);
        if (fetched.failure() != null)
            return new CrewSourceResult<>(fetched.state(), null, fetched.observation(), fetched.failure());
        var document = new CrewSourceDocument(type, fetched.observation(), fetched.value());
        return new CrewSourceResult<>(CrewSourceState.AVAILABLE, document, fetched.observation(), null);
    }
}
