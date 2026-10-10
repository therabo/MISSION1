package org.mission1.crew.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.json.JsonMapper;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.sql.*;
import java.time.*;
import java.util.*;

/**
 * Four set-based person reads regardless of roster size. No write methods or raw-document reads.
 */
@Repository
public class JdbcCrewReadRepository implements CrewReadRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final CrewRepository history;
    private final JsonMapper json = JsonMapper.builder().build();

    public JdbcCrewReadRepository(JdbcTemplate jdbc, CrewRepository history) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbc);
        this.history = history;
    }

    @Override
    public Optional<CrewSyncRun> latestStructuredOutcome() {
        var ids =
                jdbc.query(
                        """
SELECT id FROM crew_source_sync_run WHERE source='LAUNCH_LIBRARY_2' AND station='ISS'
AND (result_state='SUCCESS' OR (result_state='SOURCE_RESULT' AND source_state='NO_ACTIVE_EXPEDITION'))
ORDER BY completed_at DESC,id DESC LIMIT 1
""",
                        Map.of(),
                        (rs, n) -> rs.getLong(1));
        return ids.isEmpty() ? Optional.empty() : history.findRun(ids.getFirst());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, Person> findPeople(Collection<UUID> ids, Instant asOf) {
        if (ids.isEmpty()) return Map.of();
        var identity =
                new JdbcCrewIdentityRepository(
                                new JdbcTemplate(jdbc.getJdbcTemplate().getDataSource()))
                        .knowledge(asOf);
        var anchors = new HashSet<UUID>();
        ids.forEach(id -> anchors.addAll(identity.anchors(id)));
        var args = Map.of("ids", anchors, "at", asOf.atOffset(ZoneOffset.UTC));
        Map<UUID, Person> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT id FROM crew_person WHERE id IN (:ids) AND created_at <= :at ORDER BY id",
                args,
                rs -> {
                    var id = rs.getObject(1, UUID.class);
                    result.put(id, new Person(id, null, null, List.of(), null, null, null));
                });
        // Latest successful run, including A→B→A snapshot reuse, rather than latest snapshot
        // insertion.
        jdbc.query(
                """
SELECT DISTINCT ON (p.person_id) p.*, s.source_url, s.first_observed_at,
    s.source_published_at, s.source_event_at, s.http_etag, s.http_last_modified,
    s.content_hash, s.source_api_version, s.adapter_version, r.retrieved_at AS latest_fetch
FROM crew_person_observation p JOIN crew_source_snapshot s ON s.id=p.snapshot_id
JOIN crew_source_sync_run r ON r.snapshot_id=s.id AND r.result_state='SUCCESS'
WHERE p.person_id IN (:ids) AND r.completed_at <= :at
ORDER BY p.person_id, r.completed_at DESC, r.id DESC
""",
                args,
                rs -> {
                    UUID id = rs.getObject("person_id", UUID.class);
                    var o = observation(rs);
                    var profile =
                            new AstronautProfile(
                                    new PersonReference(
                                            id,
                                            rs.getString("display_name"),
                                            List.of(
                                                    new ExternalId(
                                                            CrewSource.valueOf(
                                                                    rs.getString("source")),
                                                            rs.getString("external_id"))),
                                            uri(rs.getString("official_profile_url"))),
                                    decode(rs.getString("agency"), Agency.class),
                                    nationalities(rs.getString("nationalities")),
                                    rs.getString("biography"),
                                    rs.getBoolean("career_present")
                                            ? new CareerStatistics(
                                                    duration(rs.getString("time_in_space")),
                                                    duration(rs.getString("eva_time")),
                                                    rs.getObject("flights_count", Integer.class),
                                                    rs.getObject("spacewalks_count", Integer.class),
                                                    instant(rs, "first_flight"),
                                                    instant(rs, "last_flight"))
                                            : null,
                                    decode(rs.getString("media"), CrewMediaAsset.class),
                                    rs.getObject("in_space", Boolean.class),
                                    o,
                                    rs.getString("source_profile_mode"));
                    result.put(
                            id,
                            new Person(
                                    id,
                                    profile.person().displayName(),
                                    profile.person().officialProfileUrl(),
                                    List.of(),
                                    profile,
                                    instant(rs, "latest_fetch"),
                                    o));
                });
        // NASA-only names come from an already persisted resolution, never a new name match.
        jdbc.query(
                """
SELECT DISTINCT ON (r.person_id) r.person_id, p.display_name, p.official_profile_url
FROM crew_identity_resolution r JOIN crew_evidence_subject p
    ON p.evidence_id=r.evidence_id AND p.subject_index=r.subject_index
WHERE r.person_id IN (:ids) AND r.resolved_at <= :at
ORDER BY r.person_id, r.resolved_at DESC, r.id DESC
""",
                args,
                rs -> {
                    var id = rs.getObject("person_id", UUID.class);
                    var p = result.get(id);
                    if (p != null)
                        result.put(
                                id,
                                new Person(
                                        id,
                                        p.name() == null ? rs.getString("display_name") : p.name(),
                                        p.officialProfileUrl() == null
                                                ? uri(rs.getString("official_profile_url"))
                                                : p.officialProfileUrl(),
                                        p.externalIds(),
                                        p.profile(),
                                        p.profileFetchedAt(),
                                        p.identityObservation()));
                });
        Map<UUID, List<ExternalId>> mappings = new HashMap<>();
        jdbc.query(
                "SELECT person_id,source,external_id FROM crew_person_external_id WHERE person_id"
                    + " IN (:ids) ORDER BY source,external_id",
                args,
                rs -> {
                    mappings.computeIfAbsent(rs.getObject(1, UUID.class), x -> new ArrayList<>())
                            .add(
                                    new ExternalId(
                                            CrewSource.valueOf(rs.getString(2)), rs.getString(3)));
                });
        result.replaceAll(
                (id, p) ->
                        new Person(
                                id,
                                p.name(),
                                p.officialProfileUrl(),
                                mappings.getOrDefault(id, List.of()),
                                p.profile(),
                                p.profileFetchedAt(),
                                p.identityObservation()));
        return CrewCanonicalProfile.project(result, ids, identity);
    }

    private CrewSourceObservation observation(ResultSet rs) throws SQLException {
        return new CrewSourceObservation(
                CrewSource.valueOf(rs.getString("source")),
                URI.create(rs.getString("source_url")),
                instant(rs, "first_observed_at"),
                instant(rs, "source_published_at"),
                instant(rs, "source_event_at"),
                rs.getString("http_etag"),
                rs.getString("http_last_modified"),
                rs.getString("content_hash"),
                rs.getString("source_api_version"),
                rs.getString("adapter_version"));
    }

    private <T> T decode(String value, Class<T> type) {
        if (value == null) return null;
        try {
            return json.readValue(value, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid stored Crew metadata", e);
        }
    }

    private List<Nationality> nationalities(String value) {
        try {
            return json.readValue(value, new TypeReference<List<Nationality>>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid stored nationalities", e);
        }
    }

    private static URI uri(String value) {
        return value == null ? null : URI.create(value);
    }

    private static Duration duration(String value) {
        return value == null ? null : Duration.parse(value);
    }

    private static Instant instant(ResultSet rs, String key) throws SQLException {
        var value = rs.getObject(key, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
