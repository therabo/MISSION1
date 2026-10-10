package org.mission1.crew.automatic;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.automatic.IdentityTestFixtures.*;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class AutomaticIdentityBoundaryTest {
  @Test
  void reviewedCanonicalAndNetworkDependenciesAreAbsentFromComputation() throws Exception {
    try (var files = Files.list(Path.of("src/main/java/org/mission1/crew/automatic"))) {
      for (var file :
          files
              .filter(p -> !p.getFileName().toString().equals("ProductionShadowComparison.java"))
              .toList()) {
        String code = Files.readString(file);
        for (String forbidden :
            List.of(
                "ReviewedCrewIdentities",
                "CrewIdentityRepository",
                "CrewCanonicalIdentity",
                "CrewCanonicalProfile",
                "crew_identity_binding_version",
                "crew_person_equivalence_decision",
                "crew_identity_resolution",
                "HttpClient",
                "java.net.http",
                "ProcessBuilder",
                "Runtime.getRuntime"))
          assertFalse(
              code.contains(forbidden), file + " has prohibited scoring dependency " + forbidden);
      }
    }
    for (String path :
        List.of("src/main/java/org/mission1/api/crew", "src/main/java/org/mission1/replay"))
      try (var files = Files.walk(Path.of(path))) {
        for (var file : files.filter(p -> p.toString().endsWith(".java")).toList())
          assertFalse(
              Files.readString(file).contains("crew.automatic"),
              "Public projection consumed shadow");
      }
  }

  @Test
  void graphConvergesAcross1000EdgeAndDuplicatePermutations() {
    var keys = List.of("LL2:PERSON:1", "LL2:PERSON:2", "NASA:a", "NASA:b", "NASA:c");
    var edges =
        List.of(
            new ShadowIdentityGraph.Edge(
                "NASA:a", "LL2:PERSON:1", IdentityPolicy.Outcome.AUTO_MATCH, 1),
            new ShadowIdentityGraph.Edge(
                "NASA:b", "LL2:PERSON:1", IdentityPolicy.Outcome.AUTO_MATCH, 2),
            new ShadowIdentityGraph.Edge(
                "NASA:c", "LL2:PERSON:2", IdentityPolicy.Outcome.AUTO_DEFER, 3));
    var expected =
        ShadowIdentityGraph.project(keys, edges).stream()
            .map(c -> List.of(c.representative(), c.members()))
            .toList();
    for (int seed = 0; seed < 1000; seed++) {
      var shuffled = new ArrayList<>(edges);
      shuffled.add(edges.get(seed % 3));
      Collections.shuffle(shuffled, new Random(seed));
      assertEquals(
          expected,
          ShadowIdentityGraph.project(keys, shuffled).stream()
              .map(c -> List.of(c.representative(), c.members()))
              .toList());
    }
  }
}
