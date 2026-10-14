package org.mission1.crew.domain;

import java.util.List;
import java.util.UUID;

/** Separate immutable audit; resolving a subject never rewrites the source assertion. */
public record CrewIdentityResolution(
        long id,
        long evidenceId,
        int subjectIndex,
        UUID personId,
        Method method,
        List<UUID> candidates,
        String identityKey,
        String resolverVersion) {
    public enum Method {
        OPERATIONAL_SUBJECT_BINDING,
        EXTERNAL_ID,
        OFFICIAL_PROFILE,
        AUTHORITATIVE_MAPPING,
        EXACT_UNIQUE_NAME,
        UNRESOLVED,
        AMBIGUOUS
    }

    public CrewIdentityResolution {
        candidates = List.copyOf(candidates);
    }
}
