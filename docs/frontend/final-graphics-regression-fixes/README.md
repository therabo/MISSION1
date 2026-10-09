# Final Inspection range and trajectory-clearance audit — 2026-10-02

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

Baseline: clean `main`, fetched `origin/main` and direct SSH GitHub ref all equalled **8af1496e44439f5761507bbcf8d927231b7e5a4b** before implementation. This milestone measures the accepted camera and fixes only trajectory presentation clearance. RTN and Replay remain deferred.

## Context review

Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and the external `/Users/daniel/Desktop/mission1-project.md`, which remains outside Git. Actual skills consulted: `iss-3d-station-view`, `iss-3d-earth-view`, `frontend-design-codex`, `devops-local-platform`, `flight-dynamics-orekit`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, and `architecture-decisions`, including their applicable references. The frontend skill's shared visual runtime is absent; the existing equivalent visual-lint workflow is used.

Documentation read: `frontend/README.md`; frontend Inspection, model, rendering-quality and orbital-trajectory documents; camera-transition review, perceptual results and focus-optimization results; trajectory-transition visibility review; architecture 03 and 04; ADR-0006 and ADR index. No ADR is created or changed: this corrects the existing future-only clearance implementation within the accepted physical/display boundary.

## Inspection measurement

Frozen real recorded backend UTC: **2026-09-30T15:45:59.975908Z**, CSS viewport **1280×720**, DPR **2**. These are historical diagnostic fixtures, not live onboard telemetry. The canonical pivot is the selected physical source position and tracking-frame translation. The off-origin NASA model is centred there in stable Inspection. No bounding-sphere surface, semantic module or lifted Overview origin is used as the range target.

Full before/after vectors, frame basis, three distances, FOV, scale and minimumPixelSize:

| Source | Range before→after, m | Forward, m | Left, m | Up, m | Elevation | FOV |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| GP/TLE | 90.0000000016→90.0000000016 | −66.3549603132 | −1.16e−10 | +60.8031186881 | 42.5000000011° | 100° |
| NASA OEM | 90.0000000004→90.0000000004 | −66.3549603134 | +4.66e−10 | +60.8031186853 | 42.4999999997° | 100° |

The reported canonical distance drift is **not numerically reproduced**. No camera constant, pivot or handoff is corrected. Accepted viewport widening remains `90 × max(1, 1.2/aspect)`: 900×700 remains 90 m; 390×844 gives 233.723077 m. A narrow panel can therefore have a larger range by design; the available evidence cannot identify the cause of the user's visual impression on their original viewport.

Canonical, rotated, close, far and limb Earth starts reach the same desktop endpoint for both sources. Last automatic pose and first stable pose have position/FOV error **0**, direction/Up roundoff about **1e−16 rad**, and range error below **2e−9 m**. No final-frame adjustment is introduced.

## Proven trajectory cause and correction

The existing hull already used the **displayed model**, including its lift and readable minimum-pixel scale. The defect was an unsigned distance test: a real future point could lie outside that hull on its **upstream** side and be accepted as the trail start. A later part of the same future line then appeared beyond the station, creating the brief crossing impression. The 10 Hz temporal search could also reuse a gap from an earlier camera/display pose while the mask followed the current pose.

The corrected bounded search derives each product's projected future direction from its actual sampled path and requires a start beyond the displayed hull's downstream support plus the existing gap/silhouette margin. It still bisects genuine sample intervals to ≤1 ms and hides insufficient coverage/projection. Visible entry/exit ticks refresh the temporal start after camera/model updates and before applying alpha. Overview retains its 10 Hz search and immediate source/product invalidation. The existing fragment mask continues to guard the full halo/body envelope.

The search replaces temporary filtered sample arrays with indexed iteration and reuses Date/pixel scratch output. The ramp calculation retains the first projected coordinates before scratch reuse. No spatial vertex, propagation, network request, primitive recreation, React state update, shader, color, horizon or fade is added or changed.

The accepted reveal stays hidden at ≤100 km, uses logarithmic C2 smootherstep over 100–10,000 km, and reaches full opacity at ≥10,000 km, with the existing captured Overview cap for nearer starts. Stable Inspection remains zero and Overview one. Active/inactive alpha and halo/body multipliers stay unchanged. The quantitative onset threshold is **maximum body alpha ≥0.005**; first perceptible centerline locations also apply the existing temporal ramp, endpoint fade and fragment mask.

The original 242-frame paired probe has **148 upstream-start frames** at that threshold before the fix and **0** after. This is a start-side invariant count, not a claim of 148 raster overlaps. Camera position differences are **0 m**; displayed-centre difference ≤2.33e−10 m and reveal difference ≤6.67e−16. The existing fragment mask can prevent literal hull overlap while still leaving a visible upstream fragment. Dense native captures and raster evidence below distinguish those cases.

## Exact bad frame and corrected equivalent

GP selected, frame **74** of the dense onset audit, exit **72%**, frozen UTC above. Camera world position `(−2973920.515, −6306380.455, −1165654.393) m`, direction `(0.583162397, 0.521799788, 0.622612720)`. Displayed ISS `(−2758509.915, −6203158.133, −923843.799) m`, screen `(706.294, 162.326)` CSS px; displayed range **339,895.480 m**. Reveal **0.120731005**, active body/halo **0.102621354 / 0.026681552**, inactive body **0.009658480**. These values match the corrected frame.

| GP start | Baseline | Corrected |
| --- | --- | --- |
| Genuine future gap | 0.001 s / 7.356 path m | 11.212407 s / 82,475.871 path m |
| Start epoch | 15:45:59.976Z | 15:46:11.187Z |
| Start screen, CSS px | (693.691, 248.754) | (710.383, 133.946) |
| Along projected future direction from ISS | **−87.342 px**, upstream | **+28.673 px**, downstream |
| First centerline alpha ≥0.005 epoch | 15:45:59.986Z | 15:46:11.204Z |
| First perceptible world point, m | (−2739441.940, −6160383.828, −917365.248) | (−2698532.430, −6187072.921, −850858.855) |
| First perceptible screen, CSS px | (693.709, 248.634) | (710.406, 133.794) |

The baseline's large **unsigned** clearance, about 62 px, was misleading: the point was on the wrong side. The corrected raw start clears the hull by 1.463 px versus the required 1.065 px including silhouette. OEM inactive independently advances 10.791498 s along its own unchanged path. Path metres are summed on each product's sampled path, not a spatial displacement or a model connector.

GP sequence, OEM sequence, and twenty successive onset captures per source (GP, OEM) compare baseline and final. They include the last fully hidden frame at 69.7%, the maximum-alpha threshold crossing at 70.5%, and 70.5–72.4% at 0.1% intervals. These percentages are diagnostic sample locations, not runtime reveal thresholds.

Native full-frame equivalents: baseline GP, final GP, baseline OEM, final OEM. Responsive departure at progress 0, with the accepted Inspection pose: narrow, mobile.

Raster measurements use settled native DPR2 trail-on/trail-off PNG differences, maximum RGB delta ≥2, within 150 CSS px of the station. The model is hidden in **both** diagnostic renders while its normal footprint mask remains, excluding model shading/size settling from the subtraction. Normal model-on screenshots above establish the actual appearance. The initial subtraction with the model visible included its settling pixels and was rejected as a trail-clearance measure.

At 72/73/75%, baseline GP has 1409/2156/982 upstream pixels; baseline OEM has 2264/2958/1206. All corrected raster probes have **0 upstream pixels and 0 envelope overlaps**. Minimum measured corrected fragment-to-hull-plus-silhouette clearance is **3.712 CSS px**. Across the full mathematical frame audit, minimum first-perceptible centerline clearance is **0.945627 CSS px**; these are different measures. The unchanged shader masks every halo/body fragment inside the hull plus silhouette and the current 0.75–4 px gap, then softens over 0.75 px. Very low-alpha frames can have no RGB-delta ≥2 pixels.

## Regression and frozen behavior

Validation: **74 exit sweeps / 12,506 rendered frames**, including **11,174 dense onset frames**, both sources and active/inactive products. Desktop departures cover 90 m, 58.5 m close zoom, 2 km maximum and 90°/180° orbit poses; responsive departures cover 900×700 and 390×844. Seven partial Back checkpoints are swept for both sources/builds. All perceptible starts pass the downstream and current-mask invariants; final wrong-side count is **0**, mask projection error **0 CSS px**, and saved Earth position/FOV errors **0**.

The separate actual-time reversal audit covers 28 Backs, with maximum opacity jump **0** and accepted camera/focus derivative gates passing. The existing focus matrix completes 40 actual-time entry/return cycles, day/night/terminator surfaces and responsive views. Native wheel/orbit/pinch, source selection before entry/Back, 56 semantic picks, refresh, delayed GLB and OEM loss during entry/Inspection/exit pass in development and served production. Source controls remain locked in Inspection; fallback is tested separately. Equivalent visual lint covers 12 cases with 0 blockers, browser errors or low-contrast findings; the existing 9/10 px metadata and Cesium credit title-without-alt warnings remain.

Frozen source manifest verifies 121 unchanged files, including 71 backend files and 8 public assets. `trajectoryRendering.ts` is identical outside scratch-coordinate retention in its clearance ramp calculation. Geometry creation, shaders, 85% future horizon, true endpoint fade, rounded cap, layer widths/colors/ratios and source contracts are identical. Camera/focus paths, hybrid pacing/C2 clock, durations, prewarming, arbitrary starts, Back continuity and final Earth restoration remain. Model orientation, scale/minimumPixelSize, 75 km display-only lift, silhouette, PNG/PBR/textures, MSAA 4, FXAA, native resolution, imagery and semantic picking remain. New products still use the existing ready-group replacement.

Frontend gates: **145 tests / 25 files**, typecheck and production build. Backend: **82 tests**, 0 failures/errors/skips, Maven test and verify. `git diff --check` passes. The existing large Cesium bundle warning remains. No new ADR, dependency, API or infrastructure is introduced.

Clean smoke test against the actual backend at 2026-10-02 08:12–08:13 UTC completes GP and OEM entry/return on development 5175 and served production 4175, with no interception, clock override, QA globals or JavaScript errors. Clean production Inspection. The served `index-GrC9QBoj.js` equals the clean build byte-for-byte, SHA-256 `19b7434102971abfb9c250d866b8e87857f95204232951659cea03bd139dc5a6`. Current GP quality is explicitly STALE/ELEMENT_TOO_OLD; OEM is available as source-provided predicted ephemeris. These remain distinct from live onboard telemetry. After the interrupted session, existing PostgreSQL was restarted with the same named volume and the stopped local backend/dev/preview processes resumed; no application configuration or source code was changed for recovery.

## Matched performance

Summary and full compressed traces compare `8af1496e` with the final source: Apple M1, Chromium 1234/ANGLE Metal, identical 1280×720/DPR2, archived real products and local imagery fallback, clock 1×. One browser runs at a time. Each source/build records a first entry/return plus a warm repeat. The trajectory timer includes existing hull/mask work. Timer resolution is approximately 0.1 ms; aggregate means do not imply that individual samples have finer precision.

| Build/source | Trajectory CPU mean, ms, before→after | Frame median, ms | P95, ms | Worst, ms |
| --- | --- | --- | --- | --- |
| Development GP | 0.0492→0.0764 | 41.20→42.30 | 56.60→57.00 | 81.70→85.60 |
| Development OEM | 0.0874→0.1133 | 49.15→44.20 | 67.10→65.90 | 99.30→95.30 |
| Production GP | 0.0662→0.0735 | 48.05→46.70 | 72.40→67.50 | 105.70→98.20 |
| Production OEM | 0.0584→0.0856 | 42.50→43.40 | 65.10→64.60 | 99.10→108.80 |

Mean added trajectory work is **0.0073–0.0272 ms**. No material frame-time regression appears in these matched local runs; medians change −4.95 to +1.10 ms and P95 −4.90 to +0.40 ms. The OEM worst-frame increase is an isolated sample, with lower P95; these measurements do not promise universal FPS or zero cost. All eight traces have 0 page errors and 0 retained transition objects. Model/globe/atmosphere/imagery providers and final Earth position/direction/Up/FOV are retained/restored.

The first performance recorder was interrupted by local disk exhaustion while writing its trace. Duplicated documentation/backend files were removed only from disposable archives, and the complete eight-run comparison was rerun successfully. Only completed final traces above are retained.

## Reproduction

Use Node 24 and the existing dependencies. Archive baseline `8af1496e44439f5761507bbcf8d927231b7e5a4b` and the final source into disposable directories without `.git`; symlink the installed `frontend/node_modules`. Apply the existing `../trajectory-transition-visibility-review/scripts/instrument.py`, which uses the accepted focus instrumentation and refuses a Git checkout. Build both copies and serve development and preview on separate ports.

Set `MISSION1_PLAYWRIGHT_MODULE`, `MISSION1_REPO_ROOT` and `MISSION1_EVIDENCE_DIR` to the local runtime, repository and temporary output directory. Run `scripts/clearance-audit.cjs port label`. `MISSION1_QA_WIDTH/HEIGHT` select responsive sizes; `MISSION1_QA_CANONICAL_ONLY=1` narrows a run; `MISSION1_QA_PARTIAL_ONLY=1` sweeps all seven Back checkpoints; `MISSION1_QA_ALLOW_BAD=1` records the baseline without enforcing the candidate clearance gate; `MISSION1_QA_RASTER=1` captures native on/off PNG pairs. Diagnostic overrides occur only in disposable builds. No diagnostic hook is shipped.

The accepted focus `browser-regressions.cjs`, `browser-matrix.cjs` and `visual-lint.cjs`, plus trajectory visibility `reversals.cjs` and `profile.cjs`, remain in their existing directories. Profiles use identical archived products and local imagery fallback, one browser at a time, first transition plus warm repeat, clock 1×. Clean development and production are separately checked against the actual backend with no route interception or QA globals.
