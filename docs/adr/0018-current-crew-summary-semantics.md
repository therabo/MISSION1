# ADR-0018: Purpose-specific Current Crew summary semantics

## Status

Accepted — 2026-10-11. Clarifies the public contract in ADR-0017; V7 identity,
V9 shadow and V10 membership decisions remain accepted and unchanged.

## Context

Current correctly publishes seven V10 ACTIVE/V7 canonical humans. Its old shared
Current/Replay DTO still exposes operational count history and an unidentified gap.
The Current UI labels that gap as “Without confirmed identity”, although it is
`max(0, operational count - confirmed physical presence)` and has no corresponding
unidentified-person collection. Actual prior eleven is11−0, current seven is11−4.
The operational COUNT_ONLY assertion contains no named subjects. V10 independently
has8 ACTIVE source slots and15 retained source slots. These are not human counts.

## Decision

Current publishes `CurrentCrew` / `CurrentCounts` with `resolvedAboard` (operational
presence diagnostic) and `structuredAssignments` only. Remove Current
`counts.officialAboard`, `lastKnownOfficialAboard`, `unidentifiedAboard`,
`unresolvedSubjects`, and root `unresolvedSubjects`. Remove the obsolete Current
mapper, decoders, selectors and headline metrics together. The sole headline is
Current members, derived from the published V10 selection. ACTIVE source slots
remain in existing `membership.unresolvedActiveSourceSlots` and source details;
retained slots are internal. No human cardinality is inferred from source names.

Historical/Replay retains `Crew` / `Counts`, its JSON, count/report decoder, UI and
presence wording. Current stale wording becomes “Presence not currently confirmed”
with “Last operational confirmation: aboard” and original operational UTC. No
presence enum, applicability policy, lifecycle, identity or source changes occur.

All repository consumers were audited: one frontend plus tests, validation scripts
and documents. There is no established external versioning/deprecation requirement
for this local application. Backend and frontend release together on main. This is
an intentional breaking removal on Current, not a silent deprecation; deploying
only one side is unsupported. No new endpoint or API version is warranted here.

Persisted operational count evidence, immutable reconciliation counts/gap history,
editorial topic facts, V9 decisions and V10 result count contexts remain useful.
No persisted field exists solely for the obsolete presentation; no migration is
created and V1–V10 bytes remain unchanged.

## Alternatives considered

- Keep the gap under a new Current headline: rejected; it compares different time
  and completeness scopes and still offers little user value.
- Replace the headline with ACTIVE slots: rejected; source diagnostics belong in
  source details and may repeat people already published.
- Remove shared historical counts/schema: rejected; loses independent provenance
  and effective-time reconstruction/diagnostic value.
- Retain deprecated misleading fields: rejected; no external compatibility policy
  requires them, and coordinated local consumers can migrate cleanly.

## Consequences

Current separates membership, operational physical presence and source diagnostics.
A small purpose-specific DTO/type prevents historical fields leaking into Current.
Stored evidence and Replay remain intact; successful SELECT count does not increase.
Repository integrations/tests must use the Current decoder for Current and the
Historical decoder for Replay. Future external consumers must follow the documented
contract rather than assume Current includes operational count history.

See [investigation](../crew/current-ui-semantic-cleanup/unresolved-identity-investigation.md)
and [validation dossier](../crew/current-ui-semantic-cleanup/README.md).
