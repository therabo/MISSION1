# C — Final database / migration / immutability review

**PASS. No database, migration or immutability blockers remain.**

Reviewed on 2026-10-12 Europe/Rome, after scheduled real-source refresh, explicit emergency rollback and final production restoration. All canonical database commands in this review used `PGOPTIONS=-c default_transaction_read_only=on`. No heavy tests, Docker restart, production write or manual production stage invocation was performed by this reviewer.

## Final canonical state

- Flyway V12 is successfully installed. Independent checksums for **all V1–V12** match the current source files. Original V1–V11 SHA-256 files remain unchanged.
- S10 retains **150 revisions**, including every original125. Latest25 exact subjects all AUTO_MATCH under `s10-scoped-production-v1`; no duplicate S10 cut was created during refresh/rollback/restoration.
- V10 retains **26 revisions**, including every original21. Latest revision26 is `S10_SCOPED_BINDING`, with25 normalized binding children, seven ACTIVE humans, four RETAINED and four completed-departure vetoes.
- The immutable chain is22→23→24→25→26. Revision23 is initial converged production consumption;24 follows ordinary source refresh;25 records explicit legacy rollback;26 restores production. Old revisions and normalized children remain unchanged.
- Revision26 pins LL2 run149/snapshot67 and NASA run150; policy is `crew-active-production-v1/crew-freshness-v2:PT6H:PT6H:PT168H:PT336H/count=PT72H/roster=PT6H/topic=PT6H/personal=PT168H`.

## Preservation and write attribution

The final audit compares **81 baseline tables/views**, using each table's original column projection and a digest multiset of every baseline row. **No original immutable Crew row is missing or modified.** Every prior125 S10 and21 V10 revision, candidate/proof/support/member/slot/capture row remains intact.

Exact unchanged data: V7 permanent person anchors, all provider IDs, reviewed bindings/equivalences/proofs and both canonical alias views; all immutable V9 feature/decision/graph history; V8 semantic/capture/resource history. S10 adds one production release,25 decisions,273 candidates and110 proofs. V10 adds five append-only cuts and their normalized children. Flyway adds V12. Durable work/job/budget rows change only in their documented mutable roles.

The original activation/GET freeze was recorded before subsequent real-source acquisition. Later **ordinary successful LL2 run149** at `2026-10-12T09:05:25.784731Z` adds snapshot67, seven person observations, seven assignments and one Expedition observation. These are legitimate new source observations, not S10 modification of old V7 profile history. All91 original profile observations survive exactly; total98. No human/provider/alias identity is added or changed.

**NASA run150** succeeds at `2026-10-12T09:10:26.214470Z` and reuses compatible retained document120 and the already retained parser1.2 body/evidence. Document120 retains its original capture time `2026-10-09T18:29:37.493486Z`; the new run retains the actual new knowledge/capture time. No source document/body/evidence mutation or false backdating occurred. The normal source refresh also appends two V4 reconciliation cuts and dependent results; originals survive.

One unrelated V2 NASA OEM row has a different aggregate digest because permitted mutable `last_retrieved_at` advanced from `2026-10-11T15:22:13.516123Z` to `2026-10-12T08:54:31.104232Z`. Independent comparison with the original readonly dump verifies **all five XML byte digests and all creation/start/stop/HTTP-last-modified values unchanged**. This retrieval metadata revalidation is documented separately and is not a Crew/S10 mutation.

Evidence: `c-db/final-immutability.json`, `final-row-digests.jsonl`, `final-flyway-checksums.json`, `final-source-captures.json`, `activation-refresh-rollback-chain.json` and `oem-difference.json`.

## Schema and boundary review

V12 truthfully extends V10's identity mode while preserving original source-owner/lineage/atomic/immutability/sealed-parent machinery. Operational positive supports and completed departures pin exact S10 binding lineage in a sealed normalized child. Explicit legacy correspondence is accepted only with current source/target/authority validation and no applicable S10 head. New production editorial guards pin verified typed V8 relation/capture plus current reviewed V7 or immutable original provider ownership; revoked/pending V7 decisions cannot resurrect old fallback.

Newest-head selection precedes release/outcome filtering. Scalar evaluation, winner/candidate and normalized proof values agree. DEFER/CONFLICT/incompatible/superseded heads fail closed. S10, release, V7 and V8 authority notifications reach durable V10 work. Production S10 input hashes exclude downstream projection diagnostics, avoiding revision feedback. The normal final modes are production S10 and unified V10/S10 Replay; the legacy revision remains an immutable explicit rollback record.

The query-driven `(evidence_id,subject_index,id DESC)` index is present and was measured using an exact source lookup. Historical requests do not persist arbitrary timestamp/cache rows. No new database engine or distributed infrastructure is introduced.

## Independent tests and final acceptance evidence

The previous C implementation review retains25 independent disposable PostgreSQL checks:14 editorial lineage/revocation/completeness cases, four explicit operational correspondence cases and seven mutation/seal cases. Sequential fresh V1–V12 SQL and a copied V11→V12 upgrade passed while retaining original immutable rows. Those tests are migration/guard validation using mature copied data, **not clean-room empty-database source bootstrap**.

Primary reports final Java21 `mvn test` and `mvn verify`: **1,163 PASS**, including proper Flyway fresh/upgrade integration. This reviewer did not rerun heavy suites while browser acceptance was active. Final GET/scoring/network instrumentation belongs to the independent G review; C confirms persisted history protection and write attribution before and after convergence, sources and rollback.

**Final status: PASS.** The next milestone remains clean-room empty-PostgreSQL bootstrap validation; this audit makes no bootstrap claim.

## Post-restoration normal-runtime addendum — final PASS retained

The normal default application PID85818 continued running across the limit pause. This is an active ingestion/runtime period, not the earlier writer-disabled fingerprint freeze. A final readonly digest snapshot is saved in `c-db/final-normal-restoration.json` and `normal-restored-row-digests.jsonl`; final state/release facts are in `normal-restored-state.json`.

During this audit, latest V10 advanced normally from28 to **29** at `2026-10-12T11:12:02.991Z` (13:12 Europe/Rome log). It remains `S10_SCOPED_BINDING`, seven ACTIVE/four RETAINED,25 exact normalized S10 bindings and four persistent qualified departure vetoes. Latest V10 graph_id is NULL, confirming V9 graph is not production authority.

All original125 S10 and21 V10 revisions and normalized children remain exact. Every immutable baseline Crew/V9 row survives. V7 permanent identities/provider mappings/reviewed bindings/equivalences/proofs and both alias views remain exact. S10 remains150 revisions and25 latest production MATCH; repeated repairs log revisions=0, including after normal source changes, so no S10/V10 feedback churn is observed.

Compared with the earlier revision26 audit, ordinary V9 SHADOW processing appends36 decisions (153→189), including the later166–189 set,36 feature snapshots,14 observations and nine graph revisions. All preexisting V9 history remains exact. The persisted V9 release still says mode SHADOW and model_version crew-auto-identity-v1-shadow; its nine new AUTO_MATCH research decisions do not authorize production V10 or Historical. These legitimate background appends must not be described as an unchanged total-table fingerprint.

Ordinary NASA editorial refresh adds four immutable acquisition records41–44 at10:01:50–53Z (12:01 Europe/Rome), with successful topic and DEGRADED expedition captures. Retained verified V8→V7 editorial identity relations continue to qualify three slots; four other editorial slots remain unresolved. Normal successful follow-up runs151 (LL2,11:06:02Z) and152 (NASA,11:11:03Z) reuse snapshot67 and document120 respectively, with no invented source evidence or new person anchors. Durable budgets/leases/jobs/input heads legitimately advance. These source observations and research/history appends are separated from the initial production-activation freeze.

No immutable Crew rewrite, V7 change, V9 production promotion, or additional S10 binding was found. The earlier independently verified V2 OEM retrieval-metadata-only change remains classified separately. **Final C status remains PASS; no blockers.**
