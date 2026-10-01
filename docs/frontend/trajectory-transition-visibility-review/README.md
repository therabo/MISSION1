# Trajectory transition visibility — 2026-10-01–02

The accepted camera milestone `c3d24aed576b368bb2343abcb65d9067f5eaa7f2` is frozen. This correction keeps both real trajectories invisible during close departure, progressively restores their accepted opacity as Earth context returns, and uses the same curve on approach. RTN and Replay are not started.

## Context and cause

Before implementation, the clean local `main`, fetched `origin/main` and direct SSH GitHub ref all equalled `c3d24ae`. Read `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and the complete external `/Users/daniel/Desktop/mission1-project.md`; the latter stays outside Git.

Actual skills consulted: `iss-3d-earth-view` (scene lifecycle/coordinate contract), `iss-3d-station-view` (mapping/coordinate contract), `frontend-design-codex`, `devops-local-platform` (runtime/CI), `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, and `architecture-decisions`. The frontend skill's shared visual runtime is absent; the existing equivalent local visual-lint/contact-sheet workflow is used.

Documentation reviewed: `frontend/README.md`; `docs/frontend/{orbital-trajectory-rendering,iss-inspection-mode,rendering-quality,iss-model}.md`; `camera-transition-perfecting-review/README.md`, `perceptual/results.md`, `focus-optimization/results.md`; architecture `03-repository-and-roadmap.md` and `04-earth-view-orbital-delivery.md`; ADR-0006 and the ADR index. Only the existing ADR-0006 receives a clarification.

`inspectionPresentation()` marks `pathVisible` true for **EXITING_INSPECTION**. `EarthView.setMode()` immediately copied that boolean into every retained primitive's `show`, still at about 90 m. `updateTrail()` supplied full selected/inactive alpha with no visual transition factor. Entry likewise hid paths immediately at mode assignment. The projected clearance mask was updated only in Overview, leaving its far-view values during exit. [Baseline OEM exit at 0%](baseline-dev-NASA_OEM-exit-0.jpg) shows the premature amber trail.

## Policy and measured alternatives

Use Euclidean camera-to-**displayed**-model-center range, including the existing display lift/source-retarget bridge. No physical/source value or camera calculation changes. Existing projected bounds are a conservative eight-corner hull for clearance, not actual mesh occupancy; far `minimumPixelSize:80` makes rendered extent stop shrinking and change with lens/pose. Using occupancy would add work and produce a less stable reveal signal.

Let `H = min(10,000,000 m, captured Overview range)` and `L = min(100,000 m, H/2)`; capture only once on entry. During either transition:

```text
x = clamp(log(max(L, displayedRange)/L) / log(H/L), 0, 1)
trajectoryTransitionVisibility = x³ (10 − 15x + 6x²)
final maximumAlpha = existing maximumAlpha × trajectoryTransitionVisibility
```

Stable Inspection forces **0**, stable Overview **1**. For the canonical Earth start, trails stay completely hidden through **100 km**, fade over **100–10,000 km**, and reach full opacity at **10,000 km**. The captured cap prevents a mode-boundary step for nearer regional Overview starts. This is a range policy, not an elapsed-progress threshold. The C2 scalar has zero first/second derivatives at its range boundaries; the accepted camera/physical interpolation continuity is unchanged.

[Window trials](windows.jpg), with every actual range/factor in [windows.json](windows.json):

| Tested range window | Exit at 65% | Exit at 70% | Exit at 75% | Decision |
| --- | ---: | ---: | ---: | --- |
| 2–20 km | 0.524 | 1 | 1 | Too early and too short |
| 10–1,000 km | 0 | 0.552 | 1 | Full opacity too early in departure |
| **100–10,000 km** | **0** | **0.000207** | **0.511** | Later, broader return of Earth context |

At 72.5% the chosen factor is 0.183, at 80% 0.859 and at 90% 0.999. The three windows were applied to actual rendered frames of the unchanged accepted exit, not chosen from a timer estimate.

## Frame evidence

Native 2560×1440 captures at DPR2, CSS viewport 1280×720. [Compact frame CSV](frame-samples.csv) and full `*-samples.json.gz` reports contain 0/10/20/30/40/50/60/65/70/75/80/90/100% for both directions and both sources. Percentages label diagnostic frame locations; they are not runtime thresholds. Entry starts at fixed archived UTC `2026-09-30T15:45:59.975908Z`; exit captures the current UTC after a short 1× run to preserve the accepted incoming derivative. Small exit-range differences between runs follow that captured UTC.

Representative final **GP selected, exit** ([contact sheet](candidate-prod-PRIMARY_GP_TLE-exit.jpg), [OEM equivalent](candidate-prod-NASA_OEM-exit.jpg)):

| Exit | Display range, m | Approx. raster extent, CSS px | Visibility | Active body alpha | Inactive body alpha |
| --- | ---: | --- | ---: | ---: | ---: |
| 0% | 90.000 | 1011.5×346.5 | 0 | 0 | 0 |
| 20% | 123.092 | 650×230 | 0 | 0 | 0 |
| 40% | 237.072 | 291.5×109.5 | 0 | 0 | 0 |
| 60% | 1,442.193 | 62×25.5 | 0 | 0 | 0 |
| 80% | 2,734,812.442 | 61.5×44.5 | 0.860473 | 0.731402 | 0.068838 |
| 100% | 16,499,369.858 | 63.5×54 | 1 | 0.85 | 0.08 |

At 70% (114,090 m) the factor is only about 0.000225; at 75% (1,032,408 m) it is about 0.513. Full-size [OEM close departure](candidate-prod-NASA_OEM-exit-0.jpg) and [GP reveal at 80%](candidate-prod-PRIMARY_GP_TLE-exit-80.jpg) preserve the close view and later trail separation. Halo alpha always remains body alpha ×0.26: at 80%, selected 0.190164 / inactive 0.017898; at 100%,0.221 /0.0208. Both products receive the same scalar and retain their accepted selected/inactive contrast.

Representative **entry** ([GP](candidate-prod-PRIMARY_GP_TLE-entry.jpg), [OEM](candidate-prod-NASA_OEM-entry.jpg)):

| Entry | Display range, m | Approx. raster extent, CSS px | Visibility | Active body alpha |
| --- | ---: | --- | ---: | ---: |
| 0% | 16,498,496.422 | 63.5×54.5 | 1 | 0.85 |
| 20% | 2,725,226.319 | 61.5×51 | 0.859535 | 0.730605 |
| 40% | 1,441.320 | 62×25.5 | 0 | 0 |
| 60% | 237.339 | 291×109.5 | 0 | 0 |
| 80% | 123.234 | 649.5×230.5 | 0 | 0 |
| 100% | 90.000 | 1011.5×346.5 | 0 | 0 |

At30% entry the scalar is already 0.000217 at 113,917 m. Click itself preserves full Overview alpha. The reveal function has no direction-dependent timer to reset on Back.

Raster extent is diagnostic model-on minus model-off pixel difference within the hull, not a production signal or exact mesh-area measurement. It can include antialiasing/trail interaction, especially at far scales. Conservative projected hull vertices and width/height percentages are also retained in the compressed sample JSON. The actual frame images decide visual acceptance.

## Performance

One Chromium 1234/ANGLE Metal browser at a time, Apple M1, identical viewport/DPR, real archived API products, controlled identical local imagery fallback, clock 1×. Each source/build has a first transition plus a warm repeat, both directions. Disposable archives contain identical diagnostic timers; the application has none. [Summary](performance.json) and eight `*-trace.json.gz` preserve every frame, startup metadata, resources and handoffs. The summary keeps only renderer/readiness metadata; full startup records remain in each compressed trace.

| Build/source | Trajectory CPU mean, ms, before→after | Frame median, ms, before→after | Frame P95, ms, before→after |
| --- | --- | --- | --- |
| Development GP | 0.0182→0.0627 | 67.50→63.80 | 100.30→94.10 |
| Development OEM | 0.0180→0.0726 | 70.95→65.00 | 105.40→104.80 |
| Production GP | 0.0183→0.0761 | 67.80→64.75 | 101.60→98.50 |
| Production OEM | 0.0150→0.0806 | 74.75→66.00 | 112.60→98.90 |

The trajectory timer includes the existing clearance/mask update, now running during visible portions of entry/exit. Additional mean cost 0.045–0.066ms; P95 moves 0.1→0.3ms. No material frame-time regression appears in these local runs. Timer resolution is about 0.1 ms; scheduling/GPU variation means this is not a universal FPS claim or proof of zero cost. Camera mapping mean remains 0.048–0.065ms after versus 0.053–0.065ms before. No retained transition object survives completion and no page error occurs.

## Regression and gates

Final audit is recorded in [validation.json](validation.json). All required browser gates pass in development and served production:

- 28 exit sweeps of101 rendered steps: both sources, canonical90m, close-module58.5m, maximum2km and90°/180° orbit poses; additional canonical checks at900×700 and390×844. Stable/close-range alpha0, final1; primitive and vertex identity retained, saved Earth position/FOV error0.
- 28 actual-time partial Backs:10/20/35/50/65/80/95% for each source/build. Observed incoming alpha versus the exit policy at the same captured range has maximum difference0; dispatch retains existing uniforms. The accepted camera/focus derivative gates also pass.
- Semantic picking14 modules per source/build, native wheel/orbit/pinch, source switches, refresh, delayed GLB, and OEM loss during entry, stable Inspection and exit pass. Source fallback recapture position/direction/up/FOV errors0, focus error≤1.2e-9m; model remains onscreen.
- Equivalent visual lint:12 viewport/mode cases,0 blockers/errors/low-contrast findings. Existing9/10px metadata and native Cesium credit title-without-alt remain accepted warnings. [Mobile](production-mobile-surface.jpg), [narrow](production-narrow-surface.jpg).
- Clean live backend smoke on5175/4175: GP and OEM available, entry/return successful, no page errors or QA globals. [Actual-backend Inspection screenshot](clean-production-inspection.jpg). Served bundle equals the clean build ([hash](production-bundle.json)); native in-app production GP entry/return also verified.

The source/asset hashes in [frozen-source-manifest.json](frozen-source-manifest.json) preserve 142 tracked files, including 71 backend files and all 8 public asset files. `trajectoryRendering.ts` equals baseline after removing only its new argument and alpha multiplier; its geometry creation, shader, 85% future coverage, endpoint fade, rounded cap, widths, colors and layer ratio are identical. Existing clearance algorithm/constants and10Hz bound remain. Primitives, vertices, model, imagery providers, atmosphere and rendering resources remain retained across transitions. New products still use the existing complete-ready-group replacement.

Canonical 90m /42.5° /100°, portrait widening, 75km model-only lift, white Overview silhouette, focus/path/hybrid clock/pacing/durations/prewarming, native Inspection controls, physical/source interpolation and semantic picking remain unchanged. MSAA 4, native DPR/resolutionScale, FXAA, source PNG GLB/PBR, textures and imagery policy are preserved. No new orbital request, source evaluation for the reveal, geometry regeneration, React per-frame state, dependency, API or infrastructure is introduced.

The initial regression invocation accidentally used the pre-focus `scripts/browser-regressions.cjs`, whose `setView` observer cannot see the accepted public-camera application. It failed with a null observer value. The accepted `focus-optimization/scripts/browser-regressions.cjs` observes the actual transform capture and is the final gate; no camera code was changed to accommodate the old observer.

## Reproduction and artifacts

Use the existing frontend dependencies and Node24. Create disposable archives of `c3d24ae` and the candidate, symlink the installed `frontend/node_modules`, then run `scripts/instrument.py /absolute/archive`. It refuses a Git checkout via the underlying existing instrumentation. Build each copy and serve development and preview on separate ports. Run the scripts with `MISSION1_PLAYWRIGHT_MODULE`, `MISSION1_REPO_ROOT` and `MISSION1_EVIDENCE_DIR` set; `samples.cjs`, `poses.cjs`, `reversals.cjs`, `profile.cjs` accept `port label`. Use `MISSION1_QA_SOURCE` for one source profile and `MISSION1_QA_WIDTH`, `MISSION1_QA_HEIGHT` and `MISSION1_QA_POSES=canonical` for responsive checks. `trials.cjs` runs the three opacity windows on baseline. `raster.py` consumes temporary PNG pairs and builds concise contact sheets; `pack-samples.py evidence-folder` compresses full sample reports and produces the frame CSV; `summarize.py raw-output evidence-folder` retains compressed traces and computes the reported statistics.

The existing archived samples/comparison are real recorded historical backend responses, used only in controlled diagnostics. Outages are explicitly injected QA availability failures, not fabricated orbital values or application fallback. Clean development5175 and served production4175 are separately tested against the actual local backend without route interception or QA globals. The accepted focus regression and equivalent visual-lint scripts remain in their original review directory.

Frontend gates: full tests 138/25 files, typecheck and production build. Backend gates: Maven test and verify 82 tests, failures/errors/skips 0. The existing large Cesium bundle warning remains. `git diff --check` is the final whitespace gate. External project context is updated outside Git. Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not begun.
