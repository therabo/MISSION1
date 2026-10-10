package org.mission1.crew.automatic;

import static org.mission1.crew.automatic.IdentityEvidence.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.jsoup.Jsoup;
import org.mission1.crew.application.CrewEditorialRepository;
import org.mission1.crew.domain.CrewEditorial.*;
import org.mission1.source.crew.CrewHttpReader;
import org.mission1.source.crew.nasa.NasaEditorialParser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

/**
 * SELECT-only source adapter. No canonical profile, resolution audit, V7 table or manifest access.
 */
@Repository
public class RetainedIdentityEvidence {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final CrewEditorialRepository editorial;
  private final NasaEditorialParser parser;

  public RetainedIdentityEvidence(
      JdbcTemplate jdbc,
      ObjectMapper json,
      CrewEditorialRepository editorial,
      NasaEditorialParser parser) {
    this.jdbc = jdbc;
    this.json = json;
    this.editorial = editorial;
    this.parser = parser;
  }

  public record Batch(List<IdentityEvidence> evidence, int queries) {}

  private static Instant time(Object o) {
    return ((java.sql.Timestamp) o).toInstant();
  }

  private String encode(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  private String hash(Object o) {
    return CrewHttpReader.sha256(encode(o).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  private JsonNode node(String s) {
    try {
      return json.readTree(s);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  private static String agency(String s) {
    if (s == null) return null;
    String text = s.toLowerCase(Locale.ROOT);
    if (text.contains("roscosmos") || text.equals("rfsa")) return "RFSA";
    if (text.equals("nasa") || text.contains("national aeronautics")) return "NASA";
    if (text.equals("csa") || text.contains("canadian space")) return "CSA";
    if (text.equals("esa") || text.contains("european space")) return "ESA";
    if (text.equals("jaxa") || text.contains("japan aerospace")) return "JAXA";
    return s;
  }

  private IdentityEvidence facts(
      String key,
      Provider provider,
      IdentityEvidence.Kind kind,
      String name,
      String bio,
      String agency,
      Set<Witness> qualifiers,
      Set<String> missions,
      List<String> conflicts,
      List<Reference> refs) {
    return new IdentityEvidence(
        key,
        provider,
        kind,
        name,
        IdentityFeatures.aliases(name, bio),
        bio,
        agency(agency),
        null,
        false,
        IdentityFeatures.years(bio),
        missions,
        qualifiers,
        conflicts,
        refs);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Batch load(Instant by) {
    List<IdentityEvidence> result = new ArrayList<>();
    var ll2 =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(o.external_id) o.*,s.content_hash,r.completed_at
            FROM crew_person_observation o JOIN crew_source_snapshot s ON s.id=o.snapshot_id
            JOIN crew_source_sync_run r ON r.snapshot_id=s.id AND r.result_state='SUCCESS'
            WHERE o.source='LAUNCH_LIBRARY_2' AND r.completed_at<=?
            ORDER BY o.external_id,r.completed_at DESC,r.id DESC LIMIT 10001
            """,
            by.atOffset(ZoneOffset.UTC));
    for (var row : ll2) {
      String name = (String) row.get("display_name"),
          bio = Objects.toString(row.get("biography"), "");
      String a =
          row.get("agency") == null
              ? null
              : node(row.get("agency").toString()).path("abbreviation").asText(null);
      String id = row.get("snapshot_id") + ":" + row.get("person_id");
      result.add(
          facts(
              "LL2:PERSON:" + row.get("external_id"),
              Provider.LL2,
              IdentityEvidence.Kind.PERSON,
              name,
              bio,
              a,
              Set.of(Witness.PERSON_SCOPED_HISTORY),
              IdentityFeatures.missions(bio),
              List.of(),
              List.of(
                  new Reference(
                      "crew_person_observation",
                      id,
                      (String) row.get("content_hash"),
                      "external_id:" + row.get("external_id"),
                      time(row.get("completed_at"))))));
    }
    var ops =
        jdbc.queryForList(
            """
            SELECT DISTINCT ON(coalesce(v.subject_key,'legacy:'||s.evidence_id||':'||s.subject_index))
            coalesce(v.subject_key,'legacy:'||s.evidence_id||':'||s.subject_index) subject_key,s.*,e.evidence_hash,d.retrieved_at
            FROM crew_evidence_subject s JOIN crew_verification_evidence e ON e.id=s.evidence_id
            JOIN crew_source_document d ON d.id=e.document_id
            LEFT JOIN crew_subject_version_link v ON v.evidence_id=s.evidence_id AND v.subject_index=s.subject_index
            LEFT JOIN crew_document_evidence de ON de.evidence_id=e.id
            LEFT JOIN crew_source_sync_run r ON r.verification_document_id=de.document_id AND r.result_state='SUCCESS'
            WHERE d.retrieved_at<=?
            ORDER BY coalesce(v.subject_key,'legacy:'||s.evidence_id||':'||s.subject_index),coalesce(r.completed_at,d.retrieved_at) DESC,s.evidence_id DESC LIMIT 10001
            """,
            by.atOffset(ZoneOffset.UTC));
    for (var r : ops)
      result.add(
          facts(
              "NASA:OPERATIONAL_SUBJECT:" + r.get("subject_key"),
              Provider.NASA,
              IdentityEvidence.Kind.OPERATIONAL_SUBJECT,
              (String) r.get("display_name"),
              "",
              null,
              Set.of(),
              Set.of(),
              List.of(),
              List.of(
                  new Reference(
                      "crew_evidence_subject",
                      r.get("evidence_id") + ":" + r.get("subject_index"),
                      (String) r.get("evidence_hash"),
                      Objects.toString(
                          r.get("official_profile_url"), "subject_index:" + r.get("subject_index")),
                      time(r.get("retrieved_at"))))));
    // One bounded set query supplies all retained personal versions, including referenced
    // ancestors.
    var captures =
        jdbc.queryForList(
            """
            SELECT a.*,d.content_hash,b.body FROM crew_editorial_acquisition a
            JOIN crew_source_document d ON d.id=a.document_id JOIN crew_document_body b ON b.content_hash=d.content_hash
            WHERE a.stream='NASA_PERSON_RESOURCE' AND a.outcome<>'FAILURE' AND a.completed_at<=?
            ORDER BY a.completed_at,a.id LIMIT 10001
            """,
            by.atOffset(ZoneOffset.UTC));
    Map<Long, Map<String, Object>> byId = new HashMap<>();
    Map<String, Map<String, Object>> newest = new TreeMap<>();
    for (var r : captures) {
      byId.put(((Number) r.get("id")).longValue(), r);
      try {
        var n = bodyJson(r);
        if (n.isObject() && n.path("type").isTextual())
          newest.put(n.path("type").asText() + ":" + n.path("id").asText(), r);
      } catch (Exception ignored) {
        /* retained HTML acquisition, not the typed REST version */
      }
    }
    for (var r : newest.values()) {
      var resource = resource(r);
      String name = cleanName(resource.title());
      if (!parser.about(resource, name)) continue;
      String bio = biography(r);
      boolean people =
          resource.kind() == org.mission1.crew.domain.CrewEditorial.Kind.NASA_PEOPLE_RESOURCE;
      result.add(
          facts(
              "NASA:PERSONAL_RESOURCE:" + resource.key(),
              Provider.NASA,
              IdentityEvidence.Kind.PERSONAL_RESOURCE,
              name,
              people ? bio : "",
              null,
              people
                  ? Set.of(Witness.VALIDATED_BIOGRAPHY, Witness.PERSON_SCOPED_HISTORY)
                  : Set.of(),
              people ? IdentityFeatures.missions(bio) : Set.of(),
              List.of(),
              List.of(reference(r, "content/rendered:" + resource.canonicalUrl()))));
    }
    var roster = editorial.latestRoster(by);
    if (roster.isPresent()) {
      var root = roster.get();
      for (var member : root.roster().members()) {
        Set<Witness> q = new TreeSet<>();
        Set<String> missions = new TreeSet<>();
        List<Reference> refs = new ArrayList<>();
        List<String> conflicts = new ArrayList<>(member.conflicts());
        String bio = "";
        refs.add(
            new Reference(
                "crew_editorial_roster_member",
                root.id() + ":" + member.index(),
                hash(member),
                "member_index:" + member.index(),
                root.capturedAt()));
        for (var m : member.mentions())
          if (m.captionKind() == CaptionKind.PERSONAL_FLIGHT_CAPTION
              && String.join(" ", IdentityFeatures.tokens(m.caption()))
                  .contains(String.join(" ", IdentityFeatures.tokens(member.name())))) {
            missions.addAll(IdentityFeatures.missions(m.caption()));
            q.add(Witness.PERSONAL_FLIGHT_CAPTION);
          }
        Map<String, Relation> relations = new TreeMap<>();
        // Repository returns retained versions in insertion order. Only a relation for an actual
        // current link is eligible.
        for (var rel : root.relations())
          if (rel.memberIndex() == member.index()) relations.put(rel.observedUrl(), rel);
        for (var rel : relations.values()) {
          if (rel.status() == RelationStatus.REJECTED_MISMATCH) {
            conflicts.add("REJECTED_PERSON_LINK:" + rel.observedUrl());
            continue;
          }
          if (rel.status() != RelationStatus.VERIFIED_ABOUT_PERSON_RELATION
              || rel.target() == null
              || !parser.about(rel.target(), member.name())) continue;
          var capture = byId.get(rel.acquisitionId());
          if (capture == null) continue;
          // Target's latest successful source revision must still describe this person (failures
          // retain last-good).
          var target = rel.target();
          var latest =
              newest.get(
                  (target.kind() == org.mission1.crew.domain.CrewEditorial.Kind.NASA_PEOPLE_RESOURCE
                          ? "people"
                          : "topic")
                      + ":"
                      + target.wpId());
          if (latest == null || !parser.about(resource(latest), member.name())) {
            conflicts.add("REJECTED_CHANGED_TARGET");
            continue;
          }
          refs.add(reference(latest, rel.locator()));
          if (target.kind() == org.mission1.crew.domain.CrewEditorial.Kind.NASA_PEOPLE_RESOURCE) {
            bio = biography(latest);
            q.add(Witness.VALIDATED_BIOGRAPHY);
            q.add(Witness.TYPED_PEOPLE_RELATION);
            q.add(Witness.PERSON_SCOPED_HISTORY);
            missions.addAll(IdentityFeatures.missions(bio));
          }
        }
        result.add(
            facts(
                "NASA:EDITORIAL_SLOT:" + root.resource().key() + ":" + member.index(),
                Provider.NASA,
                IdentityEvidence.Kind.EDITORIAL_SLOT,
                member.name(),
                bio,
                member.agency(),
                q,
                missions,
                conflicts,
                refs));
      }
    }
    if (result.size() > IdentityCandidates.MAX_IDENTITIES || captures.size() > 10000)
      throw new IllegalStateException("Retained identity scope exceeds bounded importer");
    return new Batch(
        result.stream().sorted(Comparator.comparing(IdentityEvidence::key)).toList(),
        roster.isPresent() ? 7 : 4);
  }

  private Resource resource(Map<String, Object> r) {
    try {
      return json.readValue(r.get("resource_metadata").toString(), Resource.class);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  private JsonNode bodyJson(Map<String, Object> r) throws java.io.IOException {
    var n = json.readTree((byte[]) r.get("body"));
    if (n.isArray() && n.size() == 1) n = n.get(0);
    if (n.isObject() && n.path("id").asLong() != resource(r).wpId())
      throw new IllegalArgumentException("Personal REST resource ownership");
    return n;
  }

  private String biography(Map<String, Object> r) {
    try {
      var n = bodyJson(r);
      var d = Jsoup.parse(n.path("content").path("rendered").asText());
      d.select("script,style,nav,header,footer,iframe,template").remove();
      String text = d.text();
      if (text.length() > 100000) throw new IllegalArgumentException("Biography bound");
      return text;
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  private Reference reference(Map<String, Object> r, String locator) {
    return new Reference(
        "crew_editorial_acquisition",
        r.get("id").toString(),
        (String) r.get("content_hash"),
        locator,
        time(r.get("completed_at")));
  }

  private static String cleanName(String title) {
    return title
        .replaceAll("(?i)NASA Astronaut\\s*:?\\s*|\\([^)]*\\)|,?\\s*Ph\\.?D\\.?", "")
        .split(" [–—] ")[0]
        .trim();
  }
}
