package org.mission1.crew.operational;

import static org.mission1.crew.operational.OperationalBinding.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/** Set-based retained input reads. canonical identity targets/production outcomes never enter scoring features. */
@Repository
public class RetainedOperationalInputs {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final CrewVerificationRepository verification;
  private final OperationalResources parser;

  public RetainedOperationalInputs(
      JdbcTemplate jdbc, ObjectMapper json, CrewVerificationRepository verification) {
    this.jdbc = jdbc;
    this.json = json;
    this.verification = verification;
    parser = new OperationalResources(json);
  }

  public record Batch(
      List<Subject> subjects,
      List<Resource> resources,
      List<String> providerUrls,
      List<String> structuredUrls,
      boolean complete,
      int queries,
      long loadNanos) {}

  static Instant time(Object o) {
    return o == null ? null : ((java.sql.Timestamp) o).toInstant();
  }

  static java.time.OffsetDateTime utc(Instant t) {
    return t.atOffset(ZoneOffset.UTC);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Batch load(Instant cut) {
    long start = System.nanoTime();
    var selected =
        new CrewCompatibleVersionSelector()
            .select(verification.evidenceAsOf(cut), verification.occurrenceVersionsAsOf(cut));
    var ids = new HashSet<Long>();
    selected.evidence().forEach(e -> ids.add(e.id()));
    var rows =
        jdbc.queryForList(
            """
            SELECT s.*,e.evidence_hash,e.assertion_url,e.supporting_excerpt,e.evidence_type,e.assertion,e.source_event_at,
            e.source_published_at,e.parser_name,e.parser_version,d.id document_id,d.content_hash,d.retrieved_at,b.body,
            v.subject_key,v.version_key
            FROM crew_evidence_subject s JOIN crew_verification_evidence e ON e.id=s.evidence_id
            JOIN crew_source_document d ON d.id=e.document_id JOIN crew_document_body b ON b.content_hash=d.content_hash
            LEFT JOIN crew_subject_version_link v ON v.evidence_id=s.evidence_id AND v.subject_index=s.subject_index
            WHERE d.retrieved_at<=? ORDER BY s.evidence_id,s.subject_index LIMIT 10001
            """,
            utc(cut));
    var subjects = new ArrayList<Subject>();
    for (var r : rows) {
      long id = ((Number) r.get("evidence_id")).longValue();
      if (!ids.contains(id)) continue;
      String type = r.get("evidence_type").toString();
      if (!Set.of("PERSON_CURRENTLY_ABOARD", "PERSON_ENTERED_STATION", "PERSON_DEPARTED_STATION")
          .contains(type)) continue;
      String name = r.get("display_name").toString(),
          excerpt = r.get("supporting_excerpt").toString(),
          article = r.get("assertion_url").toString();
      byte[] body = (byte[]) r.get("body");
      var scope = OperationalSubjectScope.read(body, article, excerpt, name);
      String key =
          Objects.toString(r.get("subject_key"), "legacy:" + id + ":" + r.get("subject_index"));
      String version =
          Objects.toString(
              r.get("version_key"),
              CrewHttpReader.sha256(
                  (key + ":" + r.get("evidence_hash"))
                      .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
      subjects.add(
          new Subject(
              key,
              version,
              id,
              ((Number) r.get("subject_index")).intValue(),
              ((Number) r.get("document_id")).longValue(),
              r.get("evidence_hash").toString(),
              r.get("content_hash").toString(),
              article,
              scope.title(),
              name,
              excerpt,
              scope.html(),
              type,
              r.get("assertion").toString(),
              time(r.get("source_event_at")) == null
                  ? time(r.get("source_published_at"))
                  : time(r.get("source_event_at")),
              time(r.get("source_published_at")),
              time(r.get("retrieved_at")),
              r.get("parser_name") + "/" + r.get("parser_version"),
              OperationalResources.sourceAgency(name, excerpt),
              excerpt.matches("(?is).*(astronaut|cosmonaut|flight engineer|commander).*")
                  ? "SOURCE_OPERATIONAL_ROLE"
                  : null,
              OperationalResources.scopedMissions(type, scope.title(), excerpt),
              OperationalResources.anchors(scope.html(), name),
              scope.complete() && CrewHttpReader.sha256(body).equals(r.get("content_hash"))));
    }
    var resources = new ArrayList<Resource>();
    var stored =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(v.requested_url) v.id,v.facts,a.id validation_id,a.completed_at validated_at
            FROM crew_operational_resource_version v JOIN crew_operational_resource_attempt a ON a.resource_version_id=v.id
            WHERE a.completed_at<=? ORDER BY v.requested_url,a.completed_at DESC,a.id DESC LIMIT 10001
            """,
            utc(cut));
    for (var r : stored)
      try {
        for (var n : json.readTree(r.get("facts").toString()))
          resources.add(
              json.treeToValue(n, Resource.class)
                  .validated(
                      ((Number) r.get("validation_id")).longValue(), time(r.get("validated_at"))));
      } catch (Exception e) {
        throw new IllegalStateException("Stored S10 fact integrity", e);
      }
    // Reuse editorial captures in place. No resource, relation, acquisition or body is
    // duplicated/written.
    var editorialCaptures =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(a.requested_url) a.*,d.content_hash,d.content_type,b.body,
              validation.id validation_id,validation.completed_at validated_at
            FROM crew_editorial_acquisition a JOIN crew_source_document d ON d.id=a.document_id
            JOIN crew_document_body b ON b.content_hash=d.content_hash
            LEFT JOIN LATERAL (SELECT id,completed_at FROM crew_operational_resource_attempt v
              WHERE v.reused_editorial_acquisition_id=a.id AND v.completed_at<=? ORDER BY v.completed_at DESC,v.id DESC LIMIT 1) validation ON true
            WHERE a.stream='NASA_PERSON_RESOURCE'  AND a.outcome<>'FAILURE' AND a.completed_at<=?
            ORDER BY a.requested_url,a.completed_at DESC,a.id DESC LIMIT 10001
            """,
            utc(cut),
            utc(cut));
    for (var r : editorialCaptures)
      try {
        var redirects =
            json.convertValue(
                json.readTree(r.get("redirects").toString()),
                new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        var c =
            new OperationalResources.Capture(
                r.get("requested_url").toString(),
                r.get("final_url").toString(),
                redirects,
                time(r.get("completed_at")),
                200,
                Objects.toString(r.get("content_type"), "application/json"),
                null,
                (byte[]) r.get("body"));
        for (var fact : parser.parse(c, "crew_editorial_acquisition:" + r.get("id")))
          resources.add(
              r.get("validation_id") == null
                  ? fact
                  : fact.validated(
                      ((Number) r.get("validation_id")).longValue(), time(r.get("validated_at"))));
      } catch (IllegalArgumentException e) {
        /* Unknown/unsupported editorial resources remain retained, never proof. */
      } catch (Exception e) {
        throw new IllegalStateException("Retained editorial fact read", e);
      }
    var providerRows =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(o.external_id) o.external_id,o.biography,o.official_profile_url,r.completed_at,e.name expedition
            FROM crew_person_observation o
            JOIN crew_source_sync_run r ON r.snapshot_id=o.snapshot_id AND r.result_state='SUCCESS'
            LEFT JOIN crew_assignment_observation a ON a.snapshot_id=o.snapshot_id AND a.person_id=o.person_id
            LEFT JOIN crew_expedition_observation e ON e.snapshot_id=a.snapshot_id AND e.expedition_id=a.expedition_id
            WHERE o.source='LAUNCH_LIBRARY_2' AND r.completed_at<=?
            ORDER BY o.external_id,r.completed_at DESC,r.id DESC LIMIT 10001
            """,
            utc(cut));
    var urls =
        providerRows.stream()
            .map(r -> "https://ll.thespacedevs.com/2.3.0/astronauts/" + r.get("external_id") + "/")
            .toList();
    var structuredUrls = new TreeSet<String>();
    for (var r : providerRows)
      if (!time(r.get("completed_at")).isBefore(cut.minus(Duration.ofDays(7))))
        structuredUrls.addAll(OperationalResourceDiscovery.structured(
            (String) r.get("biography"), (String) r.get("expedition"), (String) r.get("official_profile_url")));
    // Newly observed editorial links must not wait for the retained Expedition HTML's weekly refresh.
    // They remain acquisition locators; rejected relations never generate new work.
    var editorialUrls = jdbc.queryForList("""
        SELECT observed_url FROM (
          SELECT DISTINCT ON(r.member_index,r.observed_url) r.observed_url,r.status
          FROM crew_editorial_resource_relation r
          WHERE r.roster_id=(SELECT roster_id FROM crew_editorial_acquisition
            WHERE roster_id IS NOT NULL AND completed_at<=? AND completed_at>=?
            ORDER BY completed_at DESC,id DESC LIMIT 1)
          ORDER BY r.member_index,r.observed_url,r.id DESC
        ) links WHERE status<>'REJECTED_MISMATCH' ORDER BY observed_url LIMIT 10001
        """, utc(cut), utc(cut.minus(Duration.ofDays(7))));
    editorialUrls.forEach(r -> structuredUrls.add(r.get("observed_url").toString()));
    var latest = new TreeMap<String, Resource>();
    for (var r : resources) {
      String key = r.kind() == Kind.NATIVE_DIRECTORY ? r.ref() : r.url();
      if (!latest.containsKey(key) || latest.get(key).capturedAt().isBefore(r.capturedAt()))
        latest.put(key, r);
    }
    boolean complete =
        rows.size() <= 10000
            && stored.size() <= 10000
            && editorialCaptures.size() <= 10000
            && providerRows.size() <= 10000
            && editorialUrls.size() <= 10000
            && urls.stream()
                .allMatch(
                    u ->
                        latest.values().stream()
                            .anyMatch(
                                r ->
                                    r.url().equals(u)
                                        && r.kind() == Kind.PROVIDER_PERSON
                                        && r.available(cut)));
    return new Batch(
        List.copyOf(subjects),
        List.copyOf(latest.values()),
        urls,
        List.copyOf(structuredUrls),
        complete,
        8,
        System.nanoTime() - start);
  }
}
