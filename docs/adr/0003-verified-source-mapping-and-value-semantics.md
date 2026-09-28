# ADR-0003: Verified source mappings and explicit value semantics

Status: Accepted  
Date: 2026-09-28

## Context

The intended product uses public ISS data, but the project specification's sample fields and channel IDs are uncited examples. A direct provider-ID-to-API design would spread opaque and potentially changing source details across history and clients. A plausible received number does not establish onboard measurement, recency, or valid orbital/attitude meaning. V1 needs a cross-cutting rule before implementation begins.

## Decision

Put each provider transport and identifier behind a source adapter. A version-controlled registry maps only evidence-backed `(sourceId, rawIdentifier)` entries to stable semantic parameter IDs and explicit normalization metadata. Keep source identity, value classification (`SOURCE_PROVIDED`, verified `MEASURED`, `COMPUTED`, `USER_DEFINED`, or clearly marked `TEST`), sample validation/current quality, event and reception time, and feed status as distinct concepts in storage and delivery where relevant. Unknown identifiers and missing/invalid values never become plausible defaults. Production mappings require authoritative evidence before activation.

## Alternatives considered

- Reuse provider IDs and DTOs throughout the backend and API: fewer mapping steps, but brittle coupling and no stable domain meaning.
- Store raw payloads only and interpret on reads: postpones normalization, but makes history/query semantics and source changes difficult to control.
- Populate the registry with all specification examples now: gives apparent breadth, but could represent unverified or nonexistent channels as real telemetry.

## Consequences

- Positive: source changes are contained, clients use semantic IDs, and quality/provenance remain inspectable through the pipeline.
- Negative: each mapping requires evidence, review, and a focused test; the first public catalog may be very small. Historical mapping changes may later need version handling.
- Review trigger: a new provider, changed field semantics, or observed mismatch between stored data and source evidence. Reverify and update mappings; never silently relabel old samples.

## 2026-09-28 application note

The [GP verification](../telemetry/orbital-elements-verification.md) and [ADR-0004](0004-local-gp-propagation-for-current-orbit.md) apply this rule to a **source-provided orbital element set** and a distinct **computed orbital state**, not to an ISSLive parameter/sample pair. The evidence registry records both IDs and their lineage. Element epoch, retrieval time, propagation time, and unknown publication time are distinct; a computed at-now state is not measured or live onboard telemetry. The original verification and mapping decision is unchanged.
