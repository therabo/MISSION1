package org.mission1.crew.persistence;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.CrewSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

import java.time.*;
import java.util.*;

/** Two bounded set-based knowledge reads; reviewed writes share the source identity lock. */
@Repository
public class JdbcCrewIdentityRepository implements CrewIdentityRepository {
    private final JdbcTemplate jdbc;

    public JdbcCrewIdentityRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public CrewCanonicalIdentity knowledge(Instant at) {
        var links =
                jdbc.query(
                        """
                        SELECT * FROM (SELECT DISTINCT ON(left_person_id,right_person_id) * FROM crew_person_equivalence_decision
                        WHERE known_at<=? ORDER BY left_person_id,right_person_id,known_at DESC,id DESC) latest WHERE status='ACTIVE'
                        """,
                        (r, n) ->
                                new CrewCanonicalIdentity.Link(
                                        r.getObject("alias_id", UUID.class),
                                        r.getObject("representative_id", UUID.class)),
                        utc(at));
        Map<CrewCanonicalIdentity.Key, UUID> bindings = new HashMap<>();
        jdbc.query(
                """
                SELECT * FROM (SELECT DISTINCT ON(source,entity_kind,external_key) * FROM crew_identity_binding_version
                WHERE known_at<=? ORDER BY source,entity_kind,external_key,known_at DESC,id DESC) latest WHERE status='ACTIVE'
                """,
                r -> {
                    bindings.put(
                            new CrewCanonicalIdentity.Key(
                                    CrewSource.valueOf(r.getString("source")),
                                    r.getString("entity_kind"),
                                    r.getString("external_key")),
                            r.getObject("person_id", UUID.class));
                },
                utc(at));
        return new CrewCanonicalIdentity(links, bindings);
    }

    public record Proposal(
            String declaration,
            Map<String, UUID> found,
            UUID representative,
            UUID alias,
            String status) {}

    public record Report(
            String policy,
            int declarations,
            int identitiesFound,
            int proposals,
            int alreadyActive,
            int pending,
            List<Proposal> items) {}

    @Transactional(readOnly = true)
    public Report preview(Instant at) {
        return synchronize(ReviewedCrewIdentities.load(), at, false);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Report apply(Instant at) {
        return synchronize(ReviewedCrewIdentities.load(), at, true);
    }

    /** Also used inside an existing source-write transaction, never from a read port. */
    public Report synchronize(ReviewedCrewIdentities manifest, Instant at, boolean write) {
        ReviewedCrewIdentities.validate(manifest);
        if (write) jdbc.execute("SELECT pg_advisory_xact_lock(73491,1)");
        if (manifest.declarations().stream()
                .flatMap(d -> d.evidence().stream())
                .anyMatch(p -> Instant.parse(p.capturedAt()).isAfter(at)))
            return new Report(
                    CrewCanonicalIdentity.VERSION,
                    manifest.declarations().size(),
                    0,
                    0,
                    0,
                    manifest.declarations().size(),
                    List.of());
        var knowledge = knowledge(at);
        Map<String, UUID> originals = new HashMap<>();
        jdbc.query(
                "SELECT source,external_id,person_id FROM crew_person_external_id",
                r -> {
                    originals.put(
                            r.getString(1) + ":" + r.getString(2), r.getObject(3, UUID.class));
                });
        Map<UUID, Instant> created = new HashMap<>();
        jdbc.query(
                "SELECT id,created_at FROM crew_person",
                r -> {
                    created.put(
                            r.getObject(1, UUID.class),
                            r.getObject(2, OffsetDateTime.class).toInstant());
                });
        var latest =
                jdbc.queryForList(
                        "SELECT DISTINCT ON(source,entity_kind,external_key) * FROM"
                            + " crew_identity_binding_version ORDER BY"
                            + " source,entity_kind,external_key,known_at DESC,id DESC");
        var proposals = new ArrayList<Proposal>();
        int foundCount = 0, activeCount = 0, pending = 0, newPairs = 0;
        // Validate the whole plan before the first insert. Exceptions roll back the enclosing
        // transaction.
        for (var d : manifest.declarations()) {
            Map<String, UUID> found = new LinkedHashMap<>();
            for (var i : d.identities()) {
                var id = originals.get(i.source() + ":" + i.externalKey());
                if (id != null) {
                    found.put(i.source() + ":" + i.externalKey(), id);
                    foundCount++;
                }
            }
            UUID rep = null, alias = null;
            String status = "PENDING";
            boolean revoked =
                    d.identities().stream()
                            .anyMatch(
                                    i ->
                                            latest.stream()
                                                    .anyMatch(
                                                            b ->
                                                                    matches(b, i)
                                                                            && b.get("status")
                                                                                    .equals(
                                                                                            "REVOKED")
                                                                            && b.get(
                                                                                            "declaration_key")
                                                                                    .equals(
                                                                                            d
                                                                                                    .key())));
            if (revoked) status = "REVOKED";
            else if (found.size() == 2) {
                var anchors =
                        found.values().stream()
                                .distinct()
                                .sorted(
                                        Comparator.comparing((UUID id) -> created.get(id))
                                                .thenComparing(UUID::toString))
                                .toList();
                rep = anchors.getFirst();
                alias = anchors.size() == 2 ? anchors.getLast() : null;
                if (!knowledge.canonicalize(rep).equals(rep)
                        || (alias != null
                                && !knowledge.canonicalize(alias).equals(alias)
                                && !knowledge.canonicalize(alias).equals(rep)))
                    throw new IllegalStateException(
                            "Blocking reviewed equivalence conflict: " + d.key());
                for (var i : d.identities()) {
                    UUID bound = knowledge.resolveProviderIdentity(i.typed());
                    if (bound != null && !bound.equals(rep))
                        throw new IllegalStateException(
                                "Blocking provider binding conflict: " + d.key());
                }
                boolean active =
                        d.identities().stream()
                                .allMatch(
                                        i -> knowledge.resolveProviderIdentity(i.typed()) != null);
                status = active ? "ALREADY_ACTIVE" : "PROPOSED";
                if (active) activeCount++;
                else if (alias != null) newPairs++;
            } else pending++;
            proposals.add(new Proposal(d.key(), Map.copyOf(found), rep, alias, status));
        }
        var plannedLinks = new ArrayList<CrewCanonicalIdentity.Link>();
        created.keySet()
                .forEach(
                        id -> {
                            var root = knowledge.canonicalize(id);
                            if (!root.equals(id))
                                plannedLinks.add(new CrewCanonicalIdentity.Link(id, root));
                        });
        for (var p : proposals)
            if (p.status().equals("PROPOSED") && p.alias() != null)
                plannedLinks.add(new CrewCanonicalIdentity.Link(p.alias(), p.representative()));
        new CrewCanonicalIdentity(
                plannedLinks,
                knowledge.bindings()); // Dry-run validates cross-declaration conflicts too.
        if (write)
            for (int n = 0; n < manifest.declarations().size(); n++) {
                var d = manifest.declarations().get(n);
                var p = proposals.get(n);
                if (p.status().equals("ALREADY_ACTIVE") || p.status().equals("REVOKED")) continue;
                Long equivalence = null;
                if (p.alias() != null
                        && !knowledge.canonicalize(p.alias()).equals(p.representative())) {
                    var pair =
                            List.of(p.representative(), p.alias()).stream()
                                    .sorted(Comparator.comparing(UUID::toString))
                                    .toList();
                    equivalence =
                            jdbc.queryForObject(
                                    """
                                    INSERT INTO crew_person_equivalence_decision(declaration_key,left_person_id,right_person_id,representative_id,status,method,policy_version,decided_at,known_at,actor_category)
                                    VALUES (?,?,?,?,'ACTIVE','REVIEWED_SAME_HUMAN',?,?,?,?) RETURNING id
                                    """,
                                    Long.class,
                                    d.key(),
                                    pair.getFirst(),
                                    pair.getLast(),
                                    p.representative(),
                                    CrewCanonicalIdentity.VERSION,
                                    utc(at),
                                    utc(at),
                                    d.actor());
                    proof(d, equivalence, null);
                }
                for (var i : d.identities()) {
                    var old = latest.stream().filter(b -> matches(b, i)).findFirst().orElse(null);
                    String state = p.representative() == null ? "PENDING" : "ACTIVE";
                    if (old != null
                            && old.get("status").equals(state)
                            && Objects.equals(old.get("person_id"), p.representative())) continue;
                    Long id =
                            jdbc.queryForObject(
                                    """
                                    INSERT INTO crew_identity_binding_version(declaration_key,source,entity_kind,external_key,person_id,status,method,policy_version,decided_at,known_at,actor_category,predecessor_id,context)
                                    VALUES (?,?,?,?,?,?,'REVIEWED_SAME_HUMAN',?,?,?,?,?,?::jsonb) RETURNING id
                                    """,
                                    Long.class,
                                    d.key(),
                                    i.source(),
                                    i.entityKind(),
                                    i.externalKey(),
                                    p.representative(),
                                    state,
                                    CrewCanonicalIdentity.VERSION,
                                    utc(at),
                                    utc(at),
                                    d.actor(),
                                    old == null ? null : old.get("id"),
                                    "{\"manifest\":\""
                                            + manifest.version()
                                            + "\",\"negativeChecks\":\"no conflicting active"
                                            + " binding, cycle or transitive equivalence; explicit"
                                            + " human approval\"}");
                    proof(d, null, id);
                }
            }
        return new Report(
                CrewCanonicalIdentity.VERSION,
                manifest.declarations().size(),
                foundCount,
                newPairs,
                activeCount,
                pending,
                List.copyOf(proposals));
    }

    private static boolean matches(Map<String, Object> b, ReviewedCrewIdentities.Identity i) {
        return b.get("source").equals(i.source())
                && b.get("entity_kind").equals(i.entityKind())
                && b.get("external_key").equals(i.externalKey());
    }

    private void proof(ReviewedCrewIdentities.Declaration d, Long equivalence, Long binding) {
        for (var p : d.evidence())
            jdbc.update(
                    """
                    INSERT INTO crew_identity_decision_evidence(binding_id,equivalence_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary,retained_evidence_id)
                    VALUES (?,?,?,?,?,?,?,?,?,(SELECT id FROM crew_verification_evidence WHERE evidence_hash=?))
                    """,
                    binding,
                    equivalence,
                    p.category(),
                    p.role(),
                    p.url(),
                    utc(Instant.parse(p.capturedAt())),
                    p.captureHash(),
                    p.locator(),
                    p.summary(),
                    p.role().equals("NASA_RETAINED_OPERATIONAL") ? p.captureHash() : null);
    }

    /** Explicit reviewed correction; compare-and-append, never an update of an original mapping. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long supersedeBinding(
            CrewCanonicalIdentity.Key key,
            UUID representative,
            long expectedPredecessor,
            Instant at,
            String reason,
            List<ReviewedCrewIdentities.Proof> evidence) {
        if (reason == null
                || reason.isBlank()
                || reason.length() > 1000
                || evidence == null
                || evidence.isEmpty()
                || evidence.size() > 20)
            throw new IllegalArgumentException("Bounded reviewed correction and proof required");
        for (var p : evidence) {
            var url = java.net.URI.create(p.url());
            if (!"https".equals(url.getScheme())
                    || url.getHost() == null
                    || !p.captureHash().matches("[0-9a-f]{64}")
                    || p.summary().isBlank()
                    || p.summary().length() > 2000
                    || Instant.parse(p.capturedAt()).isAfter(at))
                throw new IllegalArgumentException("Reproducible correction proof required");
        }
        jdbc.execute("SELECT pg_advisory_xact_lock(73491,1)");
        var old =
                jdbc.queryForMap(
                        "SELECT * FROM crew_identity_binding_version WHERE source=? AND"
                            + " entity_kind=? AND external_key=? ORDER BY known_at DESC,id DESC"
                            + " LIMIT 1",
                        key.source().name(),
                        key.entityKind(),
                        key.externalKey());
        if (((Number) old.get("id")).longValue() != expectedPredecessor)
            throw new IllegalStateException("Correction predecessor changed");
        Long next =
                jdbc.queryForObject(
                        """
                        INSERT INTO crew_identity_binding_version(declaration_key,source,entity_kind,external_key,person_id,status,method,policy_version,decided_at,known_at,actor_category,predecessor_id,context)
                        VALUES (?,?,?,?,?,'ACTIVE','REVIEWED_SAME_HUMAN',?,?,?,'MAINTAINER_REVIEWED',?,jsonb_build_object('correction',?::text)) RETURNING id
                        """,
                        Long.class,
                        old.get("declaration_key"),
                        key.source().name(),
                        key.entityKind(),
                        key.externalKey(),
                        representative,
                        CrewCanonicalIdentity.VERSION,
                        utc(at),
                        utc(at),
                        expectedPredecessor,
                        reason);
        proof(
                new ReviewedCrewIdentities.Declaration(
                        old.get("declaration_key").toString(),
                        "REVIEWED_SAME_HUMAN",
                        "MAINTAINER_REVIEWED",
                        List.of(),
                        evidence),
                null,
                next);
        return next;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revoke(String declaration, Instant at, String reason) {
        if (reason == null || reason.isBlank() || reason.length() > 1000)
            throw new IllegalArgumentException("Reviewed correction reason required");
        jdbc.execute("SELECT pg_advisory_xact_lock(73491,1)");
        var pairs =
                jdbc.queryForList(
                        "SELECT * FROM crew_active_equivalence WHERE declaration_key=?",
                        declaration);
        for (var p : pairs) {
            Long next =
                    jdbc.queryForObject(
                            """
                            INSERT INTO crew_person_equivalence_decision(declaration_key,left_person_id,right_person_id,representative_id,status,method,policy_version,decided_at,known_at,actor_category,predecessor_id)
                            VALUES (?,?,?,?,'REVOKED','REVIEWED_SAME_HUMAN',?,?,?,'MAINTAINER_REVIEWED',?) RETURNING id
                            """,
                            Long.class,
                            declaration,
                            p.get("left_person_id"),
                            p.get("right_person_id"),
                            p.get("representative_id"),
                            CrewCanonicalIdentity.VERSION,
                            utc(at),
                            utc(at),
                            p.get("id"));
            jdbc.update(
                    """
                    INSERT INTO crew_identity_decision_evidence(equivalence_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary)
                    SELECT ?,source_category,'REVIEWED_REVOCATION',source_url,captured_at,capture_hash,locator,? FROM crew_identity_decision_evidence WHERE equivalence_id=?
                    """,
                    next,
                    reason,
                    p.get("id"));
        }
        var bindings =
                jdbc.queryForList(
                        "SELECT * FROM (SELECT DISTINCT ON(source,entity_kind,external_key) * FROM"
                            + " crew_identity_binding_version ORDER BY"
                            + " source,entity_kind,external_key,known_at DESC,id DESC) latest WHERE"
                            + " declaration_key=? AND status<>'REVOKED'",
                        declaration);
        for (var b : bindings) {
            Long next =
                    jdbc.queryForObject(
                            """
                            INSERT INTO crew_identity_binding_version(declaration_key,source,entity_kind,external_key,person_id,status,method,policy_version,decided_at,known_at,actor_category,predecessor_id,context)
                            VALUES (?,?,?,?,?,'REVOKED','REVIEWED_SAME_HUMAN',?,?,?,'MAINTAINER_REVIEWED',?,jsonb_build_object('correction',?::text)) RETURNING id
                            """,
                            Long.class,
                            declaration,
                            b.get("source"),
                            b.get("entity_kind"),
                            b.get("external_key"),
                            b.get("person_id"),
                            CrewCanonicalIdentity.VERSION,
                            utc(at),
                            utc(at),
                            b.get("id"),
                            reason);
            jdbc.update(
                    """
                    INSERT INTO crew_identity_decision_evidence(binding_id,source_category,evidence_role,source_url,captured_at,capture_hash,locator,summary)
                    SELECT ?,source_category,'REVIEWED_REVOCATION',source_url,captured_at,capture_hash,locator,? FROM crew_identity_decision_evidence WHERE binding_id=?
                    """,
                    next,
                    reason,
                    b.get("id"));
        }
    }

    private static OffsetDateTime utc(Instant at) {
        return at.atOffset(ZoneOffset.UTC);
    }
}
