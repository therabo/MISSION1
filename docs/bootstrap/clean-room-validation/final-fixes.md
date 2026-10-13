# Final bootstrap fixes and validation — 2026-10-13

Scope: prompt first GP, exact GP retry eligibility, and automatic future official
Crew resource discovery. Starting direct `main`:
`5945ad446e0e4047a1c60a2e640a357842d161e9`. Final commit/push/equality is recorded
outside Git to avoid a self-referential commit identifier.

## Changes and authority

The GP scheduler checks promptly after readiness and owns one timer at the actual
service deadline. A near-boundary skip re-arms that deadline. V13 adds one necessary
durable request-state singleton: the cooldown is atomically reserved before HTTP;
non-200 suspension survives restart. Existing successful observations also impose
the full retrieval interval. No GP data is seeded, and no source/propagation/REST
classification changes. [GP policy](../../telemetry/celestrak-refresh-policy.md).

S10's existing worker derives bounded official resource candidates from fresh
retained LL2 assignment/profile/Expedition context, detailed person/flight mission
identifiers, compatible operational subjects, fresh V8 source relations and
source-advertised official personal links. Five static locators remain reference/
compatibility seeds; future numbered Crew missions do not need a code entry.
The existing durable queue, acquisition budgets and qualified capture graph are
reused. No runtime LLM, generic crawling, identity-by-name or archive intake is
introduced. [Dynamic discovery and five-seed audit](../../crew/dynamic-resource-discovery.md).

V7 canonical authority, V9 SHADOW, S10 release/model/thresholds, runner-up margin,
contradiction/witness/completeness gates and V10 Current/Historical lifecycle are
unchanged. REST, Crew UI, branding, camera/Earth Reset, GP/OEM classification,
orbital propagation and V1–V12 migration bytes remain unchanged. The freeze audit
compares 405 protected tracked main/frontend/infrastructure files with the baseline.
[ADR-0022](../../adr/0022-durable-gp-eligibility-and-source-directed-resource-discovery.md)
records the durable request boundary and source-directed discovery decision.

## One new empty installation

Exactly one new deployed clean-room PostgreSQL 16.10 instance was provisioned:
project `mission1-cleanroom-20261013144935-cfdc3c`, database
`mission1_cleanroom_d53cbfede9`, PostgreSQL loopback 55432, API 18080, one owned
container/network/new named volume. The guarded runner independently protects the
canonical database and ports. Before the JVM, there were zero public tables and
no Flyway history. No copied rows, mature volume, fixture database, source-response
cache, manual source invocation or SQL data repair was used.

| Milestone | UTC | Relative to JVM launch |
| --- | --- | --- |
| JVM launch | 2026-10-13T14:49:37.997895Z | T0 |
| HTTP/application startup | 2026-10-13T14:49:42.505Z | +4.507s |
| Real first GP receipt | 2026-10-13T14:49:44.381105Z | **+6.383210s** |
| LL2 successful structured acquisition | 2026-10-13T14:54:43.444949Z | +5m05.447s |
| NASA RSS successful acquisition | 2026-10-13T14:59:44.047569Z | +10m06.050s |
| First Current projection evaluated | 2026-10-13T15:04:42.474522Z | +15m04.477s |
| First monitor Current HTTP 200 | 2026-10-13T15:05:04.869015Z | +15m26.871s |

Normal Flyway applies V1–V13 (0.715s execution). Production packaging contains no
test/research fixtures. The first GP uses the unchanged CelesTrak query
`CATNR=25544&FORMAT=TLE`, one real HTTPS response, TLE validation and immutable
source observation. Its SHA-256 is
`d111b087866f84b94334c56e42829630a4280e7ec167f4f2721065092bddaa3c`.
Orbit REST is HTTP 200, `COMPUTED_FROM_ORBITAL_ELEMENTS`, quality GOOD; the
source remains `SOURCE_PROVIDED_ORBITAL_ELEMENTS`, never live onboard telemetry.
Current automatically publishes seven members with truthful DEGRADED health.
Its unresolved source slots are retained; this narrow milestone does not claim
that every S10 person is already qualified after 15 minutes.

The same isolated store was restarted with the final `mvn verify` package at
15:09:35.547899Z. No store was recreated, copied or repaired. Initial and final
packaging differ in exactly one production class: the final retained V8 relation
discovery query was added after initial live startup. All GP classes, other source
classes, configuration/resources and migration bytes are identical between those
packages. This distinction is retained in `final-artifact-delta.json`.

Final-package startup validates all thirteen migrations without reapplying them.
GP is skipped, with next eligibility **2026-10-13T16:59:44.381105Z**, exactly first
receipt +2h10m. There is still one set, one observation and two primary Crew source
runs; no restart fetch is duplicated. Current and Orbit remain HTTP 200 with
seven members/GOOD orbital quality. The normal future refresh deadline is proven;
an additional real-provider request after a two-hour wall-clock wait is not claimed.

The canonical container/network/volume and backend remain protected. Original
immutable rows and Flyway history are preserved; only its two ordinary background
work registers changed during validation. After final evidence, only the owned
clean-room JVM, monitor, container, network and volume are removed by identity guard.

## Controlled failure and future-mission proof

The deterministic production-service/timer tests reproduce T minus 377ms: zero
provider requests before T, re-arm T, exactly one normal attempt at T, no T+2h10m
penalty. Fractional early timers, repeated/stale callbacks, readiness repetition,
shutdown, persistence read failure and suspension are covered.

The PostgreSQL/real-adapter test uses an actual refused loopback transport. It
reserves the full 130-minute deadline, reconstructs the service/store as after
restart, skips 377ms before eligibility, then acquires a validated TEST_ONLY TLE
through the real adapter/parser/repository at exactly T. Repeat calls do not fetch
again; receipt/source URI/hash lineage is retained. Independent concurrent-owner,
nanosecond precision and restart-after-403 tests pass. This is controlled virtual
UTC recovery, not an accelerated request to CelesTrak or a live provider outage claim.

`OperationalDynamicDiscoveryPostgresTest` uses zero static seeds and explicitly
SYNTHETIC future Crew-42. Normal LL2 adapter/ingestion discovers the assignment,
queues official candidates, uses real durable budgets and the existing transport
with controlled HTTP bodies, follows the advertised typed NASA mission, retains
qualified resources and reaches production S10 MATCH. Initial incomplete/unqualified
cuts DEFER. Later Crew-73/Expedition-95/new-astronaut and same-person mission changes
queue new work. A changed official V8 relation queues its new link immediately;
rejected relations do not. Repeats retain work/deadlines and make no unnecessary
requests. Unsafe/offsite links, 256-candidate/64-link overflow and unqualified
witness controls fail closed. Existing V8/S10 negative and score regressions pass.

## Required checks

| Check | Baseline | Final |
| --- | --- | --- |
| Java 21 `mvn test` | 1,163 / 0 failures/errors/skips | **1,186 / 0 failures/errors/skips** |
| Java 21 `mvn verify` | Prior accepted baseline 1,163 | **1,186 / 0 failures/errors/skips** |
| Node 24 `npm test` | 838 in 68 files | **838 in 68 files** |
| `npm run typecheck` | Prior baseline PASS | PASS |
| `npm run build` | Prior baseline PASS | PASS; existing chunk-size warning |
| `git diff --check` | Clean starting checkout | PASS |

The 23 added backend tests exercise bootstrap/restart, precise timers, durable
reservations/transport recovery, unknown future source intake, official relation
updates, bounded/idempotent work and unchanged evidence qualification. Existing
migration-count assertions advance to V13 without weakening history preservation.

## Historical and evidence

**Historical coverage begins with observations acquired by that MISSION1
installation. Pre-installation historical backfill is not a production requirement.**
Existing source-event, capture/knowledge-time and Replay semantics remain unchanged;
later captures may contain dated facts, but no prior capture time is manufactured.
No new archive intake, backfill job or publication-authority mapping is introduced.

Repository documentation includes the GP policy, dynamic discovery/seed audit,
ADR-0022, bootstrap README/state inventory, Crew/S10 docs and backend README.
`/Users/daniel/Desktop/mission1-project.md` is updated outside Git.

Private evidence remains at
`/Users/daniel/.codex/exports/mission1-final-bootstrap/`: empty proof, topology/
ownership guards, initial GP and Current proofs, timestamps and source accounting,
final-package/restart fingerprints, canonical integrity/freeze audit, controlled
GP/future-mission test logs, all build/test logs, cleanup and final Git equality.
Evidence and disposable credentials are never application inputs or Git assets.
