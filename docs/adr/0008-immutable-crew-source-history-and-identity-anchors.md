# ADR-0008: Persist Crew as immutable source observations with stable identity anchors

Status: Accepted

Date: 2026-10-03

## Context

The authorized Crew persistence milestone needs durable source observations, request/failure history, stable internal identities and future reconciliation/Replay inputs. ADR-0007 separates assignments from physical presence; storing LL2 membership as a canonical current roster would violate that boundary. Repeated identical retrievals must preserve freshness without duplicating the observation graph. The existing backend uses PostgreSQL, Spring JDBC and Flyway.

## Decision

Separate sync runs, immutable unique source snapshots, UUID identity anchors with exact external-ID mappings, and snapshot-owned observations. Store relational identities/graph/query fields and bounded JSONB agency/nationality/media structures. Retain normalized observations and exact body hashes, without raw payload archives. Snapshot identity includes source/station/source station ID/API and adapter versions/hash. Latest source state follows the latest successful run, not snapshot insertion order.

Start runs in an independent committed transaction; atomically store identities/graph and success completion; separately record failure after rollback. Use restrictive FKs and immutable-history database triggers. Use the existing single backend/database and Spring scheduling, with conservative configurable LL2 delays, durable request/rate-limit eligibility, no retries and process-local overlap protection. No canonical presence or NASA reconciliation is implemented. See [persistence design](../crew/persistence-and-ingestion.md).

## Alternatives considered

- Mutable current profile/roster rows: less storage, but loses source-change history and conflates membership with occupancy.
- A complete graph per fetch: records retrievals but unnecessarily duplicates identical content.
- One opaque JSONB domain blob: simpler initial writes but loses relational identity/FK/role constraints and usable queries.
- A global agency/media/nationality master-data model: extra lifecycle and reconciliation work without a current query need.
- Raw LL2 payload retention: useful for forensic reprocessing, but adds archive/rights/retention policy; normalized history plus source hash meets the current scope.

## Consequences

- Positive: source provenance and historical roster/profile changes survive; identities remain stable; failures do not erase good state; future reconciliation can consume observations independently.
- Negative: additional storage and mapping code, no raw-byte reprocessing guarantee, observable interrupted runs and no distributed scheduler ownership. Database unavailability can prevent even failure logging to the database.
- Validation: PostgreSQL Testcontainers dedupe/history/identity/constraint/rollback/latest-query tests, offline failure and scheduling tests, Crew/Orbit dependency gate and unchanged orbital/graphics smoke. Revisit retention, multi-instance locking and normalization upgrades when concrete requirements arise.
