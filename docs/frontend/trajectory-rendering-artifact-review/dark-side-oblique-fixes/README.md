# Dark-side and oblique trajectory artifact review — 2026-10-03

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../../qa-artifact-policy.md) for archive recovery and current evidence.

Status: accepted after real raster and final regression validation. This dossier records the acceptance gates; the published revision is reported with delivery.

Accepted baseline: `824f3e67f97a9df1034d4a6a453ee4d172a803e3`, initially clean and synchronized on main. The supplied screenshots were taken after reload at this commit, as confirmed by the user.

## Reproduction and root cause

Screenshot 1: baseline Chromium and WebKit reproduce the two near-horizontal/vertical interruptions over Brazil. Frozen viewport 1920×992, DPR 2; camera geodetic −39° / −14°, nominal Earth radius 23,200,000 m; UTC `2026-10-02T22:27:11Z`. Exact camera basis and layer/mask/depth state are recorded in `rectangle-baseline-*-sweep.json`. This is an equivalent composition from stored real source inputs, not the original browser response or a recovered original camera.

The current implementation has a circle/source-point fragment SDF, not the former rectangular eight-corner fragment test. Both body and halo are cut by the projected protected region of an ISS behind Earth. Its locally near-horizontal/vertical tangents at the two trail intersections give the screenshot's rectangular impression. The Earth imagery is not covered by an opaque quad. Disabling only this mask restores the trail. Capsule, reveal, silhouette, FXAA and depth isolation do not remove the cut. The same geometry shows the cut with diagnostic daylight, terminator and night lighting; darkness emphasizes it.

Screenshot 2: the recorded real September 30 fixture, range 1,500,000 m, 20° to the representative forward direction and 15° transverse azimuth, produces thin bright fins at the projected fold. Body alone is smooth; halo alone shows doubled triangle contributions. A solid-alpha and segment-ID diagnostic proves overlap inside the intended capsule, which the previous outside-capsule pixel check could not detect. Disabling mask, FXAA, silhouette or depth does not fix it. Independent segment capsules without overlap ownership were rejected because their caps looked lumpy.

## Final candidate mechanics

Physical buffers, epochs, source interpolation, endpoint and 85% horizon remain retained. Four encoded adjacent-endpoint attributes per segment add 138,240 bytes for two 181-point source paths and both layers. Public `PolylineGeometry.createGeometry` produces the unchanged source positions and indices once per response; no new sampled epoch or intermediate physical point is introduced. The resulting public geometry is submitted synchronously so the added attributes survive preparation. Source refresh, ready-group replacement and destruction remain in the existing lifecycle.

The shader projects/clips actual segment endpoints, constructs independent non-folding quads, and assigns overlapping adjacent capsule coverage to a globe-visible segment first, then the nearest segment (previous segment wins ties). It uses genuine clipped source times with perspective-correct interpolation. A globe-hidden neighbor cannot discard an eligible foreground fragment. Genuine nonadjacent trajectory crossings retain normal translucency.

The protected region remains the curved circle/source-point shape at every future epoch. A per-fragment ellipsoid ray test suppresses protection where even the nearest possible displayed sphere lies behind Earth. This is conservative at the limb and avoids a center-only visibility switch. Local first-exit selection remains unchanged and cannot move the physical endpoint or clip the far body.

Render state remains translucent, `depthTest=true`, `depthMask=false`, native blending and OIT, with no depth-fail appearance. No camera, model, illumination, imagery, MSAA, FXAA, DPR or quality retuning belongs to the production change. Lighting overrides, layer isolation and synthetic GPU tests are confined to disposable QA copies.

## Validation

Both screenshot classes pass real before/after raster validation. Final angle, lighting, source, GPU, camera, workflow and performance gates pass as recorded below. Prior evidence remains untouched. No new ADR or ADR-0006 change.

## Reproducibility and scope

The supplied screenshots are acceptance references. The user confirmed a reload after `824f3e67`; a stale page is excluded. The October fixture was recomputed by unchanged production Orekit/application classes at a fixed clock from persisted real GP and OEM inputs. It is not a recovery of the original HTTP response. Its GP geodetic position is 50.121583° N, 112.039590° W, 427.992 km. GP is computed from elements; OEM is source-provided predicted ephemeris. No synthetic ISS source value was introduced.

October GP: epoch `2026-10-02T00:19:52.567968Z`, acquired `2026-10-02T19:55:24.125335Z`, input SHA-256 `0c85e10d2694c2964c1cb29a9266e92b8ec50aafe1c0152a6c81e9b664b44794`. OEM: created `2026-10-02T16:36:47.957Z`, acquired `2026-10-02T21:01:41.480372Z`, coverage October 2 14:00 through October 17 14:00 UTC, input SHA-256 `78790d7a8c1b5ac9285b43cc889f8d3272385b2afda1289e95300049283acdad`. The independent September fixture remains at `../../inspection-orientation-review/real-{samples,comparison}.json` with its existing provenance.

The exact October GP camera is `[17500612.954839613, -4363392.876561657, -14578658.424098518]` metres, direction `[-0.754611654283739, 0.1881458166847534, 0.6286194420181307]`, up `[0.6099467580441941, -0.15207680702383133, 0.7777130557710947]`, range to displayed model 27,579,308.685 m. Protected center `[689.4989689193003, 267.74204885529895]` CSS px, radius 44.954112 px, softness 4 px, drawing-buffer/CSS factor `[0.5,0.5]`. At the two far-trail mask intersections the boundary tangents are only 3.778° from horizontal and 2.586° from vertical. This explains the rectangular impression from the curved mask in the current renderer.

The exact September GP oblique camera is `[-3553079.2563165347,-6218120.159880558,-2206772.2454813416]`, direction `[0.5222454225300295,-0.006817680533893257,0.8527679859601724]`, up `[-0.24951145529752206,-0.957431819446675,0.145149387826275]`, UTC `2026-09-30T15:45:59.975908Z`. Candidate camera agrees within floating-point roundoff. Source-specific OEM cameras/states are recorded separately.

The baseline uses public `Primitive` + `PolylineGeometry`, `ArcType.NONE`, two translucent `PolylineMaterialAppearance` layers, native polyline extrusion and custom genuine-segment capsule coverage. Native miter extrusion can fold/self-overlap inside a valid capsule. The Fabric stack combines existing source-time future clipping, reveal, endpoint fade, body/glow and the curved circle/source-point SDF. There is no rectangular clipping plane or depth-fail appearance. Zero-alpha fragments do not write depth (`depthMask=false`); neither OIT nor FXAA is the cause identified by isolation.

The final overlap rule ranks globe-visible adjacent coverage first, then nearest capsule, with previous-segment ties. It considers only neighbors whose capsule covers the current pixel and whose genuine source time is in the future window. A supplementary actual-shader GPU test exposed duplicated pixels at mixed foreground/behind-Earth joins in the first candidate; that candidate was rejected. The final rule removes these duplicates while preserving the union. Nonadjacent physical crossings continue using native translucency.

QA hooks, frozen time, lighting changes, shader diagnostics, route interception and CPU timing exist only in disposable archives. GIBS daytime tiles are deliberately aborted in reproducible fixture runs; pinned local Earth/night imagery remains visible. Clean live smoke uses the actual backend and uninstrumented app without route interception. Chromium uses ANGLE Metal on Apple M1, DPR 2. Playwright WebKit supplies a second engine; it is not native Safari 26.6.2. Native Safari inspection was unavailable while macOS was locked.

Full exploratory screenshots are JPEG quality 92. Critical before/after crops and final angle captures preserve native PNG pixels. Contact sheets are navigation aids, not substitutes for those originals. Original exploratory PNG hashes were retained before lossless-crop/full-JPEG storage was chosen to limit scratch disk use. Only compact representative images, matrices, summaries and compressed traces are committed; older project evidence remains untouched.

### Running the recorded checks

Use Node 24 and installed project dependencies. Set `MISSION1_PLAYWRIGHT_MODULE` to the installed Playwright module when it is outside Node's normal module search path. `MISSION1_REPO_ROOT` defaults to this repository for the checked-in scripts. Set `MISSION1_EVIDENCE_DIR` to a new output directory, outside previous evidence.

```sh
python3 scripts/prepare-qa.py /tmp/mission1-baseline-repro 824f3e67
python3 scripts/prepare-qa.py /tmp/mission1-candidate-repro working-tree
```

Run Vite and served production builds from each printed disposable frontend directory, on unused ports. Build/preview the baseline and candidate separately. The scripts accept `PORT LABEL`. For example:

```sh
node scripts/rectangle-isolation.cjs 5191 candidate-night
node scripts/oblique-isolation.cjs 5191 candidate-oblique
node scripts/angle-qa.cjs 5191 candidate-angles
node scripts/lighting.cjs 5191 candidate-lighting
node scripts/limb.cjs 5191 candidate-limb
node scripts/gpu-coverage.cjs 5191 candidate-gpu
node scripts/stress-raster.cjs 5191 candidate-fast
node scripts/matched-perf.cjs 5191 candidate-performance
node scripts/memory.cjs 5191 candidate-memory memory
node scripts/oblique-perf.cjs 5191 candidate-exact-oblique-performance
node scripts/source-switch.cjs 5191 candidate-source-switch
```

Use `MISSION1_BASELINE_DIAGNOSTICS=1` for capsule-disable isolation only on `824f3e67`. The initial candidate isolation's `no-capsule` row was a no-op because its regex targeted the baseline shader; it is excluded from causal evidence. The checked-in script explicitly rejects this diagnostic on a candidate. Baseline capsule-disable rows are genuine diagnostics. `webkit-isolation.cjs` and `webkit-oblique.cjs` use WebKit. The GPU harness extracts the real public shader sources and independently checks pixel coverage, overlap, protected-region distance and near-plane clipping. Its test coordinates are explicitly synthetic; real ISS raster evidence is tested separately.

`TrajectoryScreenshotCapture.java` documents reconstruction from the local persisted inputs with unchanged backend classes. It takes an output directory argument and database settings through `MISSION1_CAPTURE_JDBC_URL`, `MISSION1_CAPTURE_JDBC_USER`, `MISSION1_CAPTURE_JDBC_PASSWORD`; its connections are read-only. Compile against existing backend classes and the Maven dependency classpath. It does not fetch or persist new source products. Regeneration from a later database state is not guaranteed to reproduce the recorded fixture; use the committed fixture for repeatable renderer QA.

## Context actually reviewed

- `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and `/Users/daniel/Desktop/mission1-project.md`.
- Skills: `iss-3d-earth-view` with scene/contract references; `frontend-design-codex`; `devops-local-platform` with runtime/CI references; `iss-3d-station-view`; `flight-dynamics-orekit`; `iss-ground-segment-architecture`; `telemetry-quality-and-provenance`; `architecture-decisions`. Actual skill files were read under the supplied Documents project skill root and personal Codex skill root. No dedicated performance skill was available.
- `frontend/README.md`; `docs/frontend/orbital-trajectory-rendering.md`, `rendering-quality.md`, `iss-inspection-mode.md`, `iss-model.md`.
- Previous review READMEs: `trajectory-presentation-review`, `trajectory-transition-visibility-review`, `final-graphics-regression-fixes`, `trajectory-rendering-artifact-review`, its `final-candidate`, and `camera-transition-perfecting-review`. Camera `perceptual/results.md` and `focus-optimization/results.md` were also read.
- Architecture: `03-repository-and-roadmap.md`, `04-earth-view-orbital-delivery.md`. ADR-0006 and the ADR index/policy were read; no ADR change is required.
- Pinned Cesium 1.145 source: public polyline geometry/appearance, near-plane clipping, PolylineGlow Fabric material, relative-to-eye encoding, Model minimum-pixel scaling and automatic uniforms. Authoritative [PolylineGeometry](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGeometry.html), [PolylineMaterialAppearance](https://cesium.com/learn/cesiumjs/ref-doc/PolylineMaterialAppearance.html), [Model](https://cesium.com/learn/cesiumjs/ref-doc/Model.html) and [Camera](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) APIs were checked. No external ISS endpoint, asset or orbital field was changed.

## Current completed gates

Four Chromium matched normal frames (two builds × two selected products) reproduce each screenshot class before correction; their equivalent final frames have zero instances of the diagnosed rectangular interruption or join fin. Body/halo/no-mask native crops are in `images/`; full compositions accompany them. Native baseline join diagnostics show solid-alpha and segment-ID overlap. `results/` retains compressed camera/source/time/material/depth matrices rather than huge recordings.

The final 1,500 km angle sweep contains 240 native captures: 10 angles × two sides × three layer modes × two products × two builds. Valid lower-side views use a transverse azimuth of 75°, upper-side views 15°. The earlier lower-side 15° views that placed a camera inside Earth were excluded and repeated with valid camera positions. A zero-angle transverse offset is necessarily zero for both side labels. Native tangent/head-on frames and contacts were inspected along with the problematic 20° fold.

| Angle to representative forward direction | Body | Halo | Combined |
|---|---|---|---|
| 0° | clean | clean | clean |
| 10° | clean | clean | clean |
| 15° | clean | clean | clean |
| 20° | clean | clean | clean |
| 30° | clean | clean | clean |
| 45° | clean | clean | clean |
| 60° | clean | clean | clean |
| 75° | clean | clean | clean |
| 89.9° near tangent | clean | clean | clean |
| 179.9° head-on | clean | clean | clean |

Each row applies to GP and OEM, upper/lower views, development and served production. Body, halo, active/inactive and combined fields have no observed join protrusion in this sweep. Additional moving views span 500 km to 17,000 km; the night composition is at 27,579 km displayed-ISS range. This is scoped raster acceptance, not a claim that a finite sweep proves every possible camera.

Lighting: day, partial day, terminator, deep night and city lights use identical time, source positions and camera. Geometry/material hashes have one unique value per selected product across these five lighting controls; only diagnostic lighting changes. The limb suite additionally bisects the displayed model's visibility boundary, then captures offsets −3°, −1°, −0.25°, 0°, +0.25°, +1°, +3° with both products/builds. Its per-pixel protection remains partial on both sides of a center-visibility crossing, avoiding a center-only mask switch. All inspected final lighting/limb frames are free of the supplied artifact classes. The separate zoomed Earth-limb lighting control is retained too.

The actual-shader deterministic GPU suite covers 40 adjacent-join fields, 80 mixed foreground/behind-Earth overlap fields, 16 rotated circle/tangent-region and later-reentry fields, and five near-plane/degenerate fields per build. Final results have zero overlap duplicates, leaks, missing covered pixels, mask mismatches, temporal reentry differences or near-plane mismatches, with WebGL error 0. These tests exercise compiled shaders and framebuffer pixels; their synthetic test coordinates are never presented as ISS data.

The final fast-motion pass freezes September UTC and both immutable source products across all ten paths. It measures 4,000 frames: 3,848 valid cameras at least 1 km above the ellipsoid plus 152 additional below-surface adversarial poses, reported separately. Physical/epoch hashes, shader start, horizon, endpoint, path length, retained primitives/geometries and geometry build count never change. There are zero unexpected hidden frames, lost far-safe samples or stationary state corrections. At 160 sampled moving frames, actual native on/off raster comparison confirms 420 eligible far-trail patches with a channel difference of at least 8; no eligible patch is missing. DOM-obstructed points are excluded before selection, rather than weakening the pixel threshold. The earlier 8,000-frame candidate pass also had unchanged physics; its four low-difference patches were behind the HUD and were the reason for this explicit DOM eligibility check.

Final source-switch checks capture the first three rendered frames after four GP/OEM switches in each critical view/build: 48 frames, coherent selected source/mask/materials, no observed one-frame artifact. Clean development and production apps, without QA hooks or route interceptions, pass GP and OEM entry/return against the actual backend.

### Matched performance

All figures are milliseconds, Apple M1/Chromium 151/ANGLE Metal, 1920×992 CSS, DPR 2, identical October fixtures and source/camera paths. Each build/version has 40 warmup frames and 240 measured frames per source/scenario: 1,440 trajectory CPU samples and 1,434 usable RAF intervals. The three scenarios are the exact night reproduction, an October 20° oblique control, and fast Earth rotation. Runs are sequential with no second automated GPU browser. Frame intervals include renderer, browser scheduling and GPU/presentation effects; they are not isolated GPU timestamps.

| Build/version | CPU mean | median | p95 | worst | frame median | p95 | p99 | worst |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Development baseline | 0.442 | 0.400 | 0.700 | 2.500 | 67.8 | 84.6 | 85.2 | 150.0 |
| Development final | 0.445 | 0.400 | 0.700 | 1.700 | 67.4 | 84.5 | 85.2 | 133.3 |
| Production baseline | 0.423 | 0.400 | 0.700 | 1.800 | 67.5 | 84.4 | 85.1 | 134.9 |
| Production final | 0.433 | 0.400 | 0.700 | 0.900 | 67.7 | 84.2 | 85.1 | 133.3 |

Aggregate CPU stays below approximately 0.5 ms, without the rejected per-camera full-arc scan. Some individual night windows exceed 0.5 ms, including baseline; per-source/scenario figures are in `results/performance-summary.json`. An earlier candidate run had an isolated production frame of 181.6 ms versus baseline 133.2 ms; the final matched repeat above does not show that tail, and median/p95/p99 stay comparable. No sustained large render regression is observed. The high absolute frame interval at this native 4K drawing buffer is reported transparently.

Memory: each build runs 12 repeated camera cycles per product, 2,880 frames/build. Six scene primitives, four parent trajectory Fabric materials with their eight fixed child materials and one trajectory geometry-group build remain constant; no camera-created geometry, material or cache collection is introduced. Added encoded neighbor attributes total 138,240 bytes for the two 181-point paths and both layers, allocated on response replacement. The nearest-model-depth helper reuses existing scratch objects. The final 12 OEM cycles show shared post-GC heap drift of about 0.316 MiB development and 0.273 MiB production drift, rather than literally zero heap growth. The newly retained presentation resources do not grow; GPU heap is not directly instrumented.

Retained physics and style: actual geometry positions and indices match the native baseline, including the existing deterministic vertex hash. GP/OEM source positions, sample epochs, interpolation, physical `UTC + 1 ms` start, 85% period endpoint, lineage and source selection/fallback semantics are unchanged. The camera-only local first temporal exit and spatial later-reentry protection remain separate. Nominal body/halo widths 8/20 px, cyan `#53d9cd`, amber `#edb86a`, inactive `#71939c`, active/inactive 0.85/0.08, halo scale 0.26, body/halo glow 0.22/0.35, endpoint fade and log-range smootherstep reveal (hidden ≤100 km, full ≥10,000 km) are unchanged.

`source-manifest.json` records 108 byte-identical frozen implementation/backend/asset files. EarthView's integration only adds the displayed-model near-depth calculation and uniform argument to existing current-frame preparation. Camera/transition/focus/perceptual/C2/control/prewarming files, model transforms/orientation/scale/PBR, imagery/atmosphere/Sun/Moon, 75 km display-only lift, source adapters/persistence/API and flight dynamics are unchanged. Inspection remains desktop 90 m / 42.5° / 100° with the existing responsive policy. Semantic picking retains the same 14 verified modules.

Frontend: **171 tests / 26 files**, full suite, typecheck and production build pass. Backend unchanged: **82 tests**, both `mvn test` and `mvn verify` pass. Existing large-bundle warning remains; no build error. Diagnostic-hook scan of production source/bundle is empty. Final workflow repetition and stationary raster comparison also pass below; no commit/push preceded those gates.


## Final closure

All **18 final workflow jobs pass**, including full focus/camera matrix, desktop 1280×720, narrow 900×700, mobile 390×844, source switching, OEM fallback, refresh, 14 semantic module selections per product/build, wheel/pinch/orbit, canonical/close/max/rotated Inspection, Earth→ISS and ISS→Earth, and seven partial Back checkpoints (10/20/35/50/65/80/95%). No JavaScript exceptions. The unchanged responsive framing and exact desktop 90 m / 42.5° / 100° endpoint are retained. Final lint has no new blocker; existing small-text/credit warnings are retained, not retuned.

A second **4,000-frame final moving/stationary raster pass** repeats all ten paths for both products/builds: again 3,848 normal valid cameras plus 152 below-surface adversarial poses, zero physical/epoch/endpoint/path/build/visibility failure counts. It captures both the last moving and first stationary rendered frames for every path/product/build: **40 pairs / 108 eligible native patch pairs are pixel-identical**. Projection coordinate roundoff is at most 1.37×10⁻¹² CSS px. All **528 on/off presence patch comparisons** in this pass exceed the same channel-difference threshold 8. With the first final pass, this gives **8,000 final motion frames**, **360 captured moving/stationary full frames**, and **948 verified native on/off far-trail patches**, without lost eligible samples. Compressed frame traces and summaries retain the exact physical endpoints, epochs and source hashes.

Additional matched profiling uses the **exact September oblique reproduction** at 1280×720, DPR 2, 20° / 15° / 1,500 km, 40 warmup and 240 measured frames per source/version/build (480 CPU samples and 478 frame intervals per row):

| Build/version | CPU mean | median | p95 | worst | frame median | p95 | p99 | worst |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Development baseline | 0.279 | 0.300 | 0.400 | 0.500 | 33.4 | 50.0 | 50.2 | 51.5 |
| Development final | 0.301 | 0.300 | 0.400 | 1.100 | 33.4 | 50.1 | 50.6 | 51.4 |
| Production baseline | 0.286 | 0.300 | 0.400 | 0.500 | 33.4 | 50.1 | 51.4 | 51.8 |
| Production final | 0.295 | 0.300 | 0.400 | 0.500 | 33.4 | 50.1 | 50.1 | 51.6 |

The extra compiled GPU rerun on the final sources passes all 141 fields in each build. Full frontend suite remains 171/26; typecheck/build, backend 82, Maven test/verify, production diagnostic scan and diff whitespace audit pass. Native Safari remains unverified because the Mac was locked; Chromium and Playwright WebKit both passed the real raster cases in development and production.

Documentation changes are limited to `frontend/README.md`, `docs/frontend/orbital-trajectory-rendering.md`, `docs/frontend/rendering-quality.md`, `docs/architecture/04-earth-view-orbital-delivery.md` and this dedicated dossier. `iss-inspection-mode.md` and ADR-0006 are unchanged. The external `/Users/daniel/Desktop/mission1-project.md` is updated only after successful publication and stays outside Git.

No next milestone implementation is included. The single next milestone after this acceptance is **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**.

*Archived visual: Native before/after comparison: night interruption and oblique join*
