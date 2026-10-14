package org.mission1.api.crew;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;

/** TEST_ONLY assignment changes, never represented as current public-source truth. */
final class CanonicalCrewFixture {
    /** Explicit TEST_ONLY provider anchors for the packaged reviewed declarations. */
    static void sourceAnchors(org.springframework.jdbc.core.JdbcTemplate jdbc, java.time.Instant at) {
        for (var declaration : org.mission1.crew.application.ReviewedCrewIdentities.load().declarations()) {
            var nasa = declaration.identities().stream().filter(i -> i.source().equals("NASA_OFFICIAL")).findFirst().orElseThrow();
            if (jdbc.queryForObject("SELECT count(*) FROM crew_person_external_id WHERE source='NASA_OFFICIAL' AND external_id=?", Integer.class, nasa.externalKey()) == 0) {
                var anchor = java.util.UUID.randomUUID();
                jdbc.update("INSERT INTO crew_person VALUES(?,?)", anchor, at.atOffset(java.time.ZoneOffset.UTC));
                jdbc.update("INSERT INTO crew_person_external_id VALUES(?,'NASA_OFFICIAL',?)", anchor, nasa.externalKey());
            }
        }
    }
    static void reviewedAssignments(JsonNode tree) {
        var crew = (ArrayNode) tree.at("/results/0/crew");
        int[] keys = {710, 582};
        String[] names = {"Luke Delaney", "Jessica Watkins"};
        for (int i = 0; i < 2; i++) {
            var row = (ObjectNode) crew.get(0).deepCopy();
            row.put("id", 99000 + i);
            var p = (ObjectNode) row.get("astronaut");
            p.put("id", keys[i]);
            p.put("name", names[i]);
            p.put("bio", "TEST_ONLY retained canonical profile " + names[i]);
            crew.add(row);
        }
    }
}
