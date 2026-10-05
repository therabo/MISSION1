# Inspection module hover

2026-10-05 · Europe/Rome · one isolated frontend milestone.

## Goal and baseline

Stable ISS Inspection exposes the existing clickable semantic modules through a temporary cyan tint and pointer cursor. Camera manipulation and transitions suppress that feedback. No telemetry, panel, model asset, camera policy, dashboard layout or backend change is introduced.

Baseline: clean synchronized `main`, `origin/main` and GitHub main at `d2ebd5f9c0fe99c880d5b48adf0abc0b6e872bb1`. Fetched and checked with `git ls-remote` before editing. Accepted baseline gates: 320 frontend tests / 37 files; 382 backend tests. Repository: `/Users/daniel/Desktop/MISSION1`. Instructions/skills: `/Users/daniel/Documents/ChatGPT/MISSION1`. External project context: `/Users/daniel/Desktop/mission1-project.md`, outside Git.

## Existing identity and ownership

The accepted NASA GLB has `EXT_mesh_features` IDs 0–13 and a 14-row `EXT_structural_metadata` property table with `moduleCode` 1–14. Only directly verified primitives are tagged; descendants, arrays, trusses, radiators and miscellaneous geometry stay unmapped. `Model.fromGltfAsync` selects the `missionModule` feature set. Click picking returns a public `ModelFeature`; `resolveVerifiedModulePick(featureId, moduleCode)` requires both fields and `VERIFIED` status to match the pinned manifest.

Hover's `resolveInspectionHoverPick` calls that exact resolver. It adds no node/mesh mapping. The same existing model-ready, valid sampled position and ≤1,000 m distance gate applies. `Scene.pick` passes through the accepted full-screen/off-center projection adapter. Existing `LEFT_CLICK`, module panel and source controls are unchanged. No persistent selected-module visual styling existed; none was invented.

`InspectionHover` owns only pointer/motion/temporary appearance state inside the persistent Viewer lifecycle. It never publishes React hover state or changes selection. All timers, listeners, cursor and colors are restored before model/Viewer disposal. This is a local reversible interaction addition, with no technology, API, domain or infrastructure decision requiring a new ADR. Existing ADR-0006/0011 remain applicable.

## Public Cesium mechanism and visual treatment

Public [`ModelFeature.color`](https://cesium.com/learn/cesiumjs/ref-doc/ModelFeature.html#color) plus public [`Model.colorBlendMode` / `colorBlendAmount`](https://cesium.com/learn/cesiumjs/ref-doc/Model.html#colorBlendMode): cyan **#53d9cd**, opaque alpha 1, `ColorBlendMode.MIX`, amount **0.45**. The original source contribution remains 55%. The pinned 1.145 `MaterialStageFS` explicitly bypasses MIX for white untouched features, so only the hovered feature is affected. Exact previous feature color and model blend mode/amount are restored on every clear. No style, texture replacement, geometry, scale, bloom, lighting setting or custom shader change is made.

The authored NASA PNG/PBR remains recognizable. Fixed real-time-source scenes at three camera angles compare normal, hover and restored states. Normal/restored images are **pixel-identical in all three full screenshots**. Zvezda changes 2,867 pixels in the canonical view and 2,162 in the shadow-facing view; Zarya changes 448 in the oblique view (threshold >2 channel values). Shadow-face mean RGB on changed pixels rises from approximately (88,90,92) to (86,113,115), preserving texture and shading. These are display measurements, not station radiometry. Small occluded Destiny facets naturally give a smaller visible affordance than an exposed module.

| View | Normal | Hover | Restored |
| --- | --- | --- | --- |
| Canonical Zvezda | [PNG](evidence/visual-canonical-zvezda-normal.png) | [PNG](evidence/visual-canonical-zvezda-hover.png) | [PNG](evidence/visual-canonical-zvezda-restored.png) |
| Oblique Zarya | [PNG](evidence/visual-oblique-zarya-normal.png) | [PNG](evidence/visual-oblique-zarya-hover.png) | [PNG](evidence/visual-oblique-zarya-restored.png) |
| Shadow-facing Zvezda | [PNG](evidence/visual-shadow-zvezda-normal.png) | [PNG](evidence/visual-shadow-zvezda-hover.png) | [PNG](evidence/visual-shadow-zvezda-restored.png) |

[Raster measurements](evidence/visual-raster.json), [frozen scene time and poses](evidence/visual.json). Additional development/production normal, two different hovered modules and non-module screenshots are in `evidence/`.

## State machine and motion suppression

| State or event | Behavior |
| --- | --- |
| Overview / entry / exit | Clear appearance and cursor; no hover pick |
| Stable Inspection, changed mouse coordinate | One native pick; recognized module paints, empty/unmapped clears |
| Same coordinate / stationary pointer | No hover picks or state updates |
| A → B | Restore A before painting B; only one target |
| Pointer leaves canvas / window loses focus | Restore appearance, clear cached pointer |
| Pointer-down on canvas | Immediate clear in capture phase, before displacement; held gesture blocks picking |
| Wheel on canvas | Immediate clear in passive capture listener, before pivot zoom |
| Orbit, inertia, translation, programmatic local pose/lens change | Clear before rendering, keep settlement pending |
| Stable for 200 ms | One re-pick of current coordinates against the new projection, never reuse old feature |
| Exit / model loss / source invalidation / unmount | Existing mode/failure path clears; cleanup restores before destruction |

Public `camera.moveStart/moveEnd` listeners and an allocation-free `preRender` guard observe **local position/direction/up/right and lens**. Cesium 1.145's movement event comparison includes the tracking transform, which changes continuously as the real bounded ISS sample is followed; `moveEnd` alone cannot define stable Inspection. The 17-number local/lens snapshot distinguishes orbit/inertia/zoom and composition changes from coherent station following. Numerical tolerance is 1e-7 m for position and 1e-10 for basis/lens. It changes no camera property.

The guard performs **no picking**. It only clears/reschedules the 200 ms timeout while the view changes. Picking occurs in the Cesium mouse-move action or the settlement timeout, with one final motion check before picking. No `Scene.pick` is placed in `preRender`, `postRender`, RAF or `camera.changed`. The original 90 m / 42.5° / 100° / zero lateral pose, 6 s entry and 5 s exit remain unchanged. Canvas inline cursor restores its exact original value whenever hover is ineligible; CSS keeps ownership of the normal Inspection cursor.

Touch pointer input clears hover and cannot activate it. No mobile hover gesture was added.

## Browser validation

Development 5175 and built production 4175 use the unchanged backend 8080 and real GP/TLE and NASA OEM responses for interaction QA. No orbital response interception, scene-time override or synthetic values are used in these interaction runs. QA-only public camera poses expose mapped surfaces from multiple directions. The separate visual/performance harness freezes real captured scene time solely for reproducible comparisons.

Required sequence exercised: enter → stable → A → B → empty → A → pointer-down/orbit → inertia → settlement re-pick → wheel clear → settlement re-pick → exit. Boundary checks include background and untagged structure. Synchronous post-input checks and frame traces verify no tint while a gesture is held, during actual transitions, or on frames with view displacement; never two tinted features. Static wheel input re-picks the same coordinates within browser subpixel rounding. Canonical range/elevation/FOV, focal composition, full-screen canvas and captured Earth restoration pass. Existing module clicks, orbit, zoom, Back, GP/TLE, OEM, LIVE, Replay Inspection, Crew list/detail and Return to LIVE pass.

Four required viewport sizes: **1440×900, 1280×720, 900×700, 390×844**, both builds. Desktop hover is tested at the first three sizes; 390×844 checks layout, Inspection, Back, Crew and Replay, without a touch-hover claim. A final clean browser smoke also passes both builds and both sources for hover, drag, wheel and Back, with no QA globals, scene hooks, clock override or request interception. [Clean smoke](evidence/clean-smoke.json). Page/console errors: zero in accepted interaction runs. Visual lint: zero horizontal overflow or visible unnamed controls; existing small typography/credit presentation is unchanged.

### All 14 identities

Each module passed native pick, shared resolver recognition, temporary color, exact restoration, and click-panel checks for **both GP/TLE and OEM in both builds**: 56 module/source/build cases. Semantic IDs and feature codes remain unchanged.

| Feature ID / code | Module / component ID |
| --- | --- |
| 0 / 1 | Destiny / DESTINY |
| 1 / 2 | Columbus / COLUMBUS |
| 2 / 3 | Harmony / HARMONY |
| 3 / 4 | Pirs / PIRS |
| 4 / 5 | Poisk / POISK |
| 5 / 6 | Zvezda / ZVEZDA |
| 6 / 7 | Rassvet / RASSVET |
| 7 / 8 | Zarya / ZARYA |
| 8 / 9 | Kibo Exposed Facility / KIBO_EXPOSED_FACILITY |
| 9 / 10 | Kibo Pressurized Module / KIBO_PRESSURIZED_MODULE |
| 10 / 11 | Quest / QUEST |
| 11 / 12 | Cupola / CUPOLA |
| 12 / 13 | Tranquility / TRANQUILITY |
| 13 / 14 | Unity / UNITY |

Pirs retains the historical-asset/removed-current-configuration disclosure. Hover does not assert current configuration or available telemetry.

## Performance and gates

Interaction traces measure zero additional picks during stationary windows, zero picks during held orbit and active wheel movement, then one re-pick after settlement. Twenty changed empty-space movements yield 20 picks; five A↔B cycles yield 10. Identical coordinates are skipped. There is no frame-cadence React hover state.

Matched sequential headless Chromium/ANGLE Metal Apple M1, 1440×900 CSS, DPR 1 with the retained 1.25 supersampling and MSAA 4; same captured real GP/OEM responses, scene UTC and frozen physical camera. No other test/browser workload ran during these windows. 10 s warmup + 15 s capture each:

| Build / state | Frames | Median ms | P95 ms | P99 ms | Stationary picks |
| --- | --- | --- | --- | --- | --- |
| Accepted baseline / normal | 562 | 26.4 | 30.4 | 34.2 | 0 |
| Candidate / normal | 563 | 26.0 | 31.1 | 35.4 | 0 |
| Candidate / hovered | 610 | 24.3 | 26.7 | 28.8 | 0 |

No material local steady-frame regression is observed. The faster hovered window is within timing/cache/thermal variability and is **not evidence of a hover speedup**. [Raw intervals, poses and input](evidence/performance.json), [summary](evidence/performance-summary.json), [served artifact hashes](evidence/build-artifacts.json). These headless comparative results are distinct from prior headed/display FPS measurements.

The motion guard samples 17 reused numbers, without new arrays, pick calls or React work per render. Native GPU picking remains a synchronous operation. Instrumented input traces include native pick timing; production median/P95 were 24.6/68.8 ms for the 31 empty/module-movement-phase calls (including one pose-settlement pick). Development's 89.8/146.8 ms window ran with overlapping browser QA workload; neither is an isolated latency benchmark. The explicit event count, zero stationary/moving work and unchanged draw/asset architecture are the acceptance basis. Browser frame traces also record orbit, wheel, empty and repeated-module movement, with no hovered displacement frames. [Interaction summary](evidence/interaction-summary.json).

Final gates: **344 frontend tests / 38 files** (320 baseline + 24 focused cases); typecheck and production build pass. Java 21 **mvn test: 382**, **mvn verify: 382**, zero failures/errors/skips. Large Cesium chunk warning remains pre-existing. Dev and production QA pass at all four sizes, with 16,126 rendered interaction frames and 56 module/source/build cases. Working/staged diff checks pass. Scope audit: only four existing tracked files changed (EarthView wiring plus three docs); **5,955 baseline files unchanged**, including **210 backend files**, all assets, camera/control/projection/trajectory helpers, App/CSS, graphics/lighting/DPR policies and previous evidence. [Audit](evidence/scope-audit.json). No backend/data/API change.

## Reproduce

Use Node 24 and installed project/runtime Playwright. Start the existing backend, `npm run dev` on 5175, and built `npm run preview` on 4175. From repository root:

```sh
node docs/frontend/inspection-module-hover/scripts/qa.cjs 5175 development
node docs/frontend/inspection-module-hover/scripts/qa.cjs 4175 production
node docs/frontend/inspection-module-hover/scripts/visual.cjs
```

`MISSION1_QA_WIDTH=1440` repeats only the desktop audit. The scanner reuses the accepted model-center inventory from `inspection-orientation-review/asset-axes.json`; its native GPU searches are offline QA, never production hover work. `qa.cjs` records raw frame/input/pick evidence and compact module/results files. It uses React refs to locate the Viewer/mode only inside the browser harness; no QA global enters source/bundle.

`performance.cjs` expects an isolated baseline preview at 4185 and the candidate at 4175. It routes the two **recorded real** backend responses in this dossier, pauses the QA scene clock, uses the same physical pose/epoch, and measures sequentially with no concurrent test/browser workload. Each window has 10 s warmup + 15 s capture. No public-source data is fabricated.

## Known limitations

- Native two-finger pinch remains unverified.
- Hover applies to visible tagged surfaces; occluded modules require another angle. Untagged structure remains deliberately ineligible.
- The pinned Cesium metadata feature API is experimental; an upgrade must repeat GLB/resolver/render/pick validation.
- Measurements are local Chromium/ANGLE Metal Apple M1 observations, not universal frame-rate guarantees. Original ambient/PBR lighting still governs very dark surface visibility.

## Harness audit notes

The first headed QA observer used an incorrect model ID and stopped its own Cesium render callback. It was corrected before accepted runs. Headed trials were also affected by host mouse movement; deterministic interaction QA uses headless Chromium with actual browser mouse events. Exact floating-point pointer equality was corrected to a 0.001 px bound. A phase marker set just before pointer-down could include a legitimate pre-input highlighted frame; final assertions observe actual view mode and captured held-input state. These harness fixes do not modify product behavior or loosen movement suppression.
