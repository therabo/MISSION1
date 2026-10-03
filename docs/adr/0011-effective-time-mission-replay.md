# ADR-0011: Query-time effective-time Mission Replay

- Status: Accepted
- Date: 2026-10-03
- Scope: Crew and orbital historical reads

## Context

The accepted current-state paths have immutable Crew history, six retained GP sets and three complete OEM files. Replay must reconstruct operational state effective at T using evidence stored today, including late acquisition. Current-state source acquisition and knowledge-time filters cannot implement that contract.

## Decision

Use one read-only, repeatable-read Mission Replay application query composing independent Crew and Orbit queries at the identical UTC instant. Reuse the pure Crew reconciliation rules with an explicit effective-time applicability mode. Select structured observations no earlier than their capture, filter assignment validity, and enrich only the resulting historical identities with latest canonical profiles. Career/profile metadata is explicitly present-day information.

Use only persisted GP/OEM. The empirical gate is **FULL over the currently supported Crew interval**, approximately 2026-10-02T02:01:55Z through the audit instant 2026-10-03T21:16:36Z; this is a narrow collection interval, not an unlimited archive. The gate inventory is in the feasibility report and was recorded before historical position implementation.

Choose the nearest GP epoch within an absolute 24-hour limit (configurable downwards), with prior epoch then content hash as deterministic ties. Negative offsets are permitted and disclosed. This conservative application limit is not a position accuracy guarantee. OEM uses the retained covering product created most recently at/before T, otherwise the earliest covering creation after T. Source vectors bound Hermite interpolation; gaps over 600 seconds and extrapolation are rejected. Transform complete PV with the accepted Orekit frames. Keep the two sources separate; GP is primary where usable, otherwise OEM. Never invoke current orbital/comparison services from Replay.

Coverage is the union of evidence applicability intervals, with gaps preserved and joint coverage computed by intersection. Partial source assertions remain partial even inside coverage. Historical paths are omitted in this milestone. Pause the scene at T and hide current paths; mode changes issue no camera commands. Return to the current buffer and accepted clock policy on exit.

Knowledge-time/as-known-then reconstruction remains a separate future capability. No replay projection is persisted. No infrastructure or database schema is added.

## Alternatives

- Latest current state as historical fallback conceals gaps and gives incorrect epochs.
- Persisted reconciliation rows before T miss late-arriving events and inherit acquisition-time semantics.
- Fetching a historical archive would alter the evidence base merely to pass the gate.
- Per-second materialization adds storage and invalidation complexity without a current need.

## Consequences

Late evidence can improve an earlier answer. Operational source health today is separate from historical applicability. Profiles may contain metadata published after T, clearly labeled. Finite source and EOP coverage limits are public. Future collections can change coverage without changing the query rules. OEM retrieval provenance is limited to the existing retained last retrieval and HTTP metadata; original source bodies and creation/vector times remain preserved.
