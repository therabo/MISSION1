package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.operational.OperationalBinding.*;
import static org.mission1.crew.operational.OperationalFixtures.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.*;
import java.util.stream.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** Explicitly constructed research faults, separately counted from real source subjects. */
class OperationalFaultTest {
  static Stream<JsonNode> links() {
    return StreamSupport.stream(CORPUS.path("resourceLinkFaults").spliterator(), false);
  }

  static Stream<JsonNode> gates() {
    return StreamSupport.stream(CORPUS.path("hardNegatives").spliterator(), false)
        .filter(n -> n.path("kind").asText().equals("CONSTRUCTED_GATE_FAULT"));
  }

  @ParameterizedTest
  @MethodSource("links")
  void all16ResourceLinkFaults(JsonNode row) {
    var input = row.path("input");
    var original = subject("Anil Menon");
    String role = input.path("anchorDOMRole").asText(), url = input.path("requestedURL").asText();
    String html = "<p><a href=\"" + url + "\">" + input.path("anchorText").asText() + "</a></p>";
    if (!role.equals("asserted-subject"))
      html =
          "<"
              + (role.equals("author") ? "cite" : "figcaption")
              + ">"
              + html
              + "</"
              + (role.equals("author") ? "cite" : "figcaption")
              + ">";
    var s =
        changed(
            original,
            input.path("sourceSubject").asText(),
            original.type(),
            original.assertion(),
            original.effectiveAt(),
            true,
            OperationalResources.anchors(html, input.path("sourceSubject").asText()));
    var p =
        RESOURCES.stream()
            .filter(r -> r.kind() == Kind.NASA_PEOPLE && r.name().equals("Anil Menon"))
            .findFirst()
            .orElseThrow();
    Kind kind =
        switch (input.path("type").asText()) {
          case "people" -> Kind.NASA_PEOPLE;
          case "topic" -> Kind.NASA_TOPIC;
          case "mission" -> Kind.NASA_MISSION;
          default -> Kind.AGENCY_INDEX;
        };
    var resource =
        new Resource(
            p.ref(),
            url,
            input.path("finalURL").asText(),
            url.equals(input.path("finalURL").asText())
                ? List.of()
                : List.of(input.path("finalURL").asText()),
            p.hash(),
            p.capturedAt(),
            p.validUntil(),
            kind,
            p.agency(),
            input.path("title").asText(),
            input.path("preciseDOBConflict").asBoolean() ? "1900-02-02" : null,
            p.selections(),
            p.missions(),
            p.aliases(),
            null,
            List.of(),
            List.of(),
            List.of(),
            p.biography(),
            p.locator());
    var available = input.path("status").asInt() == 200 ? List.of(resource) : List.<Resource>of();
    var link = RESOLVER.personalLinks(s, available, CUT);
    boolean qualified =
        !link.people().isEmpty()
            && input.path("temporal").asBoolean()
            && !input.path("preciseDOBConflict").asBoolean();
    assertEquals(
        row.path("expectedLinkAccepted").asBoolean(), qualified, row.path("case").asText());
    // A structurally valid personal resource alone still cannot create a provider/canonical
    // identity.
    assertEquals(Outcome.AUTO_DEFER, RESOLVER.evaluate(s, available, CUT, true).outcome());
  }

  @ParameterizedTest
  @MethodSource("gates")
  void all25ResearchGateFaults(JsonNode row) {
    String name = row.path("caseId").asText().substring("constructed:".length());
    var s = subject("Anil Menon");
    var base = RESOLVER.evaluate(s, RESOURCES, CUT, true).candidates().getFirst();
    boolean witness = true, temporal = true, publishable = true, complete = true;
    double runner = 0;
    var contradictions = new ArrayList<String>();
    switch (name) {
      case "wrong-person-target",
          "anchor-name-target-name-mismatch",
          "stale-redirect-to-another-person",
          "generic-astronaut-page",
          "partner-agency-index",
          "mission-page-as-person",
          "topic-without-person-biography",
          "ambiguous-multiple-person-resource",
          "article-author",
          "photo-credit-person",
          "missing-profile-and-no-alternate-proof",
          "uncached-official-source-outage" ->
          witness = false;
      case "precise-DOB-conflict",
          "agency-contradiction",
          "stable-provider-ID-conflict",
          "explicit-mission-not-in-roster" ->
          contradictions.add("CONSTRUCTED_AUTHORITY_CONTRADICTION");
      case "completed-flight-before-source-and-no-reentry",
          "future-assigned-not-launched",
          "former-crew-used-as-current",
          "previous-expedition-at-wrong-time" ->
          temporal = false;
      case "unknown-visitor-without-provider-anchor" -> publishable = false;
      case "unknown-homonym-unobservable-distinction", "one-of-two-equal-qualified-candidates" ->
          runner = base.probability();
      case "cached-official-source-outage" ->
          assertEquals(Outcome.AUTO_MATCH, RESOLVER.evaluate(s, RESOURCES, CUT, true).outcome());
      case "missing-profile-with-official-person-roster" -> {
        var rosterOnly =
            RESOURCES.stream()
                .filter(r -> r.kind() == Kind.PROVIDER_PERSON || r.kind() == Kind.NASA_MISSION)
                .toList();
        assertEquals(
            Outcome.AUTO_MATCH,
            RESOLVER.evaluate(subject("Jessica Watkins"), rosterOnly, CUT, true).outcome());
      }
      default -> fail("Unported research fault: " + name);
    }
    var fault =
        new Candidate(
            base.key(),
            base.name(),
            base.blocks(),
            base.rawFeatures(),
            base.features(),
            base.probability(),
            true,
            temporal,
            witness,
            false,
            base.signals(),
            contradictions,
            List.of(),
            witness ? base.proofs() : List.of(),
            0,
            0);
    assertEquals(
        row.path("expected").asText().equals("MATCH"),
        OperationalPolicy.SHADOW.gates(s, fault, runner, complete, publishable).isEmpty(),
        name);
  }
}
