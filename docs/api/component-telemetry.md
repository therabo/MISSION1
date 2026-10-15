# Component telemetry API

[Complete contract and semantics](../telemetry/module-telemetry.md#postgresql-and-apis).

GET `/api/iss/components/{componentId}/telemetry` returns componentId, CURRENT or
HISTORICAL mode, nullable requestedAt, EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION,
mappingStatus and parameter definitions. Optional `at` is an accepted UTC ISO instant
ending in Z. Every parameter carries semantic parameterId, label, category, valueType,
qualified unit or null, rawOnly, evidence/limitations and nullable record.

An actual record has numericValue, nullable item-specific enumCode/enumLabel,
recordTime and source detail: upstream attribution, transport, retainer, acquisition
method (the actual first acquisition: RETAINED_BOOTSTRAP, RETAINED_ARCHIVE_IMPORT,
RETAINED_RECONCILIATION or NATIVE_CALLBACK), raw/provider ID, time role/precision/policy, inferred-year flag, provider
rounding/unit, actual receivedAt and catalog version. `recordTime` is a qualified
public record date, not an established NASA sampling instant. Definitions create
no observations; missing records remain null. No freshness/age field is required.

GET `/api/iss/telemetry/parameters/{parameterId}/history` requires from/to UTC bounds
(inclusive; maximum 31 days), limit 1..500/default 100 and optional opaque nextCursor
from the previous page for the same parameter/range. Response contains parameterId,
from/to, records and nullable nextCursor. Order is recordTime then immutable identity.
Unknown IDs are 404, invalid bounds/cursor are 400. GET never acquires or writes.

GET `/api/iss/telemetry/diagnostics` is operational state, separate from value trust.
Its nullable `senseData` object reports the most recent completed bootstrap in this
process: input classifications, parser/binding exclusions, normalization and write
counts, duplicate/conflict counts, bytes and timings. It creates no observations and
does not replace persisted provenance. A restart that skips a completed bootstrap
leaves this process-local object null.
Component/history reads use local PostgreSQL and read-only REPEATABLE READ/no-store.
Known unmapped components return NO_VERIFIED_MAPPING with no parameters. Historical
includes later-acquired old records at or before T, preserves receipt, selects no
future record and uses neither interpolation nor Current fallback/installation floor.

`retained` adds enabled/running and a provider-keyed map. Each entry exposes
`eligible` (deadline only; ownership still required) and `state`: lastAttemptAt,
lastSuccessAt, nextEligibleAt, consecutiveFailures, lastOutcome, lastKind,
scheduledAt, completedAt, bootstrapCompleted and result. Result contains fetched,
mapped, admitted, duplicates, rejected, headsAdvanced, responseBytes,
fetchMilliseconds, parseMilliseconds and databaseMilliseconds. Times are UTC.
Counts describe the last pass; headsAdvanced counts distinct parameters advanced
within that pass, not a claim that every admitted historical record became a head.
Future SenseData rejections are successful source processing, not transport failures.
State survives restart and is cached after provider lifecycle transitions; the
initial map may be empty before asynchronous initialization. Source errors remain
independent of spacecraft value quality. No new acquisition/control endpoint exists.
See [reconciliation policy](../telemetry/module-telemetry.md#sources-bootstrap-and-periodic-reconciliation).
