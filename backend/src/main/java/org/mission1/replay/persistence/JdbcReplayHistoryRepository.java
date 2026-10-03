package org.mission1.replay.persistence;

import org.mission1.replay.ReplayHistoryRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.*;
import java.time.*;
import java.util.*;

@Repository
public class JdbcReplayHistoryRepository implements ReplayHistoryRepository {
    private final JdbcTemplate jdbc;

    public JdbcReplayHistoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Structured> structured() {
        return jdbc.query(
                """
SELECT id, retrieved_at, source_state FROM crew_source_sync_run
WHERE source='LAUNCH_LIBRARY_2' AND station='ISS' AND retrieved_at IS NOT NULL
  AND (result_state='SUCCESS' OR (result_state='SOURCE_RESULT' AND source_state='NO_ACTIVE_EXPEDITION'))
ORDER BY retrieved_at, content_hash, id
""",
                (r, n) ->
                        new Structured(
                                r.getLong("id"),
                                time(r, "retrieved_at"),
                                "NO_ACTIVE_EXPEDITION".equals(r.getString("source_state"))));
    }

    public List<Oem> oem() {
        return jdbc.query(
                "SELECT sha256, creation_date, start_time, stop_time, last_retrieved_at,"
                    + " http_last_modified FROM nasa_oem_ephemerides ORDER BY creation_date,"
                    + " sha256",
                (r, n) ->
                        new Oem(
                                r.getString("sha256"),
                                time(r, "creation_date"),
                                time(r, "start_time"),
                                time(r, "stop_time"),
                                time(r, "last_retrieved_at"),
                                r.getString("http_last_modified")));
    }

    public byte[] oemBody(String hash) {
        return jdbc.queryForObject(
                "SELECT xml FROM nasa_oem_ephemerides WHERE sha256=?", byte[].class, hash);
    }

    private static Instant time(ResultSet r, String name) throws SQLException {
        return r.getObject(name, OffsetDateTime.class).toInstant();
    }
}
