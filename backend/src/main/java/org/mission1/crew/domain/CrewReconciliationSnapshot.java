package org.mission1.crew.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Derived interpretation, separate from both sources. No LL2 profile or assignment is overwritten.
 */
public record CrewReconciliationSnapshot(
        String algorithmVersion,
        Instant reconciliationAsOf,
        Long primarySnapshotId,
        Long primaryRunId,
        Long verificationRunId,
        Instant primaryFetchedAt,
        Instant verificationFetchedAt,
        ReconciliationStatus status,
        Integer officialCrewCount,
        int unidentifiedCount,
        List<PersonState> people,
        List<UnresolvedSubject> unresolved,
        List<UUID> presentInBoth,
        List<UUID> onlyInLl2,
        List<UUID> onlyInNasa,
        List<Long> evidenceIds,
        List<Long> resolutionIds,
        List<Long> documentIds) {
    public enum Presence {
        CONFIRMED_ABOARD,
        CONFIRMED_NOT_ABOARD,
        UNVERIFIED,
        UNKNOWN,
        STALE,
        AMBIGUOUS
    }

    public record PersonState(
            UUID personId,
            Presence presence,
            Presence lastKnownPresence,
            Instant assertionAsOf,
            List<Long> evidenceIds,
            boolean ll2Assigned) {
        public PersonState {
            evidenceIds = List.copyOf(evidenceIds);
        }
    }

    public record UnresolvedSubject(
            long evidenceId,
            int subjectIndex,
            String displayName,
            CrewIdentityResolution.Method method,
            List<UUID> candidates) {
        public UnresolvedSubject {
            candidates = List.copyOf(candidates);
        }
    }

    public CrewReconciliationSnapshot {
        people = List.copyOf(people);
        unresolved = List.copyOf(unresolved);
        presentInBoth = List.copyOf(presentInBoth);
        onlyInLl2 = List.copyOf(onlyInLl2);
        onlyInNasa = List.copyOf(onlyInNasa);
        evidenceIds = List.copyOf(evidenceIds);
        resolutionIds = List.copyOf(resolutionIds);
        documentIds = List.copyOf(documentIds);
    }
}
