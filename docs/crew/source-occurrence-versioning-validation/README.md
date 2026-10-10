# Crew source occurrence versioning — validation, 2026-10-10

Implementation on `main`, starting at `5647e44fe28c2ce806dde6cac2a7d7e4ce1f3b6f`. The source investigation is the specification: its retained-data simulation found five immutable evidence versions, four assertion candidates, eleven subject occurrences and twelve subject payload versions. Full source archives remain outside Git at `/Users/daniel/.codex/exports/mission1-crew-source-investigation/`. This dossier records the implemented result; [ADR-0012](../../adr/0012-versioned-crew-source-occurrences.md) records the decision.

## Identity and compatibility

| Concept | Meaning |
| --- | --- |
| Raw document/body | Existing capture/document identity and exact raw-body hash; neither is an assertion identity. |
| Article | Verified RSS GUID resource key, e.g. `nasa.gov:wp:nasa-blog:1052022`; literal GUID, raw link and observed URL are retained separately. |
| Assertion occurrence | The same typed source claim across compatible revisions of a uniquely located paragraph. |
| Subject occurrence | A source mention within that assertion, independent of canonical human identity. |
| Evidence/metadata version | Existing immutable evidence and subject rows, with additive membership and own metadata payload links. |
| Canonical person | Existing MISSION1 UUID and independently supported external-ID/profile mappings; occurrence membership never establishes it. |

The candidate uses the investigation's exact canonical JSON SHA-256 over provider, stable article, station, assertion type/classification, explicit-event or publication-fallback context, and complete source scope. Normalization is NFC plus Unicode whitespace only, preserving spelling, script, case and punctuation. Compatibility additionally requires unique scope per associated document, ordered exact source mentions, count, completeness, source category, publication/event context and identical supported parser/method semantics. Subject keys use the assertion key, exact source mention and local same-name ordinal; `(evidence_id, subject_index)` remains the version locator.

No fuzzy prose/person matching, global name grouping or public DTO `distinct()` is used. Conflicting provider IDs or unequal non-null profile references stay separate; null metadata cannot bridge conflicting keys. Changed scope, order, event time, article, assertion type or parser semantics stays separate. Unsupported legacy scope/identity is isolated. No production special cases reference the known evidence IDs, names or article number. Normal ingestion extracts identity from already fetched RSS with no extra HTTP request.

## Additive schema and write boundary

Flyway `V6__crew_source_occurrences.sql` adds:

- `crew_source_article`, `crew_source_article_observation`: stable identity and raw/observed article representation lineage.
- `crew_assertion_occurrence`, `crew_assertion_version`, `crew_assertion_observation`: immutable claim membership and validated document/paragraph scope.
- `crew_subject_occurrence`, `crew_subject_metadata_version`, `crew_subject_version_link`: mention identity, immutable own metadata and original subject lineage.

Primary/unique keys prevent contradictory evidence or subject membership. Composite foreign keys constrain links to the same article, assertion, evidence/document, subject and metadata version. Restrictive foreign keys and UPDATE/DELETE rejection triggers preserve history. There is no name uniqueness constraint. Inserts are idempotent. Indexes cover article observations, candidate guards, assertion versions/scopes, subject/metadata lineage and successful capture ordering.

The supported startup backfill runs after Flyway and singleton initialization, **before Tomcat starts accepting HTTP requests**. Successful NASA ingestion completes the run and maintains associations in the existing transaction under the source advisory lock. Backfill has its own explicit transaction; GET never invokes it or parses source XML. The V5-compatible `DRY_RUN` is read-only; modes and commands are in the [backend README](../../../backend/README.md). `OFF` skips startup writes and leaves unknown versions independent until a supported backfill.

The Current/Replay selection query obtains memberships and successful capture lineage in one set-based join; existing evidence/subjects are batch reads, with no per-astronaut query. Read-only real-data `EXPLAIN (ANALYZE, BUFFERS)` returned in 0.198 ms on this five-version dataset. Small-table sequential/hash scans are reasonable here; the new join/order indexes exist. This is a sanity check, not a load benchmark.

## Backfill and immutable-history audit

PostgreSQL/Testcontainers migration, fixture backfill, ambiguous-case, constraint and rollback checks passed before real migration. A read-only connection with Flyway disabled previewed the retained V5 database before mutation; V6/application backfill then applied the same result. Restart reproduced it:

| Quantity | Dry run / applied / restart |
| --- | ---: |
| Evidence versions | 5 |
| Assertion occurrences | 4 |
| Subject occurrences | 11 |
| Subject metadata versions | 12 |
| Multi-version assertion occurrences | 1 |
| Conflicting / ambiguous / unassociated versions | 0 / 0 / 0 |

Current selected evidence IDs are `1, 2, 3, 12`; these are reported results, not ordering semantics. Row-by-row snapshots before/after migration, downgrade check and final restart preserve all **5 evidence rows, 18 original subject rows, 16 evidence/document links and 20 identity-resolution rows**. Evidence 4 still links to documents 1/2; evidence 12 still links to documents 17/25. No source modification timestamp or new person mapping was invented.

The baseline application (latest migration V5) was built separately and started successfully against V6 with a read-only connection and sources disabled. Flyway emitted its expected newer-schema warning. No tables/history were reversed. Downgrading restores the previous duplicate interpretation; it does not delete the additive lineage.

## Known Fedyaev case

| Retained evidence | Unchanged evidence SHA-256 |
| --- | --- |
| 4 | `b7c92446ed126b53d52b37dccdcf16ada88b89c16552caefb71a6fab6f7b77cf` |
| 12 | `2e66ce03f3a9b2e00b0ed1b11086de2e633dad3cd696612c174f9af67026c4a8` |

Both evidence versions belong to assertion `d1b2541cc18ae3a8bc41e9f10ba4b8925202e31ecdc8514ae57d76ccbcd0808b`. Both subject-6 locators belong to source mention `96907d0d3747443d9308c09c7ad860c49d4fddfa72df03015ccae7f42bb3187e`, with the same own metadata version `0d72f3696bb4fc94dac61b0f931fca7c5d677adfca5f49bb204cbccfd597de5d`. Jessica Meir's differing metadata versions remain separately stored.

Evidence **12** wins by latest successful observation: run **64**, document **25**, HTTP **304**, retrieved `2026-10-07T11:28:43.755959Z`, completed `2026-10-07T11:28:43.755972Z`, started `2026-10-07T11:28:43.561517Z`. Its selection does not resolve NASA **Andrey Fedyaev** to LL2 **732 / Andrei Fedyaev**.

## Shared selector and API results

`CrewCompatibleVersionSelector` is pure and deterministic. Within each durable compatible occurrence, it orders successful observations by retrieval time, then completion time, then start time. Repeated 200/304 observations and A→B→A body reuse participate. Run/document IDs only choose a deterministic lineage representative at equal source order; they never break a tie between competing source meanings. Equal-order conflicting interpretations or missing successful lineage remain independently represented. Unsupported/isolated versions remain separate. No older non-null field is carried into the newer selected representation.

Current selection precedes identity resolution and reconciliation. Replay and Replay coverage share that selector before existing effective-time evaluation. Replay remains `EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION`: a compatible representation acquired after T can participate at T. Arrival, aboard, departure and other distinct scopes stay distinct. No Current fallback or knowledge-as-of-T filter is added. The algorithm marker is `crew-reconciliation-v2`; freshness rules remain `crew-freshness-v1`.

Actual retained local responses, not fixture-only results:

| Interpretation | Current | Replay at `2026-10-02T02:01:55Z` |
| --- | ---: | ---: |
| Fedyaev unresolved rows | 1 | 1 |
| Fedyaev resolution | UNRESOLVED | UNRESOLVED |
| Fedyaev applicable | false (retained) | true |
| `officialAboard` | null | null |
| `lastKnownOfficialAboard` | 11 | null |
| `resolvedAboard` | 0 | 10 |
| `unresolvedSubjects` | 1 | 1 |
| `unidentifiedAboard` | 11 | 0 |
| `structuredAssignments` | 7 | null |

The duplicate disappears without promoting stale retained assertions to Current presence. Reported-count applicability, retained count, resolved presence and structured assignments retain their existing meanings. `unresolvedSubjects` counts selected unresolved source occurrences, including retained non-applicable entries; it is neither a raw-version count nor a unique-human count. Public fields/routes and frontend bytes are unchanged.

Repeated `/api/iss/crew`, `/api/iss/replay?at=2026-10-02T02:01:55Z` and `/api/iss/replay/coverage` returned 200. Across these isolated GETs, row counts and content digests of **all 38 public tables** remained equal. PostgreSQL API tests also verify SELECT/read-only/repeatable-read behavior and zero source calls. Source schedulers were temporarily disabled during validation; committed defaults are unchanged. Exact REST excerpts and the final compact QA record are in [results.json](results.json).

## Verification

| Gate | Actual result |
| --- | --- |
| Pre-change backend, Java 21 | 382 tests passed |
| Final `mvn test`, Java 21 | 415 tests; zero failure/error/skip |
| Final `mvn verify`, Java 21 | 415 tests; BUILD SUCCESS |
| Pre-change and final frontend, Node 24 | 759 tests / 61 files passed |
| Frontend typecheck and production build | PASS; existing Cesium chunk-size warning |
| Current/Historical browser QA | Development and production, 1440×900 / 768×1024 / 390×844: 12 flows PASS |
| Frontend and original V1–V5 migration hashes | All 193 tracked files byte-identical to baseline |
| `git diff --check` | PASS |

Thirty-three additional backend cases cover the source reader/planner/selector (20), PostgreSQL occurrence persistence (10), and Current/Replay API regressions (3). Adversarial cases include exact re-fetch, wrapper edit, metadata addition/removal/change, order/article/scope/time/type/parser changes, conflicting keys, null bridging, Latin/Cyrillic and Andrey/Andrei, acquisition ties, reversed input, reuse and restart. Existing same-name distinct-person, exact-version idempotency, source failures, assignment/presence, planned/completed, partial-omission, freshness/refresh and replay contracts remain intact. Only existing schema-count expectations changed.

Browser QA uses real local API responses without source interception or injected facts. Every size confirms one unresolved Fedyaev entry, disclosure/detail/close behavior, one workspace, no horizontal overflow, zero page/console errors and zero NASA/LL2 acquisition requests. Desktop Current and mobile Historical captures were visually inspected. No visual layout code changed. Chromium/Metal emulation does not certify physical mobile Safari/Android.

## Limits and reproducibility

Exact-scope policy intentionally under-merges editorial prose/order corrections. Unknown GUID/scope, duplicate matching paragraphs, incompatible parser semantics and strong-key conflicts are preserved independently. The v1 policy only admits the verified `NasaOperationalFeedParser/1.0.0` and `NasaOperationalPostParser/1.0.0` interpretation. No profile crawler/enrichment or public audit endpoint was added. Alternative evidence remains queryable internally for audit and future knowledge-time replay.

Test fixtures are small recorded-source projections with a provenance manifest; the wrapper variation is explicitly TEST_ONLY. They are never production fallback data. Full logs, raw API captures, database snapshots, query plan, reusable browser/API runners and screenshots remain outside Git at `/Users/daniel/.codex/exports/mission1-crew-source-occurrences/`. External project context is `/Users/daniel/Desktop/mission1-project.md`; it records the final commit/push and remains outside Git.
