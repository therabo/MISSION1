package org.mission1.crew.application;

import java.util.List;
import org.mission1.crew.domain.CrewSourceDocument;
import org.mission1.crew.domain.CrewSourceResult;
import org.mission1.crew.domain.CrewVerificationEvidence;

/** Explicit capability only; no scheduling or startup behavior. */
public interface CrewPresenceVerificationSource {
    CrewSourceResult<List<CrewVerificationEvidence>> verify(CrewSourceDocument document);
}
