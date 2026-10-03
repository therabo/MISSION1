package org.mission1.crew.application;

import org.mission1.crew.domain.CrewSourceResult;
import org.mission1.crew.domain.CrewSourceSnapshot;
import org.mission1.crew.domain.Station;

/** Explicit capability only; no scheduling or startup behavior. */
public interface StructuredCrewSource {
    CrewSourceResult<CrewSourceSnapshot> fetchCurrentExpedition(Station station);
}
