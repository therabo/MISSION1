package org.mission1.crew.application;

import java.time.Instant;
import java.util.*;

/** Batched persisted identities/profiles; never calls a profile source or resolves identities. */
public final class CrewReadQueryService {
    private final CrewReadRepository repository;

    public CrewReadQueryService(CrewReadRepository repository) {
        this.repository = repository;
    }

    public Optional<CrewSyncRun> latestStructuredOutcome() {
        return repository.latestStructuredOutcome();
    }

    public Map<UUID, CrewReadRepository.Person> findPeople(Collection<UUID> ids, Instant asOf) {
        return repository.findPeople(ids, asOf);
    }
}
