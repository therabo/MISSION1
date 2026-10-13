package org.mission1.crew.research;

import static org.mission1.crew.research.IdentityEvidence.*;

import com.fasterxml.jackson.databind.*;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.zip.GZIPInputStream;

final class IdentityTestFixtures {
  static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
  static final Instant TIME = Instant.parse("2026-10-10T12:00:00Z");

  static JsonNode file(String name) {
    try (var raw = IdentityTestFixtures.class.getResourceAsStream("/crew/automatic/" + name);
        var in = name.endsWith(".gz") ? new GZIPInputStream(raw) : raw) {
      return JSON.readTree(in);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static byte[] artifact(String name) {
    try (var in = FrozenIdentityModel.class.getResourceAsStream("/crew/automatic/" + name)) {
      return in.readAllBytes();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static Set<String> strings(JsonNode n) {
    Set<String> r = new TreeSet<>();
    n.forEach(x -> r.add(x.asText()));
    return r;
  }

  static IdentityEvidence source(JsonNode n) {
    var p = n.path("provider").asText().equals("LL2") ? Provider.LL2 : Provider.NASA;
    return new IdentityEvidence(
        n.path("key").asText(),
        p,
        p == Provider.LL2 ? Kind.PERSON : Kind.PERSONAL_RESOURCE,
        n.path("name").asText(),
        List.of(n.path("name").asText()),
        n.path("bio").asText(),
        n.path("agency").isNull() ? null : n.path("agency").asText(),
        n.path("dob").isNull() ? null : n.path("dob").asText(null),
        false,
        strings(n.path("selection")),
        strings(n.path("missions")),
        Set.of(Witness.VALIDATED_BIOGRAPHY, Witness.PERSON_SCOPED_HISTORY, Witness.PRECISE_DOB),
        List.of(),
        List.of(
            new Reference(
                "RESEARCH_FIXTURE",
                n.path("key").asText(),
                "0".repeat(64),
                n.path("url").asText("source"),
                TIME)));
  }

  static IdentityEvidence person(
      String key,
      Provider provider,
      String name,
      String bio,
      Set<Witness> q,
      List<String> conflicts) {
    return new IdentityEvidence(
        key,
        provider,
        provider == Provider.LL2 ? Kind.PERSON : Kind.EDITORIAL_SLOT,
        name,
        IdentityFeatures.aliases(name, bio),
        bio,
        "NASA",
        null,
        false,
        IdentityFeatures.years(bio),
        IdentityFeatures.missions(bio),
        q,
        conflicts,
        List.of(
            new Reference("SYNTHETIC_TEST_FIXTURE", key, "0".repeat(64), "person-scoped", TIME)));
  }

  static IdentityEvidence changed(
      IdentityEvidence r, String bio, Set<Witness> q, List<String> conflicts) {
    return new IdentityEvidence(
        r.key(),
        r.provider(),
        r.kind(),
        r.name(),
        r.aliases(),
        bio,
        r.agency(),
        r.dob(),
        r.authoritativeDob(),
        IdentityFeatures.years(bio),
        IdentityFeatures.missions(bio),
        q,
        conflicts,
        r.references());
  }

  static double[] vector(JsonNode n) {
    double[] z = new double[13];
    for (int i = 0; i < 13; i++) z[i] = n.path(FrozenIdentityModel.FEATURES.get(i)).asDouble();
    return z;
  }
}
