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


## Operational grammar clarification — 2026-10-11

The accepted source adapter/parser remains the sole operational interpreter. Feed and post parser
release **1.1.0** supports the recorded `At h:mm a.m./p.m. EDT/EST, <agency-qualified named list>
undocked from <ISS port/module> aboard <crew spacecraft>` clause. It emits the existing
PERSON_DEPARTED_STATION / COMPLETED / PARTIAL evidence, with no new event enum or migration.
Subject spelling/order, article identity, paragraph locator and V6 assertion/subject occurrences
remain source facts. Completion comes from this clause alone; roster omission and LL2 omission
are never departure evidence. Prospective, delayed, quoted, biographical, historical and modal
language cannot establish completion. Unsupported relevant transitions fail closed. Cargo, landing
and splashdown do not create astronaut station departures. Two distinct source articles can retain
separate assertions of the same undocking; they are not two physical transfers or a count change.

Explicit event time is separate from publication and original capture. Clock plus dated article URL
must agree with local publication date; publication checks consistency/upper bound, never replaces
the event clock. Optional weekday chooses the unique most recent weekday within six days of that
validated article date. Missing/conflicting dates, future completed instants and DST gaps fail closed.
America/New_York date rules plus explicit EDT/EST resolve UTC, including fall-back overlap. Minute
precision remains MINUTE, with representation at its inclusive minute boundary, never exact-second
precision. The existing bounded evidence_method field carries versioned typed temporal provenance;
exact clock/zone prose also remains in the immutable excerpt/body. Existing undated 1.0 assertions
retain their previous publication-proxy behavior, rather than receiving invented timestamps.

An explicit retained-document command appends a new parser-version document interpretation and
new evidence only where semantics changed. Raw bodies, failed 1.0 documents/runs and old evidence
remain immutable. Exact original captured-byte lineage supplies V6 observations even when the old
parse failed. Reinterpretation creates no acquisition run, cannot reset freshness and makes no HTTP
request. Only a normal live acquisition updates independent operational source health. Unchanged
1.0 grammar keeps its previous evidence fingerprint/version; explicit timed events retain one logical
occurrence across metadata republication and A→B→A. Parser success is source interpretation, never
physical onboard telemetry. Identity binding remains downstream and separate.

New timed-departure evidence is eligible for V10 shadow only. A pure public-read eligibility boundary
keeps production Current/Replay on accepted legacy evidence until explicit activation; live acquisition
health and consequent existing freshness assessments can evolve normally. Public membership,
profiles, UUID aliases and Replay event semantics are not activated from V9/V10. This is a grammar
extension within the accepted decision, not a replacement architecture. [Validation and limitations](../crew/nasa-operational-departure-validation/README.md).
