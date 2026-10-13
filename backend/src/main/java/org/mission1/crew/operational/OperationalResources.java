package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.nio.charset.*;
import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.mission1.crew.automatic.*;
import org.mission1.crew.domain.CrewEditorial;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.NasaEditorialParser;

/** Bounded, source-specific extractors. Resource IDs and URLs remain locators, not crosswalks. */
public final class OperationalResources {
  public static final String VERSION = "s10-official-resources-v2";

  public record Capture(
      String url,
      String finalUrl,
      List<String> redirects,
      Instant capturedAt,
      Integer status,
      String contentType,
      String error,
      byte[] body,
      Instant retryAt) {
    public Capture(
        String url,
        String finalUrl,
        List<String> redirects,
        Instant capturedAt,
        Integer status,
        String contentType,
        String error,
        byte[] body) {
      this(url, finalUrl, redirects, capturedAt, status, contentType, error, body, null);
    }

    public Capture {
      redirects = List.copyOf(redirects);
      body = body == null ? null : body.clone();
    }

    @Override
    public byte[] body() {
      return body == null ? null : body.clone();
    }

    public String hash() {
      return body == null ? null : CrewHttpReader.sha256(body);
    }
  }

  private final ObjectMapper json;
  private final NasaEditorialParser nasa;

  public OperationalResources(ObjectMapper json) {
    this.json = json;
    nasa = new NasaEditorialParser(json);
  }

  public static URI allowed(String value) {
    URI u = URI.create(value);
    String path = u.getPath(), host = u.getHost();
    if (!"https".equals(u.getScheme())
        || host == null
        || u.getRawUserInfo() != null
        || u.getFragment() != null
        || u.getPort() != -1 && u.getPort() != 443
        || value.length() > 2000
        || path == null
        || path.contains("..")
        || path.contains("\\")
        || u.getRawPath().matches("(?i).*%(2e|2f|5c).*"))
      throw new IllegalArgumentException("UNSAFE_URL");
    boolean ok =
        switch (host) {
          case "www.nasa.gov" ->
              path.matches("/(people|humans-in-space/astronauts|mission|event)/.+")
                  || path.matches("/wp-json/wp/v2/(people|topic|mission)/[1-9][0-9]*");
          case "ll.thespacedevs.com" -> path.matches("/2\\.3\\.0/astronauts/[1-9][0-9]*/");
          case "www.asc-csa.gc.ca" -> path.startsWith("/eng/astronauts/canadian/");
          case "www.esa.int" ->
              path.startsWith("/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/");
          case "www.gctc.ru" -> path.equals("/main.php") && "id=154".equals(u.getQuery());
          case "humans-in-space.jaxa.jp" -> path.startsWith("/en/astronaut/");
          default -> false;
        };
    if (!ok || !host.equals("www.gctc.ru") && u.getQuery() != null)
      throw new IllegalArgumentException("UNSUPPORTED_RESOURCE_URL");
    return u;
  }

  public static String decode(String raw) {
    var u = URI.create(raw);
    if (!"gcc02.safelinks.protection.outlook.com".equals(u.getHost())) return raw;
    if (!"https".equals(u.getScheme()) || u.getRawQuery() == null)
      throw new IllegalArgumentException("UNSAFE_WRAPPER");
    var urls =
        Arrays.stream(u.getRawQuery().split("&"))
            .filter(x -> x.startsWith("url="))
            .map(x -> URLDecoder.decode(x.substring(4), StandardCharsets.UTF_8))
            .toList();
    if (urls.size() != 1) throw new IllegalArgumentException("AMBIGUOUS_WRAPPER");
    return allowed(urls.getFirst()).toString();
  }

  public static String agency(String a) {
    if (a == null) return null;
    return switch (a) {
      case "Roscosmos" -> "RFSA";
      default -> a;
    };
  }

  public static String sourceAgency(String name, String text) {
    int pos = text.indexOf(name);
    if (pos < 0) return null;
    var suffix =
        Pattern.compile("^\\s+of (NASA|CSA|ESA|Roscosmos|JAXA)\\b")
            .matcher(text.substring(pos + name.length()));
    if (suffix.find()) return agency(suffix.group(1));
    String clause = text.substring(Math.max(0, text.lastIndexOf(',', pos) + 1)).split(",")[0];
    var of = Pattern.compile("\\bof (NASA|CSA|ESA|Roscosmos|JAXA)\\b").matcher(clause);
    if (of.find()) return agency(of.group(1));
    var both =
        Pattern.compile(
                "(?:station commander|flight engineer) ([A-Z][\\w]+ [A-Z][\\w]+) and flight"
                    + " engineer ([A-Z][\\w]+ [A-Z][\\w]+), both (Roscosmos|NASA|ESA|CSA|JAXA)")
            .matcher(text);
    while (both.find())
      if (name.equals(both.group(1)) || name.equals(both.group(2))) return agency(both.group(3));
    var introductions =
        Pattern.compile(
                "(NASA|Roscosmos|ESA(?: \\(European Space Agency\\))?|CSA(?: \\(Canadian Space"
                    + " Agency\\))?|JAXA)\\s+(?:astronauts?|cosmonauts?|flight engineers?)\\s+")
            .matcher(text);
    var spans = new ArrayList<int[]>();
    var agencies = new ArrayList<String>();
    while (introductions.find()) {
      spans.add(new int[] {introductions.start(), introductions.end()});
      agencies.add(introductions.group(1).split(" ")[0]);
    }
    for (int i = 0; i < spans.size(); i++) {
      String scope =
          text.substring(
                  spans.get(i)[1], i + 1 < spans.size() ? spans.get(i + 1)[0] : text.length())
              .split("\\band station commander\\b", 2)[0];
      if (scope.contains(name)) return agency(agencies.get(i));
    }
    return null;
  }

  public static Set<String> scopedMissions(String type, String title, String paragraph) {
    if (type.equals("PERSON_ENTERED_STATION") || type.equals("PERSON_DEPARTED_STATION"))
      return IdentityFeatures.missions(title);
    if (paragraph.matches("(?is).*joins .*which includes.*")) return Set.of();
    return IdentityFeatures.missions(paragraph);
  }

  public static List<Anchor> anchors(String html, String name) {
    var d = NasaEditorialParser.dom(html);
    d.select(
            "header,footer,nav,figcaption,cite,.author,.byline,[rel=author],[data-role=photo-credit]")
        .remove();
    var out = new ArrayList<Anchor>();
    int i = 0;
    for (var a : d.select("a[href]")) {
      if (OperationalNames.normalize(a.text()).equals(OperationalNames.normalize(name))) {
        String decoded = null;
        try {
          decoded = decode(a.attr("href"));
        } catch (IllegalArgumentException ignored) {
        }
        out.add(new Anchor(a.text(), a.attr("href"), decoded, "paragraph/a[" + i + "]"));
      }
      i++;
    }
    return List.copyOf(out);
  }

  private static String text(String html) {
    var d = NasaEditorialParser.dom(html);
    d.select("header,footer,nav,select").remove();
    var main = d.selectFirst("main");
    return (main == null ? d : main).text().replaceAll("(?U)\\s+", " ").strip();
  }

  public static String birth(String text) {
    String months =
        "January|February|March|April|May|June|July|August|September|October|November|December";
    for (int i = 0; i < 2; i++) {
      String date =
          i == 0
              ? "(" + months + ")\\s+(\\d{1,2}),?\\s+(\\d{4})"
              : "(\\d{1,2})\\s+(" + months + ")\\s+(\\d{4})";
      var m =
          Pattern.compile("(?:date of birth:|born)[^.]{0,75}?" + date, Pattern.CASE_INSENSITIVE)
              .matcher(text);
      if (m.find())
        try {
          int month =
              java.time.Month.valueOf(m.group(i == 0 ? 1 : 2).toUpperCase(Locale.ROOT)).getValue();
          return LocalDate.of(
                  Integer.parseInt(m.group(3)), month, Integer.parseInt(m.group(i == 0 ? 2 : 1)))
              .toString();
        } catch (RuntimeException ignored) {
        }
    }
    return null;
  }

  private static String optional(JsonNode n, String field) {
    return n.path(field).isTextual() ? n.path(field).asText() : null;
  }

  private static Instant instant(JsonNode n, String field) {
    String s = optional(n, field);
    return s == null ? null : Instant.parse(s);
  }

  public List<Resource> parse(Capture c, String ref) {
    var origin = allowed(c.url());
    var end = allowed(c.finalUrl());
    if (!origin.getHost().equals(end.getHost())
        || new HashSet<>(c.redirects()).size() != c.redirects().size()
        || !c.redirects().isEmpty() && !c.redirects().getLast().equals(c.finalUrl())
        || c.redirects().isEmpty() && !c.url().equals(c.finalUrl()))
      throw new IllegalArgumentException("UNVERIFIED_REDIRECT_CHAIN");
    for (var redirect : c.redirects())
      if (!origin.getHost().equals(allowed(redirect).getHost()))
        throw new IllegalArgumentException("REDIRECT_HOST_CHANGE");
    if (c.error() != null
        || c.status() == null
        || c.status() < 200
        || c.status() >= 300
        || c.body() == null
        || c.body().length == 0
        || c.body().length > 2097152
        || c.redirects().size() > 5) throw new IllegalArgumentException("ACQUISITION_FAILED");
    if (c.contentType() == null
        || !(c.contentType().contains("json") || c.contentType().contains("html")))
      throw new IllegalArgumentException("UNSUPPORTED_CONTENT_TYPE");
    String host = URI.create(c.finalUrl()).getHost();
    String path = URI.create(c.finalUrl()).getPath();
    if (host.equals("ll.thespacedevs.com")) return List.of(provider(c, ref));
    if (host.equals("www.gctc.ru")) return directory(c, ref);
    String html = new String(c.body(), StandardCharsets.UTF_8),
        name = "",
        bio = "",
        a = null,
        key = null;
    Kind kind = Kind.UNKNOWN;
    var links = new ArrayList<String>();
    var roster = new ArrayList<String>();
    var missions = new TreeSet<String>();
    if (host.equals("www.nasa.gov") && path.startsWith("/wp-json/")) {
      JsonNode n = nasa.json(c.body());
      String type = n.path("type").asText();
      var nk =
          switch (type) {
            case "people" -> CrewEditorial.Kind.NASA_PEOPLE_RESOURCE;
            case "topic" -> CrewEditorial.Kind.NASA_TOPIC;
            case "mission" -> CrewEditorial.Kind.NASA_MISSION;
            default -> throw new IllegalArgumentException("WRONG_RESOURCE_TYPE");
          };
      var r = nasa.resource(n, nk);
      if (!path.endsWith("/" + r.wpId()))
        throw new IllegalArgumentException("RESOURCE_ID_MISMATCH");
      name = r.title();
      html = n.path("content").path("rendered").asText();
      bio = text(html);
      key = r.key();
      a = "NASA";
      kind =
          switch (type) {
            case "people" -> Kind.NASA_PEOPLE;
            case "topic" -> Kind.NASA_TOPIC;
            default -> Kind.NASA_MISSION;
          };
      links.add(r.canonicalUrl().toString());
      if (kind == Kind.NASA_MISSION) {
        missions.addAll(IdentityFeatures.missions(name));
        var m =
            Pattern.compile("Meet the Crew (.*?) Launch ", Pattern.CASE_INSENSITIVE).matcher(bio);
        if (missions.size() == 1 && m.find())
          for (String s : m.group(1).split(",|\\band\\b")) if (!s.isBlank()) roster.add(s.strip());
        if (roster.size() < 1 || roster.size() > 30)
          throw new IllegalArgumentException("MISSING_NAMED_ROSTER");
      } else if (kind == Kind.NASA_PEOPLE
          && !nasa.about(r, OperationalNames.clean(name))
          && !(name.matches("(?i)^NASA Astronaut Candidate [\\p{L} .'-]+$")
              && OperationalNames.clean(name).split(" ").length >= 2
              && OperationalNames.compatible(OperationalNames.clean(name), name, false)))
        throw new IllegalArgumentException("NOT_SINGLE_PERSON");
    } else {
      var d = NasaEditorialParser.dom(html);
      var headings = d.select("h1");
      name = headings.size() == 1 ? headings.first().text() : "";
      bio = text(html);
      if (host.equals("www.nasa.gov")) kind = Kind.NASA_HTML;
      else if (!name.isBlank()
          && !OperationalNames.clean(name).matches("(?i).*(astronauts|our team|active|index).*")) {
        kind = Kind.AGENCY_PERSON;
        a =
            switch (host) {
              case "www.asc-csa.gc.ca" -> "CSA";
              case "www.esa.int" -> "ESA";
              case "humans-in-space.jaxa.jp" -> "JAXA";
              default -> null;
            };
      } else kind = Kind.AGENCY_INDEX;
    }
    var dom = NasaEditorialParser.dom(html);
    dom.select("header,footer,nav,figcaption,cite,.author,.byline,[rel=author]").remove();
    for (var link : dom.select("link[rel=alternate][href],a[href]")) {
      String href = link.attr("href");
      boolean typed =
          link.tagName().equals("link")
              && href.matches(
                  "https://www\\.nasa\\.gov/wp-json/wp/v2/(people|topic|mission)/[1-9][0-9]*");
      // V8 owns typed Expedition roster semantics; S10's named mission witness is Crew-scoped.
      if (path.matches("/mission/expedition-[0-9]+/") && href.contains("/wp-json/wp/v2/mission/"))
        typed = false;
      boolean biography = kind == Kind.NASA_TOPIC || kind == Kind.NASA_HTML;
      biography =
          biography
              && (link.text().toLowerCase(Locale.ROOT).contains("biography")
                  || link.attr("aria-label").toLowerCase(Locale.ROOT).contains("biography"));
      // Named mission/expedition pages may advertise official personal resources. These
      // links only expand acquisition; the resolver still demands qualified subject proof.
      boolean missionPage = kind == Kind.NASA_MISSION
          || kind == Kind.NASA_HTML && path.startsWith("/mission/");
      if (typed || biography || missionPage)
        try {
          String candidate = allowed(URI.create(c.finalUrl()).resolve(href).toString()).toString();
          // No mission-to-mission crawl. Only source-advertised typed self and personal paths.
          if (!typed && !biography && URI.create(candidate).getHost().equals("www.nasa.gov")
              && !URI.create(candidate).getPath().matches("/(people|humans-in-space/astronauts)/.+")) continue;
          if (!links.contains(candidate)) links.add(candidate);
          if (links.size() > 64) throw new IllegalArgumentException("RESOURCE_LINK_BOUND");
        } catch (IllegalArgumentException ignored) {
          if (links.size() > 64) throw new IllegalArgumentException("RESOURCE_LINK_BOUND");
        }
    }
    if (kind == Kind.NASA_PEOPLE || kind == Kind.AGENCY_PERSON)
      missions.addAll(IdentityFeatures.missions(bio));
    return List.of(
        resource(
            c,
            ref,
            kind,
            a,
            name,
            birth(bio),
            IdentityFeatures.years(bio),
            missions,
            List.of(),
            key,
            List.of(),
            roster,
            links,
            bio,
            "primary-person-or-named-roster"));
  }

  private Resource provider(Capture c, String ref) {
    var n = nasa.json(c.body());
    String id = n.path("id").asText();
    if (!URI.create(c.finalUrl()).getPath().equals("/2.3.0/astronauts/" + id + "/")
        || n.path("name").asText().isBlank()
        || !n.path("flights").isArray()
        || n.path("flights").size() > 200
        || !n.path("landings").isArray())
      throw new IllegalArgumentException("LL2_DETAIL_INCOMPLETE");
    var ends = new HashMap<String, Instant>();
    for (var land : n.path("landings")) {
      var end = instant(land, "mission_end");
      String launch = land.path("launch").path("id").asText();
      if (end != null && !launch.isBlank()) ends.put(launch, end);
    }
    var flights = new ArrayList<Flight>();
    var missions = new TreeSet<String>();
    for (var f : n.path("flights")) {
      var fm = IdentityFeatures.missions(f.path("mission").path("name").asText());
      missions.addAll(fm);
      flights.add(
          new Flight(
              f.path("id").asText(),
              fm,
              instant(f, "net"),
              ends.get(f.path("id").asText()),
              f.path("status").path("id").asInt() == 3,
              f.path("rocket").path("configuration").path("full_name").asText(null),
              f.path("launch_service_provider").path("name").asText(null)));
    }
    if (n.path("flights_count").asInt(flights.size()) != flights.size())
      throw new IllegalArgumentException("LL2_FLIGHTS_TRUNCATED");
    String bio = n.path("bio").asText("");
    String name = n.path("name").asText();
    return resource(
        c,
        ref,
        Kind.PROVIDER_PERSON,
        agency(n.path("agency").path("abbrev").asText(null)),
        name,
        optional(n, "date_of_birth"),
        IdentityFeatures.years(bio),
        missions,
        IdentityFeatures.aliases(name, bio),
        "LL2:PERSON:" + id,
        flights,
        List.of(),
        List.of(),
        bio,
        "astronaut/flights-and-landings");
  }

  private List<Resource> directory(Capture c, String ref) {
    var d = NasaEditorialParser.dom(new String(c.body(), Charset.forName("windows-1251")));
    var rows = new ArrayList<Resource>();
    for (var tr : d.select("tr")) {
      var cols = tr.select("td");
      if (cols.size() != 6 || !cols.get(2).text().matches("\\d{2}\\.\\d{2}\\.\\d{4}")) continue;
      String[] date = cols.get(2).text().split("\\.");
      String dob =
          LocalDate.of(
                  Integer.parseInt(date[2]), Integer.parseInt(date[1]), Integer.parseInt(date[0]))
              .toString();
      String selection = cols.get(3).text();
      selection = selection.length() >= 4 ? selection.substring(selection.length() - 4) : "";
      rows.add(
          resource(
              c,
              ref + ":row:" + cols.get(0).text(),
              Kind.NATIVE_DIRECTORY,
              "RFSA",
              cols.get(1).text(),
              dob,
              Set.of(selection),
              Set.of(),
              OperationalNames.transliterations(cols.get(1).text()),
              null,
              List.of(),
              List.of(),
              List.of(),
              "",
              "tr[row=" + cols.get(0).text() + "]"));
    }
    if (rows.isEmpty() || rows.size() > 200) throw new IllegalArgumentException("DIRECTORY_SCHEMA");
    return List.copyOf(rows);
  }

  private Resource resource(
      Capture c,
      String ref,
      Kind kind,
      String a,
      String name,
      String dob,
      Set<String> selections,
      Set<String> missions,
      List<String> aliases,
      String key,
      List<Flight> flights,
      List<String> roster,
      List<String> links,
      String bio,
      String locator) {
    return new Resource(
        ref,
        c.url(),
        c.finalUrl(),
        c.redirects(),
        c.hash(),
        c.capturedAt(),
        c.capturedAt().plus(Duration.ofDays(30)),
        kind,
        a,
        name,
        dob,
        selections,
        missions,
        aliases,
        key,
        flights,
        roster,
        links.stream().distinct().sorted().limit(32).toList(),
        bio,
        locator);
  }
}
