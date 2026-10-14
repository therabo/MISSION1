# Component telemetry

ADR-0024 adds public record history to the existing ModuleInfo/ContextDock surface.
One Java21/Spring backend and ordinary PostgreSQL remain the deployment. Orbit,
NASA OEM, Crew, Historical, model mapping and camera pipelines are independent.
Telemetry channels never supply orbital or visual-attitude authority.

## Catalog and qualification

`backend/src/main/resources/telemetry/module-catalog.json` is the reviewed runtime
definition registry. It is derived from the complete final qualification export
`mission1-isslive-final-qualification-2026-10-14`, whose conclusion is READY WITH
EXPLICIT LIMITATIONS: 337 candidates, 246 supported definitions globally (191
engineering/state and 55 raw-only). Runtime includes only selectable component
associations: 131 definitions, 96 engineering/state and 35 raw-only. All 89 global
blocked IDs are explicit exclusions; nine have component associations. The additional
115 station-system definitions are outside this release.

| Component | Engineering/state | Raw-only | Blocked |
| --- | ---: | ---: | ---: |
| DESTINY | 20 | 5 | 4 |
| HARMONY | 3 | 4 | 0 |
| POISK | 1 | 0 | 0 |
| ZVEZDA | 21 | 0 | 0 |
| RASSVET | 1 | 0 | 0 |
| ZARYA | 1 | 0 | 0 |
| QUEST | 35 | 22 | 1 |
| TRANQUILITY | 12 | 4 | 4 |
| UNITY | 2 | 0 | 0 |

Columbus, Pirs, Kibo Exposed Facility, Kibo Pressurized Module and Cupola have no
verified mapping. Their existing identity/function/configuration remains. Mesh
indices and raw identifier prefixes never create a telemetry association.

Semantic IDs, raw IDs, labels, units, exact item-specific enums, association notes
and evidence come from the qualified machine-readable catalog. Original categories
remain in definition metadata; `displayCategory` adds the final report's Tranquility
water-recovery/oxygen-generation grouping without changing physical interpretation.
No item-specific decoder or conversion lives in the UI. Qualified definitions use
their reviewed unit/state. Raw-only channel numbers have physical unit unset; CNT
is metadata, never a suffix. Unknown codes retain their number and show `Unknown
code N`. Blank/non-finite/malformed/oversized input never defaults to zero.

Blocked pressures, calibration conflicts, OGA rates, clock/quaternion/vector semantics,
UDM associations and community robotics stay inactive. Definitions contain no values.
Production never reads test fixtures, research observations or provider seed files.
The retained-lineage guard contains only a digest/count/original time boundary; it
rejects the known 42-item SenseData component cohort when uniformly rebased, and
cannot create observations or authenticate arbitrary deployment mode.

## Sources and bootstrap

The maintained [official Lightstreamer Java SDK](https://github.com/Lightstreamer/Lightstreamer-lib-client-haxe)
5.3.3 owns native protocol, reconnection and MERGE state. One client subscribes all
131 raw IDs with TimeStamp, Value, Status.Class, Status.Indicator, Status.Color and
CalibratedData at `https://push.lightstreamer.com`, adapter set ISSLIVE. Callbacks copy
bounded immutable fields and snapshot/change information into a bounded queue;
the worker normalizes and writes JDBC batches. Queue overflow drops the new event
and counts it. Persistence failures are counted/logged. Capture is not lossless.

The [vendor changelog](https://github.com/Lightstreamer/Lightstreamer-lib-client-haxe/blob/main/CHANGELOG-JavaSE.md)
identifies its security dependency update. Maven preserves Jackson BOM 2.22.1,
Kotlin 2.2.21 and OkHttp 5.3.2 instead of Boot's older managed baseline. Full tests
exercise this classpath. TLS verification stays enabled.

SenseData captures one bounded initial `https://iss.telemetry.space/events` batch.
Only exact admitted registry IDs with researched decimal precision are imported.
Original k/v/t/s provide channel/value/reconstructed record date/status. STATUS is
provider software state; TIME controls are excluded; vm is a mean, never the last
observation. Provider rounding is retained. The public payload omits CalibratedData,
original yearless time and restore/session provenance. Its
[reviewed conversion](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/feed-time-to-unix.ts)
uses a clock year, adjacent-year adjustment beyond 183 days and integer Unix seconds.
Import does not repeat that inference or change an old Unix date.

ISS.live fetches only explicitly qualified keys, up to 32 per batch/four requests,
with window=now-90d at `https://api.iss.live/api/telemetry/stats/`. Only each sensor's
latest.t/v is used. Window clocks, global ts, averages, rendered pages and graph times
are excluded. Provider unit declarations stay separate from qualified units. Its
[schema](https://api.iss.live/api/schema/) does not establish whether latest.t is
measurement, collector or database time. Two unresolved electrical keys are excluded.

After readiness, a separate daemon initializes definitions, attempts SenseData then
ISS.live, then starts native acquisition. Core never waits for bootstrap network I/O.
Failures do not disable Crew, Orbit, ISS rendering or readiness. Durable bootstrap
state is per provider/catalog: successful bounded passes do not repeat on restart,
even when some definitions have no upstream record. Failed/interrupted attempts can
retry on a later startup after 24 hours. No continuous retained polling or UI-driven
source fetch exists. A new catalog version has its own pass. Manually deleting
evidence is not a supported recovery workflow.

## Time, provenance and admission

The ordinary caption is **Last telemetry record**. Its date belongs to the selected
actual provider/native record. Receipt, restart, retrieval, reconnect, keepalive,
acknowledgement, STATUS and rendering never advance it. No visible freshness/age
badge or unqualified live claim is added.

| Path | Qualified time role | Limits |
| --- | --- | --- |
| SenseData | PROVIDER_RECONSTRUCTED_ISSLIVE_RECORD_TIME | Upstream inferred year; second precision; restore lineage unspecified |
| ISS.live | PROVIDER_RECORD_TIME_ROLE_UNSPECIFIED | Published fraction retained to microseconds; generator/measurement role unknown |
| Native | MISSION1_RECONSTRUCTED_ISSLIVE_RECORD_TIME | Versioned inferred-year policy; genuine non-snapshot time/value change |

`native-nearest-year-v1` interprets the researched day-of-year ×24 + decimal-hour
convention. It chooses the nearest valid current/adjacent UTC year, verifies leap/day
bounds and admits only non-snapshot dates within the preceding seven days or at most
120 seconds ahead. These are MISSION1 policy bounds, not NASA-certified semantics.
Older, missing or ambiguous dates and snapshots stay untimed immutable evidence.
Original timestamp, status, CalibratedData, snapshot/change mask and receipt survive.
Status-only callbacks cannot establish a newer dated reading.

Records preserve provider/raw identity, original time, role/precision/policy,
year inference, rounding/unit, catalog version and first actual acquisition/receipt.
Separate acquisitions retain repeated retrievals and status amendments. Upstream is
public ISS telemetry/NASA origin as attributed by provider documentation; transport
is Lightstreamer ISSLIVE; retainer is SenseData, ISS.live or none; acquisition method
is separate. No onboard sampling time or independent calibration certificate is claimed.

Identity hashes catalog/codec policy, provider, raw ID, qualified time and canonical
numeric value. Native identity also retains the original fractional timestamp,
including for untimed input, so same-second callbacks are not irreversibly merged.
Reimport adds acquisition evidence,
not a new physical record. Equal values at newer qualified dates are new observations.
Formatting changes alone do not create a record.

Bounded writes serialize through a telemetry transaction advisory lock and compare
accepted heads/equal-second peers using set queries:

- Same-provider chronology is comparable; native and SenseData share the documented
  reconstruction convention. ISS.live crosses providers only for catalog-corroborated
  time/value cohorts.
- Comparable newer dates are eligible. Older rows remain history and cannot win by
  receipt time or transport rank.
- Equal-second enum codes must agree. Scalars may differ by the sum of documented
  half-decimal rounding intervals; unrounded input has no guessed physical tolerance.
  Corroborated ties prefer native, ISS.live, SenseData, then published fraction and
  lexical immutable identity.
- Conflicting/incomparable candidates remain CONFLICT/INCOMPARABLE evidence and do
  not replace accepted readings. They are not averaged. First admitted evidence is
  the anchor for a conflict; later independently qualified dates may still advance.
- Untimed callbacks are UNTIMED. Class-9 resends cannot establish a new dated reading;
  identical already accepted records retain their original date.

Coarse-second ordering does not claim subsecond NASA chronology or merge distinct
provider evidence irreversibly.

## PostgreSQL and APIs

Schema-only V2 adds telemetry_catalog, telemetry_parameter, telemetry_acquisition,
telemetry_record, telemetry_record_evidence, telemetry_admission and
telemetry_bootstrap_state. Values, times, providers and admission are typed; JSONB
is bounded definition metadata only. Foreign keys, uniqueness, raw-unit/null checks,
numeric bounds, time-second consistency and six immutable-table triggers protect
evidence. Ten indexes include keys, raw-ID uniqueness, component lookup and parameter
chronology. Selection references the actual record, with no duplicated mutable value
head. V1 and checksum remain unchanged.

- `GET /api/iss/components/{componentId}/telemetry` returns definitions and nullable
  latest admitted dated records, queried at the response clock.
- `?at=<UTC ISO instant ending Z>` selects recordTime <= T using
  EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION. Later acquisition remains truthful.
  There is no installation floor, interpolation, fabricated sample or Current fallback.
- `GET /api/iss/telemetry/parameters/{parameterId}/history?from=...&to=...&limit=...&cursor=...`
  uses inclusive bounds, maximum 31 days, limit 1..500/default 100, chronological
  order/immutable-ID ties and a validated parameter/range-scoped cursor.
- `GET /api/iss/telemetry/diagnostics` returns connection/subscription and callback,
  rejection/conflict/queue/drop/persistence/bootstrap counters.

Component/history GETs are read-only REPEATABLE READ, local SQL only and no-store.
Unknown IDs are 404, invalid bounds 400, known unmapped components truthful empty
NO_VERIFIED_MAPPING responses. Current/as-of use one SQL statement per component.
History uses one bounded statement plus cursor validation when present. Nanosecond
upper query bounds truncate downward to PostgreSQL microseconds to exclude future rows.

## UI, configuration and verification

App supplies selected component and accepted presentation time. ModuleInfo preserves
identity, configuration, footer, focus/close, scrolling and Inspection navigation;
only its telemetry placeholder changes. Normal categories show engineering/state
readings with individual UTC dates/source. Missing records remain absence detail.
Raw channels and grouped provenance use existing Supporting technical detail.
Engineering display uses six significant digits; full source precision survives in
detail/API, and nonzero tiny values do not become zero. Raw numbers get no invented unit.

Only the selected active dock loads. AbortController, generation and response
component/mode/UTC validation reject late Current/old-module/old-time responses.
Current refreshes serially every 60 seconds while visible. Historical does not poll;
hidden/closed docks do not poll. API failure stays local to telemetry.

`mission1.telemetry.*` has matching MISSION1_TELEMETRY_* environment variables:
enabled, native-enabled, bootstrap-enabled, native-endpoint, adapter-set, native-retry,
sensedata-endpoint, isslive-endpoint, timeout, queue-size and batch-size. Defaults:
enabled, researched HTTPS endpoints, ISSLIVE, SDK retry 30 seconds, external deadline
15 seconds, queue 1024/batch 64. Queue max 8192, batch max 256; field/body/item/deadline
bounds apply. Endpoints are administrator configuration, never user request URLs.
HTTPS verification and no HTTP redirects apply. No new service/broker/database technology.

Run Java21/Docker `mvn test` and `mvn verify`, and Node24 `npm test`,
`npm run typecheck`, `npm run build`. Tests use TEST-only fixtures, SDK mocks and
Testcontainers PostgreSQL, never live feeds. The frozen publication test targets V1;
forward-migration tests cover V2. [Validation](module-telemetry-validation.md) records
counts, real bounded acquisition, restart/GET purity, timings and responsive evidence.

Native silence does not authorize invented data. A subscription acknowledgement
does not establish a payload/cadence. Providers expose incomplete time lineage;
the replay guard catches only known uniform rebasing or explicit replay declarations.
Other undeclared replay cannot be independently authenticated. Public access/code
licenses do not establish service redistribution terms, retention promises or SLA.
Sustained high-rate storage/retention behavior remains unmeasured; no automatic
deletion, downsampling, TimescaleDB or distributed infrastructure is introduced.
