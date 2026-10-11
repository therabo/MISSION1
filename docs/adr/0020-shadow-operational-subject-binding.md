# ADR-0020: Source-scoped operational subject binding in shadow

Status: Accepted for shadow only — 2026-10-11

## Context

The accepted production boundary publishes V10 ACTIVE membership through V7 humans
and keeps dated operational observations separate (ADRs 0017–0019). V9's existing
operational adapter deliberately lacks personal corroboration. It cannot safely
resolve every retained NASA mention, including source-scoped shortened names and
outgoing people absent from the current assignment list. The external operational
subject investigation established qualified official-resource paths for 25 retained
subjects; that small sample does not certify operational precision.

The schema audit found V6 exact occurrence/version links, V7 immutable canonical
routing, V8 typed NASA resources/captures and V9 frozen model artifacts. Reusing these
boundaries is sufficient; a second canonical identity graph is unnecessary.

## Decision

Add `crew.operational` inside the existing Java application and additive Flyway V11.
Reopen the exact retained article/paragraph, preserve its evidence/document hashes,
and acquire only allowlisted official/provider resource classes in a separate
background queue. Reuse compatible V8 personal captures in place. Deduplicate new
resource bytes by URL/hash/parser version; append attempts and successful
revalidations separately. Outages preserve last-good facts within a 30-day proof
validity window. New failed acquisitions do not manufacture contradictions.

Generate a bounded union of retained name/agency, source-time flight and mission
candidates. Current membership, reviewed V7 identity, public profile and gold labels
are excluded from features. Reuse V9's frozen 13-feature logistic coefficients and
calibration with the separately versioned research operational extractor: lexical
cosine and typed bridge are zero, and official authority is enforced by hard gates.
ICU4J 78.3 supplies generic comparison transliterations; generated forms never become
V7 aliases. A shortened source name requires a source-scoped own-agency person/DOB/
mission path. A raw hyperlink, fuzzy name or high probability alone cannot qualify.

The initial shadow thresholds are 0.991 for observation/arrival, 0.999 for completed
departure, and 0.20 runner-up margin. Required gates include exact source integrity,
complete candidate inputs, compatible name/agency, qualified personal or named
mission/flight witness, event-time compatibility and no authoritative contradiction.
Departure additionally requires the completed named mission/flight path. Only after
scoring may an existing publishable V7 human be selected. Distinct same-assertion
subjects colliding at provider or canonical target become conflicts. There is no
residual assignment or person creation.

Append sealed binding revisions with predecessor, policy/model/schema/normalization
versions, factual cut, candidate vectors, gate reasons, normalized proof lineage and
production differential. Corrected source versions get independent bindings and an
append-only supersession revision for the old version, including the replacement
revision reference. A durable generation queue, leases, notifications and periodic
repair support deferred-to-matched progression and restart without duplicate cuts.

The shadow worker defaults ON after 15 minutes; evaluation runs each minute and
acquisition each five minutes. The production consumer is **nonexistent**. Neither
the V9 adapter/graph nor production V10, Current annotations, departure vetoes,
Replay, public DTOs or frontend consume these decisions. Detached V10-policy
counterfactuals are diagnostics only. GET remains a read-only boundary.

## Alternatives considered

- Global V7 nickname/transliteration aliases or general V9 promotion would widen
  authority beyond the qualified source assertion.
- Name/score-only matching and current-only candidate lists lose safety or historical
  recall. Manual human crosswalks would defeat the investigation's purpose.
- New fitted ML/AI models, Python services, semantic/vector stores, knowledge graphs,
  brokers or microservices have no demonstrated need here.
- Duplicating V8 captures or extending its production semantics would obscure
  provenance and the isolated rollout boundary.

## Consequences

The linker can resolve qualified retained operational subjects independently of
production routing. History can be audited and eligibility corrected without
rewriting canonical people, profiles or old decisions. Acquisition is eventually
consistent and bounded; cold caches defer. Source changes or expired proof eligibility
can append new revisions. A 256-subject evaluation cap, 256-candidate cap and 10,000
retained-provider cap fail closed and require a future bounded paging extension if
the historical workload exceeds them.

Finite verified discovery seed URLs are configurable resource locators, not identity
crosswalks or accepted human lists. Publisher schema changes, absent precise partner
facts, uncaptured provider histories and unknown indistinguishable homonyms remain
limits. All NASA pages belong to one editorial family; copies do not multiply
confidence. LL2 flights/profile metadata do not establish onboard physical presence.

Production activation requires independently justified operational calibration,
broader ambiguity/error evaluation and a separate narrow consumer/rollout decision.
The 25 positive subjects and 256 known wrong-human comparisons are regression
evidence, not a precision guarantee or 99.9% certification.

## Validation

See the [S10 dossier](../crew/operational-subject-binding-shadow-validation/README.md)
for real captures and results, 275-vector operational parity, the existing 14,382
model-vector regression, fault/correction/restart tests, actual HTTP and SQL tracing,
production fingerprints, performance, resource/index growth and dependency audit.
