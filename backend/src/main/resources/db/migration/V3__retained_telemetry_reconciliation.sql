-- Structure only; runtime derives pacing from existing acquisition/bootstrap history.
CREATE TABLE telemetry_provider_state (
    provider varchar(24) NOT NULL CHECK (provider IN ('SENSEDATA','ISS_LIVE')),
    catalog_version varchar(80) NOT NULL REFERENCES telemetry_catalog(version),
    last_attempt_at timestamptz,
    last_success_at timestamptz,
    next_eligible_at timestamptz NOT NULL,
    consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures BETWEEN 0 AND 30),
    last_outcome varchar(40) NOT NULL,
    last_kind varchar(40),
    scheduled_at timestamptz,
    completed_at timestamptz,
    fetched integer NOT NULL DEFAULT 0,
    mapped integer NOT NULL DEFAULT 0,
    admitted integer NOT NULL DEFAULT 0,
    duplicates integer NOT NULL DEFAULT 0,
    rejected integer NOT NULL DEFAULT 0,
    heads_advanced integer NOT NULL DEFAULT 0,
    response_bytes integer NOT NULL DEFAULT 0,
    fetch_milliseconds double precision NOT NULL DEFAULT 0,
    parse_milliseconds double precision NOT NULL DEFAULT 0,
    database_milliseconds double precision NOT NULL DEFAULT 0,
    PRIMARY KEY(provider,catalog_version)
);
-- Rejection facts are not observations; an unchanged ambiguous identity never ages into admission.
CREATE TABLE telemetry_time_rejection (
    record_id char(64) PRIMARY KEY,
    catalog_version varchar(80) NOT NULL,
    parameter_id varchar(160) NOT NULL,
    provider_item_id varchar(160) NOT NULL,
    raw_item_id varchar(40) NOT NULL,
    raw_value varchar(128) NOT NULL,
    original_time varchar(128) NOT NULL,
    provider_time timestamptz NOT NULL,
    time_policy varchar(120) NOT NULL,
    source_status_class varchar(128),
    reason varchar(40) NOT NULL CHECK (reason='SENSEDATA_FUTURE_TIME'),
    first_acquisition_id uuid NOT NULL REFERENCES telemetry_acquisition(id),
    received_at timestamptz NOT NULL,
    FOREIGN KEY(catalog_version,parameter_id) REFERENCES telemetry_parameter(catalog_version,parameter_id)
);
CREATE TRIGGER telemetry_time_rejection_immutable BEFORE UPDATE OR DELETE ON telemetry_time_rejection
FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
