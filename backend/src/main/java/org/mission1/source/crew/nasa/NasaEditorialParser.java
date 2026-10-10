package org.mission1.source.crew.nasa;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.nio.charset.*;
import java.text.Normalizer;
import java.time.*;
import java.util.*;
import java.util.regex.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import org.mission1.crew.domain.CrewEditorial.*;

/** Bounded semantic DOM parsing; no CSS identity, script evaluation or human identity decisions. */
public final class NasaEditorialParser {
  public static final String API = "https://www.nasa.gov/wp-json/wp/v2/";
  public static final URI TOPIC =
      URI.create(
          "https://www.nasa.gov/international-space-station/space-station-research-and-technology/latest-news-from-space-station-research/");
  private final ObjectMapper json;
  private static final Pattern LINE =
      Pattern.compile("^(.+?),\\s*(Commander|Flight Engineer)$", Pattern.CASE_INSENSITIVE);
  private static final Pattern CARD_ROLE =
      Pattern.compile(
          "Expedition\\s+([0-9]+)\\s+(flight engineer|commander)", Pattern.CASE_INSENSITIVE);

  public NasaEditorialParser(ObjectMapper json) {
    this.json = json;
  }

  public static URI nasaUrl(String value) {
    if (value == null || value.length() > 2000) throw invalid("URL_BOUND");
    try {
      URI u = URI.create(value);
      if (!"https".equals(u.getScheme())
          || !"www.nasa.gov".equals(u.getHost())
          || u.getRawUserInfo() != null
          || u.getFragment() != null
          || (u.getPort() != -1 && u.getPort() != 443)
          || u.getPath() == null
          || u.getPath().contains("..")
          || u.getRawPath().toLowerCase(Locale.ROOT).contains("%2e")) throw invalid("UNSAFE_URL");
      return u;
    } catch (IllegalArgumentException e) {
      throw invalid("UNSAFE_URL");
    }
  }

  public JsonNode json(byte[] body) {
    try {
      return json.readTree(utf8(body));
    } catch (Exception e) {
      throw invalid("INVALID_JSON");
    }
  }

  public static String utf8(byte[] body) {
    if (body == null || body.length == 0 || body.length > 2097152) throw invalid("BODY_BOUND");
    try {
      return StandardCharsets.UTF_8
          .newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(java.nio.ByteBuffer.wrap(body))
          .toString();
    } catch (CharacterCodingException e) {
      throw invalid("INVALID_UNICODE");
    }
  }

  public static Document dom(String html) {
    if (html == null || html.length() > 2097152) throw invalid("DOM_BOUND");
    Document d = Jsoup.parse(html);
    if (d.getAllElements().size() > 40000 || d.select("a[href]").size() > 3000)
      throw invalid("DOM_BOUND");
    for (Element e : d.getAllElements()) if (e.parents().size() > 100) throw invalid("DOM_DEPTH");
    d.select("script,style,iframe,template").remove();
    return d;
  }

  public static String normalize(String text) {
    if (text == null
        || text.length() > 10000
        || text.codePoints()
            .anyMatch(
                c -> (Character.isISOControl(c) && !Character.isWhitespace(c)) || c == 0xfffd))
      throw invalid("TEXT_BOUND_OR_UNICODE");
    return Normalizer.normalize(text, Normalizer.Form.NFC).replaceAll("(?U)\\s+", " ").trim();
  }

  public static String bounded(String text, int max) {
    String n = normalize(text);
    if (n.length() > max) throw invalid("TEXT_BOUND");
    return n;
  }

  public URI advertised(byte[] html, URI canonical, String expectedType) {
    var d = dom(utf8(html));
    var links =
        d.select("link[rel=alternate][href]").stream()
            .map(e -> e.attr("href"))
            .filter(s -> s.contains("/wp-json/wp/v2/" + expectedType + "/"))
            .distinct()
            .toList();
    if (links.size() != 1) throw invalid("AMBIGUOUS_REST_ALTERNATE");
    URI u = nasaUrl(links.getFirst());
    if (!u.getPath().matches("/wp-json/wp/v2/" + expectedType + "/[1-9][0-9]*")
        || u.getQuery() != null) throw invalid("WRONG_REST_TYPE");
    var cs = d.select("link[rel=canonical][href]");
    if (cs.size() != 1 || !nasaUrl(cs.first().attr("href")).equals(canonical))
      throw invalid("CANONICAL_MISMATCH");
    if (canonical.equals(TOPIC)
        && d.select("h1").stream()
            .noneMatch(e -> normalize(e.text()).equals("Station Research News")))
      throw invalid("TOPIC_IDENTITY_MISMATCH");
    return u;
  }

  public Resource resource(JsonNode n, Kind kind) {
    String type =
        switch (kind) {
          case NASA_TOPIC -> "topic";
          case NASA_MISSION -> "mission";
          case NASA_PEOPLE_RESOURCE -> "people";
          case NASA_MISSION_STATUS -> "mission-status";
          case NASA_MISSION_TARGET -> "mission-target";
        };
    if (!n.isObject() || !n.path("id").canConvertToLong() || n.path("id").asLong() <= 0)
      throw invalid("INVALID_RESOURCE_ID");
    boolean term = kind == Kind.NASA_MISSION_STATUS || kind == Kind.NASA_MISSION_TARGET;
    if (!type.equals(n.path(term ? "taxonomy" : "type").asText())
        || (!term && !"publish".equals(n.path("status").asText())))
      throw invalid("RESOURCE_TYPE_OR_STATUS");
    String title =
        term ? n.path("name").asText() : dom(n.path("title").path("rendered").asText()).text();
    return new Resource(
        kind,
        n.path("id").asLong(),
        bounded(n.path("slug").asText(), 200),
        nasaUrl(n.path("link").asText()),
        bounded(title, 1000),
        time(n, "date_gmt"),
        time(n, "modified_gmt"));
  }

  private Instant time(JsonNode n, String field) {
    String s = n.path(field).asText();
    if (s.isBlank()) return null;
    try {
      return LocalDateTime.parse(s).toInstant(ZoneOffset.UTC);
    } catch (Exception e) {
      throw invalid("INVALID_CMS_TIMESTAMP");
    }
  }

  public Resource taxonomy(JsonNode list, Kind kind, String slug, String name) {
    if (!list.isArray() || list.size() != 1) throw invalid("TAXONOMY_EMPTY_OR_AMBIGUOUS");
    var r = resource(list.get(0), kind);
    if (!slug.equals(r.slug()) || !name.equals(r.title())) throw invalid("TAXONOMY_INCOMPATIBLE");
    return r;
  }

  public TopicFacts topic(JsonNode n, Resource r, URI expected) {
    if (r.kind() != Kind.NASA_TOPIC
        || !r.canonicalUrl().equals(expected)
        || !r.title().equals("Latest News from Space Station Research"))
      throw invalid("TOPIC_IDENTITY_MISMATCH");
    var d = dom(n.path("content").path("rendered").asText());
    return new TopicFacts(
        stat(d, "Expedition", 1, 999, "NASA_EDITORIAL_EXPEDITION_NUMBER"),
        stat(d, "Crew Members Aboard", 0, 100, "NASA_WEBSITE_EDITORIAL_REPORTED_ABOARD_COUNT"));
  }

  private Stat stat(Document d, String label, int min, int max, String kind) {
    var heads =
        d.select("h1,h2,h3,h4,h5,h6").stream()
            .filter(h -> normalize(h.text()).equals(label))
            .toList();
    if (heads.isEmpty()) return new Stat(kind, null, "", label, "MISSING_FIELD");
    var values = new ArrayList<Integer>();
    String exact = "";
    for (Element h : heads) {
      String found = null;
      for (Element p = h.parent(); p != null; p = p.parent()) {
        String t = normalize(p.text());
        if (t.length() > 1000) break;
        var m = Pattern.compile("^([0-9]{1,3})\\s+" + Pattern.quote(label) + "$").matcher(t);
        if (m.matches()) {
          found = t;
          int v = Integer.parseInt(m.group(1));
          if (v < min || v > max) return new Stat(kind, null, t, label, "OUT_OF_RANGE");
          values.add(v);
          break;
        }
        if (p.select("h1,h2,h3,h4,h5,h6").size() > 1) break;
      }
      if (found == null)
        return new Stat(
            kind, null, bounded(h.parent().text(), 1000), label, "INVALID_STAT_STRUCTURE");
      exact = found;
    }
    if (values.stream().distinct().count() != 1)
      return new Stat(kind, null, exact, label, "CONFLICTING_DUPLICATE_FIELD");
    return new Stat(kind, values.getFirst(), exact, "heading[" + label + "]/parent", null);
  }

  public JsonNode mission(JsonNode list, int number, Resource active, Resource iss) {
    if (!list.isArray() || list.size() != 1) throw invalid("MISSION_EMPTY_OR_AMBIGUOUS");
    JsonNode n = list.get(0);
    var r = resource(n, Kind.NASA_MISSION);
    if (!r.slug().equals("expedition-" + number)
        || !r.title().equals("Expedition " + number)
        || !r.canonicalUrl()
            .equals(URI.create("https://www.nasa.gov/mission/expedition-" + number + "/")))
      throw invalid("EXPEDITION_NUMBER_TITLE_SLUG_CONFLICT");
    if (!containsId(n.path("mission-status"), active.wpId())
        || !containsId(n.path("mission-target"), iss.wpId()))
      throw invalid("MISSION_STATUS_TARGET_CONFLICT");
    return n;
  }

  private boolean containsId(JsonNode a, long id) {
    if (!a.isArray() || a.size() > 100) return false;
    for (var n : a) if (n.isIntegralNumber() && n.asLong() == id) return true;
    return false;
  }

  public Roster roster(JsonNode n, int number) {
    var d = dom(n.path("content").path("rendered").asText());
    var station =
        d.select("h2").stream()
            .filter(h -> normalize(h.text()).equalsIgnoreCase("At the Station"))
            .toList();
    var listHeads =
        d.select("h2").stream()
            .filter(
                h ->
                    Set.of("crew", "crew members")
                        .contains(normalize(h.text()).toLowerCase(Locale.ROOT)))
            .toList();
    if (listHeads.size() != 1 || station.size() > 1)
      throw invalid("ROSTER_HEADING_UNKNOWN_OR_AMBIGUOUS");
    var lines = lines(listHeads.getFirst());
    var cards = new ArrayList<Mention>();
    if (!station.isEmpty()) {
      Element scope = station.getFirst().parent();
      while (scope != null && (scope.select("h3").isEmpty() || scope.select("img").isEmpty()))
        scope = scope.parent();
      if (scope == null) throw invalid("CARD_SCOPE_UNKNOWN");
      for (var h : scope.select("h3")) {
        Element card = h.parent();
        while (card != null
            && (card.select("h3").size() != 1
                || portrait(card) == null
                || card.select("p").isEmpty())) card = card.parent();
        if (card == null) throw invalid("CARD_BOUNDARY_UNKNOWN");
        String text = bounded(String.join(" ", card.select("p").eachText()), 1000);
        var m = CARD_ROLE.matcher(text);
        if (!m.find() || Integer.parseInt(m.group(1)) != number) throw invalid("CARD_ROLE_UNKNOWN");
        cards.add(
            mention(
                h.text(), text, card, "At the Station", "At the Station/h3[" + cards.size() + "]"));
      }
      unique(cards);
      if (!names(cards).equals(names(lines))) throw invalid("ROSTER_SECTION_SET_CONFLICT");
    } else if (d.select("h3").stream().anyMatch(this::unscopedCard))
      throw invalid("UNKNOWN_CARD_HEADING");
    var members = new ArrayList<Member>();
    var allConflicts = new ArrayList<String>();
    for (var line : lines) {
      var mentions = new ArrayList<Mention>();
      mentions.add(line);
      var conflicts = new ArrayList<String>();
      var card =
          cards.stream()
              .filter(c -> normalize(c.name()).equalsIgnoreCase(normalize(line.name())))
              .findFirst();
      String agency = null;
      if (card.isPresent()) {
        var c = card.get();
        mentions.add(c);
        agency = c.agency();
        if (!normalize(c.role())
            .toLowerCase(Locale.ROOT)
            .endsWith(normalize(line.role()).toLowerCase(Locale.ROOT)))
          conflicts.add("ROLE_BETWEEN_SECTIONS");
        String ca = agency(c.caption());
        if (ca != null && c.agency() != null && !ca.equals(c.agency()))
          conflicts.add("AGENCY_CARD_CAPTION");
      }
      allConflicts.addAll(conflicts.stream().map(c -> line.name() + ":" + c).toList());
      members.add(
          new Member(members.size(), line.name(), line.role(), agency, mentions, conflicts));
    }
    return new Roster(number, members, allConflicts);
  }

  private List<Mention> lines(Element h) {
    var rows = new ArrayList<Mention>();
    for (Element e = h.nextElementSibling();
        e != null && !Set.of("h1", "h2").contains(e.tagName());
        e = e.nextElementSibling()) {
      if (!e.tagName().equals("p")) continue;
      for (String html : e.html().split("(?i)<br\\s*/?>")) {
        var line = dom(html);
        String text = normalize(line.text());
        var m = LINE.matcher(text);
        if (m.matches())
          rows.add(
              mention(
                  m.group(1),
                  m.group(2),
                  line,
                  "Crew Members",
                  "Crew Members/br[" + rows.size() + "]"));
        else if (!text.isEmpty()) throw invalid("UNKNOWN_CREW_LINE");
      }
    }
    unique(rows);
    return rows;
  }

  private boolean unscopedCard(Element h) {
    for (Element p = h.parent(); p != null && p.select("h3").size() == 1; p = p.parent())
      if (portrait(p) != null
          && p.select("p").stream().anyMatch(e -> CARD_ROLE.matcher(e.text()).find())) return true;
    return false;
  }

  private static Element portrait(Element e) {
    return e.select("img[src]").stream()
        .filter(i -> !i.attr("src").toLowerCase(Locale.ROOT).matches(".*\\.svg(?:\\?.*)?$"))
        .findFirst()
        .orElse(null);
  }

  private Mention mention(String name, String role, Element e, String section, String locator) {
    var links =
        e.select("a[href]").stream()
            .map(a -> new Link(bounded(a.text(), 200), bounded(a.attr("href"), 2000)))
            .distinct()
            .toList();
    if (links.size() > 20) throw invalid("MEMBER_LINK_BOUND");
    var img = portrait(e);
    String caption = img == null ? null : bounded(img.attr("alt"), 2000);
    String nm = bounded(name, 200);
    boolean personal =
        caption != null
            && Pattern.compile("(?iu)(?<!\\p{L})" + Pattern.quote(nm) + "(?!\\p{L})")
                .matcher(caption)
                .find()
            && Pattern.compile("(?i)Crew[- ]\\d+").matcher(caption).find();
    return new Mention(
        section,
        locator,
        nm,
        bounded(role, 1000),
        agency(role),
        img == null ? null : bounded(img.attr("src"), 2000),
        caption,
        personal ? CaptionKind.PERSONAL_FLIGHT_CAPTION : CaptionKind.GENERIC_ROLE_TEXT,
        links);
  }

  private static String agency(String text) {
    if (text == null) return null;
    var m = Pattern.compile("(?i)\\b(NASA|Roscosmos|ESA|CSA|JAXA)\\b").matcher(text);
    return m.find()
        ? m.group(1).equalsIgnoreCase("Roscosmos")
            ? "Roscosmos"
            : m.group(1).toUpperCase(Locale.ROOT)
        : null;
  }

  private Set<String> names(List<Mention> mentions) {
    var set = new HashSet<String>();
    mentions.forEach(m -> set.add(normalize(m.name()).toLowerCase(Locale.ROOT)));
    return set;
  }

  private void unique(List<Mention> rows) {
    if (rows.isEmpty() || rows.size() > 30 || names(rows).size() != rows.size())
      throw invalid("EMPTY_DUPLICATE_OR_OVERSIZE_ROSTER");
  }

  public boolean about(Resource resource, String subject) {
    String t =
        normalize(resource.title())
            .toLowerCase(Locale.ROOT)
            .replaceAll("[,.:]", " ")
            .replaceAll("(?U)\\s+", " ")
            .trim();
    t =
        t.replaceFirst("^nasa astronaut ", "")
            .replaceFirst("^astronaut ", "")
            .replaceFirst(" ph d nasa astronaut$", "")
            .replaceFirst(" nasa astronaut$", "")
            .replaceFirst(" ph d$", "");
    return t.equals(normalize(subject).toLowerCase(Locale.ROOT));
  }

  public URI biography(JsonNode topic) {
    var d = dom(topic.path("content").path("rendered").asText());
    var links =
        d.select("a[href]").stream()
            .filter(a -> Pattern.compile("(?i)\\bBiography\\b").matcher(normalize(a.text())).find())
            .map(a -> nasaUrl(a.attr("href")))
            .filter(u -> u.getPath().startsWith("/people/"))
            .distinct()
            .toList();
    if (links.size() > 1) throw invalid("AMBIGUOUS_BIOGRAPHY");
    return links.isEmpty() ? null : links.getFirst();
  }

  public static IllegalArgumentException invalid(String code) {
    return new IllegalArgumentException(code);
  }
}
