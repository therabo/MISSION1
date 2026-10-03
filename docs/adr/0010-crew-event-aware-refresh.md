# ADR-0010: Bounded event-aware Crew scheduling

Status: Accepted (2026-10-03)

Context: the accepted two-hour Crew source schedules can lag around planned transfers and after completed NASA arrival/departure reports. Source events are planning/verification evidence, not presence truth. LL2 has a shared public quota and its verified events representation lacks reliable crew/cargo and completion status.

Decision: retain the modular monolith and existing ingestion/reconciliation transactions. Add one Clock-driven coordinator, a pure policy, one bounded LL2 event-calendar GET every six hours, immutable candidate versions and durable trigger/follow-up audit in PostgreSQL V5. Accelerate NASA conservatively around precise CREWED/UNKNOWN schedule windows; accelerate LL2 only after completed named NASA transfer evidence, for at most six attempts/24h. Share LL2 Retry-After and a rolling request budget across catalog and roster. Existing source-disabled flags and baseline fallback remain available. No frontend, Orbit, parser grammar, reconciliation semantics or REST DTO changes.

Consequences: event history and trigger lineage explain each automated fetch and survive restart. Calendar failures reduce scheduling confidence; baseline ingestion continues. Empty astronaut relations remain UNKNOWN. Event-specific identity/assignment checks can settle a transfer without requiring an exhaustive roster. Unresolved subjects expire safely. LL2-to-NASA reciprocal follow-up is deferred to avoid feedback loops. V5 adds five narrowly scoped table groups; no generic event bus, Kafka, microservices or infrastructure is introduced. Actual interrupted attempts remain audited IN_PROGRESS, with no automatic abandonment based only on elapsed time.

Validation: see [policy and source contract](../crew/event-aware-refresh.md) and [validation dossier](../crew/event-aware-refresh-validation/README.md).
