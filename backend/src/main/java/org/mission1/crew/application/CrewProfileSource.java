package org.mission1.crew.application;

import org.mission1.crew.domain.AstronautProfile;
import org.mission1.crew.domain.CrewSourceResult;
import org.mission1.crew.domain.ExternalId;

/** Explicit capability only; no scheduling or startup behavior. */
public interface CrewProfileSource {
    CrewSourceResult<AstronautProfile> fetchAstronautProfile(ExternalId id);
}
