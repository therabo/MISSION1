package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.operational.OperationalBinding.*;
import static org.mission1.crew.operational.OperationalFixtures.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.stream.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mission1.crew.application.*;
import org.mission1.crew.automatic.FrozenIdentityModel;
import org.mission1.crew.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;

/** TEST_ONLY: genuine frozen facts and deliberately resealed malformed consumption cuts. */
class OperationalProductionBindingsTest {
  private static final UUID HUMAN = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID OTHER = UUID.fromString("22222222-2222-2222-2222-222222222222");
  private static final OperationalResolver PRODUCTION_RESOLVER =
      new OperationalResolver(FrozenIdentityModel.load(JSON), OperationalPolicy.PRODUCTION);

  private static OperationalProductionBindings consumer() {
    return new OperationalProductionBindings(
        mock(JdbcTemplate.class),
        JSON,
        CrewIdentityRepository.EMPTY,
        OperationalProductionBindings.Mode.S10_SCOPED_BINDING);
  }

  private record Prepared(Map<String, Object> row, CrewVerificationRepository.Evidence evidence) {}

  private static CrewVerificationRepository.Evidence evidence(Subject s, List<ExternalId> ids) {
    var people = new ArrayList<PersonReference>();
    for (int i = 0; i <= s.index(); i++)
      people.add(
          new PersonReference(
              null,
              i == s.index() ? s.name() : "Other source subject " + i,
              i == s.index() ? ids : List.of(),
              null));
    var observation =
        new CrewSourceObservation(
            CrewSource.NASA_OFFICIAL,
            URI.create(s.article()),
            s.capturedAt(),
            s.publishedAt(),
            s.effectiveAt(),
            null,
            null,
            s.documentHash(),
            s.parser(),
            s.parser());
    return new CrewVerificationRepository.Evidence(
        s.evidenceId(),
        s.documentId(),
        new CrewVerificationEvidence(
            CrewVerificationEvidence.Type.valueOf(s.type()),
            Station.ISS,
            people,
            null,
            NasaSourceType.NASA_ISS_OPERATIONAL_POST,
            observation,
            s.paragraph(),
            s.parser(),
            CrewVerificationEvidence.Completeness.PARTIAL,
            CrewVerificationEvidence.Assertion.valueOf(s.assertion())));
  }

  private static Prepared prepare(Evaluation e, List<Resource> resources) throws Exception {
    var s = e.subject();
    var cut = new TreeMap<String, Object>();
    cut.put("subject", s);
    cut.put("release", OperationalPolicy.PRODUCTION.release(JSON));
    cut.put("resourceParser", OperationalResources.VERSION);
    cut.put("cutSchema", "s10-scoped-resource-fact-digests-v1");
    cut.put("candidateSetTruncated", e.truncated());
    cut.put(
        "resources",
        resources.stream()
            .map(
                r ->
                    List.of(
                        r.ref(),
                        r.hash(),
                        OperationalBindingStore.hash(JSON.valueToTree(r).toString()),
                        r.capturedAt(),
                        r.validUntil(),
                        r.locator(),
                        r.available(CUT)))
            .toList());
    var result = Map.of("evaluation", e);
    var r = new HashMap<String, Object>();
    r.put("id", 100L);
    r.put("known_at", Timestamp.from(CUT));
    r.put("outcome", e.outcome().name());
    r.put("release_version", OperationalPolicy.PRODUCTION.version());
    r.put("serialized_policy", JSON.writeValueAsString(OperationalPolicy.PRODUCTION.release(JSON)));
    r.put("model_sha", FrozenIdentityModel.SHA);
    r.put("subject_key", s.key());
    r.put("source_version", s.version());
    r.put("exact_subject", s.key());
    r.put("exact_version", s.version());
    r.put("exact_name", s.name());
    r.put("evidence_id", s.evidenceId());
    r.put("subject_index", s.index());
    r.put("document_id", s.documentId());
    r.put("evidence_hash", s.evidenceHash());
    r.put("exact_hash", s.evidenceHash());
    r.put("document_hash", s.documentHash());
    r.put("exact_document_hash", s.documentHash());
    r.put("exact_type", s.type());
    r.put("exact_assertion", s.assertion());
    r.put("binding_key", OperationalBindingStore.hash(s.identity()));
    r.put("target_provider_key", e.candidate());
    r.put("target_person_id", e.outcome() == Outcome.AUTO_MATCH ? HUMAN : null);
    r.put("probability", e.probability());
    r.put("margin", e.margin());
    r.put("runner_probability", e.runnerProbability());
    r.put("runner_key", e.runner());
    r.put("reasons", JSON.writeValueAsString(e.reasons()));
    reseal(r, JSON.valueToTree(cut), JSON.valueToTree(result));
    return new Prepared(r, evidence(s, List.of()));
  }

  private static void reseal(Map<String, Object> row, JsonNode cut, JsonNode result)
      throws Exception {
    String c = JSON.writeValueAsString(cut), r = JSON.writeValueAsString(result);
    row.put("serialized_cut", c);
    row.put("input_cut", c);
    row.put("input_hash", OperationalBindingStore.hash(c));
    row.put("serialized_result", r);
    row.put("result", r);
    row.put("result_hash", OperationalBindingStore.hash(r));
    var candidates = result.path("evaluation").path("candidates");
    row.put("candidate_count", candidates.size());
    int proofs = 0;
    for (var candidate : candidates) proofs += candidate.path("proofs").size();
    row.put("proof_count", proofs);
    row.put("candidates_equal", true);
    row.put("proofs_equal", true);
  }

  private static Prepared accepted() throws Exception {
    return prepare(
        PRODUCTION_RESOLVER.evaluate(subject("Anil Menon"), RESOURCES, CUT, true), RESOURCES);
  }

  private static JsonNode winner(ObjectNode result) {
    String target = result.path("evaluation").path("candidate").asText();
    for (var c : result.path("evaluation").path("candidates"))
      if (c.path("key").asText().equals(target)) return c;
    throw new IllegalStateException("Missing test winner");
  }

  private static Prepared mutate(Prepared p, BiConsumer<ObjectNode, ObjectNode> mutation)
      throws Exception {
    var row = new HashMap<>(p.row());
    var cut = (ObjectNode) JSON.readTree(row.get("serialized_cut").toString());
    var result = (ObjectNode) JSON.readTree(row.get("serialized_result").toString());
    mutation.accept(cut, result);
    reseal(row, cut, result);
    return new Prepared(row, p.evidence());
  }

  private static boolean valid(Prepared p) {
    return consumer()
        .valid(p.row(), p.evidence().value(), (Integer) p.row().get("subject_index"), CUT);
  }

  static Stream<Subject> retainedSubjects() {
    return SUBJECTS.stream();
  }

  @ParameterizedTest
  @MethodSource("retainedSubjects")
  void all25RealQualifiedRowsAreConsumableWithoutNewCanonicalIdentity(Subject s) throws Exception {
    var e = PRODUCTION_RESOLVER.evaluate(s, RESOURCES, CUT, true);
    assertEquals(Outcome.AUTO_MATCH, e.outcome());
    assertTrue(valid(prepare(e, RESOURCES)), s.name());
  }

  @ParameterizedTest
  @ValueSource(strings = {"AUTO_DEFER", "CONFLICT", "SUPERSEDED"})
  void everyNonMatchHeadRejectsInsteadOfRevivingPriorMatch(String outcome) throws Exception {
    var p = withExplicitProvider(accepted(), "713");
    p.row().put("outcome", outcome);
    var bound =
        resolve(
            p,
            List.of(explicit(p, HUMAN, "EXTERNAL_ID", null)),
            providers(HUMAN, "713", "Anil Menon"),
            CrewCanonicalIdentity.EMPTY,
            true);
    assertFalse(bound.matched());
    assertEquals("S10_" + outcome, bound.state());
    assertEquals(100L, bound.revision());
    assertNull(bound.resolution());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"s10-scoped-shadow-v1", "s10-scoped-production-v0", "s10-scoped-production-v2"})
  void latestIncompatibleReleaseCannotFallBackToExplicitOrOlderMatch(String version)
      throws Exception {
    var p = withExplicitProvider(accepted(), "713");
    p.row().put("release_version", version);
    var bound =
        resolve(
            p,
            List.of(explicit(p, HUMAN, "EXTERNAL_ID", null)),
            providers(HUMAN, "713", "Anil Menon"),
            CrewCanonicalIdentity.EMPTY,
            true);
    assertFalse(bound.matched());
    assertEquals("S10_INCOMPATIBLE_OR_EXPIRED", bound.state());
  }

  private static List<Map<String, Object>> providers(UUID person, String id, String name) {
    return List.of(Map.of("person_id", person, "external_id", id, "display_name", name));
  }

  private static Map<String, Object> explicit(Prepared p, UUID person, String method, String key) {
    var row = new HashMap<String, Object>();
    row.put("id", 50L);
    row.put("evidence_id", p.evidence().id());
    row.put("subject_index", p.row().get("subject_index"));
    row.put("person_id", person);
    row.put("method", method);
    row.put("identity_key", key);
    row.put("resolved_at", Timestamp.from(CUT.minusSeconds(1)));
    return row;
  }

  private static OperationalProductionBindings.Binding resolve(
      Prepared p,
      List<Map<String, Object>> explicit,
      List<Map<String, Object>> providers,
      CrewCanonicalIdentity knowledge,
      boolean headPresent) {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    var sql = new ArrayList<String>();
    when(jdbc.queryForList(anyString(), any(Object[].class)))
        .thenAnswer(
            call -> {
              String query = call.getArgument(0);
              sql.add(query);
              if (query.contains("SELECT b.*")) return headPresent ? List.of(p.row()) : List.of();
              if (query.contains("FROM crew_identity_resolution")) return explicit;
              if (query.contains("FROM crew_person_external_id")) return providers;
              throw new AssertionError("Unexpected SQL: " + query);
            });
    var consumer =
        new OperationalProductionBindings(
            jdbc, JSON, at -> knowledge, OperationalProductionBindings.Mode.S10_SCOPED_BINDING);
    var result = consumer.resolve(List.of(p.evidence()), CUT);
    assertEquals(3, sql.size(), "set-based constant SQL count");
    assertTrue(sql.getFirst().contains("DISTINCT ON(evidence_id,subject_index)"));
    String inner =
        sql.getFirst()
            .substring(
                sql.getFirst().indexOf("FROM (SELECT DISTINCT"), sql.getFirst().indexOf(") b"));
    assertFalse(inner.contains("release_version="));
    assertFalse(inner.contains("outcome="));
    verify(jdbc, never()).update(anyString(), any(Object[].class));
    return result.get(p.evidence().id() + ":" + p.row().get("subject_index"));
  }

  private static Prepared withExplicitProvider(Prepared p, String id) {
    var original =
        JSON.convertValue(JSON.valueToTree(p.evidence().value()), CrewVerificationEvidence.class);
    var people = new ArrayList<>(original.people());
    int index = (Integer) p.row().get("subject_index");
    var person = people.get(index);
    people.set(
        index,
        new PersonReference(
            person.mission1Id(),
            person.displayName(),
            List.of(new ExternalId(CrewSource.LAUNCH_LIBRARY_2, id)),
            null));
    var value =
        new CrewVerificationEvidence(
            original.type(),
            original.station(),
            people,
            original.crewCount(),
            original.sourceType(),
            original.observation(),
            original.supportingExcerpt(),
            original.evidenceMethod(),
            original.completeness(),
            original.assertion());
    return new Prepared(
        p.row(),
        new CrewVerificationRepository.Evidence(
            p.evidence().id(), p.evidence().documentId(), value));
  }

  @Test
  void explicitV7DisagreementIsConflict() throws Exception {
    var p = withExplicitProvider(accepted(), "999");
    var providers = new ArrayList<>(providers(HUMAN, "713", "Anil Menon"));
    providers.addAll(providers(OTHER, "999", "Anil Menon"));
    var b =
        resolve(
            p,
            List.of(explicit(p, OTHER, "EXTERNAL_ID", null)),
            providers,
            CrewCanonicalIdentity.EMPTY,
            true);
    assertFalse(b.matched());
    assertEquals("S10_V7_CONFLICT", b.state());
  }

  @Test
  void missingOrWrongCanonicalProviderTargetFailsClosed() throws Exception {
    var p = accepted();
    assertFalse(resolve(p, List.of(), List.of(), CrewCanonicalIdentity.EMPTY, true).matched());
    assertFalse(
        resolve(
                p,
                List.of(),
                providers(OTHER, "713", "Anil Menon"),
                CrewCanonicalIdentity.EMPTY,
                true)
            .matched());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "EXACT_UNIQUE_NAME",
        "UNRESOLVED",
        "AMBIGUOUS",
        "EXTERNAL_ID",
        "AUTHORITATIVE_MAPPING"
      })
  void weakOrUnverifiedExplicitEvidenceDoesNotFallback(String method) throws Exception {
    var p = accepted();
    assertFalse(
        resolve(
                p,
                List.of(explicit(p, HUMAN, method, "unreviewed-raw-person-url")),
                providers(HUMAN, "713", "Anil Menon"),
                CrewCanonicalIdentity.EMPTY,
                false)
            .matched());
  }

  @Test
  void independentlyReviewedExplicitMappingRequiresCurrentKnowledgeAndExactSourceName()
      throws Exception {
    var p = accepted();
    String key = "40775";
    var knowledge =
        new CrewCanonicalIdentity(
            List.of(),
            Map.of(CrewCanonicalIdentity.Key.legacy(CrewSource.NASA_OFFICIAL, key), HUMAN));
    assertTrue(
        resolve(
                p,
                List.of(explicit(p, HUMAN, "AUTHORITATIVE_MAPPING", key)),
                providers(HUMAN, "713", "Anil Menon"),
                knowledge,
                false)
            .matched());
    assertFalse(
        resolve(
                p,
                List.of(explicit(p, HUMAN, "AUTHORITATIVE_MAPPING", key)),
                providers(HUMAN, "713", "Anna Menon"),
                knowledge,
                false)
            .matched());
  }

  @Test
  void exactExternalProviderIdCanFallbackOnlyWhenNoS10HeadExists() throws Exception {
    var p = withExplicitProvider(accepted(), "713");
    assertTrue(
        resolve(
                p,
                List.of(explicit(p, HUMAN, "EXTERNAL_ID", null)),
                providers(HUMAN, "713", "Anil Menon"),
                CrewCanonicalIdentity.EMPTY,
                false)
            .matched());
    p.row().put("outcome", "AUTO_DEFER");
    assertFalse(
        resolve(
                p,
                List.of(explicit(p, HUMAN, "EXTERNAL_ID", null)),
                providers(HUMAN, "713", "Anil Menon"),
                CrewCanonicalIdentity.EMPTY,
                true)
            .matched());
  }

  @Test
  void exactLineageColumnsRejectMismatches() throws Exception {
    var p = accepted();
    for (var column :
        List.of(
            "exact_subject",
            "exact_version",
            "exact_hash",
            "exact_document_hash",
            "exact_name",
            "exact_type",
            "exact_assertion",
            "subject_key",
            "source_version",
            "evidence_hash",
            "document_hash",
            "binding_key",
            "serialized_policy",
            "model_sha",
            "input_hash",
            "result_hash")) {
      var row = new HashMap<>(p.row());
      row.put(column, "wrong");
      assertFalse(valid(new Prepared(row, p.evidence())), column);
    }
    for (var column : List.of("evidence_id", "document_id", "candidate_count", "proof_count")) {
      var row = new HashMap<>(p.row());
      row.put(column, ((Number) row.get(column)).longValue() + 1);
      assertFalse(valid(new Prepared(row, p.evidence())), column);
    }
    for (var column : List.of("candidates_equal", "proofs_equal")) {
      var row = new HashMap<>(p.row());
      row.put(column, false);
      assertFalse(valid(new Prepared(row, p.evidence())), column);
    }
  }

  @Test
  void releaseParserCandidateAndResultPinsRejectResealedMalformedCuts() throws Exception {
    var mutations =
        List.<BiConsumer<ObjectNode, ObjectNode>>of(
            (c, r) -> c.put("resourceParser", "wrong-parser"),
            (c, r) -> c.put("cutSchema", "wrong-schema"),
            (c, r) -> c.put("candidateSetTruncated", true),
            (c, r) -> c.remove("candidateSetTruncated"),
            (c, r) -> ((ObjectNode) c.path("release")).put("proofValidity", "P365D"),
            (c, r) -> ((ObjectNode) r.path("evaluation")).put("candidate", "LL2:PERSON:999"),
            (c, r) -> ((ObjectNode) r.path("evaluation")).put("probability", .999),
            (c, r) -> ((ObjectNode) r.path("evaluation")).put("margin", .99),
            (c, r) -> ((ObjectNode) r.path("evaluation")).put("runnerProbability", .99),
            (c, r) -> ((ObjectNode) winner(r)).put("probability", .999),
            (c, r) -> ((ObjectNode) winner(r)).put("qualifiedWitness", false),
            (c, r) -> ((ObjectNode) winner(r)).put("compatibleName", false),
            (c, r) -> ((ObjectNode) winner(r)).put("temporal", false),
            (c, r) -> ((ArrayNode) winner(r).path("contradictions")).add("CONFLICT"),
            (c, r) -> ((ArrayNode) winner(r).path("proofs")).removeAll());
    int i = 0;
    for (var mutation : mutations)
      assertFalse(valid(mutate(accepted(), mutation)), "mutation " + i++);
  }

  @Test
  void requiredProofMustBeAvailableAtKnowledgeTimeWithExactLocatorHashAndCapture()
      throws Exception {
    var mutations =
        List.<BiConsumer<ObjectNode, ObjectNode>>of(
            (c, r) -> {
              for (var p : winner(r).path("proofs")) ((ObjectNode) p).put("required", false);
            },
            (c, r) -> {
              for (var resource : c.path("resources"))
                ((ArrayNode) resource).set(4, TextNode.valueOf(CUT.minusSeconds(1).toString()));
            },
            (c, r) -> {
              for (var resource : c.path("resources"))
                ((ArrayNode) resource).set(5, TextNode.valueOf("wrong-locator"));
            },
            (c, r) -> {
              for (var resource : c.path("resources"))
                ((ArrayNode) resource).set(1, TextNode.valueOf("0".repeat(64)));
            },
            (c, r) -> {
              for (var p : winner(r).path("proofs"))
                ((ObjectNode) p).put("capturedAt", CUT.plusSeconds(1).toString());
              for (var resource : c.path("resources"))
                ((ArrayNode) resource).set(3, TextNode.valueOf(CUT.plusSeconds(1).toString()));
            });
    int i = 0;
    for (var mutation : mutations)
      assertFalse(valid(mutate(accepted(), mutation)), "proof mutation " + i++);
  }

  @Test
  void weakAuthorityCannotMasqueradeAsQualifiedWitness() throws Exception {
    var p =
        mutate(
            accepted(),
            (c, r) -> {
              var proofs = (ArrayNode) winner(r).path("proofs");
              var proof = (ObjectNode) proofs.get(0);
              proof.put("authority", "FUZZY_NAME_COMPATIBILITY");
              proof.put("relation", "LEXICAL_NAME_ONLY");
              proofs.removeAll();
              proofs.add(proof);
            });
    assertFalse(valid(p), "one required fuzzy-name proof cannot authorize production identity");
  }

  @Test
  void explicitProofContradictionFailsClosed() throws Exception {
    assertFalse(
        valid(
            mutate(
                accepted(),
                (c, r) ->
                    ((ObjectNode) winner(r).path("proofs").get(0))
                        .put("contradiction", "WRONG_PERSON"))));
  }

  @Test
  void marginCannotDisagreeWithActualRunnerProbability() throws Exception {
    var p =
        mutate(
            accepted(),
            (c, r) -> ((ObjectNode) r.path("evaluation")).put("runnerProbability", .99));
    p.row().put("runner_probability", .99);
    assertFalse(valid(p), "stored margin cannot conceal nearly tied runner");
  }

  @ParameterizedTest
  @ValueSource(strings = {"PLANNED", "PERSON_IN_FUTURE"})
  void plannedOrUnsupportedSourceAssertionCannotConsume(String scenario) throws Exception {
    var original = subject("Anil Menon");
    var s =
        changed(
            original,
            original.name(),
            scenario.equals("PLANNED") ? original.type() : "EXPEDITION_MEMBERSHIP",
            scenario.equals("PLANNED") ? "PLANNED" : "OBSERVED",
            original.effectiveAt(),
            true,
            original.anchors());
    var e = PRODUCTION_RESOLVER.evaluate(original, RESOURCES, CUT, true);
    var forged =
        new Evaluation(
            s,
            Outcome.AUTO_MATCH,
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
    assertFalse(valid(prepare(forged, RESOURCES)), scenario);
  }

  @Test
  void sourceKeyAndEffectiveColumnMustMatchRetainedSubject() throws Exception {
    assertFalse(
        valid(
            mutate(
                accepted(),
                (c, r) -> {
                  ((ObjectNode) c.path("subject")).put("key", "another-source-subject");
                  ((ObjectNode) r.path("evaluation").path("subject"))
                      .put("key", "another-source-subject");
                })));
  }

  private static Prepared atScore(Subject s, double score) throws Exception {
    var p = prepare(PRODUCTION_RESOLVER.evaluate(s, RESOURCES, CUT, true), RESOURCES);
    p =
        mutate(
            p,
            (c, r) -> {
              var evaluation = (ObjectNode) r.path("evaluation");
              var candidate = ((ObjectNode) winner(r)).deepCopy();
              candidate.put("probability", score);
              evaluation.set("candidates", JSON.createArrayNode().add(candidate));
              evaluation.put("probability", score);
              evaluation.put("margin", score);
              evaluation.put("runnerProbability", 0);
              evaluation.putNull("runner");
            });
    p.row().put("probability", score);
    p.row().put("margin", score);
    p.row().put("runner_probability", 0d);
    p.row().put("runner_key", null);
    return p;
  }

  @Test
  void observationAndDepartureExactEpsilonThresholdsAreEnforcedByConsumer() throws Exception {
    var observation = subject("Anil Menon");
    var departure =
        SUBJECTS.stream()
            .filter(s -> s.name().equals("Andrey Fedyaev") && s.departure())
            .findFirst()
            .orElseThrow();
    for (double score : new double[] {Math.nextDown(.991), .991, .995, Math.nextDown(.999), .999}) {
      assertEquals(score >= .991, valid(atScore(observation, score)), "observation " + score);
      assertEquals(score >= .999, valid(atScore(departure, score)), "departure " + score);
    }
    for (double score :
        new double[] {Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
      assertFalse(valid(atScore(observation, score)), "nonfinite " + score);
  }

  @Test
  void actualRunnerMarginUsesStrictFloatingPointBoundary() throws Exception {
    for (double runner : new double[] {Math.nextDown(.8), .8, Math.nextUp(.8)}) {
      var p = atScore(subject("Anil Menon"), 1d);
      double margin = 1d - runner;
      p =
          mutate(
              p,
              (c, r) -> {
                var e = (ObjectNode) r.path("evaluation");
                var candidates = (ArrayNode) e.path("candidates");
                var other = ((ObjectNode) candidates.get(0)).deepCopy();
                other.put("key", "LL2:PERSON:TEST_RUNNER");
                other.put("probability", runner);
                candidates.add(other);
                e.put("runner", "LL2:PERSON:TEST_RUNNER");
                e.put("runnerProbability", runner);
                e.put("margin", margin);
              });
      p.row().put("runner_key", "LL2:PERSON:TEST_RUNNER");
      p.row().put("runner_probability", runner);
      p.row().put("margin", margin);
      assertEquals(margin >= .20, valid(p), "runner " + runner + " computed margin " + margin);
    }
  }

  @Test
  void proofFlightIntervalMustContainEffectiveSourceEvent() throws Exception {
    Instant event = subject("Anil Menon").effectiveAt();
    for (String field : List.of("effectiveFrom", "effectiveUntil")) {
      var p =
          mutate(
              accepted(),
              (c, r) -> {
                for (var proof : winner(r).path("proofs"))
                  if (proof.path("authority").asText().equals("OFFICIAL_PERSON_FLIGHT_RELATION"))
                    ((ObjectNode) proof)
                        .put(
                            field,
                            field.equals("effectiveFrom")
                                ? event.plusSeconds(1).toString()
                                : event.minusSeconds(1).toString());
              });
      assertFalse(valid(p), field);
    }
  }

  @Test
  void everyMandatoryAuthorityFamilyRemainsRequired() throws Exception {
    for (String authority :
        List.of(
            "PROVIDER_STABLE_ID",
            "OFFICIAL_PERSON_FLIGHT_RELATION",
            "VERIFIED_OFFICIAL_PERSON_RESOURCE")) {
      var p =
          mutate(
              accepted(),
              (c, r) -> {
                for (var proof : winner(r).path("proofs"))
                  if (proof.path("authority").asText().equals(authority))
                    ((ObjectNode) proof).put("required", false);
              });
      assertFalse(valid(p), authority);
    }
    var departure =
        SUBJECTS.stream()
            .filter(s -> s.name().equals("Andrey Fedyaev") && s.departure())
            .findFirst()
            .orElseThrow();
    var p = prepare(PRODUCTION_RESOLVER.evaluate(departure, RESOURCES, CUT, true), RESOURCES);
    assertFalse(
        valid(
            mutate(
                p,
                (c, r) -> {
                  for (var proof : winner(r).path("proofs"))
                    if (proof.path("authority").asText().equals("OFFICIAL_NAMED_MISSION_ROSTER"))
                      ((ObjectNode) proof).put("required", false);
                })),
        "completed departure requires named mission roster proof");
  }

  @Test
  void all256WrongHumanControlsProduceNoConsumableBinding() throws Exception {
    int count = 0;
    for (var row : CORPUS.path("parity")) {
      if (CORPUS.path("goldEvaluationOnly").path(row.path("sourceName").asText()).asInt()
          == Integer.parseInt(row.path("candidate").asText().split(":")[1])) continue;
      var s =
          SUBJECTS.stream()
              .filter(x -> x.key().equals(row.path("sourceSubjectId").asText()))
              .findFirst()
              .orElseThrow();
      var c =
          PRODUCTION_RESOLVER.compare(
              s,
              provider(row.path("candidate").asText().replace("ll2:", "LL2:PERSON:")),
              RESOURCES,
              CUT,
              List.of("WRONG_REAL_HUMAN"));
      assertNotConsumable(s, c, true, true, 0);
      count++;
    }
    for (var row : CORPUS.path("hardNegatives"))
      if (row.path("caseId").asText().startsWith("real-control:")) {
        var base = subject("Anil Menon");
        var s =
            changed(
                base,
                row.path("subject").asText(),
                "PERSON_CURRENTLY_ABOARD",
                "OBSERVED",
                CUT.minusSeconds(100),
                true,
                List.of());
        var wrong =
            RESOURCES.stream()
                .filter(
                    r ->
                        r.kind() == Kind.PROVIDER_PERSON
                            && r.name().equals(row.path("wrongCandidate").asText()))
                .findFirst();
        Resource p;
        if (wrong.isPresent()) p = wrong.get();
        else {
          var n =
              StreamSupport.stream(CORPUS.path("controlPeople").spliterator(), false)
                  .filter(x -> x.path("name").asText().equals(row.path("wrongCandidate").asText()))
                  .findFirst()
                  .orElseThrow();
          p =
              changed(
                  provider("LL2:PERSON:713"),
                  Kind.PROVIDER_PERSON,
                  n.path("name").asText(),
                  "NASA",
                  n.path("dob").asText(null),
                  List.of(),
                  List.of(),
                  CUT.plusSeconds(100));
        }
        assertNotConsumable(
            s,
            PRODUCTION_RESOLVER.compare(s, p, RESOURCES, CUT, List.of("REAL_FAMILY_CONTROL")),
            true,
            true,
            0);
        count++;
      }
    assertEquals(256, count);
  }

  private static void assertNotConsumable(
      Subject s, Candidate c, boolean complete, boolean target, double runner) throws Exception {
    var gates = OperationalPolicy.PRODUCTION.gates(s, c, runner, complete, target);
    assertFalse(gates.isEmpty());
    var e =
        new Evaluation(
            s,
            Outcome.AUTO_DEFER,
            null,
            c.probability(),
            null,
            runner,
            c.probability() - runner,
            !complete,
            gates,
            List.of(c),
            CUT,
            0,
            0);
    assertFalse(valid(prepare(e, RESOURCES)), s.name() + "/" + c.name());
    // Even a wrongly tagged MATCH cannot overcome the retained candidate's own risk gates.
    var forged =
        new Evaluation(
            s,
            Outcome.AUTO_MATCH,
            c.key(),
            c.probability(),
            null,
            runner,
            c.probability() - runner,
            !complete,
            List.of(),
            List.of(c),
            CUT,
            0,
            0);
    var p = prepare(forged, RESOURCES);
    if (target) assertFalse(valid(p), "mis-tagged " + s.name() + "/" + c.name());
    else
      assertFalse(
          resolve(p, List.of(), List.of(), CrewCanonicalIdentity.EMPTY, true).matched(),
          "unpublishable target");
  }

  @Test
  void all25ConstructedGateFaultsKeepProductionAcceptanceSemantics() throws Exception {
    int count = 0, positives = 0;
    for (var row : CORPUS.path("hardNegatives"))
      if (row.path("kind").asText().equals("CONSTRUCTED_GATE_FAULT")) {
        String name = row.path("caseId").asText().substring("constructed:".length());
        var s = subject("Anil Menon");
        var base = PRODUCTION_RESOLVER.evaluate(s, RESOURCES, CUT, true).candidates().getFirst();
        boolean witness = true, temporal = true, publishable = true;
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
          case "unknown-homonym-unobservable-distinction",
              "one-of-two-equal-qualified-candidates" ->
              runner = base.probability();
          case "cached-official-source-outage" -> {
            assertTrue(valid(accepted()), name);
            positives++;
            count++;
            continue;
          }
          case "missing-profile-with-official-person-roster" -> {
            var rosterOnly =
                RESOURCES.stream()
                    .filter(r -> r.kind() == Kind.PROVIDER_PERSON || r.kind() == Kind.NASA_MISSION)
                    .toList();
            var e = PRODUCTION_RESOLVER.evaluate(subject("Jessica Watkins"), rosterOnly, CUT, true);
            assertEquals(Outcome.AUTO_MATCH, e.outcome());
            assertTrue(valid(prepare(e, rosterOnly)), name);
            positives++;
            count++;
            continue;
          }
          default -> fail("Unported fault: " + name);
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
        assertNotConsumable(s, fault, true, publishable, runner);
        count++;
      }
    assertEquals(25, count);
    assertEquals(2, positives);
  }

  @Test
  void all16ResourceLinkFaultsCannotCreateConsumableCanonicalBinding() throws Exception {
    int count = 0;
    for (var row : CORPUS.path("resourceLinkFaults")) {
      var input = row.path("input");
      var original = subject("Anil Menon");
      String role = input.path("anchorDOMRole").asText(), url = input.path("requestedURL").asText();
      String html = "<p><a href=\"" + url + "\">" + input.path("anchorText").asText() + "</a></p>";
      if (!role.equals("asserted-subject")) {
        String tag = role.equals("author") ? "cite" : "figcaption";
        html = "<" + tag + ">" + html + "</" + tag + ">";
      }
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
      var resources = input.path("status").asInt() == 200 ? List.of(resource) : List.<Resource>of();
      var link = PRODUCTION_RESOLVER.personalLinks(s, resources, CUT);
      boolean qualified =
          !link.people().isEmpty()
              && input.path("temporal").asBoolean()
              && !input.path("preciseDOBConflict").asBoolean();
      assertEquals(
          row.path("expectedLinkAccepted").asBoolean(), qualified, row.path("case").asText());
      var e = PRODUCTION_RESOLVER.evaluate(s, resources, CUT, true);
      assertEquals(Outcome.AUTO_DEFER, e.outcome());
      assertFalse(valid(prepare(e, resources)), row.path("case").asText());
      count++;
    }
    assertEquals(16, count);
  }
}
