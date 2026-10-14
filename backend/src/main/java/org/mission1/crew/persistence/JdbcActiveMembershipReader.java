package org.mission1.crew.persistence;

import static org.mission1.crew.application.CurrentProjectionUnavailable.Reason.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.mission1.crew.application.CurrentProjectionUnavailable;
import org.mission1.crew.membership.*;
import org.mission1.source.crew.CrewHttpReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Optional;

/** Single set-based, repeatable-read compatibility check of sealed Crew membership state. */
@Repository
public class JdbcActiveMembershipReader implements ActiveMembershipReader {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ActiveMembershipPolicy policy;

    public JdbcActiveMembershipReader(
            JdbcTemplate jdbc, ObjectMapper json, ActiveMembershipPolicy policy) {
        this.jdbc = jdbc;
        this.json = json;
        this.policy = policy;
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Optional<Projection> latestCompatible() {
        try {
            return readValidated();
        } catch (org.springframework.dao.DataAccessException failure) {
            // Malformed schema/JSON casts or unreadable storage cannot become a alternate membership fallback.
            throw new CurrentProjectionUnavailable(INVALID);
        }
    }

    private Optional<Projection> readValidated() {
        return jdbc
                .query(
                        """
                        SELECT r.*,
                          (SELECT count(*) FROM crew_membership_projection_member m WHERE m.projection_id=r.id)=jsonb_array_length(r.result->'members')
                          AND NOT EXISTS(SELECT FROM jsonb_array_elements(r.result->'members') j
                            LEFT JOIN crew_membership_projection_member m ON m.projection_id=r.id AND m.human_key=j->'human'->>'key'
                            WHERE m.payload IS DISTINCT FROM j OR m.state IS DISTINCT FROM j->>'state'
                              OR m.person_id::text IS DISTINCT FROM j->'human'->>'anchor'
                              OR to_jsonb(m.profile_snapshot_id) IS DISTINCT FROM nullif(j->'human'->'profileSnapshot','null'::jsonb)
                              OR to_jsonb(m.departure_evidence_id) IS DISTINCT FROM nullif(j->'departureVeto','null'::jsonb))
                          AND (SELECT count(*) FROM crew_membership_projection_support s WHERE s.projection_id=r.id)=
                            (SELECT coalesce(sum(jsonb_array_length(j->'supports')),0) FROM jsonb_array_elements(r.result->'members') j)
                          AND NOT EXISTS(SELECT FROM jsonb_array_elements(r.result->'members') j
                            CROSS JOIN LATERAL jsonb_array_elements(j->'supports') k
                            LEFT JOIN crew_membership_projection_support s ON s.projection_id=r.id AND s.human_key=j->'human'->>'key' AND s.support_key=k->>'key'
                            WHERE s.payload IS DISTINCT FROM k OR s.support_type IS DISTINCT FROM k->>'type'
                              OR s.stream IS DISTINCT FROM k->>'stream' OR s.freshness IS DISTINCT FROM k->>'freshness'
                              OR s.eligible IS DISTINCT FROM (k->>'eligible')::boolean
                              OR s.captured_at IS DISTINCT FROM (k->>'capturedAt')::timestamptz
                              OR s.effective_at IS DISTINCT FROM (k->>'effectiveAt')::timestamptz
                              OR s.precision IS DISTINCT FROM k->>'precision'
                              OR s.snapshot_id IS DISTINCT FROM (k->>'snapshot')::bigint
                              OR s.expedition_id IS DISTINCT FROM (k->>'expeditionId')::uuid
                              OR s.acquisition_id IS DISTINCT FROM (k->>'acquisition')::bigint
                              OR s.roster_id IS DISTINCT FROM (k->>'roster')::bigint
                              OR s.member_index IS DISTINCT FROM (k->>'memberIndex')::int
                              OR s.evidence_id IS DISTINCT FROM (k->>'evidence')::bigint
                              OR s.subject_index IS DISTINCT FROM (k->>'subjectIndex')::int
                              OR s.decision_id IS DISTINCT FROM (k->>'decision')::bigint
                              OR s.observation_id IS DISTINCT FROM (k->>'observation')::bigint
                              OR s.departure_evidence_id IS DISTINCT FROM (k->>'supersededByDeparture')::bigint)
                          AND (SELECT count(*) FROM crew_membership_projection_slot s WHERE s.projection_id=r.id)=jsonb_array_length(r.result->'unresolved')
                          AND NOT EXISTS(SELECT FROM jsonb_array_elements(r.result->'unresolved') j
                            LEFT JOIN crew_membership_projection_slot s ON s.projection_id=r.id AND s.slot_key=j->'slot'->>'key'
                            WHERE s.payload IS DISTINCT FROM j OR s.state IS DISTINCT FROM j->>'state'
                              OR s.acquisition_id IS DISTINCT FROM (j->'slot'->>'acquisition')::bigint
                              OR s.roster_id IS DISTINCT FROM (j->'slot'->>'roster')::bigint
                              OR s.member_index IS DISTINCT FROM (j->'slot'->>'memberIndex')::int
                              OR s.evidence_id IS DISTINCT FROM (j->'slot'->>'evidence')::bigint
                              OR s.subject_index IS DISTINCT FROM (j->'slot'->>'subjectIndex')::int
                              OR s.decision_id IS DISTINCT FROM (j->'slot'->>'decision')::bigint
                              OR s.observation_id IS DISTINCT FROM (j->'slot'->>'observation')::bigint)
                          AND (SELECT count(*) FROM crew_membership_projection_slot s WHERE s.projection_id=r.id AND s.state='UNRESOLVED_ACTIVE_SOURCE_SLOT')=(r.result->'counts'->>'unresolvedActiveSlots')::int
                          AND (SELECT count(*) FROM crew_membership_projection_slot s WHERE s.projection_id=r.id AND s.state<>'UNRESOLVED_ACTIVE_SOURCE_SLOT')=(r.result->'counts'->>'unresolvedRetainedSlots')::int
                          AND (SELECT count(*) FROM crew_membership_projection_finding f WHERE f.projection_id=r.id)=jsonb_array_length(r.result->'findings')
                          AND NOT EXISTS(SELECT FROM jsonb_array_elements(r.result->'findings') j
                            WHERE NOT EXISTS(SELECT FROM crew_membership_projection_finding f WHERE f.projection_id=r.id
                              AND f.namespace=j->>'namespace' AND f.code=j->>'code' AND f.subject=j->>'subject' AND f.detail=j->>'detail'))
                          AND (SELECT count(*) FROM crew_membership_projection_evidence e WHERE e.projection_id=r.id)=jsonb_array_length(r.input_cut->'evidence')
                          AND NOT EXISTS(SELECT FROM jsonb_array_elements_text(r.input_cut->'evidence') j
                            WHERE NOT EXISTS(SELECT FROM crew_membership_projection_evidence e WHERE e.projection_id=r.id AND e.evidence_id=j::bigint))
                          AND NOT EXISTS(
                            WITH expected AS (
                              SELECT 'HEALTH:'||(h->>'stream')||':'||(h->>'resource') input_key, h->>'stream' stream,
                                CASE WHEN h->>'stream' IN ('LL2_STRUCTURED_CREW','NASA_OPERATIONAL_FEED') THEN (h->>'attemptId')::bigint END sync_run_id,
                                CASE WHEN h->>'stream' NOT IN ('LL2_STRUCTURED_CREW','NASA_OPERATIONAL_FEED') THEN (h->>'attemptId')::bigint END acquisition_id,
                                NULL::bigint document_id
                              FROM jsonb_array_elements(r.input_cut->'health') h WHERE h->>'attemptId' IS NOT NULL
                              UNION
                              SELECT 'OPERATIONAL:'||(c->>'occurrence'), 'NASA_OPERATIONAL_FEED',
                                (c->'observation'->>'runId')::bigint, NULL::bigint, (c->'observation'->>'documentId')::bigint
                              FROM jsonb_array_elements(r.input_cut->'occurrenceChoices') c WHERE c->'observation'->>'runId' IS NOT NULL
                            ), retained AS (
                              SELECT input_key,stream,sync_run_id,acquisition_id,document_id FROM crew_membership_projection_input_capture WHERE projection_id=r.id
                            )
                            (SELECT * FROM expected EXCEPT SELECT * FROM retained)
                            UNION ALL (SELECT * FROM retained EXCEPT SELECT * FROM expected))
                          AND NOT EXISTS(SELECT FROM crew_membership_projection_support s WHERE s.projection_id=r.id
                            AND r.identity_mode='OPERATIONAL_SUBJECT_BINDING' AND s.support_type='NASA_EDITORIAL_ROSTER'
                            AND NOT crew_membership_editorial_binding_qualified(r.id,s.human_key,s.roster_id,s.member_index))
                          AND (r.identity_mode<>'OPERATIONAL_SUBJECT_BINDING' OR (
                            (SELECT count(*) FROM crew_membership_projection_binding b WHERE b.projection_id=r.id)=
                              (SELECT count(*) FROM jsonb_each(r.input_cut->'identityHealth'->'bindings') b WHERE b.value->>'provider' IS NOT NULL)
                            AND NOT EXISTS(SELECT FROM jsonb_each(r.input_cut->'identityHealth'->'bindings') j
                              LEFT JOIN crew_membership_projection_binding b ON b.projection_id=r.id AND j.key=b.evidence_id||':'||b.subject_index
                              WHERE j.value->>'provider' IS NOT NULL AND (b.payload IS DISTINCT FROM j.value
                                OR b.human_key IS DISTINCT FROM j.value->>'provider'
                                OR b.binding_id IS DISTINCT FROM (j.value->>'revision')::bigint
                                OR b.explicit_resolution_id IS DISTINCT FROM (j.value->>'resolution')::bigint
                                OR b.known_at IS DISTINCT FROM (j.value->>'knownAt')::timestamptz))))
                          AND NOT EXISTS(SELECT FROM crew_membership_projection_member m WHERE m.projection_id=r.id AND m.state='ACTIVE'
                            AND NOT EXISTS(SELECT FROM crew_membership_projection_support s WHERE s.projection_id=r.id AND s.human_key=m.human_key AND s.eligible))
                          AND (SELECT count(*) FROM crew_membership_projection_member m WHERE m.projection_id=r.id AND m.state='ACTIVE')=(r.result->'counts'->>'resolvedActiveHumans')::int
                          AND (SELECT count(*) FROM crew_membership_projection_member m WHERE m.projection_id=r.id AND m.state='RETAINED')=(r.result->'counts'->>'retainedHumans')::int
                          AND NOT EXISTS(SELECT FROM (VALUES ('ll2_run_id','ll2Run'),('ll2_snapshot_id','ll2Snapshot'),
                            ('roster_acquisition_id','rosterAcquisition'),('roster_id','roster'),('topic_acquisition_id','topicAcquisition'),
                            ('topic_count_fact_id','topicCountFact'),('graph_id','graph'),('operational_run_id','operationalRun'),
                            ('operational_attempt_id','operationalAttempt')) pin(column_name,cut_key)
                            WHERE to_jsonb(r)->pin.column_name IS DISTINCT FROM r.input_cut->pin.cut_key) AS complete
                        FROM crew_membership_projection_revision r ORDER BY r.id DESC LIMIT 1
                        """,
                        (r, n) -> {
                            try {
                                if (!policy.key().equals(r.getString("policy_version"))
                                        || !policy.identityMode().equals(r.getString("identity_mode")))
                                    throw new CurrentProjectionUnavailable(INCOMPATIBLE);
                                String result = r.getString("serialized_result"),
                                        cut = r.getString("serialized_cut");
                                if (!r.getBoolean("complete")
                                        || !CrewHttpReader.sha256(
                                                        result.getBytes(StandardCharsets.UTF_8))
                                                .equals(r.getString("semantic_hash"))
                                        || !CrewHttpReader.sha256(
                                                        cut.getBytes(StandardCharsets.UTF_8))
                                                .equals(r.getString("input_hash"))
                                        || !json.readTree(result)
                                                .equals(json.readTree(r.getString("result")))
                                        || !json.readTree(cut)
                                                .equals(json.readTree(r.getString("input_cut"))))
                                    throw new CurrentProjectionUnavailable(INVALID);
                                var value = json.readValue(result, Membership.Result.class);
                                if (!json.readTree(result).hasNonNull("counts")
                                        || value.members() == null
                                        || value.unresolved() == null
                                        || value.findings() == null
                                        || value.consistency() == null
                                        || value.cut().health() == null
                                        || value.cut().evidence() == null
                                        || value.cut().occurrenceChoices() == null
                                        || value.cut().identityHealth() == null
                                        || !value.policy().equals(policy.key())
                                        || !json.readTree(result)
                                                .get("cut")
                                                .equals(json.readTree(cut))
                                        || !value.health().name().equals(r.getString("health")))
                                    throw new CurrentProjectionUnavailable(INVALID);
                                if (value.health() == Membership.HealthState.UNAVAILABLE)
                                    throw new CurrentProjectionUnavailable(UNAVAILABLE);
                                return new Projection(
                                        r.getLong("id"),
                                        r.getObject("evaluated_at", OffsetDateTime.class)
                                                .toInstant(),
                                        r.getString("semantic_hash"),
                                        value);
                            } catch (CurrentProjectionUnavailable failure) {
                                throw failure;
                            } catch (Exception failure) {
                                throw new CurrentProjectionUnavailable(INVALID);
                            }
                        })
                .stream()
                .findFirst();
    }
}
