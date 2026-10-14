-- Structure only. Definitions initialize through the reviewed runtime registry;
-- observations can only arrive through source acquisition.
CREATE TABLE telemetry_catalog (
    version varchar(80) PRIMARY KEY,
    sha256 char(64) NOT NULL,
    research_sha256 char(64) NOT NULL
);
CREATE TABLE telemetry_parameter (
    catalog_version varchar(80) NOT NULL REFERENCES telemetry_catalog(version),
    parameter_id varchar(160) NOT NULL,
    raw_item_id varchar(40) NOT NULL,
    component_id varchar(40) NOT NULL,
    label varchar(1024) NOT NULL,
    category varchar(60) NOT NULL,
    value_type varchar(24) NOT NULL CHECK (value_type IN ('NUMERIC_SCALAR','ENUM_CODE')),
    unit_qualification varchar(40) NOT NULL CHECK (unit_qualification IN ('QUALIFIED','DISPLAY_RAW_WITH_SOURCE_UNIT')),
    qualified_unit varchar(24),
    source_unit varchar(64),
    metadata jsonb NOT NULL CHECK (octet_length(metadata::text) <= 32768),
    PRIMARY KEY(catalog_version, parameter_id),
    UNIQUE(catalog_version, raw_item_id),
    CHECK (unit_qualification='QUALIFIED' OR qualified_unit IS NULL)
);
CREATE INDEX telemetry_parameter_component ON telemetry_parameter(catalog_version, component_id);
CREATE TABLE telemetry_acquisition (
    id uuid PRIMARY KEY,
    provider varchar(24) NOT NULL CHECK (provider IN ('SENSEDATA','ISS_LIVE','NATIVE')),
    method varchar(40) NOT NULL,
    endpoint varchar(2048) NOT NULL,
    acquired_at timestamptz NOT NULL,
    outcome varchar(40) NOT NULL,
    diagnostic varchar(512),
    item_count integer NOT NULL CHECK (item_count BETWEEN 0 AND 1024)
);
CREATE TABLE telemetry_record (
    id char(64) PRIMARY KEY,
    catalog_version varchar(80) NOT NULL,
    parameter_id varchar(160) NOT NULL,
    provider varchar(24) NOT NULL CHECK (provider IN ('SENSEDATA','ISS_LIVE','NATIVE')),
    provider_item_id varchar(160) NOT NULL,
    raw_item_id varchar(40) NOT NULL,
    raw_value varchar(128) NOT NULL,
    numeric_value numeric NOT NULL CHECK (abs(numeric_value) < 1e100),
    enum_code bigint,
    enum_label varchar(512),
    record_time timestamptz,
    record_second bigint,
    original_time varchar(128),
    time_role varchar(80) NOT NULL,
    time_precision varchar(24) NOT NULL,
    time_policy varchar(120) NOT NULL,
    year_inferred boolean NOT NULL,
    rounding_decimals integer CHECK (rounding_decimals BETWEEN 0 AND 12),
    provider_unit varchar(64),
    first_acquisition_id uuid NOT NULL REFERENCES telemetry_acquisition(id),
    received_at timestamptz NOT NULL,
    FOREIGN KEY(catalog_version, parameter_id) REFERENCES telemetry_parameter(catalog_version, parameter_id),
    CHECK ((record_time IS NULL) = (record_second IS NULL)),
    CHECK (record_second IS NULL OR record_second=floor(extract(epoch FROM record_time)))
);
CREATE TABLE telemetry_record_evidence (
    acquisition_id uuid NOT NULL REFERENCES telemetry_acquisition(id),
    record_id char(64) NOT NULL REFERENCES telemetry_record(id),
    snapshot boolean NOT NULL,
    source_status_class varchar(128),
    source_status_indicator varchar(128),
    source_status_color varchar(128),
    calibrated_data varchar(128),
    changed_fields varchar(128),
    PRIMARY KEY(acquisition_id, record_id)
);
CREATE TABLE telemetry_admission (
    record_id char(64) PRIMARY KEY REFERENCES telemetry_record(id),
    decision varchar(24) NOT NULL CHECK (decision IN ('ACCEPTED','CONFLICT','INCOMPARABLE','UNTIMED','RESEND')),
    compared_record_id char(64) REFERENCES telemetry_record(id),
    policy varchar(80) NOT NULL
);
CREATE INDEX telemetry_record_chronology ON telemetry_record(catalog_version, parameter_id, record_second DESC, record_time DESC, id);
CREATE TABLE telemetry_bootstrap_state (
    provider varchar(24) NOT NULL CHECK (provider IN ('SENSEDATA','ISS_LIVE')),
    catalog_version varchar(80) NOT NULL REFERENCES telemetry_catalog(version),
    attempted_at timestamptz NOT NULL,
    completed boolean NOT NULL,
    PRIMARY KEY(provider, catalog_version)
);
CREATE FUNCTION telemetry_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    RAISE EXCEPTION 'Telemetry evidence is immutable';
END;
$function$;
CREATE TRIGGER telemetry_catalog_immutable BEFORE UPDATE OR DELETE ON telemetry_catalog FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
CREATE TRIGGER telemetry_parameter_immutable BEFORE UPDATE OR DELETE ON telemetry_parameter FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
CREATE TRIGGER telemetry_acquisition_immutable BEFORE UPDATE OR DELETE ON telemetry_acquisition FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
CREATE TRIGGER telemetry_record_immutable BEFORE UPDATE OR DELETE ON telemetry_record FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
CREATE TRIGGER telemetry_record_evidence_immutable BEFORE UPDATE OR DELETE ON telemetry_record_evidence FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
CREATE TRIGGER telemetry_admission_immutable BEFORE UPDATE OR DELETE ON telemetry_admission FOR EACH ROW EXECUTE FUNCTION telemetry_reject_mutation();
