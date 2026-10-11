package org.mission1.crew.operational;

import java.io.ByteArrayInputStream;
import java.util.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.mission1.source.crew.nasa.NasaEditorialParser;
import org.w3c.dom.Element;

/** Reopens only the exact retained article/paragraph. Ambiguous DOM scopes fail closed. */
public final class OperationalSubjectScope {
  public record Scope(String title, String html, boolean complete) {}

  public static Scope read(byte[] body, String article, String excerpt, String name) {
    try {
      var f = DocumentBuilderFactory.newInstance();
      f.setNamespaceAware(true);
      f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      f.setFeature("http://xml.org/sax/features/external-general-entities", false);
      f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
      f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
      f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
      f.setAttribute("http://www.oracle.com/xml/jaxp/properties/maxElementDepth", "100");
      var doc = f.newDocumentBuilder().parse(new ByteArrayInputStream(body));
      var items = doc.getElementsByTagName("item");
      if (items.getLength() > 10) return new Scope("", "", false);
      var matches = new ArrayList<Scope>();
      for (int i = 0; i < items.getLength(); i++) {
        var item = (Element) items.item(i);
        var urls = item.getElementsByTagName("link");
        if (urls.getLength() != 1 || !article.equals(urls.item(0).getTextContent().strip()))
          continue;
        var contents =
            item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded");
        var titles = item.getElementsByTagName("title");
        if (contents.getLength() != 1 || titles.getLength() != 1) continue;
        var ps =
            NasaEditorialParser.dom(contents.item(0).getTextContent()).select("p").stream()
                .filter(
                    p ->
                        OperationalNames.normalize(p.text())
                            .contains(OperationalNames.normalize(name)))
                .filter(
                    p -> {
                      String a = OperationalNames.normalize(p.text()),
                          b = OperationalNames.normalize(excerpt);
                      return a.equals(b) || b.length() > 100 && a.startsWith(b);
                    })
                .toList();
        if (ps.size() == 1)
          matches.add(new Scope(titles.item(0).getTextContent(), ps.getFirst().outerHtml(), true));
      }
      return matches.size() == 1 ? matches.getFirst() : new Scope("", "", false);
    } catch (Exception e) {
      return new Scope("", "", false);
    }
  }
}
