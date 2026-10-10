# ADR-0013: Canonical Crew identity and field-level profile projection

Status: Accepted

Date: 2026-10-10

## Context

ADR-0012 solves compatible source-mention versions, not human identity. NASA-first allocation followed by LL2 allocation produced separate published UUID anchors for Luke Delaney and Jessica Watkins. The external identity investigation supplies the evidence; the user approved these two reviewed same-human associations. Fedyaev remains unapproved.

## Decision

Keep provider identity (source/entity kind/key), permanent UUID anchor, canonical human representative, provider binding, UUID equivalence decision and source-subject resolution separate. NASA WordPress IDs identify typed website resources, never global personnel IDs. Append binding/equivalence/proof decisions in V7 without changing V1–V6 or original mappings, observations, occurrences, evidence or audits. A curated manifest keys relationships by provider identity and retains bounded source URLs, capture hashes, locators and review context. Apply outside GET, transactionally and idempotently under the identity lock; incomplete declarations remain pending without invented anchors.

The earlier anchor is representative (UUID order breaks equal creation times). Explicit direct alias-to-representative decisions form stars: cycles, conflicting representatives and implicit transitive unions fail closed. Revocation/supersession appends a decision; histories remain. Old UUID resources resolve in the application without HTTP redirects.

One shared read-only projection transforms assignments and resolved subjects before temporal presence reconciliation. Names/agency/mission/biography generate review candidates; new name-only human association is disabled, while accepted v1 audits remain auditable. Approved bindings are reusable automatically. Old audits are not relabeled.

Canonical fields use latest successful retained LL2 name/agency/nationality/biography/media/career by capture lineage, selected structured assignment/Expedition separately, and NASA operational presence/evidence separately. New same-provider nulls/removals replace old fields; career totals are not summed and portrait rights stay unchanged. Collection/detail share metadata policy. No crawler, new portrait, scoring or frontend dedupe.

Current and Replay share identity knowledge at knownAt. Replay retains EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION and LATEST_AVAILABLE_CANONICAL_METADATA: new identity knowledge can improve historical identity while assignments/presence remain effective at T. GET remains repeatable-read, network-free and write-free. Version markers distinguish new interpretation; old snapshots keep their meaning.

## Alternatives and consequences

Mutable mappings/destructive UUID merges lose history and reversibility. Frontend grouping hides incorrect reconciliation/counts. Another person-observation model duplicates V3–V6. No new infrastructure is justified. The additive overlay costs decision/proof storage and alias maintenance; corrections require reviewed supersession/revocation. Fedyaev stays unresolved. PostgreSQL, arrival-order, rollback, alias, null, Current/Replay and browser regressions validate this choice.
