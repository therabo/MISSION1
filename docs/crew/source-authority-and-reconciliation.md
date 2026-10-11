# Crew source authority and implemented reconciliation

## Source occurrence versioning — 2026-10-10

Source occurrence continuity is independent of canonical human identity and operational authority. A NASA article key identifies a publishing resource; an assertion/subject occurrence identifies a claim/mention, never an astronaut. Equal names only participate inside an exactly scoped compatible claim and cannot establish a person mapping. No authoritative Andrey/Andrei correspondence was found, so that resolution remains UNRESOLVED.

Selecting the newest successfully observed compatible representation does not make its old publication/event time current. The existing NASA/LL2 authority, assignments-versus-presence, partial-omission, planned/completed and freshness contracts remain unchanged. Distinct claims/events survive selection; all alternative evidence/metadata remains internally auditable. See [ADR-0012](../adr/0012-versioned-crew-source-occurrences.md) and [count/provenance validation](source-occurrence-versioning-validation/README.md).

**Current scheduling extension (2026-10-03):** [ISS Crew event-aware refresh](event-aware-refresh.md) adds a bounded LL2 docking/undocking calendar, conservative NASA anticipation and durable completed-NASA-transfer follow-up. Planning events remain separate from crew presence and assignment truth. Baseline 2h source schedules, parser/reconciliation semantics and this document’s dated validation evidence remain applicable. New operational history uses V5; see the [new validation dossier](event-aware-refresh-validation/README.md). Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

## Earth View presentation — 2026-10-03

The [Crew UI](../frontend/crew-earth-view-panel-review/README.md) receives the existing backend interpretation. It neither promotes LL2-only assignments to confirmed presence nor assigns NASA-only people a structured role. Source spelling variants such as the dated Andrei/Andrey reports stay distinct. All eight reconciliation statuses, per-member states and unresolved assertion applicability remain visible; latest successful fetch, original observation, publication and reconciled/evaluated times have separate labels. A manual UI refresh requests another read-time evaluation, not provider acquisition. No browser identity matching or authority override is introduced.

LL2 and NASA observations stay independent. A provider's overall priority or a boolean verified flag cannot explain field, time, identity or completeness.

| Field | Authority | Boundary |
| --- | --- | --- |
| Source biography/career/agency/nationalities/media/role | LL2 structured profile/assignment | NASA interpretation never rewrites these observations. |
| Structured current expedition and assignments | LL2 active detailed expedition | Assignment is not physical presence. NASA expedition mentions remain contextual evidence. |
| Positive physical presence and completed named arrival/departure | Time-qualified official NASA assertion | Subject resolution, completed status and applicability are mandatory. |
| Official count | Separate official NASA count assertion | It can exceed resolved identities. No person is fabricated. Later completed transition invalidates an older count. |
| Derived current state | Versioned reconciliation | May be partial, unavailable, stale or ambiguous; original observations survive. |

CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss. Planned event != completed event. Partial omission != departure.

The authoritative [implemented design](nasa-verification-and-reconciliation.md) defines all eight exact status rules and precedence, identity hierarchy, source acquisition, temporal/freshness policy, immutable persistence and failure semantics. Live operational lists are PARTIAL, count assertions COUNT_ONLY and hatch assertions EVENT_ONLY. No live source is treated as an exhaustive roster. Exhaustive omission is available only to explicitly classified, fully resolved source evidence after a person's prior known presence.

The [2026-10-03 live validation](reconciliation-validation/README.md) produced PARTIAL_MATCH: six shared resolved identities, one LL2-only name, two NASA-only resolved UUIDs and three unresolved NASA subjects, with a separate official count of eleven. This is dated evidence. The narrower capture does not demonstrate a measured LL2 update delay and is not automatically NASA_AHEAD. The earlier source-validation divergence remains preserved as historical context.

Event time takes precedence within person-presence scope when explicit; publication is the fallback assertion context. Retrieval never rewinds event ordering. Planned/future claims are inert, equal-time conflicts ambiguous, unrelated partial articles cannot imply departure, and old historic events can remain true while their current implications become stale. No runtime search, LLM or fuzzy matching is used. [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md), [ADR-0008](../adr/0008-immutable-crew-source-history-and-identity-anchors.md) and [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md) remain consistent.

## Public exposure — 2026-10-03

[REST](../api/crew-api.md) preserves this authority matrix: structured assignment/profile provenance, NASA assertion source/type/time/completeness, unchanged per-person and reconciliation enums, separate operational source health, current versus retained official count, and unresolved named assertions. No raw source body, database lineage ID, matching key or parser diagnostics are public. NASA-only presence never acquires a fabricated LL2 assignment. Existing source/authority rules are unchanged.


## Replay integration — 2026-10-03

Field authority and the assignment/presence distinction also apply at historical effective time. Replay uses the same pure reconciliation rules with explicit event-time applicability and latest canonical profile enrichment. [Crew Replay semantics](../replay/crew-replay.md) distinguish operational history from newer profile metadata and acquisition-time health.

## NASA editorial shadow source — 2026-10-10

[ADR-0014](../adr/0014-nasa-editorial-roster-shadow-observations.md) adds an independent editorial source. Research-topic Expedition/website count are secondary context; mission roster/roles are secondary editorial membership context; personal topic/people resources are identity evidence only. LL2 remains structured assignment/role authority and NASA operational evidence remains presence/completed transfer/official count authority. No editorial observation enters the accepted public Current or Replay projections. Count is reported in persons, never onboard telemetry; omission is never completed departure; CMS modified is never crew-event time. [Source/discovery/provenance and validation](nasa-editorial-roster-validation/README.md).

## Positive membership support — shadow only, 2026-10-11

The V10 [membership overlay](active-membership-shadow-validation/README.md) keeps identity, assignment and presence separate. LL2 is primary for structured assignment/role/Expedition and can independently support membership. A validated, fresh NASA Expedition roster is secondary positive editorial support only after V9 MATCH binds its exact slot observation. NASA topic Expedition/count facts remain contextual/editorial; personal resources supply identity/profile evidence only. Neither roster membership nor assignment confirms physical presence. The accepted operational classifier alone supplies named presence, entry, completed departure and official count. Source-field disagreements remain separate from membership/count/identity/health findings. An operational acquisition failure retains last-known evidence but blocks current operational support; editorial success never heals it. Successful omissions retract one source support, never imply departure. Publication fallback is a labeled proxy, never inferred event precision. All captures and decisions are pinned in immutable revisions; public reconciliation and Replay remain unchanged.


## Completed operational departure parser — 2026-10-11

The [departure validation dossier](nasa-operational-departure-validation/README.md) documents parser
1.1.0, exact captured source grammar, named subjects, explicit event/publication/capture time,
minute precision and independent source health. The existing V6 occurrence and evidence schema
supports additive retained reinterpretation with immutable bodies/history; no migration is added.
No operational or editorial count is derived from subject cardinality. New timed departure evidence
flows to V10 shadow only; public Current membership, profile identity and Replay remain on the
accepted legacy evidence path. V9 decisions remain separate and unmodified by this command.

## Current activation boundary — ADR-0017 / 2026-10-11

Current membership now comes from the latest compatible committed V10 ACTIVE projection, followed by established V7 canonical identity and latest-retained LL2 field authority. It remains distinct from operational presence, assignment and source count facts. Retained people and aliases stay detail-addressable; V9 identity remains shadow-only and Historical/Replay selection stays unchanged. No source/history/migration change occurs. [Activation contract, rollback and acceptance](current-active-projection-activation/README.md).
