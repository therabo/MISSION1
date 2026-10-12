# Final Crew production architecture acceptance — 2026-10-12

**Accepted scope:** S10 production operational binding and unified V10 Current / Historical lifecycle. Canonical checkout `/Users/daniel/Desktop/MISSION1`, direct `main`, baseline `91664c4111c2c9208ed71609390f6907e484fa64`. One ordinary child commit and normal SSH push close this milestone; final Git identity/equality evidence is stored outside Git in `mission1-final-crew/git-final.json` to avoid a self-referential commit hash.

[ADR-0021](../../adr/0021-production-operational-binding-and-unified-crew-replay.md) records the decision. Complete raw HTTP responses, SQL, immutable-row fingerprints, logs, screenshots, isolated test copies and original failed attempts remain in `/Users/daniel/.codex/exports/mission1-final-crew/`; [external evidence manifest](external-evidence-manifest.json) records retained log fingerprints. Compact auditable results and opt-in reproduction runners are tracked here. No new runtime dependencies, distributed infrastructure or per-timestamp Replay cache were added.

## Authority and production boundary

| Component | Authority |
|---|---|
| V7 | Existing canonical humans, reviewed typed identity correspondences, canonical equivalence, aliases and profiles |
| V8 | Editorial and person-resource acquisition, retained versions and verified resource relations |
| V9 | General identity research **SHADOW**, excluded from normal S10/V10 publication and Historical identity |
| S10 | Exact operational evidence/subject/version → an existing publishable V7 human, automatically consumed when qualified |
| V10 | Shared pure lifecycle: positive supports, omission by source, persistent completed-departure veto and strictly later qualified operational reentry |
| Current | Committed V10 ACTIVE members published through V7; operational confirmation is secondary and independently fresh/stale/unverified |
| Historical | The same V10 policy at effective UTC T with V7/S10 knowledge known today; latest canonical biography remains separately attributed |

Default binding mode is `S10_SCOPED_BINDING`; default Replay mode is `UNIFIED_V10_S10`. There is no canary cohort or per-match approval. S10 cannot create a human, alias, equivalence or canonical field; no runtime AI is involved. Name, probability and an arbitrary link each remain insufficient. Public REST exposes no resolver scores; frontend uses only MISSION1 REST.

[Production release](production-release.json): `s10-scoped-production-v1`, model SHA `469c31402cdd89ae1bc956cdcabdc57e00088b967806d322bdfbfca8d9896792`, existing frozen `crew-auto-identity-v1-shadow` scorer, schema `s10-research13-qualified-signals-v1`, authority `s10-research-authority-matrix-v1`, ICU4J 78.3 / `s10-nfkc-casefold-icu78.3-v1`, resource parser `s10-official-resources-v1`. Observation/arrival threshold ≥0.991, completed departure ≥0.999, margin ≥0.20. Complete candidates, qualified person-specific witness, temporal validity and absence of contradiction remain mandatory. Proof validity is thirty days at knowledge time, with capture/hash/resource/locator lineage.

One batched, read-only consumer selects the newest subject head **before** release/outcome validation. New DEFER, CONFLICT, incompatible or SUPERSEDED prevents resurrection of an earlier MATCH. It validates exact source hashes, release bytes, sealed evaluation and normalized candidate/proof coherence without recomputing features/scores. With no S10 decision, fallback requires an independently explicit current V7 AUTHORITATIVE_MAPPING or exact source EXTERNAL_ID correspondence. Legacy name or raw URL resolution cannot qualify. A strong V7 target disagreeing with S10 fails closed. Producer and consumer both require the same retained provider → canonical route. Unknown/unpublished humans stay unresolved.

## Real retained results

[All 25 real source subjects](real-subject-results.csv) retain exact subject keys, versions, source/document hashes, effective times, canonical targets, production revisions and knowledge timestamps. Latest production revisions **126–150**, known at **2026-10-11T22:04:08.277929Z**, are **25 AUTO_MATCH / 0 unresolved / 0 conflict**. Eleven existing V7 humans are referenced; no canonical rows/aliases/merges are created. Finite retained positive results are acceptance evidence, not a statistical operational-precision estimate.

| Evidence | Source subjects | Outcome and role |
|---|---:|---|
| 2 | Watkins, Delaney, Joshua Kutryk, Teteryatnikov | Four completed entry supports; Oct2 publication-time proxy |
| 12 | Meir, Hathaway, Menon, Adenot, Dubrov, Kikina, Andrey Fedyaev | Seven retained observed subjects |
| 21 / 27 | Meir, Hathaway, Adenot, Andrey Fedyaev in each source article | Eight bindings of one physical completed departure; four persistent human vetoes |
| 58 | Anil Menon | Oct6 activity observation; independent of Anna Kikina |
| 59 | Watkins, Delaney, **Josh Kutryk**, Teteryatnikov | Four Oct5 activity observations, parser1.2.0 |
| 64 | Delaney | Oct9 activity observation, parser1.2.0 |

The six parser1.2.0 activity subjects are evidence58:0,59:0–3,64:0. **Menon** gets Oct6 17:57:55Z evidence58/binding145; Anna has no Oct6 support. **Josh**59:2 binds existing Joshua/binding148 through scoped agency/person-flight witness; no global Josh alias. **Andrey**12:6/21:3/27:3 binds retained canonical Andrei Fedyaev via qualified person/flight/mission lineage, including departures; no global transliteration alias or V7 merge.

Completed **2026-10-07T12:05:00Z** departure bindings: Meir137/141, Hathaway138/142, Adenot139/143, Fedyaev140/144. V10 records four human vetoes with both source-article lineages; duplicate assertions do not double-remove a human. Unresolved departure cannot close a named human's episode.

## Actual Current and ordinary source refresh

Initial automatic production projection23 had seven ACTIVE, four RETAINED, 25 normalized operational bindings, four departure vetoes and four unresolved ACTIVE **editorial source slots**. Those slots were not unresolved operational subjects or extra humans. The 13-profile, V7/V8/V9 and alias activation freeze passed before later ordinary acquisition.

The usage-limit pause aged retained captures naturally. Current kept its sealed membership while annotations became stale; no timestamp was relabeled as fresh. After the GET freeze, normal schedulers successfully acquired **LL2 run149 / snapshot67 at 2026-10-12T09:05:25.784731Z** and **NASA run150 at 09:10:26.214470Z**. NASA reused document120's original Oct9 capture and added zero source documents/evidence; the new run records genuine revalidation. LL2 appended seven legitimate profile/assignment observations without rewriting earlier records. These source additions are explicitly separate from S10's identity/profile freeze. [Boundary record](source-freeze-boundary.json), [C final review](reviews/C.md).

Automatic refreshed production24, rollback25, restored production**26** are sealed additive revisions. Final restored26: **seven ACTIVE, four RETAINED, 25 bindings, four departure vetoes, zero unresolved ACTIVE source slots**, health DEGRADED. Stale editorial inputs and source contradictions remain visible diagnostics; seven is derived from supports/vetoes and V7, never hardcoded.

Actual seven: **Anna Kikina, Anil Menon, Pyotr Dubrov, Jessica Watkins, Luke Delaney, Joshua Kutryk, Sergey Teteryatnikov**. All seven have selected structured Expedition75 assignments at the final source cut. Production policy:

`crew-active-production-v1/crew-freshness-v2:PT6H:PT6H:PT168H:PT336H/count=PT72H/roster=PT6H/topic=PT6H/personal=PT168H`.

[Per-human observations](current-observations.csv) preserve the selected source URL, original effective time and S10 revision:

| Human | Latest operational UTC | Evidence / binding | Confirmation at restored26 cut |
|---|---|---|---|
| Anna Kikina | 2026-10-02T02:01:55Z | 12:5 /135 | STALE |
| Anil Menon | 2026-10-06T17:57:55Z | 58:0 /145 | CONFIRMED_ABOARD |
| Pyotr Dubrov | 2026-10-02T02:01:55Z | 12:4 /134 | STALE |
| Jessica Watkins | 2026-10-05T17:18:04Z | 59:0 /146 | CONFIRMED_ABOARD |
| Luke Delaney | 2026-10-09T16:35:40Z | 64:0 /150 | CONFIRMED_ABOARD |
| Joshua Kutryk | 2026-10-05T17:18:04Z | 59:2 /148 | CONFIRMED_ABOARD |
| Sergey Teteryatnikov | 2026-10-05T17:18:04Z | 59:3 /149 | CONFIRMED_ABOARD |

Confirmation age remains relative to the evaluation instant; this table is a dated acceptance cut. These are public operational statements, not physical onboard telemetry.

## Historical effective time and knowledge time

Normal Replay no longer uses the legacy retained-union reconstruction. `UnifiedCrewReplay` explicitly loads HISTORICAL context and invokes the same pure `ActiveMembershipPolicy` as Current. No latest Current roster is consulted. V7 publication and S10 heads/proofs use knowledge known today; operational effective times must be ≤T. A later qualified binding may improve an older event's best-current interpretation without pretending the binding existed earlier.

Structured data must have been successfully committed by knowledge time and actually captured at/beforeT. Capture may precede acquisition completion, which is a knowledge boundary. Editorial capture begins at the original successful acquisition completion. CMS publication, expedition start and present-day roster cannot backdate membership. Latest canonical biography/career stay explicitly separate from lifecycle/assignment/operational context atT. Original source capture and S10 knownAt remain retained and auditable.

Historical OBSERVED is seven days inclusive at T, ENTRY transfer implication fourteen days inclusive, count72h inclusive. +1ns is stale. Departure veto persists after confirmation expiry until a strictly later qualified reentry. Equal-time positive/departure fails closed. Future observations, arrival, departure and reentry cannot affect earlier reconstruction. Failed acquisition does not imply an omission/departure; last-good positive support remains eligible in its original window, while Current collection failure separately degrades confirmation. Historical effective eligibility does not depend on today's collection failure.

Historical REST retains existing `PARTIAL_MATCH` and unresolved enums and adds optional `membership.mode=HISTORICAL_V10_S10`, evaluatedAt=T, policy/health/cardinalities, revision0/age0 sentinels for an **unpersisted** evaluation. No arbitrary-T rows are written. Editorial-only positive support contributes to coverage.

## Exact real UTC cuts and differential

[All 21 cuts in CSV](real-historical-timeline.csv) and [per-human assignments/annotations/departure lineage in JSON](real-historical-timeline.json) were repeated by the primary against the final packaged runtime. Eleven-person overlap set: Andrei Fedyaev, Anil Menon, Anna Kikina, Jack Hathaway, Jessica Meir, Jessica Watkins, Joshua Kutryk, Luke Delaney, Pyotr Dubrov, Sergey Teteryatnikov, Sophie Adenot. Successor set is the seven Current names above.

The real retained timeline proves **UNAVAILABLE→11→7**, not a fabricated pre-entry seven. Entry effective Oct2 02:01:55Z is the retained publication-time proxy, not a newly asserted physical event epoch. Real sources cannot establish the earlier seven-member roster. Synthetic labelled tests independently establish the required full7→11→7.

| UTC T | Membership | Structured assignments | Departure subjects |
|---|---:|---:|---:|
| 2026-10-02T02:01:54.999999999Z | UNAVAILABLE | 0 | 0 |
| 2026-10-02T02:01:55Z | 11 | 0 | 0 |
| 2026-10-03T10:30:18.796288999Z | 11 | 0 | 0 |
| 2026-10-03T10:30:18.796289Z | 11 | 7 | 0 |
| 2026-10-03T10:30:18.856620Z | 11 | 7 | 0 |
| 2026-10-03T12:04:00Z | 11 | 7 | 0 |
| 2026-10-05T17:18:03.999999999Z | 11 | 7 | 0 |
| 2026-10-05T17:18:04Z | 11 | 7 | 0 |
| 2026-10-06T17:57:54.999999999Z | 11 | 0 | 0 |
| 2026-10-06T17:57:55Z | 11 | 0 | 0 |
| 2026-10-07T12:04:59.999999999Z | 11 | 7 | 0 |
| 2026-10-07T12:05:00Z | 7 | 3 | 8 |
| 2026-10-07T12:05:00.000000001Z | 7 | 3 | 8 |
| 2026-10-08T12:00:00Z | 7 | 3 | 8 |
| 2026-10-09T02:01:54.999999999Z | 7 | 3 | 8 |
| 2026-10-09T02:01:55Z | 7 | 3 | 8 |
| 2026-10-09T02:01:55.000000001Z | 7 | 3 | 8 |
| 2026-10-09T16:35:39.999999999Z | 7 | 7 | 8 |
| 2026-10-09T16:35:40Z | 7 | 7 | 8 |
| 2026-10-10T12:00:00Z | 7 | 7 | 8 |
| 2026-10-11T22:05:07.552306Z | 7 | 7 | 8 |

[Legacy differential](legacy-modern-differential.json) explains every common-cut membership delta: Oct2 proxy10→11 adds existing canonical Fedyaev through scoped variant binding; Oct3 and immediately before departure11→11 preserve IDs; exact completed departure11→7 removes Meir/Hathaway/Adenot/Fedyaev; Oct10 legacy10→modern7 removes the three outgoing humans still retained by the legacy engine. Before entry both are UNAVAILABLE. Operational changes reflect seven-day policy and qualified scoped evidence, including Menon's Oct6 observation. No unexplained orbital semantic change occurred; B's finite frame/cache numerical variation stayed within existing tolerances.

At sealed23 effective UTC **2026-10-11T22:05:07.552306Z**, Current and Historical had the same seven canonical IDs and identical complete per-human presence (five confirmed/two stale). Primary's refreshed-source current-time comparison also reports equal names, assignments and presence. Both tests validate the shared policy at one common effective instant rather than comparing differently aged clocks.

## Production-path tests and browser

Baseline Java21 `mvn test` / `mvn verify`: **1095**, no failures/errors/skips. Final: **1163** in both, including **56 production-consumer cases** and **12 production PostgreSQL lifecycle cases**. Original V9/legacy-engine fixtures explicitly select rollback modes, preserving their original expectations. Required migrations/API boundaries remain exercised. Baseline Node24 **786/65 files** → final **791/66 files**, full tests, typecheck and production build PASS. The existing large Cesium chunk warning remains; no frontend dependency/lockfile changed.

Tests cover7→11→7 in Current and Historical using identical events; named visitors with no LL2 assignment, unknown visitor unresolved, unresolved departure not applying veto, later reentry, exact7d/14d boundaries, capture-before-completion, equal historical/current clocks, editorial-only coverage, HTTP500/malformed/failure preservation, MATCHA→CONFLICT→MATCHB correction, and restart/idempotency. Normal source/person mappings are built through `CrewIngestionService`; source SQL seeding is not used in the new lifecycle cases. TEST_ONLY official captured resource shapes have explicitly rebased flight windows and fixture clocks; they are not real handover/cadence evidence.

[Scheduled browser acceptance](scheduled-browser-acceptance.json) is the primary's separate canonical JUnit run: **nine phases PASS**, actual automatic scheduler acquisition→parser→resource acquisition→S10→V10→real HTTP→production frontend. Current7→11→7 uses the real120-second refresh hook accelerated by Playwright's clock; selected departing Watkins clears to the Crew heading. Same-event exact Historical HTTP7/11/7 and native±10min Historical UI7/11/7 pass. No manual test-stage invocation occurs in this scenario, and no Crew DTO is substituted. The Crew-only isolated fixture has no orbital history; calendar remains honestly disabled and expected orbital503 is recorded separately. Real orbital/calendar acceptance is covered by the actual-data browser matrices.

Development and production browser matrices cover **1440×900,1024×768,768×1024,390×844,320×568**, Current/History/profile selection, real11→7 handover/calendar±10min, return to Current, paused Historical polling, all stated UTC cuts, resize, ≤716/717 container boundary, touch/reduced motion, screenshots and visual lint. Scene matrix includes104 captured states across both builds: OEM/GP source continuity, Inspection enter/back, actual selected module, native Cesium wheel/reset, roster/details/History ownership. GP/TLE supplement covers ten more build/viewport Inspection cases. Explicit TEST_ONLY HTTP refresh fixtures separately check production120s polling,7→11→7 selection retain/clear and Historical pause across both builds; fixture results never establish real database membership. Page/JS-console/provider requests are zero in the actual matrices. This is desktop headless Chromium emulation, not physical-device certification.

The primary repeated the scheduler/browser test, GET instrumentation, real temporal reconstruction/pure20-case audit and final full suites; subagent PASS alone was not treated as acceptance. Original failed attempts are retained: first backend legacy-fixture/config failures were repaired, public Replay enum incompatibility was fixed, UI harness selectors respected calendar availability, and a frontend run under simultaneous heavy Java/browser load timed out. A complete isolated frontend rerun passed791; no failing run is counted as success. No known semantic blocker remains.

## Read-only boundary and measured cost

[Primary GET audit](get-audit.json): **148 measured GETs +30 warmups**, 80 table fingerprints unchanged; every prepared SQL SELECT-only and every observed GET connection read-only. Current, all13 current/retained/alias details, Historical roster/embedded details,21 cuts, repeated±10min seeks and coverage: writes0, external HTTP0, source acquisition0, S10 scoring/evaluation0, V9 scoring/evaluation0, V10 materialization0. Fifteen instrumented methods plus actual Java external HTTP are zero. No GET repair/enqueue path was added.

[Performance](performance.json), warm local measurements in milliseconds, no hardware-independent SLA:

| Read | Baseline median/p95 | Independent final median/p95 | Primary final median/p95 | Prepared queries final |
|---|---:|---:|---:|---|
| Current roster |44.347/53.875|136.097/243.272|78.599/86.353|52 (baseline48)|
| Current details incl aliases |27.351/30.531|93.479/129.237|59.323/64.300|52 (baseline48)|
| Historical roster + embedded detail |22.226/36.541|103.737/145.519|64.479/83.356|19/30/36 (baseline3/12/17)|
| Historical ten-minute seek |21.327/33.823|97.316/112.821|64.237/71.383|36 (baseline17)|
| Coverage |10.891/13.859|17.857/24.790|10.993/13.124|4 (baseline3)|

Independent complete25-subject S10 lookup38.005/62.090ms; primary33.373/38.036ms, **five SELECTs**, no per-person/proof queries. Separate authorized V10 timing20 times at sealed23 T:85.235/222.729ms,22 prepared statements plus advisory-lock SELECT; all returned23/inserted=false. Only mutable work bookkeeping changed after the GET freeze. Additional Current/Replay validation cost is acknowledged; bounded set-based reads avoid per-human N+1 and per-T cache.

## Database, safety and rollback

Flyway **V12** is additive; V1–V11 source bytes/checksums and prior row meaning are unchanged. `crew_active_projection_binding` retains exact subject/S10 or qualified explicit resolution target/knowledge lineage, including departure vetoes. Mode-specific guards preserve older required V9 lineage while admitting truthful S10 mode. Exact editorial V8 relation/acquisition/V7 authority pins are guarded and reader-checked. Deferred completeness and immutable/sealed children preserve atomic revisions. New `(evidence_id,subject_index,id DESC)` index supports latest-head lookup; one exact sample0.043ms. Initial25 binding children32KiB; growth is bounded per new revision, not by arbitrary replay requests. S10/V7/V8 authority inserts notify durable V10 work. Diagnostic downstream IDs are excluded from S10's semantic cut to prevent feedback churn.

[Fresh/upgrade and guards](reviews/C.md): fourteen editorial cases, four explicit-resolution cases and seven immutable/seal cases pass. Original **125 S10 /21 V10** histories and all earlier immutable Crew records remain exact after activation/rollback. V7 human/provider/alias/equivalence and V9 history remain exact. Later ordinary LL2 adds seven source profile/assignment observations; original observations survive. The unrelated orbital revalidation only changes one permitted OEM `last_retrieved_at`; all five XML byte hashes and creation/start/stop/source-last-modified times are unchanged. [Activation freeze](activation-immutability.json), [profiles13](profile-freeze.json), [V7/V9 freeze](v7-v9-freeze.json).

Identity safety: **256 wrong-human controls → zero false consumable production bindings**. Twenty-five gate cases have23 expected fail-closed cases plus two deliberate positive controls;16 link faults preserve expected fail-closed outcomes. Fifty-six consumer cases additionally corrupt newest heads, release/normalized/scalar/proof/source lineage and explicit fallback. Frozen scorer parity:275 operational scores max difference8.67e-19;14,382 model outputs3.33e-16. No threshold/model/authority weakening or policy-specific human exception was added.

[Actual rollback/restart](rollback-and-restart.json): fresh production24 Current7 / exact-departure Replay7; explicit `LEGACY_OPERATIONAL_BINDING` + Replay `LEGACY` restart automatically materialized25, Current7 / old Replay11; restored defaults automatically materialized26, Current7 / modern Replay7. Another modern restart with writers disabled immediately served committed26 and retained150 S10 revisions. No schema downgrade/history rewriting or weak automatic fallback occurs. Final ordinary packaged runtime restores normal source/S10/V10 workers; read-only validation overrides are temporary. Across the subsequent usage-limit pause, these normal workers remained active: source runs151/152 revalidated the same LL2 snapshot67/NASA document120, editorial acquisition appended real captures and V9 appended ordinary **SHADOW** decisions without changing authority. S10 repeatedly accepted25 and appended zero duplicate binding revisions. The dated final normal-state check at **2026-10-12T11:12:05.748628Z** sees production revision**29**, seven ACTIVE/four RETAINED,25 binding children/four departure vetoes, four unresolved ACTIVE editorial slots and DEGRADED health. This ordinary post-restoration activity follows the controlled freeze/rollback26 audit; prior immutable rows remain exact. [Normal state](normal-restoration-state.json), [runtime flags/cleanup](runtime-restoration.json).

## Independent final reviews

| Agent | Scope, principal findings and evidence | Final |
|---|---|---|
| [A activation](reviews/A.md) | Resolved editorial authority gap, normalized consumer integrity, fallback checks and feedback loop; traced final architecture/precedence |PASS|
| [B Historical](reviews/B.md) |21 real cuts,20 pure cases, legacy differential; repaired context/capture/coverage/public enum/lastKnown behavior |PASS|
| [C database](reviews/C.md) |25 guards/seals, fresh/upgrade, actual old-row/authority checksums and additive rollback/source audit |PASS|
| [D identity safety](reviews/D.md) |131 scoped tests incl56consumer,256wrong/25gate/16link, two model parity cohorts; producer/consumer route coherence |PASS|
| [E lifecycle](reviews/E.md) |12 PostgreSQL cases and9-phase actual scheduler/HTTP/browser Current+History7→11→7 |PASS|
| [F frontend](reviews/F.md) |Both builds/five viewports/real timeline/refresh/scene Inspection/native camera/visual accessibility checks |PASS|
| [G GET/performance](reviews/G.md) |148GET+30warmup,80-table freeze,15 methods/external HTTP0,13 profiles, five-query lookup and separate idempotent timing |PASS|
| [H bootstrap](reviews/H.md) |Recorded eight future-only risks; no empty-database production bootstrap performed |PASS scoped risk review|

Canonical edits remained primary-only. Agents used read-only review and external isolated tests/patches; findings were explicitly integrated and rechecked. Full agent reports are retained above, including original constraints and dated audit windows. [Final validation summary](validation-summary.json) pins completed primary suite logs; [primary browser summary](primary-browser-summary.json) records the independent final reruns.

## Reproduction and next milestone

From the repository, with Java21 / Node24 and Docker available:

```sh
cd backend
mvn test
mvn verify
cd ../frontend
npm test
npm run typecheck
npm run build
```

The tracked `OperationalProductionBindingsTest` and `UnifiedCrewLifecyclePostgresTest` include meaningful binding corruption and lifecycle boundary coverage. For the continuous browser scenario, run the existing development UI, then set `MISSION1_BROWSER_E2E=true`, `MISSION1_BROWSER_E2E_SCRIPT` to this dossier's absolute `scripts/browser-scheduler-e2e.cjs`, `MISSION1_BROWSER_E2E_FRONTEND_URL` to that UI, and optional `MISSION1_BROWSER_E2E_DIR` to an external output directory. Run `mvn '-Dtest=UnifiedCrewLifecyclePostgresTest#automaticAcceleratedSchedulerDeliversAcquisitionParserS10V10RestAndHistorical' test`. It creates its own disposable PostgreSQL and actual random-port HTTP app; source fixtures/clocks are explicit.

Browser runners use the project's existing browser-utils dependency, `MISSION1_QA_BACKEND` for a frozen modern API and `MISSION1_QA_OUTPUT` for external screenshot/report output. `browser-navigation.cjs URL BUILD`, `browser-handover.cjs URL BUILD`, `browser-scene-matrix.cjs URL BUILD`, `browser-gp-inspection.cjs URL BUILD` and `browser-refresh.cjs URL BUILD OUTPUT` preserve real transport except the explicitly labelled refresh fixture runner. The pure `BTemporalPolicyAudit.java` and opt-in `UnifiedFinalAudit.java` run with compiled backend/test classpath; latter needs `-Djdk.attach.allowAttachSelf=true` and optional `-Dmission1.audit.output=EXTERNAL_DIRECTORY`, arguments `LABEL PORT`. Disable all writers during its table-fingerprint window. Its optional third `materialize` argument authorizes a separately reported idempotent writer phase after GET; it is not a GET operation.

**The next milestone is dedicated clean-room empty-PostgreSQL validation**, without copied production rows, manual mappings or research-fixture seeds. Fresh Flyway/upgrade/disposable tests here do not prove automatic complete startup. [H](reviews/H.md) records: packaged human-reviewed V7 manifest; active-only LL2 intake; mature imported research captures; finite10-item/14d operational upstream window; mission-era resource seeds; async cadence/request budgets; intentional GET non-repair; bounded cohort/history growth. No unrelated bootstrap redesign is included. Runtime contains no dependency on an external validation archive, but complete cold resource/identity coverage remains unproved.
