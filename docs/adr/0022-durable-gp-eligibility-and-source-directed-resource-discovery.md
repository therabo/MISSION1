# ADR-0022: Durable GP eligibility and source-directed resource discovery

Status: Accepted — 2026-10-13

## Context

The empty-store validation found a 2h10m delay before the first GP acquisition
and a scheduler check 377ms before retry eligibility that lost another full
interval. Failed requests and provider suspension were process-local, so simply
removing the startup delay would allow restarts to bypass provider pacing.
The five S10 resource seeds included a finite pair of Crew mission identifiers.
Future official-resource coverage must follow newly acquired source observations.

## Decision

After application readiness, run one normal GP eligibility check immediately.
Maintain one cancellable timer at the service's actual next eligibility instant.
Reserve the cooldown durably before HTTP; retain non-200 suspension across
restarts. V13 adds one singleton request-state table. Existing successful
observations still impose their full retrieval-based interval. Local database
failures before HTTP retry locally after one minute. No orbital data is seeded.

Extend the existing S10 worker's acquisition discovery with fresh retained LL2
assignment/profile/expedition context, provider person-specific flight mission
identifiers, compatible operational subjects, and source-advertised official
personal links. Derive bounded NASA Crew/Expedition URL candidates from source
mission/expedition identifiers. Such candidates are hypotheses to acquire and
validate, never facts or human crosswalks. The existing V8 Expedition discovery,
S10 resource queue, host budgets, checked transport, retained capture graph,
qualification policy and V7 targets remain the boundaries.

Keep all five static locators as optional compatibility/reference seeds. Neither
future Crew numbering nor names generate permanent identity mappings. No runtime
LLM, search service, archive intake or generic crawling is introduced. Historical
coverage is relative to observations acquired by the installation; reconstructing
pre-installation history is not a production requirement.

## Alternatives considered

- Keeping fixed GP delays preserves the measured timing defect. Frequent polling
  adds unnecessary checks; one deadline timer expresses the existing policy.
- Memory-only request tracking cannot preserve failed-attempt cooldown on restart.
  Reusing Crew request tables would misrepresent source and domain lineage. The
  narrowly scoped additive GP table is necessary for durable reservation.
- Adding another static Crew locator for each mission requires redeployment.
  General crawling would expand acquisition without a source-directed bound.

## Consequences

- An empty installation can acquire its first real GP in normal startup time;
  existing observations and failed requests suppress duplicate startup fetches.
  A crash after reservation conservatively consumes the cooldown.
- Non-200 suspension now survives restart and requires explicit operator review.
  Restart alone cannot bypass a provider block. Clear only the suspension flag
  after resolving its cause, retaining the deadline.
- Discovery expands available evidence without changing V7, V9 SHADOW, S10
  thresholds/margins/contradiction/completeness/witness gates or V10 lifecycle.
  Unsupported/missing future resources remain failed or deferred.
- Discovery has explicit per-cut and per-resource bounds; exceeding them fails
  closed. Very large future cohorts will require a separately reviewed paging
  change. URL conventions may change; generated candidates cannot guarantee
  upstream publication or availability.
- One Java backend and PostgreSQL remain sufficient. REST, frontend, propagation,
  GP/OEM classifications and V1–V12 migration bytes remain unchanged.

See [GP policy](../telemetry/celestrak-refresh-policy.md),
[dynamic discovery](../crew/dynamic-resource-discovery.md), and
[final bootstrap validation](../bootstrap/clean-room-validation/final-fixes.md).
