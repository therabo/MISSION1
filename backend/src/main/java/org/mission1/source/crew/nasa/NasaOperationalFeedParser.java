package org.mission1.source.crew.nasa;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.mission1.crew.application.CrewPresenceVerificationSource;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.w3c.dom.Element;

/** Official RSS container, bounded bootstrap and full-content DOM extraction. */
public final class NasaOperationalFeedParser implements CrewPresenceVerificationSource {
  public static final String NAME = "NasaOperationalFeedParser", VERSION = "1.2.0";
  public static final Duration WINDOW = Duration.ofDays(14);
  private final NasaOperationalPostParser posts = new NasaOperationalPostParser();

  @Override
  public CrewSourceResult<List<CrewVerificationEvidence>> verify(CrewSourceDocument document) {
    try {
      if (document.body().length == 0 || document.body().length > CrewHttpReader.MAX_BYTES)
        throw new IllegalArgumentException("Feed body bound");
      return new CrewSourceResult<>(
          CrewSourceState.AVAILABLE, parse(document), document.observation(), null, 200);
    } catch (Exception e) {
      return CrewHttpReader.failed(
          CrewSourceState.MALFORMED_RESPONSE,
          CrewSourceResult.FailureCode.INVALID_RESPONSE,
          200,
          null,
          document.observation());
    }
  }

  private List<CrewVerificationEvidence> parse(CrewSourceDocument source) throws Exception {
    if (source.sourceType() != NasaSourceType.NASA_ISS_OPERATIONAL_FEED)
      throw new IllegalArgumentException("RSS required");
    var f = DocumentBuilderFactory.newInstance();
    f.setNamespaceAware(true);
    f.setAttribute("http://www.oracle.com/xml/jaxp/properties/maxElementDepth", "100");
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setFeature("http://xml.org/sax/features/external-general-entities", false);
    f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
    var doc = f.newDocumentBuilder().parse(new ByteArrayInputStream(source.body()));
    if (!doc.getDocumentElement().getTagName().equals("rss"))
      throw new IllegalArgumentException("RSS anchor absent");
    var channels = doc.getElementsByTagName("channel");
    if (channels.getLength() != 1) throw new IllegalArgumentException("One channel required");
    var channel = (Element) channels.item(0);
    if (!text(channel, "title").equals("International Space Station - NASA"))
      throw new IllegalArgumentException("Station channel absent");
    var items = channel.getElementsByTagName("item");
    if (items.getLength() == 0 || items.getLength() > 10)
      throw new IllegalArgumentException("Bounded feed anchors absent");
    Set<String> guids = new HashSet<>();
    var result = new ArrayList<CrewVerificationEvidence>();
    for (int i = 0; i < items.getLength(); i++) {
      var item = (Element) items.item(i);
      String guid = text(item, "guid");
      if (!guids.add(guid)) throw new IllegalArgumentException("Duplicate RSS identity");
      URI url = URI.create(text(item, "link"));
      if (!"https".equals(url.getScheme())
          || !"www.nasa.gov".equals(url.getHost())
          || url.getUserInfo() != null
          || url.getPort() != -1
          || !url.getPath().startsWith("/blogs/"))
        throw new IllegalArgumentException("Official item required");
      Instant published =
          ZonedDateTime.parse(text(item, "pubDate"), DateTimeFormatter.RFC_1123_DATE_TIME)
              .toInstant();
      var o = source.observation();
      if (published.isAfter(o.retrievedAt()))
        throw new IllegalArgumentException("Future publication");
      if (published.isBefore(o.retrievedAt().minus(WINDOW))) continue;
      var content =
          item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded");
      if (content.getLength() != 1 || content.item(0).getTextContent().isBlank())
        throw new IllegalArgumentException("Full content required");
      var assertion =
          new CrewSourceObservation(
              CrewSource.NASA_OFFICIAL,
              url,
              o.retrievedAt(),
              published,
              null,
              o.httpEtag(),
              o.httpLastModified(),
              o.contentHash(),
              "NASA_RSS",
              NAME + "/" + VERSION);
      result.addAll(posts.parse(text(item, "title"), content.item(0).getTextContent(), assertion));
    }
    return List.copyOf(
        result); // A valid feed may contain no presence facts. Never interpreted as zero
    // crew.
  }

  private static String text(Element e, String tag) {
    String value = null;
    for (var child = e.getFirstChild(); child != null; child = child.getNextSibling()) {
      if (child instanceof Element element && element.getTagName().equals(tag)) {
        if (value != null) throw new IllegalArgumentException("Duplicate RSS field: " + tag);
        value = element.getTextContent().trim();
      }
    }
    if (value == null || value.isBlank())
      throw new IllegalArgumentException("Required RSS field absent: " + tag);
    return value;
  }
}
