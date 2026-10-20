# Public initial database baseline — 2026-10-14

## Final clean-install consolidation — 2026-10-21

The current installation contract is one `V1__initial_schema.sql` containing the
complete accepted schema: **89 tables, 726 table columns, 184 indexes, 592 constraints,
29 identity sequences, two views, 26 functions and 124 application triggers**.
It incorporates the seven telemetry tables previously introduced by V2 and both
retained-provider/rejection tables previously introduced by V3, with all their
keys, checks, indexes and immutability guards. Existing V1 objects are unchanged.
All domain tables remain empty after Flyway; reference/coordination initialization
retains its application owners. No top-level data statements are introduced.

The former V1/V2/V3 chain and the canonical V1 were applied independently to empty
PostgreSQL16.10 databases. Catalog comparison found zero differences in schema,
column types/nullability/defaults/identity, constraints, indexes, sequence ownership,
views, functions, trigger behavior/order, policies, types and comments. Only Flyway
history intentionally changes from three successful entries to one. The
[current schema inventory](database-publication-schema.md) includes all nine
telemetry tables. Testcontainers covers the complete canonical V1 and all existing
storage behavior; no old migration is hidden by targeting only version1.

An existing development database with the previous checksums/history must be
recreated deliberately or replaced by a new empty database. No automatic repair,
baselineOnMigrate, compatibility migration or deployed-production upgrade is claimed.
Run `mvn clean verify` after pulling this change to remove obsolete compiled V2/V3
resources before startup. The normal development database is not destroyed by the
application or by the validation procedure.

This is the final consolidation of the existing one-baseline contract, without a
schema/architecture redesign or new ADR. The original dated publication dossier
below preserves its then-current counts, checksums and validation history.

## Original publication dossier — 2026-10-14

Starting revision: `a9bf258bd382cea8e5083c201a6515a82f80b352`, clean `main`.
The final revision is the single ordinary commit containing this dossier; its SHA
and remote equality are recorded in the external Git proof and project context.
[ADR-0023](../adr/0023-public-initial-database-schema.md) records the publication decision.

## Structure and installation boundary

Thirteen development migrations are replaced by exactly
`backend/src/main/resources/db/migration/V1__initial_schema.sql`. This is the first
public schema. Future public migrations begin with V2. Git history preserves the
development chain; upgrading or repairing its development databases is unsupported.
Use a completely empty PostgreSQL database or deliberately discard the local
development volume. No V14, compatibility views, old-name aliases or upgrade path
are included.

V1 contains tables, identity columns/sequences, primary/unique/foreign keys, checks,
indexes, canonical knowledge views and the necessary lineage, immutability,
atomic-proof and work-notification functions/triggers. There are no top-level INSERT,
UPDATE, DELETE or COPY statements, source observations, runtime history, packaged
reference rows, ownership/ACL noise or Flyway history definitions. Trigger bodies
write notifications only when future application source rows arrive. There is no
structural/reference data exception.

The old chain inserted six coordination rows: GP request state, NASA request budget,
resource acquisition lease, research sweep lease, membership work and operational
binding work. `DatabaseRuntimeInitialization` now initializes them explicitly after
Flyway, in one transaction with `ON CONFLICT DO NOTHING`. Restart cannot reset
cooldown/suspension, pacing, work generations or progress. The packaged reviewed
identity manifest and frozen research resources retain their separate application
initialization paths; SQL duplicates none of their reference information.

## Schema and naming

[Complete table inventory](database-publication-schema.md): **80 domain tables,
634 columns, 172 indexes, 555 constraints, 29 identity sequences, two views,
25 functions and 117 triggers**. No custom PostgreSQL enum/domain types or new
extensions are required. PostgreSQL also creates 82 implicit composite row types
and 82 array types for the domain tables/views; their names pass the same audit.
Flyway adds its normal metadata table and associated types separately.

The old chain was executed once in an isolated reference database. Catalog-by-catalog
comparison preserves types, nullability/defaults, keys, ownership, uniqueness,
checks, index coverage, sequence settings, view semantics, function logic, trigger
ordering and deferred atomicity under the documented name/value mapping. PostgreSQL
execution order is checked within each timing/event/row-or-statement class;
seven notification triggers use explicit `a_`/`b_`/`c_` ordering prefixes to retain
the original membership → research → operational notification/lock sequence.
The public schema test asserts their function execution order. PostgreSQL
deparsing distributes a constant varchar-array/text-array cast over array members;
those predicates have the same values/operators. The resource-relation identity
sequence follows its final table name. No business invariant is weakened.

| Development name/value | Public terminology |
| --- | --- |
| `crew_auto_*` | `crew_identity_research_*` |
| `crew_editorial_resource` / `crew_editorial_resource_relation` | `crew_resource` / `crew_resource_relation` |
| Other `crew_editorial_*` | `crew_resource_*` |
| `crew_active_projection_*` and its guards | `crew_membership_projection_*` / `crew_membership_*` |
| `crew_operational_binding_*` | `crew_operational_subject_binding_*` |
| `crew_active_equivalence` / `crew_active_identity_binding` | `crew_current_person_equivalence` / `crew_current_identity_binding` |
| `reused_editorial_acquisition_id` | `reused_resource_acquisition_id` |
| `V9_AUTOMATIC_SHADOW` / `V9_IDENTITY_RESOLVER` | `IDENTITY_RESEARCH_SHADOW` / `IDENTITY_RESEARCH_BINDING` |
| `S10_SCOPED_BINDING` | `OPERATIONAL_SUBJECT_BINDING` |
| `HISTORICAL_V10_S10` | `UNIFIED_HISTORICAL` |
| `EXPLICIT_V7`, `*_V7_RESOURCE`, `S10_*` result labels | Canonical identity/resource and operational binding labels |
| `v7Targets` / `explicitV7Target` | `canonicalTargets` / `explicitCanonicalTarget` |
| `legacy:` unassociated subject fallback | `unassociated:` |
| `automatic-shadow`, `active-shadow`, `operational-shadow` schedules | `identity-research`, `membership`, `operational-binding` |

All persistence adapters, row mappers, health queries and current tests directly use
the public schema. There is no JPA/H2 persistence layer. The full name audit covers
tables, columns, indexes, constraints, sequences, views, types, functions and triggers:
**zero development-generation object names**. Production code matches are classified
as versioned provenance, actual automatic operation, previous/current values,
language construction, animation progress or temporary render preparation.

## Compatibility removed and safety retained

Remove `LEGACY_RETAINED_UNION`, `LEGACY_OPERATIONAL_BINDING`, Replay `LEGACY`, their
selectors and retained-union composition/reconstruction. Remove the old freshness-v1
selector, obsolete startup occurrence backfill and acceptance/reuse of pre-publication
name-only resolver audits. The typed provider-key factory has a responsibility name;
it is not an old-schema alias. Test-only old audit seeding is removed.

Keep current-policy typed audit idempotency, reviewed canonical UUID equivalence,
independent provider identities, conservative unassociated source evidence,
fail-closed Current projection validation and exact newest operational heads.
Explicit canonical correspondence remains fallback only when no operational head
exists; DEFER/CONFLICT/incompatible/expired heads cannot resurrect an older match.
Retained-document reinterpretation remains a current forensic capability. SHADOW
research and its diagnostic lifecycle evaluations cannot authorize production identity
or membership. Operational gates, departure veto/reentry and discovery bounds remain.

## API and provenance versions

REST routes and response-record fields are unchanged. Current retains
`ACTIVE_PROJECTION`. Historical's intentional public value is `UNIFIED_HISTORICAL`;
its profile policy is now
`LATEST_AVAILABLE_CANONICAL_METADATA; MEMBERSHIP_LIFECYCLE_AT_REQUESTED_TIME; OPERATIONAL_BINDING_KNOWLEDGE_TODAY`.
Backend, frontend decoder/types/views, documentation and tests agree.

The new `operational-subject-cut-v1` identifies the public serialized cut format with
the renamed canonical fields; the old cut format remains historical evidence.
Frozen model/parser/policy identifiers retain their actual meaning and exact model,
lexical, reviewed-manifest and Orekit resource bytes. Important retained identifiers:

- External APIs: LL2 `2.3.0`, NASA WordPress `/wp-json/wp/v2/`.
- Research: `crew-auto-identity-v1-shadow`, `research-logistic-v1`,
  `research-13-v1-scoped-extractor-1`, `balanced-0.991-margin-0.20-scoped-1`.
- Qualified operational provenance: `s10-scoped-shadow-v1`, `s10-scoped-production-v1`,
  `s10-research13-qualified-signals-v1`, `s10-research-authority-matrix-v1`,
  `s10-nfkc-casefold-icu78.3-v1`, `s10-official-resources-v2` and the frozen sealed-policy
  consumption identifier `EXACT_LATEST_SEALED_EXISTING_V7_FAIL_CLOSED_V1`.
- Canonical/reviewed provenance: `crew-canonical-identity-v1`,
  `crew-reviewed-identities-v1` (including its versioned declaration keys),
  `crew-canonical-profile-v1`, `crew-person-resolution-v1` (the pure candidate
  algorithm) and `crew-person-resolution-v2` (the canonical authority facade).
- Source/parser/occurrence provenance: `ll2-crew-v1`, `ll2-crew-events-v1`,
  `nasa-crew-document-v1`, NASA operational parsers `1.1.0` / `1.2.0`, editorial parser `1`,
  `crew-occurrence-v1` and `crew-compatible-selection-v1`.
- Evaluation provenance: `crew-reconciliation-v3/crew-canonical-identity-v1`,
  `effective-time-v1`, `crew-freshness-v2`, `crew-active-shadow-v1` /
  `crew-active-production-v1`, `orbital-current-v1` and
  `orbit-replay-nearest-gp-bounded-oem-v1`.
  Dated dossiers/ADRs retain their original migration labels as historical documentation.

## Validation

The normal production jar was paused at the runtime-initialization bean boundary,
after Flyway and before any application reference/coordination/source writes. A new
PostgreSQL 16.10 instance had **zero tables before startup**; afterward all expected
domain objects existed, every one of the 80 tables had **zero rows**, and Flyway
contained exactly one successful SQL entry: `1 / V1__initial_schema.sql`.
No data restore, fixture database, manual source stage, binding or GP/Crew insert
produced the live state.

The first normal run became ready, checked GP eligibility nine milliseconds later,
and recorded a genuine CelesTrak transport timeout. Its durable 2h10m deadline was
preserved across a QA port correction and final-artifact restart. LL2 succeeded at
readiness +5m01s; NASA at +10m02s; membership materialized seven Current humans at
approximately +15m00s. NASA resource acquisition and dynamic discovery populated
normally; truthful DEGRADED health and unresolved slots remain distinct from humans.
Historical uses only installation-acquired evidence. Source effective times may
precede receipt; captured structured/editorial rosters never backdate themselves.

The definitive jar (SHA-256
`c4d5b350cc7a8d789143c778bc2b5931a42c71535077fa56bd0bc762585bcdcd`)
was then applied to a newly created empty instance. Its V1 checksum is `-1371784637`;
all 80 domain tables again contained zero rows before application initialization.
Readiness was reported at `2026-10-14T00:20:39.702Z`; the normal GP eligibility check
started 11ms later, a valid fetch was logged at +1.166s, and Orbit HTTP 200 was
observed at +1.644s. No source or worker setting was overridden.

LL2 completed at `00:22:40.910564Z` and NASA at `00:27:42.031640Z`. Their configured
5m/10m gates begin at coordinator construction, so the diagnostic pre-bootstrap
pause consumes part of those delays; this is not accelerated acquisition. Current
first returned HTTP 200 with seven members at `00:35:53.388017Z`, approximately
+15m14s (30s observation resolution). Dynamic discovery was observed at `00:36:23Z`.
While validation was interrupted, normal GP requests at `02:30`, `04:40` and `06:50Z`
retained new and duplicate observations, proving the 2h10m cadence on the actual
installation. One later LL2 failure retained last-good state and recovered through
the next normal acquisition. Current remained seven humans.

Mature Historical at `00:19Z`, before local structured capture, has no assignments
and PARTIAL coverage; one genuinely qualified NASA assertion can describe an earlier
effective instant using present binding knowledge. At `00:24Z`, after LL2 receipt,
there are seven captured assignments. This preserves accepted Historical semantics:
no imported archive or invented roster, and source effective time remains distinct
from receipt/knowledge time.

Offline backend: **1189 → 1191 tests**, zero failures/errors in the final test/verify
runs. Eight obsolete migration-evolution cases are replaced by ten public-V1/empty-
state/initialization checks. Domain regressions remain. The baseline initially had
two Alex-1/Aurora timing failures before any code changes; their fixture now advances
the virtual clock to the normal worker deadline, without changing production timing.
Old rollback API/lifecycle fixtures are rewired to the public paths or explicit
test-only SHADOW evaluation. Transfer fixtures use typed reviewed correspondence.

Crew-42, Alex-1, Aurora, rename-to-Nimbus, same-name distinct relations, later discovery
and unchanged-input idempotency pass. Canonical authority, resource acquisition,
research SHADOW, operational thresholds/margins/witnesses/contradictions and the shared
membership/historical lifecycle remain covered. Initial eligibility, cooldown,
T−377ms scheduling, concurrent reservation, transport failure/recovery, 2h10m pacing,
GP lineage and OEM regressions pass. An explicit final rerun covers 62 discovery,
refresh, lineage, propagation and OEM cases with zero failures/errors. **289 GP
states and 440 OEM position/velocity results are bit-identical** to the baseline;
86 orbital classes/data files in the final jar are unchanged.

Frontend: **829 → 829 tests / 68 files**, typecheck and production build pass; the
existing large-bundle advisory remains. No styles, assets, Earth/Inspection geometry
or controls changed. Current/detail/provenance/Historical and responsive Crew checks
pass on the final clean store at exact CSS viewports 1440×900, 1024×768, 768×1024,
390×844 and 320×568 with one canvas and no page overflow. GP/TLE ↔ NASA OEM,
trajectory, Zoom/Reset, completed Inspection entry/return, Crew/detail/biography,
Data source, Historical/calendar and Current ↔ Historical pass. The calendar applies
`2026-10-14T00:40:00Z` with seven captured Historical members. Browser zoom was
preserved; viewport overrides were adjusted to measured CSS dimensions. Final console
capture contains zero warning/error entries.

One verify attempt hit a Testcontainers port collision with the QA loopback port;
the isolated QA PostgreSQL moved outside the dynamic range while keeping its volume,
Flyway history and GP deadline. The affected suite and full verify then passed.
Raw logs, full catalog/name mappings, zero-row proof, numerical comparison, live
timeline and screenshots are outside Git in
`/Users/daniel/.codex/exports/mission1-public-schema/`. Evidence is never bootstrap input.
