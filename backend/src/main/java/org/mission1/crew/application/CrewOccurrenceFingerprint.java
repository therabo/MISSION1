package org.mission1.crew.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;

/** Versioned canonical JSON fingerprints matching the external investigation's candidate algorithm. */
public final class CrewOccurrenceFingerprint {
    private static final ObjectMapper JSON = new ObjectMapper().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    private CrewOccurrenceFingerprint() {}
    public static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFC)
                .replaceAll("(?U)[\\s\\p{Z}\\u2000-\\u200f]+", " ").trim();
    }
    public static String hash(Object value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(JSON.writeValueAsString(value).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalArgumentException("Cannot fingerprint source scope", e); }
    }
}
