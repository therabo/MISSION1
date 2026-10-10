package org.mission1.crew.application;

import com.fasterxml.jackson.databind.json.JsonMapper;

import org.mission1.crew.domain.CrewSource;

import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Curated reviewed DATA, never a matching heuristic or network client. */
public record ReviewedCrewIdentities(
        String version, String approvedOn, String reviewContext, List<Declaration> declarations) {
    public ReviewedCrewIdentities {
        declarations = List.copyOf(declarations);
    }

    public record Identity(String source, String entityKind, String externalKey) {
        public CrewCanonicalIdentity.Key typed() {
            return new CrewCanonicalIdentity.Key(
                    CrewSource.valueOf(source), entityKind, externalKey);
        }
    }

    public record Proof(
            String role,
            String category,
            String url,
            String capturedAt,
            String captureHash,
            String locator,
            String summary) {}

    public record Declaration(
            String key,
            String decision,
            String actor,
            List<Identity> identities,
            List<Proof> evidence) {
        public Declaration {
            identities = List.copyOf(identities);
            evidence = List.copyOf(evidence);
        }
    }

    public static ReviewedCrewIdentities load() {
        try (var in =
                ReviewedCrewIdentities.class.getResourceAsStream(
                        "/crew/reviewed-identities-v1.json")) {
            return validate(
                    JsonMapper.builder()
                            .enable(
                                    com.fasterxml.jackson.databind.DeserializationFeature
                                            .FAIL_ON_UNKNOWN_PROPERTIES)
                            .build()
                            .readValue(in, ReviewedCrewIdentities.class));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid reviewed Crew manifest", e);
        }
    }

    public static ReviewedCrewIdentities validate(ReviewedCrewIdentities m) {
        if (!"crew-reviewed-identities-v1".equals(m.version())
                || m.declarations() == null
                || m.declarations().size() > 50
                || m.reviewContext() == null)
            throw new IllegalArgumentException("Reviewed manifest contract required");
        java.time.LocalDate.parse(m.approvedOn());
        if (m.reviewContext().isBlank() || m.reviewContext().length() > 2000)
            throw new IllegalArgumentException("Bounded review context required");
        var keys = new HashSet<String>();
        var providerKeys = new HashSet<CrewCanonicalIdentity.Key>();
        for (var d : m.declarations()) {
            if (d.key() == null
                    || !d.key().matches("[a-z0-9-]{1,100}")
                    || !keys.add(d.key())
                    || !"REVIEWED_SAME_HUMAN".equals(d.decision())
                    || !Set.of("HUMAN_APPROVED", "MAINTAINER_REVIEWED").contains(d.actor())
                    || d.identities() == null
                    || d.identities().size() != 2
                    || d.evidence() == null
                    || d.evidence().size() < 4
                    || d.evidence().size() > 20)
                throw new IllegalArgumentException("Invalid reviewed declaration");
            for (var i : d.identities()) {
                var key = i.typed();
                if (!providerKeys.add(key)
                        || (key.source() == CrewSource.LAUNCH_LIBRARY_2
                                && (!key.entityKind().equals("PERSON")
                                        || !key.externalKey().matches("[1-9][0-9]*")))
                        || (key.source() == CrewSource.NASA_OFFICIAL
                                && (!key.entityKind().equals("PERSON_PROFILE_RESOURCE")
                                        || !key.externalKey().matches("profile:[a-z0-9-]+"))))
                    throw new IllegalArgumentException(
                            "Contradictory or untyped provider identity");
            }
            if (d.identities().stream().map(Identity::source).distinct().count() != 2)
                throw new IllegalArgumentException("Reviewed cross-provider pair required");
            var roles = new HashSet<String>();
            for (var p : d.evidence()) {
                var url = URI.create(p.url());
                Instant.parse(p.capturedAt());
                if (!"https".equals(url.getScheme())
                        || url.getHost() == null
                        || url.getUserInfo() != null
                        || p.url().length() > 2048
                        || p.role() == null
                        || !p.role().matches("[A-Z0-9_]{1,80}")
                        || !p.captureHash().matches("[0-9a-f]{64}")
                        || p.locator().isBlank()
                        || p.locator().length() > 512
                        || p.summary().isBlank()
                        || p.summary().length() > 2000
                        || !Set.of("PRIMARY_OFFICIAL", "SECONDARY_STRUCTURED", "RETAINED_SOURCE")
                                .contains(p.category()))
                    throw new IllegalArgumentException("Bounded reproducible evidence required");
                if (p.role().startsWith("NASA_") && !"www.nasa.gov".equals(url.getHost()))
                    throw new IllegalArgumentException(
                            "NASA proof must identify an official NASA resource");
                if (p.role().equals("LL2_PERSON") && !"ll.thespacedevs.com".equals(url.getHost()))
                    throw new IllegalArgumentException("LL2 identity proof required");
                roles.add(p.role());
            }
            if (!roles.containsAll(
                    Set.of(
                            "LL2_PERSON",
                            "NASA_PERSON_RESOURCE",
                            "NASA_TOPIC_RELATION",
                            "NASA_MISSION_MANIFEST")))
                throw new IllegalArgumentException("Official person/mission proof required");
        }
        return m;
    }
}
