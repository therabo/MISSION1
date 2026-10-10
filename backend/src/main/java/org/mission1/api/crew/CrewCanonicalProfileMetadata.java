package org.mission1.api.crew;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;

import java.net.URI;
import java.util.*;

/**
 * Additive public field authority/lineage, with no matching candidates or database decision IDs.
 */
public final class CrewCanonicalProfileMetadata {
    private static final ReviewedCrewIdentities REVIEWED = ReviewedCrewIdentities.load();

    private CrewCanonicalProfileMetadata() {}

    public record Resource(String source, String entityKind, String externalKey, URI url) {}

    public record Field(String field, String authority, CrewResponses.Observation observation) {}

    public record Metadata(
            UUID canonicalId,
            UUID requestedId,
            List<UUID> aliases,
            String identityPolicy,
            String profilePolicy,
            String availability,
            CrewResponses.Observation profileProvenance,
            java.time.Instant profileLastSuccessfulFetchAt,
            List<Resource> profileResources,
            List<Field> fields) {}

    public static Metadata describe(
            CrewReadRepository.Person p,
            UUID requested,
            CrewCanonicalIdentity identity,
            CrewSourceObservation assignmentObservation,
            List<CrewResponses.Assertion> assertions) {
        var obs =
                p.profile() == null
                        ? null
                        : CrewRestQueryService.observation(p.profile().observation());
        var fields = new ArrayList<Field>();
        for (String field :
                List.of("displayName", "agency", "nationality", "biography", "photo", "career"))
            fields.add(new Field(field, "LAUNCH_LIBRARY_2", obs));
        for (String field : List.of("role", "assignment", "expedition"))
            fields.add(
                    new Field(
                            field,
                            "LAUNCH_LIBRARY_2",
                            assignmentObservation == null
                                    ? null
                                    : CrewRestQueryService.observation(assignmentObservation)));
        assertions.forEach(a -> fields.add(new Field("presence", "NASA_OFFICIAL", a.provenance())));
        var resources = new ArrayList<Resource>();
        for (var key : p.externalIds())
            if (key.source() == CrewSource.NASA_OFFICIAL
                    && key.value().matches("profile:[a-z0-9-]+"))
                resources.add(
                        new Resource(
                                key.source().name(),
                                "PERSON_PROFILE_RESOURCE",
                                key.value(),
                                URI.create(
                                        "https://www.nasa.gov/people/"
                                                + key.value().substring(8)
                                                + "/")));
        if (p.officialProfileUrl() != null
                && resources.stream().noneMatch(r -> r.url().equals(p.officialProfileUrl())))
            resources.add(
                    new Resource(
                            "RETAINED_SOURCE",
                            "PERSON_PROFILE_RESOURCE",
                            null,
                            p.officialProfileUrl()));
        for (var declaration : REVIEWED.declarations()) {
            if (!declaration.identities().stream()
                    .allMatch(key -> p.id().equals(identity.resolveProviderIdentity(key.typed()))))
                continue;
            for (var proof : declaration.evidence()) {
                if (!Set.of("NASA_PERSON_RESOURCE", "NASA_TOPIC_RELATION").contains(proof.role()))
                    continue;
                var uri = URI.create(proof.url());
                var kind =
                        proof.role().equals("NASA_TOPIC_RELATION")
                                ? "PERSON_PROFILE_TOPIC_RESOURCE"
                                : "PERSON_PROFILE_RESOURCE";
                var namespace = proof.role().equals("NASA_TOPIC_RELATION") ? "topic:" : "people:";
                resources.add(
                        new Resource(
                                "NASA_OFFICIAL",
                                kind,
                                namespace
                                        + uri.getPath()
                                                .substring(uri.getPath().lastIndexOf('/') + 1),
                                uri));
            }
        }
        return new Metadata(
                p.id(),
                requested,
                identity.anchors(p.id()).stream()
                        .filter(id -> !id.equals(p.id()))
                        .sorted(Comparator.comparing(UUID::toString))
                        .toList(),
                CrewCanonicalIdentity.VERSION,
                CrewCanonicalProfile.VERSION,
                p.profile() == null ? "UNAVAILABLE" : "AVAILABLE",
                obs,
                p.profileFetchedAt(),
                List.copyOf(resources),
                List.copyOf(fields));
    }
}
