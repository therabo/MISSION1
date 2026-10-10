package org.mission1.crew.application;

import java.time.Instant;

/** Canonical knowledge read port; reviewed writes are a separate persistence boundary. */
public interface CrewIdentityRepository {
    CrewCanonicalIdentity knowledge(Instant knownAt);

    CrewIdentityRepository EMPTY = at -> CrewCanonicalIdentity.EMPTY;
}
