package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.domain.*;

import java.net.URI;
import java.time.*;
import java.util.*;

class CrewCanonicalIdentityTest {
    final UUID root = new UUID(0, 1), alias = new UUID(0, 2), other = new UUID(0, 3);
    final CrewCanonicalIdentity.Key key =
            new CrewCanonicalIdentity.Key(
                    CrewSource.NASA_OFFICIAL, "PERSON_PROFILE_RESOURCE", "profile:test-person");

    CrewCanonicalIdentity identity() {
        return new CrewCanonicalIdentity(
                List.of(new CrewCanonicalIdentity.Link(alias, root)), Map.of(key, root));
    }

    @Test
    void directAliasesAreDeterministicAndIdempotent() {
        var i = identity();
        assertEquals(root, i.canonicalize(alias));
        assertEquals(root, i.canonicalize(root));
        assertEquals(Set.of(root, alias), i.anchors(alias));
        assertEquals(other, i.canonicalize(other));
        assertNull(i.canonicalize(null));
    }

    @Test
    void conflictsCyclesAndImplicitChainsFailClosed() {
        assertThrows(
                IllegalStateException.class,
                () ->
                        new CrewCanonicalIdentity(
                                List.of(
                                        new CrewCanonicalIdentity.Link(alias, root),
                                        new CrewCanonicalIdentity.Link(alias, other)),
                                Map.of()));
        assertThrows(
                IllegalStateException.class,
                () ->
                        new CrewCanonicalIdentity(
                                List.of(
                                        new CrewCanonicalIdentity.Link(alias, root),
                                        new CrewCanonicalIdentity.Link(root, alias)),
                                Map.of()));
        assertThrows(
                IllegalStateException.class,
                () ->
                        new CrewCanonicalIdentity(
                                List.of(
                                        new CrewCanonicalIdentity.Link(alias, root),
                                        new CrewCanonicalIdentity.Link(other, alias)),
                                Map.of()));
    }

    PersonReference subject(URI url) {
        return new PersonReference(null, "TEST_ONLY Exact Name", List.of(), url);
    }

    @Test
    void newNameOnlyCandidateRequiresReviewWhileRetainedV1AuditSurvives() {
        var candidate = new PersonReference(alias, "TEST_ONLY Exact Name", List.of(), null);
        var decision =
                CrewCanonicalPersonResolver.resolve(
                        subject(null), List.of(candidate), Map.of(), null, identity());
        assertNull(decision.personId());
        assertEquals(CrewIdentityResolution.Method.UNRESOLVED, decision.method());
        var old =
                new CrewIdentityResolution(
                        1,
                        2,
                        0,
                        alias,
                        CrewIdentityResolution.Method.EXACT_UNIQUE_NAME,
                        List.of(alias),
                        null,
                        CrewPersonResolver.VERSION);
        var retained =
                CrewCanonicalPersonResolver.resolve(
                        subject(null), List.of(candidate), Map.of(), old, identity());
        assertEquals(root, retained.personId());
        assertEquals(old.method(), retained.method());
    }

    @Test
    void approvedKeyOverridesLegacyAnchorWithoutNameMatching() {
        var decision =
                CrewCanonicalPersonResolver.resolve(
                        subject(URI.create("https://www.nasa.gov/people/test-person/")),
                        List.of(),
                        Map.of("profile:test-person", alias),
                        null,
                        identity());
        assertEquals(root, decision.personId());
        assertEquals(CrewIdentityResolution.Method.AUTHORITATIVE_MAPPING, decision.method());
    }

    @Test
    void metadataNullsFromNewestSuccessfulObservationRemainNullAndCareerIsNotSummed() {
        var o =
                new CrewSourceObservation(
                        CrewSource.LAUNCH_LIBRARY_2,
                        URI.create("https://example.test/TEST_ONLY"),
                        Instant.parse("2026-10-03T12:00:00Z"),
                        null,
                        null,
                        null,
                        null,
                        "a".repeat(64),
                        "TEST_ONLY",
                        "TEST_ONLY");
        var profile =
                new AstronautProfile(
                        new PersonReference(alias, "TEST_ONLY Latest", List.of(), null),
                        null,
                        List.of(),
                        null,
                        null,
                        null,
                        false,
                        o,
                        "TEST_ONLY");
        var old =
                new AstronautProfile(
                        new PersonReference(root, "TEST_ONLY Old", List.of(), null),
                        null,
                        List.of(),
                        "old",
                        null,
                        null,
                        false,
                        o,
                        "TEST_ONLY");
        var raw =
                Map.of(
                        root,
                        new CrewReadRepository.Person(
                                root, "TEST_ONLY Old", null, List.of(), old, o.retrievedAt(), o),
                        alias,
                        new CrewReadRepository.Person(
                                alias,
                                "TEST_ONLY Latest",
                                null,
                                List.of(),
                                profile,
                                o.retrievedAt().plusSeconds(1),
                                o));
        var projected = CrewCanonicalProfile.project(raw, List.of(root, alias), identity());
        assertEquals(projected.get(root), projected.get(alias));
        assertEquals(root, projected.get(alias).id());
        assertEquals("TEST_ONLY Latest", projected.get(root).name());
        assertNull(projected.get(root).profile().biography());
        assertNull(projected.get(root).profile().career());
    }

    @Test
    void curatedManifestContainsOnlyTwoReviewedProviderPairs() {
        var m = ReviewedCrewIdentities.load();
        assertEquals(2, m.declarations().size());
        assertEquals(
                Set.of("710", "582"),
                m.declarations().stream()
                        .flatMap(d -> d.identities().stream())
                        .filter(i -> i.source().equals("LAUNCH_LIBRARY_2"))
                        .map(ReviewedCrewIdentities.Identity::externalKey)
                        .collect(java.util.stream.Collectors.toSet()));
        assertFalse(m.toString().contains("732"));
    }
}
