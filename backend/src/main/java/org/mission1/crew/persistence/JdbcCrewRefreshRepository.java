package org.mission1.crew.persistence;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

import java.sql.*;
import java.time.*;
import java.util.*;

@Repository
public class JdbcCrewRefreshRepository implements CrewRefreshRepository {
    private final JdbcTemplate jdbc;
    private final JsonMapper json =
            JsonMapper.builder()
                    .addModule(new JavaTimeModule())
                    .disable(
                            com.fasterxml.jackson.databind.SerializationFeature
                                    .WRITE_DATES_AS_TIMESTAMPS)
                    .build();

    public JdbcCrewRefreshRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean withCoordinatorLock(Runnable work) {
        if (!Boolean.TRUE.equals(
                jdbc.queryForObject("SELECT pg_try_advisory_xact_lock(73491, 5)", Boolean.class)))
            return false;
        work.run();
        return true;
    }

    @Override
    public Optional<CatalogRun> latestCatalog() {
        return jdbc
                .query(
                        "SELECT * FROM crew_event_catalog_run ORDER BY started_at DESC,id DESC"
                            + " LIMIT 1",
                        (rs, n) ->
                                new CatalogRun(
                                        rs.getLong("id"),
                                        instant(rs, "started_at"),
                                        instant(rs, "retrieved_at"),
                                        rs.getString("result_state"),
                                        instant(rs, "retry_after_at"),
                                        List.<CrewRefreshPolicy.Candidate>of()))
                .stream()
                .findFirst()
                .map(
                        r ->
                                new CatalogRun(
                                        r.id(),
                                        r.startedAt(),
                                        r.retrievedAt(),
                                        r.result(),
                                        r.retryAfterAt(),
                                        jdbc.query(
                                                """
                                                SELECT o.id,o.payload::text FROM crew_event_catalog_observation l
                                                JOIN crew_operational_event_observation o ON o.id=l.observation_id
                                                WHERE l.catalog_run_id=? ORDER BY o.id
                                                """,
                                                (rs, n) ->
                                                        new CrewRefreshPolicy.Candidate(
                                                                rs.getLong(1),
                                                                decode(rs.getString(2))),
                                                r.id())));
    }

    @Override
    public Optional<Instant> lastCatalogAttempt() {
        return Optional.ofNullable(
                jdbc.queryForObject(
                        "SELECT max(started_at) AS at FROM crew_event_catalog_run",
                        (rs, n) -> instant(rs, "at")));
    }

    @Override
    public Instant ll2EligibleAt(Instant now, int budget) {
        var retry =
                jdbc.queryForObject(
                        """
                        SELECT max(at) AS at FROM (
                            SELECT retry_after_at AS at FROM crew_source_sync_run WHERE source='LAUNCH_LIBRARY_2'
                            UNION ALL SELECT retry_after_at AS at FROM crew_event_catalog_run
                        ) r
                        """,
                        (rs, n) -> instant(rs, "at"));
        var attempts =
                jdbc.query(
                        """
                        SELECT at FROM (
                            SELECT started_at AS at FROM crew_source_sync_run WHERE source='LAUNCH_LIBRARY_2'
                                AND result_state NOT LIKE 'SKIPPED_%'
                            UNION ALL SELECT started_at AS at FROM crew_event_catalog_run
                        ) r WHERE at > ? ORDER BY at
                        """,
                        (rs, n) -> instant(rs, "at"), utc(now.minus(Duration.ofHours(1))));
        Instant eligible = retry == null || retry.isBefore(now) ? now : retry;
        if (attempts.size() >= budget) {
            Instant quota = attempts.get(attempts.size() - budget).plus(Duration.ofHours(1));
            if (quota.isAfter(eligible)) eligible = quota;
        }
        return eligible;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long startCatalog(CrewEventSource.Request request, Instant at, long triggerId) {
        long id =
                jdbc.queryForObject(
                        """
                        INSERT INTO crew_event_catalog_run(started_at,source_url,coverage_from,coverage_until,result_state)
                        VALUES (?,?,?,?,'IN_PROGRESS') RETURNING id
                        """,
                        Long.class,
                        utc(at),
                        request.url().toString(),
                        utc(request.from()),
                        utc(request.until()));
        if (jdbc.update(
                        "UPDATE crew_refresh_trigger SET catalog_run_id=? WHERE id=? AND"
                            + " target='LL2_EVENT_CATALOG' AND catalog_run_id IS NULL",
                        id,
                        triggerId)
                != 1)
            throw new IllegalStateException("Unclaimed matching calendar trigger required");
        return id;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeCatalog(
            long run,
            CrewSourceResult<CrewEventSource.Catalog> result,
            Instant at,
            Instant retryAt) {
        var o = result.observation();
        var f = result.failure();
        boolean success = result.state() == CrewSourceState.AVAILABLE;
        if (success) {
            for (var event : result.value().events()) {
                String payload = encode(event),
                        hash =
                                CrewHttpReader.sha256(
                                        payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                var inserted =
                        jdbc.query(
                                """
                                INSERT INTO crew_operational_event_observation(external_id,semantic_hash,first_catalog_run_id,payload)
                                VALUES (?,?,?,?::jsonb) ON CONFLICT(source,station,external_id,semantic_hash) DO NOTHING RETURNING id
                                """,
                                (rs, n) -> rs.getLong(1),
                                event.externalId(),
                                hash,
                                run,
                                payload);
                long id =
                        inserted.isEmpty()
                                ? jdbc.queryForObject(
                                        "SELECT id FROM crew_operational_event_observation WHERE"
                                            + " external_id=? AND semantic_hash=?",
                                        Long.class,
                                        event.externalId(),
                                        hash)
                                : inserted.getFirst();
                jdbc.update(
                        "INSERT INTO crew_event_catalog_observation(catalog_run_id,observation_id)"
                            + " VALUES (?,?)",
                        run,
                        id);
            }
        }
        int n =
                jdbc.update(
                        """
                        UPDATE crew_event_catalog_run SET completed_at=?,result_state=?,source_state=?,http_status=?,retrieved_at=?,
                            content_hash=?,body=?,source_api_version=?,adapter_version=?,http_etag=?,http_last_modified=?,
                            retry_after=?,retry_after_at=?,error_code=? WHERE id=? AND result_state='IN_PROGRESS'
                        """,
                        utc(at),
                        success ? "SUCCESS" : "FAILURE",
                        result.state().name(),
                        result.httpStatus(),
                        o == null ? null : utc(o.retrievedAt()),
                        o == null ? null : o.contentHash(),
                        success ? result.value().body() : null,
                        o == null ? null : o.sourceVersion(),
                        o == null ? null : o.adapterVersion(),
                        o == null ? null : o.httpEtag(),
                        o == null ? null : o.httpLastModified(),
                        f == null ? null : f.retryAfter(),
                        utc(retryAt),
                        f == null ? null : f.code().name(),
                        run);
        if (n != 1) throw new IllegalStateException("Calendar run already completed");
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failCatalog(
            long id,
            Instant at,
            String code,
            CrewSourceResult<CrewEventSource.Catalog> fetched,
            Instant retryAt) {
        var o = fetched == null ? null : fetched.observation();
        var f = fetched == null ? null : fetched.failure();
        if (jdbc.update(
                        """
                        UPDATE crew_event_catalog_run SET completed_at=?,result_state='FAILURE',error_code=?,source_state=?,
                            http_status=?,retrieved_at=?,content_hash=?,body=?,source_api_version=?,adapter_version=?,
                            http_etag=?,http_last_modified=?,retry_after=?,retry_after_at=? WHERE id=? AND result_state='IN_PROGRESS'
                        """,
                        utc(at),
                        code,
                        fetched == null ? null : fetched.state().name(),
                        fetched == null ? null : fetched.httpStatus(),
                        o == null ? null : utc(o.retrievedAt()),
                        o == null ? null : o.contentHash(),
                        fetched == null || fetched.value() == null ? null : fetched.value().body(),
                        o == null ? null : o.sourceVersion(),
                        o == null ? null : o.adapterVersion(),
                        o == null ? null : o.httpEtag(),
                        o == null ? null : o.httpLastModified(),
                        f == null ? null : f.retryAfter(),
                        utc(retryAt),
                        id)
                != 1) throw new IllegalStateException("Calendar run already completed");
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long trigger(String key, CrewRefreshPolicy.Decision d, Instant at) {
        var ids =
                jdbc.query(
                        """
                        INSERT INTO crew_refresh_trigger(dedupe_key,target,reason,created_at,eligible_at,event_observation_id,evidence_id,follow_up_id)
                        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id
                        """,
                        (rs, n) -> rs.getLong(1),
                        key,
                        d.target().name(),
                        d.reason().name(),
                        utc(at),
                        utc(d.eligibleAt()),
                        d.eventObservationId(),
                        d.evidenceId(),
                        d.followUpId());
        return ids.isEmpty()
                ? jdbc.queryForObject(
                        "SELECT id FROM crew_refresh_trigger WHERE dedupe_key=?", Long.class, key)
                : ids.getFirst();
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void openFollowUp(long evidence, Instant context, Instant deadline, Instant at) {
        jdbc.update(
                "INSERT INTO"
                    + " crew_refresh_follow_up(evidence_id,created_at,context_at,deadline,state)"
                    + " VALUES (?,?,?,?,'OPEN') ON CONFLICT(evidence_id) DO NOTHING",
                evidence,
                utc(at),
                utc(context),
                utc(deadline));
    }

    @Override
    public List<CrewRefreshPolicy.FollowUp> followUps() {
        return jdbc.query(
                """
                SELECT f.*,(SELECT count(*) FROM crew_refresh_trigger t JOIN crew_source_sync_run r ON r.id=t.source_sync_run_id
                    WHERE t.follow_up_id=f.id AND r.result_state NOT LIKE 'SKIPPED_%') AS attempts
                FROM crew_refresh_follow_up f ORDER BY f.deadline,f.id
                """,
                (rs, n) ->
                        new CrewRefreshPolicy.FollowUp(
                                rs.getLong("id"),
                                rs.getLong("evidence_id"),
                                instant(rs, "context_at"),
                                instant(rs, "deadline"),
                                rs.getString("state"),
                                rs.getInt("attempts")));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void closeFollowUp(long id, String state, Instant at) {
        jdbc.update(
                "UPDATE crew_refresh_follow_up SET state=?,closed_at=? WHERE id=? AND state='OPEN'",
                state,
                utc(at),
                id);
    }

    private String encode(CrewOperationalEvent event) {
        try {
            return json.writeValueAsString(event);
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("Event encoding failed", e);
        }
    }

    private CrewOperationalEvent decode(String payload) {
        try {
            return json.readValue(payload, CrewOperationalEvent.class);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Stored event invalid", e);
        }
    }

    private static OffsetDateTime utc(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var t = rs.getObject(column, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }
}
