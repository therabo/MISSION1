package org.mission1.crew.persistence;

import static org.mission1.crew.persistence.JdbcCrewVerificationRepository.*;

import org.mission1.crew.application.CrewReconciliationRepository;
import org.mission1.crew.domain.*;
import org.mission1.crew.domain.CrewReconciliationSnapshot.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

import java.time.Instant;
import java.util.*;

@Repository
public class JdbcCrewReconciliationRepository implements CrewReconciliationRepository {
    private final JdbcTemplate jdbc;

    public JdbcCrewReconciliationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long startRun(Instant asOf, String version) {
        return jdbc.queryForObject(
                "INSERT INTO crew_reconciliation_run(started_at,algorithm_version,result_state)"
                    + " VALUES (?,?,'IN_PROGRESS') RETURNING id",
                Long.class,
                utc(asOf),
                version);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Result store(
            long run, CrewReconciliationSnapshot s, String stateKey, Instant completedAt) {
        jdbc.execute("SELECT pg_advisory_xact_lock(73491, 3)");
        var ids =
                jdbc.query(
                        """
INSERT INTO crew_reconciliation_snapshot(state_key,algorithm_version,reconciliation_as_of,primary_snapshot_id,primary_run_id,
    verification_run_id,primary_fetched_at,verification_fetched_at,status,official_crew_count,unidentified_count)
VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id
""",
                        (r, n) -> r.getLong(1),
                        stateKey,
                        s.algorithmVersion(),
                        utc(s.reconciliationAsOf()),
                        s.primarySnapshotId(),
                        s.primaryRunId(),
                        s.verificationRunId(),
                        utc(s.primaryFetchedAt()),
                        utc(s.verificationFetchedAt()),
                        s.status().name(),
                        s.officialCrewCount(),
                        s.unidentifiedCount());
        boolean inserted = !ids.isEmpty();
        long id =
                inserted
                        ? ids.getFirst()
                        : jdbc.queryForObject(
                                "SELECT id FROM crew_reconciliation_snapshot WHERE state_key=?",
                                Long.class,
                                stateKey);
        if (inserted) {
            batch(
                    "INSERT INTO crew_reconciliation_evidence(snapshot_id,evidence_id) VALUES"
                        + " (?,?)",
                    s.evidenceIds().stream().map(x -> new Object[] {id, x}).toList());
            batch(
                    "INSERT INTO crew_reconciliation_resolution(snapshot_id,resolution_id) VALUES"
                        + " (?,?)",
                    s.resolutionIds().stream().map(x -> new Object[] {id, x}).toList());
            batch(
                    "INSERT INTO"
                        + " crew_reconciled_person(snapshot_id,person_id,presence,last_known_presence,assertion_as_of,ll2_assigned)"
                        + " VALUES (?,?,?,?,?,?)",
                    s.people().stream()
                            .map(
                                    p ->
                                            new Object[] {
                                                id,
                                                p.personId(),
                                                p.presence().name(),
                                                string(p.lastKnownPresence()),
                                                utc(p.assertionAsOf()),
                                                p.ll2Assigned()
                                            })
                            .toList());
            batch(
                    "INSERT INTO crew_reconciled_person_evidence(snapshot_id,person_id,evidence_id)"
                        + " VALUES (?,?,?)",
                    s.people().stream()
                            .flatMap(
                                    p ->
                                            p.evidenceIds().stream()
                                                    .map(e -> new Object[] {id, p.personId(), e}))
                            .toList());
        }
        int changed =
                jdbc.update(
                        "UPDATE crew_reconciliation_run SET"
                            + " completed_at=?,result_state='SUCCESS',snapshot_id=? WHERE id=? AND"
                            + " result_state='IN_PROGRESS'",
                        utc(completedAt),
                        id,
                        run);
        if (changed != 1)
            throw new IllegalStateException("Reconciliation run missing or completed");
        return new Result(run, id, inserted);
    }

    private void batch(String sql, List<Object[]> values) {
        if (!values.isEmpty()) jdbc.batchUpdate(sql, values);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(long run, Instant at, String code) {
        if (jdbc.update(
                        "UPDATE crew_reconciliation_run SET"
                            + " completed_at=?,result_state='FAILURE',error_code=? WHERE id=? AND"
                            + " result_state='IN_PROGRESS'",
                        utc(at),
                        code,
                        run)
                != 1) throw new IllegalStateException("Reconciliation run missing or completed");
    }

    @Override
    public Optional<Run> latestRun() {
        return jdbc
                .query(
                        "SELECT * FROM crew_reconciliation_run ORDER BY started_at DESC,id DESC"
                            + " LIMIT 1",
                        (r, n) ->
                                new Run(
                                        r.getLong("id"),
                                        instant(r, "started_at"),
                                        instant(r, "completed_at"),
                                        r.getString("result_state"),
                                        r.getString("error_code"),
                                        r.getObject("snapshot_id", Long.class),
                                        r.getString("algorithm_version")))
                .stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Stored> latest() {
        var ids =
                jdbc.query(
                        "SELECT snapshot_id FROM crew_reconciliation_run WHERE"
                            + " result_state='SUCCESS' ORDER BY completed_at DESC,id DESC LIMIT 1",
                        (r, n) -> r.getLong(1));
        if (ids.isEmpty()) return Optional.empty();
        long id = ids.getFirst();
        var evidence =
                jdbc.query(
                        "SELECT evidence_id FROM crew_reconciliation_evidence WHERE snapshot_id=?"
                            + " ORDER BY evidence_id",
                        (r, n) -> r.getLong(1),
                        id);
        var documents =
                jdbc.query(
                        "SELECT DISTINCT e.document_id FROM crew_reconciliation_evidence i JOIN"
                            + " crew_verification_evidence e ON e.id=i.evidence_id WHERE"
                            + " i.snapshot_id=? ORDER BY e.document_id",
                        (r, n) -> r.getLong(1),
                        id);
        var resolutionIds =
                jdbc.query(
                        "SELECT resolution_id FROM crew_reconciliation_resolution WHERE"
                            + " snapshot_id=? ORDER BY resolution_id",
                        (r, n) -> r.getLong(1),
                        id);
        var unresolved =
                jdbc.query(
                        """
SELECT s.display_name,r.* FROM crew_reconciliation_resolution i JOIN crew_identity_resolution r ON r.id=i.resolution_id
JOIN crew_evidence_subject s ON s.evidence_id=r.evidence_id AND s.subject_index=r.subject_index
WHERE i.snapshot_id=? AND r.person_id IS NULL ORDER BY r.evidence_id,r.subject_index
""",
                        (r, n) -> {
                            var x = resolution(r);
                            return new UnresolvedSubject(
                                    x.evidenceId(),
                                    x.subjectIndex(),
                                    r.getString("display_name"),
                                    x.method(),
                                    x.candidates());
                        },
                        id);
        Map<UUID, List<Long>> personEvidence = new HashMap<>();
        jdbc.query(
                "SELECT person_id,evidence_id FROM crew_reconciled_person_evidence WHERE"
                    + " snapshot_id=? ORDER BY evidence_id",
                r -> {
                    personEvidence
                            .computeIfAbsent(r.getObject(1, UUID.class), x -> new ArrayList<>())
                            .add(r.getLong(2));
                },
                id);
        var people =
                jdbc
                        .query(
                                "SELECT * FROM crew_reconciled_person WHERE snapshot_id=? ORDER BY"
                                    + " person_id",
                                (r, n) ->
                                        new PersonState(
                                                r.getObject("person_id", UUID.class),
                                                Presence.valueOf(r.getString("presence")),
                                                r.getString("last_known_presence") == null
                                                        ? null
                                                        : Presence.valueOf(
                                                                r.getString("last_known_presence")),
                                                instant(r, "assertion_as_of"),
                                                personEvidence.getOrDefault(
                                                        r.getObject("person_id", UUID.class),
                                                        List.of()),
                                                r.getBoolean("ll2_assigned")),
                                id)
                        .stream()
                        .sorted(Comparator.comparing(PersonState::personId))
                        .toList();
        var both =
                people.stream()
                        .filter(p -> p.ll2Assigned() && p.presence() == Presence.CONFIRMED_ABOARD)
                        .map(PersonState::personId)
                        .toList();
        var ll2Only =
                people.stream()
                        .filter(p -> p.ll2Assigned() && p.presence() != Presence.CONFIRMED_ABOARD)
                        .map(PersonState::personId)
                        .toList();
        var nasaOnly =
                people.stream()
                        .filter(p -> !p.ll2Assigned() && p.presence() == Presence.CONFIRMED_ABOARD)
                        .map(PersonState::personId)
                        .toList();
        return jdbc
                .query(
                        "SELECT * FROM crew_reconciliation_snapshot WHERE id=?",
                        (r, n) ->
                                new Stored(
                                        id,
                                        new CrewReconciliationSnapshot(
                                                r.getString("algorithm_version"),
                                                instant(r, "reconciliation_as_of"),
                                                r.getObject("primary_snapshot_id", Long.class),
                                                r.getObject("primary_run_id", Long.class),
                                                r.getObject("verification_run_id", Long.class),
                                                instant(r, "primary_fetched_at"),
                                                instant(r, "verification_fetched_at"),
                                                ReconciliationStatus.valueOf(r.getString("status")),
                                                r.getObject("official_crew_count", Integer.class),
                                                r.getInt("unidentified_count"),
                                                people,
                                                unresolved,
                                                both,
                                                ll2Only,
                                                nasaOnly,
                                                evidence,
                                                resolutionIds,
                                                documents)),
                        id)
                .stream()
                .findFirst();
    }
}
