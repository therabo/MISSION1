package org.mission1.crew;

import java.time.*;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.crew.persistence.JdbcCrewIdentityRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** SYNTHETIC reviewed typed correspondence for transfer tests; never a name-only retained audit. */
public final class ReviewedIdentityTestFixture {
    private ReviewedIdentityTestFixture() {}
    public static void bind(JdbcTemplate jdbc, String provider, String profile, Instant at) {
        new TransactionTemplate(new DataSourceTransactionManager(jdbc.getDataSource())).executeWithoutResult(tx -> {
            var anchors = jdbc.queryForList("SELECT person_id FROM crew_person_external_id WHERE source='LAUNCH_LIBRARY_2' AND external_id=?", UUID.class, provider);
            var person = anchors.isEmpty() ? UUID.randomUUID() : anchors.getFirst();
            if (anchors.isEmpty()) {
                jdbc.update("INSERT INTO crew_person VALUES(?,?)", person, at.atOffset(ZoneOffset.UTC));
                jdbc.update("INSERT INTO crew_person_external_id VALUES(?,'LAUNCH_LIBRARY_2',?)", person, provider);
            }
            jdbc.update("INSERT INTO crew_person_external_id VALUES(?,'NASA_OFFICIAL',?) ON CONFLICT DO NOTHING", person, profile);
            var roles = List.of("LL2_PERSON", "NASA_PERSON_RESOURCE", "NASA_TOPIC_RELATION", "NASA_MISSION_MANIFEST");
            var proofs = roles.stream().map(role -> new ReviewedCrewIdentities.Proof(role,
                    role.equals("LL2_PERSON") ? "SECONDARY_STRUCTURED" : "PRIMARY_OFFICIAL",
                    role.equals("LL2_PERSON") ? "https://ll.thespacedevs.com/2.3.0/astronauts/" + provider + "/"
                            : "https://www.nasa.gov/people/test-only/",
                    at.toString(), "a".repeat(64), "TEST_ONLY", "SYNTHETIC TEST_ONLY reviewed transfer identity")).toList();
            var declaration = new ReviewedCrewIdentities.Declaration("test-only-transfer", "REVIEWED_SAME_HUMAN", "MAINTAINER_REVIEWED",
                    List.of(new ReviewedCrewIdentities.Identity("LAUNCH_LIBRARY_2", "PERSON", provider),
                            new ReviewedCrewIdentities.Identity("NASA_OFFICIAL", "PERSON_PROFILE_RESOURCE", profile)), proofs);
            var manifest = new ReviewedCrewIdentities("crew-reviewed-identities-v1", at.atOffset(ZoneOffset.UTC).toLocalDate().toString(),
                    "SYNTHETIC TEST_ONLY explicit fixture review", List.of(declaration));
            new JdbcCrewIdentityRepository(jdbc).synchronize(manifest, at, true);
        });
    }
}
