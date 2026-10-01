# Perceptual ISS camera transition review — 2026-10-01

This review evolves the inspected uncommitted strict-speed candidate above accepted baseline `538bb0642205be7f326aa3ae08ec2dc46134a212`. The [original rejection](../strict-speed-review.md), raw traces and reconstructions remain. The [starting source snapshot](../strict-speed-source/manifest.json) preserves the seven inspected candidate files and SHA-256 hashes for reproduction above the committed baseline. Acceptance requires both direct scene-image review and numerical gates. [Final measured results, visual acceptance and browser audit](results.md) document the accepted implementation, with raw data and reproduction below.

## Context and retained work

Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and external `/Users/daniel/Desktop/mission1-project.md`; the latter stays outside Git. Read actual skills `iss-3d-earth-view`, `iss-3d-station-view`, `frontend-design-codex`, `devops-local-platform`, `flight-dynamics-orekit`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `architecture-decisions`, plus their relevant data/scene, coordinate and local-runtime references. No dedicated rendering-performance skill was present. Read frontend/backend READMEs, model/inspection/rendering/trajectory records, orientation/rendering-optimization/trajectory-presentation and starting camera reviews, architecture 03/04, ADRs 0005/0006 and the ADR index. Traced the actual sampled-source, frame, camera, model-centering, presentation, controller and picking code. Public semantics were checked against [Cesium Camera](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) and [PerspectiveFrustum](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html).

Initial `git status`, log, full diff and diff-check preceded modification. Useful retained candidate work: cubic route/control geometry, Earth-clear route preflight and corrected close tangent, 8192-segment arc-length measurement, actual displayed-target composition, exact 90 m / 42.5° desktop endpoint, captured Earth pose/frustum/transform and previous evidence. Removed the requirement that arc length advance linearly in time. No reset, clean, history rewrite or candidate discard occurred.

## Primary metric and traversal

For displayed-target range `r` and Cesium perspective FOV `f`, define lens distance `d = r tan(f/2)`. For route endpoints `d0,d1`, let:

```text
L = log(d/d0) / log(d1/d0)
S = (1/d - 1/d0) / (1/d1 - 1/d0)
A = angle(startOffset,currentOffset) / angle(startOffset,endOffset)
q = 0.20 L + 0.60 S + 0.20 A
```

`S` approximates projected scale for a fixed extent; actual station raster width/height is audited separately because orientation, minimumPixelSize 80 and the nonrectangular model also affect it. `L` reserves far-distance travel. `A` reserves steering time: the first log/scale-only trial removed the scale pop but peaked around 155–183°/s, so it was rejected. The final metric assigns steering 20%. Pure log timing would still concentrate linear apparent growth near arrival; strict arc-length timing already failed.

```text
elapsed time / duration
→ integrated smoothstep velocity clock (C2)
→ normalized perceptual q
→ precomputed monotone C1 Hermite inverse
→ geometric cubic/clear-arc parameter
→ current selected-source moving frame
→ displayed-target camera composition
```

The clock smoothly ramps its rate over the first/last 10% and is uniform over the central 80%. The normalized central rate is `1/(0.9 × duration)`: 0.185185/s for 6-second entry, 0.222222/s for 5-second return. Uniform perceptual samples are solved once by bisection into a 1024-interval table. This resolves the final metres that a uniform geometric-parameter table misses. Harmonic-slope Hermite interpolation makes the inverse C1. The 8192 arc-length samples measure geometry; they do not set timing. Lookup construction and scene projection never occur in the production hot loop.

Six-second entry spreads steering and growth; five-second return starts with gradual close departure. The path is evaluated in the current selected physical F/L/U frame. World-start/end corrections fade with geometric parameter, so they cannot linger until close arrival. Camera orientation continuously aims at the currently displayed model, with retained residual rotations connecting the user's original framing. FOV adjusts during far range, finishing at about 2 km on the canonical route, then holds the accepted 100° close lens. Presentation lift/outline use a C2 log-range ramp between 100 km and 1,000 km. The close station is physical; Overview retains the 75 km model-only lift and subtle white silhouette. Direct scene-image review also found that reopening Earth details immediately on Back obscured the left array during close departure. The station-focused collapsed layout now persists through return, shows a returning hint/disabled action, and restores Earth details at completion. Geometry and navigation controls are unchanged.

## Partial Back and unavailable-source retargeting

Back captures actual world pose and sampled incoming camera derivatives. A future selected-source frame probe removes moving-frame contributions before retaining the incoming position, sign-consistent quaternion and FOV tangents. The incoming quaternion and its derivative are aligned as a pair with the canonical start-pose sign; an initial browser derivative audit found and corrected an equivalent-sign mismatch that reversed the orientation tangent despite exact pose continuity. The correction also aligns the evaluated base quaternion with that retained sign throughout its interval, preventing a later canonical-sign branch from reversing the correction. Deterministic tests exercise both quaternion signs and 400 samples across the whole correction interval at every checkpoint. A polynomial has the required initial derivative, zero initial acceleration, and zero final value/derivatives. Its duration is at most 0.4 seconds, additionally limited so correction displacement stays below approximately 3% of current range. This permits a short continuous forward excursion rather than an instantaneous velocity-vector reversal. Pose/FOV endpoints remain exact. Lift/outline derivatives use the same interval.

OEM loss during close return revealed a separate visual defect: exact camera pose continuity alone allowed the newly selected physical point to appear outside the old close view. Physical selection now switches to GP immediately; a shared camera/model display translation starts at the previously rendered point and settles over 0.8 seconds with C2 endpoints. Physical frame axes still come from GP position/velocity. This translation never enters source samples, geographic readouts, velocity, trajectories or stable Inspection. The failed pre-bridge record is retained for comparison.

## First-return rendering stall

A diagnostic WebGL wrapper in the disposable copy identified a 160.9 ms `getProgramParameter` call at return progress 0.742: the newly required `GROUND_ATMOSPHERE` / zero-imagery globe shader. The camera mapping itself remained at or below 0.2 ms per captured frame. The existing loading warmup now compiles both zero-imagery and textured close-atmosphere variants before enabling Inspection. It temporarily sets public imagery-layer alpha to zero for two frames, restores alpha for two frames, then restores atmosphere fade distances. Layers/providers, cached textures and camera pose remain intact; asynchronous layer additions and cancellation are covered by lifecycle tests. This uses [ImageryLayer.alpha](https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#alpha) and [ImageryLayerCollection.layerAdded](https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayerCollection.html#layerAdded), checked against the installed engine source to identify the compiled variant. The diagnostic wrapper never ships. Final diagnostic calls above 10 ms occurred only during startup; none occurred during either transition.

## Measurement method and limitations

All instrumented frame audits run in **disposable copies**, never the managed checkout or shipped build. The fixtures are archived real backend GP computations and NASA predicted products from the earlier verified review, evaluated at explicit recorded UTC. They are QA inputs, not fabricated coordinates, a runtime fallback or live onboard telemetry. GP remains computed from elements; OEM remains predicted source ephemeris; actual attitude remains unavailable.

Live traces retain every transition frame plus the first completion boundary: pose application and postRender times, UTC, physical/display/camera coordinates, direction/up/right, local offset, range, FOV, transform, lift/outline, projected center and conservative model hull. CSVs include bounding area and normalized occupancy. A hull is a conservative bound, not actual mesh pixel extent. Fixed-progress screenshots at 0/5/10/15/20/30/40/50/60/70/80/85/90/95/100% have paired same-camera model/background renders. Pixel differences within the independent projected hull measure actual rendered footprint, excluding changing attribution UI. Raw JSON retains dimensions/area/occupancy; CSS-resolution JPEG previews and contact sheets preserve visual evidence; numerical measurements use native DPR-2 PNGs. Fixed-progress images are explicitly rendered samples, not a video recording. Before return snapshots, a short real 1× tracking interval replaces derivatives from manually stepped entry captures. CSS animations are frozen in paired screenshots.

Perceptual derivatives use pose-application time. Frame cadence uses postRender time; both retain all captured samples. Central-rate CV excludes only the **intentional** 10% endpoint ramps; full-route statistics are also reported. Frame-to-frame angular changes use actual world direction/up and full camera basis. FPS/percentiles/counts are reported separately from perceived-motion metrics. Same machine, DPR 2, 1280×720, Chromium ANGLE Metal, fixture UTC, initial camera, imagery fallback and rendering policy compare baseline/final sequentially. Changed camera composition changes scene GPU workload; these local observations cannot promise a cross-device FPS budget or eliminate the earlier subpixel texture shimmer.

## Reproduction

Use the existing Node 24 dependencies, Java 21 and the repository's normal local PostgreSQL. Link assets/dependencies into disposable source copies. Apply `../scripts/instrument-qa-copy.py` only there, build and serve distinct baseline, starting strict and final ports. The public helper deliberately rejects a checkout containing `.git`. Set `MISSION1_REPO_ROOT`, `MISSION1_PLAYWRIGHT_MODULE`, and `MISSION1_EVIDENCE_DIR` for this host. Profilers and browsers run sequentially.

```sh
node ../scripts/browser-matrix.cjs 5173
node ../scripts/browser-regressions.cjs 5173
node ../scripts/perceptual-reversals.cjs 5173
# Repeat on served-production 4173.
node ../scripts/trace-perceptual.cjs 4174 baseline-matched
node ../scripts/trace-perceptual.cjs 4173 perceptual-final
node ../scripts/perceptual-snapshots.cjs 4173 production
# Repeat snapshots for strict/baseline and dev; set QA_WIDTH/HEIGHT for responsive runs.
python ../scripts/measure-perceptual-snapshots.py /temporary/png-directory /evidence-directory production
python ../scripts/analyze-perceptual.py /raw-trace-directory /evidence-directory
node ../scripts/clean-live-smoke.cjs
```

The actual viewport variables are `MISSION1_QA_WIDTH` / `MISSION1_QA_HEIGHT`. Clean smoke uses uninstrumented development 5175 and served production 4175 against the actual local Java backend, without route interceptions. Source availability is reported honestly.

Evidence CSVs retain their recorded CRLF terminators. Directory-scoped [Git attributes](../.gitattributes) recognize that format and preserve exact source-snapshot bytes, including the original cameraPose EOF blank line; current runtime source uses normal whitespace checks. Attribute behavior was checked against [Git gitattributes documentation](https://git-scm.com/docs/gitattributes#_checking_whitespace_errors).
