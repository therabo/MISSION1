-- ADR-0021. Additive production lineage; V1-V11 and their rows remain immutable.
ALTER TABLE crew_active_projection_revision DROP CONSTRAINT crew_active_projection_revision_identity_mode_check;
ALTER TABLE crew_active_projection_revision ADD CONSTRAINT crew_active_identity_mode_check
 CHECK(identity_mode IN ('V9_AUTOMATIC_SHADOW','S10_SCOPED_BINDING'));
-- Keep structural support ownership, move authority-specific requirements into a mode-aware guard.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='crew_active_projection_support'::regclass
   AND contype='c' AND pg_get_constraintdef(oid) LIKE '%snapshot_id IS NOT NULL%' LOOP
  EXECUTE format('ALTER TABLE crew_active_projection_support DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE crew_active_projection_support ADD CONSTRAINT crew_active_support_shape CHECK(
 (support_type='LL2_ASSIGNMENT' AND snapshot_id IS NOT NULL AND expedition_id IS NOT NULL AND person_id IS NOT NULL AND roster_id IS NULL AND evidence_id IS NULL AND decision_id IS NULL)
 OR (support_type='NASA_EDITORIAL_ROSTER' AND roster_id IS NOT NULL AND member_index IS NOT NULL AND acquisition_id IS NOT NULL AND snapshot_id IS NULL AND evidence_id IS NULL)
 OR (support_type IN ('NASA_OPERATIONAL_POSITIVE','QUALIFIED_REENTRY') AND evidence_id IS NOT NULL AND subject_index IS NOT NULL AND snapshot_id IS NULL AND roster_id IS NULL));
CREATE TABLE crew_active_projection_binding (
 projection_id bigint NOT NULL REFERENCES crew_active_projection_revision(id),
 evidence_id bigint NOT NULL, subject_index integer NOT NULL, human_key varchar(240) NOT NULL,
 binding_id bigint REFERENCES crew_operational_binding_revision(id),
 explicit_resolution_id bigint REFERENCES crew_identity_resolution(id), known_at timestamptz NOT NULL,
 payload jsonb NOT NULL, PRIMARY KEY(projection_id,evidence_id,subject_index),
 FOREIGN KEY(evidence_id,subject_index) REFERENCES crew_evidence_subject(evidence_id,subject_index),
 FOREIGN KEY(projection_id,human_key) REFERENCES crew_active_projection_member(projection_id,human_key),
 CHECK((binding_id IS NOT NULL)<>(explicit_resolution_id IS NOT NULL))
);
CREATE TRIGGER aa_crew_active_binding_sealed BEFORE INSERT ON crew_active_projection_binding FOR EACH ROW EXECUTE FUNCTION crew_active_require_open_revision();
CREATE TRIGGER crew_active_binding_immutable BEFORE UPDATE OR DELETE ON crew_active_projection_binding FOR EACH ROW EXECUTE FUNCTION crew_reject_history_mutation();
CREATE FUNCTION crew_production_canonical_at(anchor uuid, known_at timestamptz)
RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT representative_id FROM (
   SELECT DISTINCT ON(left_person_id,right_person_id) * FROM crew_person_equivalence_decision
   WHERE known_at<=$2 ORDER BY left_person_id,right_person_id,known_at DESC,id DESC
 ) latest WHERE status='ACTIVE' AND alias_id=$1),$1)
$$;
CREATE FUNCTION crew_active_production_binding_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p crew_active_projection_revision; b crew_operational_binding_revision;
BEGIN
 SELECT * INTO p FROM crew_active_projection_revision WHERE id=NEW.projection_id;
 IF p.identity_mode<>'S10_SCOPED_BINDING' OR NEW.known_at>p.created_at
   OR p.input_cut->'identityHealth'->'bindings'->(NEW.evidence_id||':'||NEW.subject_index) IS DISTINCT FROM NEW.payload
   OR NEW.payload->>'provider' IS DISTINCT FROM NEW.human_key
   OR (NEW.payload->>'revision')::bigint IS DISTINCT FROM NEW.binding_id
   OR (NEW.payload->>'resolution')::bigint IS DISTINCT FROM NEW.explicit_resolution_id
   OR (NEW.payload->>'knownAt')::timestamptz IS DISTINCT FROM NEW.known_at THEN
  RAISE EXCEPTION 'Production binding cut mismatch' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT FROM crew_active_projection_evidence e WHERE e.projection_id=NEW.projection_id AND e.evidence_id=NEW.evidence_id) THEN
  RAISE EXCEPTION 'Production binding outside evidence cut' USING ERRCODE='23514';
 END IF;
 IF NEW.binding_id IS NOT NULL THEN
  SELECT * INTO b FROM crew_operational_binding_revision WHERE id=NEW.binding_id;
  IF b.outcome<>'AUTO_MATCH' OR b.release_version<>'s10-scoped-production-v1'
    OR b.evidence_id<>NEW.evidence_id OR b.subject_index<>NEW.subject_index
    OR b.target_provider_key<>NEW.human_key OR b.target_person_id::text IS DISTINCT FROM NEW.payload->>'person'
    OR b.known_at<>NEW.known_at OR b.id IS DISTINCT FROM
      (SELECT id FROM crew_operational_binding_revision WHERE evidence_id=NEW.evidence_id AND subject_index=NEW.subject_index AND known_at<=p.created_at ORDER BY id DESC LIMIT 1) THEN
   RAISE EXCEPTION 'Unqualified latest S10 production binding' USING ERRCODE='23514';
  END IF;
 ELSE
  IF EXISTS(SELECT FROM crew_operational_binding_revision WHERE evidence_id=NEW.evidence_id AND subject_index=NEW.subject_index AND known_at<=p.created_at)
   OR NOT EXISTS(SELECT FROM crew_identity_resolution r WHERE r.id=NEW.explicit_resolution_id
     AND r.evidence_id=NEW.evidence_id AND r.subject_index=NEW.subject_index AND r.method IN ('EXTERNAL_ID','AUTHORITATIVE_MAPPING') AND r.resolved_at=NEW.known_at) THEN
   RAISE EXCEPTION 'Unqualified explicit V7 fallback' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT FROM crew_identity_resolution r JOIN crew_active_projection_member m
    ON m.projection_id=NEW.projection_id AND m.human_key=NEW.human_key
    JOIN crew_evidence_subject subject ON subject.evidence_id=r.evidence_id AND subject.subject_index=r.subject_index
    WHERE r.id=NEW.explicit_resolution_id
      AND r.id=(SELECT id FROM crew_identity_resolution h WHERE h.evidence_id=r.evidence_id AND h.subject_index=r.subject_index AND h.resolved_at<=p.created_at ORDER BY resolved_at DESC,id DESC LIMIT 1)
      AND crew_production_canonical_at(r.person_id,p.created_at)::text=NEW.payload->>'person'
      AND crew_production_canonical_at(m.person_id,p.created_at)=crew_production_canonical_at(r.person_id,p.created_at)
      AND ((r.method='AUTHORITATIVE_MAPPING' AND EXISTS(SELECT FROM (SELECT * FROM crew_identity_binding_version v
        WHERE v.source='NASA_OFFICIAL' AND v.entity_kind='PERSON_PROFILE_RESOURCE' AND v.external_key=r.identity_key
          AND v.known_at<=p.created_at ORDER BY v.known_at DESC,v.id DESC LIMIT 1) v
        WHERE v.status='ACTIVE' AND crew_production_canonical_at(v.person_id,p.created_at)=crew_production_canonical_at(r.person_id,p.created_at)))
       OR (r.method='EXTERNAL_ID' AND subject.external_ids @> jsonb_build_array(jsonb_build_object('source','LAUNCH_LIBRARY_2','value',substring(NEW.human_key FROM 12)))))) THEN
   RAISE EXCEPTION 'Explicit fallback target/current authority mismatch' USING ERRCODE='23514';
  END IF;

 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crew_active_production_binding_lineage BEFORE INSERT ON crew_active_projection_binding FOR EACH ROW EXECUTE FUNCTION crew_active_production_binding_check();
CREATE FUNCTION crew_active_editorial_binding_qualified(projection bigint,human varchar,roster bigint,member integer)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE p crew_active_projection_revision; pin jsonb; rel crew_editorial_resource_relation;
 acq crew_editorial_acquisition; reviewed crew_identity_binding_version; owner uuid; key text;
BEGIN
 SELECT * INTO p FROM crew_active_projection_revision WHERE id=projection;
 pin:=p.input_cut->'identityHealth'->'editorialBindings'->(roster||':'||member);
 IF pin IS NULL OR pin->>'provider' IS DISTINCT FROM human THEN RETURN false; END IF;
 SELECT * INTO rel FROM crew_editorial_resource_relation WHERE id=(pin->>'relation')::bigint;
 IF NOT FOUND OR rel.roster_id<>roster OR rel.member_index<>member OR rel.status<>'VERIFIED_ABOUT_PERSON_RELATION'
   OR rel.acquisition_id IS DISTINCT FROM (pin->>'acquisition')::bigint
   OR rel.id IS DISTINCT FROM (SELECT id FROM crew_editorial_resource_relation r
     WHERE r.roster_id=roster AND r.member_index=member AND r.observed_url=rel.observed_url
     ORDER BY id DESC LIMIT 1) THEN RETURN false; END IF;
 SELECT * INTO acq FROM crew_editorial_acquisition WHERE id=rel.acquisition_id;
 IF NOT FOUND OR acq.stream<>'NASA_PERSON_RESOURCE' OR acq.outcome='FAILURE' OR acq.completed_at>p.created_at
   OR acq.resource_id<>rel.target_resource_id OR acq.resource_metadata->>'kind'<>'NASA_PEOPLE_RESOURCE'
   OR NOT EXISTS(SELECT FROM crew_editorial_resource r WHERE r.id=rel.target_resource_id AND r.resource_kind='NASA_PEOPLE_RESOURCE')
   THEN RETURN false; END IF;
 key:='profile:'||(acq.resource_metadata->>'slug');
 IF key IS NULL OR pin->>'resourceKey' IS DISTINCT FROM key THEN RETURN false; END IF;
 SELECT * INTO reviewed FROM crew_identity_binding_version WHERE source='NASA_OFFICIAL'
   AND entity_kind='PERSON_PROFILE_RESOURCE' AND external_key=key AND known_at<=p.created_at
   ORDER BY known_at DESC,id DESC LIMIT 1;
 IF FOUND THEN
   IF reviewed.status<>'ACTIVE' OR reviewed.id IS DISTINCT FROM (pin->>'identityBinding')::bigint
     OR pin->>'originalOwner' IS NOT NULL THEN RETURN false; END IF;
   owner:=reviewed.person_id;
 ELSE
   IF pin->>'identityBinding' IS NOT NULL THEN RETURN false; END IF;
   SELECT x.person_id INTO owner FROM crew_person_external_id x JOIN crew_person cp ON cp.id=x.person_id
     WHERE x.source='NASA_OFFICIAL' AND x.external_id=key AND cp.created_at<=p.created_at;
   IF owner IS NULL OR owner::text IS DISTINCT FROM pin->>'originalOwner' THEN RETURN false; END IF;
 END IF;
 IF crew_production_canonical_at(owner,p.created_at)::text IS DISTINCT FROM pin->>'person'
   OR NOT EXISTS(SELECT FROM crew_active_projection_member m
      JOIN crew_person_external_id x ON x.person_id=m.person_id AND x.source='LAUNCH_LIBRARY_2'
      WHERE m.projection_id=projection AND m.human_key=human AND 'LL2:PERSON:'||x.external_id=human
        AND crew_production_canonical_at(m.person_id,p.created_at)=crew_production_canonical_at(owner,p.created_at))
   THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;

CREATE FUNCTION crew_active_production_support_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p crew_active_projection_revision;
BEGIN
 SELECT * INTO p FROM crew_active_projection_revision WHERE id=NEW.projection_id;
 IF p.identity_mode='V9_AUTOMATIC_SHADOW' THEN
  IF NEW.support_type<>'LL2_ASSIGNMENT' AND (NEW.decision_id IS NULL OR NEW.observation_id IS NULL) THEN
   RAISE EXCEPTION 'Shadow support requires original V9 lineage' USING ERRCODE='23514';
  END IF;
 ELSE
  IF NEW.decision_id IS NOT NULL OR NEW.observation_id IS NOT NULL OR p.graph_id IS NOT NULL THEN
   RAISE EXCEPTION 'V9 cannot authorize production support' USING ERRCODE='23514';
  END IF;
  IF NEW.support_type='NASA_EDITORIAL_ROSTER' AND NOT
    crew_active_editorial_binding_qualified(NEW.projection_id,NEW.human_key,NEW.roster_id,NEW.member_index) THEN
   RAISE EXCEPTION 'Editorial support lacks exact V8/V7 lineage' USING ERRCODE='23514';
  END IF;
  IF NEW.evidence_id IS NOT NULL AND NOT EXISTS(SELECT FROM crew_active_projection_binding b
    WHERE b.projection_id=NEW.projection_id AND b.evidence_id=NEW.evidence_id AND b.subject_index=NEW.subject_index AND b.human_key=NEW.human_key) THEN
   RAISE EXCEPTION 'Operational support lacks production binding' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crew_active_production_support_lineage BEFORE INSERT ON crew_active_projection_support FOR EACH ROW EXECUTE FUNCTION crew_active_production_support_check();
CREATE FUNCTION crew_active_production_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.identity_mode='S10_SCOPED_BINDING' THEN
  IF EXISTS(SELECT FROM jsonb_each(NEW.input_cut->'identityHealth'->'editorialBindings') j
      WHERE NOT EXISTS(SELECT FROM crew_active_projection_support support
        WHERE support.projection_id=NEW.id AND support.support_type='NASA_EDITORIAL_ROSTER'
          AND support.roster_id||':'||support.member_index=j.key AND support.human_key=j.value->>'provider'))
    OR NEW.graph_id IS NOT NULL OR EXISTS(SELECT FROM crew_active_projection_member m WHERE m.projection_id=NEW.id AND m.departure_evidence_id IS NOT NULL
    AND NOT EXISTS(SELECT FROM crew_active_projection_binding b WHERE b.projection_id=NEW.id AND b.human_key=m.human_key AND b.evidence_id=m.departure_evidence_id))
    OR (SELECT count(*) FROM crew_active_projection_binding b WHERE b.projection_id=NEW.id)<>
      (SELECT count(*) FROM jsonb_each(NEW.input_cut->'identityHealth'->'bindings') b WHERE b.value->>'provider' IS NOT NULL) THEN
   RAISE EXCEPTION 'Incomplete production binding/departure lineage' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER crew_active_production_atomic AFTER INSERT ON crew_active_projection_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION crew_active_production_complete();
CREATE INDEX crew_operational_binding_subject_latest_idx ON crew_operational_binding_revision(evidence_id,subject_index,id DESC);
CREATE TRIGGER crew_active_s10_change AFTER INSERT ON crew_operational_binding_revision FOR EACH STATEMENT EXECUTE FUNCTION crew_active_notify();
CREATE TRIGGER crew_active_s10_release AFTER INSERT ON crew_operational_binding_release FOR EACH STATEMENT EXECUTE FUNCTION crew_active_notify();

CREATE TRIGGER crew_active_v7_binding_change AFTER INSERT ON crew_identity_binding_version FOR EACH STATEMENT EXECUTE FUNCTION crew_active_notify();
CREATE TRIGGER crew_active_v7_equivalence_change AFTER INSERT ON crew_person_equivalence_decision FOR EACH STATEMENT EXECUTE FUNCTION crew_active_notify();
CREATE TRIGGER crew_active_v8_relation_change AFTER INSERT ON crew_editorial_resource_relation FOR EACH STATEMENT EXECUTE FUNCTION crew_active_notify();
