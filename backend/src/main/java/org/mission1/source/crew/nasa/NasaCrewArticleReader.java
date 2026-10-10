package org.mission1.source.crew.nasa;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.jsoup.Jsoup;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.w3c.dom.Element;

/** Reads identity/locators from already retained RSS bytes. No HTTP or semantic extraction. */
public final class NasaCrewArticleReader {
    public List<CrewSourceArticle> read(CrewSourceDocument source) {
        if (source.sourceType() != NasaSourceType.NASA_ISS_OPERATIONAL_FEED) return List.of();
        try {
            var f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            var doc = f.newDocumentBuilder().parse(new ByteArrayInputStream(source.body()));
            if (!doc.getDocumentElement().getTagName().equals("rss")) return List.of();
            var items = doc.getElementsByTagName("item");
            if (items.getLength() > 10) return List.of();
            var result = new ArrayList<CrewSourceArticle>();
            var identities = new HashSet<String>();
            for (int n = 0; n < items.getLength(); n++) {
                var item = (Element) items.item(n);
                String rawGuid = field(item, "guid"), rawUrl = field(item, "link");
                URI url = URI.create(rawUrl.trim());
                if (!"https".equals(url.getScheme()) || !"www.nasa.gov".equals(url.getHost())
                        || url.getUserInfo() != null || url.getPort() != -1
                        || !url.getPath().startsWith("/blogs/")) return List.of();
                var contents = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded");
                if (contents.getLength() != 1) return List.of();
                String content = contents.item(0).getTextContent();
                var paragraphs = Jsoup.parseBodyFragment(content).body().select("p");
                var scopes = new ArrayList<CrewSourceArticle.Paragraph>();
                for (int i = 0; i < paragraphs.size(); i++)
                    scopes.add(new CrewSourceArticle.Paragraph(i, paragraphs.get(i).text()));
                String key = stableKey(rawGuid.trim());
                if (key != null && !identities.add(key)) return List.of();
                result.add(new CrewSourceArticle(key, rawGuid, rawUrl, url,
                        ZonedDateTime.parse(field(item, "pubDate").trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant(),
                        CrewHttpReader.sha256(content.getBytes(java.nio.charset.StandardCharsets.UTF_8)), scopes));
            }
            return List.copyOf(result);
        } catch (Exception e) {
            // Unsupported legacy input stays unassociated; it cannot acquire a guessed source ID.
            return List.of();
        }
    }

    public static String stableKey(String guid) {
        // Exact shape observed and independently verified in the source investigation. GUID is opaque.
        var m = java.util.regex.Pattern.compile("https://www\\.nasa\\.gov/\\?post_type=nasa-blog&p=([1-9][0-9]*)").matcher(guid);
        return m.matches() ? "nasa.gov:wp:nasa-blog:" + m.group(1) : null;
    }

    private static String field(Element parent, String tag) {
        String value = null;
        for (var child = parent.getFirstChild(); child != null; child = child.getNextSibling())
            if (child instanceof Element e && tag.equals(e.getTagName())) {
                if (value != null) throw new IllegalArgumentException("Repeated source field");
                value = e.getTextContent();
            }
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing source field");
        return value;
    }
}
