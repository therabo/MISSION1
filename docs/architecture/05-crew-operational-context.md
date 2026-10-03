# Crew operational-context architecture

Status: ingestion/persistence implemented and validated, 2026-10-03. [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md) governs source semantics; [ADR-0008](../adr/0008-immutable-crew-source-history-and-identity-anchors.md) governs durable history.

```text
LL2 2.3.0 → LaunchLibrary2CrewSource → CrewIngestionService
                                      │
                                      ├→ Crew source sync runs / outcomes
                                      └→ Immutable source snapshot / observations
                                               │
                                            PostgreSQL
                                               │
                                         CrewQueryService (internal)

Distinct NASA official documents → existing explicit document capture
                                  → FUTURE semantic verification
Persisted LL2 + FUTURE NASA evidence → FUTURE reconciliation → FUTURE REST/UI
```

## Responsibility and ownership

Crew remains one logical domain in the existing single Spring backend/database. It owns person/expedition UUID anchors, exact external mappings, source profiles, assignments and acquisition history. Orbit continues owning elements, propagation, OEM, orbital persistence and REST. Neither imports the other. Composition reuses the existing UTC Clock. No additional service, ORM, broker or database engine is introduced.

`crew/application` owns ingestion/eligibility and query services plus `CrewRepository`; `crew/persistence/JdbcCrewRepository` owns Spring JDBC SQL and transactions; `source/crew` retains provider HTTP/DTO mapping. Scheduler composition is in the root Spring package following the existing delayed Spring scheduling convention. Application/domain types do not import JDBC or Spring.

## Source calls and failures

One bounded active detailed expedition GET is the entire normal refresh. There is no pagination, station-discovery request or per-astronaut enrichment loop. Complete single AVAILABLE observations are eligible for graph storage. NO_ACTIVE_EXPEDITION and AMBIGUOUS remain explicit run outcomes, never selected-first/empty-success snapshots. Optional source nulls, mode, durations, multiple nationalities and media rights survive persistence.

The transport retains its configured timeout, 2 MiB post-receipt validation, no redirect following and zero retries. 404, 429, other HTTP errors, malformed payloads, timeout/network/interruption remain distinct source outcomes. Persisted Retry-After supports delay-seconds and HTTP-date and suppresses calls across coordinator restarts. A missing/invalid 429 header applies the normal delay as explicit project fallback policy; no provider cadence is asserted.

## History and operation

Sync attempts and unique source state are separate: identical successes create two runs and one immutable graph. Stable UUIDs resolve exact external IDs, with no name matching. Latest state follows the most recently completed successful run, even if it reuses an older snapshot. First observation and latest successful retrieval remain distinct.

Start-run commit precedes HTTP. Identities, snapshot graph and successful completion commit atomically; failed graph persistence rolls back, then the previously started run is completed as failed. A database outage or process crash can leave an observable IN_PROGRESS run; no durability claim is made while PostgreSQL is unavailable. Restrictive FKs and immutability triggers protect history. A PostgreSQL transaction advisory lock serializes identity allocation by writers; network scheduler ownership remains process-local.

LL2 scheduling defaults enabled/PT2H fixed delay/PT5M initial delay; persisted attempt eligibility also protects restart loops. Tests disable scheduling. One process-local coordinator prevents overlapping manual/scheduled ingestion. Spring's existing scheduling infrastructure is shared; a synchronous Crew tick is bounded by HTTP timeout and small database work. Failures are caught and do not disable future ticks or invalidate Orbit data. Multi-instance scheduler ownership requires a future decision.

NASA document/evidence contracts remain. There is no NASA semantic parser, NASA scheduler, reconciliation, StationPresence persistence, Crew REST or UI. A recent LL2 observation still cannot establish physical ISS presence.

## Validation and trade-offs

PostgreSQL Testcontainers verifies clean/upgrade migrations, relational constraints, dedupe, historical changes, stable UUIDs, nullability/media/nationality/duration round trips, rollback/failure history and latest-query ordering. Loopback/mock tests verify transport outcomes, request budget and concurrency. Configuration tests inspect the actual Spring scheduled task delay and prove no startup I/O. Domain/module fitness tests and unchanged-system API/browser smoke guard the frozen boundary. See [authoritative persistence design and operational commands](../crew/persistence-and-ingestion.md).
