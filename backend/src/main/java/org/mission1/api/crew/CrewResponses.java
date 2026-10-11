package org.mission1.api.crew;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Public JSON contract. No persistence IDs, provider DTOs, raw documents or domain records. */
public final class CrewResponses {
    private CrewResponses() {}

    public record Station(String id, String name) {}

    public record ExternalId(String source, String value) {}

    public record Expedition(
            UUID id, String name, Instant start, Instant end, List<ExternalId> externalIds) {}

    public record Agency(
            String name, String abbreviation, String type, List<ExternalId> externalIds) {}

    public record Nationality(String alpha2, String alpha3, String displayName) {}

    public record Media(
            URI url,
            URI thumbnailUrl,
            String credit,
            String licenseName,
            URI licenseUrl,
            Boolean singleUse) {}

    public record Career(
            String timeInSpace,
            String evaTime,
            Integer flightsCount,
            Integer spacewalksCount,
            Instant firstFlight,
            Instant lastFlight) {}

    public record Assignment(
            UUID expeditionId,
            String role,
            String roleCode,
            Instant validFrom,
            Instant validUntil) {}

    public record Observation(
            String source,
            String sourceType,
            URI sourceUrl,
            Instant observedAt,
            Instant sourcePublishedAt,
            Instant sourceEventAt,
            String contentHash,
            String sourceVersion,
            String methodVersion) {}

    public record Assertion(
            String source,
            String sourceType,
            String type,
            String assertion,
            String completeness,
            Instant asOf,
            Observation provenance) {}

    public record Presence(
            String state,
            String lastKnownState,
            Instant asOf,
            String authority,
            List<Assertion> evidence) {}

    public record Member(
            UUID id,
            String name,
            Agency agency,
            List<Nationality> nationalities,
            Media image,
            Assignment assignment,
            Presence presence,
            List<ExternalId> externalIds,
            CrewCanonicalProfileMetadata.Metadata canonicalProfile) {
        public Member(
                UUID id,
                String name,
                Agency agency,
                List<Nationality> nationalities,
                Media image,
                Assignment assignment,
                Presence presence,
                List<ExternalId> externalIds) {
            this(id, name, agency, nationalities, image, assignment, presence, externalIds, null);
        }
    }

    public record UnresolvedSubject(
            String displayName, String resolution, Assertion evidence, boolean applicable) {}

    public record Counts(
            Integer officialAboard,
            Integer lastKnownOfficialAboard,
            int resolvedAboard,
            int unresolvedSubjects,
            int unidentifiedAboard,
            Integer structuredAssignments) {}

    public record Reconciliation(
            String status,
            Instant evaluatedAt,
            Instant reconciledAt,
            String algorithmVersion,
            Instant lastAttemptAt,
            Instant lastAttemptCompletedAt,
            String lastAttemptResult) {}

    public record SourceHealth(
            String source,
            String sourceState,
            Instant lastAttemptAt,
            String lastAttemptResult,
            Instant lastSuccessfulFetchAt,
            Instant lastFailureAt,
            boolean lastRefreshFailed,
            boolean rateLimited,
            Instant retryAfterAt,
            boolean stale) {}

    public record Freshness(
            Instant evaluatedAt,
            SourceHealth structuredSource,
            SourceHealth verification,
            boolean stale) {}

    public record Provenance(
            Observation structuredSource,
            Observation verification,
            List<Assertion> contributingAssertions) {}

    public record MembershipProjection(
            String mode, long revision, Instant evaluatedAt, String policyVersion, String health,
            long ageSeconds, int resolvedCurrentMembers, int nonPublishableActive,
            int canonicalCollisions, int unresolvedActiveSourceSlots) {}

    public record Crew(
            Station station,
            Expedition expedition,
            Counts counts,
            List<Member> members,
            List<UnresolvedSubject> unresolvedSubjects,
            Reconciliation reconciliation,
            Freshness freshness,
            Provenance provenance,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
            MembershipProjection membership) {
        public Crew(Station station, Expedition expedition, Counts counts, List<Member> members,
                List<UnresolvedSubject> unresolvedSubjects, Reconciliation reconciliation, Freshness freshness,
                Provenance provenance) {
            this(station, expedition, counts, members, unresolvedSubjects, reconciliation, freshness, provenance, null);
        }
    }

    public record ExpeditionAssignment(
            UUID personId,
            String name,
            String role,
            String roleCode,
            Agency agency,
            List<Nationality> nationalities) {}

    public record CurrentExpedition(
            Station station,
            Expedition expedition,
            int assignmentCount,
            List<ExpeditionAssignment> assignments,
            String sourceState,
            SourceHealth freshness,
            Observation provenance) {}

    public record Person(
            UUID id,
            String name,
            URI officialProfileUrl,
            List<ExternalId> externalIds,
            Agency agency,
            List<Nationality> nationalities,
            String biography,
            Media image,
            Career career,
            String profileAvailability,
            Assignment currentAssignment,
            Presence currentPresence,
            Reconciliation reconciliation,
            Observation profileProvenance,
            Instant profileLastSuccessfulFetchAt,
            CrewCanonicalProfileMetadata.Metadata canonicalProfile) {
        public Person(
                UUID id,
                String name,
                URI officialProfileUrl,
                List<ExternalId> externalIds,
                Agency agency,
                List<Nationality> nationalities,
                String biography,
                Media image,
                Career career,
                String profileAvailability,
                Assignment currentAssignment,
                Presence currentPresence,
                Reconciliation reconciliation,
                Observation profileProvenance,
                Instant profileLastSuccessfulFetchAt) {
            this(
                    id,
                    name,
                    officialProfileUrl,
                    externalIds,
                    agency,
                    nationalities,
                    biography,
                    image,
                    career,
                    profileAvailability,
                    currentAssignment,
                    currentPresence,
                    reconciliation,
                    profileProvenance,
                    profileLastSuccessfulFetchAt,
                    null);
        }
    }
}
