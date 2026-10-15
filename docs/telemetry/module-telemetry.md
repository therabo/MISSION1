# Component telemetry

ADR-0024, extended by [ADR-0025](../adr/0025-periodic-retained-telemetry-reconciliation.md), adds public record history to the existing ModuleInfo/ContextDock surface.
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
verified mapping. Their existing identity/function remains visible; configuration
assessments remain in source metadata. Mesh
indices and raw identifier prefixes never create a telemetry association.

Semantic IDs, raw IDs, labels, units, exact item-specific enums, association notes
and evidence come from the qualified machine-readable catalog. Original categories
remain in definition metadata; `displayCategory` adds the final report's Tranquility
water-recovery/oxygen-generation grouping without changing physical interpretation.
No item-specific decoder or conversion lives in the UI. Qualified definitions use
their reviewed unit/state. Raw-only channel numbers have physical unit unset; CNT
is metadata, never a suffix. Unknown codes retain their number and show `Unknown
code N`. Blank/non-finite/malformed/oversized input never defaults to zero.

`source-scope.json` contains reviewed station-system/control IDs only, tied to the
same research digest. It classifies input outside the component registry without
activating extra definitions. Every SenseData record contributes exactly one of:
QUALIFIED_COMPONENT_MATCH, QUALIFIED_STATION_SYSTEM_MATCH, BLOCKED_DEFINITION,
EXCLUDED_CONTROL, PROVIDER_LOCAL_STATUS or UNKNOWN_RAW_ID. Malformed records and
component matches without a verified provider binding are counted separately.

Blocked pressures, calibration conflicts, OGA rates, clock/quaternion/vector semantics,
UDM associations and community robotics stay inactive. Definitions contain no values.
Production never reads test fixtures, research observations or provider seed files.
The retained-lineage guard contains only a digest/count/original time boundary; it
rejects the known 42-item SenseData component cohort when uniformly rebased, and
cannot create observations or authenticate arbitrary deployment mode.

## Sources, bootstrap and periodic reconciliation

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

SenseData streams the first complete `records` event at `https://iss.telemetry.space/events`.
The [pinned server](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/create-server.ts)
sends an initial backfill array, then live events. Its
[buffer](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/buffer.ts)
holds 150 records per channel; backfill selects its last 450 seconds or one latest
record when that window is empty. It can therefore exceed one record per item.
SSE framing is consumed incrementally, including multiline data/CRLF; Jackson reads
one bounded record at a time. Neither a complete data line nor the event JSON tree
is buffered. Only component candidate tuples remain until the event terminator is
verified; truncated/oversized events persist no partial observations. Structurally
malformed item fields are isolated. The connection closes after the first event.

Defaults: 4 MiB framed bootstrap bytes and 20,700 records (138 pinned provider
channels ×150), with configurable hard ceilings of 8 MiB/50,550 records. The current
measured event is about 401 KiB; the default accommodates full channel rings without
an unlimited stream. Transport read-ahead is 4 KiB, headers at most 256 bytes,
preamble 16 KiB within the total byte budget, depth eight, names 64 characters,
numeric tokens 128 and decoded string tokens 1,024. Relevant field values are at most
128 characters and each record has at most 16 fields. Excess framing/token/count
bounds fail the event; bad relevant item fields within token bounds are counted and
excluded individually. The HTTP connection/header deadline is 15 seconds; the
separate streamed-bootstrap deadline is 30 seconds and closes stalled input.
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

After readiness, the native worker initializes definitions and starts the independent
retained lifecycle and native SDK. Neither external retained request runs on the SDK
callback or native persistence worker. Two owned timer threads maintain one deadline
per provider; repeated start is idempotent and close cancels deadlines/active HTTP,
interrupts and joins owned workers. A failed provider does not postpone the other
provider, native ingestion, Crew, Orbit or readiness.

Initial acquisition remains bootstrap for a provider/catalog without a completed
pass. Both providers are subsequently revisited automatically. **Default PT30M**
after a completed successful acquisition, including empty, duplicate-only, older-only
or rejected-only responses. This is fallback/recovery, not a live-stream approximation.
`bootstrap-enabled=false` disables initial bootstrap but does not disable configured
periodic reconciliation; `retained-reconciliation.enabled=false` leaves only initial
bootstrap. Disable both to prevent retained acquisition.

`telemetry_provider_state` stores last attempt/success, next eligible deadline,
consecutive failures, outcome/kind and last pass counts/timings. Runtime initialization
seeds pacing from existing bootstrap history; migrations insert no rows. A successful
query five minutes ago remains about 25 minutes from eligibility after restart;
overdue work runs shortly after readiness. Fresh bootstrap advances that same deadline,
so it cannot race an immediate duplicate reconciliation. The completed bootstrap flag
records initial completion, never permanent exhaustion.

Every pass uses the same provider-wide PostgreSQL session advisory claim, including
bootstrap. Ownership spans bounded I/O; no database transaction or telemetry writer
lock spans I/O. At most two dedicated pool connections are held for retained claims.
Slow requests cannot lose ownership through lease expiry. Process/connection death
releases ownership, while a committed pessimistic failed-attempt deadline prevents
restart hammering. A live owner prevents duplicate fetch even after its deadline.
Normal operation completes a pass and schedules its exact durable deadline. Local
coordination/ownership errors recheck after one minute without a source request.

Failures back off at interval ×2^consecutiveFailures, capped at PT6H by default:
60,120,240,360 minutes, then360. Successful processing resets failures to zero and
returns to PT30M. The old `retry-failed-bootstrap` startup override is retired;
ordinary durable scheduling provides recovery without state edits or forced retries.
No jitter is added for the single-instance deployment. At PT30M, normal traffic is
approximately **48 bounded SenseData connections/day and 48 ISS.live passes/day**;
21 current qualified keys fit one ISS.live request/pass. No formal rate policy or
SLA is asserted; bounds/timeouts and failure backoff limit unsuccessful traffic.
No manual reconcile endpoint, browser source connection or GET-triggered fetch exists.

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
Separate acquisitions retain repeated retrievals and status amendments. The first
actual acquisition method is read through its immutable acquisition FK; new periodic
passes use RETAINED_RECONCILIATION, while original RETAINED_BOOTSTRAP,
RETAINED_ARCHIVE_IMPORT and NATIVE_CALLBACK provenance is preserved. Upstream is
public ISS telemetry/NASA origin as attributed by provider documentation; transport
is Lightstreamer ISSLIVE; retainer is SenseData, ISS.live or none; acquisition method
is separate. No onboard sampling time or independent calibration certificate is claimed.

SenseData's future-date ambiguity remains unresolved. No year subtraction, new year
inference or weakening of receivedAt+120s is introduced. Fully parseable future
component representations are retained in immutable `telemetry_time_rejection`,
including original value/date, first acquisition/receipt, time policy and record
identity. This is rejection evidence, not a telemetry observation or head. The same
identity remains excluded even after wall-clock catch-up or restart; formatting-only
value changes cannot bypass it. A genuinely different qualified record follows the
unchanged normalizer/admission policy. No old rejected payload is reinterpreted. The record codec rejects calendar dates
beyond year9999 as unrepresentable input, including for rejection storage; those
malformed dates cannot turn a completed source pass into a PostgreSQL date-range error.

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
head. V1/V2 bytes and checksums remain unchanged. Structure-only V3 adds
telemetry_provider_state and telemetry_time_rejection, with an immutable rejection
trigger. Bounded native and retained writes share the existing transaction writer
lock; retained batches do not monopolize the native queue.

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
  Its `retained` object exposes enabled/running and provider states with temporal
  eligibility, last attempt/success, next eligible time, failures, outcome/kind,
  scheduled/completed times and fetched/mapped/admitted/duplicate/rejected/head
  counts, bytes and timings. State is persisted and cached on acquisition lifecycle
  transitions; GET performs no write/network. Eligibility still requires the claim.
  `fetchMilliseconds` for SenseData includes streaming parse/read; its parse timer
  includes streamed reads and is not additive. Database time includes admission.
  Its nullable process-local `senseData` summary reconciles fetched/classified,
  malformed/unbound, normalized/rejected, inserted/admitted/conflicting/duplicate
  counts and event-byte/parse/database timings. It is absent after a restart that
  correctly skips an already completed pass; it is not persistent value provenance.

Component/history GETs are read-only REPEATABLE READ, local SQL only and no-store.
Unknown IDs are 404, invalid bounds 400, known unmapped components truthful empty
NO_VERIFIED_MAPPING responses. Current/as-of use one SQL statement per component.
History uses one bounded statement plus cursor validation when present. Nanosecond
upper query bounds truncate downward to PostgreSQL microseconds to exclude future rows.

## UI, configuration and verification

App supplies selected component and accepted presentation time. ModuleInfo preserves
identity, Function, focus/close, scrolling and Inspection navigation. The card omits
Configuration context, the Evidence & provenance model link/reference footer and
the Identity mapping row. Supporting technical detail retains module/asset identifiers
and grouped evidence for displayed readings. Limitations / availability and the
bottom numbered module name, identity verification date and display scale note are omitted. Normal
categories show only recorded engineering/state readings with individual UTC dates;
source and retainer information stays in the existing **Telemetry evidence & provenance**
disclosure, without repeated captions under each reading. Raw channels and
definitions without observations are omitted, including their disclosures and empty
categories; their catalog/API support is unchanged. Components without a verified
mapping still show **No verified telemetry mapping**. Engineering display uses six
significant digits; full source precision survives in detail/API, and nonzero tiny
values do not become zero.

Only the selected active dock loads. AbortController, generation and response
component/mode/UTC validation reject late Current/old-module/old-time responses.
Current refreshes serially every 60 seconds while visible. Historical does not poll;
hidden/closed docks do not poll. API failure stays local to telemetry.

`mission1.telemetry.*` has matching MISSION1_TELEMETRY_* environment variables:
enabled, native-enabled, bootstrap-enabled, native-endpoint, adapter-set, native-retry,
sensedata-endpoint, isslive-endpoint, timeout, queue-size, batch-size,
sensedata-bootstrap-timeout, sensedata-max-event-bytes, sensedata-max-records,
retained-reconciliation.enabled, retained-reconciliation.interval and
retained-reconciliation.maximum-backoff. Nested variables use the full uppercase
name, e.g. MISSION1_TELEMETRY_RETAINED_RECONCILIATION_INTERVAL. Interval accepts
PT1M..P1D; maximum backoff must be >=interval and <=P7D. Defaults:
enabled, researched HTTPS endpoints, ISSLIVE, SDK retry 30 seconds, external deadline
15 seconds, queue 1024/batch 64. Queue max 8192, batch max 256; field/body/item/deadline
bounds apply. Endpoints are administrator configuration, never user request URLs.
HTTPS verification and no HTTP redirects apply. No new service/broker/database technology.

Run Java21/Docker `mvn test` and `mvn verify`, and Node24 `npm test`,
`npm run typecheck`, `npm run build`. Tests use TEST-only fixtures, SDK mocks and
Testcontainers PostgreSQL, never live feeds. The frozen publication test targets V1;
forward-migration tests cover V2/V3 and preserve both accepted checksums. [Validation](module-telemetry-validation.md) records
counts, real bounded acquisition, restart/GET purity, timings and responsive evidence.
The independent TEST definition reference verifies all 131 qualified mappings and
provider bindings against the research; the all-definition PostgreSQL and frontend
tests verify component selection, complete decoding, recorded engineering/state
rendering and omission of raw/missing rows from the module card.
The [retained coverage audit](retained-coverage-audit.md) explains each module's actual
source availability, policy exclusions and SQL→REST→UI reconciliation.

Native silence does not authorize invented data. A subscription acknowledgement
does not establish a payload/cadence. Providers expose incomplete time lineage;
the replay guard catches only known uniform rebasing or explicit replay declarations.
Other undeclared replay cannot be independently authenticated. Public access/code
licenses do not establish service redistribution terms, retention promises or SLA.
Sustained high-rate storage/retention behavior remains unmeasured; no automatic
deletion, downsampling, TimescaleDB or distributed infrastructure is introduced.
