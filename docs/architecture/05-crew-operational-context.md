# Crew operational-context architecture

**Current scheduling extension (2026-10-03):** [Event-aware refresh](../crew/event-aware-refresh.md) is an operational Crew scheduling concern. LL2 `/events/` candidate history is separate from roster snapshots; completed named NASA transfer evidence permits bounded LL2 follow-up without changing authority or reconciliation. V5/ADR-0010 record durable eligibility, source-run associations, Retry-After, settlement and restart behavior. See the [validation dossier](../crew/event-aware-refresh-validation/README.md). Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

Status: Crew REST and Earth View Crew panel implemented, NASA verification/reconciliation retained and validated, 2026-10-03. ADR-0007 governs field authority, ADR-0008 the retained LL2 history/UUIDs, and [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md) the independent evidence and derived interpretation. One Spring backend and PostgreSQL remain sufficient.

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
                    → implemented REST → Earth View Crew panel → lazy UUID person detail
```

Crew owns source profiles, structured assignments, UUID mappings, official evidence, acquisition history and derived presence. Orbit owns GP/TLE, Orekit, NASA OEM, orbit persistence/API and rendering delivery. There are no imports between Crew and Orbit. Application/domain remain independent of Spring/JDBC; root configuration composes Clock, policies, services and schedulers. No broker, ORM, extra service or database engine is added. jsoup 1.21.2 is used solely by the NASA paragraph DOM adapter.

LL2 normal refresh remains one active detailed expedition request, no pagination/profile loop. NASA normal refresh is one official bounded RSS GET with full content, no article/profile request. Source schedulers are independent and never call the other provider. Composition triggers reconciliation after actual attempts over persisted data; unchanged interpretation reuses its snapshot. Manual callers can invoke the same internal services explicitly. There is no immediate startup source call; defaults LL2 PT5M and NASA PT10M initial delays, PT2H fixed delays. Durable eligibility and Retry-After prevent restart storms; overlap guards are local to the intended single backend.

Separate fetch, source document, semantic evidence, identity decision, reconciliation run and immutable snapshot avoid conflating operation with truth. Partial NASA omission is inert, planned events do not become completed, and LL2 in_space/assignments do not imply current occupancy. NASA cannot change LL2 profile observations. Failed source/parse/persistence/reconciliation retains history while current query exposes unavailable/stale/ambiguous state. PostgreSQL advisory locks serialize identity/graph writers; no distributed scheduler ownership is claimed. Crash IN_PROGRESS recovery remains deferred pending an ownership/liveness policy.

The canonical query returns current as-of interpretation, structured current expedition/profile data, independent source health/freshness, unresolved identities, input provenance, last parse failure and last derived attempt. Historical derived state stays immutable; age is recomputed when queried. REST and Crew UI are implemented; event-aware refresh and Replay remain future. The independent orbital RTN milestone remains pending. [Exact source/parser/status/schema rules](../crew/nasa-verification-and-reconciliation.md), [regression evidence](../crew/reconciliation-validation/README.md).

The internal canonical query also returns the exact typed NASA evidence and identity audits used by its interpretation (including NASA-only display names/profile links and article timestamps). Structured LL2 data is read by the interpretation’s exact snapshot/run IDs, preventing a concurrent ingestion from mixing a newer structured snapshot with an older interpretation. REST consumes these fields without source parsing or identity inference.

## Implemented REST boundary — 2026-10-03

```text
LL2 observations ─┐
                  ├→ persisted reconciliation → Crew query layer → CrewRestQueryService → CrewController → JSON
NASA evidence ────┘                        PostgreSQL ↗
```

Read-only REST exposes Crew, structured current Expedition and UUID person detail. Existing source/reconciliation queries retain ownership; the added CrewReadQueryService/adapter supplies batched known identities/profiles and explicit no-active outcome. Public DTOs live in api/crew and never serialize persistence/domain records directly. The REST service opens read-only REPEATABLE_READ composition, with no source fetch or persistence command. No new service/database/broker/cache/spec dependency or Crew→Orbit dependency. ADR-0007/0008/0009 already govern these choices, so no new ADR is needed. Event-aware refresh/Replay and independent orbital RTN remain pending. [Contract](../api/crew-api.md), [REST evidence](../crew/rest-api-validation/README.md).

## Earth View Crew boundary — 2026-10-03

```text
LL2 observations ─┐
                  ├→ persisted reconciliation → PostgreSQL → Crew REST API
NASA evidence ────┘                                           ↓
                                                   Earth View Crew panel
                                                             ↓
                                                   lazy astronaut detail
```

Frontend → MISSION1 REST only. Source evidence/profiles/media references retain their provenance; no provider API, RSS/HTML parser, identity resolver, ingestion or policy code moves into React. The collection already contains its exact Expedition context. Its nullable authoritative count, resolved identities, assignment count and unresolved assertion entries remain distinct; no extra latest-Expedition request mixes snapshots.

App owns panel visibility alongside existing ISS/module context. `CrewPanel` owns selected person; independent `useIssCrew`/`useCrewMember` hooks own abortable HTTP state. Explicit DTO decoding tolerates additive fields while rejecting unsupported required shapes. Memoized Crew UI depends on stable callbacks, not Cesium time/frames. The existing EarthView owns its persistent Viewer, clock, model, camera transitions and pick handler unchanged. Crew is a bounded DOM overlay, with internal scroll and responsive drawer/sheet; module selection prevents overlapping station detail panels. No route, modal backdrop, global state library, cache, polling timer or distributed infrastructure is introduced.

This is implementation within the accepted REST/domain architecture, not a new durable structural choice. No ADR-0010 is needed. [UI evidence, lifecycle/performance and limits](../frontend/crew-earth-view-panel-review/README.md). Next single Crew milestone: **ISS CREW EVENT-AWARE REFRESH**.


## Replay integration — 2026-10-03

Crew milestone 7 (Replay integration) is DONE. Effective-time historical state remains independent of orbital availability and current acquisition health. [Cross-domain composition](06-mission-replay.md).

## NASA editorial source, shadow only — 2026-10-10

[ADR-0014](../adr/0014-nasa-editorial-roster-shadow-observations.md) extends the existing Crew module with source-directed WordPress topic/taxonomy/mission discovery, bounded semantic parsing, explicit personal-resource verification and immutable JDBC observations. The separate acquisition table scopes topic/Expedition/profile health without altering legacy source-wide operational selectors. Existing raw-body/document infrastructure is reused; no service, broker, new database or generic event platform is introduced. Internal persisted-input health/comparison services remain outside public Current/Replay composition. [Detailed boundary and validation](../crew/nasa-editorial-roster-validation/README.md).
## Independent automatic identity shadow

[ADR-0015](../adr/0015-automatic-crew-identity-shadow.md) adds deterministic native Java resolution over retained unfused Crew evidence, with a frozen calibrated logistic model, source-scoped personal witnesses, component/ambiguity guards, PostgreSQL jobs and reversible shadow graph revisions. It consumes V8 resource/caption relations without new acquisition. Production identity/presence/Current/Replay still use V7; automatic decisions are diagnostic until independent accuracy and lifecycle rollout gates pass.

## Shadow membership overlay — 2026-10-11

[ADR-0016](../adr/0016-shadow-active-crew-membership.md) adds `crew.membership` within the existing Crew module. `RetainedMembershipInputs` obtains a batched repeatable-read cut; `ShadowMembershipIdentity` binds exact source versions through the pinned V9 graph; `ActiveMembershipPolicy` evaluates positive supports and operational episodes; `ActiveMembershipStore` atomically appends V10 revisions. The sole writer holds an advisory lock before loading the cut. Durable source/graph notifications and a bounded expiry schedule do not depend on GET traffic. `latest()` and `health()` are internal read-only queries. `LegacyMembershipComparison` consults V7 only after the independent shadow result exists. No new service, identity graph, network acquisition or public DTO is introduced. [Validation and rollout boundary](../crew/active-membership-shadow-validation/README.md).

## Production Current membership — ADR-0017

The same Crew module now reads compatible sealed V10 ACTIVE membership through a separate SELECT-only port and publishes profiles through production V7 canonical authority. The default activation and explicit legacy rollback affect Current inclusion only. Existing source fields, independent presence/count quality, retained details, V9 shadow identity and historical Replay boundaries remain separate. No schema or infrastructure is added. [ADR and consequences](../adr/0017-production-current-active-membership.md), [acceptance](../crew/current-active-projection-activation/README.md).

## Current summary semantic cleanup — 2026-10-11

[ADR-0018](../adr/0018-current-crew-summary-semantics.md) gives Current a purpose-specific
count DTO: confirmed physical presence and structured assignments remain independent
source diagnostics; legacy operational count history/gap and unresolved reports remain
internal or Historical/Replay. Current's sole headline is resolved membership cardinality.
Typed ACTIVE source-slot diagnostics remain in source details, with no retained-slot
contribution or human-count inference. No source, identity, lifecycle or schema changes.
[Investigation and validation](../crew/current-ui-semantic-cleanup/README.md).
