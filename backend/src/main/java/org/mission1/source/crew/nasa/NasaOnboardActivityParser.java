package org.mission1.source.crew.nasa;

import java.util.*;
import java.util.regex.*;
import org.jsoup.nodes.Element;
import org.mission1.crew.domain.*;

/**
 * Conservative activity clauses in the validated ISS RSS article, never article-wide name mining.
 */
final class NasaOnboardActivityParser {
  static final String METHOD = "NasaOperationalPostParser/1.2.0";
  private static final String WORD = "[\\p{Lu}][\\p{L}\\p{M}’'\\-]+";
  private static final String NAME = WORD + "(?: " + WORD + "){1,3}";
  private static final String ROLE =
      "(?:NASA|Roscosmos|ESA(?: \\(European Space Agency\\))?|CSA(?: \\(Canadian Space Agency\\))?)"
          + " (?:astronauts?|cosmonauts?|flight engineers?)|station commander|flight engineer";
  private static final Pattern INTRODUCTION = Pattern.compile("(?:" + ROLE + ") (" + NAME + ")");
  private static final Pattern ACTIVITY =
      Pattern.compile(
          "\\b(?:is|are)"
              + " (?:monitoring|working|conducting|servicing|performing|transferring|exercising)\\b"
              + "|\\b(?:worked|conducted|serviced|performed|transferred|reorganized|loaded|wore)\\b|\\bhave"
              + " been living and working\\b");
  private static final Pattern LOCATION =
      Pattern.compile(
          "\\b(?:aboard|on|in|inside) (?:the )?(?:International Space Station|ISS|space"
              + " station|station|orbital outpost|orbiting laboratory|(?:Destiny|Kibo)"
              + " laboratory(?: module)?|Harmony module)\\b");
  private static final Pattern UNSAFE =
      Pattern.compile(
          "(?i)\\b(?:will|would|could|might|may|scheduled|planned|plans?|expected|previously|formerly|historically|recalled|said|says|quoted|preflight|training|simulated|not|never|last"
              + " year|last mission|years? ago|had)\\b|\\b(?:19|20)[0-9]{2}\\b");
  private static final Pattern FULL_NAME = Pattern.compile(NAME);
  private static final Pattern EXPLICIT_CLOCK =
      Pattern.compile("^At " + NasaOperationalTimeParser.CLOCK + ", ");

  List<CrewVerificationEvidence> parse(
      String title, Element paragraph, CrewSourceObservation observation) {
    if (!"https".equals(observation.sourceUrl().getScheme())
        || !"www.nasa.gov".equals(observation.sourceUrl().getHost())
        || !observation.sourceUrl().getPath().startsWith("/blogs/spacestation/")) return List.of();
    // A completed vehicle departure/return story cannot provide post-departure onboard
    // observations.
    String lowerTitle = title.toLowerCase(Locale.ROOT);
    if (!lowerTitle.matches(".*\\b(?:cargo|resupply|uncrewed|cygnus)\\b.*")
        && lowerTitle.matches(
            ".*(?:undocks|undocked|splashes|splashdown|deorbit|ride home|returns to earth).*$"))
      return List.of();
    String text = NasaOperationalPostParser.normalize(paragraph.text());
    if (text.indexOf('“') >= 0 || text.indexOf('”') >= 0 || text.indexOf('"') >= 0)
      return List.of();
    // Short surname references are allowed only within this paragraph after a unique typed
    // introduction.
    Map<String, List<String>> introduced = new HashMap<>();
    var intro = INTRODUCTION.matcher(text);
    while (intro.find()) {
      String name = intro.group(1);
      introduced.computeIfAbsent(surname(name), k -> new ArrayList<>()).add(name);
    }
    String[] sentences = text.split("(?<![ap]\\.m\\.)(?<=[.!?]) (?=[\\p{Lu}])");
    if (sentences.length > 64) return List.of();
    var result = new ArrayList<CrewVerificationEvidence>();
    for (String sentence : sentences) {
      var clock = EXPLICIT_CLOCK.matcher(sentence);
      String clause = clock.find() ? sentence.substring(clock.end()) : sentence;
      var action = ACTIVITY.matcher(clause);
      if (!action.find() || UNSAFE.matcher(clause).find()) continue;
      String subject = clause.substring(0, action.start()).trim();
      String predicate = clause.substring(action.start());
      // Location must belong to the activity, not another person's relative/contrast clause.
      var location =
          LOCATION.matcher(predicate.split("[;]|\\b(?:while|where|but|whereas)\\b", 2)[0]);
      if (!location.find()) continue;
      // A different full-name clause between the activity and location is outside the subject
      // scope.
      if (FULL_NAME.matcher(predicate.substring(0, location.start())).find()) continue;
      List<PersonReference> people = subjects(subject, paragraph, introduced);
      if (people.isEmpty()) continue;
      CrewSourceObservation effective = observation;
      String method = METHOD + "|PUBLICATION_TIME_PROXY";
      if (clock.matches() || clock.find(0)) {
        var time = NasaOperationalTimeParser.parse(clock, null, observation);
        effective =
            new CrewSourceObservation(
                observation.source(),
                observation.sourceUrl(),
                observation.retrievedAt(),
                observation.sourcePublishedAt(),
                time.instant(),
                observation.httpEtag(),
                observation.httpLastModified(),
                observation.contentHash(),
                observation.sourceVersion(),
                observation.adapterVersion());
        method = time.method().replace(CrewOperationalTime.METHOD, METHOD);
      }
      result.add(
          new CrewVerificationEvidence(
              CrewVerificationEvidence.Type.PERSON_CURRENTLY_ABOARD,
              Station.ISS,
              people,
              null,
              NasaSourceType.NASA_ISS_OPERATIONAL_POST,
              effective,
              text,
              method,
              CrewVerificationEvidence.Completeness.PARTIAL,
              CrewVerificationEvidence.Assertion.OBSERVED));
    }
    return List.copyOf(result);
  }

  private List<PersonReference> subjects(
      String subject, Element paragraph, Map<String, List<String>> introduced) {
    boolean collective = subject.matches("New Expedition [0-9]+ crew members .+");
    boolean typed = INTRODUCTION.matcher(subject).find();
    String stripped =
        subject
            .replaceFirst("^New Expedition [0-9]+ crew members ", "")
            .replaceAll("(?:" + ROLE + ") ", "")
            .replaceAll(
                " of (?:NASA|Roscosmos|CSA \\(Canadian Space Agency\\)|ESA \\(European Space"
                    + " Agency\\))",
                "");
    var names = new ArrayList<String>();
    for (String part : stripped.split(",| and ")) {
      String name = part.trim();
      if (name.isEmpty()) continue;
      if (!FULL_NAME.matcher(name).matches()) {
        var possibilities = introduced.getOrDefault(name, List.of()).stream().distinct().toList();
        if (possibilities.size() != 1) return List.of();
        name = possibilities.getFirst();
      } else if (!typed
          && !collective
          && !introduced.getOrDefault(surname(name), List.of()).contains(name)) {
        return List.of();
      }
      names.add(name);
    }
    if (names.isEmpty() || names.size() > 30 || new HashSet<>(names).size() != names.size())
      return List.of();
    var result = new ArrayList<PersonReference>();
    for (String name : names) {
      java.net.URI profile = null;
      for (var a : paragraph.select("a[href]")) {
        if (!NasaOperationalPostParser.normalize(a.text()).equals(name)) continue;
        var candidate = NasaOperationalPostParser.officialPersonalLink(a.attr("href"));
        if (candidate != null) {
          if (profile != null && !profile.equals(candidate)) return List.of();
          profile = candidate;
        }
      }
      result.add(new PersonReference(null, name, List.of(), profile));
    }
    return List.copyOf(result);
  }

  private static String surname(String name) {
    return name.substring(name.lastIndexOf(' ') + 1);
  }
}
