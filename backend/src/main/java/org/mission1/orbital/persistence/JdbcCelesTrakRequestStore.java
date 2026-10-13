package org.mission1.orbital.persistence;

import java.time.Instant;
import java.time.ZoneOffset;
import org.mission1.orbital.application.CelesTrakRequestStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcCelesTrakRequestStore implements CelesTrakRequestStore {
    private final JdbcTemplate jdbc;

    public JdbcCelesTrakRequestStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override public State state() {
        return jdbc.queryForObject("SELECT next_eligible_at,suspended FROM celestrak_request_state WHERE singleton",
                (rs, row) -> new State(rs.getObject(1, java.time.OffsetDateTime.class).toInstant(), rs.getBoolean(2)));
    }

    @Override public boolean reserve(Instant at, Instant nextEligibleAt) {
        // Round UP to PostgreSQL precision; nanoseconds must never permit an early request.
        Instant deadline = nextEligibleAt.getNano() % 1000 == 0 ? nextEligibleAt
                : nextEligibleAt.plusNanos(1000 - nextEligibleAt.getNano() % 1000);
        return jdbc.update("""
                UPDATE celestrak_request_state SET next_eligible_at=?
                WHERE singleton AND NOT suspended AND next_eligible_at<=?
                """, deadline.atOffset(ZoneOffset.UTC),
                at.truncatedTo(java.time.temporal.ChronoUnit.MICROS).atOffset(ZoneOffset.UTC)) == 1;
    }

    @Override public void suspend() {
        jdbc.update("UPDATE celestrak_request_state SET suspended=true WHERE singleton");
    }
}
