package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.operational.OperationalBinding.*;
import static org.mission1.crew.operational.OperationalFixtures.*;

import java.time.*;
import java.util.*;
import java.util.stream.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class OperationalResolverTest {
  static Stream<Subject> real() {
    return SUBJECTS.stream();
  }

  @ParameterizedTest
  @MethodSource("real")
  void retainedRealSubjectHasQualifiedPath(Subject s) {
    var e = RESOLVER.evaluate(s, RESOURCES, CUT, true);
    assertEquals(Outcome.AUTO_MATCH, e.outcome(), s.name() + ":" + e.reasons());
    assertEquals(
        "LL2:PERSON:" + CORPUS.path("goldEvaluationOnly").path(s.name()).asInt(), e.candidate());
    assertTrue(e.candidates().getFirst().qualifiedWitness());
    assertTrue(e.margin() >= .20);
    if (s.departure()) assertTrue(e.probability() >= .999);
  }

  @Test
  void frozen275VectorsScoresAndWitnessGatesAreReproduced() {
    double max = 0;
    int count = 0;
    for (var row : CORPUS.path("parity")) {
      var s =
          SUBJECTS.stream()
              .filter(x -> x.key().equals(row.path("sourceSubjectId").asText()))
              .findFirst()
              .orElseThrow();
      var p = provider(row.path("candidate").asText().replace("ll2:", "LL2:PERSON:"));
      var c = RESOLVER.compare(s, p, RESOURCES, CUT, List.of("FROZEN_RESEARCH_PAIR"));
      assertArrayEquals(
          JSON.convertValue(row.path("rawFeatures"), double[].class),
          c.rawFeatures(),
          1e-12,
          "raw " + s.name() + "/" + p.name());
      assertArrayEquals(
          JSON.convertValue(row.path("features"), double[].class),
          c.features(),
          1e-12,
          s.name() + "/" + p.name());
      max = Math.max(max, Math.abs(row.path("probability").asDouble() - c.probability()));
      assertEquals(
          row.path("qualifiedWitness").asBoolean(),
          c.qualifiedWitness(),
          s.name() + "/" + p.name());
      count++;
    }
    assertEquals(275, count);
    assertTrue(max <= 1e-12, "score max delta " + max);
    System.out.println("S10_RESEARCH_275_SCORE_MAX_DELTA=" + max);
  }

  @Test
  void all256KnownWrongHumansFailAcceptance() {
    int comparisons = 0;
    for (var row : CORPUS.path("parity")) {
      if (CORPUS.path("goldEvaluationOnly").path(row.path("sourceName").asText()).asInt()
          == Integer.parseInt(row.path("candidate").asText().split(":")[1])) continue;
      var s =
          SUBJECTS.stream()
              .filter(x -> x.key().equals(row.path("sourceSubjectId").asText()))
              .findFirst()
              .orElseThrow();
      var c =
          RESOLVER.compare(
              s,
              provider(row.path("candidate").asText().replace("ll2:", "LL2:PERSON:")),
              RESOURCES,
              CUT,
              List.of("WRONG_REAL_HUMAN"));
      assertFalse(OperationalPolicy.SHADOW.gates(s, c, 0, true, true).isEmpty());
      comparisons++;
    }
    for (var row : CORPUS.path("hardNegatives"))
      if (row.path("caseId").asText().startsWith("real-control:")) {
        var wrong =
            RESOURCES.stream()
                .filter(
                    r ->
                        r.kind() == Kind.PROVIDER_PERSON
                            && r.name().equals(row.path("wrongCandidate").asText()))
                .findFirst();
        var s =
            changed(
                subject("Anil Menon"),
                row.path("subject").asText(),
                "PERSON_CURRENTLY_ABOARD",
                "OBSERVED",
                CUT.minusSeconds(100),
                true,
                List.of());
        if (wrong.isPresent())
          assertFalse(
              OperationalPolicy.SHADOW
                  .gates(
                      s,
                      RESOLVER.compare(s, wrong.get(), RESOURCES, CUT, List.of("REAL_CONTROL")),
                      0,
                      true,
                      true)
                  .isEmpty());
        else {
          var n =
              StreamSupport.stream(CORPUS.path("controlPeople").spliterator(), false)
                  .filter(x -> x.path("name").asText().equals(row.path("wrongCandidate").asText()))
                  .findFirst()
                  .orElseThrow();
          var p = provider("LL2:PERSON:713");
          var c =
              changed(
                  p,
                  Kind.PROVIDER_PERSON,
                  n.path("name").asText(),
                  "NASA",
                  n.path("dob").asText(null),
                  List.of(),
                  List.of(),
                  CUT.plusSeconds(100));
          assertFalse(
              OperationalPolicy.SHADOW
                  .gates(
                      s,
                      RESOLVER.compare(s, c, RESOURCES, CUT, List.of("REAL_FAMILY_CONTROL")),
                      0,
                      true,
                      true)
                  .isEmpty());
        }
        comparisons++;
      }
    assertEquals(256, comparisons);
  }

  @Test
  void exactThresholdAndEpsilonRiskBoundaries() {
    var s = subject("Anil Menon");
    var c = RESOLVER.evaluate(s, RESOURCES, CUT, true).candidates().getFirst();
    for (double score : new double[] {Math.nextDown(.991), .991, .995, Math.nextDown(.999), .999}) {
      var atScore =
          new Candidate(
              c.key(),
              c.name(),
              c.blocks(),
              c.rawFeatures(),
              c.features(),
              score,
              true,
              true,
              true,
              false,
              Map.of("namedMissionFlight", true),
              List.of(),
              List.of(),
              c.proofs(),
              0,
              0);
      assertEquals(
          score >= .991, OperationalPolicy.SHADOW.gates(s, atScore, 0, true, true).isEmpty());
      var dep =
          changed(
              s,
              s.name(),
              "PERSON_DEPARTED_STATION",
              "COMPLETED",
              s.effectiveAt(),
              true,
              s.anchors());
      assertEquals(
          score >= .999, OperationalPolicy.SHADOW.gates(dep, atScore, 0, true, true).isEmpty());
    }
    assertTrue(
        OperationalPolicy.SHADOW
            .gates(s, c, c.probability() - .19, true, true)
            .contains("INSUFFICIENT_MARGIN"));
    assertTrue(
        OperationalPolicy.SHADOW.gates(s, c, 0, false, true).contains("CANDIDATE_SET_INCOMPLETE"));
    assertTrue(
        OperationalPolicy.SHADOW.gates(s, c, 0, true, false).contains("NO_PUBLISHABLE_V7_TARGET"));
  }

  @Test
  void highScoreWithoutWitnessCannotMatch() {
    var s = subject("Anil Menon");
    var provider = provider("LL2:PERSON:713");
    var e = RESOLVER.evaluate(s, List.of(provider), CUT, true);
    assertTrue(e.probability() > .991);
    assertEquals(Outcome.AUTO_DEFER, e.outcome());
    assertTrue(e.reasons().contains("MISSING_QUALIFIED_WITNESS"));
  }

  @Test
  void sourceDependenceAndDuplicateCopiesDoNotIncreaseProbability() {
    var s = subject("Anil Menon");
    var copies = new ArrayList<>(RESOURCES);
    for (int i = 0; i < 10; i++) copies.addAll(RESOURCES);
    var a = RESOLVER.compare(s, provider("LL2:PERSON:713"), RESOURCES, CUT, List.of());
    var b = RESOLVER.compare(s, provider("LL2:PERSON:713"), copies, CUT, List.of());
    assertEquals(a.probability(), b.probability());
    assertEquals(a.proofs(), b.proofs());
  }

  @Test
  void wrongNASAResourceRejectedAtRawAndTypedStages() {
    var s = subject("Sophie Adenot");
    var target =
        RESOURCES.stream()
            .filter(r -> r.kind() == Kind.NASA_PEOPLE && r.name().contains("Hathaway"))
            .findFirst()
            .orElseThrow();
    var wrong =
        changed(
            s,
            s.name(),
            s.type(),
            s.assertion(),
            s.effectiveAt(),
            true,
            List.of(
                new Anchor(
                    s.name(),
                    target.links().getFirst(),
                    target.links().getFirst(),
                    "source/Sophie-anchor")));
    var result = RESOLVER.personalLinks(wrong, RESOURCES, CUT);
    assertTrue(result.people().isEmpty());
    assertTrue(result.rejected().contains("TARGET_NAME_MISMATCH"));
    var raw =
        changed(
            s,
            s.name(),
            s.type(),
            s.assertion(),
            s.effectiveAt(),
            true,
            List.of(new Anchor("Jack Hathaway", target.url(), target.url(), "wrong-span")));
    assertTrue(
        RESOLVER
            .personalLinks(raw, RESOURCES, CUT)
            .rejected()
            .contains("RAW_PERSONAL_URL_SCOPE_MISMATCH"));
  }

  @Test
  void missingOutageExpiredAndFutureFlightsFailClosed() {
    var s = subject("Anil Menon");
    var p = provider("LL2:PERSON:713");
    for (var scenario :
        List.of(
            List.<Resource>of(),
            List.of(p),
            List.of(
                changed(
                    p,
                    p.kind(),
                    p.name(),
                    p.agency(),
                    p.dob(),
                    List.of(),
                    p.links(),
                    p.validUntil()))))
      assertNotEquals(Outcome.AUTO_MATCH, RESOLVER.evaluate(s, scenario, CUT, true).outcome());
    var expired =
        RESOURCES.stream()
            .map(
                r ->
                    changed(
                        r,
                        r.kind(),
                        r.name(),
                        r.agency(),
                        r.dob(),
                        r.flights(),
                        r.links(),
                        CUT.minusSeconds(1)))
            .toList();
    assertNotEquals(Outcome.AUTO_MATCH, RESOLVER.evaluate(s, expired, CUT, true).outcome());
    var future =
        changed(
            s,
            s.name(),
            s.type(),
            s.assertion(),
            Instant.parse("2010-01-01T00:00:00Z"),
            true,
            s.anchors());
    assertNotEquals(Outcome.AUTO_MATCH, RESOLVER.evaluate(future, RESOURCES, CUT, true).outcome());
    // A failed attempt does not erase still-valid last-good facts or manufacture a contradiction.
    assertEquals(Outcome.AUTO_MATCH, RESOLVER.evaluate(s, RESOURCES, CUT, true).outcome());
  }

  @Test
  void namedRosterCannotForceAResidualPairOrCollapseDistinctSubjects() {
    var e = RESOLVER.evaluate(subject("Jessica Watkins"), RESOURCES, CUT, true);
    var s = e.subject();
    var other =
        new Subject(
            "synthetic-distinct-subject",
            s.version(),
            s.evidenceId(),
            1,
            s.documentId(),
            s.evidenceHash(),
            s.documentHash(),
            s.article(),
            s.title(),
            s.name(),
            s.paragraph(),
            s.inlineHtml(),
            s.type(),
            s.assertion(),
            s.effectiveAt(),
            s.publishedAt(),
            s.capturedAt(),
            s.parser(),
            s.agency(),
            s.role(),
            s.missions(),
            s.anchors(),
            true);
    var duplicate =
        new Evaluation(
            other,
            e.outcome(),
            e.candidate(),
            e.probability(),
            e.runner(),
            e.runnerProbability(),
            e.margin(),
            false,
            List.of(),
            e.candidates(),
            CUT,
            0,
            0);
    assertTrue(
        OperationalResolver.consistent(List.of(e, duplicate)).stream()
            .allMatch(x -> x.outcome() == Outcome.CONFLICT));
    var unknown =
        changed(s, "Unknown Visitor", s.type(), s.assertion(), s.effectiveAt(), true, List.of());
    assertEquals(Outcome.AUTO_DEFER, RESOLVER.evaluate(unknown, RESOURCES, CUT, true).outcome());
  }

  @Test
  void normalizationIsGenericDeterministicAndLocaleIndependent() {
    Locale prior = Locale.getDefault();
    try {
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      assertEquals("sophie adenot", OperationalNames.normalize("SOPHIE\u00a0ADENOT"));
      assertEquals(
          "andrej valer'evic fedaev",
          OperationalNames.transliterations("Андрей Валерьевич Федяев").getFirst());
      assertEquals(
          OperationalNames.transliterations("Дубров Петр Валерьевич"),
          OperationalNames.transliterations("Дубров Петр Валерьевич"));
      assertTrue(OperationalNames.compatible("Jessica Meir", "Jessica U. Meir", false));
      var e = RESOLVER.evaluate(subject("Josh Kutryk"), RESOURCES, CUT, true);
      assertTrue(e.candidates().getFirst().scopedVariant());
      assertFalse(provider("LL2:PERSON:642").aliases().contains("Josh Kutryk"));
    } finally {
      Locale.setDefault(prior);
    }
  }
}
