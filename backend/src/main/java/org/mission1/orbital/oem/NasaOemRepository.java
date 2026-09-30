package org.mission1.orbital.oem;

import java.time.Instant;
import java.util.Optional;

public interface NasaOemRepository {
    record Stored(byte[] xml, Instant retrievedAt, Instant httpLastModified) { }
    void store(NasaOemDocument document, byte[] xml, Instant retrievedAt, Instant httpLastModified);
    Optional<Stored> latest();
}
