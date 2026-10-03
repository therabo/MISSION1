# ADR-0007: Independent Crew observations and field-aware source authority

Status: Accepted

Date: 2026-10-03

## Context

Crew operational context is a new logical domain in the existing single backend. The bounded source validation found seven LL2 Expedition 75 assignments and NASA evidence of eleven people aboard during the Crew-12/Crew-13 handover. Expedition membership, being in space and being physically aboard a station answer different questions. A universal source priority or boolean NASA verification would conceal this distinction and constrain future history, API and Replay semantics.

## Decision

Keep `crew/domain` and `crew/application` independent of Orbit, Orekit, SQL, HTTP and provider DTOs. Implement provider translation in `source/crew`, using the existing Java HTTP/Jackson stack and injected UTC Clock. LL2 is the preferred structured profile/assignment source. Distinct NASA official document types supply operational presence and arrival/departure evidence. Preserve both observations, their bytes' hashes, retrieval/publication/event times and method versions. Reconciliation will be field-aware, with explicit disagreement and uncertainty; no canonical reconciliation runs in this milestone.

Expedition assignment never establishes station presence. LL2 `in_space` never establishes ISS presence. MISSION1 will own future person/expedition UUIDs with separate source mappings; LL2 integer IDs remain external. Names alone cannot automatically merge people. Media rights remain attached to source assets.

This milestone implements explicit read-only LL2 capability and NASA document/evidence contracts. It adds no Crew persistence, scheduler, startup request, REST or UI. NASA prose has no validated stable roster extraction contract; deterministic semantic ingestion is deferred. The orbital/rendering subsystem stays frozen. See the [Crew contract](../crew/domain-contract.md) and [authority matrix](../crew/source-authority-and-reconciliation.md).

## Alternatives considered

- LL2 roster as current occupancy: simple, but wrong during handovers and visits.
- NASA as universal fallback or unconditional override: loses structured source facts and field-specific disagreement.
- Scrape names/counts from arbitrary NASA prose: current pages differ by section and document time; bounded captures do not justify reliable automation.
- Separate Crew service/database/broker: no current isolation or scale need; retain ADR-0001/0002.

## Consequences

- Positive: uncertainty and handovers are representable; future persistence and public IDs remain source-neutral; no continuous runtime cost is introduced.
- Negative: canonical presence remains unavailable until identity resolution, temporal evidence rules and reconciliation are implemented. NASA document fetching alone does not establish occupancy.
- Validation: offline mapping/transport tests, assignment/presence and disagreement tests, startup request counter, and module-dependency fitness test. Revisit this decision when a stable official machine contract or concrete reconciliation requirement changes the evidence boundary.
