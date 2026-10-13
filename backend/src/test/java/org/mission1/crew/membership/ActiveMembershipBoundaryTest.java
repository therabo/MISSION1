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
            "ResearchMembershipIdentity.java",
            "ActiveMembershipPolicy.java",
            "ActiveMembershipStore.java")) {
      String s = Files.readString(root.resolve("crew/membership/" + file));
      for (var forbidden :
          List.of(
              "ReviewedCrewIdentities",
              "CrewRestQueryService",
              "HttpClient",
              "ProcessBuilder",
              "FrozenIdentityModel",
              ".evaluateIdentity(")) assertFalse(s.contains(forbidden), file + ":" + forbidden);
    }
    // Current and Replay may reuse the pure policy/read adapter, never its writer or scorer.
    for (var directory : List.of("api", "replay"))
      try (var files = Files.walk(root.resolve(directory))) {
        for (var p : files.filter(p -> p.toString().endsWith(".java")).toList()) {
          var source=Files.readString(p);
          for(var forbidden:List.of("ActiveMembershipStore", "OperationalBindingWorker", "OperationalResolver", "FrozenIdentityModel"))
            assertFalse(source.contains(forbidden), p+":"+forbidden);
        }
      }
  }
}
