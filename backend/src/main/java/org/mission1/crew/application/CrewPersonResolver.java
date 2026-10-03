package org.mission1.crew.application;

import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewIdentityResolution.Method;

import java.net.URI;
import java.text.Normalizer;
import java.util.*;

/**
 * Pure deterministic matching. Ambiguity stops resolution; spelling similarity never participates.
 */
public final class CrewPersonResolver {
    public static final String VERSION = "crew-person-resolution-v1";

    public record Decision(UUID personId, Method method, List<UUID> candidates, String nasaKey) {}

    public Decision resolve(
            PersonReference subject,
            List<PersonReference> candidates,
            Map<String, UUID> nasaMappings) {
        var mapped = new HashSet<UUID>();
        for (var id : subject.externalIds())
            if (id.source() == CrewSource.NASA_OFFICIAL && nasaMappings.containsKey(id.value()))
                mapped.add(nasaMappings.get(id.value()));
        String key = profileKey(subject.officialProfileUrl());
        if (key != null && nasaMappings.containsKey(key)) mapped.add(nasaMappings.get(key));
        if (mapped.size() > 1) return ambiguous(mapped, key);
        if (mapped.size() == 1) return decision(mapped.iterator().next(), Method.EXTERNAL_ID, key);
        if (key != null) {
            var profiles =
                    candidates.stream()
                            .filter(p -> key.equals(profileKey(p.officialProfileUrl())))
                            .map(PersonReference::mission1Id)
                            .filter(Objects::nonNull)
                            .distinct()
                            .toList();
            if (profiles.size() > 1) return ambiguous(profiles, key);
            if (profiles.size() == 1)
                return decision(profiles.getFirst(), Method.OFFICIAL_PROFILE, key);
        }
        var names =
                candidates.stream()
                        .filter(
                                p ->
                                        normalize(p.displayName())
                                                .equals(normalize(subject.displayName())))
                        .map(PersonReference::mission1Id)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList();
        if (names.size() > 1) return ambiguous(names, key);
        if (names.size() == 1) {
            UUID id = names.getFirst();
            // A distinct already-bound NASA key is stronger conflicting identity evidence.
            if (key != null
                    && nasaMappings.entrySet().stream()
                            .anyMatch(e -> e.getValue().equals(id) && !e.getKey().equals(key)))
                return ambiguous(List.of(id), key);
            return decision(id, Method.EXACT_UNIQUE_NAME, key);
        }
        // The repository may allocate a NASA-only anchor for this independently validated profile
        // key.
        return new Decision(
                null, key == null ? Method.UNRESOLVED : Method.OFFICIAL_PROFILE, List.of(), key);
    }

    private static Decision decision(UUID id, Method method, String key) {
        return new Decision(id, method, List.of(id), key);
    }

    private static Decision ambiguous(Collection<UUID> ids, String key) {
        return new Decision(null, Method.AMBIGUOUS, ids.stream().sorted().toList(), key);
    }

    public static String profileKey(URI uri) {
        if (uri == null
                || !"https".equals(uri.getScheme())
                || !"www.nasa.gov".equals(uri.getHost())
                || uri.getUserInfo() != null
                || uri.getPort() != -1
                || uri.getQuery() != null
                || uri.getFragment() != null
                || !uri.getPath().matches("/people/[a-z0-9-]+/")) return null;
        return "profile:" + uri.getPath().substring(8, uri.getPath().length() - 1);
    }

    public static String normalize(String name) {
        // Case, spacing and punctuation only. No accent folding, token reordering or
        // transliteration.
        return Normalizer.normalize(name, Normalizer.Form.NFC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\p{P}]", "")
                .replaceAll("[\\s\\p{Z}]+", " ")
                .trim();
    }
}
