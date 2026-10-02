# Experimental work classification — 2026-10-02

Accepted HEAD: `fa5ed6379bf919419973ee1eb3d45f7ddaebdd58`.
Inspected status, 15 commits, complete tracked diff and diff-check before editing.
Preserved outside Git:

- `/Users/daniel/Desktop/mission1-trajectory-rendering-experiment.patch` (28,963 bytes).
- `/Users/daniel/Desktop/mission1-trajectory-rendering-experiment-untracked.zip` (145 files, 18,452,744 bytes; includes both untracked source files and all existing evidence).

| Existing change | Disposition | Reason |
| --- | --- | --- |
| `EarthView.tsx`: camera-pose invalidation | REWORK | Same-frame camera coherence is necessary. Avoid pose arrays and move camera presentation to render preparation after native controls update. |
| `EarthView.tsx`: Overview `resolveFoldbacks` | DISCARD | Enables full-future-arc scan and rejected last-reentry origin. |
| `trajectoryClearance.ts`: unnormalized chord support | REWORK | Removes tiny-vector division but still defines origin by screen direction. Replace with temporal first local exit. |
| `trajectoryClearance.ts`: conservative release/hysteresis | REWORK | Must never hold an old pose into a correction frame or accumulate a nonlocal gap. |
| `trajectoryClearance.ts`: finite projection and scratch storage | KEEP | Prevents invalid uniforms without changing physical geometry. |
| `trajectoryClearance.ts`: source globe-occlusion evaluator | DISCARD | Was used to choose discontinuous terminal reentry branches; native depth remains. |
| `trajectoryProjectedPath.ts` | DISCARD from runtime | Last-footprint-pass strategy costs 1–2 ms and removes useful foreground arc. Original file remains in the external archive. |
| `trajectoryAppearance.ts` | KEEP / verify | Segment capsule coverage removed reproduced body and halo filaments, retains source vertices and native depth. Recheck caps, joins, clipped temporal coordinates. |
| `trajectoryClearance.test.ts`: finite/zero-direction tests, rotated hull | KEEP / adapt | Useful deterministic edge cases; adapt to first-exit/local-mask contract. |
| `trajectoryClearance.test.ts`: same-camera cadence test | REWORK | Verify current camera on every render frame, including a stationary frame after motion. |
| `trajectoryClearance.test.ts`: last genuine exit / globe-hidden-return expectations | DISCARD / replace | Explicitly contradict required first-exit origin. |
| `trajectoryClearance.test.ts`: release test | REWORK | Test bounded locality and no post-motion correction. |
| `trajectoryRendering.test.ts`: independently measured baseline vertex hash | KEEP | Protects exact physical geometry. |
| `trajectoryRendering.test.ts`: appearance/native depth assertions | KEEP / extend | Add mathematical coverage and retained camera-independent state tests. |
| Four documentation insertions (frontend README, trajectory rendering, rendering quality, architecture 04) | DIAGNOSTIC_ONLY / update status later | Correct historical failed-candidate notes; must not imply acceptance of the discarded strategy. |
| Existing `trajectory-rendering-artifact-review/` evidence/scripts | DIAGNOSTIC_ONLY, preserve all | Real archived input, angle/isolation/axis traces, CPU comparisons and failures remain useful. New evidence lives only under `final-candidate/`. |

No camera, propagation, source, asset, rendering-quality, Inspection or ADR implementation is authorized to change. No new ADR is planned. Acceptance is pending all four independent rendering defects and the complete QA/performance gates.
