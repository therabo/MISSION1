# ADR-0024: Component telemetry and qualified record history

Status: Accepted; bootstrap-only acquisition superseded by [ADR-0025](0025-periodic-retained-telemetry-reconciliation.md)
Date: 2026-10-14

## Context

The existing 14 selectable components need their verified public telemetry in the
existing ModuleInfo dock. The final qualification supports 96 engineering/state
and 35 raw-only definitions across nine components. Old real records are useful;
the product caption is **Last telemetry record**, without freshness badges.
Provider record dates are not established NASA onboard sampling instants.

## Decision

Add one in-process telemetry capability with a backend-owned versioned definition
registry, separate native Lightstreamer, SenseData and ISS.live adapters, a bounded
worker and ordinary PostgreSQL/JDBC persistence. Preserve the vendor SDK security
dependency versions. Public V1 remains unchanged; schema-only V2 adds telemetry.

Persist immutable provider records and acquisition/admission evidence separately.
Select actual admitted dated records by their qualified chronology, never receipt
time. Keep raw-only units unset and all research exclusions inactive. Native
yearless timestamps use a conservative versioned inferred-year policy; snapshots
without an independent date remain undated evidence. Provider chronology may be
compared only within its own basis or a catalog-corroborated cross-provider cohort.
Conflicts preserve the previously accepted representation rather than averaging.

Bootstrap asynchronously after readiness, once per provider/catalog missing-state
generation, with durable attempt pacing and bounded source requests. SenseData is
preferred; ISS.live supplies explicit complementary mappings. Native callbacks
copy immutable bounded fields to a bounded queue and never write JDBC on the SDK
thread. No periodic retained-provider polling is introduced.

Corrective clarification (2026-10-14): SenseData's initial SSE event can contain
multiple retained records per channel. Consume it incrementally with explicit
byte/record/token/deadline bounds, verify completion before persistence, and classify
every input ID. An operator-requested failed-pass retry uses the same atomic claim
and requires actual failed acquisition evidence; completed passes remain idempotent.
This refines the bounded bootstrap decision without changing the schema or admission.

Read-only module/latest/as-of and bounded history APIs query local persistence.
Historical selects recordTime <= accepted T using present evidence, preserving
actual acquisition time. No installation floor, interpolation, synthetic samples,
Current fallback or changes to Crew/Orbit are introduced. The frontend loads only
the selected module, follows accepted presentation time, cancels obsolete reads
and refreshes visible Current telemetry modestly.

## Alternatives considered

Item-specific tank DTOs omit the qualified component catalog. Frontend source
connections scatter provenance and cause repeated provider usage. Manual native
protocol implementation duplicates the official SDK. A new service, broker or
time-series extension adds operational cost without a present throughput need.

## Consequences

Real retained data remains useful when native acquisition is silent. Definition
support does not promise observation availability. Bounded queues are not durable
and do not promise lossless capture; drops and errors must be counted. Conservative
native date admission leaves ambiguous snapshots unavailable as dated readings.
Retainers publish incomplete time lineage and no verified service SLA. Tests must
enforce immutable records, exclusion gates, ordering, source isolation and GET
purity; source qualification and runtime limitations are documented separately.

Research input: final qualification export `mission1-isslive-final-qualification-2026-10-14`,
including its Proposed-ADR. See [implementation](../telemetry/module-telemetry.md).
