package org.mission1.crew.domain;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/** Source content resource, never a paragraph or a canonical human identifier (ADR-0012). */
public record CrewSourceArticle(String stableKey, String rawGuid, String rawUrl, URI observedUrl,
        Instant publishedAt, String representationHash, List<Paragraph> paragraphs) {
    public CrewSourceArticle { paragraphs = List.copyOf(paragraphs); }
    public record Paragraph(int index, String text) {}
}
