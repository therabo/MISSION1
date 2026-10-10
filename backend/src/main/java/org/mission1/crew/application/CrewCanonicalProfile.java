package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.util.*;

/** Retained metadata only. Assignment/presence belong to their separate operational projection. */
public final class CrewCanonicalProfile {
    public static final String VERSION = "crew-canonical-profile-v1";

    private CrewCanonicalProfile() {}

    public static Map<UUID, CrewReadRepository.Person> project(
            Map<UUID, CrewReadRepository.Person> raw,
            Collection<UUID> requested,
            CrewCanonicalIdentity identity) {
        var grouped = new TreeMap<UUID, List<CrewReadRepository.Person>>();
        raw.values()
                .forEach(
                        p ->
                                grouped.computeIfAbsent(
                                                identity.canonicalize(p.id()),
                                                x -> new ArrayList<>())
                                        .add(p));
        var canonical = new HashMap<UUID, CrewReadRepository.Person>();
        grouped.forEach(
                (id, all) -> {
                    var profile =
                            all.stream()
                                    .filter(p -> p.profile() != null)
                                    .max(
                                            Comparator.comparing(
                                                            CrewReadRepository.Person
                                                                    ::profileFetchedAt)
                                                    .thenComparing(p -> p.id().toString()))
                                    .orElse(null);
                    // A newer profile is selected whole within one provider: nulls/removals are not
                    // backfilled.
                    var name =
                            profile != null
                                    ? profile.name()
                                    : all.stream()
                                            .filter(p -> p.name() != null)
                                            .map(CrewReadRepository.Person::name)
                                            .findFirst()
                                            .orElse(null);
                    var url =
                            all.stream()
                                    .filter(p -> p.officialProfileUrl() != null)
                                    .map(CrewReadRepository.Person::officialProfileUrl)
                                    .sorted(Comparator.comparing(Object::toString))
                                    .findFirst()
                                    .orElse(null);
                    var ids =
                            all.stream()
                                    .flatMap(p -> p.externalIds().stream())
                                    .distinct()
                                    .sorted(
                                            Comparator.comparing(
                                                            (ExternalId e) -> e.source().name())
                                                    .thenComparing(ExternalId::value))
                                    .toList();
                    canonical.put(
                            id,
                            new CrewReadRepository.Person(
                                    id,
                                    name,
                                    url,
                                    ids,
                                    profile == null ? null : profile.profile(),
                                    profile == null ? null : profile.profileFetchedAt(),
                                    profile == null ? null : profile.identityObservation()));
                });
        var result = new HashMap<UUID, CrewReadRepository.Person>(canonical);
        requested.forEach(
                id -> {
                    var p = canonical.get(identity.canonicalize(id));
                    if (p != null) result.put(id, p);
                });
        return Map.copyOf(result);
    }
}
