# Component telemetry milestone validation

Date: 2026-10-14. Starting accepted revision:
`0a50f35eedde0a6e95771718aa597c7c4606a833`, clean main. The rejected Historical
installation floor is absent. V1 SHA-256 remains
`007b9e7e759f33d1bab7997434b1464d91a2fdeb18cc7667003b2f7875678e9e`
and Flyway checksum remains -1371784637.

## Context and implementation

Reviewed project AGENTS, external mission1-project.md (its rejected-floor header
treated as stale), current production architecture, public database baseline,
ADR-0001/0002/0003/0011/0021/0022/0023, API/replay/source/frontend contracts and current
source/configuration/JDBC/controller/ModuleInfo/ContextDock/presentation patterns.
Applied architecture, architecture-decisions, source-verification, telemetry-domain,
quality/provenance, pipeline, time-series, API, replay, local-platform and frontend
skills. User product semantics override optional freshness-badge guidance.

The final qualification export was located at
`/Users/daniel/.codex/exports/mission1-isslive-final-qualification-2026-10-14`.
Its complete machine-readable catalogs, enums, component/model/geometry inventories,
cross-source bindings/comparisons, blocked/control/unbound records, evidence, final
report and Proposed-ADR supplied the reviewed registry. Counts match 337 candidates,
246 supported globally, and 131 supported component definitions (96 engineering/state,
35 raw-only), plus nine blocked component definitions. Operational values come only
from actual source acquisition. Controlled test fixtures contain component records
and specific negative controls, not full research captures.

See [architecture, policies, coverage and API](module-telemetry.md),
[REST contract](../api/component-telemetry.md) and [ADR-0024](../adr/0024-component-telemetry-record-history.md).

## Deterministic regression

Java21 (maintained Corretto 21.0.12.1), PostgreSQL16.10/Testcontainers and Node24:

- Final backend suite: 1,359 tests, zero failures/errors/skips; full `mvn verify`
  includes compilation, tests and production packaging. `mvn test` also passed the
  preceding 1,358-test end-to-end stage; the additional test preserves distinct
  native fractional timestamp evidence within the same displayed second.
- Telemetry tests cover all 131 definitions, item-specific/unknown enums, missing and
  malformed input, native MERGE/snapshot/amendment fields, inferred-year/leap/calendar
  limits, huge-exponent bounds, retained original dates, STATUS/vm exclusion, explicit
  archive keys, retimed known-cohort rejection, duplicate/corroboration/conflict/
  incomparable/untimed/resend admission, PostgreSQL immutability, head/as-of/history,
  cursor bounds, queue overflow, failure isolation and pure REST reads.
- V1→V2 migration starts with zero telemetry definition/acquisition/record rows;
  runtime initializes definitions separately. The frozen V1 publication test still
  validates its original 80-table/constraint/index/trigger contract independently.
  Four ordinary integration assertions now expect the valid forward migration chain;
  Crew/Orbit behavior assertions are retained.
- Frontend: 852 tests in 71 files, zero failures. API decoding, engineering/state/raw
  views, source/date rendering, no mapping/no record, stale/aborted responses, module/
  Current/Historical identity, visible refresh and local API failures are covered.
  Typecheck and production build pass. Existing large Cesium chunk warning remains.
- Maven dependency tree/analysis reviewed; Jackson 2.22.1, Kotlin 2.2.21 and OkHttp
  5.3.2 are resolved coherently. Vendor security version is preserved. Surefire's
  process-exit allowance is 90 seconds for closing cached PostgreSQL Spring contexts;
  individual test timeouts/assertions are unchanged.

## Real source and empty-store validation

A separately owned temporary database had zero public tables before application
startup. Public V1 and telemetry V2 applied normally; no dumps, observation fixtures,
provider seed file, Flyway inserts or research values populated it. The core reached
HTTP readiness before asynchronous telemetry bootstrap.

Bounded source acquisition produced 42 SenseData records and 21 ISS.live records:
63 immutable provider representations and 47 distinct supported component heads
(20 engineering/state and 27 raw-only). Current recorded coverage: Destiny 9,
Harmony 5, Quest 20, Tranquility 12 and Zvezda 1. Other supported definitions honestly
have no recorded value. SenseData dates span September 5–14; ISS.live September 8–14.
Actual MISSION1 acquisition occurred October 14. All 63 representations are accepted;
no observed conflicts, parse failures, queue drops or persistence/bootstrap errors.

The native official SDK connected as CONNECTED:WS-STREAMING and the single complete
catalog subscription was SUBSCRIBED. Zero value callbacks arrived during the bounded
inspection. This proves transport/subscription acceptance, not live payload availability
or sensor cadence. Retained readings remained available with their original dates.

After restart from a fixed packaged artifact, sorted record/acquisition fingerprints
were identical, counts remained 42+21 and no retained acquisition repeated. A QA run
that reused a jar while Maven repackaged it was discarded and repeated from a fixed
copy; it does not contribute acceptance evidence.

140 Current/Historical/module GETs preserved both record and acquisition fingerprints;
each response form had one stable content hash. September 15 reconstruction includes
eligible September records acquired October 14; September 1 has zero recorded values.
Acquisition fields remain October 14. No GET triggered provider bootstrap or writes.

The final packaged artifact also upgraded the existing canonical local database
from V1 to V2 without resets. Crew member representations remained identical and
Crew/Orbit returned HTTP 200; the existing frontend on port 5175 was preserved.
This later source session differed from the isolated validation: SenseData's initial
event exceeded the 256 KiB bound (HTTP 200; captured prefix included future-dated
records), so bootstrap correctly failed without admitting it. ISS.live supplied 21
dated representations (19 engineering/state, two raw-only), with published dates from
September 8 to October 14 and unspecified generator/measurement role. The native SDK
delivered 131 initial snapshots; all remain UNTIMED evidence, with no dated head
manufactured from receipt. Native queue/drop/parse/persistence/conflict counters were
zero. Canonical Tranquility at September 15 returned six eligible records; September
1 returned none. A failed SenseData pass remains eligible only under the documented
later-startup 24-hour backoff. Earlier successful 42+21 bootstrap evidence is not
copied into this database or claimed as its current coverage.

## Responsive and temporal UI

Real retained REST data populated the existing dock at 1440×900, 1024×768, 768×1024,
390×844 and 320×568. All five checks found no page/dock/content horizontal overflow;
scrolling reached ordinary and raw readings. At 320×568 the existing 144px-wide dock
requires scrolling and wraps dates; text was not compressed. Telemetry rows have
sticky-header scroll margins for keyboard/programmatic reachability.

All 14 component identities were exercised. The five unmapped components show the
minimal absence statement; mapped components without actual records show no recorded
value. No freshness/age badge was introduced. Actual October 14 Historical changes
issued telemetry requests at the accepted UTC, kept original September dates, and
produced no browser/page/API errors. September reconstruction without orbital coverage
is validated through the telemetry API; existing Inspection eligibility remains intact.

Selection instrumentation existed only in the external QA Vite configuration, used
the existing manifest/selection callback, and supplied no telemetry values. Native
Inspection entry, dock close/Earth return and one Viewer were verified. Renderer,
camera, App presentation latch and model manifest production files are unchanged.

## Performance

Local HTTP timings, 30 measured requests after five warmups per form, 63 source rows:

| Read | Median | p95 | Recorded parameters |
| --- | ---: | ---: | ---: |
| Tranquility Current | 4.56 ms | 5.47 ms | 12 |
| Tranquility at September 15 | 4.20 ms | 4.67 ms | 12 |
| Quest Current | 4.54 ms | 5.34 ms | 20 |
| Before first record | 3.28 ms | 4.03 ms | 0 |

Quest uses one component SQL statement for 57 definitions; EXPLAIN ANALYZE took
1.129 ms at this small cardinality. PostgreSQL preferred small scans; chronology and
component indexes are present for growth. These are local measurements, not an SLA.

A separate disposable Testcontainers benchmark used **TEST_ONLY synthetic input**,
never the real-data UI/store. It inserted 13,100 immutable records across all 131
definitions in batches of 64. Median batch write 39.52 ms, p95 69.05 ms; 57-parameter
Quest SQL median 6.68 ms, p95 8.18 ms. This exercises moderate history/batched writes,
not a verified native rate or sustained capture guarantee. Definitions/peer/head
selection uses set queries; callback threads perform no SQL.

## Evidence and limits

Full logs, source/runtime fingerprints, dependency resolution, benchmark, query plan,
browser scripts/screenshots and responsive/temporal results remain outside Git at
`/Users/daniel/.codex/exports/mission1-module-telemetry` (build/test logs also have the
`mission1-module-telemetry-*` prefix directly under exports). Temporary validation
services/database are removed after acceptance; normal canonical runtime remains.

Blocked engineering interpretations, unknown native-year snapshots, uncorroborated
cross-provider chronology, provider restore/time lineage, limited replay attestation,
undocumented service terms/SLA and sustained high-rate storage remain explicit limits.
No unsupported channel, engineering conversion, onboard date or orbital authority is
claimed. External mission1-project.md and final Git revision/push evidence are updated
after successful completion; that context remains outside Git.
