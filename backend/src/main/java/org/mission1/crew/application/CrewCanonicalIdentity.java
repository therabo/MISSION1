package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.util.*;

/** Immutable, direct reviewed identity knowledge. No names, HTTP, SQL or mutations. */
public final class CrewCanonicalIdentity {
    public static final String VERSION = "crew-canonical-identity-v1";

    public record Key(CrewSource source, String entityKind, String externalKey) {
        public Key {
            Objects.requireNonNull(source);
            if (!Set.of("PERSON", "PERSON_PROFILE_RESOURCE", "PERSON_PROFILE_TOPIC_RESOURCE")
                            .contains(entityKind)
                    || externalKey == null
                    || externalKey.isBlank())
                throw new IllegalArgumentException("Typed person identity required");
        }

        public static Key legacy(CrewSource source, String key) {
            return new Key(
                    source,
                    source == CrewSource.LAUNCH_LIBRARY_2 ? "PERSON" : "PERSON_PROFILE_RESOURCE",
                    key);
        }
    }

    public record Link(UUID alias, UUID representative) {}

    public static final CrewCanonicalIdentity EMPTY =
            new CrewCanonicalIdentity(List.of(), Map.of());
    private final Map<UUID, UUID> representatives;
    private final Map<Key, UUID> bindings;

    public CrewCanonicalIdentity(List<Link> links, Map<Key, UUID> bindings) {
        var map = new HashMap<UUID, UUID>();
        for (var link : links) {
            if (link.alias().equals(link.representative())
                    || (map.containsKey(link.alias())
                            && !map.get(link.alias()).equals(link.representative())))
                throw new IllegalStateException("Conflicting canonical identity");
            map.put(link.alias(), link.representative());
        }
        if (map.values().stream().anyMatch(map::containsKey))
            throw new IllegalStateException("Cycle or unsupported transitive identity");
        representatives = Map.copyOf(map);
        var canonicalBindings = new HashMap<Key, UUID>();
        bindings.forEach((k, v) -> canonicalBindings.put(k, canonicalize(v)));
        this.bindings = Map.copyOf(canonicalBindings);
    }

    public UUID canonicalize(UUID id) {
        return id == null ? null : representatives.getOrDefault(id, id);
    }

    public Map<UUID, UUID> canonicalizeAll(Collection<UUID> ids) {
        var result = new LinkedHashMap<UUID, UUID>();
        ids.forEach(id -> result.put(id, canonicalize(id)));
        return Map.copyOf(result);
    }

    public Set<UUID> anchors(UUID id) {
        UUID root = canonicalize(id);
        var result = new TreeSet<UUID>();
        result.add(root);
        representatives.forEach(
                (alias, rep) -> {
                    if (rep.equals(root)) result.add(alias);
                });
        return Set.copyOf(result);
    }

    public UUID resolveProviderIdentity(Key key) {
        return bindings.get(key);
    }

    public Map<Key, UUID> bindings() {
        return bindings;
    }

    public PersonReference reference(PersonReference p) {
        var approved =
                p.externalIds().stream()
                        .map(e -> resolveProviderIdentity(Key.legacy(e.source(), e.value())))
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        if (approved.size() > 1)
            throw new IllegalStateException("Conflicting approved provider identities");
        return new PersonReference(
                approved.isEmpty() ? canonicalize(p.mission1Id()) : approved.getFirst(),
                p.displayName(),
                p.externalIds(),
                p.officialProfileUrl());
    }

    public CrewQueryService.Latest project(CrewQueryService.Latest latest) {
        if (latest == null) return null;
        var s = latest.snapshot().snapshot();
        var assignments =
                s.assignments().stream()
                        .map(
                                a ->
                                        new CrewAssignment(
                                                a.externalId(),
                                                a.expeditionId(),
                                                reference(a.person()),
                                                a.role(),
                                                a.sourceRoleLabel(),
                                                a.validFrom(),
                                                a.validUntil(),
                                                a.observation()))
                        .toList();
        var profiles =
                s.profiles().stream()
                        .map(
                                p ->
                                        new AstronautProfile(
                                                reference(p.person()),
                                                p.agency(),
                                                p.nationalities(),
                                                p.biography(),
                                                p.career(),
                                                p.media(),
                                                p.inSpace(),
                                                p.observation(),
                                                p.sourceProfileMode()))
                        .toList();
        return new CrewQueryService.Latest(
                new CrewRepository.StoredSnapshot(
                        latest.snapshot().id(),
                        new CrewSourceSnapshot(
                                s.station(),
                                s.totalActiveExpeditions(),
                                s.candidatesComplete(),
                                s.expeditions(),
                                assignments,
                                profiles,
                                s.observation(),
                                s.sourceStationExternalId())),
                latest.successfulRun());
    }

    public List<CrewIdentityResolution> project(List<CrewIdentityResolution> resolutions) {
        return resolutions.stream()
                .map(
                        r ->
                                new CrewIdentityResolution(
                                        r.id(),
                                        r.evidenceId(),
                                        r.subjectIndex(),
                                        canonicalize(r.personId()),
                                        r.method(),
                                        r.candidates().stream()
                                                .map(this::canonicalize)
                                                .distinct()
                                                .toList(),
                                        r.identityKey(),
                                        r.resolverVersion()))
                .toList();
    }
}
