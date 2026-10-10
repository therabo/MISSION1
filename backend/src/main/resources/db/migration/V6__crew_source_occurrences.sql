-- ADR-0012. Additive associations only; V1–V5 and every evidence/subject/hash stay unchanged.
CREATE TABLE crew_source_article (
    article_key varchar(160) PRIMARY KEY CHECK(article_key ~ '^nasa[.]gov:wp:nasa-blog:[1-9][0-9]*$'),
    source varchar(40) NOT NULL CHECK(source='NASA_OFFICIAL')
);
CREATE TABLE crew_source_article_observation (
    document_id bigint NOT NULL REFERENCES crew_source_document(id),
    article_key varchar(160) NOT NULL REFERENCES crew_source_article(article_key),
    raw_guid text NOT NULL CHECK(length(raw_guid)>0),
    raw_url text NOT NULL CHECK(length(raw_url)>0),
    observed_url text NOT NULL CHECK(length(observed_url)>0),
    source_published_at timestamptz NOT NULL,
    representation_hash varchar(64) NOT NULL CHECK(representation_hash ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY(document_id,article_key)
);
CREATE INDEX crew_article_observation_source_idx ON crew_source_article_observation(article_key,document_id);
CREATE TABLE crew_assertion_occurrence (
    occurrence_key varchar(64) PRIMARY KEY CHECK(occurrence_key ~ '^[0-9a-f]{64}$'),
    article_key varchar(160) REFERENCES crew_source_article(article_key),
    candidate_key varchar(64) CHECK(candidate_key ~ '^[0-9a-f]{64}$'),
    guard_key varchar(64) NOT NULL CHECK(guard_key ~ '^[0-9a-f]{64}$'),
    association_status varchar(40) NOT NULL CHECK(association_status IN
        ('COMPATIBLE','UNASSOCIATED_SCOPE','UNSUPPORTED_SEMANTICS','CONFLICTING_SUBJECT_KEYS','AMBIGUOUS_ORDER')),
    identity_policy varchar(80) NOT NULL,
    UNIQUE(occurrence_key,article_key),
    CHECK((article_key IS NULL)=(candidate_key IS NULL))
);
CREATE INDEX crew_assertion_candidate_idx ON crew_assertion_occurrence(article_key,candidate_key,guard_key);
CREATE TABLE crew_assertion_version (
    evidence_id bigint PRIMARY KEY REFERENCES crew_verification_evidence(id),
    occurrence_key varchar(64) NOT NULL REFERENCES crew_assertion_occurrence(occurrence_key),
    UNIQUE(evidence_id,occurrence_key)
);
CREATE INDEX crew_assertion_version_occurrence_idx ON crew_assertion_version(occurrence_key,evidence_id);
CREATE TABLE crew_assertion_observation (
    evidence_id bigint NOT NULL,
    document_id bigint NOT NULL,
    occurrence_key varchar(64) NOT NULL,
    article_key varchar(160) NOT NULL,
    paragraph_index integer NOT NULL CHECK(paragraph_index>=0),
    PRIMARY KEY(evidence_id,document_id),
    FOREIGN KEY(evidence_id,occurrence_key) REFERENCES crew_assertion_version(evidence_id,occurrence_key),
    FOREIGN KEY(occurrence_key,article_key) REFERENCES crew_assertion_occurrence(occurrence_key,article_key),
    FOREIGN KEY(document_id,article_key) REFERENCES crew_source_article_observation(document_id,article_key),
    FOREIGN KEY(document_id,evidence_id) REFERENCES crew_document_evidence(document_id,evidence_id)
);
CREATE INDEX crew_assertion_observation_document_idx ON crew_assertion_observation(document_id,evidence_id);
CREATE TABLE crew_subject_occurrence (
    subject_key varchar(64) PRIMARY KEY CHECK(subject_key ~ '^[0-9a-f]{64}$'),
    occurrence_key varchar(64) NOT NULL REFERENCES crew_assertion_occurrence(occurrence_key),
    source_mention text NOT NULL CHECK(length(source_mention)>0),
    UNIQUE(subject_key,occurrence_key)
);
CREATE INDEX crew_subject_occurrence_assertion_idx ON crew_subject_occurrence(occurrence_key);
CREATE TABLE crew_subject_metadata_version (
    version_key varchar(64) PRIMARY KEY CHECK(version_key ~ '^[0-9a-f]{64}$'),
    subject_key varchar(64) NOT NULL REFERENCES crew_subject_occurrence(subject_key),
    payload_key varchar(64) NOT NULL CHECK(payload_key ~ '^[0-9a-f]{64}$'),
    display_name text NOT NULL CHECK(length(display_name)>0),
    official_profile_url text,
    external_ids jsonb NOT NULL CHECK(jsonb_typeof(external_ids)='array'),
    UNIQUE(subject_key,payload_key),
    UNIQUE(version_key,subject_key)
);
CREATE TABLE crew_subject_version_link (
    evidence_id bigint NOT NULL,
    subject_index integer NOT NULL CHECK(subject_index>=0),
    occurrence_key varchar(64) NOT NULL,
    subject_key varchar(64) NOT NULL,
    version_key varchar(64) NOT NULL,
    PRIMARY KEY(evidence_id,subject_index),
    FOREIGN KEY(evidence_id,subject_index) REFERENCES crew_evidence_subject(evidence_id,subject_index),
    FOREIGN KEY(evidence_id,occurrence_key) REFERENCES crew_assertion_version(evidence_id,occurrence_key),
    FOREIGN KEY(subject_key,occurrence_key) REFERENCES crew_subject_occurrence(subject_key,occurrence_key),
    FOREIGN KEY(version_key,subject_key) REFERENCES crew_subject_metadata_version(version_key,subject_key)
);
CREATE INDEX crew_subject_version_lineage_idx ON crew_subject_version_link(subject_key,version_key);
CREATE INDEX crew_successful_capture_occurrence_idx ON crew_source_sync_run(verification_document_id,retrieved_at,completed_at)
    WHERE source='NASA_OFFICIAL' AND result_state='SUCCESS';
DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['crew_source_article','crew_source_article_observation','crew_assertion_occurrence',
        'crew_assertion_version','crew_assertion_observation','crew_subject_occurrence','crew_subject_metadata_version','crew_subject_version_link']
    LOOP EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION crew_reject_history_mutation()',t||'_immutable',t); END LOOP;
END $$;
