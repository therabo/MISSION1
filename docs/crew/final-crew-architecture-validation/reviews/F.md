# Subagent F — final integrated frontend review

**Final review: PASS. No unresolved frontend blocker.**

All required frontend suites completed. The primary may restart the backend and run its independent final acceptance; the detached frontend ports 5190/4190 remain available. Canonical implementation edits were made only by the primary; this review, proposed patch and QA artifacts were written outside Git.

## Resolved finding

The first integrated modern Historical response used internal reconciliation value `PARTIAL`. The public frontend contract accepts `PARTIAL_MATCH`. This caused the Historical decoder to reject the HTTP 200 response and retain the previous accepted context. The primary fixed the public DTO mapping; complete real-data navigation and handover suites passed afterward. Evidence is retained in `historical-diagnostic-api.json` and `historical-diagnostic.png`.

## Completed evidence

The same integrated frontend ran through development `http://127.0.0.1:5190/` and production preview `http://127.0.0.1:4190/`. API transport used actual local backend responses without DTO substitution. The stable validation backend was `http://127.0.0.1:8081`.

- `browser/{development,production}/navigation/qa.json`: 20 Current/Historical viewport states, 44 resize transitions, 16 tests around the 716/717px container boundary, 12 native touch/reduced-motion cases. All passed. Names, assignments, focus restoration, independent scroll owners, lazy Current details and Historical profile reuse remained correct.
- The navigation suites included equivalent local visual lint: zero horizontal overflow, missing image alt attributes, unnamed controls, text below 11px, or WCAG contrast failures in the visible Crew surface. The shared visual-runtime scripts were unavailable; the local lint implementation is preserved.
- `browser/{development,production}/handover/report.json`: all five viewports in both builds passed the retained real UTC cuts. Before `2026-10-02T02:01:55Z`, history is unavailable and no Current roster is substituted. At the publication proxy, the reconstructed roster contains 11 members. `2026-10-07T12:04:59Z` contains 11; `12:05:00Z` and `12:05:01Z` contain 7, excluding Meir, Hathaway, Adenot and Fedyaev. This does not claim a retained pre-entry seven-person roster.
- Handover suites covered correct Fedyaev detail before departure, disappearance from the later roster, native ±10-minute UTC navigation, Historical polling isolation and return to actual Current seven. The accepted product workflow closes Crew to access the date/time bar, then reopens Crew; the bar intentionally unmounts while Crew is open. Historical selection revalidation in a retained panel is separately covered by the focused frontend test.
- `browser/{development,production}/scene/smoke.json`: 104 actual browser states, including GP/TLE Earth, NASA OEM Earth/Inspection, native Cesium wheel/reset, native semantic module picks, Historical calendar and detail. Desktop module picks were DESTINY; the narrow 320px view also exercised COLUMBUS. One native canvas/viewer remained in use.
- `browser/gp-inspection/qa.json`: all 10 build/viewport cases passed GP/TLE Inspection and Earth return, with the expected disabled source selector while inspecting.
- `browser/{development,production}/refresh/report.json`: all 10 build/viewport cases passed the production 120-second visible refresh hook with explicit TEST ONLY Current Crew HTTP fixtures. The UI observed `7 → 11 → 7`, cleared a selected departing member, retained the previous roster on malformed response and recovered with Retry, preserved the native Cesium canvas/view mode, showed no duplicate cards, paused Current polling in Historical and returned to the latest Current fixture. Historical and orbital responses were actual backend responses at their requested times; only Current Crew DTOs were substituted. Expected canceled in-flight QA transport is handled separately during context changes/teardown.
- All actual application suites and both HTTP fixture refresh suites reported zero console/page errors. Desktop/mobile screenshots and four five-viewport contact sheets were visually inspected; text, controls, spacing, hierarchy and narrow detail/back layouts remained usable.

The isolated frontend proposal's full suite was 791 tests / 66 files PASS, with typecheck and build PASS. The primary also reported the integrated final full frontend suite, typecheck and build passing; final backend verify passed 1163 tests. Existing Cesium bundle-size advisory remains unchanged.

## Continuous scheduler acceptance

Independently reviewed subagent E's successful scenario:

`../e/browser-acceptance/scenario-9da5961c-1b8d-4fd3-a576-3140892f72d9/browser-scheduler-report.json`

All nine phases passed, and the primary independently reran the same canonical optional scheduler/browser acceptance with PASS: real scheduled source acquisition and parser/resource/S10/V10 processing produced Current `7 → 11 → 7`; the actual production 120-second frontend refresh hook observed each change using a virtual browser clock; selected Jessica Watkins was removed and selection/focus cleared after departure. Exact Java HTTP Historical queries at the three event cuts returned `7/11/7`. The native UI returned `7/11/7` from the same committed events at start+2s, entry+1s and exact departure. No Crew DTO was substituted.

The isolated test server intentionally had no retained orbital history. The calendar therefore remained honestly unavailable; native ±10-minute controls supplied the UI cuts, and exact Crew-only cuts were verified separately through the real REST endpoint. Expected orbital transport diagnostics are recorded separately from JavaScript/page errors. Source fixtures, accelerated Java scheduling and virtual browser time are explicitly test-only, not real production cadence or a clean-room bootstrap claim.

## Repeatable external commands

Use Node 24 and a fresh output suffix when the primary reruns final acceptance. The scripts remain outside Git, under this directory.

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH MISSION1_QA_BACKEND=http://127.0.0.1:8081 MISSION1_QA_OUTPUT=OUTPUT/navigation node /Users/daniel/.codex/exports/mission1-final-crew/subagents/f/browser-navigation.cjs http://127.0.0.1:5190/ development
PATH=/opt/homebrew/opt/node@24/bin:$PATH MISSION1_QA_BACKEND=http://127.0.0.1:8081 node /Users/daniel/.codex/exports/mission1-final-crew/subagents/f/browser-handover.cjs http://127.0.0.1:5190/ development OUTPUT/handover
PATH=/opt/homebrew/opt/node@24/bin:$PATH MISSION1_QA_BACKEND=http://127.0.0.1:8081 node /Users/daniel/.codex/exports/mission1-final-crew/subagents/f/browser-scene-matrix.cjs http://127.0.0.1:5190/ development OUTPUT/scene
PATH=/opt/homebrew/opt/node@24/bin:$PATH MISSION1_QA_BACKEND=http://127.0.0.1:8081 node /Users/daniel/.codex/exports/mission1-final-crew/subagents/f/browser-refresh.cjs http://127.0.0.1:5190/ development OUTPUT/refresh
```

For production use URL `http://127.0.0.1:4190/` and label `production`. For the GP/TLE supplement set `MISSION1_QA_OUTPUT=OUTPUT/gp-inspection` and run `browser-gp-inspection.cjs`; it covers both frontends.

Preserve frontend 5190 during the canonical optional Java scheduler test. Its browser script is `browser-scheduler-e2e.cjs`, invoked by Java with `--api`, `--scenario` and `--frontend`; it uses bounded per-phase marker waits. Node dependencies come from the existing project/bundled Playwright runtime.

For a representative final-jar handover, set `MISSION1_QA_WIDTHS=1440,390` and choose a fresh output suffix. The normal driver default remains all five viewports. `MISSION1_QA_CONTINUE=1` resumes saved passing cases after an infrastructure interruption.

The detached QA frontend server metadata is saved in `detached-frontend-servers.json`. Existing application ports 5175/4175 were untouched.
