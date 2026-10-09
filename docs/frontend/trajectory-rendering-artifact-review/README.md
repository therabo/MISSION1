# Trajectory rendering artifact investigation — 2026-10-02

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

**Status: incomplete, unaccepted, uncommitted. Do not treat this directory as a successful milestone.**

The baseline is `fa5ed6379bf919419973ee1eb3d45f7ddaebdd58`, `fix: preserve trajectory clearance during inspection exit`. Local `main`, `origin/main` and GitHub `main` were identical and the tree was clean before implementation. They still name that commit. The experimental working tree has not been committed or pushed.

The three defects were reproduced independently. The candidate fixes the recorded forward-axis disappearance and confines reproduced miter filaments, but its last-footprint-pass strategy fails a crossing continuity check: **51.124 CSS px GP / 51.127 CSS px OEM**, with one gap/epoch reversal. The CPU comparison also fails the intended near-zero additional-cost target. Unit and navigation regression success do not override those failures.

## Context actually reviewed

- `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`, including the physical/presentation and real-data rules.
- `/Users/daniel/Desktop/mission1-project.md`; this context remains outside Git.
- Actual project skills: `iss-3d-earth-view`, `devops-local-platform`, `iss-3d-station-view`, `flight-dynamics-orekit`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `architecture-decisions`; actual personal `frontend-design-codex` skill and its relevant browser/visual QA references. No dedicated rendering-performance skill was found. No agents were delegated.
- [Frontend README](../../../frontend/README.md), [orbital trajectory rendering](../orbital-trajectory-rendering.md), [rendering quality](../rendering-quality.md), [Inspection](../iss-inspection-mode.md), [model](../iss-model.md).
- [Trajectory presentation review](../trajectory-presentation-review/README.md), [transition visibility review](../trajectory-transition-visibility-review/README.md), [previous clearance correction](../final-graphics-regression-fixes/README.md).
- [Camera transition review](../camera-transition-perfecting-review/README.md), [perceptual results](../camera-transition-perfecting-review/perceptual/results.md), [focus results](../camera-transition-perfecting-review/focus-optimization/results.md).
- [Architecture 03](../../architecture/03-repository-and-roadmap.md), [architecture 04](../../architecture/04-earth-view-orbital-delivery.md), [ADR-0006](../../adr/0006-selectable-forward-trajectory-visualization.md), [ADR index](../../adr/README.md). No ADR was changed or created.

The pinned Cesium 1.145 implementation was inspected, including polyline extrusion, built-in glow, primitive render state, near-plane clipping, translucent passes and globe-depth copying. Public references consulted: [PolylineGeometry](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGeometry.html), [PolylineMaterialAppearance](https://cesium.com/learn/cesiumjs/ref-doc/PolylineMaterialAppearance.html), [Material](https://cesium.com/learn/cesiumjs/ref-doc/Material.html). There are no private JavaScript renderer-field accesses in the candidate.

## Reproduction setup

Disposable baseline and candidate frontend copies were instrumented outside Git with the existing [instrumentation script](../trajectory-transition-visibility-review/scripts/instrument.py). The actual repository and its native production bundle have no `__qa` hooks.

Controlled runs use the already recorded real [sample response](../inspection-orientation-review/real-samples.json) and [comparison response](../inspection-orientation-review/real-comparison.json), with frozen UTC `2026-09-30T15:45:59.975908Z`. No ISS coordinates were fabricated. Test-fixture paths in unit tests are explicitly synthetic TEST data. The browser fallback test simulates an OEM outage and is not evidence of a real source outage. Native smoke also ran against the existing real backend without response interception.

The principal viewport is 1280×720 CSS px at DPR 2, drawing buffer 2560×1440. Narrow and mobile regression viewports are 900×700 and 390×844. Chromium is 151.0.7922.34, ANGLE Metal on Apple M1. The common controlled imagery abort selects the existing fallback in both builds; expected `ERR_FAILED` network messages are separate from JavaScript page errors.

Camera angle definitions are explicit: `f` is the selected source's physical one-second future direction; `u` is the WGS84 normal orthogonalized against `f`; `l = cross(f,u)`. The offset from the displayed model center is `range * (-cos(theta)*f + sin(theta)*(cos(phi)*u + sin(phi)*l))`. Theta 180° is ahead of the ISS, looking back along the future axis. Phi 0° is the orbital/radial plane. These are diagnostic camera placements, not application camera changes.

## Defect 1: origin disappearance and unstable support

### Proven baseline cause

The downstream support direction comes from the first projected future interval. At this UTC the next delivered point is only about 0.895 seconds ahead. In a nearly aligned view its projected chord falls to **0.000145391 CSS px GP / 0.000194288 CSS px OEM**. The baseline normalizes this tiny chord. Its sign can choose the opposite support half-plane while the farther physical future curve still has useful projected motion. The start then becomes null and the entire trail alpha becomes zero. Overview's 100 ms search cadence also reuses a camera-dependent start during manual motion; its mask is already current, so that mask cannot repair a stale temporal start.

This path did not show repeated gap reversals before disappearance. Gap oscillation was investigated and was not established as the cause of this particular baseline failure.

### Candidate and measured limits

The candidate invalidates start selection on public camera pose/lens/viewport changes, uses unnormalized chord support, resolves bounded real sample intervals to ≤1 ms, and retains/releases safe earlier gaps with asymmetric subpixel hysteresis. It never moves a source vertex or invents an epoch.

Each trace has **250 consecutive rendered frames per source**. The forward-axis sweep changes theta 175°→185° and range 500 km→8000 km. Metrics separate gap-induced origin movement from normal projection of the previous physical onset through the new camera. Total movement includes the deliberate camera motion and should not be mistaken for flicker.

| Build / source | Baseline hidden frames | Candidate hidden frames | Worst gap-induced movement baseline → candidate | Candidate gap/epoch reversals |
|---|---:|---:|---:|---:|
| Development GP | 108/250 | 0/250 | 0.999 → 0.295 CSS px | 0 |
| Development OEM | 108/250 | 0/250 | 1.764 → 0.295 CSS px | 0 |
| Production GP | 107/250 | 0/250 | 2.252 → 0.295 CSS px | 0 |
| Production OEM | 107/250 | 0/250 | 1.270 → 0.295 CSS px | 0 |

Candidate total screen movement is at most 9.125 CSS px GP / 9.113 OEM on this deliberately fast camera path. That is predominantly ordinary camera projection. Static UTC makes first-onset epoch reversals equivalent to gap reversals here. Cadence depends on wall time, so the baseline's last valid frame and measured valid-to-valid maximum differ between development and production.

Additional ahead-axis, slightly off-axis and reverse traces have worst gap-induced motion 0.163/0.175/0.265 CSS px GP and 0.163/0.174/0.265 OEM, with no hidden frames or reversals.

**The crossing trace fails.** Theta 30°→−30°, phi 0°, range 500→8000 km changes selected projected branches at frame 24. GP moves 51.124 CSS px and OEM 51.127 CSS px from gap selection alone; total movement is approximately 52.55 CSS px. Both have one gap/epoch reversal. This is not normal camera motion and is not an accepted fix.

Full raw traces and machine-readable origin metrics are retained under `data/` as gzip JSON. They include camera vectors, displayed position/range, source, reveal, first-interval direction/length/angle, gap time/path metres, first/second epochs and positions, clearance, alphas, and change flags.

**Measurement limit:** `temporalStart*` records the shader boundary; `analyticalPerceptibleOnset` evaluates centerline alpha ≥0.005 using the source interpolation and current uniforms. `firstVisible*` aliases that analytical onset, not the literal first GPU pixel. Matched raster on/off captures independently show baseline axis disappearance and candidate visibility. A full raster-origin trace remains a final-acceptance requirement; these analytical traces must not be relabeled as GPU pixel measurements.

| Axis baseline GP | Unaccepted candidate GP |
|---|---|
| *Archived visual: Axis baseline* | *Archived visual: Axis candidate* |

## Defect 2: rectangular clearance cut

### Independent reproduction and isolation

At theta 15.54°, phi 0°, range **2,307,000 m**, the projected future curve exits above the ISS and turns back through its protected footprint. Baseline GP starts near 94.739 s and OEM near 94.771 s, so both portions remain in the temporal trail. The all-fragment model mask cuts the returning portion and produces a flat rectangular-looking interruption.

The responsible representation is the convex hull of **eight projected corners of the measured 3D asset envelope**. There is no direct axis-aligned rectangle inclusion test in the fragment shader; the projected envelope itself can have almost rectangular sides. Its conservative empty space is still masked. `Mission1ScreenClearance` computes distance to that hull and multiplies body/halo alpha by `smoothstep(clearance, clearance + 0.75, distance)`.

Diagnostic controls were enforced in `preRender`; early exploratory toggles overwritten by the clock update were discarded as evidence. Disabling the clearance mask restores the cut portion. Disabling depth testing does not remove that cut while the mask remains. Body and halo both show it. Reveal forced to one, FXAA off, silhouette off, globe hidden and inactive hidden isolate other contributions and do not establish them as the rectangular-mask cause. There is no depth-fail material, ground classification, visible bounding quad, or transparent depth write responsible for this gap.

| Baseline masked | Same baseline, mask disabled | Same baseline, depth disabled |
|---|---|---|
| *Archived visual: Masked baseline* | *Archived visual: Mask disabled* | *Archived visual: Depth disabled* |

### Rejected correction

The candidate keeps the safety mask and chooses a start after the last visible protected-footprint return. It resolves inter-sample crossings without changing physical positions. In the reproduced view this starts around 503 s and removes the second cut.

This approach is **not acceptable as the final correction**. Counting every return at theta 30°/6000 km gives a start around 1013 s and erases a useful foreground arc because a later return is already behind Earth. Excluding those returns restores the foreground arc, but the Boolean globe-visibility decision changes projected branches abruptly and causes the 51 px origin failure above. The current source marks this strategy experimental. The minimum clearance and conservative mask must remain while this strategy is replaced.

| Rectangle baseline GP | Unaccepted candidate GP |
|---|---|
| *Archived visual: Baseline cut* | *Archived visual: Candidate cut removal* |

The controlled isolation proves the subsystem. A complete accepted before/first/worst/last affected-frame sequence and its corrected equivalents remains pending; static samples must not be claimed as that sequence.

## Defect 3: oblique miter filaments

At **theta 30°, phi 0°, range 6,000,000 m**, projected adjacent segments fold back. Stock Cesium polyline extrusion forms a long miter, with a pinned maximum expansion of four half-widths. Interpolated lateral material coordinates stretch across the expanded triangles. Built-in glow can therefore emit beyond the intended segment ribbon, giving a triangular projection and lateral filament. This occurs in **body alone and halo alone**, not only their combined translucency. Mask/depth/inactive isolation does not remove those protrusions.

The candidate [public appearance extension](../../../frontend/src/cesium/trajectoryAppearance.ts) retains the physical `PolylineGeometry`, original extrusion and native depth pipeline. Perspective-independent projected endpoints define distance to the genuine clipped segment; the existing glow profile uses that distance rather than the stretched miter coordinate. Alpha cannot extend beyond the segment capsule envelope. Near-plane clipping also updates the temporal texture coordinate to its actual clipped interval fraction. There are no extra physical vertices or CPU projections for this shader correction.

Matched source-colored on/off raster differences at the 30° fold have **203 GP / 199 OEM baseline pixels** beyond the halo-plus-AA envelope (11.25 CSS px). The candidate has 2 isolated GP difference pixels at positions also present in the baseline and zero OEM outside pixels; the two GP points are not connected filaments. Native crops show removal of the reproduced miter triangle. This is supporting raster evidence, not a brittle GPU unit assertion or proof for every possible view.

| Oblique baseline GP | Unaccepted candidate GP |
|---|---|
| *Archived visual: Baseline miter* | *Archived visual: Candidate capsule* |

The supplied angle evidence includes 30°, 45°, 60°, 75° and tangent 0° for **both sources**, at 6000 km, plus development/production planar and phi 45° sweeps at multiple ranges. The prominent baseline fold filament occurs at the specified planar 30° pose. The shader correction removes it there; the combined candidate remains unaccepted because its start logic and CPU cost fail. Angle overview JPEGs are half-size; matching `*-detail.png` files preserve native crop pixels.

## Rendering architecture and frozen behavior

Both baseline and candidate retain two `Primitive` layers per source, `PolylineGeometry`, `ArcType.NONE`, source positions, uniform future coverage and `SampledPositionProperty` interpolation. Halo width/alpha/glow remain 20/0.26/0.35; body 8/1/0.22. Active/inactive alpha remain 0.85/0.08; selected accents remain GP `#53d9cd` and OEM `#edb86a`. Inactive primitives are raised before the active pair. Native OIT remains enabled.

The Fabric trail retains the rounded temporal width gate, soft start ramp and endpoint fade. The existing convex-hull safety mask still applies to every fragment. Public translucent appearance state retains depth testing, `depthMask=false` and alpha blending. There is no depth-fail, classification or shadow workaround. Fully transparent trail fragments do not write depth. `czm_globeDepthTexture` is not used as an invented model-depth mask: the inspected pass ordering copies globe/3D-tile depth before opaque model drawing.

Range reveal remains hidden ≤100 km, logarithmic smootherstep 100→10,000 km, full ≥10,000 km. Horizon remains 0.85 revolution. Same-frame source/model/camera, clearance, reveal and material ordering is retained. The experimental Overview selector and shader are the only rendering strategy changes; automatic transitions retain the previously accepted support criterion.

The physical invariant comparison confirms identical **181 positions per source**, epochs, source windows and period:

| Value | Identical baseline/candidate SHA-256 |
|---|---|
| GP source positions | `1e117f13590cb804293c37d7d4bf85ee9136537945a4fbfc36c65b70db7ffcc3` |
| OEM source positions | `c9faee0458d8ae4490090d86a1d93be5f0e8b99e1d75e030fc6a1bb60389f985` |
| Source sample epochs | `c126b76b249dfc58f050bdab32ae53e33ad8c8be814029b97f21f2ff69a9efdb` |

A unit regression also compares the actual public geometry buffer against an independently measured untouched-baseline synthetic-test fixture hash. GP propagation, OEM interpolation, API/source selection, computed/predicted provenance, future horizon and original source timestamps are untouched.

No camera transition implementation, focus/pacing/duration, arbitrary-start handling, partial Back, prewarming, Inspection navigation/framing, model orientation/scale/minimumPixelSize, 75 km lift, white silhouette, assets, PNG/PBR, MSAA, FXAA, resolution scale or imagery was edited. Runtime regression evidence checks the accepted 90 m / 42.5° / 100° Inspection endpoint, module picking, orbit/wheel/pinch, source switch and OEM fallback.

## Performance: candidate fails the intended CPU target

Baseline and the current candidate were measured sequentially on the same host, browser, viewport, DPR, frozen UTC, fixtures and camera paths, with no other QA browser or build running. Each source/path has 120 warm-up frames and **400 measured frames**; each build totals 1600 measured frames. The production previews are used. `profile.cjs` only measures the update section and rendered-frame intervals, without the heavier trace snapshots.

| Source / path | CPU mean baseline → candidate, ms | CPU p95, ms | Frame median, ms | Frame p95, ms | Worst frame, ms |
|---|---:|---:|---:|---:|---:|
| GP axis crossing | 0.152 → 1.420 | 0.600 → 2.400 | 33.4 → 33.4 | 50.5 → 50.1 | 66.8 → 83.3 |
| GP oblique | 0.147 → 2.087 | 0.300 → 2.600 | 50.0 → 50.0 | 50.4 → 50.1 | 83.3 → 83.4 |
| OEM axis crossing | 0.214 → 1.383 | 1.000 → 2.300 | 33.4 → 33.4 | 50.1 → 50.1 | 83.2 → 66.7 |
| OEM oblique | 0.146 → 1.640 | 0.300 → 2.700 | 50.0 → 50.0 | 50.1 → 66.6 | 83.3 → 100.0 |

The CPU increase is 1.17–1.94 ms/update. The full-horizon projected-return search evaluates both bounded sources each moving frame and is not a near-zero-cost correction. Frame medians alone cannot be used to accept it. The GPU timer extension is available, but GPU timer queries were not collected; frame intervals include browser/CPU/GPU scheduling. This is one matched pair, not a repeated statistical GPU benchmark. Raw measurements and gzip frame rows are supplied. These are provisional failed-candidate measurements, not final performance acceptance.

## Validation actually run

| Gate | Observed result |
|---|---|
| Frontend full suite | **155 tests / 25 files passed**, from baseline 145 |
| Frontend typecheck | Passed |
| Native production build | Passed; existing large-bundle warning |
| Backend `mvn test` | **82 tests**, BUILD SUCCESS |
| Backend `mvn verify` | **82 tests**, BUILD SUCCESS |
| `git diff --check` | Passed |
| Real source positions/epochs comparison | Identical |
| Development/production planar/oblique/isolation runs | Executed for both sources; no JavaScript page errors |
| 250-frame forward-axis traces | Improved for both sources/builds; analytical measurement limit stated above |
| Oblique crossing continuity | **FAILED**, 51.13 CSS px origin jump |
| CPU target | **FAILED** for the current strategy |
| Desktop entry/exit/reveal/downstream clearance | Automated regressions passed |
| Partial Back 10/20/35/50/65/80/95% | Automated regressions passed in development/production |
| Narrow/mobile clearance and navigation | Executed with viewport-adapted picking/touch harness; successful recorded runs are retained |
| Source switch, 14 semantic module picks, OEM fallback | Automated regressions passed |
| Native dev/production real-backend smoke | Passed without QA hooks or API interception |
| Production diagnostic hooks | None introduced; `__qa` absent from native bundle |
| Complete final visual/raster/performance acceptance | **NOT PASSED** |
| Commit / push | **NOT ATTEMPTED**, as acceptance gates failed |

`validation/` retains the relevant logs and both job ledgers. Some earlier ledger entries tested intermediate candidates; the later `final-*` label only identifies the run, **not an accepted final version**. Overview start logic changed between intermediate candidates, while automatic camera code remained unchanged. Successful process exit from a screenshot harness is not itself visual acceptance.

Remaining work: replace the discontinuous terminal-footprint start strategy while preserving a visible foreground arc, the downstream safety mask, and the frozen camera/geometry/style; remove the full-horizon per-frame cost; collect the missing affected-frame sequence and raster origin proof; rerun the complete required matrix and performance comparison against the resulting candidate. There is no authorization to commit this failed candidate as a completed milestone.

## Reproduce the diagnostic runs

Use throwaway baseline/candidate frontend copies. Run the linked existing instrumentation with the **copy root** as its argument; never instrument the real repository. Start their development and built production servers on distinct ports. Reset `EarthView.tsx`, `skyRenderingWarmup.ts` and `inspectionRenderingWarmup.ts` from their respective uninstrumented version before reinstrumenting; instrumentation is not idempotent.

The scripts use `MISSION1_PLAYWRIGHT_MODULE`, `MISSION1_REPO_ROOT` and `MISSION1_EVIDENCE_DIR` for runtime/root/output paths. Supply a port and a descriptive label, for example:

```sh
node scripts/axis-trace.cjs 5189 candidate-dev-axis
node scripts/trace-final.cjs 4189 candidate-prod
node scripts/sweep.cjs 4189 candidate-prod-planar
node scripts/oblique.cjs 4189 candidate-prod-oblique
node scripts/isolate.cjs 4189 candidate-prod-isolation
node scripts/fold-isolate.cjs 4189 candidate-prod-fold-isolation
node scripts/rectangle-sweep.cjs 4189 candidate-prod-above-below
node scripts/raster.cjs 4189 candidate-prod-raster
node scripts/geometry.cjs 4189 candidate-geometry
node scripts/profile.cjs 4189 candidate-performance
node scripts/check-acceptance.cjs
```

Run performance builds serially, without other QA browsers/builds, on the same device/browser/DPR/UTC/path. The existing previous-clearance and camera-focus harnesses provide entry/exit, partial Back, semantic-picking, navigation and responsive regressions. No oversized videos or production diagnostic code are included here.

## Git and next milestone

No commit, amend, rebase, reset, history rewrite or push was performed. Local and remote/GitHub commit references remain `fa5ed6379bf919419973ee1eb3d45f7ddaebdd58`; the working tree intentionally contains this unaccepted candidate and its investigation evidence. The external project context is outside the repository and outside Git.

The requested next milestone remains queued, **not started**:

`GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS`
