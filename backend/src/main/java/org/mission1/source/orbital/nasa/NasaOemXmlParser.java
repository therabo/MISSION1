package org.mission1.source.orbital.nasa;

import java.io.ByteArrayInputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.hipparchus.geometry.euclidean.threed.Vector3D;
import org.mission1.orbital.oem.NasaOemDocument;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Strict, entity-disabled parser for NASA's CCSDS OEM XML presentation. */
public final class NasaOemXmlParser {
    private static final DateTimeFormatter ORDINAL_UTC = new DateTimeFormatterBuilder()
            .appendPattern("uuuu-DDD'T'HH:mm:ss")
            .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
            .appendOffsetId().toFormatter();
    public static final int MAX_BYTES = 5_000_000;

    public NasaOemDocument parse(byte[] xml) {
        if (xml == null || xml.length == 0 || xml.length > MAX_BYTES) throw new IllegalArgumentException("OEM XML size invalid");
        try {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var root = factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml)).getDocumentElement();
            if (!"ndm".equals(root.getTagName())) throw new IllegalArgumentException("Not an OEM NDM document");
            Element oem = only(root, "oem");
            if (!"2.0".equals(oem.getAttribute("version"))) throw new IllegalArgumentException("Unsupported OEM version");
            Element header = only(oem, "header");
            if (!"JSC".equals(value(header, "ORIGINATOR"))) throw new IllegalArgumentException("Unexpected OEM originator");
            Instant creation = epoch(value(header, "CREATION_DATE"));
            Element segment = only(only(oem, "body"), "segment");
            Element metadata = only(segment, "metadata");
            require(metadata, "OBJECT_NAME", "ISS");
            require(metadata, "OBJECT_ID", "1998-067-A");
            require(metadata, "CENTER_NAME", "EARTH");
            require(metadata, "REF_FRAME", "EME2000");
            require(metadata, "TIME_SYSTEM", "UTC");
            Instant start = epoch(value(metadata, "START_TIME"));
            Instant stop = epoch(value(metadata, "STOP_TIME"));
            if (!start.isBefore(stop)) throw new IllegalArgumentException("OEM span invalid");
            NodeList nodes = only(segment, "data").getElementsByTagName("stateVector");
            if (nodes.getLength() < 2 || nodes.getLength() > 100_000) throw new IllegalArgumentException("OEM vector count invalid");
            List<NasaOemDocument.StateVector> vectors = new ArrayList<>(nodes.getLength());
            for (int i = 0; i < nodes.getLength(); i++) {
                Element node = (Element) nodes.item(i);
                Instant time = epoch(value(node, "EPOCH"));
                if (time.isBefore(start) || time.isAfter(stop) ||
                        (!vectors.isEmpty() && !time.isAfter(vectors.getLast().epoch()))) {
                    throw new IllegalArgumentException("OEM vector epochs invalid");
                }
                Vector3D position = new Vector3D(component(node, "X", "km", 1000),
                        component(node, "Y", "km", 1000), component(node, "Z", "km", 1000));
                Vector3D velocity = new Vector3D(component(node, "X_DOT", "km/s", 1000),
                        component(node, "Y_DOT", "km/s", 1000), component(node, "Z_DOT", "km/s", 1000));
                if (position.getNorm() < 6_000_000 || position.getNorm() > 10_000_000 ||
                        velocity.getNorm() < 6_000 || velocity.getNorm() > 9_000) {
                    throw new IllegalArgumentException("Implausible ISS OEM vector");
                }
                vectors.add(new NasaOemDocument.StateVector(time, position, velocity));
            }
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(xml));
            return new NasaOemDocument(creation, start, stop, List.copyOf(vectors), hash);
        } catch (IllegalArgumentException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IllegalArgumentException("Invalid NASA OEM XML", failure);
        }
    }

    private static Element only(Element parent, String name) {
        NodeList nodes = parent.getElementsByTagName(name);
        if (nodes.getLength() != 1) throw new IllegalArgumentException("Expected one " + name);
        return (Element) nodes.item(0);
    }

    private static String value(Element parent, String name) { return only(parent, name).getTextContent().trim(); }
    private static void require(Element parent, String name, String expected) {
        if (!expected.equalsIgnoreCase(value(parent, name))) throw new IllegalArgumentException("Unsupported OEM " + name);
    }
    private static Instant epoch(String text) {
        // NASA currently publishes ordinal-year UTC timestamps (YYYY-DDD) in this XML.
        return OffsetDateTime.parse(text, ORDINAL_UTC).toInstant();
    }
    private static double component(Element parent, String name, String unit, double factor) {
        Element element = only(parent, name);
        if (!unit.equals(element.getAttribute("units"))) throw new IllegalArgumentException("Unexpected OEM unit: " + name);
        double value = Double.parseDouble(element.getTextContent().trim()) * factor;
        if (!Double.isFinite(value)) throw new IllegalArgumentException("Nonfinite OEM component");
        return value;
    }
}
