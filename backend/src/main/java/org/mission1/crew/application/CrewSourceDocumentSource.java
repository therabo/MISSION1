package org.mission1.crew.application;

import java.net.URI;
import org.mission1.crew.domain.CrewSourceDocument;
import org.mission1.crew.domain.CrewSourceResult;
import org.mission1.crew.domain.NasaSourceType;

/** Explicit capability only; no scheduling or startup behavior. */
public interface CrewSourceDocumentSource {
    CrewSourceResult<CrewSourceDocument> fetchDocument(NasaSourceType sourceType, URI sourceUrl);
}
