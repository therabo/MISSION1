# Trajectory visual orientation and Inspection navigation — 2026-09-30

Baseline: clean synchronized `main==origin/main==3834026874757d5c994e7f1d3f7b2aafc3dc4571`. The instructions, private project skills, external project context, existing frontend/backend contracts and ADRs were inspected before implementation. The context file remains outside Git. Scope is visual model rotation, rear moving entry, close framing and Inspection navigation. RTN analysis, Replay and attitude telemetry were not started.

## Asset axes and physical state

The unchanged NASA VTAD runtime GLB SHA-256 is `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`. [Full transformed vertex/node measurement](asset-axes.json) applies all source node/root transforms. Source-space semantic bounds centers (m): Harmony `(0,0,15.019095)`, Destiny `(-0.435006,0.028047,6.927363)`, Zvezda `(-0.138211,1.965109,-25.832480)`, Tranquility `(5.868168,-0.000376,0.000031)`, Cupola `(7.119230,-2.982103,-0.100065)`. Harmony versus Zvezda establishes visual forward +Z/backward −Z; Cupola's placement/window side establishes visual down −Y/up +Y. Visual right is −X, left +X. This is a geometric visual-axis definition, not a publisher-defined structural engineering-frame registration.

Cesium's default glTF axis conversion is `(X,Y,Z)→(Z,X,Y)`: render +X forward, −X backward, +Z up, −Y right, +Y left. The residual asset correction is identity. Runtime vertices, root/node transforms, materials, textures and all 14 feature identities are unchanged. [NASA asset record](https://science.nasa.gov/resource/international-space-station-3d-model/) credits VTAD and dates the asset to 2019; it is historical geometry.

Position and velocity are ITRF_2020_IERS_2010 at the same sample UTC, m and m/s. GP/TLE uses the existing Orekit Earth-fixed PV; its TEME velocity is never mixed into this frame. OEM differentiates its existing bounded cubic Hermite source-position polynomial analytically, then transforms the full PV through Orekit. Merely rotating velocity would omit Earth rotation. An independent central finite difference of delivered OEM positions agrees within 3 m/s over the 31 s sample spacing, detecting that error. The authoritative NASA XML endpoint was reverified before implementation; the version used for the fixed measurements has hash `14f2dce1e0263fba4fee8e042a89173ec632768f8cd54190e7c0d99040ef2433`, EME2000/UTC, source XYZ km and XYZ_DOT km/s, creation 2026-271T17:13:16.701Z, coverage 2026-271T12Z…2026-286T12Z. [NASA product description](https://www.nasa.gov/general/spaceflight-nasa-gov-has-been-retired/) identifies predicted TOPO ephemeris. No new provider field or source was guessed.

The former API discarded velocity. Adding `velocityUnit:m/s` and three velocity components to the existing DTOs is necessary for correct selected-source orientation, and additive for position-only clients. Browser velocity has its own bounded degree-one interpolation; the original degree-one position interpolation, API XYZ and trajectory vertices remain unchanged. Comparing the old and augmented recorded products confirms identical XYZ/times for both paths. These test observations and fixed-clock backend captures are offline QA inputs, never runtime fallbacks. Receipt times used in the phase captures are controlled QA metadata, not a new provider observation.

## Shared visualization frame

`F=normalize(v)`, `L=normalize(WGS84Up×F)`, `U=normalize(F×L)`. Columns `(F,L,U)` are right-handed and orthonormal. The same physical frame drives model rotation and moving camera navigation. Model-only lift changes translation separately. Near parallel forward/up uses the preceding transverse axis projected off forward, or a deterministic least-parallel Cartesian axis. Invalid/zero velocity yields no frame; no invented identity attitude is returned. A matrix is updated in place, with reused scratch vectors/matrices and no quaternion-sign ambiguity. Normal orbital sequences keep up-axis dot products above 0.99.

Label: **TRAJECTORY_ALIGNED_VISUAL_ORIENTATION**. Verified onboard attitude: **UNAVAILABLE**. GP remains **COMPUTED_FROM_ORBITAL_ELEMENTS**; OEM remains **SOURCE_PROVIDED_PREDICTED_EPHEMERIS**. Neither is truth or measured attitude. Orientation never edits position, altitude, source velocity, clock, propagation, travel time or source vertices.

Tolerance: model-forward angular mismatch ≤ 1e-6°, orthonormal/right-handed checks 1e-12, camera/pivot continuity 1e-6 m and 1e-6°. The following served-production measurements use the actual rendered model matrix, physical evaluated velocity and camera. Full vectors, UTC precision and development equivalents are in [production-full.json](production-full.json) / [development-full.json](development-full.json).

| Source | Scene UTC | ITRF XYZ m | ITRF velocity m/s | Model forward | Forward error ° | Rear camera error ° |
| --- | --- | --- | --- | --- | ---: | ---: |
| PRIMARY_GP_TLE | 2026-09-30T15:46:07.8590579999945476Z | (-2710986.777, -6179726.490, -870779.156) | (3628.480, -2423.447, 5922.478) | (0.49325000, -0.32943962, 0.80509253) | 0 | 1.35e-09 |
| NASA_OEM | 2026-09-30T15:46:12.8590579999945476Z | (-2690872.837, -6192030.121, -838770.584) | (3645.113, -2383.462, 5927.184) | (0.49558182, -0.32405041, 0.80584737) | 0 | 4.89e-10 |
| PRIMARY_GP_TLE | 2026-09-30T16:16:07.3228579999959038Z | (4489854.911, 37653.125, 5097125.250) | (1911.579, 6885.621, -1737.665) | (0.25992748, 0.93627438, -0.23627949) | 0 | 0 |
| NASA_OEM | 2026-09-30T16:16:12.3228579999959038Z | (4499770.816, 74758.221, 5086609.515) | (1885.896, 6883.131, -1772.063) | (0.25646154, 0.93603175, -0.24098143) | 0 | 4.48e-10 |
| PRIMARY_GP_TLE | 2026-09-30T16:46:03.4864080000006652Z | (304211.283, 5739930.277, -3629025.550) | (-5342.011, -2493.685, -4399.739) | (-0.72619453, -0.33899223, -0.59810180) | 0 | 2.62e-09 |
| NASA_OEM | 2026-09-30T16:46:08.4864080000006652Z | (274708.057, 5725833.785, -3652299.307) | (-5345.486, -2528.743, -4373.904) | (-0.72675721, -0.34380083, -0.59466372) | 1.59e-15 | 1.12e-09 |

## Rear camera, framing and controls

At final entry camera local coordinates `(Forward,Left,Up)=(-119,0,0)m`, with lateral/up residuals below 6 nm. Direction is toward the physical center along +Forward. No deliberate vertical offset is used. The previous arbitrary ENU 35°/−10° pose was 340 m away and about 108.90° away from the desired forward-looking rear direction. [Original fixed baseline pose](baseline-baseline.json). The moving approach reevaluates selected physical state every tick; handoff displacement is 0 m in both builds/sources, direction/up below 2e-10°. Model center and physical pivot errors are below 1e-8 m.

Canonical desktop is 1280×720 CSS / DPR 2 /2560×1440 backing. Camera distance **340→119 m**, **65% reduction**. FOV eases from captured Overview value to 85° during approach and restores on Back; no last-frame camera correction is introduced. Scale remains 1, minimumPixelSize remains 80 in all modes. The old 80→158 approach enlargement is removed. Overview 75 km lift and white silhouette 0.5/alpha 0.12 retain their early 1.75 s fade and captured-value 1.2 s restoration, including partial Back.

| Rear candidate | Old-distance fraction | Conservative projected bounds CSS px | Viewport height occupancy | Finding |
| --- | ---: | --- | ---: | --- |
|119 m |35% |873.05 × 537.08 |74.6% |Chosen: substantial station, all major structures in view. |
|102 m |30% |1077.48 × 662.84 |92.1% |Less surrounding room and more overlap with UI. |
|85 m |25% |1406.93 × 865.51 |120.2% |Clips major structures. |

The old conservative footprint was 375.53 × 300.36 CSS px (41.7% viewport height). Bounds overestimate visible geometry. A second comparison freezes both versions at the identical `2026-09-30T15:45:59.975908Z` and physical pivot. Paired model/background PNGs isolate actual geometry within the conservative bounds (RGB difference >20, DPR 2). Visible raster bounds grow **314.5×252.5 → 700.5×386 CSS px**, or **35.1%→53.6%** of viewport height. [Raw result](raster-footprint.json), [portable measurement](measure-raster.py), [baseline image](baseline-fixed-model.png), [new image](production-fixed-model.png). Run `python3 docs/frontend/inspection-orientation-review/measure-raster.py` with Pillow/NumPy; all four native 2560×1440 PNGs are retained beside it. Screenshots verify composition. 900×700 retains 119 m; 390×844 uses 309.034 m to fit the complete station, has no horizontal overflow, and can immediately zoom/pinch closer. Canonical closeness is preserved; narrow framing does not change model scale.

Baseline public controller: zoomFactor 0.01; native wheel/right-drag/pinch, left drag orbit; minimum 1 m, maximumInfinity, inertiaZoom 0.8, spin/translate 0.9, translate/look/tilt enabled. Overview zoomFactor 5. Native 0.6 tuning at 119 m still required 40 inputs for only 119→108.3 m, so a larger multiplier alone was insufficient.

Inspection preserves native station-centered drag orbit, with spin inertia 0.7; it restricts translation/look/tilt and disables native zoom to avoid duplicate actions. The existing Viewer public WHEEL/PINCH_MOVE actions change only local camera range. Wheel uses exponential fractional scaling (coefficient 0.003), at most 26% inward per event; pinch uses spread ratio bounded 0.7…1.43. A directional centered-model box plus 5 m clearance prevents entering geometry while allowing axial module views near 35 m; maximum pivot range 2 km. Camera lookAtTransform keeps the selected moving physical pivot. Overview and transition profiles restore captured public settings; inputs are blocked during entry/exit. No second orbit control system or new dependency is added.

Reproducible wheel test: Playwright mouse wheel deltaY±100, cursor(800,350), 600 ms settling per input; same 119 m starting range. On this DPR 2 Chromium the delivered Cesium wheel delta is 50. Old profile: 237 inward inputs to 59.355 m, 244 outward to 116.695 m (within 2% of start). New: **5 inward to 56.212 m, 5 outward to 119 m**, both sources/builds; roughly 47–49× fewer inputs. This exceeds the 2–4× investigation target because baseline response was unusably slow; bounding and fractional inputs retain precision rather than preserving dozens of required actions. Actual touch spread 200→280 px moves 119→85 m and reverses to 119 m without lateral drift. Native drag orbit stays centered; no custom spin sensitivity is layered on top. [Baseline matched-range control test](baseline-control-baseline.json), [development touch/picks](development-extra.json), [production touch/picks](production-extra.json).

## Browser/runtime and regression evidence

Stale backend/dev/preview instances were stopped; current Java 21 backend runs on 8080, Node 24 Vite dev 5173 and served production 4173. PostgreSQL 16.10 stayed healthy and its existing volume was preserved. Baseline 3834026 was archived separately for controlled measurement; its temporary preview is stopped after comparison. The final served JavaScript hash matches the clean local build, and the pinned model hash remains unchanged. Temporary public-API instrumentation was removed before final build/commit.

Both builds cover GP and OEM, three separated phases, direct model click and moving approach, rear pose, candidate framing, wheel in/out, native drag,900 px and 390 px viewports, partial Back and restored Overview settings. No model flip or duplicate model/texture load was observed. Both builds/sources actually click all 14 verified feature identities and open their correct panels: Destiny, Columbus, Harmony, Pirs, Poisk, Zvezda, Rassvet, Zarya, Kibo Exposed Facility, Kibo Pressurized Module, Quest, Cupola, Tranquility, Unity. Pirs remains historical/removed and all module telemetry remains unavailable. Touch pinch, unchanged-response refresh while inspecting, explicit OEM outage fallback to GP/Overview, delayed GLB with disabled Inspect and temporary locator are verified. QA failures in earlier runs were diagnostic-only: HMR during instrumentation work, too-short fixed wait for return, and a selected-module HTML panel covering a subsequent canvas pick. The final runs wait for the actual mode and close the panel between geometric picks.

The accepted cyan/amber/inactive colors, continuous future-only 85% paths, soft starts, adaptive target and clearance mask are unchanged. Inspection still hides paths and silhouette. Tests preserve the display/physical isolation and original source vertices. Final browser checks additionally verify current Overview clearance and globe navigation.

## Validation and performance

Frontend 84 tests/17 files, typecheck and production build pass; backend 82 tests with 0 failures/errors/skips, full Maven test/verify pass on Java 21. Maximum short-response payload is 43,885 bytes under the updated 50 KB guard. Existing Cesium bundle-size warning remains. git diff --check passes. Final noninstrumented runtime and artifact identity are recorded in [validation.json](validation.json) and [final-live-qa.json](final-live-qa.json).

No new ADR: ADR-0006 receives a dated clarification of its existing physical/display and selected-source decision, including additive velocity delivery. No source, persistence or deployment boundary changes. All relevant frontend/API/architecture docs and the external context are updated.

Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**. Not started.


## Matched local performance

Canonical Overview camera and UTC are frozen identically in a fresh single active Chromium page, CSS 1280×720 / DPR 2 / backing 2560×1440, 4× MSAA. Each version gets 10 s settling, one discarded 5 s warm-up and five 5 s steady windows. The baseline is the untouched 3834026 application with only a temporary public Viewer getter for measurement. The second round records the same renderer for both: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`.

| Matched round | Baseline median FPS | Updated median FPS | Change |
| --- | ---: | ---: | ---: |
| First | 11.793 | 11.679 | −0.97% |
| Repeat | 12.593 | 12.706 | +0.89% |

Raw windows: [baseline first](baseline-performance-first.json), [updated first](production-performance-first.json), [baseline repeat](baseline-performance.json), [updated repeat](production-performance.json). The historical approximately 25 FPS was **not reproduced by either version** in this session. The result supports no material local relative regression; it does not promise 25 FPS or a hardware-wide minimum. No cause for the absolute difference was established. No further performance tuning or rendering redesign is introduced.

## Final runtime and artifact checks

The clean build is `index-LCIvlTyu.js`, SHA-256 `557dcc3645a22f284a6d573cab8c730569ae88907c590865acfe5a8a173d49ce`; the served response matches it. Runtime GLB remains 32,735,516 bytes / the pinned SHA above. No temporary `__qa` getter exists in source or the final running builds. [Validation receipt](validation.json).

Both builds pass actual current backend GP and OEM selection, entry, completed Inspection, explicit attitude-unavailable labeling and Back: [final live QA](final-live-qa.json). The fresh live OEM file naturally differs from the frozen source version used for numerical reproduction; its creation date remains visible in the saved readout. [Overview](final-overview.jpg), [primary Inspection](final-primary-inspection.jpg), [OEM Inspection](final-oem-inspection.jpg), [narrow](narrow-inspection.jpg), [mobile](mobile-inspection.jpg).

An earlier production live run received NASA GIBS night-tile CORS errors: [unfiltered observations](final-live-provider-errors.json). Orbital/Inspection behavior completed, but a blanket zero-console-errors assertion failed on those external imagery requests. A fresh live repetition had no console/page errors. A separate controlled GIBS 503 outage confirms HTTP 200 for the existing local Black Marble fallback and usable GP/OEM entry/Back in both clean builds, with no application page errors: [fallback QA](fallback-live-qa.json), [fallback view](imagery-fallback-overview.jpg). Native solar lighting, historical day/night imagery policy and the existing fallback code are unchanged; the provider outage is not hidden as an application success with zero external errors.

## Context review and changed documentation

Read before implementation: private `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`, external `/Users/daniel/Desktop/mission1-project.md`, frontend/backend READMEs, orbital-trajectory-rendering, rendering-quality, iss-inspection-mode, iss-model, trajectory-presentation-review/README, architecture 03/04, orbital-comparison, ADR-0005/0006 and ADR index. Relevant source/lifecycle and existing public Cesium controller APIs were inspected.

Actual private project skills read: `iss-3d-earth-view`, `iss-3d-station-view`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `devops-local-platform`, `flight-dynamics-orekit`, `realtime-api-contracts`, `iss-public-data-sources`, `architecture-decisions`; also personal `frontend-design-codex`. These cover the required visual work and the necessary physical-velocity DTO extension.

Updated documentation:

- [Frontend README](../../../frontend/README.md), [backend README](../../../backend/README.md).
- [ISS model](../iss-model.md), [Inspection](../iss-inspection-mode.md), [rendering quality](../rendering-quality.md), [orbital trails](../orbital-trajectory-rendering.md), [preceding presentation review](../trajectory-presentation-review/README.md), this review and its evidence.
- [Roadmap](../../architecture/03-repository-and-roadmap.md), [orbital delivery](../../architecture/04-earth-view-orbital-delivery.md).
- [Short sample API](../../api/orbital-samples.md), [comparison API](../../api/orbital-comparison.md).
- [ADR-0006 clarification](../../adr/0006-selectable-forward-trajectory-visualization.md), [ADR-0005 cross-reference](../../adr/0005-separate-nasa-oem-comparison-trajectory.md), [ADR index](../../adr/README.md).

The external context is updated separately and remains outside Git. No new ADR is created. Commit/push use a normal new main commit and explicit existing SSH identity; no prior history is rewritten. Final Git synchronization is reported with the delivered commit.
