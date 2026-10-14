# ADR-0021: Production operational subject binding and unified Crew Replay

Status: Accepted — 2026-10-11

## Context

S10 Phase 1 qualifies retained operational subjects without canonical identity
commands. Current V10 and its operational annotations currently have different
binding paths; Replay still uses the earlier retained-union lifecycle and 72-hour
observations. V10's relational constraints specifically require V9 lineage.

## Decision

Keep one Java application and PostgreSQL. V7 owns canonical identity, profiles,
aliases and equivalence; V8 owns editorial/resource ingestion; V9 remains general
identity research SHADOW. The separately sealed `s10-scoped-production-v1` release
automatically binds exact operational subjects to existing V7 humans. It preserves
Phase-1 model, feature schema, normalization/ICU, authority, resource parser,
thresholds (0.991 observation/arrival, 0.999 completed departure), 0.20 margin,
complete candidate, witness, temporal and contradiction gates. Old releases and
rows retain their meaning. No runtime AI, canonical creation, alias or merge occurs.

One batched SELECT-only consumer selects the newest exact subject revision before
checking release compatibility, sealed source/document/hash and proof lineage,
proof validity at current knowledge time, and existing provider/V7 publication.
An independently explicit V7 correspondence is fallback only when there is no S10
decision. Disagreement with an accepted S10 target is CONFLICT. DEFER, CONFLICT,
incompatible or superseded heads never resurrect an older MATCH or weak fallback.
Editorial slots use independently verified existing V7 resource correspondence;
V9 matches cannot authorize production membership or Historical identity.

V10 remains the single lifecycle policy: positive supports, persistent completed
departure veto, strictly later qualified reentry, capture-bounded structured and
editorial supports, source-specific omission and independent collection health.
Current materializes this policy outside GET. Historical evaluates the same pure
policy read-only at effective UTC T, using evidence/identity known today. Events
after T are excluded; structured/editorial captures after T cannot backdate a
roster. Historical applicability uses `crew-freshness-v2` at T: observed seven
days, transfer implication fourteen days, count seventy-two hours. Today's feed
outage does not change an old event's effective eligibility. Capture, effective
and binding knowledge times remain separate in immutable provenance.

Add V12 to admit truthful production identity mode and separate sealed binding
lineage, including departures. Source and S10 corrections notify the durable V10
queue; periodic workers provide bounded asynchronous convergence and expiry.
Production S10 cuts exclude diagnostic V10/reconciliation revision identifiers
from their semantic hash to prevent self-generated S10↔V10 revision churn.
GET cannot acquire, score, enqueue, repair or materialize. No arbitrary Replay
timestamp rows are persisted. Profile metadata remains latest canonical metadata;
historical membership, assignments and annotations remain at T.

Normal mode is `S10_SCOPED_BINDING` and `UNIFIED_V10_S10` Replay. Explicit
`LEGACY_OPERATIONAL_BINDING` / `LEGACY` Replay exist for emergency rollback and
differential validation only. Missing modern Current projection fails closed.

## Consequences and alternatives

This supersedes earlier ADRs' S10 shadow-only consumption and normal legacy Replay
restrictions, without changing their historical acceptance records. Reusing V9 IDs,
backdating captured rosters, reading latest Current for Historical, or using a second
hand-written lifecycle would obscure authority/time. A broker, service or timestamp
cache has no demonstrated need. Mature retained data and finite qualified resources
remain prerequisites; this milestone does not certify operational precision or
prove a complete empty-database bootstrap. Clean-room bootstrap is the next separate
milestone. Validation and limitations are recorded in the final Crew dossier.

## Publication compatibility update — 2026-10-14

[ADR-0023](0023-public-initial-database-schema.md) supersedes this record's development
migration and emergency rollback clauses before first public release. The public
installation uses one schema-only V1 and the qualified production/unified Historical
paths exclusively. This dated decision's gates, authority, lifecycle and time semantics
remain accepted; its original migration/mode names remain historical evidence.
