package org.mission1.orbital.application;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.mission1.orbital.domain.OrbitalElementSet;

/** Durable, validated source-set history. Freshness is evaluated separately at read time. */
public interface OrbitalElementSetRepository {
    record Stored(long id, OrbitalElementSet elements) { }
    record StoreResult(long id, boolean elementInserted, boolean observationInserted) { }

    StoreResult storeIfNew(OrbitalElementSet elements);

    Optional<Stored> findById(long id);

    /** Most recent element epoch observed by asOf; equal epochs use retrieval time, then hash. */
    Optional<Stored> latestUsable(Instant asOf);

    /** Latest durable provider observation, independent of element epoch or orbital quality. */
    Optional<Instant> lastSuccessfulRetrieval(String provider, int catalogNumber);

    /** Distinct sets ordered by element epoch, latest retrieval, then stable identity. */
    List<Stored> recent(int limit);
}
