package org.mission1.crew.membership;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class ActiveMembershipBoundaryTest {
  @Test
  void sourceOnlyComputationAndFrozenPublicDependencyBoundary() throws Exception {
    var root = Path.of("src/main/java/org/mission1");
    for (var file :
        List.of(
            "RetainedMembershipInputs.java",
            "ShadowMembershipIdentity.java",
            "ActiveMembershipPolicy.java",
            "ActiveMembershipStore.java")) {
      String s = Files.readString(root.resolve("crew/membership/" + file));
      for (var forbidden :
          List.of(
              "CrewIdentityRepository",
              "ReviewedCrewIdentities",
              "crew_identity_binding_version",
              "crew_person_equivalence_decision",
              "CrewRestQueryService",
              "HttpClient",
              "ProcessBuilder",
              "FrozenIdentityModel",
              ".evaluateIdentity(")) assertFalse(s.contains(forbidden), file + ":" + forbidden);
    }
    for (var directory : List.of("api", "replay"))
      try (var files = Files.walk(root.resolve(directory))) {
        for (var p : files.filter(p -> p.toString().endsWith(".java")).toList())
          assertFalse(Files.readString(p).contains("crew.membership"), p.toString());
      }
  }
}
