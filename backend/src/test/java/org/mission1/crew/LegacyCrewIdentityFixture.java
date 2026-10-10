package org.mission1.crew;

import org.mission1.crew.application.*;
import org.mission1.crew.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

/**
 * TEST_ONLY retained v1 audits: old scenarios exercise preserved history, never new v2 approval.
 */
public final class LegacyCrewIdentityFixture {
    private LegacyCrewIdentityFixture() {}

    public static void retainV1(
            JdbcTemplate jdbc, CrewVerificationRepository verification, Instant at) {
        var candidates =
                jdbc.query(
                        """
                        SELECT DISTINCT ON(p.person_id) p.person_id,p.display_name,p.official_profile_url
                        FROM crew_person_observation p JOIN crew_source_sync_run r ON r.snapshot_id=p.snapshot_id AND r.result_state='SUCCESS'
                        WHERE r.completed_at<=? ORDER BY p.person_id,r.completed_at DESC,r.id DESC
                        """,
                        (r, n) ->
                                new PersonReference(
                                        r.getObject(1, UUID.class),
                                        r.getString(2),
                                        List.of(),
                                        r.getString(3) == null
                                                ? null
                                                : java.net.URI.create(r.getString(3))),
                        at.atOffset(ZoneOffset.UTC));
        for (var evidence : verification.evidenceAsOf(at))
            for (int i = 0; i < evidence.value().people().size(); i++) {
                var subject = evidence.value().people().get(i);
                var decision = new CrewPersonResolver().resolve(subject, candidates, Map.of());
                if (decision.method() != CrewIdentityResolution.Method.EXACT_UNIQUE_NAME) continue;
                if (jdbc.queryForObject(
                                "SELECT count(*) FROM crew_identity_resolution WHERE evidence_id=?"
                                    + " AND subject_index=? AND person_id IS NOT NULL",
                                Integer.class,
                                evidence.id(),
                                i)
                        > 0) continue;
                if (decision.nasaKey() != null)
                    jdbc.update(
                            "INSERT INTO crew_person_external_id(person_id,source,external_id)"
                                + " VALUES (?,'NASA_OFFICIAL',?) ON CONFLICT DO NOTHING",
                            decision.personId(),
                            decision.nasaKey());
                String hash;
                try {
                    hash =
                            HexFormat.of()
                                    .formatHex(
                                            MessageDigest.getInstance("SHA-256")
                                                    .digest(
                                                            ("TEST_ONLY retained v1:"
                                                                            + evidence.id()
                                                                            + ":"
                                                                            + i
                                                                            + ":"
                                                                            + decision.personId())
                                                                    .getBytes(
                                                                            StandardCharsets
                                                                                    .UTF_8)));
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
                jdbc.update(
                        """
                        INSERT INTO crew_identity_resolution(evidence_id,subject_index,resolved_at,person_id,method,candidates,identity_key,resolver_version,resolution_hash)
                        VALUES (?,?,?,?,'EXACT_UNIQUE_NAME',ARRAY[?]::uuid[],?,'crew-person-resolution-v1',?)
                        """,
                        evidence.id(),
                        i,
                        at.atOffset(ZoneOffset.UTC),
                        decision.personId(),
                        decision.personId(),
                        decision.nasaKey(),
                        hash);
            }
    }
}
