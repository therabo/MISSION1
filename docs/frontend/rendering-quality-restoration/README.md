# Browser antialiasing and night brightness restoration

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

2026-10-05, Europe/Rome. Accepted parent: `b190e8b7df435251d6db46bf6d6357d3fdf7e868` (`perf: optimize high-fidelity mission rendering`). Implementation checkout: `/Users/daniel/Desktop/MISSION1`.

## Exact correction

| Setting | Accepted parent | Restored setting |
| --- | --- | --- |
| Viewer `contextOptions.webgl.antialias`, supplied by `GRAPHICS_QUALITY.browserAntialias` | `false` | `true` |
| Cesium `scene.msaaSamples` | 4 | 4 |
| Browser default framebuffer samples, observed on ANGLE Metal M1 | 0 | 4 |
| Tiled and local Black Marble `brightness` | 1.15 | 1.8 |
| Night `gamma` / `contrast` | 1 / 1 | 1 / 1 |

Only `graphicsQuality.ts` and `earthImagery.ts` change application behavior. The existing graphics-policy test now expects browser antialiasing to be enabled. No other quality setting compensates for its cost.

The retained Inspection FXAA stage and its mode-aware shader are unchanged; the separate native Cesium FXAA stage remains disabled. DPR/resolutionScale is unchanged: DPR 1 uses scale 1.25 and a 1800×1125 canvas at 1440×900 CSS; DPR 2 uses scale 1 and 2880×1800. HDR, bloom, sharpening, atmosphere, exposure, day imagery, 4K Tycho skybox, NASA ISS model/textures, trajectories, camera, occlusion-aware full-screen framing, Crew, Replay, dashboard and backend are unchanged. Night provider URLs, tile levels, alpha composition, terminator, progressive loading and bounded retry/fallback behavior are unchanged.

## Matched visual comparison

The QA harness serves the preserved accepted production artifact on 4185 and the rebuilt production artifact on 4175. Both use the same recorded real GP/OEM API responses from the preceding accepted dossier. GP is a computed orbital state; OEM is a source-provided prediction. No synthetic orbital values are introduced. The comparison epoch is `2026-10-04T20:03:26.9019109999826469Z`; night and terminator use real historical Replay at `2026-10-02T23:00:00Z` and `2026-10-02T18:00:00Z`, with a separate visible-twilight comparison at `2026-10-02T17:00:00Z`.

The public scene clock is paused and native camera input is disabled only in the QA browser, including after Inspection restores its normal input profile. UI buttons invoke the real handlers. Each timing window rejects camera movement over 1 mm or an epoch change. Paired world/local positions, basis, transform, lens, range, viewport and composition are checked separately. Screenshots are original browser captures; ROI statistics use source pixels without alignment, resampling or retouching.

| Subject | Before | After | Review |
| --- | --- | --- | --- |
| GP trajectory | canonical | canonical | Cyan trajectory retains its thin core, continuity and halo. |
| OEM trajectory | canonical | canonical | Gold trajectory retains its thin core, continuity and curved return. |
| GP oblique segments / joins / halo | oblique | oblique | Arc and joins remain continuous; no new seam, gap or halo expansion. |
| OEM oblique segments / joins / halo | oblique | oblique | Same check against the dark space background. |
| ISS silhouette / thin geometry | 90 m, oblique | 90 m, oblique | Solar-array edges, truss, antenna and radiator geometry remain intact. |
| Historical night cities | 1.15 | 1.8 | Stronger city cores and light clusters, with the same imagery and camera. |
| Terminator / twilight, 17:00 UTC | before | after | Same twilight position and blend; stronger night-side cities. |
| Evening night side, 18:00 UTC | before | after | This legacy-named capture is a night-side view, distinct from the visible-twilight pair above. |

The browser-AA request and actual multisampling are restored. On this Cesium/ANGLE pipeline the inspected trajectory and ISS edges do not show a clearly distinguishable sharpening gain in the fixed screenshots; no universal improvement is claimed. The stronger city-light presentation is visible. Matched audit passes all 17 camera/source/quality pairs. The oblique line/halo color masks report gp-oblique DPR 1: 4347 selected pixels, 0 changed; oem-oblique DPR 1: 4465 selected pixels, 0 changed; gp-oblique DPR 2: 17290 selected pixels, 1 changed; oem-oblique DPR 2: 17858 selected pixels, 0 changed. Color-selected line/halo ROI measurements are diagnostic pixel heuristics, not object-ID masks; whole-ROI differences also include the intentional night brightness change.

## Measured frame cost

Apple M1 / ANGLE Metal, headed Chromium 151.0.7922.34, 1440×900 CSS. Each foreground measurement uses 10 s warmup and a 30 s `scene.postRender` window; median FPS is 1000 divided by median frame interval. Browser focus/visibility, fixed camera/epoch, loaded imagery and 4K stars are checked. Browsers run sequentially, with no test/build workload in parallel. Both requested settings are restored together; these are observed configuration costs on this machine, not a universal or isolated browser-AA microbenchmark.

| View / DPR | Median ms, before → after | Median FPS, before → after | P95 ms, before → after | Median frame cost |
| --- | --- | --- | --- | --- |
| GP Overview / 1 | 25.9 → 29.3 | 38.61 → 34.13 | 33.7 → 34.9 | +13.1% |
| OEM Overview / 1 | 26.3 → 30.1 | 38.02 → 33.22 | 28.0 → 36.1 | +14.4% |
| GP oblique / 1 | 25.8 → 30.2 | 38.76 → 33.11 | 28.6 → 33.5 | +17.1% |
| ISS Inspection / 1 | 25.2 → 27.7 | 39.68 → 36.10 | 26.3 → 30.9 | +9.9% |
| GP Overview / 2 | 55.2 → 61.0 | 18.12 → 16.39 | 56.8 → 66.6 | +10.5% |

Desktop DPR 1 costs **+2.5–4.4 ms/frame (+9.9–17.1%)** in the four sampled views. Native DPR 2 costs **+5.8 ms/frame (+10.5%)** in GP Overview. The decrease is accepted because this correction prioritizes visual quality. No quality reduction is introduced.

Raw intervals, P99, true 1% low, slow-frame counts and long tasks are retained in the per-build `comparison.json` files. Session times are recorded; final comparisons were repeated after the usage-limit pause with the same final input-lock harness. Early probes, interrupted runs and the rejected moving-Inspection window are excluded from these results and kept only under `/tmp/mission1-rendering-restore-diagnostics/`. GPU scheduling/thermal and system-load variation remain possible; the numbers do not establish a universal FPS guarantee.

Production visual QA includes **34 captures / 17 matched pairs** at desktop DPR 1, native DPR 2 and 390×844 CSS mobile. Development on 5175 passes the same 10 primary capture states. All seven final browser sessions report zero page errors, console errors and failed requests, with loaded imagery and 4K stars; canvas remains full-screen and focus error stays below 2 px. All final captures audit antialiasing, MSAA, retained FXAA stage, night brightness, gamma/contrast, DPR/scale and visible-control names. Development evidence.

## Validation and scope

| Required check | Result |
| --- | --- |
| Frontend tests | PASS: 320 tests / 37 files |
| Frontend typecheck | PASS |
| Frontend production build | PASS; existing Cesium large-chunk warning retained |
| Backend `mvn test` | PASS: 382 tests, zero failures/errors/skips |
| Backend `mvn verify` | PASS: 382 tests, zero failures/errors/skips |
| `git diff --check`, working and staged | Verified before the ordinary commit |

[Runner logs](evidence/validation/) retain the results; only trailing whitespace and terminal blank lines are normalized, with original/normalized hashes recorded. Build identity pins the served JS/CSS and relevant source files. Scope audit shows nine changed existing paths: two policy sources, one existing assertion and six current-document notes. All 210 backend files, App/CSS and camera/trajectory code and runtime assets remain byte-identical to the accepted parent. New files are confined to this dossier. The external context is updated at `/Users/daniel/Desktop/mission1-project.md` and remains outside Git.

No architecture, contract or infrastructure decision changes, so no new ADR is needed. Native two-finger pinch is not verified by this fixed-camera visual QA.

## Reproduction and reviewed context

Run `scripts/compare.cjs` with Node 24 and Playwright, setting `RESTORE_BUILD=before|after|development` and `RESTORE_PORT=4185|4175|5175`; `RESTORE_DPR=2` selects native Retina capture, `RESTORE_BENCHMARK=0` skips timing, and `RESTORE_REPEAT=1` measures only the canonical GP control. `RESTORE_TWILIGHT=1` captures only the 17:00 UTC twilight pair, without timing. Use `MISSION1_PLAYWRIGHT_MODULE` to override the documented local dependency path. Run `scripts/audit.py` with Python providing Pillow and NumPy after both DPR pairs exist. QA scripts do not enter the frontend bundle.

Read before implementation: `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`; current external-context sections 48–50; the complete [accepted performance report](../high-fidelity-rendering-performance/README.md); relevant graphics/imagery/viewer implementation and existing tests. Applied skills: `iss-3d-earth-view` (including Earth contract and scene conventions), `frontend-design-codex`, and `devops-local-platform` (including local runtime and CI definition of done), from their configured instruction directories. Earlier historical dossiers and measurements remain preserved.
