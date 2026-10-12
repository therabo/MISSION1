# A — Final independent production Crew architecture review

Review date: 2026-10-12 Europe/Rome. Baseline: `91664c4111c2c9208ed71609390f6907e484fa64`.

**Verdict: PASS. Remaining architectural blockers identified by A: none.**

The primary remains responsible for completing final `mvn verify`, final browser/scene and continuous scheduler→REST→UI/Historical acceptance, documentation, normal runtime restoration and the single ordinary commit/push. This scope verdict is not a premature claim that those remaining whole-task gates have completed.

## Review independence and scope

A performed canonical source/database READ-ONLY investigation and two independent architecture reviews. No canonical file/database was edited, no production source acquisition/materialization was invoked, and no full test suite was launched concurrently with the primary. Initial findings are in `a-activation.md` and `a-implementation-review.md`; the final reviewed source hashes are in `a-final-source-sha256.json`.

The final review re-read production consumer, explicit production policy, store/worker, normal retained membership input, V10 policy/store/integrity reader, Current annotation integration, UnifiedCrewReplay/configuration and V12. It independently checked the remedies to all three earlier blockers and the feedback-loop risk. It also inspected primary final backend log, D safety review/test assertions, C guard results and immutable-row report, E production-ingestion suite report/tests, B temporal/real-timeline review and G final GET/performance report.

## Final authority/integration conclusion

* V7 remains canonical identity/profile/alias/equivalence authority. Production binding targets must have an already retained publishable LL2 provider route under V7; a reviewed LL2 mapping without the matching canonical-equivalence/publication route fails closed in both store and consumer.
* V8 retains editorial/resource acquisition and verified-about-person facts. Editorial membership support additionally requires current explicit V7 resource ownership; V9-only graph matches do not authorize normal production Current or Historical.
* V9 stays general identity SHADOW. The modern retained input branch does not select V9 graph decisions/jobs and production support guards reject V9 graph/decision/observation authority.
* S10 has an independently versioned `s10-scoped-production-v1` release; Phase-1 shadow rows/release retain their original meaning. No per-match operator approval, person creation, global alias/merge, runtime fitting or AI is introduced.
* One batched SELECT-only S10 consumer supplies both normal Current operational annotations and V10 support/departure binding. The legacy reconciliation writer is bypassed in modern mode, preventing operational-source URL/name processing from creating humans or canonical correspondences.
* V10 remains the one lifecycle policy, materialized for Current outside GET and evaluated purely at T for Historical. No modern historical query reads the latest Current projection; no arbitrary-timestamp cache rows are stored.
* S10 revisions/releases and relevant V7/V8 changes notify durable V10 work; the ordinary bounded worker supplies eventual convergence, corrections and expiry. Latest-decision validation, all mandatory gates and immutable source/proof lineage remain enforced.

## Earlier blockers resolved

### A1 — sealed editorial authority

`RetainedMembershipInputs` now loads latest per-slot/per-observedURL V8 relation **before** filtering status, rejects unverified/wrong typed resources, evaluates current reviewed V7 binding (or original retained provider owner only when no reviewed decision exists), canonicalizes its owner, and records exact relation/acquisition/resourceKey/V7 decision/original-owner/person/provider pins in `identityHealth.editorialBindings`.

V12's `crew_active_editorial_binding_qualified` independently validates latest verified relation, correct roster/member, exact NASA_PEOPLE acquisition/resource, acquisition knowledge time, latest active V7 decision or valid original-owner path, and canonical provider ownership. The production support trigger requires it; the read-only Current integrity reader also rechecks it. Deferred completeness rejects mapped editorial pins lacking support. Revocation and a newer rejected relation cannot resurrect an older approval.

Cross-reviewed C artifacts include positive original-owner/reviewed-owner cases and fail-closed no-pin, wrong owner/human/acquisition, old/rejected relation, topic-as-person, forged V7 ID, revoked reviewed binding/original-owner resurrection, and missing-support cases. All recorded expected outcomes pass.

### A2 — consume-time source, policy, ranking and proof integrity

The consumer checks supported/nonplanned assertion and completed transfers, exact immutable source key/version/index/name/type/assertion/evidence/document/hash/effective-time, compatible serialized release/model/parser/schema, cut/evaluation/normalized payload equality and complete candidate set. It checks finite row/evaluation/winner scores, actual winner/runner ordering, runner key/probability, computed margin and all existing boolean/contradiction gates.

Required proof rows must agree with their normalized columns and sealed candidate payload, match exact resource reference/hash/captured time/locator, be valid at current knowledge time and cover the source event effective interval. A mandatory stable-provider and personal-flight authority plus official/agency/named-roster witness is required; source-scoped short forms require own-agency proof, and completed departures require named mission roster proof. No feature extraction/scoring runs in the consumer. Latest head is selected before release/outcome filtering, so invalid newer decisions cannot revive older MATCH.

D independently exercised 131 combined tests including 56 production-consumer tests, 25 real subjects, 256 wrong humans, 25 constructed gates, 16 links, resealed malformed cuts, strict thresholds/margin, exact source/policy/proof TTL/future/locator/interval/family checks. Final result: zero failures/errors/skips. The primary's final 1,163-test run includes the integrated suite with zero failures/errors/skips.

### A3 — current explicit fallback authority and target

Fallback is limited to the absence of any applicable S10 head, source-compatible exact retained person scope and independently verified authority: current reviewed NASA correspondence or actual source LL2 provider ID. Weak/unresolved/name-only/raw-link legacy rows cannot qualify; revoked reviewed correspondence is not current authority. The V12 normalized fallback guard enforces latest resolution, source subject, canonical target/provider, current reviewed binding or actual source LL2 ID. An accepted S10 target disagreeing with an independently qualified explicit target is `S10_V7_CONFLICT` and cannot be consumed.

C's exact-provider positive and forged payload/other-human/stale-resolution controls pass; D's explicit agreement/fallback/disagreement and inapplicable-head rejection tests pass. The actual rejected Sophie→Hathaway link is never authority; the independent Sophie proof and scoped Josh/Andrey behavior stay intact without global aliases.

## Corrections, clocks, durability and feedback cycle

Production S10 semantic cuts omit diagnostic V10 projection/reconciliation row identifiers, retaining those identifiers in immutable audit result/columns. Source/resource/eligibility/release/target/gate meaning remains pinned. E's restart-and-repair production test confirms repeated unchanged S10 evaluation inserts zero and V10 returns the same revision: no autonomous S10↔V10 revision loop.

E's 12 production-ingestion tests cover the same committed 7→11→7 sequence in Current and Historical, correction/retraction/reassignment without rewriting source/old decisions/projections, unresolved departure, source failure, known/unknown visitors, reentry, 7d/14d inclusive boundaries, explicit knowledge versus retrieved time, editorial-only historical coverage and accelerated scheduler pipeline. All12 pass without skips.

Historical context is explicit even when T equals knownAt. Source events after T are filtered before lifecycle selection. Identity/proof knowledge is current while operational effective time is T; original acquisition/binding times remain auditable. Structured/editorial captures cannot backdate membership; Historical freshness is relative to T. B's 21 real cuts and 20 pure temporal controls pass, including exact departure and observation boundaries and Current/Historical equality at a sealed cut. Real retained evidence supports unavailable→11→7; the missing pre-entry roster is documented rather than fabricated as seven.

## GET and operational boundaries

G's independent actual HTTP audit covers148 measured GETs plus30 warmups, all read-only SELECT connections, unchanged80-table GET fingerprints and zero source acquisition/network/S10/V9 scoring/V10 materialization/enqueue invocation counters. Production lookup uses five cohort SELECTs including V7 knowledge, rather than per-person/resource query loops. Current52 and Historical19–36 query counts are bounded by context; measured increased proof-validation latency is honestly recorded and no SLA is claimed.

Current remains a committed membership classification; a source gap ages annotations and independently degrades health. Restore normal source acquisition with newly obtained provenance; never retimestamp cached bytes to make a stale value fresh. The canonical source worker restoration after GET freeze is outside GET, not an authority bypass.

Explicit `LEGACY_OPERATIONAL_BINDING` and `LEGACY` Replay remain emergency rollback/comparison modes, while normal production defaults are S10 and unified V10/S10 Historical. V1–V11 files and old revisions stay immutable, V7/profile/aliases and V9 data stay frozen, and the one-application/PostgreSQL/ICU architecture gains no distributed or AI dependency.

## Limits and acceptance ownership

These regressions and qualified source paths do not certify operational error rates or continuous physical presence. Retained mature data, provider availability and acquisition budgets remain limits. Empty-database bootstrapping is the next separate milestone; no claim of clean-room success is made here. Browser/UX and final packaging/Git acceptance remain primary/F/E responsibilities and must finish before commit; they do not reveal a remaining architectural blocker in the reviewed code.
