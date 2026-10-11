package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.*;
import java.util.*;
import java.util.zip.GZIPInputStream;
import org.mission1.crew.automatic.*;
import org.mission1.source.crew.CrewHttpReader;

final class OperationalFixtures {
  static final ObjectMapper JSON =
      new ObjectMapper()
          .registerModule(new JavaTimeModule())
          .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
  static final Instant CUT = Instant.parse("2026-10-11T17:30:00Z");
  static final JsonNode CORPUS = load();

  static JsonNode load() {
    try (var s =
        new GZIPInputStream(
            OperationalFixtures.class.getResourceAsStream(
                "/crew/operational/research-corpus.json.gz"))) {
      return JSON.readTree(s);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static final List<Subject> SUBJECTS = subjects();
  static final List<Resource> RESOURCES = resources();
  static final OperationalResolver RESOLVER =
      new OperationalResolver(FrozenIdentityModel.load(JSON), OperationalPolicy.SHADOW);

  static List<Subject> subjects() {
    var result = new ArrayList<Subject>();
    for (var s : CORPUS.path("subjects")) {
      String name = s.path("exactName").asText(),
          p = s.path("sourceParagraph").asText(),
          type = s.path("evidenceType").asText(),
          title = s.path("title").asText();
      result.add(
          new Subject(
              s.path("sourceSubjectId").asText(),
              s.path("version").asText(),
              s.path("evidenceId").asLong(),
              s.path("subjectIndex").asInt(),
              s.path("documentId").asLong(),
              s.path("evidenceHash").asText(),
              s.path("rawBodyHash").asText(),
              s.path("article").asText(),
              title,
              name,
              p,
              s.path("inlineHTML").asText(),
              type,
              s.path("assertion").asText(),
              Instant.parse(s.path("effectiveAt").asText()),
              Instant.parse(s.path("effectiveAt").asText()),
              CUT.minusSeconds(7200),
              s.path("timeMethod").asText(),
              OperationalResources.sourceAgency(name, p),
              "SOURCE_OPERATIONAL_ROLE",
              OperationalResources.scopedMissions(type, title, p),
              OperationalResources.anchors(s.path("inlineHTML").asText(), name),
              true));
    }
    return List.copyOf(result);
  }

  static List<Resource> resources() {
    var out = new ArrayList<Resource>();
    var parser = new OperationalResources(JSON);
    for (var n : CORPUS.path("captures"))
      try {
        byte[] body = n.path("body").binaryValue();
        if (!CrewHttpReader.sha256(body).equals(n.path("fixtureHash").asText()))
          throw new IllegalStateException("Fixture hash");
        var c =
            new OperationalResources.Capture(
                n.path("url").asText(),
                n.path("finalUrl").asText(),
                JSON.convertValue(
                    n.path("redirects"),
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}),
                Instant.parse(n.path("capturedAt").asText()),
                n.path("status").asInt(),
                n.path("contentType").asText(),
                null,
                body);
        out.addAll(
            parser.parse(
                c,
                "fixture:"
                    + CrewHttpReader.sha256(
                        c.url().getBytes(java.nio.charset.StandardCharsets.UTF_8))));
      } catch (Exception e) {
        throw new IllegalStateException("Fixture parser: " + n.path("url").asText(), e);
      }
    return List.copyOf(out);
  }

  static Subject subject(String name) {
    return SUBJECTS.stream().filter(s -> s.name().equals(name)).findFirst().orElseThrow();
  }

  static Resource provider(String key) {
    return RESOURCES.stream().filter(r -> key.equals(r.providerKey())).findFirst().orElseThrow();
  }

  static Subject changed(
      Subject s,
      String name,
      String type,
      String assertion,
      Instant at,
      boolean integrity,
      List<Anchor> anchors) {
    return new Subject(
        s.key(),
        s.version(),
        s.evidenceId(),
        s.index(),
        s.documentId(),
        s.evidenceHash(),
        s.documentHash(),
        s.article(),
        s.title(),
        name,
        s.paragraph(),
        s.inlineHtml(),
        type,
        assertion,
        at,
        s.publishedAt(),
        s.capturedAt(),
        s.parser(),
        s.agency(),
        s.role(),
        s.missions(),
        anchors,
        integrity);
  }

  static Resource changed(
      Resource r,
      Kind kind,
      String name,
      String agency,
      String dob,
      List<Flight> flights,
      List<String> links,
      Instant validUntil) {
    return new Resource(
        r.ref(),
        r.url(),
        r.finalUrl(),
        r.redirects(),
        r.hash(),
        r.capturedAt(),
        validUntil,
        kind,
        agency,
        name,
        dob,
        r.selections(),
        r.missions(),
        r.aliases(),
        r.providerKey(),
        flights,
        r.roster(),
        links,
        r.biography(),
        r.locator());
  }
}
