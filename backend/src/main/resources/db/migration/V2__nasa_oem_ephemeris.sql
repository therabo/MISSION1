-- NASA OEM files are immutable by content hash; retrieval metadata tracks current-URL observations.
CREATE TABLE nasa_oem_ephemerides (
    sha256 varchar(64) PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    xml bytea NOT NULL,
    creation_date timestamptz NOT NULL,
    start_time timestamptz NOT NULL,
    stop_time timestamptz NOT NULL,
    last_retrieved_at timestamptz NOT NULL,
    http_last_modified timestamptz,
    CHECK (start_time < stop_time)
);
CREATE INDEX nasa_oem_latest_retrieval_idx ON nasa_oem_ephemerides (last_retrieved_at DESC);
