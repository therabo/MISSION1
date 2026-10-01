# Earth ↔ ISS focus acceptance — 2026-10-01

Accepted scope: explicit focus transfer, arbitrary actual camera starts, first-use graphics readiness, and frame pacing with full rendering quality. Starting clean synchronized revision: `b5aa2a82128547f9958f28bcd4bc83341230184c`. The new normal commit and verified SSH publication identity are in Git history and the task's final report. RTN analysis and Replay have not begun.

## Context actually reviewed

Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and `/Users/daniel/Desktop/mission1-project.md` before source changes. The latter remains outside this repository. Inspected the actual private skill directory and read `iss-3d-earth-view`, `iss-3d-station-view`, `devops-local-platform`, `flight-dynamics-orekit` (the installed flight-dynamics skill), `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `architecture-decisions`, and `/Users/daniel/.codex/skills/frontend-design-codex/SKILL.md`, including applicable references. No dedicated rendering/performance skill exists here. The frontend skill's `.shared` visual runtime is absent; [equivalent local lint](scripts/visual-lint.cjs) checks names, alt text, clipping, overflow, tiny text and approximate contrast.

Read [frontend README](../../../../frontend/README.md), [backend README](../../../../backend/README.md), [ISS model](../../iss-model.md), [Inspection mode](../../iss-inspection-mode.md), [rendering quality](../../rendering-quality.md), [orbital trajectory rendering](../../orbital-trajectory-rendering.md), [orientation review](../../inspection-orientation-review/README.md), [rendering optimization review](../../inspection-rendering-optimization-review/README.md), [camera transition review](../README.md), [accepted perceptual results](../perceptual/results.md), [trajectory presentation review](../../trajectory-presentation-review/README.md), [architecture 03](../../../architecture/03-repository-and-roadmap.md), [architecture 04](../../../architecture/04-earth-view-orbital-delivery.md), [ADR-0005](../../../adr/0005-separate-nasa-oem-comparison-trajectory.md), [ADR-0006](../../../adr/0006-selectable-forward-trajectory-visualization.md), and [ADR index](../../../adr/README.md). Traced selected physical samples/frame, display lift, cubic path, metric/inverse, actual camera application, saved frustum/controllers, model/material readiness, globe/imagery/atmosphere, scene and React lifecycle before implementing.

## Reproduced defects and rejected candidates

The baseline names the displayed ISS as its nominal aim for the entire flight, then overlays an interpolated residual orientation. It has no explicit Earth-to-ISS world focal trajectory. A smooth position spline therefore does not imply a smooth, intelligible subject transfer. The first far steering and corresponding return remain concentrated; baseline focal coordinates/velocity are intentionally **unavailable**, rather than invented from that nominal aim.

Native `Camera.setView` introduces a second, independent defect: Direction/Up becomes local ENU heading/pitch/roll. Within `EPSILON3` of vertical, heading uses Up and roll becomes zero. Browser probes reproduced ~1.43° requested/applied direction error and ~501 km focal recapture error on a 10% Back. This happened with already orthonormal input. Direct public position/direction/up/right application under identity transform removes the conversion. The native frame is adopted only at the exact Inspection endpoint. [Camera public API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html), pinned `@cesium/engine/Source/Scene/Camera.js`: `setView3D`, `directionUpToHeadingPitchRoll`, `getHeading`, `getRoll`. [Rejected native-application reversal](rejected-setview-reversal.txt).

A plain unconstrained spherical focus rail lost the station in rotated/limb/pitch views and was rejected. [Trial geometry](trial-development-arbitrary.json.gz) remains evidence. The accepted rail adds smooth angular containment with endpoint envelopes; it never hard-switches its target.

An initially incomplete prewarm was also rejected after an actual 72.5 ms shader-status wait at **11% rotated entry**. A dense follow-up measured 171.6 ms and captured the linked native Moon ellipsoid shader (`ONLY_SUN_LIGHTING`, `WRITE_DEPTH`, `LOG_DEPTH`); this was first visibility of the Moon. [Original wait](rejected-incomplete-warmup.json), [dense shader diagnosis](rejected-lazy-moon.json), [after sky warmup](after-sky-warm-arbitrary.json.gz). This was a shader/resource hitch, separate from focus mathematics. The accepted startup task submits the retained Moon/Sun draws and then repaints the exact captured Earth view in the same task.

Exact baseline rendered frames follow. Indices are local to each recorded direction; progress is elapsed transition fraction. “Basis” is requested/applied direction error, independently measured from angular motion. These are diagnostics of the reproduced problem, not evidence of a hidden discrete target assignment.


| Run | Cycle | Direction | Peak frame / progress | Peak °/s | Rate-change frame / progress | Max Δ °/s | Worst basis frame / progress | Basis ° |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline-dev-gp | 0 | entry | 49 / 29.43% | 59.00 | 48 / 28.87% | 30.42 | 18 / 7.83% | 1.43513 |
| baseline-dev-gp | 0 | exit | 100 / 71.11% | 67.18 | 100 / 71.11% | 57.64 | 126 / 92.67% | 1.20552 |
| baseline-dev-gp | 1 | entry | 47 / 29.59% | 56.98 | 48 / 30.19% | 41.70 | 16 / 7.63% | 1.32611 |
| baseline-dev-gp | 1 | exit | 101 / 71.15% | 68.13 | 101 / 71.15% | 56.40 | 127 / 92.12% | 1.50233 |
| baseline-dev-oem | 0 | entry | 19 / 8.51% | 55.47 | 51 / 30.31% | 45.32 | 18 / 7.83% | 1.43963 |
| baseline-dev-oem | 0 | exit | 103 / 71.39% | 65.20 | 104 / 72.11% | 51.00 | 129 / 92.60% | 1.24172 |
| baseline-dev-oem | 1 | entry | 47 / 29.21% | 53.78 | 49 / 30.33% | 44.57 | 16 / 7.40% | 1.20552 |
| baseline-dev-oem | 1 | exit | 101 / 71.40% | 64.82 | 102 / 72.12% | 51.39 | 126 / 92.12% | 1.50723 |
| baseline-prod-gp | 0 | entry | 50 / 29.23% | 54.17 | 52 / 30.44% | 44.66 | 19 / 7.60% | 1.30888 |
| baseline-prod-gp | 0 | exit | 100 / 71.00% | 60.55 | 100 / 71.00% | 60.46 | 127 / 92.76% | 1.16135 |
| baseline-prod-gp | 1 | entry | 46 / 29.30% | 57.48 | 48 / 30.40% | 42.34 | 15 / 7.58% | 1.29790 |
| baseline-prod-gp | 1 | exit | 97 / 71.56% | 57.61 | 98 / 72.29% | 56.55 | 120 / 92.13% | 1.49844 |
| baseline-prod-oem | 0 | entry | 47 / 29.40% | 58.93 | 49 / 30.59% | 28.78 | 16 / 7.55% | 1.28518 |
| baseline-prod-oem | 0 | exit | 101 / 70.88% | 57.21 | 101 / 70.88% | 56.83 | 127 / 92.29% | 1.40570 |
| baseline-prod-oem | 1 | entry | 47 / 29.21% | 54.25 | 49 / 30.34% | 44.87 | 16 / 7.43% | 1.22089 |
| baseline-prod-oem | 1 | exit | 101 / 71.16% | 68.04 | 101 / 71.16% | 54.68 | 127 / 92.39% | 1.35313 |


## Explicit focus architecture

The [implementation explanation](README.md) defines every equation. Earth focus is `C + D × max(1, −C·D)` captured from the actual Earth camera: the nearest forward principal-ray point to Earth centre. This preserves a valid arbitrary pitch/composition. Inspection focus ends at the actual displayed selected-source station. Intermediate focus is `C(t) + r(t)D(t)`, a positive spherical rail about the current camera; geometric focal-radius blending prevents crossing the camera or moving behind it. Quaternion coordinates specify that rail's angular direction and continuous Up; camera direction equals normalized focus minus camera. This is an equivalent geometric focus formulation, not an independent competing look-at.

The rail budget is `clamp(0.25 + 0.3 × captured basis angle / π, 0.3, 0.5)`, spent at the beginning of entry and end of exit in the existing hybrid metric, with its C2 integrated clock. `focusBlend` describes progress on this rail, not a literal Cartesian percentage of Earth/ISS positions. Smooth angular containment uses a quarter of the smaller captured FOV, an eighth-power soft cap, and C2 envelopes over the first/last 5% of metric progress. The fixed quaternion branch prevents a moving-frame 180° rail reversal.

The cubic/Earth-clear path, 8192 length segments, 1024-interval C1 inverse, 20/60/20 hybrid and close-range presentation remain unchanged. Duration uses captured Earth-to-station range and angular change: base 6/5 s + `0.35 ln(max(90, range)/16573499)` + `0.4 max(0, angle−π/2)`, rounded once to 0.1 s and clipped to 4–7.5 s entry /3.5–7.5 s exit. Canonical remains 6/5 s. Return begins from actual Inspection orbit/zoom, including partial entry.

Presentation focus is C1 across the inverse and retained Back tangent; the clock and blending envelopes are C2. No global C2 claim applies to the full moving-source path: the existing bounded physical interpolation has sample knots, and a real-time finite acceleration difference is not an analytic discontinuity measurement. The coherent Back derivative is `cameraVelocity + radiusRate×direction + radius×(angularVelocity×direction)`, using the same actual pose rates retained by Back. Raw world focus chord derivatives are preserved separately below.

Lift follows the actual rendered station, 75 km→0 on entry and 0→75 km on return. Focus does not mix source samples or modify physical altitude, velocity, timestamps, trajectory vertices or provenance. GP is computed from real orbital elements; OEM is source-provided predicted ephemeris; visual orientation is trajectory-aligned and actual attitude remains unavailable.

## Frame-by-frame focus audit

Every rendered frame records actual world basis, physical/displayed ISS, Earth, focal point/blend/ray, FOV, screen projections, lift, silhouette, applied time, render cadence and camera CPU. Raw JSON and CSV remain reproducible. Maximum world focal velocity **change** and adjacent acceleration change are finite-sample diagnostics: curved travel over tens of milliseconds produces nonzero values even for a smooth path. Exact boundary continuity is established by deterministic boundary tests and measured retained Back derivatives, not by requiring these differences to be zero.


| Run | Cycle | Direction | Direction °/s | Up °/s | Max Δ rate °/s | Max Δ focus v km/s | Max adjacent Δa km/s² | ISS visible step CSS px | Earth visible step CSS px | Ray error rad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| final-dev-gp | 0 | entry | 36.28 | 39.87 | 14.36 | 4518.02 | 96267.16 | 44.64 | 37.34 | 5.41e-12 |
| final-dev-gp | 0 | exit | 42.99 | 47.45 | 18.91 | 7373.86 | 129721.32 | 53.67 | 30.24 | 4.64e-12 |
| final-dev-gp | 1 | entry | 36.41 | 40.01 | 14.15 | 5513.39 | 81034.55 | 43.27 | 30.80 | 4.98e-12 |
| final-dev-gp | 1 | exit | 43.27 | 47.70 | 16.90 | 8388.54 | 109587.95 | 57.00 | 29.77 | 4.24e-12 |
| final-dev-oem | 0 | entry | 36.38 | 39.98 | 14.53 | 4608.01 | 94602.37 | 42.54 | 35.28 | 4.79e-12 |
| final-dev-oem | 0 | exit | 43.06 | 47.49 | 19.08 | 8609.97 | 114216.89 | 53.93 | 30.43 | 5.10e-12 |
| final-dev-oem | 1 | entry | 36.52 | 40.12 | 14.36 | 5588.00 | 80272.55 | 43.90 | 35.02 | 3.95e-12 |
| final-dev-oem | 1 | exit | 43.08 | 47.49 | 18.63 | 8657.30 | 108273.33 | 56.21 | 30.02 | 4.04e-12 |
| final-prod-gp | 0 | entry | 36.29 | 39.92 | 13.32 | 4326.72 | 99329.57 | 44.80 | 35.10 | 5.30e-12 |
| final-prod-gp | 0 | exit | 42.99 | 47.42 | 18.69 | 7412.95 | 127912.26 | 56.81 | 32.66 | 4.19e-12 |
| final-prod-gp | 1 | entry | 36.42 | 40.01 | 14.39 | 5601.99 | 87551.76 | 43.68 | 34.82 | 4.34e-12 |
| final-prod-gp | 1 | exit | 43.13 | 47.64 | 20.34 | 7338.53 | 90815.20 | 56.33 | 29.83 | 4.53e-12 |
| final-prod-oem | 0 | entry | 36.41 | 39.99 | 14.48 | 5514.48 | 91635.82 | 44.53 | 34.96 | 4.40e-12 |
| final-prod-oem | 0 | exit | 42.83 | 47.29 | 19.37 | 8603.29 | 124366.56 | 56.60 | 29.04 | 4.66e-12 |
| final-prod-oem | 1 | entry | 36.37 | 39.95 | 13.92 | 5264.70 | 68359.59 | 44.83 | 33.87 | 4.22e-12 |
| final-prod-oem | 1 | exit | 43.24 | 47.68 | 18.42 | 7609.97 | 96980.05 | 56.29 | 30.80 | 5.04e-12 |


Near-plane projections of Earth centre can become enormous while Earth centre is off screen. The table uses **both endpoints visible** for meaningful screen steps; maximum finite projection steps are retained in [full analysis](focus-analysis.json). There are zero accidental displayed-ISS off-screen frames in the final live canonical/cycle traces and 101-pose arbitrary sweeps. Final requested/applied world basis agrees to floating-point precision, without a final orientation correction.

### First 5 /10 /20 /30% of entry

First production entry, frozen starting pose then advancing real scene UTC. Focal velocity is a world-coordinate finite chord, not spacecraft speed. The first 30% is evaluated at every rendered frame, not just four screenshots.


| Run | Through % | Frames | Direction °/s | Focus v km/s | Max Δv km/s | ISS step px | Earth step px | Max dt ms | CPU ms | Last blend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| final-prod-gp | 5.0 | 9 | 1.68 | 17074.98 | 3491.57 | 9.09 | 5.38 | 51.60 | 0.200 | 0.0020 |
| final-prod-gp | 10.0 | 16 | 28.07 | 17074.98 | 4326.72 | 11.05 | 9.84 | 51.60 | 0.200 | 0.1092 |
| final-prod-gp | 20.0 | 29 | 28.87 | 17074.98 | 4326.72 | 11.05 | 28.83 | 51.60 | 0.200 | 0.4605 |
| final-prod-gp | 30.0 | 45 | 36.29 | 17074.98 | 4326.72 | 44.80 | 35.10 | 51.60 | 0.200 | 0.8303 |
| final-prod-oem | 5.0 | 9 | 2.27 | 17118.25 | 5514.48 | 7.67 | 4.82 | 51.70 | 0.200 | 0.0023 |
| final-prod-oem | 10.0 | 16 | 28.23 | 17118.25 | 5514.48 | 12.02 | 10.16 | 51.70 | 0.200 | 0.1184 |
| final-prod-oem | 20.0 | 29 | 28.98 | 17118.25 | 5514.48 | 12.02 | 29.43 | 51.70 | 0.200 | 0.4707 |
| final-prod-oem | 30.0 | 44 | 36.41 | 17118.25 | 5514.48 | 44.53 | 34.96 | 53.80 | 0.200 | 0.8141 |


### Exit interval returning focus to Earth

The station stays dominant during close departure; the final fraction of the hybrid metric returns Earth context. The transfer uses the same rail with the captured actual Inspection basis. Controllers stay locked until exact restore.


| Run | Cycle | First/last frame | Start/end % | Max dt ms | Max CPU ms |
| --- | --- | --- | --- | --- | --- |
| final-dev-gp | 0 | 94 / 138 | 63.92 / 99.00 | 55.60 | 0.100 |
| final-dev-gp | 1 | 93 / 136 | 64.07 / 99.40 | 57.20 | 0.100 |
| final-dev-oem | 0 | 93 / 136 | 64.26 / 99.59 | 54.10 | 0.100 |
| final-dev-oem | 1 | 93 / 135 | 64.39 / 99.56 | 58.40 | 0.100 |
| final-prod-gp | 0 | 92 / 135 | 63.91 / 99.06 | 52.80 | 0.100 |
| final-prod-gp | 1 | 92 / 135 | 63.84 / 99.16 | 51.20 | 0.100 |
| final-prod-oem | 0 | 91 / 135 | 63.84 / 99.70 | 55.00 | 0.200 |
| final-prod-oem | 1 | 93 / 135 | 64.23 / 99.23 | 54.30 | 0.200 |


## Arbitrary starts and direct visual review

Both builds and sources cover canonical/far/close/90° rotated/limb/alternate-pitch Earth entry and the matching returns, plus close-module, 2 km maximum zoom-out, orbit90° and orbit180° Inspection return. Every path has 2001 numerical clearance samples and 101 actual retained-scene rendered poses. The numerical lift target follows actual presentation progress. Camera never intersects WGS84 ellipsoid; terrain is the existing ellipsoid, not downloaded topography. Every tested rendered station centre remains within the viewport. Saved position/direction/Up, FOV, near/far, transform and all 11 controller fields restore. Geometry sampling is distinct from real-time frame-pacing measurements.

Visual review compares contact sequences, native endpoint images, paired actual-raster foreground measurements, lighting and responsive surfaces. [Reviewed views and exact final rate-change frames](visual-acceptance.json) record the direct acceptance; the clean in-app production view also completes a live GP entry/return with zero error/warning logs. The station stays composed during far steering and receding departure; no discrete roll correction or close-up takeover appears in the reviewed sequences. Arbitrary alternate-pitch paths naturally have larger continuous angular rates than canonical paths; this is not hidden by an FPS claim or a universal °/s limit. See all exact values in the arbitrary matrices.


| Build | Earth poses/source | Inspection poses/source | Min height km | Max restore position m | Unexpected errors |
| --- | --- | --- | --- | --- | --- |
| development | 6 | 5 | 426.506827 | 0.0 | 0 |
| production | 6 | 5 | 426.506827 | 0.0 | 0 |


| Build | Earth pose | Entry s | Exit s | Max dense step/dt entry °/s | Exit °/s |
| --- | --- | --- | --- | --- | --- |
| development | canonical | 6 | 5 | 36.51 | 43.82 |
| development | far | 6.5 | 5.5 | 33.03 | 39.04 |
| development | close | 5.2 | 4.2 | 34.12 | 42.25 |
| development | rotated | 6.3 | 5.3 | 99.54 | 118.32 |
| development | limb | 6.1 | 5.1 | 82.85 | 99.09 |
| development | pitch | 6.4 | 5.4 | 111.39 | 132.02 |
| production | canonical | 6 | 5 | 36.51 | 43.82 |
| production | far | 6.5 | 5.5 | 33.03 | 39.04 |
| production | close | 5.2 | 4.2 | 34.12 | 42.25 |
| production | rotated | 6.3 | 5.3 | 99.54 | 118.32 |
| production | limb | 6.1 | 5.1 | 82.85 | 99.09 |
| production | pitch | 6.4 | 5.4 | 111.39 | 132.02 |


The dense step/dt figures above use uniform 1/2000 progress increments; they are geometry-rate diagnostics, not measured render FPS. All four additional Inspection return poses pass for each build/source. [Development matrix](final-development-arbitrary.json.gz), [production matrix](final-production-arbitrary.json.gz).

## Startup, resources and first/warm pacing

The model gate waits for texture and semantic readiness, then eight renders: zero-imagery/close-atmosphere variants, restored imagery, restored globe, and four normal model/PBR/silhouette/FXAA/environment frames. During loading the model can submit real draw commands while the loading locator and disabled Inspect communicate readiness. The separate idle celestial task uses public Simon1994 and Transforms, temporarily exposes the retained Moon/Sun to the GPU, restores exact camera/input/loop/far/transform, and paints the real Earth view before returning. No scene/model/provider replacement or private shader binding is introduced. [Public positions](https://cesium.com/learn/cesiumjs/ref-doc/Simon1994PlanetaryPositions.html), [Viewer](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html), [Transforms](https://cesium.com/learn/cesiumjs/ref-doc/Transforms.html).

Model preparation counting waits for sky completion. A forced six-second idle delay confirms that a ready GLB cannot enable Inspect early; seven observer-visible warm frames precede the eighth frame whose callback completes readiness. Both delayed-sky browser tests and the deterministic eight-frame test pass. Optional NASA imagery/skybox network failure retains existing local/default fallbacks; critical model/render failure is explicit. Global imagery LOD is not exhaustively prefetched, and newly requested imagery can still depend on network/cache availability. No terrain resource is introduced.

Zero programs link during the complete arbitrary pose matrices and the final resource-only sweeps, and no >10ms shader-status/link call occurs in those flights. Startup retains some one-time compilation/render cost before controls enable. Direct preparation cost includes one-time spline/LUT capture, never a per-frame rebuild. Stock atmosphere, fog, skybox, PBR maps, trajectory materials, FXAA, silhouette and full textures remain; see actual native shader diagnostics and resource identity records.

Matched baseline/final profiles use the same Mac, Chromium/ANGLE Metal, UTC `2026-09-30T15:45:59.975908Z`, archived real API inputs, starting world pose, 1280×720 CSS and native DPR2. GIBS failure is held constant for reproducible local imagery. One benchmark page runs at a time; no simultaneous Chromium benchmarks/builds/tests. First Inspect is requested ~50ms after readiness; warm follows the first round trip and two-second wait. The real selected-source frame keeps advancing during each timed flight.


| Run | GLB ready ms | Inspect enabled ms | Sky idle task ms | Sky ready / warming at enabled |
| --- | --- | --- | --- | --- |
| final-dev-gp | 2582.30 | 3155.00 | 127.20 | True / False |
| final-dev-oem | 2438.60 | 3004.30 | 115.50 | True / False |
| final-prod-gp | 1920.70 | 2484.30 | 109.10 | True / False |
| final-prod-oem | 1798.50 | 2372.30 | 91.90 | True / False |


### Baseline vs final: every first/warm direction

Cycle0 is first use, cycle1 warmed. Frame cadence is postRender wall-time; angular/focal derivatives use actual camera application time, independently. Threshold counts exclude the first frame's missing interval. Long tasks intersect the active route. Small differences in GPU/browser scheduling do not establish a universal speedup.


| Run | State | Direction | FPS | p50 ms | p95 | p99 | Worst | >33.3 | >50 | Long tasks | CPU p50 ms | CPU max | Focus max | Capture ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline-dev-gp | first | entry | 26.95 | 37.10 | 47.81 | 49.95 | 60.40 | 151 | 2 | 0 | 0.000 | 0.200 | 0.100 | 20.30 |
| baseline-dev-gp | first | exit | 26.81 | 37.30 | 49.40 | 53.78 | 57.40 | 128 | 5 | 0 | 0.000 | 0.100 | 0.100 | 21.90 |
| baseline-dev-gp | warm | entry | 26.18 | 38.20 | 48.51 | 51.28 | 52.00 | 152 | 6 | 0 | 0.000 | 0.200 | 0.200 | 23.80 |
| baseline-dev-gp | warm | exit | 26.95 | 37.10 | 49.80 | 52.64 | 53.10 | 130 | 4 | 0 | 0.000 | 0.200 | 0.200 | 21.10 |
| baseline-dev-oem | first | entry | 26.60 | 37.60 | 47.12 | 50.35 | 51.80 | 146 | 3 | 0 | 0.000 | 0.100 | 0.100 | 20.50 |
| baseline-dev-oem | first | exit | 27.32 | 36.60 | 48.14 | 50.74 | 56.80 | 131 | 3 | 0 | 0.000 | 0.200 | 0.100 | 20.10 |
| baseline-dev-oem | warm | entry | 26.39 | 37.90 | 48.30 | 50.29 | 51.20 | 151 | 4 | 0 | 0.000 | 0.200 | 0.200 | 24.00 |
| baseline-dev-oem | warm | exit | 26.67 | 37.50 | 48.85 | 52.59 | 53.10 | 127 | 4 | 0 | 0.000 | 0.200 | 0.200 | 21.30 |
| baseline-prod-gp | first | entry | 26.25 | 38.10 | 46.52 | 50.78 | 51.30 | 150 | 3 | 0 | 0.000 | 0.200 | 0.100 | 19.10 |
| baseline-prod-gp | first | exit | 26.88 | 37.20 | 48.70 | 50.10 | 50.20 | 130 | 3 | 0 | 0.000 | 0.200 | 0.100 | 20.40 |
| baseline-prod-gp | warm | entry | 26.04 | 38.40 | 47.90 | 51.04 | 52.30 | 148 | 3 | 0 | 0.000 | 0.200 | 0.100 | 21.20 |
| baseline-prod-gp | warm | exit | 25.91 | 38.60 | 50.75 | 57.55 | 59.00 | 125 | 8 | 0 | 0.000 | 0.200 | 0.100 | 18.70 |
| baseline-prod-oem | first | entry | 26.32 | 38.00 | 48.70 | 51.78 | 54.00 | 150 | 6 | 0 | 0.000 | 0.200 | 0.100 | 18.10 |
| baseline-prod-oem | first | exit | 27.17 | 36.80 | 49.00 | 52.78 | 55.80 | 131 | 5 | 0 | 0.000 | 0.200 | 0.100 | 18.70 |
| baseline-prod-oem | warm | entry | 25.97 | 38.50 | 48.75 | 50.47 | 51.10 | 150 | 2 | 0 | 0.000 | 0.200 | 0.200 | 22.90 |
| baseline-prod-oem | warm | exit | 27.10 | 36.90 | 50.05 | 51.77 | 52.80 | 128 | 7 | 0 | 0.000 | 0.200 | 0.100 | 19.20 |
| final-dev-gp | first | entry | 26.74 | 37.40 | 49.58 | 53.40 | 55.70 | 149 | 8 | 0 | 0.000 | 0.200 | 0.100 | 20.50 |
| final-dev-gp | first | exit | 27.86 | 35.90 | 48.51 | 52.43 | 55.60 | 131 | 6 | 0 | 0.000 | 0.200 | 0.100 | 19.90 |
| final-dev-gp | warm | entry | 26.81 | 37.30 | 47.75 | 50.84 | 51.20 | 144 | 4 | 0 | 0.000 | 0.200 | 0.200 | 22.70 |
| final-dev-gp | warm | exit | 27.47 | 36.40 | 49.52 | 53.91 | 57.20 | 130 | 7 | 0 | 0.000 | 0.200 | 0.200 | 22.10 |
| final-dev-oem | first | entry | 26.95 | 37.10 | 47.37 | 50.24 | 50.60 | 148 | 3 | 0 | 0.000 | 0.200 | 0.100 | 20.10 |
| final-dev-oem | first | exit | 27.32 | 36.60 | 50.40 | 52.05 | 54.10 | 130 | 8 | 0 | 0.000 | 0.100 | 0.100 | 21.30 |
| final-dev-oem | warm | entry | 26.60 | 37.60 | 49.30 | 51.90 | 53.10 | 144 | 6 | 0 | 0.000 | 0.200 | 0.200 | 21.80 |
| final-dev-oem | warm | exit | 27.10 | 36.90 | 52.15 | 57.03 | 58.40 | 129 | 8 | 0 | 0.000 | 0.100 | 0.100 | 20.90 |
| final-prod-gp | first | entry | 26.46 | 37.80 | 47.84 | 50.20 | 51.60 | 150 | 4 | 0 | 0.000 | 0.200 | 0.200 | 18.10 |
| final-prod-gp | first | exit | 27.47 | 36.40 | 48.96 | 52.57 | 52.80 | 132 | 5 | 0 | 0.000 | 0.200 | 0.100 | 20.40 |
| final-prod-gp | warm | entry | 26.74 | 37.40 | 48.30 | 53.21 | 54.50 | 150 | 5 | 0 | 0.000 | 0.200 | 0.100 | 22.20 |
| final-prod-gp | warm | exit | 27.32 | 36.60 | 47.90 | 49.90 | 51.20 | 131 | 1 | 0 | 0.000 | 0.100 | 0.100 | 19.30 |
| final-prod-oem | first | entry | 26.67 | 37.50 | 47.82 | 51.41 | 53.80 | 149 | 5 | 0 | 0.000 | 0.200 | 0.200 | 17.40 |
| final-prod-oem | first | exit | 27.40 | 36.50 | 50.32 | 52.14 | 55.00 | 132 | 8 | 0 | 0.000 | 0.200 | 0.200 | 18.30 |
| final-prod-oem | warm | entry | 26.53 | 37.70 | 49.96 | 51.84 | 53.00 | 146 | 8 | 0 | 0.000 | 0.200 | 0.200 | 21.00 |
| final-prod-oem | warm | exit | 27.03 | 37.00 | 50.50 | 53.93 | 54.30 | 130 | 8 | 0 | 0.000 | 0.200 | 0.100 | 21.00 |


### CPU, GPU and network interpretation

Per-frame transition/composition work is measured directly, including any nested focal evaluation once in transition total. Construction is separately measured above. [CDP CPU sampling](cpu-analysis.json) preserves first/warm entry and exit profiles, native idle/GC samples and top self-sampled functions. Minified profiles do not permit perfect React/render preparation attribution; no fabricated per-pass timings are reported. Camera state lives in retained Cesium vectors, with no per-frame React camera update. Existing meaningful mode changes and throttled time/readout UI callbacks persist. No LUT/material/provider/primitive allocation hotspot is added in the transition loop.

The browser supports `EXT_disjoint_timer_query_webgl2`. Asynchronous elapsed queries are consumed only after availability, with disjoint checks; raw nanosecond-derived durations bracket scene draw submission, including queue scheduling, rather than identifying individual passes. [Timer query semantics](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query). Native GL wrappers separately identify shader-status stalls. GPU elapsed time and wall cadence can differ under shared pipeline scheduling. Full-resolution model/atmosphere/silhouette/FXAA cost remains significant; no 60FPS guarantee is claimed. Controlled local-image runs isolate network failure; live smoke verifies ordinary backend delivery separately.


| Run | State | Direction | GPU p50 ms | p95 | p99 | Max | Disjoint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline-dev-gp | first | entry | 46.90 | 69.48 | 70.90 | 72.01 | 0 |
| baseline-dev-gp | first | exit | 47.41 | 72.70 | 74.57 | 75.23 | 0 |
| baseline-dev-gp | warm | entry | 46.93 | 70.86 | 71.66 | 72.01 | 0 |
| baseline-dev-gp | warm | exit | 46.80 | 70.60 | 73.93 | 75.06 | 0 |
| baseline-dev-oem | first | entry | 46.87 | 69.27 | 73.45 | 74.41 | 0 |
| baseline-dev-oem | first | exit | 46.99 | 70.61 | 71.11 | 73.16 | 0 |
| baseline-dev-oem | warm | entry | 46.17 | 69.27 | 70.91 | 71.32 | 0 |
| baseline-dev-oem | warm | exit | 47.53 | 70.72 | 71.31 | 74.25 | 0 |
| baseline-prod-gp | first | entry | 46.09 | 68.77 | 70.00 | 71.71 | 0 |
| baseline-prod-gp | first | exit | 47.43 | 69.62 | 72.22 | 73.65 | 0 |
| baseline-prod-gp | warm | entry | 46.36 | 69.32 | 71.53 | 75.66 | 0 |
| baseline-prod-gp | warm | exit | 48.94 | 75.34 | 79.34 | 79.79 | 0 |
| baseline-prod-oem | first | entry | 46.88 | 69.90 | 71.96 | 72.55 | 0 |
| baseline-prod-oem | first | exit | 47.45 | 70.42 | 72.42 | 73.02 | 0 |
| baseline-prod-oem | warm | entry | 46.75 | 69.01 | 70.65 | 72.20 | 0 |
| baseline-prod-oem | warm | exit | 46.86 | 70.16 | 72.62 | 72.75 | 0 |
| final-dev-gp | first | entry | 45.80 | 69.74 | 74.63 | 76.67 | 0 |
| final-dev-gp | first | exit | 46.54 | 72.91 | 75.44 | 76.01 | 0 |
| final-dev-gp | warm | entry | 45.39 | 73.29 | 78.89 | 79.03 | 0 |
| final-dev-gp | warm | exit | 46.09 | 72.54 | 80.25 | 82.33 | 0 |
| final-dev-oem | first | entry | 45.54 | 69.87 | 72.81 | 73.89 | 0 |
| final-dev-oem | first | exit | 46.23 | 72.77 | 74.60 | 74.98 | 0 |
| final-dev-oem | warm | entry | 45.74 | 70.11 | 74.33 | 74.52 | 0 |
| final-dev-oem | warm | exit | 47.23 | 75.61 | 80.05 | 80.60 | 0 |
| final-prod-gp | first | entry | 46.12 | 71.07 | 73.75 | 74.17 | 0 |
| final-prod-gp | first | exit | 45.90 | 72.80 | 74.52 | 75.27 | 0 |
| final-prod-gp | warm | entry | 45.33 | 71.04 | 74.11 | 74.54 | 0 |
| final-prod-gp | warm | exit | 47.18 | 73.39 | 75.09 | 77.58 | 0 |
| final-prod-oem | first | entry | 45.52 | 70.90 | 73.18 | 73.57 | 0 |
| final-prod-oem | first | exit | 46.02 | 72.70 | 74.88 | 75.24 | 0 |
| final-prod-oem | warm | entry | 45.38 | 70.08 | 74.31 | 74.99 | 0 |
| final-prod-oem | warm | exit | 45.94 | 72.73 | 74.62 | 75.08 | 0 |


## Partial Back and repeated-cycle stability

Back10/20/35/50/65/80/95% passes for two builds×two sources. Capture preserves position, basis, FOV and explicit focus; outgoing epsilon preserves incoming world velocity and angular/focal derivative. The finite focus chord diagnostic is distinct from the coherent retained derivative. No instantaneous frame switch occurs at the request.


| Back % | Cases | Max focus jump m | Max relative focus derivative error | Max position jump m | Max angular derivative error rad/s |
| --- | --- | --- | --- | --- | --- |
| 10.0 | 4 | 4.165e-09 | 1.188e-05 | 0.000e+00 | 4.637e-08 |
| 20.0 | 4 | 2.281e-09 | 4.591e-06 | 0.000e+00 | 4.647e-08 |
| 35.0 | 4 | 1.164e-10 | 1.839e-06 | 0.000e+00 | 1.945e-08 |
| 50.0 | 4 | 2.328e-10 | 2.666e-08 | 0.000e+00 | 3.401e-11 |
| 65.0 | 4 | 1.164e-10 | 4.084e-08 | 0.000e+00 | 5.014e-11 |
| 80.0 | 4 | 1.164e-10 | 3.394e-08 | 0.000e+00 | 6.631e-11 |
| 95.0 | 4 | 2.328e-10 | 2.642e-08 | 0.000e+00 | 7.391e-11 |


Twenty real-time round trips per build alternate sources: ten GP and ten OEM. Ten accelerated geometry cycles per source/build provide additional restoration checks. GC-normalized heap falls after transient trace/LUT data is released; this is a local leak check, not GPU-memory accounting. Querying the transition prototype yields zero retained transition instances. [CDP queryObjects](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-queryObjects). One retained model, six scene primitives, two imagery layers, the same Globe/Atmosphere/providers and post-process resources persist. Camera/FOV drift is zero.


| Build | Real cycles/source | Heap before MiB | Heap after MiB | Retained transitions | Position/FOV drift |
| --- | --- | --- | --- | --- | --- |
| development | 10 | 125.85 | 97.40 | 0 | 0 m /0 rad |
| production | 10 | 92.09 | 64.21 | 0 | 0 m /0 rad |


| Build | Source | Direction | Mean p50 first five cycles ms | Last five ms |
| --- | --- | --- | --- | --- |
| development | PRIMARY_GP_TLE | entry | 38.23 | 37.92 |
| development | PRIMARY_GP_TLE | exit | 37.16 | 37.36 |
| development | NASA_OEM | entry | 37.94 | 37.85 |
| development | NASA_OEM | exit | 37.38 | 37.12 |
| production | PRIMARY_GP_TLE | entry | 38.27 | 38.40 |
| production | PRIMARY_GP_TLE | exit | 37.46 | 37.43 |
| production | NASA_OEM | entry | 38.18 | 38.35 |
| production | NASA_OEM | exit | 37.38 | 37.36 |


## Quality, pacing and regression proof

The unchanged NASA VTAD `/models/iss-vtad-source-png.glb` is 32,735,516 bytes, SHA256 `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`: 19 source PNG images (15×1024²,4×512²),27 materials,132 nodes,131 meshes, mipmap minFilter9987. No image/model simplification or replacement. [Full asset/source hash audit](quality-preservation.json).

MSAA4, retained native FXAA (Overview bypass/active close modes), resolutionScale1, browser recommended resolution disabled, DPR2 and 2560×1440 buffer remain. Same PBR custom shader, environment maps, silhouette policy, imagery/provider quality, native Earth depth, full trajectory geometry and adaptive gap/rounded start. Source hashes of graphicsQuality, issMaterialQuality, inspectionAntialiasing, earthImagery, trajectoryRendering, trajectoryClearance, earthViewPresentation, inspectionControls, perceptualPath and arcLengthPath equal baseline. The six retained primitives/two layers and quality flags are checked in browser resources, not solely inferred from hashes.

Desktop endpoint remains 90 m /42.5° /100°, rear/elevated with zero lateral offset; portrait retains accepted aspect widening. Model scale1/minimumOverview80, trajectory-aligned visual orientation and honest unavailable attitude remain. Back restores exact captured Earth pose, frustum, transform and controllers. Perceptual raster growth remains distributed near entry: actual model-minus-background image pairs quantify the final5%, including native mobile foreshortening. Height-growth fractions below refer to the net0→100 height change; mobile is not falsely claimed to have monotone distant mesh height.


| Surface | Source | Start height CSS px | Endpoint height | Last5% px | % net growth |
| --- | --- | --- | --- | --- | --- |
| baseline | PRIMARY_GP_TLE | 54.5 | 346.5 | 8.0 | 2.74 |
| baseline | NASA_OEM | 55.0 | 346.5 | 8.0 | 2.74 |
| production | PRIMARY_GP_TLE | 54.5 | 346.5 | 8.5 | 2.91 |
| production | NASA_OEM | 55.0 | 346.5 | 8.5 | 2.92 |
| narrow | PRIMARY_GP_TLE | 54.5 | 243.5 | 5.5 | 2.91 |
| narrow | NASA_OEM | 55.0 | 243.0 | 5.0 | 2.66 |
| mobile | PRIMARY_GP_TLE | 55.0 | 73.0 | 1.0 | 5.56 |
| mobile | NASA_OEM | 55.0 | 73.0 | 1.0 | 5.56 |


The complete development/production matrix passes day/night/terminator and city-light/local-image fallback, both sources, 900px desktop and390px mobile, native wheel/orbit/pinch, refresh,14 semantic picks per source, delayed5s GLB, OEM loss during entry/stable Inspection/exit, atomic focus-preserving GP retarget, silhouettes/lift/trajectories and endpoint/restore. No unexpected page/application/WebGL errors remain; expected intentionally aborted GIBS/503 resource diagnostics are identified separately. [Full matrix](production-full.json), [regressions](production-extra.json), [reversals](production-reversals.json), [clean live smoke](clean-live-smoke.json).

Equivalent visual lint has no unnamed controls, unnamed images, clipped controls or overflow blockers. An initial lint flagged the unchanged Cesium ion credit for absent alt. Its native `title="Cesium ion"` gives the image an accessible name in both baseline and final; the corrected gate checks that name and retains absent-alt as a warning. The initial report and failed attempt remain preserved. Tiny-credit/approximate-contrast warnings are reported in raw lint evidence; this transition-only change does not redesign existing typography or treat a WebGL background contrast estimate as an accessibility certification.

## Validation, documentation and acceptance

Frontend **130 tests /24 files**, complete suite, typecheck and production build pass on Node24. Backend **82 tests**, zero failures/errors/skips, `mvn test` and `mvn verify` pass on Java21; backend sources are unchanged. Existing large Cesium bundle warning remains. The final source is free from QA globals; served clean production bundle identity equals local dist. [Validation/source manifest](validation.json), [numerical/browser acceptance](focus-validation.json), [full serial matrix execution](qa-run.json), [final source profiles/resource/raster/startup/lint execution](qa-evidence-run.json).

The complete geometry/reversal/20-cycle matrix was captured immediately before the final startup ordering guard. That guard only excludes temporary celestial renders from the eight-frame counter: all complete-matrix captures had sky ready before model ready, so it was inactive for their paths and timings. Exact final source then passed fresh/warm dev/prod×GP/OEM profiles, both forced startup races, final resource sweeps, raster/lint and clean live smoke. This distinction preserves honest source lineage without attributing changed motion to an inert startup predicate.

Updated frontend README, iss-inspection-mode, iss-model, rendering-quality, orbital-trajectory-rendering, architecture03/04 and ADR-0006's dated camera clarification. Existing source/domain/physical/display separation and accepted architecture persist; no new ADR threshold is crossed. Evidence here retains complete JSON (raw trace and large arbitrary/probe JSON losslessly gzip-compressed), per-frame CSV, profiles, plots, contact sheets and rejection diagnostics; disposable redundant PNGs/JPEGs are omitted. `/Users/daniel/Desktop/mission1-project.md` is updated outside Git. Normal new commit only; no history rewriting. SSH push to `git@github.com:therabo/MISSION1.git`, branch main, explicit intended Ed25519 key; fetched origin/main and direct GitHub main must equal local HEAD before reporting completion.

All A–O acceptance gates pass in the reviewed conditions: continuous subject transfer both directions, smooth camera/Up, no avoidable focus-time compilation/resource event, arbitrary starts, first/warm readiness, repeated-cycle stability, quality/pacing/endpoint preservation, continuous partial Back, GP/OEM and regressions. Local GPU cost and unbounded future global imagery/network coverage remain explicit limits; neither is disguised through reduced quality.

Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**. Not started.
