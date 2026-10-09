# ISS Inspection camera and rendering optimization — 2026-10-01

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

This milestone changes camera and rendering presentation only. The synchronized, clean starting revision was `4d3902989e64f0372eacea15f4efeca795f05a0e` on local `main`, `origin/main` and GitHub `main`; SSH fetch/remote verification preceded source edits. No history was rewritten. The backend, orbital products, provenance, UTC, units and source quality contracts remain unchanged. GP/TLE is computed; NASA OEM is predicted ephemeris. `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION` is a visualization, with actual attitude unavailable.

## Context reviewed

Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and external `/Users/daniel/Desktop/mission1-project.md`. Applied the actual `iss-3d-earth-view`, `iss-3d-station-view`, `frontend-design-codex`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `devops-local-platform` and `architecture-decisions` skills, including the relevant Earth/station coordinate and scene conventions. An exact `rendering-performance` skill was absent; the two 3D skills and local-platform profiling workflow cover this work.

Read frontend/backend READMEs, `iss-model.md`, `iss-inspection-mode.md`, `rendering-quality.md`, `orbital-trajectory-rendering.md`, the existing orientation/presentation review READMEs, architecture 03/04, ADRs 0005/0006 and the ADR index. Existing ADR 0006 records the reversible presentation refinement; no new structural architecture decision or ADR was needed. The external context remains outside Git.

## Final camera and composition

The runtime baseline range was 119 m, with local offset approximately (−119, 0, 0), and 85° FOV. The new canonical desktop range is **90 m**, elevation **42.5°**, with the computed F/L/U offset **(−66.354960313, 0, 60.803118685) m**. The range is slant distance, not its horizontal component. Physical model scale remains 1; Overview minimumPixelSize remains 80. The camera points at the physical station/model bounding-sphere centre, using `normalize(pivot − camera)` and the selected-source visual frame.

Trials compare all nine combinations of 95/90/85 m and 40/42.5/45°. **100° FOV** retains the complete structure at 90 m; retaining 85° with the closer raised camera clipped the structure. 95 m makes it smaller; 85 m reduces margins. Opening Inspection orbital details are a native keyboard-operable disclosure, freeing the left solar array without discarding source/quality information. The conservative projected bounding-box hull is larger than the visible station and is not a clipping verdict; raster occupancy is measured separately.

Visible station raster, same frozen UTC and camera elevation; native model-minus-background threshold 5 RGB levels. Bounding dimensions include AA edge pixels, not the conservative eight-corner model box.

| Slant range | Visible width × height (CSS px) | Viewport width / height |
|---|---:|---:|
| 95 m | 933.5 × 321.0 | 72.9% / 44.6% |
| 90 m | 1011.5 × 346.5 | 79.0% / 48.1% |
| 85 m | 1104.5 × 374.5 | 86.3% / 52.0% |

*Archived visual: Canonical 90 m rear/elevated view*

95 m · 90 m · 85 m. Full trial matrix and both-source measurements: `production-full.json`.

Narrow 900×700 retains 90 m. Mobile 390×844 widens to 233.723077 m through the existing `max(1, 1.2/aspect)` factor, retaining 42.5° and no lateral offset. Both have no horizontal page overflow.

## Shared entry/exit pose pipeline

The previous entry could run a 2.4 s radial acquisition followed by a 5 s moving approach, aim separately during its first 18%, and restart acquisition if a sampled path became unsafe. Exit used Cesium `flyTo` over 1.2 s, alongside independently managed presentation curves.

Both directions now use one retained `InspectionTransition`, **5 s** of monotonic wall time, and `w = p³(10 − 15p + 6p²)`. This quintic parameter has zero first and second endpoint derivatives. Direction follows a sphere and range interpolates logarithmically in the moving F/L/U frame. Unsafe preflight routes use one Earth-centred great-circle arc with a smooth radial bulge, rather than an acquisition stage. The near-antipodal direction interpolator now converges to the actual endpoint instead of assuming an exactly opposite vector.

Entry evaluates the current selected-source position/frame each frame, fades in its motion from the captured world pose, and SLERPs an orthonormal camera quaternion towards the current station focus with the same parameter as position and FOV. It ends at the current physical 90 m rear/elevated pose. There is no last-frame FOV change. Model-only lift and silhouette use coordinated C2 curves, reaching zero visible presentation by 35% of entry (1.75 s).

Exit captures the actual camera pose at Back, initially follows that offset in the current station frame and blends to the original captured global pose. Saved position, direction, up, FOV, near/far and the relevant controller settings are restored exactly. Partial Back retains incoming camera/quaternion/FOV/lift/silhouette tangents through a polynomial correction settling over the first 0.6 s; this avoids either a velocity reset or a long tangent overshoot through the station. Mathematical C2 endpoint claims apply to the easing with a fixed frame; physical orbital samples retain their existing interpolation and should not be described as globally C2.

The hot camera loop reuses Cartesian/Matrix/Quaternion objects and a camera-view object. Transition construction/preflight allocates once on the action. No new model, material, trail primitive or React frame update is introduced per camera frame. The one custom material shader is owned by the Viewer lifecycle and destroyed on cleanup.

Both-source production geometry: final slant range error ≤ 5e-09 m; elevation error ≤ 3.4e-09°; model-centre/pivot difference ≤ 9.9e-10 m. Entry world/local handoff position error **0 m**, direction/up error ≤ **2.3e-10°**. Original global position restoration is **0 m** in full and interrupted returns; original FOV, near/far and input/zoom settings are restored.

Eight moving-source sequences (GP/OEM × Back at 20/50/80% and complete entry) cross no Earth surface: minimum sampled camera height **426.064 km**, transform handoff error **0 m**. Finite render samples necessarily retain camera motion between frames: these errors measure transform/restoration continuity, not zero movement between frames. At the 50% interruption, adjacent direction samples differ 5.15° GP / 3.84° OEM over 102.5 / 87.9 ms in this slower run; the analytic tangent and orthonormality tests are the continuity check, while low frame rate still limits visual smoothness. The raw `transition-continuity.json` records every pose; five deterministic tests cover the pose/easing endpoints, interruption tangent, moving frame and safe Earth arc.

## Controlled frame pacing comparison

Baseline was profiled **before source edits** (`initial-baseline-profile.json`) from a Git archive of `4d390298`, with a temporary read-only public diagnostic hook. After the resumed session and all build/test processes finished, the untouched baseline was measured again immediately before the final candidate; the comparison tables use that matched repeat (`baseline-profile.json`). The initial measurement remains archived. Candidate and baseline use the same machine, Chromium/ANGLE Metal, 1280×720 CSS viewport, DPR 2 / 2560×1440 drawing buffer, real captured backend fixtures, initial UTC `2026-09-30T15:45:59.975908Z`, and identical initial world camera pose. GIBS is forced unavailable in both so the same local imagery fallback applies. Only one profiling browser runs at a time. Overview and Inspection windows pause UTC; transitions advance the real fixture clock at 1×, as required by the baseline Julian-time animation. Camera/source initial conditions are identical; their final framing/duration intentionally differ.

`median FPS` means 1000 divided by the median postRender interval. Percentiles and threshold counts apply to N−1 inter-frame intervals, not N frames. Long-task observations, camera/FOV/lift/silhouette samples, primitive counts and asset requests are retained in the raw profiles. These are local software/GPU observations, not cross-device FPS guarantees.

| Source / window | Build | Frames | Median FPS | p50 / p95 / p99 (ms) | Worst (ms) | >33.3 / >50 ms |
|---|---|---:|---:|---:|---:|---:|
| GP/TLE / overview | 4d390298 | 64 | 12.59 | 79.4 / 91.5 / 99.7 | 103.8 | 63 / 63 |
| GP/TLE / overview | Final | 55 | 10.95 | 91.3 / 105.9 / 109.9 | 113.2 | 54 / 54 |
| GP/TLE / entry | 4d390298 | 54 | 14.25 | 70.2 / 256.8 / 367.7 | 777.3 | 43 / 41 |
| GP/TLE / entry | Final | 63 | 13.02 | 76.8 / 123.7 / 148.0 | 237.2 | 61 / 60 |
| GP/TLE / inspection | 4d390298 | 83 | 16.89 | 59.2 / 75.2 / 81.5 | 81.6 | 82 / 72 |
| GP/TLE / inspection | Final | 61 | 12.11 | 82.6 / 96.5 / 100.8 | 101.6 | 60 / 60 |
| GP/TLE / controls | 4d390298 | 103 | 16.89 | 59.2 / 74.3 / 77.1 | 94.9 | 102 / 92 |
| GP/TLE / controls | Final | 85 | 11.55 | 86.6 / 102.8 / 105.3 | 112.4 | 84 / 84 |
| GP/TLE / exit | 4d390298 | 19 | 17.83 | 56.1 / 194.4 / 194.4 | 412.1 | 13 / 11 |
| GP/TLE / exit | Final | 61 | 12.48 | 80.1 / 143.6 / 162.5 | 168.8 | 60 / 60 |
| NASA OEM / overview | 4d390298 | 55 | 11.06 | 90.4 / 108.4 / 109.2 | 117.1 | 54 / 54 |
| NASA OEM / overview | Final | 49 | 9.84 | 101.6 / 117.4 / 155.0 | 163.5 | 48 / 48 |
| NASA OEM / entry | 4d390298 | 65 | 14.81 | 67.5 / 138.6 / 257.1 | 352.5 | 57 / 56 |
| NASA OEM / entry | Final | 65 | 13.72 | 72.9 / 107.0 / 115.9 | 154.5 | 64 / 64 |
| NASA OEM / inspection | 4d390298 | 85 | 17.12 | 58.4 / 70.5 / 80.1 | 89.3 | 84 / 78 |
| NASA OEM / inspection | Final | 57 | 11.66 | 85.8 / 105.3 / 108.5 | 111.2 | 56 / 56 |
| NASA OEM / controls | 4d390298 | 107 | 17.51 | 57.1 / 69.4 / 73.8 | 84.9 | 106 / 92 |
| NASA OEM / controls | Final | 86 | 12.52 | 79.9 / 94.2 / 97.7 | 108.7 | 85 / 85 |
| NASA OEM / exit | 4d390298 | 18 | 16.53 | 60.5 / 246.0 / 246.0 | 366.2 | 13 / 11 |
| NASA OEM / exit | Final | 59 | 12.27 | 81.5 / 128.6 / 148.8 | 171.4 | 58 / 58 |

Measured entry wall time GP/OEM: baseline **5.137 / 5.246 s**, final **5.273 / 5.207 s**. Exit: baseline **1.478 / 1.476 s**, final **5.263 / 5.175 s**. These include button dispatch and rendered completion; configured final durations are 5 s each. Counts on the longer final exit are not equal-duration comparisons.

The final GP entry p95 falls **256.8→123.7 ms**, worst **777.3→237.2 ms**; OEM entry p95 **138.6→107.0 ms**, worst **352.5→154.5 ms**. Exit p95 GP **194.4→143.6 ms**, OEM **246.0→128.6 ms**. Long tasks overlapping entry/exit fall GP **24/6→1/0**, OEM **19/6→0/0**; the remaining GP entry task is 156 ms. Startup tasks remain separate and are included in the raw observer output.

**Tradeoff and acceptance limit:** this is a reduction of long shader/CPU stalls, not a claim that every frame meets 33.3 or 50 ms. Median steady Inspection FPS falls GP **16.89→12.11** and OEM **17.12→11.66**; Overview **12.59→10.95** and **11.06→9.84**. The retained outline/postprocess work and larger physical station framing have a measurable cost. The earlier before-edit session ran faster (Overview about 25 FPS), and both builds slowed in the resumed session. An unrelated user-owned background workload was present and was not stopped; only one measurement browser ran, and application test/build jobs had finished. Absolute timings and small setting-cost differences are therefore host-load dependent. No 60 FPS, zero spikes, zero shimmer or no-regression claim is made.

Four ordered quality-control windows at the same final pose (`quality-cost.json`): source shader without stage p50 79.2 ms; specular AA alone 79.6; FXAA alone 96.3; combined 79.8. The order-dependent spread does not prove the combined pass is free. An alternating stage-only control is retained in `aa-stage-cost.json`; source geometry/materials, MSAA, native pixels and pose remain fixed.
Stage-only EARTH_OVERVIEW: median of three p50 windows, disabled **105.3 ms**, enabled **121.6 ms** (copy bypass); range enabled 104.7–140.0 ms. Enabling/disabling is a diagnostic control only; production retains the stage to avoid mode-change allocation.
Stage-only ISS_INSPECTION: median of three p50 windows, disabled **88.6 ms**, enabled **99.5 ms** (FXAA); range enabled 94.7–105.0 ms. Enabling/disabling is a diagnostic control only; production retains the stage to avoid mode-change allocation.

CPU sampling and temporary reset-stack attribution establish the principal baseline stalls: **environment-map invalidation**, repeated at the default 1 km position tolerance as orbital motion and the 75 km display lift change model translation. Shader derivation/compilation, program queries and readbacks dominate sampled non-idle CPU work; camera interpolation is not the dominant cost. GC appears in the profile but is not the principal transition-stall explanation. Primitive/model identities and asset requests stay stable.

A second, isolated 300–460 ms stall was traced to **`Model.updateFog`** when the camera crossed Cesium's default 800 km ground-fog ceiling. Restricting ground fog to a public 100 km ceiling keeps its model shader variant constant throughout orbital Inspection. Its height scalar is compensated to preserve the prior ground density curve over 80 m–100 km; the engine clamp differs below 80 m. This is a visualization policy, not a physical atmospheric boundary. Sky/ground atmospheric scattering, Sun, terminator and historical city lighting remain enabled. [Public Fog properties](https://cesium.com/learn/cesiumjs/ref-doc/Fog.html) and the installed source explain the invalidation.

The public environment manager now generates one complete ambient environment and retains its diffuse/specular maps, using infinite position/time tolerances. A public bounding-sphere read ensures the initial map sees the translated model position. Direct Sun and Earth illumination remain scene-time dependent. **Ambient reflections are fixed for the Viewer lifetime**, an explicit visualization approximation; this is not a physically accurate ISS lighting/attitude simulation.

The public close-view atmosphere variant is precompiled during model loading, before exposing Inspection. The FXAA stage remains allocated at native resolution; a uniform bypass copies the image in Overview and applies the built-in filtering during Inspection/entry/exit. The shader is obtained through the built-in stage's public `fragmentShader`/`sampleMode` getters and extended with one explicit bypass; no private factory or engine field is used. This avoids the allocation spike from toggling stage `enabled`. The extra retained RGBA8 output is approximately 14.1 MiB at the measured resolution; total GPU memory was not instrumented. The scene owns/destroys the stage with the Viewer.

Crossing silhouette size/alpha zero can also rebuild shader commands. A zero-alpha retention experiment failed on return after Cesium rebuilt resources without outline commands. The final public-property solution retains **1e-6 px / alpha 1e-12** floors, below display precision, with one-sided source geometry in Inspection. It keeps a valid pipeline; it does retain an imperceptible outline draw pass, which is included in final measurements. Overview retains 0.5 px / alpha 0.12. No private engine fields or WebGL state patches are used by production code.

## Flicker diagnosis and correction

The reproducible close-view artifact needs camera motion: 90 m range, approximately 42.5° rear elevation, 0.015° elevation steps, frozen real UTC. Central shiny modules and foil/normal-map detail produce bright pixel outliers; array edges and thin truss/booms show raster aliasing. Affected source material names include `ISS_01_shiny_n`, `ISS_03_shiny_n`, `shiny_panel` (roughness 0.16) and `foil_silver`, on the central module family and solar/truss structures. `texture-inventory.json` provides exact image names, dimensions, hashes and material assignments. The control series keeps base colours, UVs, geometry, light and camera path identical.

Controlled original, flat-normal, roughness=1, specular-AA-only, FXAA-only and final-combination captures distinguish unresolved **normal/specular sampling** from **thin-edge pixel sampling**. Removing normal maps/global roughness=1 are diagnostic controls only and were rejected because they remove source appearance. The final public CustomShader feeds bounded screen-space normal variance into highlight roughness; it retains source normal maps, base colour, metallic and authored roughness as inputs. This follows the [Filament specular-antialiasing method](https://google.github.io/filament/main/materials.html#specularantialiasing). MSAA 4 remains active; complementary FXAA applies during approach, Inspection and return, while Overview uses MSAA alone on supported hardware.

All six controls were captured in one scene, with identical paused UTC and one unchanged ambient-environment position (`material-probe.json`); only the diagnostic shader/stage selection changes. Counts below are adjacent **RGB-channel changes >40 levels** across 15 motion steps in fixed native-pixel patches; normal moving-edge coverage contributes. They quantify bright outliers under identical motion, not absolute flicker events.

| Control | Central modules | Starboard truss | Solar array |
|---|---:|---:|---:|
| original | 759 | 406 | 11165 |
| flat-normal | 411 | 406 | 11165 |
| rough | 687 | 1437 | 14771 |
| specular-aa | 471 | 516 | 11669 |
| fxaa | 349 | 61 | 3398 |
| final | 193 | 69 | 3415 |

*Archived visual: Material diagnostic crops*

Frozen-camera pairs (two real lighting epochs × both sources) have RGB differences: 0-PRIMARY_GP_TLE: max 0, mean 0.000000, 0-NASA_OEM: max 0, mean 0.000000, 1-PRIMARY_GP_TLE: max 7, mean 0.000003, 1-NASA_OEM: max 3, mean 0.000002. Any nonzero full-image difference also includes UI/credit changes; this is not a claim that all such pixels are materials.

Visible 0.5 px / alpha 0.12 outline on/off motion statistics are recorded for both sources and epochs in `raster-statistics.json`. The same sampling behavior remains without the visible outline; the outline is not treated as the root cause. Exact node/material assignments are in `material-mesh-assignments.json`.

A source triangle audit finds 24 coincident nondegenerate faces at 1e-5 m tolerance: Quest 16, Canadarm2 4, Zvezda 2 and DEXTRE 2. **All have opposite winding**; with one-sided source surfaces in Inspection this is not proof of competing front-face depth surfaces. Source S5/P5 also contain 22 degenerate triangles. No component or triangle is displaced/deleted. All 27 materials are opaque with default one-sided geometry; alpha sorting, texture streaming, LOD switching and low-quality asset swaps are not observed causes. Logarithmic depth is enabled and the actual frustum is near 0.1 m / far 1e10 m, rather than an assumed close-view 1/500 m configuration.

The early station-motion-only environment control, captured before the final retained-AA/fog refinement, shows small changes in interior patches, while invalidation clearly causes command-rebuild/performance spikes. This does not establish ambient regeneration as the dominant visible texture shimmer. The moving-camera material controls are the evidence for the sampling diagnosis. Silhouette on/off and both GP/OEM selected sources are measured separately; the artifact persists without the visible outline, and source selection is not a material-quality switch.

**Residual limitation:** thin source booms/truss diagonals and oblique solar-panel/normal-map detail remain smaller than a native pixel at some orbit angles. Their raster coverage still varies during motion. Filtering reduces the bright outliers, but there is no claim of zero temporal variation or reconstructed NASA texture detail. Static and moving captures quantify this distinction. Geometry/PNG resolution is unchanged; no synthetic reconstruction, artificial upscaling, permanent flat normals or globally matte materials are introduced.

## Full source texture quality

The production asset is `frontend/public/models/iss-vtad-source-png.glb`, **32,735,516 bytes**, SHA-256 **`ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`**. It retains 19 unique lossless embedded NASA PNG images, fifteen 1024² and four 512², with original source bytes. Some legacy names end in `.jpg`; the actual embedded MIME/decoded format is PNG. No compression, dimensions, geometry, alternate asset path or LOD is changed.

The runtime upload probe records all 19 at their native dimensions, RGBA8, generated mipmaps, LINEAR magnification (9729), LINEAR_MIPMAP_LINEAR minification (9987), REPEAT wrapping (10497). Highest source level remains resident. Base colour follows glTF sRGB semantics and normal/other non-colour data the linear material path; the shader does not replace texture sampling or colour decoding. Hardware maximum anisotropy is 16; **actual glTF texture anisotropy is 1**. Cesium 1.145's public Model API does not configure its existing texture samplers; changing private texture internals or duplicating all model textures in a custom shader would introduce unjustified maintenance/memory risk. Anisotropy was evaluated, not falsely reported as 16× applied.

The tested GPU supports maximum 4× MSAA, which is requested. Native DPR remains enabled (`useBrowserRecommendedResolution=false`, resolutionScale=1 at DPR2; low-DPR policy remains 1.25). HDR, Sun bloom and existing imagery/sky resolution are unchanged. `incrementallyLoadTextures=false` and ready/semantic-node gating preserve the locator until the full model is ready. Normal cycles do not reload the GLB or swap texture quality.

Authoritative references: [NASA VTAD ISS asset](https://science.nasa.gov/resource/international-space-station-3d-model/), [glTF 2.0 material/sampler specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Cesium Model](https://cesium.com/learn/cesiumjs/ref-doc/Model.html), [CustomShader](https://cesium.com/learn/cesiumjs/ref-doc/CustomShader.html), [DynamicEnvironmentMapManager](https://cesium.com/learn/cesiumjs/ref-doc/DynamicEnvironmentMapManager.html). Installed Cesium engine source was also inspected for invalidation, silhouette command lifecycle, texture upload and public property behavior.

## Navigation and regression checks

Wheel/pinch retain fractional station-relative scaling. The range floor remains 35 m with a directional model half-box (29.5/56/34.6 m) plus 5 m clearance; the actual rear/elevated directional minimum is approximately 45 m. Maximum remains 2 km. Native orbit remains responsive; manual close zoom can crop parts by design while staying outside the box. The opening whole-station view is the 90 m pose.

Development and served-production checks cover both sources, three real UTC lighting phases, slow/fast orbit, wheel zoom, touch pinch, repeated entry/return, partial Back at 20/50/80%, 900×700 and 390×844 viewports, disclosure access, all 14 semantic module picks, a delayed GLB, OEM outage/fallback and forced refresh. GP/OEM source switching stays available in Overview; unavailable OEM falls back explicitly to GP. Cyan/amber trajectories, 85% future horizon, adaptive projected gap and rounded soft start, white Overview silhouette, model-only 75 km lift, fallback locator, Sun/terminator/day/night imagery and source quality labels retain their existing contracts.

Final gates: **90 frontend tests in 18 files**, typecheck and production build pass; **82 backend tests** pass separately under `mvn test` and `mvn verify` (Java 21). Backend source is unchanged. The existing Cesium >500 kB bundle warning remains; no application dependency was added.

Both full and extra development/production reports have empty application error arrays. Final **uninstrumented** development and served-production smoke checks use the actual backend: GP/TLE and NASA OEM Inspection/Back both pass, with attitude unavailable and no exposed `__qa` getter. Normal live requests produce no page/console errors. A separate forced NASA GIBS 503 test has only the two expected provider errors per build, loads the local night image with HTTP 200 and passes both-source Inspection/Back; no unexpected application error occurs.

The actual served production bundle is **`index-DZwbwwrV.js`**, SHA-256 **`886b84c6336daa5ae4ce538d07b5d50b4f8f38f241d60d68e50b6304b3c03e41`**, identical to the final build on disk. `final-live-qa.json`, `fallback-live-qa.json` and `validation-results.json` retain the results. Final `git diff --check` and normal SSH push/synchronization are reported with the commit; no previous commit is amended.

## Evidence and reproduction

Raw `baseline-profile.json` / `candidate-profile.json` contain each measured frame. `baseline-cpu.json` contains CPU samples and reset stacks. `development-full.json`, `production-full.json`, both extra QA reports and `transition-continuity.json` retain geometry, restoration, picking and interruption checks. `sampler-runtime.json`, `texture-inventory.json`, `geometry-overlap.json`, material/environment statistics and the raster comparison retain the rendering diagnosis. Selected compressed screenshots provide visual review without oversized videos or all diagnostic frame sequences. `initial-diagnostic-image-manifest.json` records hashes of generated PNG inputs reduced to archived metrics/selected views; full sequences can be regenerated. A temporary archive build encountered ENOSPC after the final application build/live gates had passed; only this task’s generated temporary images were removed, and the archive build then passed. Production source/build and user files were unaffected.

The browser scripts use a **temporary application diagnostic hook in QA builds** and public Cesium/WebGL APIs. Separate early CPU-attribution builds temporarily wrapped the private `Model.resetDrawCommands` method, delegating unchanged to the original solely to record reset call stacks. This observational instrumentation is disclosed here; it was absent from the timing comparisons and is never used by production code. That hook, overrides and texture instrumentation are removed from production source before final gates. See `scripts/README.md` for reproducing a Git-archive baseline/candidate build and the controlled probes. Captured backend responses are real archived fixtures from the existing orientation review; they are test inputs, not fabricated telemetry or production feeds.

The next single milestone is **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**. It has not been started.
