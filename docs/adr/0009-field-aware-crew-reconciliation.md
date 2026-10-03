# ADR-0009: Reconcile Crew through field-aware source authority

Status: Accepted

Date: 2026-10-03

## Context

ADR-0007 separates physical presence from assignment; ADR-0008 provides immutable structured history and identity anchors. This milestone requires automated official evidence, conservative identities and a durable canonical interpretation without changing either source. Live validation established an official RSS feed with full operational content and HTTP validators; NASA editorial mission/overview pages have mixed sections and weaker dates.

## Decision

Keep LL2 profile and structured assignment authority. Use explicit NASA operational assertions for current presence/count under typed temporal and freshness policy. Persist deduplicated raw feed documents and versioned evidence, separate audited identity resolutions and immutable versioned reconciliation snapshots with relational input/person lineage. Reuse existing sync runs, JDBC/PostgreSQL/Flyway and UUID anchors; reconcile persisted inputs in process. Exact unique names are a constrained audited fallback, never universal identities. Unknown and conflicting evidence stay visible. Runtime extraction is a narrow versioned deterministic XML/DOM parser; all live person coverage is partial. No omission-based departure is inferred from those sources. See [design and semantics](../crew/nasa-verification-and-reconciliation.md).

## Alternatives considered

- Mutate LL2 into a NASA-approved current roster: destroys source facts and conflates assignment/presence.
- Universal source priority or count equality: cannot explain field authority or unidentified people.
- Mission/overview page as exhaustive current roster: mixed editorial sections and date-only updates lack the required temporal guarantee.
- Full historical blog crawl or runtime language model: unbounded acquisition and non-deterministic extraction.
- Separate service/database: no current deployment or scale need.

## Consequences

- Positive: independent histories, reproducible parser/algorithm lineage, safe handovers, future REST queries with explicit uncertainty.
- Negative: bounded grammar can fail on editorial changes, some subjects remain unresolved, raw content grows with changed feeds; freshness is project policy and historical events do not certify indefinite presence. Retention and multi-instance ownership require future decisions.
- Validation: offline parser/identity/temporal/status tests, PostgreSQL constraints/dedupe/rollback/migration tests, scheduler/conditional-HTTP tests and frozen Orbit/graphics regression gates.
