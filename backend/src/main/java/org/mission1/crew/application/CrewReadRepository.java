package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Read-only person projection, independent of membership in the current expedition. */
public interface CrewReadRepository {
    record Person(
            UUID id,
            String name,
            URI officialProfileUrl,
            List<ExternalId> externalIds,
            AstronautProfile profile,
            Instant profileFetchedAt,
            CrewSourceObservation identityObservation) {
        public Person {
            externalIds = List.copyOf(externalIds);
        }
    }

    Optional<CrewSyncRun> latestStructuredOutcome();

    Map<UUID, Person> findPeople(Collection<UUID> ids, Instant asOf);
}
