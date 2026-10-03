package org.mission1.crew.persistence;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL/JDBC history adapter. See ADR-0008 for transaction and immutability decisions. */
@Repository
public class JdbcCrewRepository implements CrewRepository {
    private final JdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    public JdbcCrewRepository(JdbcTemplate jdbc) { this.jdbc = Objects.requireNonNull(jdbc); }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long startRun(CrewSource source, Station station, Instant startedAt, URI sourceUrl) {
        return jdbc.queryForObject("""
                INSERT INTO crew_source_sync_run (source, station, started_at, source_url, result_state)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, source.name(), station.name(), utc(startedAt), sourceUrl.toString());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeRun(long id, Completion completion) {
        if (completion.outcome() == CrewSyncRun.Outcome.SUCCESS || completion.outcome() == CrewSyncRun.Outcome.IN_PROGRESS)
            throw new IllegalArgumentException("Use atomic graph operation for success");
        complete(id, completion, null);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public StoreResult storeSuccessfulRun(long runId, CrewSourceSnapshot snapshot, Completion completion) {
        CrewSnapshotValidator.validate(snapshot);
        if (completion.outcome() != CrewSyncRun.Outcome.SUCCESS || completion.sourceState() != CrewSourceState.AVAILABLE
                || !snapshot.observation().equals(completion.observation()))
            throw new IllegalArgumentException("Matching successful observation required");
        // Serialize identity allocation by database writers; this is not scheduler ownership across nodes.
        jdbc.execute("SELECT pg_advisory_xact_lock(73491, 1)");
        var o = snapshot.observation();
        List<Long> ids = jdbc.query("""
                INSERT INTO crew_source_snapshot
                    (source, station, source_api_version, adapter_version, source_station_external_id,
                     content_hash, first_observed_at, source_url, source_published_at, source_event_at,
                     http_etag, http_last_modified, total_active_expeditions, candidates_complete)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (source, station, source_station_external_id, source_api_version, adapter_version, content_hash)
                DO NOTHING RETURNING id
                """, (rs, n) -> rs.getLong(1), o.source().name(), snapshot.station().name(), o.sourceVersion(),
                o.adapterVersion(), snapshot.sourceStationExternalId(), o.contentHash(), utc(o.retrievedAt()),
                o.sourceUrl().toString(), utc(o.sourcePublishedAt()), utc(o.sourceEventAt()), o.httpEtag(),
                o.httpLastModified(), snapshot.totalActiveExpeditions(), snapshot.candidatesComplete());
        boolean inserted = !ids.isEmpty();
        long id = inserted ? ids.getFirst() : jdbc.queryForObject("""
                SELECT id FROM crew_source_snapshot WHERE source = ? AND station = ? AND source_station_external_id = ?
                AND source_api_version = ? AND adapter_version = ? AND content_hash = ?
                """, Long.class, o.source().name(), snapshot.station().name(), snapshot.sourceStationExternalId(),
                o.sourceVersion(), o.adapterVersion(), o.contentHash());
        if (inserted) storeGraph(id, snapshot);
        complete(runId, completion, id);
        return new StoreResult(id, inserted);
    }

    private void complete(long id, Completion c, Long snapshotId) {
        var o = c.observation();
        int changed = jdbc.update("""
                UPDATE crew_source_sync_run SET completed_at = ?, result_state = ?, source_state = ?,
                    http_status = ?, retrieved_at = ?, source_published_at = ?, source_event_at = ?,
                    http_etag = ?, http_last_modified = ?, source_api_version = ?, adapter_version = ?,
                    content_hash = ?, retry_after = ?, retry_after_at = ?, error_code = ?, error_summary = ?, snapshot_id = ?
                WHERE id = ? AND result_state = 'IN_PROGRESS'
                """, utc(c.completedAt()), c.outcome().name(), name(c.sourceState()), c.httpStatus(),
                o == null ? null : utc(o.retrievedAt()), o == null ? null : utc(o.sourcePublishedAt()),
                o == null ? null : utc(o.sourceEventAt()), o == null ? null : o.httpEtag(),
                o == null ? null : o.httpLastModified(), o == null ? null : o.sourceVersion(),
                o == null ? null : o.adapterVersion(), o == null ? null : o.contentHash(), c.retryAfter(),
                utc(c.retryAfterAt()), c.errorCode(), c.errorSummary(), snapshotId, id);
        if (changed != 1) throw new IllegalStateException("Crew run missing or already completed");
    }

    private void storeGraph(long id, CrewSourceSnapshot snapshot) {
        var source = snapshot.observation().source();
        var people = resolveIdentities("person", source, snapshot.profiles().stream()
                .map(p -> CrewSnapshotValidator.sourcePersonId(p.person(), source).value()).toList(), snapshot.observation().retrievedAt());
        var expeditions = resolveIdentities("expedition", source, snapshot.expeditions().stream()
                .map(e -> e.externalId().value()).toList(), snapshot.observation().retrievedAt());
        jdbc.batchUpdate("""
                INSERT INTO crew_expedition_observation
                    (snapshot_id, expedition_id, source, external_id, name, starts_at, ends_at, station, source_station_external_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, snapshot.expeditions().stream().map(e -> new Object[]{id, expeditions.get(e.externalId().value()),
                source.name(), e.externalId().value(), e.name(), utc(e.start()), utc(e.end()), e.station().name(),
                snapshot.sourceStationExternalId()}).toList());
        jdbc.batchUpdate("""
                INSERT INTO crew_person_observation
                    (snapshot_id, person_id, source, external_id, display_name, official_profile_url,
                     source_profile_mode, in_space, biography, career_present, time_in_space, eva_time,
                     flights_count, spacewalks_count, first_flight, last_flight, agency, nationalities, media)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
                """, snapshot.profiles().stream().map(p -> {
                    var c = p.career();
                    String externalId = CrewSnapshotValidator.sourcePersonId(p.person(), source).value();
                    return new Object[]{id, people.get(externalId), source.name(), externalId, p.person().displayName(),
                        string(p.person().officialProfileUrl()), p.sourceProfileMode(), p.inSpace(), p.biography(), c != null,
                        c == null ? null : string(c.timeInSpace()), c == null ? null : string(c.evaTime()),
                        c == null ? null : c.flightsCount(), c == null ? null : c.spacewalksCount(),
                        c == null ? null : utc(c.firstFlight()), c == null ? null : utc(c.lastFlight()),
                        encode(p.agency()), encode(p.nationalities()), encode(p.media())};
                }).toList());
        jdbc.batchUpdate("""
                INSERT INTO crew_assignment_observation
                    (snapshot_id, expedition_id, person_id, source, external_id, role, source_role_label, valid_from, valid_until)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, snapshot.assignments().stream().map(a -> new Object[]{id, expeditions.get(a.expeditionId().value()),
                people.get(CrewSnapshotValidator.sourcePersonId(a.person(), source).value()), source.name(),
                a.externalId() == null ? null : a.externalId().value(), a.role().name(), a.sourceRoleLabel(),
                utc(a.validFrom()), utc(a.validUntil())}).toList());
    }

    private Map<String, UUID> resolveIdentities(String kind, CrewSource source, List<String> externalIds, Instant createdAt) {
        // kind is an adapter-owned constant, never caller SQL input.
        Map<String, UUID> resolved = new HashMap<>();
        if (externalIds.isEmpty()) return resolved;
        String placeholders = String.join(",", Collections.nCopies(externalIds.size(), "?"));
        var args = new ArrayList<Object>(); args.add(source.name()); args.addAll(externalIds);
        jdbc.query("SELECT external_id, " + kind + "_id FROM crew_" + kind
                + "_external_id WHERE source = ? AND external_id IN (" + placeholders + ")", rs -> {
                    resolved.put(rs.getString(1), rs.getObject(2, UUID.class));
                }, args.toArray());
        var anchors = new ArrayList<Object[]>(); var mappings = new ArrayList<Object[]>();
        for (String externalId : externalIds) {
            if (resolved.containsKey(externalId)) continue;
            UUID uuid = UUID.randomUUID(); resolved.put(externalId, uuid);
            anchors.add(new Object[]{uuid, utc(createdAt)});
            mappings.add(new Object[]{uuid, source.name(), externalId});
        }
        if (!anchors.isEmpty()) {
            jdbc.batchUpdate("INSERT INTO crew_" + kind + " (id, created_at) VALUES (?, ?)", anchors);
            jdbc.batchUpdate("INSERT INTO crew_" + kind + "_external_id (" + kind
                    + "_id, source, external_id) VALUES (?, ?, ?)", mappings);
        }
        return resolved;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoredSnapshot> findSnapshot(long id) {
        var headers = jdbc.query("SELECT * FROM crew_source_snapshot WHERE id = ?", (rs, n) -> {
            var o = observation(rs, "first_observed_at", "source_api_version");
            return new CrewSourceSnapshot(Station.valueOf(rs.getString("station")), rs.getInt("total_active_expeditions"),
                    rs.getBoolean("candidates_complete"), List.of(), List.of(), List.of(), o, rs.getString("source_station_external_id"));
        }, id);
        if (headers.isEmpty()) return Optional.empty();
        var header = headers.getFirst(); var o = header.observation();
        var expeditions = jdbc.query("SELECT * FROM crew_expedition_observation WHERE snapshot_id = ? ORDER BY external_id",
                (rs, n) -> new Expedition(rs.getObject("expedition_id", UUID.class),
                        new ExternalId(CrewSource.valueOf(rs.getString("source")), rs.getString("external_id")),
                        rs.getString("name"), instant(rs, "starts_at"), instant(rs, "ends_at"),
                        Station.valueOf(rs.getString("station")), o), id);
        var profiles = jdbc.query("SELECT * FROM crew_person_observation WHERE snapshot_id = ? ORDER BY external_id",
                (rs, n) -> new AstronautProfile(new PersonReference(rs.getObject("person_id", UUID.class),
                        rs.getString("display_name"), List.of(new ExternalId(CrewSource.valueOf(rs.getString("source")),
                        rs.getString("external_id"))), uri(rs.getString("official_profile_url"))),
                        decode(rs.getString("agency"), Agency.class), decodeNationalities(rs.getString("nationalities")),
                        rs.getString("biography"), rs.getBoolean("career_present") ? new CareerStatistics(
                                duration(rs.getString("time_in_space")), duration(rs.getString("eva_time")),
                                rs.getObject("flights_count", Integer.class), rs.getObject("spacewalks_count", Integer.class),
                                instant(rs, "first_flight"), instant(rs, "last_flight")) : null,
                        decode(rs.getString("media"), CrewMediaAsset.class), rs.getObject("in_space", Boolean.class),
                        o, rs.getString("source_profile_mode")), id);
        Map<UUID, PersonReference> people = new HashMap<>(); profiles.forEach(p -> people.put(p.person().mission1Id(), p.person()));
        Map<UUID, ExternalId> expeditionIds = new HashMap<>(); expeditions.forEach(e -> expeditionIds.put(e.mission1Id(), e.externalId()));
        var assignments = jdbc.query("SELECT * FROM crew_assignment_observation WHERE snapshot_id = ? ORDER BY external_id",
                (rs, n) -> new CrewAssignment(rs.getString("external_id") == null ? null : new ExternalId(
                        CrewSource.valueOf(rs.getString("source")), rs.getString("external_id")),
                        expeditionIds.get(rs.getObject("expedition_id", UUID.class)), people.get(rs.getObject("person_id", UUID.class)),
                        CrewRole.valueOf(rs.getString("role")), rs.getString("source_role_label"),
                        instant(rs, "valid_from"), instant(rs, "valid_until"), o), id);
        return Optional.of(new StoredSnapshot(id, new CrewSourceSnapshot(header.station(), header.totalActiveExpeditions(),
                header.candidatesComplete(), expeditions, assignments, profiles, o, header.sourceStationExternalId())));
    }

    @Override public Optional<CrewSyncRun> findRun(long id) { return run("SELECT * FROM crew_source_sync_run WHERE id = ?", id); }
    @Override public Optional<CrewSyncRun> latestRun(CrewSource source, Station station) {
        return latest(source, station, "", "started_at");
    }
    @Override public Optional<CrewSyncRun> latestSuccess(CrewSource source, Station station) {
        return latest(source, station, " AND result_state = 'SUCCESS'", "completed_at");
    }
    @Override public Optional<CrewSyncRun> latestFailure(CrewSource source, Station station) {
        return latest(source, station, " AND result_state IN ('SOURCE_RESULT', 'INVALID_SNAPSHOT', 'PERSISTENCE_FAILURE', 'UNEXPECTED_FAILURE')", "started_at");
    }
    private Optional<CrewSyncRun> latest(CrewSource source, Station station, String filter, String order) {
        return run("SELECT * FROM crew_source_sync_run WHERE source = ? AND station = ?" + filter
                + " ORDER BY " + order + " DESC, id DESC LIMIT 1", source.name(), station.name());
    }
    @Override public Optional<Instant> lastFetchAttemptAt(CrewSource source, Station station) {
        return Optional.ofNullable(jdbc.queryForObject("""
                SELECT max(started_at) AS value FROM crew_source_sync_run WHERE source = ? AND station = ?
                AND result_state NOT IN ('SKIPPED_RATE_LIMIT', 'SKIPPED_NOT_DUE', 'SKIPPED_OVERLAP')
                """, (rs, n) -> instant(rs, "value"), source.name(), station.name()));
    }
    @Override public Optional<Instant> retryAfterAt(CrewSource source, Station station) {
        return Optional.ofNullable(jdbc.queryForObject("""
                SELECT max(retry_after_at) AS value FROM crew_source_sync_run
                WHERE source = ? AND station = ? AND source_state = 'RATE_LIMITED'
                """, (rs, n) -> instant(rs, "value"), source.name(), station.name()));
    }
    private Optional<CrewSyncRun> run(String sql, Object... args) {
        return jdbc.query(sql, (rs, n) -> new CrewSyncRun(rs.getLong("id"), CrewSource.valueOf(rs.getString("source")),
                Station.valueOf(rs.getString("station")), instant(rs, "started_at"), instant(rs, "completed_at"),
                CrewSyncRun.Outcome.valueOf(rs.getString("result_state")), rs.getString("source_state") == null ? null
                    : CrewSourceState.valueOf(rs.getString("source_state")), URI.create(rs.getString("source_url")),
                rs.getObject("http_status", Integer.class), rs.getString("content_hash") == null ? null
                    : observation(rs, "retrieved_at", "source_api_version"), rs.getString("retry_after"),
                instant(rs, "retry_after_at"), rs.getString("error_code"), rs.getString("error_summary"),
                rs.getObject("snapshot_id", Long.class)), args).stream().findFirst();
    }

    private static CrewSourceObservation observation(ResultSet rs, String retrievedColumn, String versionColumn) throws SQLException {
        return new CrewSourceObservation(CrewSource.valueOf(rs.getString("source")), URI.create(rs.getString("source_url")),
                instant(rs, retrievedColumn), instant(rs, "source_published_at"), instant(rs, "source_event_at"),
                rs.getString("http_etag"), rs.getString("http_last_modified"), rs.getString("content_hash"),
                rs.getString(versionColumn), rs.getString("adapter_version"));
    }
    private String encode(Object value) {
        if (value == null) return null;
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("Crew metadata cannot be serialized", e); }
    }
    private <T> T decode(String value, Class<T> type) {
        if (value == null) return null;
        try { return json.readValue(value, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid stored Crew metadata", e); }
    }
    private List<Nationality> decodeNationalities(String value) {
        try { return json.readValue(value, new TypeReference<List<Nationality>>() { }); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid stored nationalities", e); }
    }
    private static String name(Enum<?> value) { return value == null ? null : value.name(); }
    private static String string(Object value) { return value == null ? null : value.toString(); }
    private static URI uri(String value) { return value == null ? null : URI.create(value); }
    private static Duration duration(String value) { return value == null ? null : Duration.parse(value); }
    private static OffsetDateTime utc(Instant value) {
        return value == null ? null : OffsetDateTime.ofInstant(value.truncatedTo(ChronoUnit.MICROS), ZoneOffset.UTC);
    }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getObject(column, OffsetDateTime.class); return value == null ? null : value.toInstant();
    }
}
