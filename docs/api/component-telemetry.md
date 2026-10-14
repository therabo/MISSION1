# Component telemetry API

[Complete contract and semantics](../telemetry/module-telemetry.md#postgresql-and-apis).

GET `/api/iss/components/{componentId}/telemetry` returns componentId, CURRENT or
HISTORICAL mode, nullable requestedAt, EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION,
mappingStatus and parameter definitions. Optional `at` is an accepted UTC ISO instant
ending in Z. Every parameter carries semantic parameterId, label, category, valueType,
qualified unit or null, rawOnly, evidence/limitations and nullable record.

An actual record has numericValue, nullable item-specific enumCode/enumLabel,
recordTime and source detail: upstream attribution, transport, retainer, acquisition
method, raw/provider ID, time role/precision/policy, inferred-year flag, provider
rounding/unit, actual receivedAt and catalog version. `recordTime` is a qualified
public record date, not an established NASA sampling instant. Definitions create
no observations; missing records remain null. No freshness/age field is required.

GET `/api/iss/telemetry/parameters/{parameterId}/history` requires from/to UTC bounds
(inclusive; maximum 31 days), limit 1..500/default 100 and optional opaque nextCursor
from the previous page for the same parameter/range. Response contains parameterId,
from/to, records and nullable nextCursor. Order is recordTime then immutable identity.
Unknown IDs are 404, invalid bounds/cursor are 400. GET never acquires or writes.

GET `/api/iss/telemetry/diagnostics` is operational state, separate from value trust.
Component/history reads use local PostgreSQL and read-only REPEATABLE READ/no-store.
Known unmapped components return NO_VERIFIED_MAPPING with no parameters. Historical
includes later-acquired old records at or before T, preserves receipt, selects no
future record and uses neither interpolation nor Current fallback/installation floor.
