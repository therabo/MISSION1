package org.mission1.crew.application;

import java.time.Instant;
import java.util.*;

/** Batched persisted identities/profiles; never calls a profile source or resolves identities. */
public final class CrewReadQueryService {
    private final CrewReadRepository repository;

    private CrewIdentityRepository identities = CrewIdentityRepository.EMPTY;

    public CrewReadQueryService(CrewReadRepository repository) {
        this.repository = repository;
    }

    public CrewReadQueryService(CrewReadRepository repository, CrewIdentityRepository identities) {
        this(repository);
        this.identities = identities;
    }

    public CrewCanonicalIdentity identityAt(Instant at) {
        return identities.knowledge(at);
    }

    public Optional<CrewSyncRun> latestStructuredOutcome() {
        return repository.latestStructuredOutcome();
    }

    public Map<UUID, CrewReadRepository.Person> findPeople(Collection<UUID> ids, Instant asOf) {
        return repository.findPeople(ids, asOf);
    }
}
