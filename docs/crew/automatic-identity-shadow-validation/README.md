# Automatic Crew identity shadow validation

Baseline: `e2b036496c631e1db93b122f5aa022c4510ec5de`, main. Validation: 2026-10-10–11 Europe/Rome. [ADR-0015](../../adr/0015-automatic-crew-identity-shadow.md) governs this independent shadow overlay. Full logs, HTTP/DB fingerprints, browser screenshots, research-read hashes and fresh-process runs remain outside Git under `/Users/daniel/.codex/exports/mission1-automatic-identity-shadow-validation/`. [Actual local results](local-shadow-results.json) include every eligible retained NASA identity, candidate vector and diagnostic summary.

## Architecture and independence

Retained source facts → typed observation/index → bounded candidates → frozen Java model → personal/ambiguity/contradiction/component guards → append-only decision → independent shadow graph. PostgreSQL supplies durable jobs and application lineage. No Python, sklearn, LLM, embedding, external service or network acquisition is part of serving/evaluation. Missing evidence remains an automatically retried DEFER.

`RetainedIdentityEvidence` reads original LL2 observations, NASA operational subject/occurrence versions and V8 editorial captures/relations. It never reads canonical profiles, original identity audits, reviewed V7 bindings/equivalence or the manifest. `IdentityFeatures`, `IdentityCandidates`, `IdentityPolicy`, `AutomaticIdentityStore` and the worker have no reviewed/canonical/network dependency. A source/API boundary test enforces this. Only `ProductionShadowComparison` reads V7, after obtaining persisted shadow output, and cannot feed the worker. Public API/Replay/frontend source files are unchanged and cannot consume the automatic package.

A PERSON key, a WordPress people/topic resource, a named editorial slot and an operational subject occurrence are distinct typed nodes. Source references include table/row identity, hash, locator and capture time. The shadow representative is a deterministic LL2 debug key (or lexical NASA key), not a public UUID. About-person retrieval relationships do not become equality edges. Unbound resource/mention components are not counts of new humans or ISS occupants.

## Frozen model and numerical conformance

| Property | Value |
| --- | --- |
| Serving version | `crew-auto-identity-v1-shadow` |
| Research artifact | `research-logistic-v1`, exact investigation `metrics/model.json` |
| Feature schema/extractor | `research-13-v1-scoped-extractor-1` |
| Policy | `balanced-0.991-margin-0.20-scoped-1` |
| Model SHA256 | `469c31402cdd89ae1bc956cdcabdc57e00088b967806d322bdfbfca8d9896792` |
| Frozen lexical SHA256 | `5c7df0376b9b8e9b64f6f9d18204f152a148baaac439fdaf4cc70b488e774c10` |
| Match / margin | `0.991` / `0.20` |
| Low-score separate reference | `0.001`, never sufficient without qualified negative proof |

The tracked model and lexical files are byte-identical copies of the investigation artifacts. Names/aliases use its Cyrillic transliteration, token/order and character comparisons; TF-IDF uses the frozen training vocabulary/IDF, unigram/bigram counts, sublinear TF and L2 normalization. No refit occurs. Thirteen features retain their original order: exact name, containment, token Jaccard, character/given/surname similarity, agency, DOB equality/conflict, selection, flight, lexical cosine and typed bridge. A verified cross-provider personnel bridge is unavailable in retained production evidence, so that feature stays zero (its research coefficient is zero).

Java matches **14,382** original V1/enriched research vectors, with probability tolerance `2e-14`; measured maximum probability delta `3.33e-16`. **143** source-record pairs independently reproduce all thirteen extracted V1 features within `2e-12`, including the frozen lexical comparator. **17** representative/borderline/adversarial vectors additionally compare Python arithmetic linear scores (`2e-13`), raw sigmoid and calibration (`2e-14`). The supplemental arithmetic reference uses unchanged research vectors and coefficients; it is not retraining or new truth. Boundary tests cover0.991 and0.20, including exact equality by comparing best≥runner+margin.

Artifact missing/read failure, SHA mismatch, unsupported schema, coefficient-count/calibration/IDF failures and invalid features fail closed. Resolver failure leaves production V7 intact and exposes independent health; the worker does not consume jobs when its model cannot load. Future release IDs enqueue reevaluation and append revisions; they never reinterpret old decisions silently or automatically activate production identity.

## Candidates, witnesses and contradictions

Candidate retrieval indexes all retained eligible LL2 identities, including historical people. Blocks use normalized/canonicalized aliases, surname/given tokens, native transliteration and person-scoped mission overlap. Top-K is32; a truncated block always defers. The import/index scope is10,000 identities, with a fail-closed bound. Current actual maximum is2 candidates. Candidate generation remains permissive; matching remains strict. Fedyaev retrieval uses general transliteration, without person-specific code or a manual manifest.

A compatible name and high probability require a qualified personal witness: selection from a validated biography, precise qualified DOB, independently shared personal flight or lexical overlap>0.12 in a validated biography. Named Crew-N captions can qualify only their own validated source slot; a shared-flight witness still requires LL2 personal flight evidence. Generic Flight Engineer, Expedition75, agency/nationality, same roster or photo context never qualify. A rejected/mismatched personal link is excluded. Changed successful target versions are rechecked against the source subject; failures retain last-good evidence without inventing identity negatives.

Hard conflicts are explicit and separately persisted. Authority-qualified DOB disagreement, confirmed different humans, incompatible provider/incarnation identities and whole-component exclusions veto matching. Secondary DOB disagreements are not unconditional separation. Distinct NASA CMS IDs do not prove different people. Distinct LL2 PERSON keys conservatively prevent one shadow component from holding incompatible catalogue identities; this is a defer guard, not permanent different-human proof. Low probability alone defers. A qualified negative can append AUTO_SEPARATE even when a statistical score is high.

## Actual Expedition75 shadow results

Probabilities are model outputs, not measured accuracy. A missing runner means no second identity in the retained blocked candidate set; its policy probability is zero, not a claim about the unqueried world catalogue.

| Source name | Candidates | Best LL2 | Probability | Runner / p | Margin | Qualified pair witness | Decision |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| Pyotr Dubrov | 1 | 650 | 0.9999028064 | none /0 | 0.9999028064 | none | AUTO_DEFER |
| Anil Menon | 1 | 713 | 0.9999029177 | none /0 | 0.9999029177 | validated biography lexical | AUTO_MATCH |
| Anna Kikina | 1 | 649 | 0.9999028064 | none /0 | 0.9999028064 | none | AUTO_DEFER |
| Jessica Watkins | 2 | 582 | 0.9999678084 | Meir573 /0.0024402826 | 0.9975275258 | biographical selection | AUTO_MATCH |
| Luke Delaney | 1 | 710 | 0.9999029134 | none /0 | 0.9999029134 | validated biography lexical | AUTO_MATCH |
| Joshua Kutryk | 1 | 642 | 0.9997267308 | none /0 | 0.9997267308 | no independently shared flight | AUTO_DEFER |
| Sergey Teteryatnikov | 1 | 915 | 0.9999028064 | none /0 | 0.9999028064 | no independently shared flight | AUTO_DEFER |

The roster retains Dubrov's role disagreement and Kutryk's agency disagreement as attributed source conflicts; neither establishes a different human. Caption/resource qualifications and pair-level corroboration are distinct: Kutryk/Teteryatnikov have real personal Crew-13 captions but the actual retained LL2 observations do not contain full detailed flight arrays. Therefore the research five-match guidance becomes **three actual matches/four defers**, without changing coefficients or importing missing research evidence. Luke/Watkins/Menon match independently from retained biography facts; their probabilities are lower than the research enriched flight cases for the same reason.

NASA people129838/88101/40775 also independently match710/582/713. Their personal topics remain deferred source resources; an about-person website relationship alone is not a human-equality certificate. Operational source occurrences retain name-only evidence and defer. All24 NASA resource/slot/subject evaluations are recorded in the JSON dossier, along with eleven retained LL2 identities. The materialized graph contains29 components, including unresolved mentions/resources, and six MATCH edges representing three independently associated humans. Eighteen evaluated source identities defer; no real AUTO_SEPARATE or hard personal contradiction is currently observed.

Fedyaev's actual NASA occurrence retrieves732 and scores **0.9842272118722014 → AUTO_DEFER**, with no retained qualified Crew-12 witness. His production state is unchanged. Separately, the captured research Crew-12 fixture scores **0.9995768387125438**, runner886 probability0.0005193666385766567, margin0.9990574721 and passes automatic policy/component checks. The richer Crew-6/selection reference also matches at0.9999501312. These are offline source fixtures, not evidence inserted into production. Jessica Meir remains distinct from Watkins; Watkins's competing Meir probability is0.0024402826, far below the margin boundary.

## Persistence and correction

V9 adds twelve tables: immutable releases, typed identities, source-fact observations, candidate pairs, feature snapshots, decision revisions/proof dependencies, graph revisions/applications; mutable input heads, jobs and sweep lease. Model/policy/schema/SHA references and evidence dependencies use restrictive FKs. Candidate endpoints are typed NASA/LL2 and cannot self-match; pairs are unique. Revision roots/successors/predecessors, actor/method/enums, threshold/margin and ownership are checked. Serialized snapshot bytes are retained, SHA-256 is checked in PostgreSQL, and parsed JSON must agree with those bytes. Semantic histories reject UPDATE/DELETE; no cascading historical deletion is introduced. Indexes cover due jobs, latest source decisions and unique pair/release/version lookups.

DEFER→MATCH→revoked/deferred→MATCH tests append four linked revisions, reuse semantic A after A→B→A, preserve all raw inputs and reject stale/wrong predecessors. A clearly labelled indistinguishable-homonym fixture intentionally models an erroneous MATCH: eleven distinct test humans become ten components; a subsequent qualified contradiction appends AUTO_SEPARATE and restores eleven. Negative evidence can later be corrected back to MATCH. An indistinguishable synthetic homonym still illustrates unavoidable uncertainty when all published observations are identical; it is not hidden in corpus accuracy.

## Jobs, order and restart

Source INSERT notifications transactionally coalesce IMPORT work. The importer uses bounded set queries and enqueues changed identities, blocked LL2 counterparts, prior candidates and affected graph components. Worker claims use SKIP LOCKED, token leases and generations; new work during a lease is preserved. Duplicate evidence/work is idempotent. Expired worker leases can be reclaimed after restart, and stale tokens cannot finish another worker's job. Concurrent evaluators create one logical revision/application. Deferred retries2h/6h/24h/7d are independent of failures; failures back off15m→2h, park after8, remain observable, and reactivate on new evidence. A daily safety sweep handles missed notifications and release changes without per-minute rescoring of an unchanged catalogue.

Testcontainers exercises fresh V9, V8 upgrades, eight provider/order/restart/duplicate scenarios, six captured NASA/LL2 source orders including interleaved resource arrival, actual V8 about-person guards, queue generations/concurrency and model failure. Reviewed bindings/equivalences remain zero in cold starts. One thousand graph permutations/duplicates preserve final membership/representatives. Fresh-process local reruns produce no additional decision revisions for unchanged inputs.

## Health, comparison and performance

Read-only internal health exposes model/SHA validity, latest successful work, pending/oldest/retry/failed queue, match/separate/defer/conflict/revision counters, component/unbound gauges and high-risk matches. High-cardinality pair/release/witness/conflict/revision context goes into logs, without biographies. None of this changes NASA/LL2 source health. The diagnostic comparison classifies AGREES, SHADOW_MATCH_PRODUCTION_DEFERRED, SHADOW_DEFER_PRODUCTION_MATCHED, DISAGREES or NO_PRODUCTION_REFERENCE after computation. Agreement with two reviewed cases is a diagnostic, not training or accuracy certification.

Measured retained-evidence import uses7 SELECT queries for the current source scope. Candidate generation and extraction use one batched input query, no per-candidate SELECT and zero provider calls. Unchanged evaluation uses5 SELECT queries independent of1/2 candidates; insert attempts are bounded audit/pair work, not read-time N+1. The fresh-process benchmark for24 NASA identities reports per-identity latency, candidates and total statements in the JSON dossier: seven slots94.93ms, all24 identities228.82ms, median8.32ms. Initial21 evaluations/22 jobs took610.14ms (34.4 evaluations/s); this is a local measurement, not a deployment SLA. Initial cold worker materializes all decisions; unchanged queue refresh/restart appends none. Tests/performance use the actual PostgreSQL database, not mocked query counts.

## Public freeze, validation and rollout

Public Current remains10 members/7 structured assignments/one unresolved Fedyaev; officialAboard remains null and retained last-known11. Reviewed Luke/Watkins aliases/detail URLs retain canonical IDs and fields. Public Replay at2026-10-02T02:01:55Z remains10 members/one unresolved, without future assignment/Expedition. No automatic result or editorial roster drives public identity, presence, count or Replay. Source files for public APIs/Replay, NASA RSS grammar, frontend and V1–V8 migrations remain byte-identical.

Actual Current/detail/alias/Replay GETs fingerprint all62 tables before/after and show no identity/queue/source writes. All original Crew/history tables and V1–V8 Flyway rows are preserved across local shadow execution. Existing orbital browser QA revalidated mutable OEM retrieval metadata, and the original normal CelesTrak scheduler appended one acquisition observation (30→31). All30 original acquisition rows and the five stored XML/SHA payloads are preserved. The final stable Java21 jar matches a fresh unmodified-baseline JVM within the strict1e-7SI/1e-10degree orbital tolerance; all49 orbital class files are byte-identical. Earlier temporary jars replaced during builds were discarded and the HTTP audit was repeated on a stable copy. Request-clock exceptions are recorded separately from Crew identity freeze.

Java21 baseline594 → final823 tests; `mvn test` and `mvn verify` pass with zero failures/errors/skips. The initial system-Maven baseline used Java27; the original commit was independently archived and re-run on Java21, confirming594. Node24 frontend remains759 tests/61files; typecheck, production build and diff checks pass. Development/production Current/detail/Historical and Inspection enter/back are checked at1440×900,1024×768,768×1024,390×844,320×568, with keyboard/touch/resize flows and zero console/page errors. Temporary QA services are removed after acceptance; original services remain.

Production activation is **not approved/met**. Targets remain false merges≤0.5%, persistent evidence-eligible splits≤10% after7days and eligible positive-link coverage≥90%; this selected/silver research corpus and current three-human shadow associations do not certify them. Require independent candidate cohorts and confidence bounds, agency/script/source coverage, turnover/failures/restarts, hard negatives/correction, Current lifecycle, UUID/Replay rollback and explicit activation contract. Confidence, reviewed agreement and absence of observed current conflicts are not measured deployment precision.

## Reproduce

Use Java21 and Node24 explicitly. All normal tests are offline; PostgreSQL uses Testcontainers. Run backend `mvn test` then `mvn verify`, frontend tests/typecheck/build and `git diff --check`.

For the explicit local shadow-only writer, generate a Maven dependency classpath, then run `scripts/AutomaticShadowValidation.java` with `target/classes` and those dependencies on the Java classpath and an absolute output path. It disables all source schedules, review/backfill startup writers and automatic scheduling; it reads retained evidence, runs bounded shadow jobs, benchmarks evaluations and produces health/comparison output. It acquires no external evidence and promotes no production identity. The normal application worker is enabled by default after15minutes; set `mission1.crew.automatic-shadow.enabled=false` to pause it. No routine maintainer approval, manual per-person mapping or production promotion flag is part of this shadow resolver.

## Downstream lifecycle consumer — ADR-0016 / V10

The [active membership overlay](../active-membership-shadow-validation/README.md) reads a pinned V9 graph application without scoring or modifying it. Exact source table/reference/hash and current compatible source head are required for AUTO_MATCH support; AUTO_DEFER, AUTO_SEPARATE, missing associations and withdrawn/changed matches remain explicit slots. Typed LL2 humans require no NASA match. Graph changes trigger a new independent lifecycle revision. The V7 comparison is diagnostic after materialization and never feeds the automatic policy. V9 production activation, public Current and Replay remain deferred.
