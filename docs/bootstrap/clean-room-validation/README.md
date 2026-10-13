# Final bootstrap fixes — 2026-10-13

[Final fixes and new empty-store proof](final-fixes.md) address prompt initial GP,
exact retry eligibility and source-directed future Crew resource discovery. They
use the normal source paths and retain V7/V9/S10/V10 authority and source budgets.
[ADR-0022](../../adr/0022-durable-gp-eligibility-and-source-directed-resource-discovery.md)
adds only the necessary durable GP request-state table; Crew uses its existing queue.

**Historical coverage begins with observations acquired by that MISSION1
installation. Pre-installation historical backfill is not a production requirement.**
No archive intake, copied observations or manufactured prior state is introduced.
The earlier LEVEL 3 records below are preserved as dated evidence, including their
observed defects and explicit skipped repeat. Their old pre-installation coverage
criterion does not define acceptance for this final milestone.

---

# Clean-room bootstrap validation — 2026-10-13

**LEVEL 3 — CURRENT ZERO-TOUCH. Full clean-room acceptance is not proven.** Canonical checkout is
`/Users/daniel/Desktop/MISSION1`, direct `main`, starting from
`dfb4f88391d99661c3b1f410c1415d0820932cb2` with a clean working tree. Runtime
evidence stays outside Git at
`/Users/daniel/.codex/exports/mission1-clean-room-bootstrap/`.

## State stores and protection

The production application uses PostgreSQL 16.10, JDBC and Flyway. MongoDB,
Redis, H2, SQLite, Elasticsearch, persistent brokers and an application-owned
object store are not used. The unrelated `ium-tweb` Mongo volumes are not MISSION1
dependencies. Compose, dependencies, all production configuration/resources,
filesystem/storage API searches and actual sockets support this inventory.

[Complete state-store inventory](state-stores.md) lists runtime purpose,
configuration, storage location, bootstrap and the isolation action for each
persistent or transient system, including diagnostic/tooling and browser state.

Java source-health/overlap guards, parsed OEM/replay caches and the private Orekit
context are in-process state. Packaged resources are static inputs. No production
filesystem source-response writer was found. Operational stdout/Docker logs are
diagnostic filesystem state, not bootstrap inputs. Browser HTTP cache belongs to
fresh ephemeral Chromium contexts; MISSION1 does not use localStorage,
sessionStorage, IndexedDB, service workers or CacheStorage for application state.
Build/dependency compilation caches contain code, not application observations.

Canonical PostgreSQL is `mission1-postgres-1`, project `mission1`, database
`mission1`, loopback port 5432, volume `mission1_mission1-postgres`, network
`mission1_default`. Backend 8080/PID 85818 and frontends 4175/PID 47588 and
5175/PID 58978 are protected. The external manifest retains complete container,
volume, network and connection metadata without passwords. The initial read-only
fingerprint covers all 80 public tables, row-hash sets/counts, twelve Flyway rows
and selected Current/detail/state/Historical/coverage GETs. No table contents or
database backup are exported for import.

The first test uses project `mission1-cleanroom-20261012234000-f20cee`, its own
container/network/named volume, a unique database and credentials, PostgreSQL
55432, backend 18080 and frontend 14175. The backend's established database sockets
target 55432. Guards check the resolved endpoint, container identity, volume and
project ownership, network membership and application ports; seven constructed
canonical collisions are refused. Loopback host sharing is intentional; port,
database and Docker resources differ.

## Fresh schema and packaged inputs

Before the JVM started, the new PostgreSQL database contained zero public tables,
zero Flyway history and no MISSION1 rows. T0 is
`2026-10-12T23:40:03.411097Z` (01:40:03 on 13 October in Europe/Rome). Normal packaged
startup applies V1–V12 in order. Flyway reports 0.366 s migration execution; all
twelve checksums match the canonical repository migration history. HTTP startup
finishes approximately 3.33 s after T0.

Every nonzero table immediately after normal startup is explained:

| Table/category | Rows | Classification and origin |
|---|---:|---|
| `flyway_schema_history` |12|Migration execution metadata |
| V8 NASA budget and editorial lease |1 each|Static operational singleton initialization |
| V9 sweep lease |1|Static operational singleton initialization |
| V10 projection work |1|Static operational singleton initialization |
| S10 binding work |1|Static operational singleton initialization |
| `crew_identity_binding_version` |4|PACKAGED REVIEWED DATA: two declarations, two typed provider keys each; initially PENDING |
| `crew_identity_decision_evidence` |26|PACKAGED REVIEWED DATA: prior human-approved capture/proof metadata attached to the four pending declarations |

Humans, source observations, profiles, aliases, equivalences, actual orbital
elements, OEM documents, editorial captures and operational evidence start empty.
The production jar contains only normal migrations/configuration, packaged
UTC/EOP data, the frozen model/lexical policy and
`reviewed-identities-v1.json`. No test/research fixture or external validation
archive is present in its production classpath.

The reviewed manifest explicitly represents prior human approval for Luke Delaney
and Jessica Watkins NASA↔LL2 correspondences. It preserves old capture hashes,
URLs and summaries; it does not create those old operational documents/events.
Missing provider identities remain PENDING and do not create people. This is
zero-touch execution of an installation with packaged reviewed reference data;
the entire identity layer is not zero-human.

Five default S10 locators (GCTC directory, CSA Joshua Kutryk, ESA Sophie Adenot,
NASA Crew-12 and Crew-13 missions) are STATIC REFERENCE DATA selected during prior
source review. They are finite resource-discovery inputs, not accepted-human
crosswalks. Future mission-era locator coverage must not be assumed.

## Normal startup observations

No ingestion/scoring/materialization stages or repair endpoint are manually
invoked to produce the test state. LL2 succeeds with HTTP 200 at approximately
T0+5m08s, creating seven source-derived person anchors/profiles. NASA RSS succeeds
at approximately +10m10s. V10 publishes seven Current members automatically at
approximately +15m03s; first observed HTTP 200 is +15m12.427s within
the 30s observation cadence. V8 acquires the independently discovered NASA
Expedition 75 roster and personal resources: 18 captures and 20 HTTP exchanges
including redirects, all final HTTP200. Attributed source conflicts/coverage
limitations retain DEGRADED health.

The LL2 planning catalog also succeeds normally. V9 remains SHADOW. S10 installs
the separate production release and initially defers while the provider cache is
incomplete. First consumable binding arrives at **T0+3h56m34.941s**; five MATCH
heads for four distinct existing humans then remain stable, with five DEFER and
zero CONFLICT. No completeness, threshold, contradiction, witness or margin gate
is relaxed. Its own LL2 cap remains three/hour, the acquisition tick five minutes,
and failed/budget-denied retries bounded. Current does not infer physical presence
from assignment, a website count, omitted names or an unqualified score.

[Detailed pristine results](first-run.md) provide the full timeline, matched-cut
Current/Historical comparison, source/subsystem counts, Orbit, restart,
performance, growth and observed failures. Seven Current members/assignments and
two fresh physical-presence confirmations match the mature contemporaneous cut;
these are different cardinalities. First-run history reconstructs three people
on October 5 and four at the departure cut; it cannot reproduce the mature 11→7
transition. The supported Current provider roster is stable over nine hours.

## Demonstrated gaps and known-cut differences

| Difference | Classification | Evidence |
|---|---|---|
| Missing entry/overlap evidence from October 1/2 | SOURCE DISCOVERY BUG / selected feed-window limitation | The production feed has ten items from October 5–9. The [NASA entry article](https://www.nasa.gov/blogs/spacestation/2026/10/01/crew-13-members-enter-station-join-expedition-75/) remains publicly readable. Runtime has no paginated/archive intake. |
| Four outgoing LL2/V7 candidates absent | BOOTSTRAP IMPLEMENTATION GAP / source discovery gap | Active-only structured intake creates seven providers. S10 discovers provider URLs from already retained successful LL2 observations and cannot create people. A read-only diagnostic obtains [LL2 astronaut573](https://ll.thespacedevs.com/2.3.0/astronauts/573/) with HTTP200; its data is not imported. |
| Past structured/editorial captures absent | EXPECTED KNOWLEDGE-CUT DIFFERENCE | Today's capture cannot be backdated using expedition start or CMS publication time. A retained older installation has observations the fresh installation never made. |
| Pending reviewed V7 declarations | PACKAGED-SEED DEPENDENCY plus absent source identities | Four reviewed provider-key declarations exist, but missing NASA provider identities prevent equivalence activation; V8 resource identity is not a universal human identifier. |
| Future installation outside current windows | SOURCE RETENTION WINDOW LIMITATION | NASA parsing is limited to ten feed items within 14 days; LL2 is active-only. Current OEM/GP acquisition is not an archival backfill. No claim that every absent upstream resource has been deleted is made. |

Read-only Historical queries include the known entry, overlap, exact departure and
later cuts. They preserve explicit UNAVAILABLE/PARTIAL results instead of copying
the mature eleven→seven timeline or manufacturing pre-installation assignments.
All remaining comparisons must retain capture/effective/binding knowledge times.

## GET, browser and failed attempts

Instrumented processes before and after S10 qualification, with all workers and
startup writers disabled, each measure 142 Current/detail/Historical/seek/coverage
GETs plus 30 warmups: 284 measured reads and 60 warmups in total. All 80 table fingerprints remain identical. Prepared statements
are SELECT-only on read-only connections; external backend HTTP, V9/S10 scoring,
S10 acquisition and V10 materialization counters are zero. This is the
Current/Historical invariant; the existing optional `/orbit/comparison` OEM
acquisition behavior is a separate preserved contract.

Fresh browser contexts prove empty local/session storage, IndexedDB, CacheStorage
and service-worker registrations. Actual API requests use the isolated frontend
proxy and return the fresh UUIDs. Current roster/detail and Data source interaction
pass desktop/mobile geometry checks without horizontal overflow or page errors.
Before orbital data exists, the model/Inspection/source controls remain
unavailable. The existing Historical calendar uses orbital coverage; it cannot
seek Crew-only partial intervals while orbital coverage is absent.

Failed attempts are retained externally: one audit-helper property typo, one
screenshot ENOSPC failure (recovered by removing only unused generated code
copies), one mature-date calendar selector assumption, and an interrupted Maven
verify stopped before it could repackage the running test jar. Separate final
builds preserve the running archive.

An initial frontend dependency symlink allowed Vite to write compilation caches
under the canonical `node_modules`. This was an isolation error, not a database
input. The frontend was restarted with a brand-new external `cacheDir` and
`--configLoader runner`. No application API response/cache was imported, but exact
pre-test compilation-cache equality cannot be asserted because it was not
fingerprinted. This exception must remain visible in canonical integrity results.

The first CSA acquisition fails certificate-path validation on Corretto 21.0.3;
seven ordinary attempts remain failed through the first run. Diagnostic probes
write no database data. Maintained Corretto 21.0.12 with TLS 1.2 succeeds with the
vendor trust store and hostname validation. The secondary run uses that explicit
compatibility profile; the primary runtime is unchanged. No trust-all manager,
hostname bypass, identity-threshold reduction or manual mapping is used.

## Tests, architecture and reproduction

Actual baseline: backend 1,163 tests; frontend 838 tests in 68 files. Java 21 `mvn test`
and `mvn verify` pass with zero failures/errors/skips. Frontend Node24 tests,
typecheck and build pass. Maintained Java 21.0.12 `mvn verify` also passes all
1,163 tests. The existing chunk-size warning is preserved. No
production architecture, model, migration, REST contract, identity/lifecycle
authority, orbital propagation, camera, branding or UI code is changed.

[Guarded runner and reproduction instructions](scripts/README.md) describe code-only
builds, isolated startup, metadata monitoring and explicit owned-resource cleanup.
Runtime acquisition evidence, complete row counts, before/after fingerprints,
source request accounting, convergence/restart/repeat/failure outcomes and final
Git equality belong to the external dossier. Owned-port, canonical-collision and
optimized-Python refusal checks are exercised; no canonical resources are removed.

## Repeated run and failure experiment

After verified first-run deletion, the second unique project is
`mission1-cleanroom-20261013084910-38cb57`, database
`mission1_cleanroom_af84f0c250`, its own container/network/volume, PostgreSQL 55433,
backend 18081 and frontend 14176. T0 is `2026-10-13T08:49:12.820905Z`. Code/resource
artifact SHA-256 is identical in both runs. Before the second JVM, public tables
and Flyway history are again absent. Normal startup again creates exactly the
explained 47 rows. A fresh browser context again proves empty application stores.

The explicit secondary profile uses maintained Java 21, normal validated TLS 1.2
and LL2/NASA fixed delays of one hour (the supported minimum). Initial delays,
request budgets, source URLs, authority modes and identity gates stay unchanged.
A loopback CONNECT-only proxy rejects LL2/NASA for the first twelve minutes and
CSA for 35 minutes. The first CelesTrak transport attempt is also rejected by a
finite 150-minute fault window; normal 2h10m eligibility controls its later retry.
It never decrypts TLS or supplies a provider response body.
Its 502 CONNECT rejection is a transport fault, not an upstream NASA/LL2 status.

LL2 fails normally at 08:54:16 UTC and NASA RSS at 08:59:16 UTC with NETWORK_ERROR,
no successful capture, no document, no people and Current HTTP 503. At 09:02:11 UTC
the owned JVM restarts during partial bootstrap. All table hashes/Flyway rows and
the two source-failure records remain exact; reviewed rows/proofs do not duplicate.
The normal cooldown prevents immediate retry. V8 and the LL2 catalog independently
recover through real TLS acquisition after the outage; without V7 humans the
early projection remains UNAVAILABLE and Current stays 503.

LL2 recovers automatically with HTTP 200 at 09:54:37 UTC; NASA RSS at 09:59:38 UTC.
Current automatically publishes seven existing source-created humans at 09:55:17
UTC. No source callback or internal stage is manually invoked. Desktop/mobile
Current/detail/Data source checks against the second frontend pass, with its own
actual UUIDs and no canonical API requests. Later S10 qualification remains
separately measured; mere Current HTTP readiness is not full subsystem acceptance.

CSA recovers automatically with HTTP 200 and typed source facts at 11:47:47 UTC.
NASA's Jessica Meir and Jack Hathaway pages are also acquired normally, but the
outgoing V7/LL2 targets remain absent. Resource availability alone cannot create
those missing identity anchors under the existing authority boundary.

The first GP transport fault is recorded at 11:12:13 UTC. At 13:22:13.559 UTC the
normal scheduler checks approximately 377 ms before eligibility
(`13:22:13.936466Z`) and skips the entire 2h10m tick. This is an observed bootstrap
scheduling-latency defect; it sends no HTTP request. The same near-boundary
behavior was seen during the first run. No policy interval, clock or source
callback is changed to force recovery. At 14:03 UTC the user requested skipping
this long wait. The 15:32 retry and second GP/OEM Earth/Inspection/source-switch
repeat were therefore not observed; no repeated Orbital pass is claimed. The
first run already verifies the real GP/OEM paths and those browser interactions.

Second S10 qualification commits at 13:27:59.441085 UTC, T0+4h38m46.620s:
six MATCH for five people, four DEFER, zero CONFLICT. The extra binding is Joshua's
now qualified CSA witness; the frozen model/policy is identical. Current's typed
LL2 provider roster matches the pristine and mature contemporary results, with
seven ACTIVE, two fresh presence confirmations, seven assignments and truthful
DEGRADED health. Historical resolves four at October 5 and five at/after departure,
versus mature eleven/seven. Missing entry evidence and outgoing V7 targets remain
open, with no fabricated departure or pre-installation capture.

[Second-run results](second-run.md) record the same empty startup, partial restart,
recovered sources, qualification, matched cuts, performance and deliberate skip.
Desktop/mobile Current/detail/Data source/Historical-now checks are repeated after
qualification with fresh contexts, actual second-run IDs, zero page errors and
no canonical API contacts. Post-qualification GET tracing also passes. Final
persistence is 4,835 rows over 80 tables and 14,114,816 relation bytes, with 160 S10
revisions, 460 candidate children and 158 proof children. Normal repeated S10
evaluations produce zero new revisions after the unchanged qualified cut.

Both isolated environments are explicitly removed after their final evidence.
The second normal JVM/frontend/monitor stop before the pure GET audit; the audit
context closes itself, then only the verified second container/network/volume and
owned fault proxy are removed. No second-run recovery is implied after removal.

## Canonical integrity and architecture boundary

The final read-only fingerprint has the same 80 tables and identical Flyway
history. Every original immutable row hash survives. Canonical rows grow normally
from 16,836 to 23,061 through the still-running source/V9/V10 workers. Lost original
whole-row hashes are confined to seven mutable registers: active-projection work,
automatic input heads/jobs, daily V9 sweep lease, editorial lease, NASA request
budget and operational binding work. The daily lease advances its next-at field
through `AutomaticIdentityStore.safetySweep`; it was explicitly classified after
checking code and actual final metadata. No immutable-history loss is hidden.

Container ID, volume name/creation time, network ID and original backend/frontend
PIDs remain exact. Canonical Current/state/Historical serve normally, and both
frontends return HTTP 200. No clean-room migration or test row is written to
canonical persistence. Corrected-phase Vite/tooling cache hashes and mtimes remain
identical; the initial pre-fingerprint cache exception remains separate.

The initial Vite compilation-cache exception is distinct from these database
results. Canonical persistence integrity does not establish exact pre-test
filesystem-cache equality. The corrected frontend configuration isolates both
Vite cache directories and browser application state.

No production source, migration, authority/lifecycle policy, REST contract,
propagator, camera, branding or frontend implementation changes. No new
production architecture decision is adopted; ADR-0021 remains applicable. This
milestone adds validation documentation and an opt-in guarded harness. The
demonstrated discovery gaps remain open rather than being repaired with data
imports, manual mappings, lowered gates or an untested archive-intake redesign.

## Acceptance and remaining work

The highest proven level is **LEVEL 3 — CURRENT ZERO-TOUCH**. Both empty stores
independently construct source-supported Current, V7/V8, V9 SHADOW, incoming S10
bindings and V10 under unchanged authority/gates. The pristine run additionally
proves GP/OEM and the full Earth/Inspection/Reset/source-switch/seek flows.

LEVEL 4 is not met: still-public entry/overlap evidence is outside normal discovery
and active-only LL2 intake cannot create outgoing V7 targets. Old structured and
editorial capture knowledge is separately an expected installation-age difference;
no upstream deletion is proven to explain away the avoidable discovery gaps.
LEVEL 5 is also not proven: those gaps remain, the original JDK's CSA TLS path fails,
GP tick/eligibility timing adds a whole interval, the repeated Orbital recovery was
skipped at the user's request, and pre-test canonical tooling-cache equality is
unavailable after the initial isolation error.

No production fix is implemented. The milestone records demonstrated root causes
and a guarded validation workflow; it does not claim that bootstrap is fully
solved. Future fixes must retain source lineage/rates, existing publishable targets,
identity gates and fail-closed behavior, then be proven from another new empty store.

## Evidence index

Detailed private evidence under the external directory includes:

| Artifact | Purpose |
|---|---|
| `canonical-protection.json`, `canonical-before-fingerprint.json` | Resource identity and original all-table hashes |
| `run1-empty-proof.json`, `run2-empty-proof.json` | Zero tables/Flyway/application data before JVM |
| `packaged-bootstrap-audit.json`, `packaged-resources.json` | Production-only resources, checksums and reviewed seeds |
| `bootstrap-timeline.csv`, `run1-timeline.json` | Actual primary capture/availability milestones |
| `run1-source-acquisition.csv`, `run1-accounting.json` | Attempts, redirects, budgets, final size/cardinality |
| `run1-current-comparison.json`, `run1-historical-comparison.json` | Typed provider parity and explicit knowledge cuts |
| `run1-get-audit.json`, `get-side-effect-audit.json` | Instrumented read-only invariant |
| `run1-restart-validation.json`, `run2-partial-restart-validation.json` | Idempotency and retained failure state |
| `run1-cleanup.json`, `run2-cleanup.json`, `run2-initial-topology.json` | Explicit first deletion and new second resources |
| Browser JSON/PNG files | Cold, Current, Orbit, Inspection, Reset, calendar/seek, network and geometry |
| `tests-summary.json`, Maven/Node logs | Actual suite/compiler/build outcomes |
| `growth-comparison.csv` | Same structure; 6,120 fresh rows versus 16,836 initial mature rows |
| `source-window-audit.json`, TLS/proxy logs | Public history gaps and retained failed attempts |
| `user-skipped-second-orbit-recovery.json`, `run2-celestrak-eligibility-skip.json` | Explicit user-directed skip and measured tick defect |
| `canonical-final-fingerprint.json`, `canonical-final-integrity.json` | Final immutable data/resource preservation and cache exception |

Evidence is an output, never an application bootstrap input. Disposable
credentials and full logs/source-response data are not committed. The final Git
SHA/equality record is outside Git to avoid a self-referential report hash.
