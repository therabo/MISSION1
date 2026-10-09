# Final gates and practical limits

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

This record refers to the production build `index-BmpYcoTR.js`, SHA-256 `0317c34f8b975521d7a744c6ff9039f138ab62c725159685ce57a2abd83a7361`, and the unchanged accepted baseline parent `6fbb52d7999cc189b9240a7cad5e6136c36f8164`. Raw build identity, functional summary, [complete performance/loading/memory tables](metrics.md), [source/assets and decisions](README.md).

The primary 60 FPS gate **fails** on the reference hardware. The user explicitly permits a measured, disclosed hardware-blocked result; that conditional outcome is applied, not relabelled PASS. Loading improves first use while fully refined settlement has the bounded extra cost detailed below. Source/native API limits are explicit. The six final actual-LIVE/Replay windows are complete: Overview GP 40.49 FPS, Overview OEM 43.86, Inspection OEM 42.19, Inspection GP 40.65, Crew visibly open 41.67, and persisted Replay 53.48. Their different real epochs are not used to infer a baseline speedup. The unconfirmed Crew click window is rejected and preserved separately; the final report links both valid source sessions.

| Criterion | Outcome and evidence |
| --- | --- |
| A — ISS quality | Verified practical native fidelity: all 19 original 512²/1024² PNGs, native GPU dimensions and PBR retained. |
| B — No fake ISS detail | PASS: no AI, upscaling, fabricated normal/emissive textures or changed source model. |
| C — Filtering | PASS: LINEAR magnification, trilinear minification, generated native GPU mip chains. |
| D — Oblique/anisotropic | Supported public controls maximized: imagery 16×; Model stays 1× because the pinned public glTF API has no override. This renderer limitation is disclosed; a private patch is not claimed as validation. |
| E — Day LOD | PASS: same verified level-8 source ceiling, exercised by normal-network close camera; no fictional higher source level. |
| F — Night quality | PASS: fine successful tiles survive one failed tile rather than losing the entire layer. |
| G — City lights | PASS: restrained brightness 1.15 reduces bleaching, fine source clusters survive an outage; normal regional/source-ceiling views reviewed. |
| H — Night semantics | PASS: static 2016 historical composite, night-only scene-UTC solar blend; no present-day power/telemetry claim. |
| I — Stars | PASS: JPEG→verified TIFF source, 2048²→4096² faces, 12 exact common edges, six lossless/browser pixel hash matches. |
| J — No fake stars | PASS: real catalogue visualization, no arbitrary stars; producer's own display intensity adjustment disclosed. |
| K — Contrast | PASS: cleaner source sky, finer retained dark-side clusters and restrained bright cores; no black crush or artificial glow added. |
| L — Atmosphere | PASS: unchanged source/lighting/projection helpers and natural fixed Earth limb/terminator reviewed. |
| M — Full-screen centering | PASS: 130 states at six viewports; maximum focus errors 1.847e−9 px dev / 2.323e−9 px prod versus 2 px limit; width/height/position/resize/below-dashboard assertions. |
| N — Camera | PASS: 13 original fixed camera/UTC pairs have zero recorded world-position delta; canonical 90 m/42.5°/lateral zero/100°, portrait widening retained; 12 transitions restore world position with zero recorded error. |
| O — Orientation | PASS: frame/alignment/attitude-availability semantics and helper bytes unchanged. |
| P — Trajectory | PASS: geometry, sampling, clearance, fragment masks, native raster and source selection helpers unchanged; GP/OEM/Replay exercised. |
| Q — Picking | PASS: native ISS click, 14 module picks in each of four dev/prod desktop/mobile cases (56 total), edge GPU hit beyond symmetric-lens bounds restored correctly. |
| R — Dashboard | PASS: App, styling and workspace measurement source bytes unchanged; no restyling. |
| S — Crew | PASS: current/historical Crew, open/detail/closed, desktop/mobile and four lifecycle cycles per build. |
| T — Replay | PASS: genuine persisted query/seek/return to LIVE, both camera modes; semantics/ownership unchanged. |
| U — Backend/data | PASS: all 210 backend files unchanged; no source/persistence/API/Orekit/schema changes. |
| V — Attribution | PASS: verified NASA product URLs, source hashes, dates and credits; no blanket third-party rights/endorsement claim. |
| W — Profiling | PASS: real baseline/final raw intervals, short cost isolation, final asynchronous GPU/CPU/draw/memory audit; contaminated/invalid candidates explicitly excluded. |
| X — 60 FPS | **FAIL / reference hardware blocked**: 1440×900 DPR1 Overview ~38.2 FPS, native DPR2 ~18.3 FPS. Smaller 900×700 reaches ~59.9 FPS; not substituted for primary target. |
| Y — Honest outcome | PASS: target failure, GPU/model/fill budget, low-cadence periods, DPR2 and 1% low all reported; no quality-reduction pass. |
| Z — Loading | First-use improvement accepted with explicit finite refinement tradeoff: cold Earth 615.8→485.0 ms, native ISS 1538.9→1255.6 ms, Inspection 2395.1→2067.1 ms. Original tile idle 3.40–3.80 s→final 4.07–4.25 s (+0.27–0.80 s); contemporary baseline 3.04–3.65 s exposes +0.60–1.12 s. No assertion that settlement is unchanged/faster; fourfold cube texels and permanent night protection cost extra work after useful ISS/Earth. |
| AA — React frames | PASS: no per-frame state introduced; six frozen steady windows record zero DOM mutation deliveries. Actual LIVE UI updates remain existing behavior. |
| AB — Allocations | PASS: new work occurs once at startup/source error; no new frame allocation loop. |
| AC — Context loss | PASS in audited cycles: zero observed WebGL context losses; no universal hardware claim. |
| AD — Texture thrashing | None observed: native model/cube allocations remain fixed; textures deleted on mode-return/tile demand changes; physical driver residency is not measurable. |
| AE — Tile runaway | PASS: all final benchmark/audit queues settle, verified source level bounds, per-tile two retries and bounded 1024-entry bookkeeping. |
| AF — Requests | PASS: only intended local protection/refinement and existing one probe/source/Viewer; no added polling/global preload or duplicate runtime high-res copies. Actual request/byte totals disclosed. |
| AG — Source/rights | PASS: source identity/derivative hashes/credits and NASA guidance recorded; historic/catalogue visualization limitations explicit. |
| AH — Cold/warm | PASS: cold, warm, repeat and untouched-build recheck on normal network; actual preview/cache behavior recorded. |
| AI — Fixed visual QA | PASS: original 13 pairs plus three normal source-ceiling/limb pairs; controlled single-tile outage kept separate; native close/oblique/regions/terminator and final desktop/mobile reviewed. |
| AJ — Dev/prod | PASS: 65 states each, six sizes each, zero application/console/ResizeObserver errors. |
| AK — Backend tests | PASS: Java 21, `mvn test` 382 and `mvn verify` 382, zero failure/error/skip. |
| AL — Frontend tests | PASS: 320 tests / 37 files; includes interleaved-tile retry regression. |
| AM — Typecheck | PASS: `npm run typecheck`. |
| AN — Production build | PASS: existing Cesium large-chunk warning disclosed; correct final bundle served. |
| AO — Diff | PASS: working and staged `git diff --check`, after evidence/doc audit before commit. |

## Functional/camera/lifecycle record

- LIVE, Replay, current/historical Crew and Detail, Overview, Inspection, GP, OEM, Back, Earth drag/wheel, ISS GPU pick, 56 mapped module selections, native orbit/zoom and responsive/dynamic dashboard changes pass.
- 12 entry/exit combinations record **8,322 frames**; maximum composition step 9.127522 px entry / 8.704242 px exit, below 40 px diagnostic threshold; world position restored at 0 m recorded error. Scene clocks are fixed only in camera QA while flight timing retains `performance.now`.
- Full-scene Earth pick under the 633 px dashboard succeeds at (40,760) in both builds. Native model edge pick succeeds at (1390,120), equivalent symmetric x=1750>1440, with frustum and minimumPixelSize restored.
- Two isolated 10-second lifecycle windows: zero idle geometry reads, Resize/Mutation callbacks or offset writes; 2 active ResizeObservers, 1 scoped layout MutationObserver, 1 window resize listener. Total active MutationObservers remain 3 including two existing vendor observers; four Crew cycles do not increase them.
- Eight local visual-lint states show no horizontal overflow, unnamed/clipped controls or unnamed visible images. Pre-existing small text is retained. Shared `capture_page`/`visual_lint` helpers are unavailable on this host; equivalent local Playwright capture/lint is labelled accordingly.
- Normal-network six supplemental captures have no injected failures or application errors; both untouched baseline/final night layers request level 8. The separately labelled outage injects one real-tile HTTP 503, preserving the final finer layer while the baseline removes it.

**Native two-finger pinch remains unverified.** No native touch hardware was tested.

## Frozen boundary and evidence

Frozen file audit: 5,529 starting tracked files, 5,511 unchanged, all 210 backend files and all prior evidence byte-identical. The 18 changed old tracked paths comprise six source/generator/manifests, six docs and six deleted old skybox PNGs. Six new runtime WebPs and this new dossier are intentional. No `dist/`, downloaded source TIFF/GLB, unused high-resolution asset, external context or new dependency enters Git.

`evidence/validation/` contains final frontend/backend/typecheck/build/generation/loading/GPU text logs. Saved text-log copies normalize runner-emitted trailing whitespace and extra EOF blank lines for the diff gate; result lines and measured values are unchanged, and the evidence manifest records each pre-normalization hash. Browser traces/JSON/PNG and logs are in `evidence/regression/`. `evidence/evidence-manifest.json` records exact sizes/SHA-256 for the saved evidence; it excludes itself to avoid a circular hash. Original/diagnostic runs remain labelled and are not mixed into final numerical acceptance tables. [Full context/read inventory](context-reviewed.md) and [six new runtime assets](assets.md) are separate.

No new ADR was needed for reversible local graphics/source/loading work in the accepted architecture. External `/Users/daniel/Desktop/mission1-project.md` is updated outside Git. Commit/push identity is recorded there and in the final response after the one ordinary commit, leaving this Git artifact unchanged afterward.
