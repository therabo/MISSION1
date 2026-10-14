package org.mission1.crew.application;

import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewIdentityResolution.Method;

import java.util.*;

/**
 * Approved correspondence first; typed provider bindings and retained reviewed audits; weak candidates need review.
 */
public final class CrewCanonicalPersonResolver {
    public static final String VERSION = "crew-person-resolution-v2";

    private CrewCanonicalPersonResolver() {}

    public static CrewPersonResolver.Decision resolve(
            PersonReference subject,
            List<PersonReference> candidates,
            Map<String, UUID> providerBindings,
            CrewIdentityResolution previous,
            CrewCanonicalIdentity identity) {
        var approved = new HashSet<UUID>();
        var key = CrewPersonResolver.profileKey(subject.officialProfileUrl());
        var keys = new ArrayList<String>();
        subject.externalIds().stream()
                .filter(e -> e.source() == CrewSource.NASA_OFFICIAL)
                .forEach(e -> keys.add(e.value()));
        if (key != null) keys.add(key);
        keys.forEach(
                k -> {
                    var p =
                            identity.resolveProviderIdentity(
                                    CrewCanonicalIdentity.Key.provider(CrewSource.NASA_OFFICIAL, k));
                    if (p != null) approved.add(p);
                });
        if (approved.size() > 1)
            return new CrewPersonResolver.Decision(
                    null, Method.AMBIGUOUS, approved.stream().sorted().toList(), key);
        if (approved.size() == 1) {
            UUID p = approved.iterator().next();
            if (keys.stream()
                    .filter(providerBindings::containsKey)
                    .filter(
                            k ->
                                    identity.resolveProviderIdentity(
                                                    CrewCanonicalIdentity.Key.provider(
                                                            CrewSource.NASA_OFFICIAL, k))
                                            == null)
                    .anyMatch(k -> !identity.canonicalize(providerBindings.get(k)).equals(p)))
                return new CrewPersonResolver.Decision(null, Method.AMBIGUOUS, List.of(p), key);
            return new CrewPersonResolver.Decision(
                    p, Method.AUTHORITATIVE_MAPPING, List.of(p), key);
        }
        var d = new CrewPersonResolver().resolve(subject, candidates, providerBindings);
        // Reuse current-policy audits only while their typed correspondence still holds.
        // Pre-publication name-only audits cannot authorize a public installation.
        if (previous != null
                && VERSION.equals(previous.resolverVersion())
                && previous.method() != Method.EXACT_UNIQUE_NAME
                && previous.personId() != null
                && Objects.equals(identity.canonicalize(previous.personId()),
                        identity.canonicalize(d.personId())))
            return new CrewPersonResolver.Decision(
                    identity.canonicalize(previous.personId()), previous.method(),
                    previous.candidates().stream().map(identity::canonicalize).distinct().sorted().toList(),
                    previous.identityKey());
        if (d.method() == Method.EXACT_UNIQUE_NAME) {
            // A verified unknown profile may anchor a provider person; it cannot name-merge it.
            return new CrewPersonResolver.Decision(
                    null,
                    key == null ? Method.UNRESOLVED : Method.OFFICIAL_PROFILE,
                    d.candidates(),
                    key);
        }
        return new CrewPersonResolver.Decision(
                identity.canonicalize(d.personId()), d.method(), d.candidates(), d.nasaKey());
    }
}
