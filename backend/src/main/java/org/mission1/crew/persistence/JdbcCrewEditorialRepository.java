package org.mission1.crew.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial;
import org.mission1.crew.domain.CrewEditorial.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.NasaRequestGate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** Isolated append-only shadow writer. Never writes legacy runs, identities or reconciliation. */
@Repository
public class JdbcCrewEditorialRepository implements CrewEditorialRepository {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public JdbcCrewEditorialRepository(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private <T> T decode(String value, Class<T> type) {
    try {
      return json.readValue(value, type);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String hash(Object value) {
    return CrewHttpReader.sha256(encode(value).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  private static OffsetDateTime utc(Instant i) {
    return i == null ? null : i.atOffset(ZoneOffset.UTC);
  }

  private static Instant instant(ResultSet r, String column) throws SQLException {
    var t = r.getObject(column, OffsetDateTime.class);
    return t == null ? null : t.toInstant();
  }

  private long resource(Resource r) {
    jdbc.update(
        "INSERT INTO crew_editorial_resource(resource_kind,wp_id) VALUES (?,?) ON CONFLICT DO"
            + " NOTHING",
        r.kind().name(),
        r.wpId());
    return jdbc.queryForObject(
        "SELECT id FROM crew_editorial_resource WHERE resource_kind=? AND wp_id=?",
        Long.class,
        r.kind().name(),
        r.wpId());
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public StoredCapture retain(
      Capture c, Resource r, Roster roster, TopicFacts facts, Outcome outcome, String reason) {
    if (roster != null
        && (r == null
            || r.kind() != Kind.NASA_MISSION
            || c.stream() != Stream.NASA_EDITORIAL_EXPEDITION
            || outcome == Outcome.FAILURE))
      throw new IllegalArgumentException("Invalid roster capture");
    jdbc.execute("SELECT pg_advisory_xact_lock(73491,4)");
    Long rid = r == null ? null : resource(r), doc = null, rosterId = null;
    if (c.body() != null && c.body().length > 0) {
      String rawHash = CrewHttpReader.sha256(c.body());
      jdbc.update(
          "INSERT INTO crew_document_body VALUES (?,?) ON CONFLICT DO NOTHING", rawHash, c.body());
      jdbc.update(
          """
          INSERT INTO crew_source_document(source,source_type,source_url,retrieved_at,source_published_at,http_status,
          http_etag,http_last_modified,content_type,content_hash,parser_name,parser_version,parsed)
          VALUES ('NASA_OFFICIAL',?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING
          """,
          c.stream().name(),
          c.requestedUrl().toString(),
          utc(c.completedAt()),
          r == null ? null : utc(r.publishedAt()),
          c.status(),
          c.header("ETag"),
          c.header("Last-Modified"),
          c.header("Content-Type"),
          rawHash,
          CrewEditorial.PARSER,
          CrewEditorial.VERSION,
          outcome != Outcome.FAILURE);
      doc =
          jdbc.queryForObject(
              "SELECT id FROM crew_source_document WHERE source_url=? AND content_hash=? AND"
                  + " parser_name=? AND parser_version=?",
              Long.class,
              c.requestedUrl().toString(),
              rawHash,
              CrewEditorial.PARSER,
              CrewEditorial.VERSION);
    }
    if (roster != null) {
      String semantic = hash(roster);
      var ids =
          jdbc.query(
              """
              INSERT INTO crew_editorial_roster_version(resource_id,expedition_number,semantic_hash,parser_name,parser_version,completeness,conflicts)
              VALUES (?,?,?,?,?,'PARSED_EDITORIAL_SECTION',?::jsonb) ON CONFLICT DO NOTHING RETURNING id
              """,
              (rs, n) -> rs.getLong(1),
              rid,
              roster.expedition(),
              semantic,
              CrewEditorial.PARSER,
              CrewEditorial.VERSION,
              encode(roster.conflicts()));
      rosterId =
          ids.isEmpty()
              ? jdbc.queryForObject(
                  "SELECT id FROM crew_editorial_roster_version WHERE resource_id=? AND"
                      + " semantic_hash=? AND parser_name=? AND parser_version=?",
                  Long.class,
                  rid,
                  semantic,
                  CrewEditorial.PARSER,
                  CrewEditorial.VERSION)
              : ids.getFirst();
      if (!ids.isEmpty())
        for (Member m : roster.members())
          jdbc.update(
              """
              INSERT INTO crew_editorial_roster_member(roster_id,member_index,display_name,role_text,agency_text,mentions,conflicts,semantic_hash)
              VALUES (?,?,?,?,?,?::jsonb,?::jsonb,?)
              """,
              rosterId,
              m.index(),
              m.name(),
              m.role(),
              m.agency(),
              encode(m.mentions()),
              encode(m.conflicts()),
              hash(m));
    }
    Instant retry = null;
    if (outcome == Outcome.FAILURE)
      retry =
          c.status() != null && c.status() == 429
              ? NasaRequestGate.retryAfter(c.header("Retry-After"), c.completedAt())
              : c.completedAt()
                  .plusSeconds(
                      c.stream() == Stream.NASA_PERSON_RESOURCE
                              && Integer.valueOf(404).equals(c.status())
                          ? 21600
                          : 900);
    long id =
        jdbc.queryForObject(
            """
            INSERT INTO crew_editorial_acquisition(stream,requested_url,final_url,redirects,started_at,completed_at,http_status,headers,
            document_id,resource_id,resource_metadata,outcome,reason,retry_after_at,roster_id,parser_name,parser_version)
            VALUES (?,?,?,?::jsonb,?,?,?,?::jsonb,?,?,?::jsonb,?,?,?,?,?,?) RETURNING id
            """,
            Long.class,
            c.stream().name(),
            c.requestedUrl().toString(),
            c.finalUrl().toString(),
            encode(c.redirects()),
            utc(c.startedAt()),
            utc(c.completedAt()),
            c.status(),
            encode(c.headers()),
            doc,
            rid,
            r == null ? null : encode(r),
            outcome.name(),
            reason,
            utc(retry),
            rosterId,
            CrewEditorial.PARSER,
            CrewEditorial.VERSION);
    if (facts != null && rid != null)
      for (var s : List.of(facts.expedition(), facts.aboardCount()))
        if (s.value() != null) {
          String semantic = hash(s);
          String unit = s.kind().equals("NASA_EDITORIAL_EXPEDITION_NUMBER") ? "number" : "persons";
          jdbc.update(
              """
              INSERT INTO crew_editorial_topic_fact(resource_id,fact_kind,value,unit,source_text,source_locator,semantic_hash,parser_name,parser_version)
              VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING
              """,
              rid,
              s.kind(),
              s.value(),
              unit,
              s.text(),
              s.locator(),
              semantic,
              CrewEditorial.PARSER,
              CrewEditorial.VERSION);
          long fid =
              jdbc.queryForObject(
                  "SELECT id FROM crew_editorial_topic_fact WHERE resource_id=? AND fact_kind=? AND"
                      + " semantic_hash=? AND parser_name=? AND parser_version=?",
                  Long.class,
                  rid,
                  s.kind(),
                  semantic,
                  CrewEditorial.PARSER,
                  CrewEditorial.VERSION);
          jdbc.update("INSERT INTO crew_editorial_fact_capture VALUES (?,?)", id, fid);
        }
    return new StoredCapture(id, rosterId, c, r, outcome, reason);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<StoredCapture> latest(Stream stream, URI url, boolean goodOnly) {
    return jdbc
        .query(
            """
            SELECT a.*,b.body FROM crew_editorial_acquisition a LEFT JOIN crew_source_document d ON d.id=a.document_id
            LEFT JOIN crew_document_body b ON b.content_hash=d.content_hash
            WHERE a.stream=? AND a.requested_url=? AND a.parser_name=? AND a.parser_version=?
            """
                + (goodOnly ? " AND a.outcome<>'FAILURE'" : "")
                + " ORDER BY a.completed_at DESC,a.id DESC LIMIT 1",
            (r, n) -> capture(r),
            stream.name(),
            url.toString(),
            CrewEditorial.PARSER,
            CrewEditorial.VERSION)
        .stream()
        .findFirst();
  }

  private StoredCapture capture(ResultSet r) throws SQLException {
    try {
      var c =
          new Capture(
              Stream.valueOf(r.getString("stream")),
              URI.create(r.getString("requested_url")),
              URI.create(r.getString("final_url")),
              json.readValue(r.getString("redirects"), new TypeReference<List<String>>() {}),
              instant(r, "started_at"),
              instant(r, "completed_at"),
              r.getObject("http_status", Integer.class),
              json.readValue(
                  r.getString("headers"), new TypeReference<Map<String, List<String>>>() {}),
              r.getBytes("body"),
              null);
      return new StoredCapture(
          r.getLong("id"),
          r.getObject("roster_id", Long.class),
          c,
          r.getString("resource_metadata") == null
              ? null
              : decode(r.getString("resource_metadata"), Resource.class),
          Outcome.valueOf(r.getString("outcome")),
          r.getString("reason"));
    } catch (java.io.IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @Override
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Optional<StoredRoster> latestRoster(Instant by) {
    var captures =
        jdbc.query(
            """
            SELECT a.*,b.body FROM crew_editorial_acquisition a JOIN crew_source_document d ON d.id=a.document_id
            JOIN crew_document_body b ON b.content_hash=d.content_hash
            WHERE a.roster_id IS NOT NULL AND a.completed_at<=? AND a.parser_name=? AND a.parser_version=?
            ORDER BY a.completed_at DESC,a.id DESC LIMIT 1
            """,
            (r, n) -> capture(r),
            utc(by),
            CrewEditorial.PARSER,
            CrewEditorial.VERSION);
    if (captures.isEmpty()) return Optional.empty();
    var c = captures.getFirst();
    long id = c.rosterId();
    var members =
        jdbc.query(
            "SELECT * FROM crew_editorial_roster_member WHERE roster_id=? ORDER BY member_index",
            (r, n) ->
                new Member(
                    r.getInt("member_index"),
                    r.getString("display_name"),
                    r.getString("role_text"),
                    r.getString("agency_text"),
                    decode(r.getString("mentions"), Mention[].class) == null
                        ? List.of()
                        : Arrays.asList(decode(r.getString("mentions"), Mention[].class)),
                    Arrays.asList(decode(r.getString("conflicts"), String[].class))),
            id);
    var root =
        jdbc.queryForMap(
            "SELECT expedition_number,conflicts FROM crew_editorial_roster_version WHERE id=?", id);
    var roster =
        new Roster(
            (Integer) root.get("expedition_number"),
            members,
            Arrays.asList(decode(root.get("conflicts").toString(), String[].class)));
    var relations =
        jdbc.query(
            """
            SELECT x.*,a.resource_metadata FROM crew_editorial_resource_relation x LEFT JOIN crew_editorial_acquisition a ON a.id=x.acquisition_id
            WHERE x.roster_id=? ORDER BY x.id
            """,
            (r, n) ->
                new Relation(
                    id,
                    r.getInt("member_index"),
                    r.getString("subject_name"),
                    r.getString("observed_url"),
                    r.getString("source_locator"),
                    RelationStatus.valueOf(r.getString("status")),
                    r.getString("resource_metadata") == null
                        ? null
                        : decode(r.getString("resource_metadata"), Resource.class),
                    r.getObject("acquisition_id", Long.class),
                    r.getString("reason")),
            id);
    return Optional.of(
        new StoredRoster(id, c.id(), c.capture().completedAt(), c.resource(), roster, relations));
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void retainRelation(Relation r) {
    Long target = r.target() == null ? null : resource(r.target());
    jdbc.update(
        """
        INSERT INTO crew_editorial_resource_relation(roster_id,member_index,subject_name,observed_url,source_locator,status,target_resource_id,acquisition_id,reason,relation_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING
        """,
        r.rosterId(),
        r.memberIndex(),
        r.subjectName(),
        r.observedUrl(),
        r.locator(),
        r.status().name(),
        target,
        r.acquisitionId(),
        r.reason(),
        hash(r));
  }

  @Override
  @Transactional(readOnly = true)
  public List<Health> health() {
    return jdbc.query(
        """
        SELECT DISTINCT ON(a.stream,a.requested_url) a.stream,a.requested_url,a.outcome,a.reason,a.completed_at,a.retry_after_at,
        (SELECT max(b.completed_at) FROM crew_editorial_acquisition b WHERE b.stream=a.stream AND b.requested_url=a.requested_url AND b.outcome<>'FAILURE') good_at
        FROM crew_editorial_acquisition a ORDER BY a.stream,a.requested_url,a.completed_at DESC,a.id DESC
        """,
        (r, n) ->
            new Health(
                Stream.valueOf(r.getString("stream")),
                r.getString("requested_url"),
                Outcome.valueOf(r.getString("outcome")),
                r.getString("reason"),
                instant(r, "completed_at"),
                instant(r, "good_at"),
                instant(r, "retry_after_at")));
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public boolean claimRefresh(Instant now, Duration interval) {
    return jdbc.update(
            "UPDATE crew_editorial_refresh_lease SET next_eligible_at=? WHERE singleton AND"
                + " next_eligible_at<=?",
            utc(now.plus(interval)),
            utc(now))
        == 1;
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public Instant reserveNasaRequest(Instant now) {
    var row =
        jdbc.queryForObject(
            "SELECT * FROM crew_nasa_request_budget WHERE singleton FOR UPDATE",
            (r, n) -> List.of(instant(r, "next_request_at"), instant(r, "cooldown_until")));
    Instant next = row.get(0), cool = row.get(1);
    if (cool.isAfter(now)) return cool;
    Instant slot = next.isAfter(now) ? next : now;
    jdbc.update(
        "UPDATE crew_nasa_request_budget SET next_request_at=? WHERE singleton",
        utc(slot.plusSeconds(1)));
    return slot;
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void nasaCooldown(Instant until) {
    jdbc.update(
        "UPDATE crew_nasa_request_budget SET cooldown_until=greatest(cooldown_until,?) WHERE"
            + " singleton",
        utc(until));
  }
}
