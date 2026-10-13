package org.mission1.crew.operational;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import org.mission1.crew.automatic.IdentityFeatures;

/** Candidate locators only. Neither a derived URL nor a source link is identity evidence. */
public final class OperationalResourceDiscovery {
  public static final int MAX_CANDIDATES = 256;
  private static final Pattern CREW = Pattern.compile("CREW-([1-9][0-9]{0,2})");
  private static final Pattern EXPEDITION = Pattern.compile("(?i)^Expedition ([1-9][0-9]{0,2})$");

  private OperationalResourceDiscovery() {}

  public static List<String> structured(String biography, String expedition, String profileUrl) {
    var urls = new TreeSet<String>();
    missions(urls, IdentityFeatures.missions(Objects.toString(biography, "")));
    var match = EXPEDITION.matcher(Objects.toString(expedition, ""));
    if (match.matches()) urls.add("https://www.nasa.gov/mission/expedition-" + match.group(1) + "/");
    add(urls, profileUrl);
    return List.copyOf(urls);
  }

  public static List<String> candidates(RetainedOperationalInputs.Batch batch, List<String> seeds, Instant cut) {
    var urls = new TreeSet<String>();
    for (String url : batch.providerUrls()) add(urls, url);
    for (String url : batch.structuredUrls()) add(urls, url);
    for (String url : seeds) add(urls, url);
    for (var subject : batch.subjects()) {
      if (!subject.integrity() || subject.capturedAt().isAfter(cut)) continue;
      missions(urls, subject.missions());
      for (var anchor : subject.anchors()) add(urls, anchor.url());
    }
    for (var resource : batch.resources()) {
      if (!resource.available(cut)) continue;
      if (resource.kind() == OperationalBinding.Kind.PROVIDER_PERSON)
        missions(urls, resource.missions());
      for (String link : resource.links()) add(urls, link);
    }
    return List.copyOf(urls);
  }

  private static void missions(Set<String> urls, Collection<String> missions) {
    for (String mission : missions) {
      var match = CREW.matcher(mission);
      if (match.matches()) add(urls, "https://www.nasa.gov/mission/nasas-spacex-crew-" + match.group(1) + "/");
    }
  }

  private static void add(Set<String> urls, String url) {
    if (url == null) return;
    try { urls.add(OperationalResources.allowed(url).toString()); }
    catch (IllegalArgumentException ignored) { return; }
    if (urls.size() > MAX_CANDIDATES) throw new IllegalStateException("S10_DISCOVERY_BATCH_BOUND");
  }
}
