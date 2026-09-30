package org.mission1.source.orbital.nasa;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;

/** Recorded NASA XML excerpt from 2026-09-30, for offline contract tests only. */
class NasaOemXmlParserTest {
    private final NasaOemXmlParser parser = new NasaOemXmlParser();

    @Test void verifiesMetadataUnitsEpochsAndSiConversion() throws IOException {
        var document = parser.parse(fixture());
        assertEquals(Instant.parse("2026-09-28T17:13:16.701Z"), document.creationDate());
        assertEquals(45, document.vectors().size());
        assertEquals(Instant.parse("2026-09-30T09:02:00Z"), document.vectors().getFirst().epoch());
        assertTrue(document.vectors().getFirst().positionMeters().getNorm() > 6_000_000);
        assertTrue(document.vectors().getFirst().velocityMetersPerSecond().getNorm() > 6_000);
        assertEquals(64, document.sha256().length());
    }

    @Test void rejectsUnexpectedFrameOrUnitAndXmlEntities() throws IOException {
        String xml = new String(fixture(), StandardCharsets.UTF_8);
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse(xml.replace("<REF_FRAME>EME2000</REF_FRAME>", "<REF_FRAME>TEME</REF_FRAME>").getBytes(StandardCharsets.UTF_8)));
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse(xml.replace("units=\"km\"", "units=\"m\"").getBytes(StandardCharsets.UTF_8)));
        assertThrows(IllegalArgumentException.class,
                () -> parser.parse(("<!DOCTYPE ndm [<!ENTITY x SYSTEM \"file:///etc/passwd\">]>" + xml).getBytes(StandardCharsets.UTF_8)));
    }

    private byte[] fixture() throws IOException {
        try (var stream = getClass().getResourceAsStream("/nasa-oem-2026-09-30-excerpt.xml")) {
            assertNotNull(stream);
            return stream.readAllBytes();
        }
    }
}
