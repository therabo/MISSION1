package org.mission1.crew.research;

import com.fasterxml.jackson.databind.*;
import java.io.*;
import java.util.*;
import org.mission1.source.crew.CrewHttpReader;

/**
 * Exact research-logistic-v1 coefficients and independently fitted validation sigmoid. No fit API.
 */
public final class FrozenIdentityModel {
  public static final String VERSION = "crew-auto-identity-v1-shadow";
  public static final String SCHEMA = "research-13-v1-scoped-extractor-1";
  public static final String SHA =
      "469c31402cdd89ae1bc956cdcabdc57e00088b967806d322bdfbfca8d9896792";
  public static final String LEXICAL_SHA =
      "5c7df0376b9b8e9b64f6f9d18204f152a148baaac439fdaf4cc70b488e774c10";
  public static final List<String> FEATURES =
      List.of(
          "exactName",
          "nameTokenContainment",
          "tokenJaccard",
          "characterSimilarity",
          "givenNameSimilarity",
          "surnameSimilarity",
          "sameAgency",
          "dobEqual",
          "dobConflict",
          "sharedSelection",
          "sharedMission",
          "biographyLexicalCosine",
          "typedBridge");
  private final double[] weights;
  private final double intercept, calibrationWeight, calibrationIntercept;
  private final Map<String, Integer> vocabulary;
  private final double[] idf;

  public record Score(double linear, double rawProbability, double probability) {}

  public static FrozenIdentityModel load(ObjectMapper json) {
    try (var m = FrozenIdentityModel.class.getResourceAsStream("/crew/automatic/model-v1.json");
        var l = FrozenIdentityModel.class.getResourceAsStream("/crew/automatic/lexical-v1.json")) {
      if (m == null || l == null)
        throw new IllegalStateException("Missing frozen identity artifact");
      return new FrozenIdentityModel(json, m.readAllBytes(), SHA, l.readAllBytes(), LEXICAL_SHA);
    } catch (IOException e) {
      throw new IllegalStateException("Identity artifact read failed", e);
    }
  }

  public FrozenIdentityModel(
      ObjectMapper json, byte[] model, String expectedSha, byte[] lexical, String lexicalSha) {
    if (!CrewHttpReader.sha256(model).equals(expectedSha)
        || !CrewHttpReader.sha256(lexical).equals(lexicalSha))
      throw new IllegalArgumentException("Frozen identity artifact SHA mismatch");
    try {
      var n = json.readTree(model);
      if (!n.path("modelVersion").asText().equals("research-logistic-v1")
          || !json.convertValue(n.path("features"), List.class).equals(FEATURES))
        throw new IllegalArgumentException("Unsupported identity feature schema");
      weights = json.convertValue(n.path("logisticCoefficient"), double[].class);
      intercept = number(n, "intercept");
      calibrationWeight = number(n.path("sigmoidValidationCalibration"), "coefficient");
      calibrationIntercept = number(n.path("sigmoidValidationCalibration"), "intercept");
      if (weights.length != FEATURES.size() || calibrationWeight <= 0)
        throw new IllegalArgumentException("Invalid calibration/coefficient count");
      for (double w : weights)
        if (!Double.isFinite(w)) throw new IllegalArgumentException("Invalid coefficient");
      var v = json.readTree(lexical);
      vocabulary = new HashMap<>();
      v.path("vocabulary")
          .fields()
          .forEachRemaining(e -> vocabulary.put(e.getKey(), e.getValue().intValue()));
      idf = json.convertValue(v.path("idf"), double[].class);
      if (vocabulary.size() != idf.length
          || new HashSet<>(vocabulary.values()).size() != idf.length)
        throw new IllegalArgumentException("Invalid frozen vocabulary");
      for (int i : vocabulary.values())
        if (i < 0 || i >= idf.length) throw new IllegalArgumentException("Vocabulary index");
      for (double d : idf)
        if (!Double.isFinite(d) || d <= 0) throw new IllegalArgumentException("Invalid IDF");
    } catch (IOException e) {
      throw new IllegalArgumentException("Invalid frozen identity JSON", e);
    }
  }

  private static double number(JsonNode n, String key) {
    if (!n.path(key).isNumber() || !Double.isFinite(n.path(key).doubleValue()))
      throw new IllegalArgumentException("Invalid model number");
    return n.path(key).doubleValue();
  }

  public Score score(double[] features) {
    if (features.length != weights.length) throw new IllegalArgumentException("Feature count");
    double linear = intercept;
    for (int i = 0; i < features.length; i++) {
      if (!Double.isFinite(features[i]) || features[i] < 0 || features[i] > 1.000000000001)
        throw new IllegalArgumentException("Feature range");
      linear += features[i] * weights[i];
    }
    return new Score(
        linear, sigmoid(linear), sigmoid(calibrationIntercept + calibrationWeight * linear));
  }

  private static double sigmoid(double x) {
    return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
  }

  private Map<Integer, Double> lexical(IdentityEvidence r) {
    var names = new HashSet<>(IdentityFeatures.tokens(r.name()));
    var words =
        IdentityFeatures.tokens(r.biography()).stream()
            .filter(w -> !names.contains(w) && w.length() > 1)
            .toList();
    Map<Integer, Integer> count = new HashMap<>();
    for (int i = 0; i < words.size(); i++) {
      var k = vocabulary.get(words.get(i));
      if (k != null) count.merge(k, 1, Integer::sum);
      if (i > 0) {
        k = vocabulary.get(words.get(i - 1) + " " + words.get(i));
        if (k != null) count.merge(k, 1, Integer::sum);
      }
    }
    Map<Integer, Double> result = new TreeMap<>();
    double norm = 0;
    for (var e : count.entrySet()) {
      double w = (1 + Math.log(e.getValue())) * idf[e.getKey()];
      result.put(e.getKey(), w);
      norm += w * w;
    }
    double length = Math.sqrt(norm);
    if (length > 0) result.replaceAll((k, v) -> v / length);
    return result;
  }

  public double cosine(IdentityEvidence a, IdentityEvidence b) {
    var x = lexical(a);
    var y = lexical(b);
    double sum = 0;
    for (var e : x.entrySet()) sum += e.getValue() * y.getOrDefault(e.getKey(), 0.0);
    return Math.min(1, sum);
  }
}
