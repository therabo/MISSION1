package org.mission1.crew.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

import java.net.URI;
import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Append-only NASA source history; shared sync-run/identity infrastructure, independent
 * observations.
 */
@Repository
public class JdbcCrewVerificationRepository implements CrewVerificationRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final CrewPersonResolver resolver = new CrewPersonResolver();

    public JdbcCrewVerificationRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public Optional<Document> latestDocument(URI url, String parserName, String parserVersion) {
        return jdbc
                .query(
                        "SELECT d.*, b.body FROM crew_source_document d JOIN crew_document_body b"
                            + " USING(content_hash) WHERE source_url=? AND parser_name=? AND"
                            + " parser_version=? ORDER BY retrieved_at DESC,id DESC LIMIT 1",
                        (r, n) -> document(r),
                        url.toString(),
                        parserName,
                        parserVersion)
                .stream()
                .findFirst();
    }

    @Override
    public Optional<CrewSourceDocument> document(long id) {
        return jdbc
                .query(
                        "SELECT d.*, b.body FROM crew_source_document d JOIN crew_document_body b"
                            + " USING(content_hash) WHERE id=?",
                        (r, n) -> document(r).source(),
                        id)
                .stream()
                .findFirst();
    }

    private Document document(ResultSet r) throws SQLException {
        var o =
                new CrewSourceObservation(
                        CrewSource.NASA_OFFICIAL,
                        URI.create(r.getString("source_url")),
                        instant(r, "retrieved_at"),
                        instant(r, "source_published_at"),
                        null,
                        r.getString("http_etag"),
                        r.getString("http_last_modified"),
                        r.getString("content_hash"),
                        "NASA_RSS",
                        r.getString("parser_name") + "/" + r.getString("parser_version"));
        return new Document(
                r.getLong("id"),
                new CrewSourceDocument(
                        NasaSourceType.valueOf(r.getString("source_type")), o, r.getBytes("body")),
                r.getObject("http_status", Integer.class),
                r.getString("content_type"),
                r.getString("parser_name"),
                r.getString("parser_version"),
                r.getBoolean("parsed"));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Stored storeFetch(
            long run,
            CrewSourceDocument document,
            Integer status,
            String contentType,
            String parserName,
            String parserVersion,
            List<CrewVerificationEvidence> evidence,
            boolean parsed,
            Instant completedAt) {
        var o = document.observation();
        if (!o.contentHash().equals(CrewHttpReader.sha256(document.body())))
            throw new IllegalArgumentException("Document hash mismatch");
        if (!parsed && !evidence.isEmpty())
            throw new IllegalArgumentException("Failed parse cannot supply evidence");
        jdbc.execute("SELECT pg_advisory_xact_lock(73491, 2)");
        jdbc.update(
                "INSERT INTO crew_document_body(content_hash,body) VALUES (?,?) ON CONFLICT DO"
                    + " NOTHING",
                o.contentHash(),
                document.body());
        var ids =
                jdbc.query(
                        """
INSERT INTO crew_source_document(source,source_type,source_url,retrieved_at,source_published_at,http_status,
    http_etag,http_last_modified,content_type,content_hash,parser_name,parser_version,parsed)
VALUES ('NASA_OFFICIAL',?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id
""",
                        (r, n) -> r.getLong(1),
                        document.sourceType().name(),
                        o.sourceUrl().toString(),
                        utc(o.retrievedAt()),
                        utc(o.sourcePublishedAt()),
                        status,
                        o.httpEtag(),
                        o.httpLastModified(),
                        contentType,
                        o.contentHash(),
                        parserName,
                        parserVersion,
                        parsed);
        boolean inserted = !ids.isEmpty();
        long id =
                inserted
                        ? ids.getFirst()
                        : jdbc.queryForObject(
                                "SELECT id FROM crew_source_document WHERE source_url=? AND"
                                    + " content_hash=? AND parser_name=? AND parser_version=?",
                                Long.class,
                                o.sourceUrl().toString(),
                                o.contentHash(),
                                parserName,
                                parserVersion);
        int added = 0;
        if (inserted)
            for (var e : evidence) {
                if (e.observation().source() != CrewSource.NASA_OFFICIAL
                        || !e.observation().contentHash().equals(o.contentHash()))
                    throw new IllegalArgumentException("Evidence/document lineage mismatch");
                String hash =
                        hash(
                                Arrays.asList(
                                        e.type(),
                                        e.station(),
                                        e.people(),
                                        e.crewCount(),
                                        e.sourceType(),
                                        e.observation().sourceUrl(),
                                        e.observation().sourcePublishedAt(),
                                        e.observation().sourceEventAt(),
                                        e.supportingExcerpt(),
                                        e.evidenceMethod(),
                                        e.completeness(),
                                        e.assertion(),
                                        parserName,
                                        parserVersion));
                var ei =
                        jdbc.query(
                                """
INSERT INTO crew_verification_evidence(document_id,evidence_hash,station,evidence_type,assertion,completeness,
    source_type,assertion_url,source_published_at,source_event_at,supporting_excerpt,parser_name,parser_version,evidence_method,crew_count)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id
""",
                                (r, n) -> r.getLong(1),
                                id,
                                hash,
                                e.station().name(),
                                e.type().name(),
                                e.assertion().name(),
                                e.completeness().name(),
                                e.sourceType().name(),
                                e.observation().sourceUrl().toString(),
                                utc(e.observation().sourcePublishedAt()),
                                utc(e.observation().sourceEventAt()),
                                e.supportingExcerpt(),
                                parserName,
                                parserVersion,
                                e.evidenceMethod(),
                                e.crewCount());
                long eid =
                        ei.isEmpty()
                                ? jdbc.queryForObject(
                                        "SELECT id FROM crew_verification_evidence WHERE"
                                            + " evidence_hash=?",
                                        Long.class,
                                        hash)
                                : ei.getFirst();
                if (!ei.isEmpty()) {
                    added++;
                    var args = new ArrayList<Object[]>();
                    for (int i = 0; i < e.people().size(); i++) {
                        var person = e.people().get(i);
                        args.add(
                                new Object[] {
                                    eid,
                                    i,
                                    person.displayName(),
                                    string(person.officialProfileUrl()),
                                    encode(person.externalIds())
                                });
                    }
                    if (!args.isEmpty())
                        jdbc.batchUpdate(
                                "INSERT INTO"
                                    + " crew_evidence_subject(evidence_id,subject_index,display_name,official_profile_url,external_ids)"
                                    + " VALUES (?,?,?,?,?::jsonb)",
                                args);
                }
                jdbc.update(
                        "INSERT INTO crew_document_evidence(document_id,evidence_id) VALUES (?,?)",
                        id,
                        eid);
            }
        complete(run, id, o.retrievedAt(), completedAt, status, o, parsed);
        return new Stored(id, inserted, added);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void storeNotModified(
            long run, Document document, Instant retrievedAt, Instant completedAt) {
        if (!document.parsed())
            throw new IllegalArgumentException("304 cannot validate a failed parse");
        complete(
                run,
                document.id(),
                retrievedAt,
                completedAt,
                304,
                document.source().observation(),
                true);
    }

    private void complete(
            long run,
            long documentId,
            Instant retrievedAt,
            Instant completedAt,
            Integer status,
            CrewSourceObservation o,
            boolean parsed) {
        int changed =
                jdbc.update(
                        """
UPDATE crew_source_sync_run SET completed_at=?,result_state=?,source_state=?,http_status=?,retrieved_at=?,
    source_api_version='NASA_RSS',adapter_version=?,content_hash=?,http_etag=?,http_last_modified=?,verification_document_id=?,
    error_code=?,error_summary=? WHERE id=? AND source='NASA_OFFICIAL' AND result_state='IN_PROGRESS'
""",
                        utc(completedAt),
                        parsed ? "SUCCESS" : "SOURCE_RESULT",
                        parsed ? "AVAILABLE" : "MALFORMED_RESPONSE",
                        status,
                        utc(retrievedAt),
                        o.adapterVersion(),
                        o.contentHash(),
                        o.httpEtag(),
                        o.httpLastModified(),
                        documentId,
                        parsed ? null : "INVALID_RESPONSE",
                        parsed ? null : "NASA parser required anchors failed",
                        run);
        if (changed != 1) throw new IllegalStateException("NASA run missing or completed");
    }

    @Override
    public Optional<Verification> latestSuccess() {
        return jdbc
                .query(
                        "SELECT id,verification_document_id,retrieved_at FROM crew_source_sync_run"
                            + " WHERE source='NASA_OFFICIAL' AND result_state='SUCCESS' ORDER BY"
                            + " completed_at DESC,id DESC LIMIT 1",
                        (r, n) ->
                                new Verification(
                                        r.getLong(1), r.getLong(2), instant(r, "retrieved_at")))
                .stream()
                .findFirst();
    }

    @Override
    public Optional<ParseFailure> latestParseFailure() {
        return jdbc
                .query(
                        """
SELECT r.id,d.id AS document_id,r.retrieved_at,d.parser_name,d.parser_version
FROM crew_source_sync_run r JOIN crew_source_document d ON d.id=r.verification_document_id
WHERE r.source='NASA_OFFICIAL' AND NOT d.parsed ORDER BY r.completed_at DESC,r.id DESC LIMIT 1
""",
                        (r, n) ->
                                new ParseFailure(
                                        r.getLong("id"),
                                        r.getLong("document_id"),
                                        instant(r, "retrieved_at"),
                                        r.getString("parser_name"),
                                        r.getString("parser_version")))
                .stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Evidence> evidenceAsOf(Instant asOf) {
        // Two batch reads over retained assertions, never one lookup per astronaut. The engine
        // orders historical events and checks current applicability.
        var subjects = new HashMap<Long, List<PersonReference>>();
        jdbc.query(
                """
SELECT s.* FROM crew_evidence_subject s JOIN crew_verification_evidence e ON e.id=s.evidence_id
JOIN crew_source_document d ON d.id=e.document_id WHERE d.parsed AND d.retrieved_at<=?
AND e.source_published_at<=? ORDER BY s.evidence_id,s.subject_index
""",
                r -> {
                    subjects.computeIfAbsent(r.getLong("evidence_id"), x -> new ArrayList<>())
                            .add(
                                    new PersonReference(
                                            null,
                                            r.getString("display_name"),
                                            decodeIds(r.getString("external_ids")),
                                            uri(r.getString("official_profile_url"))));
                },
                utc(asOf),
                utc(asOf));
        return jdbc.query(
                """
SELECT e.*,d.retrieved_at,d.http_etag,d.http_last_modified,d.content_hash FROM crew_verification_evidence e
JOIN crew_source_document d ON d.id=e.document_id WHERE d.parsed AND d.retrieved_at<=? AND e.source_published_at<=?
ORDER BY e.id
""",
                (r, n) -> {
                    var o =
                            new CrewSourceObservation(
                                    CrewSource.NASA_OFFICIAL,
                                    URI.create(r.getString("assertion_url")),
                                    instant(r, "retrieved_at"),
                                    instant(r, "source_published_at"),
                                    instant(r, "source_event_at"),
                                    r.getString("http_etag"),
                                    r.getString("http_last_modified"),
                                    r.getString("content_hash"),
                                    "NASA_RSS",
                                    r.getString("parser_name")
                                            + "/"
                                            + r.getString("parser_version"));
                    var e =
                            new CrewVerificationEvidence(
                                    CrewVerificationEvidence.Type.valueOf(
                                            r.getString("evidence_type")),
                                    Station.ISS,
                                    subjects.getOrDefault(r.getLong("id"), List.of()),
                                    r.getObject("crew_count", Integer.class),
                                    NasaSourceType.valueOf(r.getString("source_type")),
                                    o,
                                    r.getString("supporting_excerpt"),
                                    r.getString("evidence_method"),
                                    CrewVerificationEvidence.Completeness.valueOf(
                                            r.getString("completeness")),
                                    CrewVerificationEvidence.Assertion.valueOf(
                                            r.getString("assertion")));
                    return new Evidence(r.getLong("id"), r.getLong("document_id"), e);
                },
                utc(asOf),
                utc(asOf));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<CrewIdentityResolution> resolve(List<Evidence> evidence, Instant asOf) {
        // Shared identity-allocation lock used by LL2. NASA never writes person observations or
        // assignments.
        jdbc.execute("SELECT pg_advisory_xact_lock(73491, 1)");
        Map<String, UUID> mappings = new HashMap<>();
        jdbc.query(
                "SELECT external_id,person_id FROM crew_person_external_id WHERE"
                    + " source='NASA_OFFICIAL'",
                r -> {
                    mappings.put(r.getString(1), r.getObject(2, UUID.class));
                });
        var candidates =
                jdbc.query(
                        """
SELECT DISTINCT ON(person_id) person_id,display_name,official_profile_url FROM crew_person_observation
ORDER BY person_id,snapshot_id DESC
""",
                        (r, n) ->
                                new PersonReference(
                                        r.getObject(1, UUID.class),
                                        r.getString(2),
                                        List.of(),
                                        uri(r.getString(3))));
        var previous = new HashMap<String, CrewIdentityResolution>();
        resolutionsAsOf(asOf)
                .forEach(x -> previous.put(x.evidenceId() + ":" + x.subjectIndex(), x));
        var result = new ArrayList<CrewIdentityResolution>();
        for (var item : evidence)
            for (int i = 0; i < item.value().people().size(); i++) {
                var existing = previous.get(item.id() + ":" + i);
                var subject = item.value().people().get(i);
                var decision = resolver.resolve(subject, candidates, mappings);
                // Recheck candidates when LL2 history grows. Reuse a prior audit only if its
                // decision still holds.
                if (existing != null
                        && existing.resolverVersion().equals(CrewPersonResolver.VERSION)
                        && Objects.equals(existing.personId(), decision.personId())
                        && Objects.equals(existing.identityKey(), decision.nasaKey())
                        && existing.candidates().equals(decision.candidates())
                        && (existing.personId() != null
                                || existing.method() == decision.method())) {
                    result.add(existing);
                    continue;
                }
                UUID person = decision.personId();
                String key = decision.nasaKey();
                if (person == null
                        && decision.method() == CrewIdentityResolution.Method.OFFICIAL_PROFILE) {
                    person = UUID.randomUUID();
                    jdbc.update(
                            "INSERT INTO crew_person(id,created_at) VALUES (?,?)",
                            person,
                            utc(asOf));
                }
                if (person != null && key != null && !mappings.containsKey(key)) {
                    jdbc.update(
                            "INSERT INTO crew_person_external_id(person_id,source,external_id)"
                                + " VALUES (?,'NASA_OFFICIAL',?)",
                            person,
                            key);
                    mappings.put(key, person);
                }
                var method = decision.method();
                var candidateIds = person != null ? List.of(person) : decision.candidates();
                String resolutionHash =
                        hash(
                                Arrays.asList(
                                        item.id(),
                                        i,
                                        person,
                                        method,
                                        candidateIds,
                                        key,
                                        CrewPersonResolver.VERSION));
                jdbc.update(
                        """
INSERT INTO crew_identity_resolution(evidence_id,subject_index,resolved_at,person_id,method,candidates,identity_key,resolver_version,resolution_hash)
VALUES (?,?,?,?,?,?::uuid[],?,?,?) ON CONFLICT DO NOTHING
""",
                        item.id(),
                        i,
                        utc(asOf),
                        person,
                        method.name(),
                        array(candidateIds),
                        key,
                        CrewPersonResolver.VERSION,
                        resolutionHash);
                result.add(
                        jdbc.queryForObject(
                                "SELECT * FROM crew_identity_resolution WHERE resolution_hash=?",
                                (r, n) -> resolution(r),
                                resolutionHash));
            }
        return List.copyOf(result);
    }

    @Override
    public List<CrewIdentityResolution> resolutionsAsOf(Instant asOf) {
        return jdbc.query(
                "SELECT DISTINCT ON(evidence_id,subject_index) * FROM crew_identity_resolution"
                    + " WHERE resolved_at<=? ORDER BY evidence_id,subject_index,resolved_at DESC,id"
                    + " DESC",
                (r, n) -> resolution(r),
                utc(asOf));
    }

    public static CrewIdentityResolution resolution(ResultSet r) throws SQLException {
        var values = (Object[]) r.getArray("candidates").getArray();
        return new CrewIdentityResolution(
                r.getLong("id"),
                r.getLong("evidence_id"),
                r.getInt("subject_index"),
                r.getObject("person_id", UUID.class),
                CrewIdentityResolution.Method.valueOf(r.getString("method")),
                Arrays.stream(values).map(x -> UUID.fromString(x.toString())).toList(),
                r.getString("identity_key"),
                r.getString("resolver_version"));
    }

    private List<ExternalId> decodeIds(String value) {
        try {
            return json.readValue(value, new TypeReference<List<ExternalId>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Invalid stored external IDs", e);
        }
    }

    private String encode(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot encode Crew metadata", e);
        }
    }

    private String hash(Object value) {
        return CrewHttpReader.sha256(
                encode(value).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    static String array(List<UUID> ids) {
        return "{" + String.join(",", ids.stream().map(UUID::toString).toList()) + "}";
    }

    static String string(Object value) {
        return value == null ? null : value.toString();
    }

    static URI uri(String value) {
        return value == null ? null : URI.create(value);
    }

    static OffsetDateTime utc(Instant value) {
        return value == null ? null : value.truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
    }

    static Instant instant(ResultSet r, String column) throws SQLException {
        var x = r.getObject(column, OffsetDateTime.class);
        return x == null ? null : x.toInstant();
    }
}
