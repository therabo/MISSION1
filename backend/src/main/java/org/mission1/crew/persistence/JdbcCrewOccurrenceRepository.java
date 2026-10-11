package org.mission1.crew.persistence;

import static org.mission1.crew.application.CrewOccurrenceFingerprint.*;
import static org.mission1.crew.persistence.JdbcCrewVerificationRepository.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.mission1.source.crew.nasa.NasaCrewArticleReader;
import org.springframework.jdbc.core.JdbcTemplate;

/** Set-based reads and batched additive writes under the verification repository's transaction. */
final class JdbcCrewOccurrenceRepository {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final NasaCrewArticleReader articles = new NasaCrewArticleReader();
  private final CrewOccurrencePlanner planner = new CrewOccurrencePlanner();

  JdbcCrewOccurrenceRepository(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  CrewOccurrencePlanner.Report preview(List<CrewVerificationRepository.Evidence> evidence) {
    record Metadata(String hash, String parser, String version) {}
    var metadata = new HashMap<Long, Metadata>();
    jdbc.query(
        "SELECT id,evidence_hash,parser_name,parser_version FROM crew_verification_evidence",
        r -> {
          metadata.put(r.getLong(1), new Metadata(r.getString(2), r.getString(3), r.getString(4)));
        });
    var articleByDocument = new HashMap<Long, List<CrewSourceArticle>>();
    jdbc.query(
        "SELECT d.*,b.body FROM crew_source_document d JOIN crew_document_body b"
            + " USING(content_hash) WHERE d.parsed",
        r -> {
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
          articleByDocument.put(
              r.getLong("id"),
              articles.read(
                  new CrewSourceDocument(
                      NasaSourceType.valueOf(r.getString("source_type")), o, r.getBytes("body"))));
        });
    var documentsByEvidence = new HashMap<Long, List<Long>>();
    jdbc.query(
        "SELECT evidence_id,document_id FROM crew_document_evidence ORDER BY"
            + " evidence_id,document_id",
        r -> {
          documentsByEvidence
              .computeIfAbsent(r.getLong(1), x -> new ArrayList<>())
              .add(r.getLong(2));
        });
    var captures = new HashMap<Long, List<CrewOccurrenceVersion.Observation>>();
    jdbc.query(
"""
SELECT DISTINCT r.id,r.verification_document_id,r.retrieved_at,r.started_at,r.completed_at,d.id AS interpreted_document
FROM crew_source_sync_run r JOIN crew_source_document captured ON captured.id=r.verification_document_id
JOIN crew_source_document d ON d.id=captured.id OR (d.parser_name='NasaOperationalFeedParser'
 AND d.parser_version IN ('1.1.0','1.2.0') AND d.source_url=captured.source_url AND d.content_hash=captured.content_hash)
WHERE r.source='NASA_OFFICIAL' AND d.parsed
AND (r.result_state='SUCCESS' OR (d.parser_version IN ('1.1.0','1.2.0') AND r.source_state='MALFORMED_RESPONSE'))
ORDER BY r.verification_document_id,r.retrieved_at,r.completed_at,r.started_at,r.id
""",
        r -> {
          captures
              .computeIfAbsent(r.getLong("interpreted_document"), x -> new ArrayList<>())
              .add(
                  new CrewOccurrenceVersion.Observation(
                      r.getLong(1),
                      r.getLong(2),
                      instant(r, "retrieved_at"),
                      instant(r, "started_at"),
                      instant(r, "completed_at")));
        });
    var inputs = new ArrayList<CrewOccurrencePlanner.Input>();
    for (var e : evidence) {
      var locators = new ArrayList<CrewOccurrencePlanner.Locator>();
      var observations = new ArrayList<CrewOccurrenceVersion.Observation>();
      boolean missing = false;
      for (var document : documentsByEvidence.getOrDefault(e.id(), List.of())) {
        int before = locators.size();
        for (var article : articleByDocument.getOrDefault(document, List.of())) {
          if (!article.observedUrl().equals(e.value().observation().sourceUrl())
              || !Objects.equals(
                  article.publishedAt(), e.value().observation().sourcePublishedAt())) continue;
          for (var paragraph : article.paragraphs())
            if (normalize(paragraph.text()).equals(normalize(e.value().supportingExcerpt())))
              locators.add(new CrewOccurrencePlanner.Locator(document, article, paragraph.index()));
        }
        if (locators.size() == before) missing = true;
        observations.addAll(captures.getOrDefault(document, List.of()));
      }
      var m = metadata.get(e.id());
      inputs.add(
          new CrewOccurrencePlanner.Input(
              e, m.hash(), m.parser(), m.version(), missing ? List.of() : locators, observations));
    }
    return planner.plan(inputs, existing());
  }

  private Map<Long, String> existing() {
    // Allows a genuine read-only dry run against V5 before applying the additive migration.
    if (jdbc.queryForObject(
            "SELECT to_regclass('crew_assertion_version') IS NOT NULL", Boolean.class)
        != Boolean.TRUE) return Map.of();
    var result = new HashMap<Long, String>();
    jdbc.query(
        "SELECT evidence_id,occurrence_key FROM crew_assertion_version",
        r -> {
          result.put(r.getLong(1), r.getString(2));
        });
    return result;
  }

  void store(CrewOccurrencePlanner.Report report) {
    var articleRows = new TreeMap<String, Object[]>();
    var observationRows = new TreeMap<String, Object[]>();
    var occurrences = new TreeMap<String, Object[]>();
    var evidenceRows = new ArrayList<Object[]>();
    var scopeRows = new ArrayList<Object[]>();
    var subjectRows = new TreeMap<String, Object[]>();
    var metadataRows = new TreeMap<String, Object[]>();
    var links = new ArrayList<Object[]>();
    for (var a : report.associations()) {
      var input = a.input();
      long eid = input.evidence().id();
      if (a.articleKey() != null)
        for (var l : input.locators()) {
          var source = l.article();
          articleRows.put(a.articleKey(), new Object[] {a.articleKey()});
          observationRows.put(
              l.documentId() + ":" + a.articleKey(),
              new Object[] {
                l.documentId(),
                a.articleKey(),
                source.rawGuid(),
                source.rawUrl(),
                source.observedUrl().toString(),
                utc(source.publishedAt()),
                source.representationHash()
              });
          scopeRows.add(
              new Object[] {
                eid, l.documentId(), a.occurrenceKey(), a.articleKey(), l.paragraphIndex()
              });
        }
      occurrences.putIfAbsent(
          a.occurrenceKey(),
          new Object[] {
            a.occurrenceKey(),
            a.articleKey(),
            a.candidateKey(),
            a.guardKey(),
            a.status(),
            CrewOccurrencePlanner.VERSION
          });
      evidenceRows.add(new Object[] {eid, a.occurrenceKey()});
      for (var s : a.subjects()) {
        var p = input.evidence().value().people().get(s.evidenceIndex());
        String version = hash(List.of(s.occurrenceKey(), s.payloadKey()));
        subjectRows.putIfAbsent(
            s.occurrenceKey(),
            new Object[] {s.occurrenceKey(), a.occurrenceKey(), normalize(p.displayName())});
        metadataRows.putIfAbsent(
            version,
            new Object[] {
              version,
              s.occurrenceKey(),
              s.payloadKey(),
              p.displayName(),
              p.officialProfileUrl() == null ? null : p.officialProfileUrl().toString(),
              encode(p.externalIds())
            });
        links.add(
            new Object[] {eid, s.evidenceIndex(), a.occurrenceKey(), s.occurrenceKey(), version});
      }
    }
    batch(
        "INSERT INTO crew_source_article(article_key,source) VALUES (?,'NASA_OFFICIAL') ON CONFLICT"
            + " DO NOTHING",
        articleRows.values());
    batch(
"""
INSERT INTO crew_source_article_observation(document_id,article_key,raw_guid,raw_url,observed_url,source_published_at,representation_hash)
VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING
""",
        observationRows.values());
    batch(
"""
INSERT INTO crew_assertion_occurrence(occurrence_key,article_key,candidate_key,guard_key,association_status,identity_policy)
VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING
""",
        occurrences.values());
    batch(
        "INSERT INTO crew_assertion_version(evidence_id,occurrence_key) VALUES (?,?) ON CONFLICT DO"
            + " NOTHING",
        evidenceRows);
    batch(
        "INSERT INTO"
            + " crew_assertion_observation(evidence_id,document_id,occurrence_key,article_key,paragraph_index)"
            + " VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
        scopeRows);
    batch(
        "INSERT INTO crew_subject_occurrence(subject_key,occurrence_key,source_mention) VALUES"
            + " (?,?,?) ON CONFLICT DO NOTHING",
        subjectRows.values());
    batch(
"""
INSERT INTO crew_subject_metadata_version(version_key,subject_key,payload_key,display_name,official_profile_url,external_ids)
VALUES (?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING
""",
        metadataRows.values());
    batch(
        "INSERT INTO"
            + " crew_subject_version_link(evidence_id,subject_index,occurrence_key,subject_key,version_key)"
            + " VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
        links);
  }

  private void batch(String sql, Collection<Object[]> rows) {
    if (!rows.isEmpty()) jdbc.batchUpdate(sql, new ArrayList<>(rows));
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Cannot encode subject metadata", e);
    }
  }

  List<CrewOccurrenceVersion> versionsAsOf(Instant asOf) {
    record Version(String key, String hash) {}
    var versions = new TreeMap<Long, Version>();
    var observations = new HashMap<Long, List<CrewOccurrenceVersion.Observation>>();
    jdbc.query(
"""
SELECT DISTINCT v.evidence_id,v.occurrence_key,e.evidence_hash,r.id AS run_id,r.verification_document_id,
       r.retrieved_at,r.started_at,r.completed_at
FROM crew_assertion_version v JOIN crew_verification_evidence e ON e.id=v.evidence_id
LEFT JOIN crew_assertion_observation o ON o.evidence_id=v.evidence_id
LEFT JOIN crew_source_document d ON d.id=o.document_id
LEFT JOIN crew_source_document captured ON captured.id=d.id OR (d.parser_name='NasaOperationalFeedParser'
       AND d.parser_version IN ('1.1.0','1.2.0') AND captured.source_url=d.source_url AND captured.content_hash=d.content_hash)
LEFT JOIN crew_source_sync_run r ON r.verification_document_id=captured.id AND r.source='NASA_OFFICIAL'
       AND (r.result_state='SUCCESS' OR (d.parser_version IN ('1.1.0','1.2.0') AND d.parsed AND r.source_state='MALFORMED_RESPONSE'))
       AND r.retrieved_at<=?
ORDER BY v.evidence_id
""",
        r -> {
          long id = r.getLong("evidence_id");
          versions.put(
              id, new Version(r.getString("occurrence_key"), r.getString("evidence_hash")));
          if (r.getObject("run_id") != null)
            observations
                .computeIfAbsent(id, x -> new ArrayList<>())
                .add(
                    new CrewOccurrenceVersion.Observation(
                        r.getLong("run_id"),
                        r.getLong("verification_document_id"),
                        instant(r, "retrieved_at"),
                        instant(r, "started_at"),
                        instant(r, "completed_at")));
        },
        utc(asOf));
    return versions.entrySet().stream()
        .map(
            e ->
                new CrewOccurrenceVersion(
                    e.getValue().key(),
                    e.getKey(),
                    e.getValue().hash(),
                    observations.getOrDefault(e.getKey(), List.of())))
        .toList();
  }
}
