package org.mission1.crew.automatic;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.automatic.IdentityEvidence.*;
import static org.mission1.crew.automatic.IdentityTestFixtures.*;

import com.fasterxml.jackson.databind.*;
import java.io.*;
import java.util.*;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mission1.source.crew.CrewHttpReader;

class FrozenIdentityModelTest {
  static final FrozenIdentityModel MODEL = FrozenIdentityModel.load(JSON);

  @Test
  void allFrozenV1AndEnrichedVectorsMatchRawAndCalibratedPythonProbabilities() throws Exception {
    int count = 0;
    double maximum = 0;
    for (String file : List.of("pair-features.jsonl.gz", "enriched-pair-features.jsonl.gz"))
      try (var in =
          new BufferedReader(
              new InputStreamReader(
                  new GZIPInputStream(
                      getClass().getResourceAsStream("/crew/automatic/" + file))))) {
        for (String line; (line = in.readLine()) != null; ) {
          var row = JSON.readTree(line);
          var score = MODEL.score(vector(row.path("features")));
          double expected =
              row.has("p") ? row.path("p").asDouble() : row.path("calibratedLogistic").asDouble();
          assertEquals(expected, score.probability(), 2e-14, row.path("pairId").asText());
          maximum = Math.max(maximum, Math.abs(expected - score.probability()));
          if (row.has("rawLogistic"))
            assertEquals(row.path("rawLogistic").asDouble(), score.rawProbability(), 2e-14);
          count++;
        }
      }
    assertEquals(14382, count);
    System.out.println("AUTO_MODEL_PARITY vectors=" + count + " maxProbabilityDelta=" + maximum);
  }

  static java.util.stream.Stream<JsonNode> sources() {
    return java.util.stream.StreamSupport.stream(
        file("source-feature-reference.json.gz").path("pairs").spliterator(), false);
  }

  @ParameterizedTest
  @MethodSource("sources")
  void sourceFeatureExtractionMatchesResearch(JsonNode pair) {
    var records = file("source-feature-reference.json.gz").path("records");
    var a = source(records.path(pair.path("left").asText()));
    var b = source(records.path(pair.path("right").asText()));
    double[] expected = vector(pair.path("features")),
        actual = new IdentityFeatures(MODEL).extract(a, b);
    assertArrayEquals(expected, actual, 2e-12, pair.path("pairId").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"sha", "schema", "count", "calibration", "nan", "vocabulary"})
  void invalidArtifactFailsClosed(String fault) throws Exception {
    byte[] m = artifact("model-v1.json"), l = artifact("lexical-v1.json");
    var n = (com.fasterxml.jackson.databind.node.ObjectNode) JSON.readTree(m);
    switch (fault) {
      case "schema" -> n.put("modelVersion", "unsupported");
      case "count" -> n.putArray("logisticCoefficient").add(1);
      case "calibration" ->
          ((com.fasterxml.jackson.databind.node.ObjectNode) n.path("sigmoidValidationCalibration"))
              .put("coefficient", -1);
      case "nan" -> n.put("intercept", "NaN");
      case "vocabulary" -> l = "{}".getBytes();
      default -> {}
    }
    m = JSON.writeValueAsBytes(n);
    byte[] mm = m, ll = l;
    assertThrows(
        RuntimeException.class,
        () ->
            new FrozenIdentityModel(
                JSON,
                mm,
                fault.equals("sha") ? "bad" : CrewHttpReader.sha256(mm),
                ll,
                CrewHttpReader.sha256(ll)));
  }

  @ParameterizedTest
  @ValueSource(doubles = {Double.NaN, Double.POSITIVE_INFINITY, -.01, 1.01})
  void invalidFeaturesFailClosed(double v) {
    double[] z = new double[13];
    z[1] = v;
    assertThrows(IllegalArgumentException.class, () -> MODEL.score(z));
  }

  @Test
  void frozenVectorLinearSigmoidAndCalibrationMatchPythonArithmetic() {
    for (var row : file("linear-score-reference.json")) {
      var score = MODEL.score(vector(row.path("features")));
      assertEquals(row.path("linear").asDouble(), score.linear(), 2e-13);
      assertEquals(row.path("raw").asDouble(), score.rawProbability(), 2e-14);
      assertEquals(row.path("p").asDouble(), score.probability(), 2e-14);
    }
  }

  @Test
  void featureCountIsStrict() {
    assertThrows(IllegalArgumentException.class, () -> MODEL.score(new double[12]));
  }
}
