# ADR-0016: Shadow active Crew membership and source-supported lifecycle

Status: Accepted for SHADOW only

Date: 2026-10-11

## Context

V7 retains production canonical UUIDs and reviewed aliases; V8 retains NASA editorial observations; V9 computes independent automatic identity decisions. Public Current still returns a retained union. The completed investigations require a separate positive-support lifecycle without activating a new public contract or repairing operational RSS grammar.

## Decision

Keep the existing Java/JDBC/PostgreSQL Crew module. A pure membership policy consumes a consistent retained input cut through an explicit V9 identity boundary. A canonical shadow human is a known typed LL2 person anchor, independent of a current assignment. Provider/source slots are mentions, not humans. V9 active MATCH decisions, pinned to a graph application and the actual source observation, may bind NASA slots to that anchor. DEFER, SEPARATE, missing, changed or revoked associations remain unresolved. V7 is available only to a separate post-materialization diagnostic comparison.

Structured assignment is LL2's attributed Expedition/role/nullable personal validity. Editorial membership is a validated current NASA roster slot. Operational positive presence is an accepted named aboard/completed-entry assertion. Membership support is one of these attributed facts with exact source and identity lineage. Assignment and presence are separate. Profiles, career, UUIDs, aliases and historical assignments are retained independently.

At T a human is ACTIVE when at least one current eligible fresh LL2 assignment, resolved NASA editorial membership or qualified named operational positive exists, unless a completed named departure closes the episode without a strictly later qualified named reentry/positive episode. A page or assignment revalidation cannot reopen a departed episode. Equal-time contradictory operational claims are ambiguous and fail closed. Completed departure is an auditable temporal veto, not a permanent departed boolean; its lifecycle implication survives expiry of fresh physical-presence confirmation. Effective time and its source precision remain attributed; publication fallback is explicitly a proxy, never inferred exact event seconds.

A known human without eligible positive support is RETAINED. Omission in a successfully selected complete source state retracts only that source's support; omission never creates a departure. Failed acquisition retains last-good context and independently degrades health; it never supplies a successful empty roster. A fresh unbound positive slot is UNRESOLVED_ACTIVE_SOURCE_SLOT with no fabricated UUID and does not increase resolved active human count. Stale and non-positive operational slots remain separate retained diagnostics.

Reuse crew-freshness-v1: LL2 6h, operational successful verification 6h, current assertions 72h, entry/departure presence implications 14d (configurable existing properties). Add explicit source-specific project policy: editorial roster 6h and topic 6h, allowing three normal 2h polling intervals; personal-resource health 7d, not membership support. T must be at or after capture. Editorial capture/revalidation governs eligibility; CMS modified/publication and Expedition start never backdate membership. V9 validity is revision/source-evidence compatibility, not a global TTL that revokes unchanged identity knowledge; pending/failed jobs and incompatible observations degrade independent resolver health.

Source count means attributed cardinality: resolved active humans, unresolved active slots, LL2 assignments, NASA roster slots, website editorial aboard count, operational official count and last-known operational count remain distinct. Same counts with different resolved people are membership disagreement. Source-field, membership, identity, count and health findings have separate namespaces. Projection health is HEALTHY/DEGRADED/UNAVAILABLE with each stream and binding coverage visible. Editorial success never heals operational MALFORMED_RESPONSE; unavailable count remains null.

V10 adds immutable projection revisions, members, supports, unresolved slots, findings and operational input links, plus one mutable durable notification state. Revisions pin policy, evaluation time, selected LL2 snapshot/run, editorial roster/topic acquisitions, V9 graph, selected operational evidence/capture lineage, source-health cut and SHA-256 serialized meaning. Current predecessor chains preserve A→B→A. Repeated identical cuts/eligibility are idempotent. A dedicated advisory lock serializes materialization; a nested repeatable-read retained adapter obtains one coherent cut after the lock. Atomic inserts prevent partial projections; child rows are sealed after the creation transaction, so later INSERT cannot alter committed history; source triggers increment a durable generation and bounded scheduled reconciliation handles expiry/missed notifications. No network or scoring occurs in projection or GET. Internal reads select already materialized results.

This milestone is SHADOW ONLY. Public Current, detail, Replay, parser, source acquisition and frontend remain unchanged. Future activation requires an explicit contract, differential validation, rollback and separate ADR; future Replay consumption must respect capture/time cuts.

## Alternatives and consequences

Filtering public Current immediately would bypass rollout. Intersecting rosters excludes visitors and valid single-source support. Name deduplication or V7 reuse would hide identity uncertainty. A second graph, service or broker adds no current value. The additive overlay costs auditable revision storage and configurable expiry maintenance, while retaining every original source/profile/identity row. Source uncertainty may produce zero supported rows with UNAVAILABLE health; that never asserts an empty physical station. Deterministic policy, PostgreSQL integrity/concurrency/order/restart, real retained-data, public GET and unchanged browser checks defend the boundary.
