package org.mission1.api.crew;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;

/** TEST_ONLY assignment changes, never represented as current public-source truth. */
final class CanonicalCrewFixture {
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
