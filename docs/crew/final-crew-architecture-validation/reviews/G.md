# G — Final independent GET and performance review

**Final status: PASS. Blocking findings: none within this review scope.**

Reviewed final main-source snapshot copied from the canonical repository on 2026-10-12, including the latest Historical context fixes and provider-route guard. Canonical `target/classes` was older, so the auditor compiled an independent frozen source/resource copy with Java21 and `-parameters`; no canonical file was edited. The complete source SHA256 manifest is `g/final-snapshot/main-source-sha256.json`, compilation log `g/final-snapshot/compile.log`. Later formatting changes do not alter the reviewed semantics; primary remains responsible for its final full-suite check and packaged-runtime restoration.

## Real HTTP GET result

The independent 8083 app ran with Flyway, all external source/orbital acquisition, V9/S10/V10 schedulers, identity review, and occurrence backfill disabled. All 148 measured GETs plus 30 warm-up GETs were actual loopback HTTP requests through Spring controllers. Groups covered Current roster, all13 current/retained/alias details, the six common baseline Historical cuts, repeated ten-minute seeks around departure, Replay coverage, and21 real Historical cuts. Historical details are embedded in the same Replay GET rather than retrieved by a second per-person request.

Every prepared SQL statement issued by these GETs was SELECT-only, and every observed GET connection was read-only. All80 public tables had identical row-count/content fingerprints before and after the GET batch. ByteBuddy traced frozen scoring, V9 automatic worker/evaluation, S10 resolver/worker/acquisition, V10 materialization, source ingestion/readers, and actual Java external HTTP send/sendAsync. All15 method counters and the external HTTP counter remained zero. The audit server shut down cleanly, leaving the primary's8081 server untouched.

| GET group | Baseline median / p95 ms | Final median / p95 ms | Final prepared SQL queries | Final payload bytes |
|---|---:|---:|---|---:|
| currentRoster | 44.347 / 53.875 | 136.097 / 243.272 | 52 | 59,578–59,578 |
| currentDetailsIncludingAliases | 27.351 / 30.531 | 93.479 / 129.237 | 52 | 8,463–9,816 |
| historicalRosterAndEmbeddedDetails | 22.226 / 36.541 | 103.737 / 145.519 | 19, 30, 36 | 3,389–178,957 |
| historicalSeek10Minutes | 21.327 / 33.823 | 97.316 / 112.821 | 36 | 114,992–178,970 |
| replayCoverage | 10.891 / 13.859 | 17.857 / 24.790 | 4 | 1,149–1,149 |
| historical21RealCuts | — | 85.277 / 128.179 | 19, 30, 31, 36 | 3,389–178,957 |

These are warmed measurements on this local installation, not a capacity benchmark or a hardware-independent SLO. The final Current median/p95 increased from44.347/53.875ms to136.097/243.272ms because production now validates the retained sealed release, exact source scope, normalized candidates, and qualified proof lineage. Historical similarly loads the shared V10 context and validates scoped binding lineage. This cost is real and recorded rather than hidden by a precomputed per-timestamp cache. The measured Current p95 remains approximately0.244 seconds in this run; query counts are bounded by pipeline context rather than roster size. No project performance SLO was supplied.

## Set-based consumer and V10 work, outside GET

The production consumer performs exactly one cohort heads query in Current and in each Historical reconstruction. Its SQL selects the newest subject head before validating release/outcome, so a newer DEFER, CONFLICT, incompatible or superseded row cannot resurrect an older MATCH. The query reads normalized candidate/proof counts and equality checks setwise, using the V12 `(evidence_id,subject_index,id DESC)` index. These SQL subqueries execute inside one JDBC statement rather than issuing a query per person or proof. V7 knowledge, explicit resolutions and provider targets are also cohort queries; neither consumer nor DTO member loops access the database.

A separate warm consumer-only audit covered the complete selected retained cohort:25 subjects,25 accepted bindings. It used exactly5 prepared SELECTs on read-only connections on every sample, including the two V7 knowledge reads. After five warm-up loads and20 measured loads, median/p95 was38.005/62.090ms. No scoring, acquisition or materialization was invoked by the lookup. Full25 binding revisions/targets/knowledge timestamps and SQL are retained in `g/after-separate-performance.json`.

After completing and sealing the GET fingerprint window, primary-authorized V10 materialization timing ran20 times at the exact existing revision23 effective instant,2026-10-11T22:05:07.552306Z. A pure evaluation precheck confirmed both existing input and semantic hashes before any call. Every materialization returned revision23 with `inserted=false`; median/p95 was85.235/222.729ms with22 prepared statements, plus the advisory-lock SELECT executed as an ordinary statement. Only authorized mutable `crew_active_projection_work` completion/last-success bookkeeping changed during this separate writer phase. All79 other public tables and immutable projection/binding history remained unchanged. This phase is explicitly separate from GET purity.

## Identity/profile freeze and lifecycle comparison

The initial13 complete profile payloads are preserved in `g/before-complete-13-profiles.json`, and all13 final counterparts in `g/after-complete-13-profiles.json`. Canonical ID/name, official profileURL, all external IDs, agency, nationalities, biography, media, career, availability, profile provenance/fetch timestamp, canonical aliases/requested-ID routing, identity/profile policy, profile resources and canonical field provenance excluding the intentionally changed operational presence field all remained byte-for-byte equal after JSON normalization. The freeze comparison reports zero differences. 19 V7/person/identity and V9 automatic tables also retained identical baseline-to-final row-count/content fingerprints, including all12 V9 tables.

The21 real cuts use ±1 second around the retained entry publication proxy, first LL2 successful capture, Oct5 onboard observations, Menon's Oct6 observation, the completed Oct7 departure, Luke's Oct9 observation, and an Oct10 continuity anchor. The last anchor is a continuity check, not a claimed event. Before2026-10-02T02:01:55Z Historical is UNAVAILABLE. At that proxy and throughout the retained overlap it has11 members. At2026-10-07T12:05:00Z it retracts the four accepted departed people and has7; immediately afterward and through the later cuts it remains7. All Historical member/detail counts match. The lack of a retained earlier seven-person roster remains an evidence limitation rather than a fabricated pre-entry result.

Every membership difference in the common legacy/modern cuts is explained:

- Oct2 proxy:10→11 adds existing canonical Andrei Fedyaev through the qualified S10 variant binding; no new human/alias is created.
- Oct3 and immediately before departure:11→11, same identities.
- Exact Oct7 departure:11→7 removes Sophie Adenot, Andrei Fedyaev, Jack Hathaway and Jessica Meir because completed scoped departures now apply to V10 lifecycle.
- Oct10:10→7 removes the three departed people still retained by legacy semantics; Fedyaev had already disappeared from the legacy output independently.
- Before entry:both are UNAVAILABLE; no forced seven-person roster.

A separate read-only comparison at the exact sealed revision23 UTC instant, using the fixed final-audit knowledge cut, produced the same seven canonical IDs and exactly the same per-human presence as committed Current23:five CONFIRMED_ABOARD and two STALE. `g/sealed23-historical-comparison.json` retains the complete Historical response and both maps.

The later wall-clock GET audit occurred after the host resumed from limits with source workers paused:Current still published the sealed seven-person membership, while all seven annotation states were STALE due capture age. That observation is not relabeled as fresh or used to invalidate the exact-instant comparison. Ordinary source/scheduler restoration is primary-owned and must retain newly acquired provenance; this audit did not refresh cached bodies or invent capture timestamps.

## Artifacts

- `g/UnifiedFinalAudit.java`: external reproducible instrumentation and separate idempotent timing runner.
- `g/after-get-audit.json`, `g/after-get-audit.log`: full GET samples, SQL, response examples,80-table fingerprints and zero invocation counters.
- `g/after-separate-performance.json`: consumer samples/full25 bindings, V10 precheck,20 idempotent timings and post-performance fingerprints.
- `g/profile-freeze-comparison.json`, `g/v7-v9-baseline-fingerprint-comparison.json`: zero canonical/profile/V9 differences.
- `g/legacy-modern-historical-differential.json`: every common-cut membership delta.
- `g/SealedHistoricalComparison.java`, `g/sealed23-historical-comparison.json`, `.log`: Current/Historical equality at one effective instant.

Review conclusion: no GET write, network, scoring, acquisition or materialization path was observed; source and policy work remains background-only; one shared set-based S10 consumer serves Current annotations and V10 lifecycle; Historical uses the same pure lifecycle at the requested instant without storing timestamp-specific rows. The documented additional latency is the measured cost of proof validation, with no per-person N+1 query behavior. No blockers remain in G's requested audit scope.
