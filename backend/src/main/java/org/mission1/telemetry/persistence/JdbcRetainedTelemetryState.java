package org.mission1.telemetry.persistence;

import java.sql.*;
import java.time.*;
import javax.sql.DataSource;
import org.mission1.telemetry.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

/** Session ownership spans I/O, but all pacing writes commit before I/O (ADR-0025). */
public final class JdbcRetainedTelemetryState implements RetainedTelemetryState {
    private final JdbcTemplate jdbc;
    private final DataSource source;
    private final String version;
    public JdbcRetainedTelemetryState(JdbcTemplate jdbc,TelemetryCatalog catalog) {
        this.jdbc=jdbc;this.source=jdbc.getDataSource();this.version=catalog.version();
    }
    private static int key(String provider) {
        return switch(provider) {case "SENSEDATA" -> 1;case "ISS_LIVE" -> 2;default -> throw new IllegalArgumentException("Unknown retained provider");};
    }
    private static Duration backoff(Duration interval,Duration maximum,int failures) {
        return interval.multipliedBy(1L<<Math.min(20,failures)).compareTo(maximum)>0 ? maximum : interval.multipliedBy(1L<<Math.min(20,failures));
    }
    @Override public State initializeProvider(String provider,Instant now,Duration interval,Duration maximum) {
        key(provider);
        jdbc.update("""
                INSERT INTO telemetry_provider_state(provider,catalog_version,last_attempt_at,last_success_at,next_eligible_at,consecutive_failures,last_outcome)
                SELECT ?,?,b.attempted_at,CASE WHEN b.completed THEN b.attempted_at END,
                  coalesce(b.attempted_at+CASE WHEN b.completed THEN ? ELSE ? END * interval '1 millisecond',?),
                  CASE WHEN b.completed OR b.attempted_at IS NULL THEN 0 ELSE 1 END,
                  CASE WHEN b.completed THEN 'COMPLETED' WHEN b.attempted_at IS NOT NULL THEN 'INTERRUPTED' ELSE 'NEVER_ATTEMPTED' END
                FROM (SELECT 1) seed LEFT JOIN telemetry_bootstrap_state b ON b.provider=? AND b.catalog_version=?
                ON CONFLICT DO NOTHING
                """,provider,version,interval.toMillis(),backoff(interval,maximum,1).toMillis(),utc(now),provider,version);
        return providerState(provider);
    }
    @Override public State providerState(String provider) { return read(jdbc,provider); }
    private State read(JdbcTemplate connection,String provider) {
        return connection.queryForObject("""
                SELECT s.*,coalesce(b.completed,false) bootstrap_completed FROM telemetry_provider_state s
                LEFT JOIN telemetry_bootstrap_state b USING(provider,catalog_version)
                WHERE s.provider=? AND s.catalog_version=?
                """,(r,n) -> new State(provider,time(r,"last_attempt_at"),time(r,"last_success_at"),time(r,"next_eligible_at"),
                r.getInt("consecutive_failures"),r.getString("last_outcome"),r.getString("last_kind"),time(r,"scheduled_at"),time(r,"completed_at"),
                r.getBoolean("bootstrap_completed"),new Result(r.getInt("fetched"),r.getInt("mapped"),r.getInt("admitted"),r.getInt("duplicates"),
                r.getInt("rejected"),r.getInt("heads_advanced"),r.getInt("response_bytes"),r.getDouble("fetch_milliseconds"),r.getDouble("parse_milliseconds"),r.getDouble("database_milliseconds"))),provider,version);
    }
    @Override public Claim claimProvider(String provider,Instant scheduled,Instant now,Duration interval,Duration maximum,String kind) {
        Connection connection=null;boolean locked=false;
        try {
            connection=source.getConnection();
            var local=new JdbcTemplate(new SingleConnectionDataSource(connection,true));
            locked=Boolean.TRUE.equals(local.queryForObject("SELECT pg_try_advisory_lock(74310125,?)",Boolean.class,key(provider)));
            if (!locked || read(local,provider).nextEligibleAt().isAfter(now)) { release(connection,provider,locked);return null; }
            var previous=read(local,provider);int failures=Math.min(30,previous.consecutiveFailures()+1);
            local.update("""
                    UPDATE telemetry_provider_state SET last_attempt_at=?,next_eligible_at=?,consecutive_failures=?,last_outcome='IN_PROGRESS',
                    last_kind=?,scheduled_at=?,completed_at=NULL WHERE provider=? AND catalog_version=?
                    """,utc(now),utc(now.plus(backoff(interval,maximum,failures))),failures,kind,utc(scheduled),provider,version);
            if (!previous.bootstrapCompleted() && kind.equals("RETAINED_BOOTSTRAP")) local.update("""
                    INSERT INTO telemetry_bootstrap_state VALUES(?,?,?,false) ON CONFLICT(provider,catalog_version)
                    DO UPDATE SET attempted_at=EXCLUDED.attempted_at WHERE NOT telemetry_bootstrap_state.completed
                    """,provider,version,utc(now));
            final Connection owner=connection;
            return new Claim() {
                private boolean closed,completed;
                public void complete(Instant at,boolean success,Result result) {
                    if (closed || completed) throw new IllegalStateException("Closed/completed provider claim");
                    // Each statement autocommits. Bootstrap completion only after durable successful pacing.
                    local.update("""
                            UPDATE telemetry_provider_state SET last_success_at=CASE WHEN ? THEN ? ELSE last_success_at END,
                            next_eligible_at=?,consecutive_failures=?,last_outcome=?,completed_at=?,
                            fetched=?,mapped=?,admitted=?,duplicates=?,rejected=?,heads_advanced=?,response_bytes=?,
                            fetch_milliseconds=?,parse_milliseconds=?,database_milliseconds=? WHERE provider=? AND catalog_version=?
                            """,success,utc(at),utc(at.plus(success?interval:backoff(interval,maximum,failures))),success?0:failures,
                            success?"COMPLETED":"FAILED",utc(at),result.fetched(),result.mapped(),result.admitted(),result.duplicates(),result.rejected(),
                            result.headsAdvanced(),result.responseBytes(),result.fetchMilliseconds(),result.parseMilliseconds(),result.databaseMilliseconds(),provider,version);
                    if (success && kind.equals("RETAINED_BOOTSTRAP")) local.update("UPDATE telemetry_bootstrap_state SET completed=true WHERE provider=? AND catalog_version=?",provider,version);
                    completed=true;
                }
                public void close() { if (!closed) {closed=true;release(owner,provider,true);} }
            };
        } catch (SQLException | RuntimeException failure) {
            if (connection!=null) release(connection,provider,locked);
            throw new IllegalStateException("Cannot claim retained provider",failure);
        }
    }
    private static void release(Connection connection,String provider,boolean locked) {
        try {
            if (locked) try(var statement=connection.prepareStatement("SELECT pg_advisory_unlock(74310125,?)")) {statement.setInt(1,key(provider));statement.execute();}
        } catch(SQLException failure) {
            // Never return a possibly locked physical connection to a pool.
            try {connection.abort(Runnable::run);}catch(SQLException ignored) { }
        } finally {try {connection.close();}catch(SQLException ignored) { }}
    }
    private static OffsetDateTime utc(Instant at) { return at.atOffset(ZoneOffset.UTC); }
    private static Instant time(ResultSet r,String field) throws SQLException {var at=r.getObject(field,OffsetDateTime.class);return at==null?null:at.toInstant();}
}
