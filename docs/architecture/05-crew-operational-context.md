# Crew operational-context architecture

Status: Crew REST implemented, NASA verification/reconciliation retained and validated, 2026-10-03. ADR-0007 governs field authority, ADR-0008 the retained LL2 history/UUIDs, and [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md) the independent evidence and derived interpretation. One Spring backend and PostgreSQL remain sufficient.

```text
LL2 → LaunchLibrary2CrewSource → CrewIngestionService → CrewRepository/JdbcCrewRepository
                                                       → immutable structured observations
NASA official RSS → conditional HTTP → NasaCrewVerificationIngestionService
                                      → XML/DOM verification parser
                                      → CrewVerificationRepository/JdbcCrewVerificationRepository
                                      → immutable documents/evidence/subjects
Persisted sources → deterministic audited identity resolution → CrewReconciliationService
                    → CrewReconciliationRepository/JdbcCrewReconciliationRepository
                    → immutable versioned interpretation + relational input/person lineage
                    → CrewReconciliationQueryService (internal, age-aware, read-only)
                    → implemented REST → future Crew UI
```

Crew owns source profiles, structured assignments, UUID mappings, official evidence, acquisition history and derived presence. Orbit owns GP/TLE, Orekit, NASA OEM, orbit persistence/API and rendering delivery. There are no imports between Crew and Orbit. Application/domain remain independent of Spring/JDBC; root configuration composes Clock, policies, services and schedulers. No broker, ORM, extra service or database engine is added. jsoup 1.21.2 is used solely by the NASA paragraph DOM adapter.

LL2 normal refresh remains one active detailed expedition request, no pagination/profile loop. NASA normal refresh is one official bounded RSS GET with full content, no article/profile request. Source schedulers are independent and never call the other provider. Composition triggers reconciliation after actual attempts over persisted data; unchanged interpretation reuses its snapshot. Manual callers can invoke the same internal services explicitly. There is no immediate startup source call; defaults LL2 PT5M and NASA PT10M initial delays, PT2H fixed delays. Durable eligibility and Retry-After prevent restart storms; overlap guards are local to the intended single backend.

Separate fetch, source document, semantic evidence, identity decision, reconciliation run and immutable snapshot avoid conflating operation with truth. Partial NASA omission is inert, planned events do not become completed, and LL2 in_space/assignments do not imply current occupancy. NASA cannot change LL2 profile observations. Failed source/parse/persistence/reconciliation retains history while current query exposes unavailable/stale/ambiguous state. PostgreSQL advisory locks serialize identity/graph writers; no distributed scheduler ownership is claimed. Crash IN_PROGRESS recovery remains deferred pending an ownership/liveness policy.

The canonical query returns current as-of interpretation, structured current expedition/profile data, independent source health/freshness, unresolved identities, input provenance, last parse failure and last derived attempt. Historical derived state stays immutable; age is recomputed when queried. REST is implemented; UI, event-aware refresh and Replay remain future. The independent orbital RTN milestone remains pending. [Exact source/parser/status/schema rules](../crew/nasa-verification-and-reconciliation.md), [regression evidence](../crew/reconciliation-validation/README.md).

The internal canonical query also returns the exact typed NASA evidence and identity audits used by its interpretation (including NASA-only display names/profile links and article timestamps). Structured LL2 data is read by the interpretation’s exact snapshot/run IDs, preventing a concurrent ingestion from mixing a newer structured snapshot with an older interpretation. REST consumes these fields without source parsing or identity inference.

## Implemented REST boundary — 2026-10-03

```text
LL2 observations ─┐
                  ├→ persisted reconciliation → Crew query layer → CrewRestQueryService → CrewController → JSON
NASA evidence ────┘                        PostgreSQL ↗
```

Read-only REST now exposes Crew, structured current Expedition and UUID person detail. Existing source/reconciliation queries retain ownership; the added CrewReadQueryService/adapter supplies batched known identities/profiles and explicit no-active outcome. Public DTOs live in api/crew and never serialize persistence/domain records directly. The REST service opens read-only REPEATABLE_READ composition, with no source fetch or persistence command. No new service/database/broker/cache/spec dependency or Crew→Orbit dependency. ADR-0007/0008/0009 already govern these choices, so no new ADR is needed. Frontend remains future: ISS CREW EARTH VIEW PANEL. Event-aware refresh/Replay and independent orbital RTN remain pending. [Contract](../api/crew-api.md), [evidence](../crew/rest-api-validation/README.md).
