package org.mission1.crew.operational;

import static org.junit.jupiter.api.Assertions.*;
import static org.mission1.crew.operational.OperationalFixtures.*;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class OperationalResourceDiscoveryTest {
  RetainedOperationalInputs.Batch batch(List<String> providers, List<OperationalBinding.Resource> resources) {
    return new RetainedOperationalInputs.Batch(List.of(), resources, providers, List.of(), true, 7, 0);
  }

  @Test void arbitraryFutureNumbersRequireNoLocatorEntryAndNamesAreNeverSlugged() {
    for (int number : List.of(42,73,216,997)) {
      var urls = OperationalResourceDiscovery.structured("SYNTHETIC TEST_ONLY assigned to Crew-" + number,
          "Expedition 94", "https://evil.test/people/a/");
      assertTrue(urls.contains("https://www.nasa.gov/mission/nasas-spacex-crew-" + number + "/"));
      assertTrue(urls.contains("https://www.nasa.gov/mission/expedition-94/"));
      assertEquals(2, urls.size());
    }
    assertTrue(OperationalResourceDiscovery.structured("NASA astronaut Avery Example", "unknown", null).isEmpty());
    assertTrue(OperationalResourceDiscovery.structured("Crew-1000", "Expedition 0", null).isEmpty());
  }

  @Test void candidateFanoutFailsClosedAtBoundInsteadOfSilentlyTruncating() {
    var urls = java.util.stream.IntStream.rangeClosed(1,257)
        .mapToObj(n -> "https://ll.thespacedevs.com/2.3.0/astronauts/" + n + "/").toList();
    assertEquals(256, OperationalResourceDiscovery.candidates(batch(urls.subList(0,256),List.of()),List.of(),CUT).size());
    assertThrows(IllegalStateException.class, () -> OperationalResourceDiscovery.candidates(batch(urls,List.of()),List.of(),CUT));
  }

  @Test void untrustedLinksAndExpiredCapturesNeverExpandCandidateWork() {
    var original = provider("LL2:PERSON:713");
    var expired = changed(original, original.kind(), original.name(), original.agency(), original.dob(),
        original.flights(), List.of("https://www.nasa.gov/people/test-only/"), CUT.minusSeconds(1));
    assertTrue(OperationalResourceDiscovery.candidates(batch(List.of(),List.of(expired)),List.of(),CUT).isEmpty());
    assertTrue(OperationalResourceDiscovery.candidates(batch(List.of("http://www.nasa.gov/people/a/",
        "https://www.nasa.gov/people/%2e%2e/a","https://example.test/a"),List.of()),List.of(),CUT).isEmpty());
  }

  @Test void sourceAdvertisedPersonalRelationsExpandOnlyValidatedResourceClasses() {
    String url = "https://www.nasa.gov/mission/nasas-spacex-crew-42/";
    String html = """
        <html><head><link rel="alternate" href="https://www.nasa.gov/wp-json/wp/v2/mission/999042"></head>
        <nav><a href="https://www.nasa.gov/people/navigation/">Noise</a></nav>
        <main><h1>TEST_ONLY Crew-42</h1>
        <a href="/people/avery-example/">Avery Example</a>
        <a href="https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Test_Only">Biography</a>
        <a href="https://www.nasa.gov/mission/nasas-spacex-crew-99/">Unrelated mission</a>
        <a href="https://evil.test/person/">Foreign site</a></main></html>
        """;
    var capture = new OperationalResources.Capture(url,url,List.of(),CUT,200,"text/html",null,html.getBytes(StandardCharsets.UTF_8));
    var parsed = new OperationalResources(JSON).parse(capture,"TEST_ONLY").getFirst();
    assertEquals(OperationalBinding.Kind.NASA_HTML,parsed.kind());
    assertEquals(3,parsed.links().size());
    assertFalse(parsed.links().stream().anyMatch(u -> u.contains("navigation") || u.contains("crew-99") || u.contains("evil")));
    assertTrue(parsed.roster().isEmpty()); // acquiring a link grants no named-roster witness
  }

  @Test void excessiveOfficialPersonalLinksRejectResourceRatherThanCreatingUnboundedWork() {
    String url = "https://www.nasa.gov/mission/nasas-spacex-crew-42/";
    String html = "<h1>TEST_ONLY</h1>" + java.util.stream.IntStream.range(0,65)
        .mapToObj(n -> "<a href='/people/test-" + n + "/'>Test</a>").collect(java.util.stream.Collectors.joining());
    var capture = new OperationalResources.Capture(url,url,List.of(),CUT,200,"text/html",null,html.getBytes(StandardCharsets.UTF_8));
    assertThrows(IllegalArgumentException.class, () -> new OperationalResources(JSON).parse(capture,"TEST_ONLY"));
  }

  @Test void newResourceWithoutQualifiedNamedRosterStillDefersUnderSameIdentityPolicy() {
    var s = subject("Sophie Adenot");
    var c = provider("LL2:PERSON:747");
    var result = RESOLVER.evaluate(s,List.of(c),CUT,true);
    assertEquals(OperationalBinding.Outcome.AUTO_DEFER,result.outcome());
    assertTrue(result.reasons().contains("MISSING_QUALIFIED_WITNESS"));
  }
}
