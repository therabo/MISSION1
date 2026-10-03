-- Planning observations and scheduler audit only; no existing truth/provenance rows are rewritten.
CREATE TABLE crew_event_catalog_run (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
    source_url TEXT NOT NULL, coverage_from TIMESTAMPTZ NOT NULL, coverage_until TIMESTAMPTZ NOT NULL,
    result_state TEXT NOT NULL CHECK (result_state IN ('IN_PROGRESS','SUCCESS','FAILURE')),
    source_state TEXT, http_status INTEGER, retrieved_at TIMESTAMPTZ,
    content_hash TEXT, body BYTEA, source_api_version TEXT, adapter_version TEXT,
    http_etag TEXT, http_last_modified TEXT, retry_after TEXT, retry_after_at TIMESTAMPTZ,
    error_code TEXT,
    CHECK (coverage_until > coverage_from),
    CHECK ((result_state = 'IN_PROGRESS') = (completed_at IS NULL)),
    CHECK (result_state <> 'SUCCESS' OR (body IS NOT NULL AND content_hash IS NOT NULL AND retrieved_at IS NOT NULL))
);
CREATE INDEX crew_event_catalog_attempt ON crew_event_catalog_run(started_at DESC,id DESC);
CREATE TABLE crew_operational_event_observation (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'LAUNCH_LIBRARY_2' CHECK (source = 'LAUNCH_LIBRARY_2'),
    station TEXT NOT NULL DEFAULT 'ISS' CHECK (station = 'ISS'),
    external_id TEXT NOT NULL, semantic_hash TEXT NOT NULL,
    first_catalog_run_id BIGINT NOT NULL REFERENCES crew_event_catalog_run(id),
    payload JSONB NOT NULL,
    UNIQUE(source,station,external_id,semantic_hash)
);
CREATE TABLE crew_event_catalog_observation (
    catalog_run_id BIGINT NOT NULL REFERENCES crew_event_catalog_run(id),
    observation_id BIGINT NOT NULL REFERENCES crew_operational_event_observation(id),
    PRIMARY KEY(catalog_run_id,observation_id)
);
CREATE TABLE crew_refresh_follow_up (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evidence_id BIGINT NOT NULL UNIQUE REFERENCES crew_verification_evidence(id),
    UNIQUE(id,evidence_id),
    created_at TIMESTAMPTZ NOT NULL, context_at TIMESTAMPTZ NOT NULL, deadline TIMESTAMPTZ NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('OPEN','SETTLED','EXPIRED','ATTEMPTS_EXHAUSTED','SUPERSEDED')),
    closed_at TIMESTAMPTZ,
    CHECK (deadline > context_at AND deadline <= context_at + INTERVAL '24 hours'),
    CHECK ((state = 'OPEN') = (closed_at IS NULL))
);
CREATE TABLE crew_refresh_trigger (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    target TEXT NOT NULL CHECK (target IN ('LL2_ROSTER','NASA_VERIFICATION','LL2_EVENT_CATALOG')),
    reason TEXT NOT NULL CHECK (reason IN ('BASELINE_SCHEDULE','BASELINE_CATALOG_REFRESH',
        'UPCOMING_CREWED_EVENT','UNKNOWN_EVENT_WINDOW','NASA_COMPLETED_ARRIVAL','NASA_COMPLETED_DEPARTURE',
        'STRUCTURED_SOURCE_LAG_FOLLOW_UP','MANUAL_OR_TEST')),
    created_at TIMESTAMPTZ NOT NULL, eligible_at TIMESTAMPTZ NOT NULL,
    event_observation_id BIGINT REFERENCES crew_operational_event_observation(id),
    evidence_id BIGINT REFERENCES crew_verification_evidence(id),
    follow_up_id BIGINT REFERENCES crew_refresh_follow_up(id),
    source_sync_run_id BIGINT UNIQUE REFERENCES crew_source_sync_run(id),
    catalog_run_id BIGINT UNIQUE REFERENCES crew_event_catalog_run(id),
    FOREIGN KEY(follow_up_id,evidence_id) REFERENCES crew_refresh_follow_up(id,evidence_id),
    CHECK (source_sync_run_id IS NULL OR catalog_run_id IS NULL),
    CHECK (reason NOT IN ('UPCOMING_CREWED_EVENT','UNKNOWN_EVENT_WINDOW') OR target='NASA_VERIFICATION'),
    CHECK (reason NOT IN ('NASA_COMPLETED_ARRIVAL','NASA_COMPLETED_DEPARTURE','STRUCTURED_SOURCE_LAG_FOLLOW_UP') OR target='LL2_ROSTER'),
    CHECK ((target = 'LL2_EVENT_CATALOG' AND source_sync_run_id IS NULL)
        OR (target <> 'LL2_EVENT_CATALOG' AND catalog_run_id IS NULL)),
    CHECK (reason NOT IN ('UPCOMING_CREWED_EVENT','UNKNOWN_EVENT_WINDOW') OR event_observation_id IS NOT NULL),
    CHECK (reason NOT IN ('NASA_COMPLETED_ARRIVAL','NASA_COMPLETED_DEPARTURE','STRUCTURED_SOURCE_LAG_FOLLOW_UP')
        OR (evidence_id IS NOT NULL AND follow_up_id IS NOT NULL))
);
CREATE INDEX crew_refresh_follow_up_attempts ON crew_refresh_trigger(follow_up_id,source_sync_run_id);
CREATE TRIGGER crew_event_observation_immutable BEFORE UPDATE OR DELETE ON crew_operational_event_observation
    FOR EACH ROW EXECUTE FUNCTION crew_reject_history_mutation();
CREATE TRIGGER crew_event_catalog_link_immutable BEFORE UPDATE OR DELETE ON crew_event_catalog_observation
    FOR EACH ROW EXECUTE FUNCTION crew_reject_history_mutation();
CREATE FUNCTION crew_refresh_audit_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Crew refresh audit cannot be deleted' USING ERRCODE = '23514'; END IF;
    IF TG_TABLE_NAME = 'crew_refresh_trigger' THEN
        IF (to_jsonb(NEW) - 'source_sync_run_id' - 'catalog_run_id') <> (to_jsonb(OLD) - 'source_sync_run_id' - 'catalog_run_id')
            OR OLD.source_sync_run_id IS NOT NULL OR OLD.catalog_run_id IS NOT NULL
            OR (NEW.source_sync_run_id IS NULL AND NEW.catalog_run_id IS NULL) THEN
            RAISE EXCEPTION 'Crew trigger supports one association only' USING ERRCODE = '23514';
        END IF;
        IF NEW.source_sync_run_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM crew_source_sync_run r WHERE r.id = NEW.source_sync_run_id
                AND r.station = 'ISS' AND r.source = CASE NEW.target WHEN 'LL2_ROSTER' THEN 'LAUNCH_LIBRARY_2' ELSE 'NASA_OFFICIAL' END
        ) THEN RAISE EXCEPTION 'Crew trigger source mismatch' USING ERRCODE = '23514'; END IF;
    ELSIF TG_TABLE_NAME = 'crew_refresh_follow_up' THEN
        IF (to_jsonb(NEW) - 'state' - 'closed_at') <> (to_jsonb(OLD) - 'state' - 'closed_at')
            OR OLD.state <> 'OPEN' OR NEW.state = 'OPEN' THEN
            RAISE EXCEPTION 'Crew follow-up supports one terminal transition only' USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.result_state <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Completed Crew calendar run is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER crew_refresh_trigger_guard BEFORE UPDATE OR DELETE ON crew_refresh_trigger
    FOR EACH ROW EXECUTE FUNCTION crew_refresh_audit_guard();
CREATE TRIGGER crew_refresh_follow_up_guard BEFORE UPDATE OR DELETE ON crew_refresh_follow_up
    FOR EACH ROW EXECUTE FUNCTION crew_refresh_audit_guard();
CREATE TRIGGER crew_event_catalog_run_guard BEFORE UPDATE OR DELETE ON crew_event_catalog_run
    FOR EACH ROW EXECUTE FUNCTION crew_refresh_audit_guard();
