package org.mission1.orbital.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.mission1.orbital.oem.NasaOemDocument;
import org.mission1.orbital.oem.NasaOemRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcNasaOemRepository implements NasaOemRepository {
    private final JdbcTemplate jdbc;
    public JdbcNasaOemRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public void store(NasaOemDocument document, byte[] xml, Instant retrievedAt, Instant httpLastModified) {
        jdbc.update("""
                INSERT INTO nasa_oem_ephemerides
                  (sha256, xml, creation_date, start_time, stop_time, last_retrieved_at, http_last_modified)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (sha256) DO UPDATE SET
                  last_retrieved_at = EXCLUDED.last_retrieved_at,
                  http_last_modified = EXCLUDED.http_last_modified
                """, document.sha256(), xml, utc(document.creationDate()), utc(document.startTime()),
                utc(document.stopTime()), utc(retrievedAt), utc(httpLastModified));
    }

    @Override
    public Optional<Stored> latest() {
        List<Stored> rows = jdbc.query("""
                SELECT xml, last_retrieved_at, http_last_modified FROM nasa_oem_ephemerides
                ORDER BY last_retrieved_at DESC, sha256 DESC LIMIT 1
                """, (rs, row) -> new Stored(rs.getBytes(1),
                        rs.getObject(2, OffsetDateTime.class).toInstant(),
                        rs.getObject(3, OffsetDateTime.class) == null ? null
                                : rs.getObject(3, OffsetDateTime.class).toInstant()));
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    private static OffsetDateTime utc(Instant value) {
        return value == null ? null : OffsetDateTime.ofInstant(value, ZoneOffset.UTC);
    }
}
