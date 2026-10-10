package org.mission1.crew.automatic;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.automatic.IdentityEvidence.*;
import static org.mission1.crew.automatic.IdentityTestFixtures.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class IdentityPolicyTest {
  final FrozenIdentityModel model = FrozenIdentityModel.load(JSON);
  final IdentityPolicy policy = new IdentityPolicy();
  final IdentityEvidence ll =
      person(
          "LL2:PERSON:1",
          Provider.LL2,
          "Test Person",
          "Crew-13",
          Set.of(Witness.PERSON_SCOPED_HISTORY),
          List.of());
  final IdentityEvidence nasa =
      person(
          "NASA:EDITORIAL_SLOT:1",
          Provider.NASA,
          "Test Person",
          "Crew-13",
          Set.of(Witness.PERSONAL_FLIGHT_CAPTION, Witness.VALIDATED_BIOGRAPHY),
          List.of());

  double[] good() {
    return new double[] {1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0};
  }

  @ParameterizedTest
  @CsvSource({
    "0.9909999999,0,AUTO_DEFER",
    "0.991,0,AUTO_MATCH",
    "0.9910000001,0,AUTO_MATCH",
    "1,0.8000000001,AUTO_DEFER",
    "1,0.8,AUTO_MATCH",
    "1,0.7999999999,AUTO_MATCH"
  })
  void thresholdAndIeeeMarginBoundaries(double p, double runner, IdentityPolicy.Outcome expected) {
    assertEquals(expected, policy.decide(ll, nasa, good(), p, runner, List.of()).outcome());
  }

  @Test
  void exactNameAndRoleOnlyAreInsufficientDespiteHighProbability() {
    var z = good();
    z[10] = 0;
    var p = model.score(z).probability();
    assertTrue(p > .991);
    assertEquals(
        IdentityPolicy.Outcome.AUTO_DEFER, policy.decide(ll, nasa, z, p, 0, List.of()).outcome());
  }

  @Test
  void genericRoleLexicalSimilarityNeverQualifies() {
    var r = changed(nasa, "Flight Engineer Expedition 75", Set.of(), List.of());
    var z = good();
    z[10] = 0;
    z[11] = .8;
    assertEquals(
        IdentityPolicy.Outcome.AUTO_DEFER, policy.decide(ll, r, z, 1, 0, List.of()).outcome());
  }

  @Test
  void wrongAndUnrelatedPortraitCannotQualify() {
    var r = changed(nasa, "Crew-13", Set.of(), List.of("REJECTED_PERSON_LINK"));
    assertEquals(
        IdentityPolicy.Outcome.AUTO_DEFER, policy.decide(ll, r, good(), 1, 0, List.of()).outcome());
  }

  @Test
  void lowProbabilityAloneDefers() {
    assertEquals(
        IdentityPolicy.Outcome.AUTO_DEFER,
        policy.decide(ll, nasa, new double[13], .0001, 0, List.of()).outcome());
  }

  @Test
  void qualifiedDifferentHumanEvidenceSeparates() {
    assertEquals(
        IdentityPolicy.Outcome.AUTO_SEPARATE,
        policy.decide(ll, nasa, good(), 1, 0, List.of("HARD:KNOWN_DIFFERENT_HUMANS")).outcome());
  }

  @Test
  void secondaryDobConflictIsNotHardSeparation() {
    var z = good();
    z[8] = 1;
    assertEquals(
        IdentityPolicy.Outcome.AUTO_MATCH, policy.decide(ll, nasa, z, 1, 0, List.of()).outcome());
  }

  @Test
  void runnerTieDefers() {
    assertEquals(
        IdentityPolicy.Outcome.AUTO_DEFER,
        policy.decide(ll, nasa, good(), 1, 1, List.of()).outcome());
  }

  static java.util.stream.Stream<JsonNode> negatives() {
    return java.util.stream.StreamSupport.stream(
        file("hard-negatives-real.json").spliterator(), false);
  }

  @ParameterizedTest
  @MethodSource("negatives")
  void researchHardNegativesNeverMatch(JsonNode row) {
    var z = vector(row.path("features"));
    var p = model.score(z).probability();
    assertEquals(row.path("probability").asDouble(), p, 2e-14);
    assertNotEquals(
        IdentityPolicy.Outcome.AUTO_MATCH, policy.decide(ll, nasa, z, p, 0, List.of()).outcome());
  }

  static java.util.stream.Stream<JsonNode> synthetic() {
    return java.util.stream.StreamSupport.stream(
        file("hard-negatives-synthetic.json").spliterator(), false);
  }

  @ParameterizedTest
  @MethodSource("synthetic")
  void syntheticAdversarialResearchBehavior(JsonNode row) {
    var z = vector(row.path("features"));
    var p = model.score(z).probability();
    assertEquals(row.path("p").asDouble(), p, 2e-14);
    var conflict =
        row.path("hardConflict").asBoolean()
            ? List.of("HARD:FIXTURE_CONTRADICTION")
            : List.<String>of();
    var result = policy.decide(ll, nasa, z, p, row.path("runnerUp").asDouble(), conflict);
    assertEquals(
        row.path("strategies").path("recommendedHybridWithClusterGuards").asBoolean(),
        result.outcome() == IdentityPolicy.Outcome.AUTO_MATCH);
  }

  @Test
  void fedyaevFrozenSparseAndQualifiedVectors() {
    var rows = file("fedyaev-evidence-ablation.json");
    for (String name : List.of("nameOnly", "NASAOfficialTwoMissionAndSelection")) {
      var r = rows.path(name);
      var z = vector(r.path("features"));
      var p = model.score(z).probability();
      assertEquals(r.path("p").asDouble(), p, 2e-14);
      assertEquals(
          r.path("decision").asText(),
          policy.decide(ll, nasa, z, p, 0, List.of()).outcome().name());
    }
  }

  @Test
  void qualifiedCrew12FedyaevReferencePassesFullPairPolicy() {
    var row = file("fedyaev-scoped-model-case.json");
    var z = vector(row.path("features"));
    var p = model.score(z).probability();
    assertEquals(row.path("p").asDouble(), p, 2e-14);
    assertEquals(
        IdentityPolicy.Outcome.AUTO_MATCH,
        policy.decide(ll, nasa, z, p, row.path("runnerUpP").asDouble(), List.of()).outcome());
  }

  @Test
  void transliterationRetrievesFedyaevWithoutPersonManifest() {
    var a = person("LL2:PERSON:732", Provider.LL2, "Andrei Fedyaev", "", Set.of(), List.of());
    var b =
        person(
            "NASA:OPERATIONAL_SUBJECT:1", Provider.NASA, "Andrey Fedyaev", "", Set.of(), List.of());
    assertEquals(List.of(a), new IdentityCandidates(List.of(a)).retrieve(b).candidates());
  }

  @Test
  void candidateTruncationIsExplicit() {
    var records = new ArrayList<IdentityEvidence>();
    for (int i = 0; i < 100; i++)
      records.add(person("LL2:PERSON:" + i, Provider.LL2, "Test Person", "", Set.of(), List.of()));
    var block = new IdentityCandidates(records).retrieve(nasa);
    assertEquals(32, block.candidates().size());
    assertTrue(block.truncated());
  }

  @Test
  void componentRejectsTransitiveLl2Collision() {
    var second = person("LL2:PERSON:2", Provider.LL2, "Test Person", "", Set.of(), List.of());
    var n2 = person("NASA:EDITORIAL_SLOT:2", Provider.NASA, "Test Person", "", Set.of(), List.of());
    var evidence = Map.of(ll.key(), ll, second.key(), second, nasa.key(), nasa, n2.key(), n2);
    var edges =
        List.of(
            new ShadowIdentityGraph.Edge(
                nasa.key(), ll.key(), IdentityPolicy.Outcome.AUTO_MATCH, 1),
            new ShadowIdentityGraph.Edge(
                n2.key(), second.key(), IdentityPolicy.Outcome.AUTO_MATCH, 2),
            new ShadowIdentityGraph.Edge(
                n2.key(), nasa.key(), IdentityPolicy.Outcome.AUTO_MATCH, 3));
    assertFalse(ShadowIdentityGraph.validate(nasa.key(), ll.key(), evidence, edges).isEmpty());
  }
}
