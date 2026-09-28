# ADR-0002: PostgreSQL for initial telemetry history

Status: Accepted  
Date: 2026-09-28

## Context

The first backend slice needs durable normalized samples, latest-by-event-time lookup, and bounded history for a small verified parameter set. No measured ingest volume, retention horizon, or slow range query is available. The specification proposes PostgreSQL with TimescaleDB for eventual large-scale history and replay.

## Decision

Use ordinary PostgreSQL as the sole V1 persistence engine. The telemetry module owns sample meaning and a storage port; a PostgreSQL adapter owns rows, migrations, writes, and latest/range queries. Preserve typed values, time basis, quality/validation and provenance. Add only indexes justified by the first queries. Do not enable TimescaleDB-specific schema, compression, retention, or aggregates in V1.

## Alternatives considered

- PostgreSQL plus TimescaleDB would offer time-series facilities, but introduces extension/version and migration concerns without a demonstrated V1 query or volume benefit.
- Holding only current values in memory would be simpler to start, but would fail the required durable history and make restart behavior misleading.

## Consequences

- Positive: one familiar durable store, transactional writes, simple local/CI setup, and enough query capability for initial history.
- Negative: range-query and storage tuning remain manual; later high-volume history could require schema changes. The first implementation still needs migrations and an integration database test.
- Review trigger: observe write volume and real query plans; consider TimescaleDB only if a specific latency, retention, or compression need is not met economically in PostgreSQL.

## 2026-09-28 application note

[ADR-0004](0004-local-gp-propagation-for-current-orbit.md) changes the first durable record to **validated GP/TLE element sets and revisions**. Current orbital states are computed on demand and need not be written at display cadence. This refines the earlier assumed first “telemetry sample” shape; the accepted decision to use ordinary PostgreSQL, preserve time/provenance and add indexes for actual queries remains. Future verified telemetry history can use the sample-oriented policy above.
