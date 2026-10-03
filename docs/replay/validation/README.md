# Replay validation and final audit

Accepted input baseline: `0d754997617c2c5bfb6aa7cf5921ea3cb41d6e7f`, clean main = origin/main = GitHub main before edits. Repository /Users/daniel/Desktop/MISSION1. Work began October 3 UTC and final checks crossed midnight in Europe/Rome. [Actual context review](context-reviewed.md).

## Gate and retained inventory

The [empirical orbit feasibility verdict](../orbit-historical-feasibility.md) was written **before** historical position implementation. **FULL** refers to the current narrow Crew support interval. Six distinct raw GP sets/eight retrieval observations and three complete retained OEM files support that interval. No historical provider data was fetched. Existing bodies were extracted read-only, hash-checked and parsed. The normal LIVE comparison path refreshed retrieval metadata of an unchanged current OEM body during browser startup; it did not add a historical product or change the gate inventory. Replay itself made no acquisitions.

Initial inventory timestamp: 2026-10-03T21:16:36Z. [Sanitized inventory](inventory.json) preserves epochs, lineage, gaps and vector metadata. Packaged EOP transformation coverage: **1973-01-02T00:00:00Z–2027-10-24T00:00:00Z**, measured with the accepted Orekit context ([output](eop-coverage.txt)). Future API coverage is clipped at request time.

## Coverage measured on the final packaged runtime

Evaluation: **2026-10-03T22:03:52.222934Z**.

- Crew: **2026-10-02T02:01:55Z–2026-10-03T22:03:52.222934Z**, one support interval, **PARTIAL**. No gap in aggregate NASA-supported state during this collected interval; Expedition/assignments remain unavailable before actual structured capture **2026-10-03T10:30:18.796289Z**. Applicability windows can create later gaps; tests exercise these. This does not establish an exhaustive roster.
- Orbit: **2026-09-27T03:24:39.835008Z–2026-10-03T22:03:52.222934Z**, one computed/predicted support interval. The GP-only September 30 gap is filled only by a retained covering OEM prediction. The earlier bound includes explicitly bounded backward GP computation, not a claim of source-provided observations before collection.
- Joint: **2026-10-02T02:01:55Z–2026-10-03T22:03:52.222934Z**, PARTIAL Crew completeness and UNKNOWN orbital accuracy.

[Coverage JSON](coverage-response.json) and [read-only API audit](api-audit.json) are captured observations, not permanent invariants.

## Real stored examples

| Case | Requested UTC T | Crew counts/context | Orbit | Selected epoch/creation UTC |
|---|---|---|---|---|
| earliest | 2026-10-02T02:01:55Z | official None, resolved 8, unresolved 3, assigned None | GP_TLE | 2026-10-02T00:19:52.567968Z |
| middle | 2026-10-02T23:00:00Z | official 11, resolved 8, unresolved 3, assigned None | GP_TLE | 2026-10-03T01:06:34.599456Z |
| latest | 2026-10-03T22:02:54.947695Z | official 11, resolved 8, unresolved 3, assigned 7 | GP_TLE | 2026-10-03T01:06:34.599456Z |
| unsupported | 2026-01-01T00:00:00Z | UNAVAILABLE | UNAVAILABLE | — |
| element_epoch | 2026-10-03T01:06:34.599456Z | official 11, resolved 8, unresolved 3, assigned None | GP_TLE | 2026-10-03T01:06:34.599456Z |
| between_epochs | 2026-09-28T15:01:34.207968Z | UNAVAILABLE | GP_TLE | 2026-09-28T03:24:39.835008Z |
| gp_gap_oem_only | 2026-09-30T10:00:00Z | UNAVAILABLE | NASA_OEM | 2026-09-28T17:13:16.701Z |
| gp_lower_boundary | 2026-09-27T03:24:39.835008Z | UNAVAILABLE | GP_TLE | 2026-09-28T03:24:39.835008Z |
| outside_orbit | 2026-09-27T03:24:38.835008Z | UNAVAILABLE | UNAVAILABLE | — |

Full responses are adjacent `*-response.json` files. Every available orbit includes ITRF position and velocity with m/m/s units, WGS84, exact effectiveAt and source hash/creation/epoch/retrieval/method. Crew quality is PARTIAL, absent Crew is NO_DATA, available orbit accuracy is UNKNOWN. Earliest Crew assertions use publication fallback and were captured later. LL2 assignments are unavailable before capture; no Expedition-date backfill. Profiles use latest retained canonical metadata for historical identities only.

At the earliest Crew T, selected GP epoch is 2026-10-02T00:19:52.567968Z; at the middle T it is 2026-10-03T01:06:34.599456Z with a negative signed offset. The NASA prediction remains separate. Representative same-epoch source separation: **1048.617 m** at earliest Crew T, **260.002 m** at middle T, **395.422 m** at the latest GP epoch and about **3534.006 m** at this audit's latest historical T. These are neutral source-separation distances, not error/accuracy estimates; RTN remains deferred.

## Tests and zero I/O

**382 backend tests** (baseline 355), zero failures/errors/skips. **292 Crew tests**, **129 PostgreSQL Testcontainers tests** across eight classes, including 16 new Crew Replay PostgreSQL tests. **27 new Replay-specific cases** comprise those 16, eight orbital cases and three explicit effective-mode engine cases. No H2 or public internet is needed by tests. [Machine-readable results](test-results.json).

Temporal cases: before/after completed entry and departure; late acquisition and publication; event time before publication; inert planned transfer; non-negative partial omission; unresolved identities; stale last-known evidence; structured first capture/gaps; NO_ACTIVE clears older assignment context; latest canonical profiles without new membership; query-order independence. Four independent Crew/orbit availability combinations pass. Orbital cases cover exact epoch equality with the accepted propagator, nearest epoch/ties/backward offset, inclusive maximum offset, outside-bound rejection, OEM actual-vector bounds, complete rotating-frame PV derivative, source separation and service restart. PostgreSQL tests verify persisted GP/OEM inventory/selection and coverage.

Instrumented Replay calls: **LL2 0, NASA 0, CelesTrak 0, OEM 0, DB writes 0**. Configured provider clients/acquisition services and fixture HTTP sources were checked for no interactions. SQL instrumentation captures both prepared and ordinary statements and verifies SELECT-only/read-only/REPEATABLE READ. The real-volume API audit compares **row counts and content digests of all 30 public tables** before/after 47+ replay/coverage reads: identical. No runs, snapshots, evidence, reconciliation rows or event triggers changed. Parsed OEM cache holds at most eight immutable source bodies, never replay answers.

[Restart check](restart.json) compares the same historical T before/after restarting the packaged backend: Crew state/profiles and source provenance are exactly equal; physical PV differs by less than 0.1 mm and 0.000001 m/s. Accepted Orekit frame/EOP interpolation caches can vary final floating-point digits between contexts; the numerical check uses explicit tolerances. Current acquisition schedulers were disabled for the audit, then restored to the accepted normal configuration after validation.

## Performance and plans

Warm query-time measurements, PostgreSQL 16.10 Testcontainers, five warmups then 30 samples per path, read-only REPEATABLE READ. Component measurements use recorded Crew/GP fixtures; the packaged HTTP measurement below additionally uses all three full retained OEM files.

| Path | n | Median ms | p95 ms | Worst ms | SQL statements/call |
|---|---:|---:|---:|---:|---:|
| CrewReplay | 30 | 4.092 | 4.706 | 4.759 | 9 |
| OrbitHistoricalState | 30 | 1.493 | 1.980 | 2.811 | 2 |
| MissionReplay | 30 | 4.641 | 5.950 | 6.330 | 11 |

Final real-volume Mission Replay HTTP: n=30, median **12.976 ms**, p95 **16.394 ms**, worst **16.905 ms**, after five warmups. Cold startup includes parsing retained OEM XML; it is not represented by warm numbers. Earlier suite timings while Chromium was rendering are retained in logs and show CPU contention (Crew p95 up to 122.942 ms); no universal latency guarantee is claimed.

[EXPLAIN ANALYZE/BUFFERS](query-plans.txt): structured history uses the existing Crew source index (0.038 ms); GP inventory uses six-row scan plus the existing observation primary-key index (0.046 ms); OEM metadata scans three products (0.012 ms). No new index or per-second materialization is justified at this inventory size. History scans grow with retained records; this is measured current performance, not a scalability guarantee.

## Frontend and real browser checks

**283 frontend tests / 34 files** (baseline 269/30), typecheck and production build pass. Tests cover UTC calendar/future validation including Chrome's minute-only normalization, decode epoch rejection, debounced loading, cancellation, rapid seeks, stale completion suppression, no historical polling, partial/unresolved Crew, unavailable orbit/Crew, keyboard close and LIVE→REPLAY→LIVE with polling/current Crew restoration and stable scene element. Existing camera, trajectory, graphics, Inspection and Crew tests continue to pass.

Real PostgreSQL/backend, dev **5175** and production preview **4175**, viewports **1280×720** and **390×844**. [Browser report](browser/report.json) and [reproducible script](scripts/browser-replay.cjs). No request interception or source fixtures were used. The QA probe reads the mounted Viewer through React's retained reference and then public Cesium properties; it writes no camera, clock or scene values. In Replay all cases have the identical requested scene epoch, shouldAnimate=false, hidden current paths, correct backend physical position plus accepted model-only 75 km normal display lift, and hidden model outside orbit support. Camera position stays within 1 mm of the captured pose and the same Viewer survives mode changes. User-requested mode toggles issue no camera commands.

Earliest/middle/latest/unsupported timestamps, invalid future input, rapid seeks, latest-profile labels and Crew changes pass in all four browser combinations. Current API requests during Replay: zero. Exit restores current Crew/clock and both GP and NASA OEM Inspection/Back flows without page reload. Zero page errors. First harness revisions compared the off-origin asset matrix instead of its centered bounds and supplied a browser-normalized time format incorrectly; corrected probes and the UTC input regression are reflected in the final successful report. Screenshot review fixed the control/header overlap and button styling.

- [Production historical Crew](browser/4175-1280-middle.png)
- [Production mobile latest metadata / historical operational profile](browser/4175-390-profile.png)
- Other supported/unavailable and LIVE Inspection screenshots are in [browser evidence](browser/).

**Native two-finger pinch remains UNVERIFIED.** No native-touch test was performed.

## Gates and regression audit

Maven test, verify, offline test and offline verify each pass at **382**. Frontend tests/typecheck/build pass. The existing Cesium large-chunk warning remains. Logs are adjacent `maven-*.log` and `frontend-*.log`. Current Crew/Expedition/person and state/samples/comparison APIs return 200; final smoke is in `current-api-smoke.json`. Replay invalid/future policy is 400 and unsupported history is 200/UNAVAILABLE.

[Freeze audit](freeze-audit.json) compares source clients, ingestion/refresh implementations, domain records, current controllers/DTOs, migrations, packaged data, assets and unchanged graphics/camera helpers to the accepted baseline. Intentional changes are the explicit effective-time engine mode, shared identical OEM polynomial, history accessors, Replay composition/API/UI and scene epoch/current-path guards. LIVE uses the original engine mode and unchanged defaults. No new dependency, migration, source acquisition semantics, shader, model asset or distributed infrastructure was introduced. Full diff/whitespace/secret checks precede the ordinary commit and SSH push. The external project context remains outside Git.

Next single milestone: **ISS REPLAY EVENT TIMELINE**. It was not begun; RTN remains pending.
