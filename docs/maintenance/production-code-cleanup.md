# Production code cleanup — 2026-10-13

Starting revision: `5c654fc7d04a47273b67ac83eb37f30d750c43ac`, clean canonical
`main` in `/Users/daniel/Desktop/MISSION1`. This is a behavior-preserving cleanup
of the accepted architecture, not a new architectural decision. ADR-0021 and
ADR-0022 remain unchanged. The final revision is the ordinary commit containing
this report; its full SHA and remote equality are recorded in the external Git proof.

## Inventory and proof

The audit covers all 1,158 baseline tracked files: 201 production Java classes,
80 Java test/support files, 175 frontend source/test/asset files, 593 documentation
files, configuration, scripts and packaged resources. The complete inventories
and raw validation logs are outside Git at
`/Users/daniel/.codex/exports/mission1-production-cleanup/`.

Reference indexes cover every Java top-level class and frontend export, private
method candidates, the runtime TypeScript import graph, all 47 application property
keys, asset references and CSS selectors. Including annotation defaults, all 54 project configuration
keys plus the three Spring datasource settings are accounted for. Spring configuration, scheduled methods,
annotation-discovered repositories/controllers/advice, interface implementations,
Jackson records, Flyway and classpath resources were treated as entrypoints.
Compiler no-unused checks, clean Java compilation, PostgreSQL integration tests,
normal jar startup and browser checks complement textual references. A single grep
result was not accepted as removal proof. Git/history and dated diagnostic scripts
establish why the former comparison beans existed.

### Counts

Tracked files: **1158 → 1159**. Production Java classes: **201 → 197**
(one deleted, three moved to test scope). Seven obsolete UI component functions and
two whole UI modules are removed; shared profile/source modules are retained with
domain names. Production Java/TypeScript/CSS shrinks by **1155 lines**, including
relocation of diagnostic/reference code into tests. Net code/test reduction is
**893 lines**. No configuration key, asset or historical script is removed.

### Backend removals

| Previous item | Classification and proof | Disposition |
| --- | --- | --- |
| `LegacyMembershipComparison` | SAFE DEAD CODE: no production injection, controller, scheduler or test caller; only an old shadow-validation script invokes it | Delete 71-line diagnostic bean; Current's supported rollback selector remains |
| `CrewEditorialShadowService` | TEST-ONLY diagnostic: sole main reference registered an otherwise unconsumed comparison bean; tests and a dated script used it | Move into test scope as `CrewResourceComparison`; retain all comparison regressions |
| `ProductionShadowComparison` | TEST-ONLY diagnostic: no main consumer; only research tests and a dated validation script read it | Move as test component `IdentityResearchComparison`, explicitly imported by its integration test; absent from production scan/jar |
| `CrewEditorialHealthService` | TEST-ONLY diagnostic: only configuration registration in main; two comparison tests and a historical script used its combined report | Move as `CrewResourceHealthDiagnostic`; source health ownership tests retained |
| Editorial diagnostic bean factories | SAFE DEAD CODE after the preceding reachability audit | Delete both factories; configuration tests assert that only acquisition capabilities remain |

The documented `StationPresence` contract and explicit
`NasaOperationalReprocessingService` retained-document command remain. They have
published domain/forensic responsibilities and safety/idempotency regressions;
absence from scheduled ingestion alone does not prove them obsolete. Persistence
and reflection entrypoints remain. No source adapter, parser, repository, selector,
operational qualification gate or lifecycle implementation was deleted.

### Frontend removals

| Previous item | Proof and replacement |
| --- | --- |
| `CrewPanel` / `LegacyCrewPanel` standalone branch | `CurrentCrewWorkspace` always selected the resource-backed Current view; only obsolete standalone tests selected the other branch. Workspace now directly uses `CurrentCrewPanelView`, retaining the original memo boundary |
| `CurrentCrewPanel` loading wrapper | No runtime caller after direct resource ownership; resource-hook tests use a test harness and the real view |
| `CrewMemberDetail` | Only the removed standalone panel invoked it. Current uses `CrewAstronautDock`; Historical uses retained `CrewProfile` |
| `CrewSummary` / `PresenceLabel` | No runtime consumers after standalone removal. Useful membership, negative-presence, source/provenance and profile tests now exercise the actual Current/Historical roster |
| `TrajectorySelector` button/`legacy` presentation | App exclusively passed `presentation="context"`; remove the dead mode and retain identical context selector, accessibility, classification and guards |
| Full `OrbitalStatus` dashboard / obsolete props | Current always selected compact summary/evidence; Historical rendered its separate summary. Keep that exact production output |
| `ReplayControls` / `utcInput` | No runtime import path; `HistoricalTimeBar` / `HistoricalCalendar` own navigation and UTC validation |
| `useEarthWorkspace` dashboard owner branch | No rendered `.status-panel` or `.replay-orbit` in either final mode. Preserve root viewport measurement/observers and full-viewport camera composition |
| Old ENU entry helpers | `inspectionCartesianOffset`, `movingApproachOffset`, `radialAcquisitionPosition`, `movingApproachPathClear`, footprint-size wrappers and `rebaseApproachStartTime` had no final runtime consumers. Current `InspectionTransition`, Earth Reset, visual-frame and retargeting code remain |
| Old `silhouetteForMode`, node-index `semanticMapping`, duplicate duration/orientation constants | No runtime callers. Actual EarthView silhouette state, verified feature picking and existing transition constants remain |
| Separate Expedition HTTP helper/decoder/types/fixture helper | No UI consumer; Crew already supplies coherent Expedition context. The backend REST endpoint and historical response fixture remain unchanged |
| Orphan `lastOperationalConfirmation` | Lost its sole consumer with standalone presence presentation; remove it |

CPU fade (`forwardOpacity`), convex-footprint distance references, fixed-frame sample
reader and reference ENU frame moved to test support. They support actual
shader/clearance/source-isolation tests and are absent from runtime exports. The
private cross product still used by real projected-region code is retained.
Exclusive styles for removed dashboards, controls, standalone Crew and module/legend
presentations are removed. Shared Current/Historical/profile/module styles remain.
Obsolete App mocks now target the actual Current view.

### Configuration, assets and scripts

All 47 property keys have runtime/framework consumers. No deployment variable,
mode, schedule key or supported fallback was removed. Only misleading configuration
comments changed. No assets were removed: current assets and both logo locations
have product/documentary roles; fonts retain license attribution. Historical scripts,
validation dossiers, fixture captures and old ADRs remain intact. Dated scripts are
reproduced from their historical checkout, not treated as current production wiring.

## Final terminology

| Previous symbol | Domain name |
| --- | --- |
| `crew.automatic` | `crew.research` |
| `CrewAutomaticIdentityConfiguration` | `CrewIdentityResearchConfiguration` |
| `AutomaticIdentityWorker` / `AutomaticIdentityStore` | `IdentityResearchWorker` / `IdentityResearchStore` |
| `AutomaticScheduler` and its bean factories | `IdentityResearchScheduler`, `identityResearchWorker`, `identityResearchScheduler` |
| `ShadowIdentityGraph` | `IdentityResearchGraph` (still SHADOW) |
| `ShadowMembershipIdentity` | `ResearchMembershipIdentity` |
| Automatic identity/source/boundary tests | Identity research tests |
| `CrewEditorialShadowService` / test | `CrewResourceComparison` / test, test scope |
| `ProductionShadowComparison` | `IdentityResearchComparison`, test scope |
| `CrewEditorialHealthService` | `CrewResourceHealthDiagnostic`, test scope |
| `CrewMemberDetail.tsx` shared exports | `CrewProfile.tsx` |
| `CrewSummary.tsx` shared source exports | `CrewSourceEvidence.tsx` |
| Standalone Crew resource test | `CurrentCrewResource.test.tsx` |
| `v8` retained-input variable | `editorialCaptures` |
| `modern` / `modernHistorical` selectors | `scopedBinding`, `unifiedMembership`, `unifiedHistorical` |

Production names already describing their responsibility were retained. Current
logs describe research, resource acquisition, operational binding and membership
projection. `newElement`, `newSceneTime`, `old`/previous-record locals and animation
`phase` express real before/after states or progress, not development generations.

## Durable version names intentionally preserved

The external `remaining-version-classification.json` maps every meaningful match
to its file/line and compatibility category. No unnecessary generation name remains
in a production class, package, method or variable.

| Category | Preserved identities and reason |
| --- | --- |
| MIGRATION | Flyway V1–V13 filenames, contents, checksums and history are immutable |
| PERSISTENCE | Existing `crew_auto_*`, `crew_editorial_*`, `crew_active_*` and operational tables/columns; serialized cuts including `v7Targets`, `explicitV7Target`, `legacy:` source-key fallbacks and recorded reason/mode strings preserve stored lineage and hashes |
| JSON / DEPLOYMENT | `V9_AUTOMATIC_SHADOW`, `V9_IDENTITY_RESOLVER`, `HISTORICAL_V10_S10`, `UNIFIED_V10_S10`, historical metadata policy text and schedule names remain exact supported contracts |
| PROVENANCE | `crew-auto-identity-v1-shadow`, `research-logistic-v1`, `research-13-v1-scoped-extractor-1`, lexical/model-v1 resource paths/hashes, reviewed identity/profile/resolver/occurrence/releases, freshness-v1/v2, membership shadow/production-v1, all `s10-*` release/schema/parser/authority/normalization IDs, NASA/LL2 parser versions and orbital/replay policies remain exact |
| EXTERNAL API | Launch Library 2 `2.3.0` and NASA WordPress `/wp-json/wp/v2/` are upstream API versions |
| SUPPORTED ROLLBACK | `LEGACY_RETAINED_UNION`, `LEGACY_OPERATIONAL_BINDING`, Replay `LEGACY`, original freshness-policy readers and legacy accepted identity keys/audits remain intentionally selectable/readable |
| HISTORICAL DOCUMENTATION | Dossiers, old ADRs, validation scripts, model research and migration evidence keep historically accurate V7/V8/V9/S10/V10 terminology |

The [current architecture](../architecture/current-production.md) uses Canonical
Identity, Crew Resource Acquisition, Identity Research (SHADOW), Operational Subject
Binding, Crew Membership/Lifecycle, Current, Historical and Dynamic Mission/Resource
Discovery as its primary vocabulary. Its small glossary resolves old labels.

## Behavior and compatibility validation

All 197 remaining production Java files compare identically with the baseline after
normalizing only approved internal renames, comments and log labels; four diagnostics
and their unused factories are the explicit removal exceptions. All 19 backend
resources preserve exact content or, for application.properties, exact property values.
This protects source selection, operational gates, membership predicates,
departure/reentry, effective/knowledge time, GP eligibility and dynamic discovery.

An exact baseline jar was separately built from the starting Git revision. Current
on the same canonical database differs only in its two evaluation timestamps.
Historical at `2026-10-10T12:00:00Z` preserves all Crew facts, profiles and provenance;
only reconstruction/coverage wall clocks and orbital floating-point residuals (maximum Cartesian difference 4.28 micrometres,
with 73 compiled orbital/replay classes byte-identical to the exact baseline) differ. The pre-existing port 8080 daemon predates the starting revision,
so its Historical differences were investigated rather than attributed to cleanup.
The exact-revision comparison is the compatibility evidence.

Orbit acquisition/propagation/quality, source-provided OEM, immediate first GP,
exact `nextEligibleAt`, 2h10m normal refresh, Earth Reset, Inspection and Current↔Historical
semantics remain unchanged. General research stays SHADOW. Canonical creation/alias/
equivalence authority, operational thresholds/margins/witnesses/contradictions,
completed departure veto/reentry and installation-relative history remain unchanged.

## Database smoke

A new isolated PostgreSQL 16.10 project/database/volume had zero public tables before
JVM launch. The normal jar applied V1–V13, started HTTP and began GP eligibility
immediately after readiness. It stored one real CelesTrak GP and one retrieval;
normal delayed LL2 and NASA source runs each completed SUCCESS. No copied data,
fixture source, manual identity command, SQL repair or Historical backfill was used.
Source-directed resource discovery and Current bootstrap semantics retain their
existing limits; this small smoke does not claim a mature complete history.

The canonical database initially contained V12. Normal startup applied the existing
V13; subsequent startup validates all 13 and reports current. All baseline migration
SHA-256 values are byte-identical, and fresh/existing Flyway checksums agree. No new
or cosmetic migration or production data rewrite was introduced. Read QA used the
ordinary jar and supported scheduler-disable flags to avoid a second acquisition
writer alongside the existing application. Only owned isolated processes/resources
are cleaned up; original user processes remain.

## Tests and browser QA

| Check | Baseline | Cleanup |
| --- | --- | --- |
| Backend `mvn test` | 1,189, zero failures/errors/skips | 1,189, zero failures/errors/skips |
| Backend `mvn verify` | Existing accepted baseline 1,189; rerun test recorded above | 1,189, zero failures/errors/skips |
| Frontend `npm test` (Node 24) | 838 / 68 files | 829 / 68 files |
| Frontend typecheck/build | Supported compiler/build | PASS; existing large-chunk advisory remains |
| Diff whitespace check | Clean baseline | PASS |

No backend test was removed. Nine frontend tests exclusively covered deleted
implementations: old Replay mode/step control, old UTC-input validator, six ENU/
acquisition/footprint/rebase camera-helper cases, and old silhouette convenience.
Their Current/Historical, UTC calendar, real transition/retargeting and silhouette
pipeline successors remain covered. Hard negatives, bootstrap/future mission,
Alex-1/Aurora/Crew-42, clean-room, operational safety, temporal lifecycle and GP
scheduling suites remain. Useful standalone Crew tests were ported to real views,
not discarded. Four workspace tests now exercise the actual full-viewport contract.

Browser QA uses the final production build and real canonical REST on an isolated
loopback frontend/backend port: Earth, Zoom/Reset, GP/TLE↔OEM, Inspection entry/return,
Crew Current, astronaut detail, Data source, Historical, calendar, Current↔Historical
and desktop/mobile viewport checks. Screenshots, DOM/console evidence and runtime
reads remain outside Git. No UI redesign, fixture runtime or direct frontend provider
API was introduced.

## Documentation and external instructions

Root/backend/frontend READMEs, current Crew introductions, dynamic discovery and
architecture entrypoints use domain terminology. Historical dossiers and ADRs remain
historically accurate. `/Users/daniel/Desktop/mission1-project.md` is updated outside
Git with the final commit and validation. External AGENTS/skill references contain
no invalid renamed paths/symbols; no external update is required and none is committed.

One ordinary commit is pushed through the established SSH remote without force.
Final local/origin/direct-GitHub main equality and clean-tree proof are external.
