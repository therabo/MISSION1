package org.mission1.crew.application;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewIdentityResolution.Method;

import java.net.URI;
import java.util.*;

class CrewPersonResolverTest {
    final CrewPersonResolver resolver = new CrewPersonResolver();
    final UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");

    PersonReference person(UUID id, String name, URI profile) {
        return new PersonReference(id, name, List.of(), profile);
    }

    @Test
    void mappedExternalIdWinsOverDifferentName() {
        var s =
                new PersonReference(
                        null,
                        "Different Test Name",
                        List.of(new ExternalId(CrewSource.NASA_OFFICIAL, "id:1")),
                        null);
        var r = resolver.resolve(s, List.of(), Map.of("id:1", id));
        assertEquals(id, r.personId());
        assertEquals(Method.EXTERNAL_ID, r.method());
    }

    @Test
    void officialProfileResolvesAndUnknownProfileCanAnchorWithoutInventingLl2Profile() {
        URI url = URI.create("https://www.nasa.gov/people/test-person/");
        assertEquals(
                Method.OFFICIAL_PROFILE,
                resolver.resolve(
                                person(null, "Test Person", url),
                                List.of(person(id, "Other Name", url)),
                                Map.of())
                        .method());
        var fresh = resolver.resolve(person(null, "Test Person", url), List.of(), Map.of());
        assertNull(fresh.personId());
        assertEquals(Method.OFFICIAL_PROFILE, fresh.method());
    }

    @Test
    void uniqueCasePunctuationMatchIsAudited() {
        var r =
                resolver.resolve(
                        person(null, "  TEST A. Person  ", null),
                        List.of(person(id, "Test A Person", null)),
                        Map.of());
        assertEquals(id, r.personId());
        assertEquals(Method.EXACT_UNIQUE_NAME, r.method());
    }

    @Test
    void ambiguityStopsMatching() {
        var r =
                resolver.resolve(
                        person(null, "Test Person", null),
                        List.of(
                                person(id, "Test Person", null),
                                person(UUID.randomUUID(), "TEST PERSON", null)),
                        Map.of());
        assertNull(r.personId());
        assertEquals(Method.AMBIGUOUS, r.method());
    }

    @Test
    void strongerConflictingKeysNeverFallThroughToName() {
        var s =
                new PersonReference(
                        null,
                        "Test Person",
                        List.of(
                                new ExternalId(CrewSource.NASA_OFFICIAL, "id:1"),
                                new ExternalId(CrewSource.NASA_OFFICIAL, "id:2")),
                        null);
        var r =
                resolver.resolve(
                        s,
                        List.of(person(id, "Test Person", null)),
                        Map.of("id:1", id, "id:2", UUID.randomUUID()));
        assertEquals(Method.AMBIGUOUS, r.method());
    }

    @Test
    void spellingVariantsAndUnknownNamesStayUnresolved() {
        assertEquals(
                Method.UNRESOLVED,
                resolver.resolve(
                                person(null, "Andrey Fedyaev", null),
                                List.of(person(id, "Andrei Fedyaev", null)),
                                Map.of())
                        .method());
        assertEquals(
                Method.UNRESOLVED,
                resolver.resolve(person(null, "Unknown Test Person", null), List.of(), Map.of())
                        .method());
    }

    @Test
    void conflictingOfficialIdentityPreventsWeakerUniqueName() {
        var s = person(null, "Test Person", URI.create("https://www.nasa.gov/people/new-test/"));
        assertEquals(
                Method.AMBIGUOUS,
                resolver.resolve(
                                s,
                                List.of(person(id, "Test Person", null)),
                                Map.of("profile:other-test", id))
                        .method());
    }
}
