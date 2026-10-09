# ISS trajectory rendering correction — 2026-10-02

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../../qa-artifact-policy.md) for archive recovery and current evidence.

The reference product was `fa5ed6379bf919419973ee1eb3d45f7ddaebdd58`. The original failed experiment is preserved in the parent directory and external archives; its old README remains a FAILED investigation. This record applies only to the source hashes in `runtime-source-hashes.json` and the final validated runs below.

## Preservation, context and scope

Status, 15 commits, complete tracked diff and diff-check were inspected before edits. The 28,963-byte binary patch and all 145 original untracked files were saved outside Git. [Classification](experiment-classification.md) preceded implementation: reuse capsule coverage, scratch storage and diagnostic isolation; rework origin/mask/coherence; discard the runtime full-arc/last-reentry strategy. Additional trial archives and SHA manifests preserve intermediate research without shipping duplicate large screenshots. The original failed-experiment evidence was not changed.

Read the repository AGENTS.md, external `/Users/daniel/Desktop/mission1-project.md`, the requested frontend/camera/trajectory/architecture records and ADR-0006, and actual project skill instructions for Earth View, local platform, station view, flight dynamics, quality/provenance, architecture and ADR policy, plus frontend-design. No rendering-specific performance skill was available; the prescribed fallback skills and existing browser harnesses were used. No new ADR, infrastructure, source field, propagation method or asset was introduced.

The actual instruction files were `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`; project `SKILL.md` files for `iss-3d-earth-view`, `devops-local-platform`, `iss-3d-station-view`, `flight-dynamics-orekit`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `architecture-decisions`; and `/Users/daniel/.codex/skills/frontend-design-codex/SKILL.md` with its applicable references.

Documentation read: `frontend/README.md`; `docs/frontend/orbital-trajectory-rendering.md`, `rendering-quality.md`, `iss-inspection-mode.md`, `iss-model.md`; review READMEs for `trajectory-presentation-review`, `trajectory-transition-visibility-review`, `final-graphics-regression-fixes`, `trajectory-rendering-artifact-review`, `camera-transition-perfecting-review`; camera `perceptual/results.md` and `focus-optimization/results.md`; `docs/architecture/03-repository-and-roadmap.md`, `04-earth-view-orbital-delivery.md`; `docs/adr/0006-selectable-forward-trajectory-visualization.md` and `docs/adr/README.md`. The failed review was read as diagnostic evidence.

## Four independent responsibilities

1. Physical trajectory: retained source positions, sample epochs, source property, endpoint and 0.85-primary-period horizon. Camera movement cannot create a new orbital window or geometry.
2. Initial origin: first temporal exit from the convex initial region joining the genuine source-origin point to the displayed station circle. No projected first-chord normalization. A bounded finite-projection refinement catches an exit before the next projected sample crosses the camera plane. Later returns cannot move this query's origin.
3. Re-entry: a compact convex signed-distance region joining the actual source-origin point to the displayed station circle, with the unchanged target gap/silhouette and 1–4 CSS-pixel softness. It applies spatially at every future epoch. Only overlapping local fragments fade; safe fragments outside it remain. No fragment changes protection when the first-exit time changes.
4. Cross-section: genuine near-plane-clipped segment capsules in drawing-buffer coordinates bound both halo/body, active and inactive. The public pinned `PolylineMaterialAppearance` extension changes raster coverage, not physical vertices, native extrusion, source interpolation or depth.

All preparation runs in `Scene.preRender`, after camera controls and clock/model preparation. One current source/UTC/display/camera snapshot drives mask, origin, reveal and material uniforms. The old 100 ms Overview cache is removed. The runtime scans only its local temporal bracket; full-future projections and GPU controls occur exclusively in the disposable QA copies.

The body always begins at the physical future boundary (scene UTC plus 1 ms), with a small fixed temporal ramp. The local origin bound is not a hard temporal body cut. `forwardStart` retains the original endpoint-fade normalization; `forwardEnd` is the exact physical coverage/horizon, even when the model projection is extreme. Projection ambiguity never zeros the whole trail alpha. Coverage expiry and the accepted reveal policy still do.

## Locality and measurement definitions

The search bound uses actual projected station radius, target CSS gap, silhouette, halo half-width, lens scale, source range/speed and orbital sagitta:

```
metresPerCssPixel = 2 × range / (cssHeight × projectionMatrix[5])
protectedMetres = (radius + gap + silhouette + haloHalfWidth) × metresPerCssPixel
localSeconds = (protectedMetres + sqrt(2 × orbitalRadius × protectedMetres)) / sourceSpeed
```

There is no arbitrary many-minute constant or whole-orbit per-frame scan. Locality is a screen-space station-protection property; a nearly tangent orbital projection can map a small pixel distance to a long physical interval. A missing covered finite first exit does not cause a temporal body cut. The same current-camera local spatial region still protects the station/source origin; the safe body outside it remains available.

Trace fields distinguish `physicalShaderStartEpoch`, `firstTemporalExitEpoch` (null if not found), `originProtectionEndEpoch`, `endpointFadeStartEpoch`, physical path length, local protection path length, and `firstVisibleEpoch`. The last is an analytical source-centerline alpha ≥0.005 root, not the inverse epoch of the first painted GPU pixel. Raster metadata calls the uniform boundary `originProtectionEndEpoch`, not a painted origin. `visibleFraction` is the remaining physical interval after that analytical root; it is not the number of screen pixels visible through Earth.

A weak earlier component can pass below the analytical threshold while a later component becomes the first above it. This ordinal epoch can jump at a real mask/projection tangency even though fragment alpha is continuous. The report retains those jumps explicitly; they must not be confused with a camera-driven temporal deletion of safe body segments. The rejected intermediate handoff to a circle-only mask changed about 2000 native pixels in the repeated extreme path. Current-camera counterfactual controls now use the previous endpoint-fade boundary; local coverage has no temporal boundary to hold or release. Native current/previous-boundary/off-before/off-after rasters independently check actual pixel continuity and visibility.

## Controlled environment and source lineage

Real recorded backend sample/comparison responses from `inspection-orientation-review` are reused unchanged at frozen UTC `2026-09-30T15:45:59.975908Z`. Primary remains computed GP/TLE; OEM remains source-provided predicted ephemeris with bounded browser display interpolation. Unit fixtures and simulated OEM outages are explicitly TEST/QA cases. The native live-backend smoke uses no API interception.

Chromium 151.0.7922.34, ANGLE Metal Apple M1, 1280×720 CSS at DPR 2 / 2560×1440 buffer. Responsive regressions use 900×700 and 390×844. NASA GIBS aborts intentionally exercise the unchanged imagery fallback consistently. JavaScript errors are checked separately from these expected network failures. QA instrumentation exists only in `/tmp/mission1-final-qa`; the actual source and native production bundle contain no `__qa`, trajectory timing or geometry-counter hooks.

## Physical invariants and independent fast-motion results

**20,000 rapid-motion frames** (10 paths ×500 ×2 sources ×2 builds), **4,000 dedicated origin frames** and **6,000 repeated production frames** passed. Hash, epoch, physical window, endpoint, path length, geometry/primitive identities and builder-count changes are all zero. Unexpected hidden frames, lost far-safe samples and stopped-frame gap/origin correction are all zero.

| Quantity | 20,000 rapid-motion frames | 6,000 repeated extreme frames |
|---|---:|---:|
| Physical shader fraction | 99.999979% | 99.999979% |
| Local-protection fraction | 89.994865% | 88.235372% |
| Analytical alpha≥0.005 remaining fraction | 84.232572% | 84.471108% |
| Maximum local protection | 474.452069 s | 557.888718 s |
| Maximum local protection path | 3,490,491.009749 m | 4,104,302.454645 m |
| Maximum local protection screen distance | 177.887429 CSS px | 169.264833 CSS px |
| Maximum analytical first-onset gap | 747.704926 s | 736.393365 s |
| Maximum analytical gap path | 5,500,636.889478 m | 5,417,442.821009 m |
| Maximum analytical gap screen distance | 177.932965 CSS px | 169.302430 CSS px |
| Maximum analytical epoch jump | 547.103637 s | 363.509401 s |
| Maximum gap-only projected onset motion | 0.000968 CSS px | 0.001327 CSS px |

The temporal root can change components at camera/mask tangency; these seconds and metres are retained explicitly. They are analytical visibility thresholds, not physical deletions or native pixel jumps. The independent native controls below test whether the changing query releases/masks real fragments. The physical body interval is 99.999979% in every tested pose.

Native Float64 xyz source hashes remain GP `1e117f13590cb804293c37d7d4bf85ee9136537945a4fbfc36c65b70db7ffcc3`, OEM `c9faee0458d8ae4490090d86a1d93be5f0e8b99e1d75e030fc6a1bb60389f985`; epoch hash `6be1128037b05fc277346d1ba63e92e18ffd5e15aa57e828066759b6e2bf6311`. Each has 181 positions. Physical length remains **34,879,973.54123991 m GP /34,879,731.894290455 m OEM**. Last epoch remains `1790787902060.658` ms; full endpoints are recorded in physical proof. Camera motion retains the same primitive and geometry identifiers and does not rerun the builder.

### Dedicated origin comparison

| Build/source/path | Baseline → final gap-only CSS motion | Baseline → final analytical epoch jump (s) | Baseline → final epoch direction reversals | Baseline → final unexpected hidden frames |
|---|---:|---:|---:|---:|
| dev/PRIMARY_GP_TLE/axis | 286.845100 → 0.000000 | 39.234988 → 1.681067 | 1 → 0 | 2 → 0 |
| dev/PRIMARY_GP_TLE/along | 0.255158 → 0.000000 | 3.586931 → 2.186104 | 0 → 0 | 0 → 0 |
| dev/PRIMARY_GP_TLE/reverse | 0.469785 → 0.000000 | 4.488392 → 2.186104 | 0 → 0 | 0 → 0 |
| dev/PRIMARY_GP_TLE/crossing | 0.712643 → 0.000000 | 277.923859 → 360.319927 | 2 → 1 | 0 → 0 |
| dev/NASA_OEM/axis | 2.719403 → 0.000000 | 23.775752 → 1.680176 | 2 → 0 | 0 → 0 |
| dev/NASA_OEM/along | 0.257262 → 0.000000 | 3.571989 → 2.354901 | 0 → 0 | 0 → 0 |
| dev/NASA_OEM/reverse | 0.470080 → 0.000000 | 4.474647 → 2.354901 | 0 → 0 | 0 → 0 |
| dev/NASA_OEM/crossing | 0.718329 → 0.000000 | 277.713283 → 360.104091 | 2 → 1 | 0 → 0 |
| prod/PRIMARY_GP_TLE/axis | 287.000440 → 0.000000 | 39.244798 → 1.681067 | 1 → 0 | 2 → 0 |
| prod/PRIMARY_GP_TLE/along | 0.215287 → 0.000000 | 3.578379 → 2.186104 | 0 → 0 | 0 → 0 |
| prod/PRIMARY_GP_TLE/reverse | 0.570557 → 0.000000 | 4.482256 → 2.186104 | 2 → 0 | 0 → 0 |
| prod/PRIMARY_GP_TLE/crossing | 0.277669 → 0.000000 | 13.482893 → 360.319927 | 0 → 1 | 0 → 0 |
| prod/NASA_OEM/axis | 1.217764 → 0.000000 | 14.228645 → 1.680176 | 0 → 0 | 0 → 0 |
| prod/NASA_OEM/along | 0.223795 → 0.000000 | 3.563165 → 2.354901 | 2 → 0 | 0 → 0 |
| prod/NASA_OEM/reverse | 0.571088 → 0.000000 | 4.470995 → 2.354901 | 2 → 0 | 0 → 0 |
| prod/NASA_OEM/crossing | 0.340432 → 0.000000 | 277.713283 → 360.104091 | 0 → 1 | 0 → 0 |

First projected source interval reaches **0.000145391 CSS px GP /0.000194288 OEM** on the axis path. The baseline normalizes this chord and can select the opposite support direction, then zeros whole-trail alpha when start is null. Current temporal order and compact spatial protection avoid that failure. Dedicated axis paths have zero epoch reversals; deliberately oscillating camera paths naturally reverse the analytical root.

Repeated stress sampled post-GC heap at 12 checkpoints: **62.683→63.615 MiB**, range 62.683–63.615. Retained primitives stay 6 and physical builder count stays 1. Scratch buffers are fixed and there is no growing history/bracket cache. This is bounded observed retention, not a proof against every possible memory leak.

## Raster evidence

Native body/halo/both on/off controls cover 0°, 15°, 30°, 45°, 60°, 75° and tangent views; rectangle before/first/worst/last equivalents at 13°, 14.5°, 15.54°, 16.5°, 18° / 2307 km; crossing, worst pitch and oscillation sequences; matching views from below; and original inactive alpha/color controls. The camera definitions use the source's genuine one-second future direction and WGS84 radial/lateral basis. These diagnostic camera placements do not retune product camera paths.

The coverage audit subtracts measured off-before/off-after background change, excludes the real model hull plus 1 CSS pixel, and compares changed source-colored pixels with genuine projected source segments. The camera-plane cases use genuine source segments clipped in world space at the same current native camera near plane, then projected with that camera basis/lens. Their original raster camera positions are checked within 1e-6 metres. Discarding a segment with an unprojectable endpoint gave false positives; that diagnostic is retained in validation. Bounds are `(width + 0.5)/2 + 1.5 CSS pixels`, retaining the native width half-pixel and AA allowance. The inactive audit uses a 1/255 threshold because its original halo alpha is 0.0208; active controls use 8/255. This is a bounded coverage observation on the tested GPU, not a cross-platform pixel guarantee.

Native origin controls capture 250 consecutive frames per source/build/path for axis, crossing and the repeated extreme near-camera-plane path, with current camera fixed while comparing current versus previous fade boundaries. Before the final spatial separation, the same controls included the old initial-protection boundary and exposed its unacceptable mask jump. They use absolute color difference above measured background noise +8/255, because the cyan/amber line may darken a bright background. Strong expected centerline points (alpha ≥0.10) within the native crop must have changed pixels within 6 CSS pixels. Full original PNGs are SHA-verified in the external preservation archive; compact native-pixel difference sequences and all metric rows remain in the evidence directory.

| Build/control | Poses | Layer cases | Cases beyond genuine capsule | Pixels beyond genuine capsule |
|---|---:|---:|---:|---:|
| accepted-baseline-raster | 62 | 186 | 126 | 53823 |
| accepted-dev-raster | 62 | 186 | 0 | 0 |
| accepted-prod-raster | 62 | 186 | 0 | 0 |
| extra-dev | 44 | 132 | 0 | 0 |
| extra-prod | 44 | 132 | 0 | 0 |
| inactive-dev | 6 | 18 | 0 | 0 |
| inactive-prod | 6 | 18 | 0 | 0 |
| baseline-boundary | 10 | 30 | 18 | 6961 |
| dev-boundary | 10 | 30 | 0 | 0 |
| prod-boundary | 10 | 30 | 0 | 0 |

At 30°/6000 km the reproduced baseline body/halo miter extends beyond genuine segment coverage; final layer controls remain bounded across 0/15/30/45/60/75°/tangent, joins, near-plane clipping and inactive original alpha. Capsule distance supplies the same PolylineGlow profile over the original width, rather than moving the physical curve.

The rectangle boundary sequence is 13° (before), 14.5° (first affected sampled pose), 15.54° (worst), 18° (last affected sampled pose), 30° (after), phi=0°, range 2307 km. Both sources have the flat baseline cut at the three middle poses: **6/10 baseline →0/10 final per build**. These are affected frames of the captured sequence, not a claim about the exact continuous-angle onset. The original eight-corner 3D-envelope projection can itself have rectangular sides; depth removal did not cure its cut. The replacement distance field has a curved circle boundary and the compact source-point tangent region. Later returns are masked only there, never used as the temporal origin.

| Native continuity path/control | Frames | Unexpected GPU hide | Missing strong points | Gap-induced complete hide | Maximum changed pixels beyond noise | Maximum raw channel delta |
|---|---:|---:|---:|---:|---:|---:|
| gpu-origin-dev-NASA_OEM-axis.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| gpu-origin-dev-NASA_OEM-crossing.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| gpu-origin-dev-PRIMARY_GP_TLE-axis.json.gz | 250 | 0 | 0 | 0 | 0 | 13 |
| gpu-origin-dev-PRIMARY_GP_TLE-crossing.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| gpu-origin-prod-NASA_OEM-axis.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| gpu-origin-prod-NASA_OEM-crossing.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| gpu-origin-prod-PRIMARY_GP_TLE-axis.json.gz | 250 | 0 | 0 | 0 | 0 | 13 |
| gpu-origin-prod-PRIMARY_GP_TLE-crossing.json.gz | 250 | 0 | 0 | 0 | 0 | 1 |
| memory-gpu-dev-NASA_OEM-memory.json.gz | 250 | 0 | 0 | 0 | 0 | 24 |
| memory-gpu-dev-PRIMARY_GP_TLE-memory.json.gz | 250 | 0 | 0 | 0 | 0 | 125 |
| memory-gpu-prod-NASA_OEM-memory.json.gz | 250 | 0 | 0 | 0 | 0 | 24 |
| memory-gpu-prod-PRIMARY_GP_TLE-memory.json.gz | 250 | 0 | 0 | 0 | 0 | 125 |

The final **3000 consecutive native frames** cover dev/prod ×GP/OEM ×axis/crossing/repeated extreme pass. Neither passing tests nor process exit was used in place of raster review. Native detail/difference crops and current/previous/off controls were inspected; full PNG originals are externally preserved with byte verification. A prior temporal handoff candidate failed the same repeated near-plane control (~1981 affected pixels, channel delta >200); it was rejected and preserved before this final run.

The maximum raw repeated-path RGB delta is 125 at one background pixel. Its current RGB equals off-before exactly, and its previous-gap RGB equals off-after exactly; the off-background delta is also 125. The four control values retain this observation. Zero changed trajectory pixels means zero changes above the per-pixel measured background noise plus 8 levels, rather than absolute equality of every screen pixel. Full representative native controls remain in `gpu-origin/controls` and `gpu-memory/controls`.


## Performance and regression limits

| Build | CPU mean /median /p95 /worst (ms) | Frame median /p95 /worst (ms) |
|---|---:|---:|
| baseline-dev | 0.188250 /0.100 /0.900 /1.400 | 35.000 /50.100 /83.300 |
| baseline-prod | 0.167813 /0.100 /0.700 /1.300 | 35.300 /50.100 /83.300 |
| experiment-dev | 1.496813 /1.500 /2.400 /4.800 | 33.750 /50.100 /83.400 |
| experiment-prod | 1.477625 /1.500 /2.300 /4.800 | 34.300 /50.100 /83.200 |
| accepted-dev | 0.281312 /0.300 /0.400 /0.600 | 33.400 /50.100 /83.300 |
| accepted-prod | 0.278688 /0.300 /0.400 /0.500 | 33.500 /50.100 /83.300 |

Serial performance builds use 120 warm-up and 400 measured frames per source/path, 1600 frames/build, identical recorded data, UTC, camera path, viewport, DPR and renderer. No other QA browser/build runs during profiling. The first frame interval per path is undefined and excluded (1596 intervals/build). Frame intervals include browser/GPU scheduling; GPU timer support is available but isolated GPU timing queries were not collected. The pooled median can switch between the 33.4/50 ms populations; report per-path medians, means and tails instead of claiming a GPU speedup from the CPU change.

Frontend **162 tests /25 files**, typecheck and native production build pass. Backend **82 tests**, `mvn test` and `mvn verify` pass with unchanged backend source. All **18 current dev/served-production matrix jobs** plus 3 immutable baseline jobs pass: source switch/OEM fallback, full/interrupted transitions and arbitrary starts, Inspection navigation/zoom/picking, desktop/narrow/mobile, clearance, Partial Back and visual lint. The clean native development/production live-backend smoke passes without intercepted fixtures. Expected GIBS aborts are separate from JavaScript errors. Final tracked/staged diff-check and the production-hook absence audit pass before commit.

Only four product documentation files are updated: frontend README, orbital-trajectory rendering, rendering quality and architecture/04. The final evidence README/scripts/trace and preservation manifests are added here. No ADR or Inspection semantics file changes. External `/Users/daniel/Desktop/mission1-project.md` is updated only after acceptance and remains outside Git.

Full frozen-source audit compares 105 backend/camera/controls/model/quality/source/orbital/asset files byte-for-byte with the accepted commit; all are unchanged. The additional graphics audit checks assets, camera warmup, antialiasing, selection, visibility and physical/display helpers. EarthView's diff is confined to trajectory preparation. The accepted desktop endpoint is 90 m /42.5° /100° /zero lateral; responsive framing, C2 clock, focus, durations/pacing, arbitrary starts, Partial Back, prewarm, orientation, NASA PNG/PBR, picking, native DPR/MSAA/FXAA, silhouette and 75 km model-only lift remain. The 100→10,000 km logarithmic smootherstep reveal and active/inactive colors/alpha/widths/endpoint fade remain.

The review establishes the specified recorded paths on this hardware. Natural globe occultation, offscreen geometry and source-coverage expiry remain valid visibility limits. No new positional accuracy or onboard telemetry claim follows from these rendering checks.

## Reproduction and preservation

Use disposable baseline (`git archive fa5ed63`) / saved-experiment / candidate copies outside Git. Copy public assets and reuse the installed dependencies. Run `scripts/sync-qa.py COPY_ROOT` only on the candidate copy; it resets native files before applying the existing external instrumentation. Serve each development and production build on distinct ports. Before the extra near-camera-plane raster analysis, run `refresh-raster-clips.cjs PORT LABEL` against its corresponding disposable build and report directory. Run source-independent QA as needed; run performance serially after all other QA browsers have closed. The final scripts include bounded/near-plane root sampling, current-pose counterfactuals, native isolation and explicit UTC-poll freeze; none is production fallback code.

The binary patch, original-untracked archive, intermediate trials, pre-near-plane evidence/source archives, rejected handoff/fragment-time trials and full native capture archives remain outside Git with SHA manifests. Redundant binary copies generated during this task are removed from Git's evidence tree only after byte verification. Original failed-experiment evidence remains in its original directory, with its FAILED report intact. External project context remains outside Git. The following orbital RTN milestone was not started.

Public APIs were checked against [Scene.preRender](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#preRender), [PolylineMaterialAppearance](https://cesium.com/learn/cesiumjs/ref-doc/PolylineMaterialAppearance.html), and the local pinned Cesium 1.145 shader implementation.
