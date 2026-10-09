# Final perceptual camera acceptance — 2026-10-01

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../../qa-artifact-policy.md) for archive recovery and current evidence.

Both visual and quantitative gates passed in development and served production before the new commit. The committed baseline is `538bb0642205be7f326aa3ae08ec2dc46134a212`; the inspected uncommitted strict-speed source and its original evidence remain in the parent directory. This review accepts perceptual progression, deliberately allowing variable Cartesian speed. [Method and implementation](README.md), complete analysis, browser gate summary. Publication hash and SSH synchronization are recorded in the Git history, final chat report and external project context, after the precommit gates.

## Comparison and visual decision

The baseline concentrated close-up growth at the end, peaked near 162°/s on entry, and lost the displayed station during return. The strict-speed candidate fixed composition but kept the station tiny until a final jump. Its approximately 17,227 km route at 3,445 km/s leaves the last kilometre to about 0.29 ms. The final route retains the cubic/Earth-clear geometry and allocates time to lens scale and steering. Six-second entry gives the close composition time to develop; five-second departure gradually reduces it before the globe returns. Direct comparison of actual rendered contact sheets shows continuous station/Earth composition, gradual near-field growth and no final recentering. The Earth details panel remains collapsed during return so it does not cover the close station.

| Entry raster-height growth | Source | Final 20% | Final 10% | Final 5% |
| --- | --- | --- | --- | --- |
| baseline | GP/TLE | 104.966% | 106.507% | 71.575% |
| baseline | NASA OEM | 105.146% | 106.690% | 71.698% |
| strict | GP/TLE | 108.904% | 109.247% | 109.589% |
| strict | NASA OEM | 109.091% | 109.434% | 109.777% |
| production | GP/TLE | 32.534% | 12.842% | 2.740% |
| production | NASA OEM | 32.590% | 12.864% | 2.744% |

The denominator is signed net endpoint height change. Values above 100% in rejected candidates arise because the far model first shrinks before its final pop. They are retained, not clipped. Final desktop entry adds only 8 CSS pixels in the last 0.3 seconds. The minimumPixelSize 80 legibility floor and changing model aspect prevent strictly monotone raster dimensions in far views; the chosen lens/steering metric is the timing criterion. Height and width, conservative hull and actual mesh pixel extent remain distinct.

## Entry projected scene progression

| Time | GP display range (m) | ln(range) | FOV (°) | GP width × height (CSS px) | OEM width × height |
| --- | --- | --- | --- | --- | --- |
| 0% | 16498496.422 | 16.618780 | 60.000 | 63.5 × 54.5 | 64.0 × 55.0 |
| 10% | 8098416.383 | 15.907179 | 60.171 | 59.5 × 49.0 | 59.5 × 49.0 |
| 20% | 2725226.319 | 14.818062 | 62.246 | 52.0 × 45.0 | 52.0 × 45.0 |
| 40% | 1441.320 | 7.273314 | 100.000 | 58.0 × 42.5 | 57.5 × 42.5 |
| 60% | 237.339 | 5.469489 | 100.000 | 277.5 × 145.0 | 277.5 × 145.0 |
| 80% | 123.234 | 4.814083 | 100.000 | 647.5 × 251.5 | 647.0 × 251.5 |
| 90% | 98.937 | 4.594486 | 100.000 | 879.5 × 309.0 | 879.5 × 309.0 |
| 95% | 91.554 | 4.516925 | 100.000 | 985.5 × 338.5 | 985.5 × 338.5 |
| 100% | 90.000 | 4.499810 | 100.000 | 1011.5 × 346.5 | 1011.5 × 346.5 |

## Exit projected scene progression

| Time | GP display range (m) | ln(range) | FOV (°) | GP width × height (CSS px) | OEM width × height |
| --- | --- | --- | --- | --- | --- |
| 0% | 90.000 | 4.499810 | 100.000 | 1011.5 × 346.5 | 1011.5 × 346.5 |
| 10% | 98.888 | 4.593992 | 100.000 | 880.5 × 307.0 | 880.5 × 307.0 |
| 20% | 123.092 | 4.812936 | 100.000 | 649.5 × 243.5 | 649.5 × 243.5 |
| 40% | 237.072 | 5.468365 | 100.000 | 284.0 × 137.5 | 284.0 × 137.5 |
| 60% | 1442.193 | 7.273920 | 100.000 | 58.5 × 40.5 | 58.5 × 41.0 |
| 80% | 2734823.746 | 14.821578 | 62.243 | 52.5 × 45.0 | 52.5 × 44.5 |
| 90% | 8121799.931 | 15.910062 | 60.170 | 59.5 × 48.0 | 59.5 × 48.5 |
| 95% | 13206336.032 | 16.396207 | 60.006 | 63.0 × 53.0 | 62.5 × 53.0 |
| 100% | 16499374.399 | 16.618833 | 60.000 | 63.5 × 54.0 | 63.5 × 54.0 |

Desktop arrival is 1011.5 × 346.5 CSS px: 79.023% viewport width and 48.125% height at 1280 × 720. Exit height/width reduction is spread over the close departure; the far readability floor restores a small visible station as the globe becomes dominant. That far-footprint rebound is intentional and is visible in the tables. Paired screenshot intervals measure maximum actual height-rate magnitude 103.333 px/s on entry and 136 px/s on return, width 405/480 px/s. The final entry interval is 26.667 px/s in height. Full per-frame conservative-hull derivative statistics, bounding areas and occupancy are in JSON/CSVs; these interval raster rates are not claimed as every-frame mesh measurements.

## Actual primary metric, speed and orientation

Primary q is 20% normalized log lens distance + 60% normalized inverse lens distance + 20% normalized local viewing-direction travel, with lens distance = displayed range × tan(FOV/2). Uniform central rate is 0.185185/s entry and 0.222222/s exit. Whole-route CV includes the intentional C2 start/stop ramps; the central 80% is reported separately. Rates below use actual rendered camera pose at application timestamps, rather than only the requested clock. Physical speed CV is not an acceptance gate.

| Source/route | Frames | Mean q/s | Median | Std dev | Whole CV | Central CV | Max q/s | Max / median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GP/TLE entry | 151 | 0.167 | 0.185 | 0.047 | 28.234% | 0.251% | 0.186 | 1.0088× |
| GP/TLE exit | 130 | 0.200 | 0.222 | 0.057 | 28.352% | 0.947% | 0.224 | 1.0078× |
| NASA OEM entry | 154 | 0.167 | 0.185 | 0.047 | 28.239% | 0.245% | 0.186 | 1.0056× |
| NASA OEM exit | 129 | 0.202 | 0.222 | 0.058 | 28.887% | 0.963% | 0.223 | 1.0063× |

| Source/route | Seconds | Geometric km | World speed min–max (m/s) | Frame-relative speed min–max | Max direction °/s | Max basis °/s | Max direction step ° | Max Up step ° |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GP/TLE entry | 6 | 17227.409 | 7337.707–18860010.123 | 0.000–18864915.023 | 59.003 | 65.666 | 2.156 | 1.837 |
| GP/TLE exit | 5 | 17215.031 | 27.297–22489224.519 | 0.299–22484594.883 | 66.894 | 79.056 | 2.676 | 2.400 |
| NASA OEM entry | 6 | 17226.581 | 7320.419–18901124.152 | 0.031–18906165.454 | 59.270 | 65.854 | 2.135 | 1.794 |
| NASA OEM exit | 5 | 17214.604 | 4915.018–22516009.658 | 3.568–22511329.983 | 66.326 | 78.412 | 2.910 | 2.488 |

These are camera presentation speeds, not ISS velocities. The moving source contributes orbital translation to world speed; finite samples near clock setup and C1 return correction also affect minima. Relative near-field speed approaches zero while far travel is fast. Physical velocity follows a C1 inverse/continuous clock; endpoint clock ramps are C2. Bounded incoming tangents permit a short forward excursion (up to about 3% of current range) instead of an instantaneous reversal. Log range itself is deliberately nonuniform because it shares the metric budget with apparent scale and steering; its rates and sampled acceleration norms are retained in the analysis. Maximum center-motion and FOV rates are also retained; final FOV/handoff jumps are zero. Entry direction rates around 59°/s replace the baseline ~162°/s and rejected log/scale trial 155°/s entry / 183°/s exit. Rejected trial.

## Frame audit, endpoints and drift

| Final run | Analyzed frames | Accidental offscreen | Highest central CV | Worst local q / median |
| --- | --- | --- | --- | --- |
| perceptual-warmed | 564 | 0 | 0.963% | 1.0088× |
| perceptual-development-warmed | 570 | 0 | 0.993% | 1.0067× |
| perceptual-narrow-warmed | 780 | 0 | 0.948% | 1.0088× |
| perceptual-mobile-warmed | 1293 | 0 | 0.938% | 1.0176× |

| Source/route | Minimum center margin (CSS px) | Offscreen |
| --- | --- | --- |
| GP/TLE entry | 351.927 | 0 |
| GP/TLE exit | 356.037 | 0 |
| NASA OEM entry | 351.959 | 0 |
| NASA OEM exit | 349.198 | 0 |

The matched committed baseline loses the model center in 7/8 entry and 68/66 return frames for GP/OEM respectively. All final traces and source-loss return traces have zero accidental offscreen frames. Recorded frame count includes active poses and first completion boundary; raw capture includes surrounding setup frames too. Raw production trace, development trace, mobile trace, 900-pixel trace.

Development: Inspection handoff position 0 m, direction 2.39e-10°, Up 2.33e-10°. Inspection endpoint 90 m / 42.5° / 100° (F/L/U −66.354960, 0, +60.803119 m). Earth position error 0 m, direction 5.2e-13 rad, Up 5.21e-13 rad, FOV 0 rad; transform and near/far errors zero, all 11 captured controller fields restored. Ten complete cycles for each source have the same effectively zero drift limits. Exact transition endpoints and zero FOV handoff errors are separately checked in deterministic tests and live traces.

Production: Inspection handoff position 0 m, direction 2.87e-10°, Up 2.85e-10°. Inspection endpoint 90 m / 42.5° / 100° (F/L/U −66.354960, 0, +60.803119 m). Earth position error 0 m, direction 1.75e-13 rad, Up 1.75e-13 rad, FOV 0 rad; transform and near/far errors zero, all 11 captured controller fields restored. Ten complete cycles for each source have the same effectively zero drift limits. Exact transition endpoints and zero FOV handoff errors are separately checked in deterministic tests and live traces.

## Partial Back and unavailable OEM

| Entry checkpoint | Cases (2 sources × 2 builds) | Max velocity angle (°) | Max magnitude delta (%) | Max quaternion-rate error | Max angular-velocity vector error (rad/s) | Max FOV-rate error |
| --- | --- | --- | --- | --- | --- | --- |
| 10% | 4 | 0.000007933 | 0.000028558 | 0.00591452 | 6.57636e-08 | 1.55814e-09 |
| 20% | 4 | 0.000007142 | 0.000033481 | 0.00717737 | 4.65887e-08 | 8.7372e-09 |
| 35% | 4 | 0.000001994 | 0.000012021 | 0.000329169 | 2.31013e-07 | 1.73367e-08 |
| 50% | 4 | 0.000003292 | 0.000003257 | 0.000450966 | 3.97932e-07 | 0 |
| 65% | 4 | 0.000001531 | 0.000000768 | 0.000481398 | 4.95397e-07 | 0 |
| 80% | 4 | 0.000002216 | 0.000001379 | 0.000210709 | 6.65677e-07 | 0 |
| 95% | 4 | 0.000001520 | 0.000001581 | 2.88674e-06 | 1.83772e-06 | 0 |

At every checkpoint, atomic Back pose/direction/Up/FOV discontinuity is zero in the browser; actual incoming and outgoing world velocity vectors are archived in reversal-vectors.csv and both full JSON records. Finite forward differences confirm direction and speed continuity. Raw quaternion derivative error includes finite backward-difference radial error removed by quaternion normalization; the orientation tangent is aligned with its actual quaternion sign throughout the correction interval. Deterministic tests also cover both signs and 400 correction-interval samples. Development, production, rejected sign audit.

OEM loss is tested during entry, stable Inspection and exit in each build. Selected physical state, geographic readout, velocity and provenance switch to GP immediately. A shared C2 display translation over 0.8 seconds keeps model and camera together while returning; it is not an interpolated orbital sample. Retarget position/direction/Up/FOV errors are zero; source-loss traces remain inside the viewport. Lift and silhouette follow displayed-target range, including captured partial values; they never alter physical source position. Stable Inspection uses the physical pivot. Failed pre-bridge record, final development/production extra reports.

## Responsive and visual regression

900 × 700 retains 90 m / 42.5°; 390 × 844 uses the existing aspect widening to 233.723077 m / 42.5°. No page overflow. Wheel zoom, slow/fast native orbit, reversible touch pinch, keyboard-accessible details, refresh and delayed loading pass. Each source selects all 14 verified semantic components in both builds. Delayed GLB keeps the locator and disables Inspect. Exact selected-source trajectories, adaptive gap, rounded start, Overview 75 km display-only lift and white silhouette remain. Model scale 1, minimumPixelSize 80, original PNG/PBR inputs, specular corrections, MSAA/FXAA, scene lighting and asset hashes are unchanged. No backend or delivery semantics changed. GP is computed from elements; NASA OEM is predicted source ephemeris; orientation is TRAJECTORY_ALIGNED_VISUAL_ORIENTATION and actual attitude UNAVAILABLE.

| Viewport | Source | Height last 20% | Height 10% | Height 5% | Width last 20% | Width 10% | Width 5% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| narrow | GP/TLE | 34.921% | 13.757% | 2.910% | 39.567% | 14.297% | 2.705% |
| narrow | NASA OEM | 34.840% | 13.564% | 2.660% | 39.537% | 14.286% | 2.703% |
| mobile | GP/TLE | 94.444% | 36.111% | 5.556% | 44.656% | 15.267% | 2.672% |
| mobile | NASA OEM | 94.444% | 36.111% | 5.556% | 44.487% | 15.209% | 2.662% |

Portrait net height change is only 18 px (55→73); its last-20% height fraction is therefore 94.44%, corresponding to 17 px, about 2% of viewport height. Width grows roughly 64→195.5 px, with only about 2.67% of net width growth in the final 5%. Final height interval adds 1 px. The mobile final-20% height statistic is retained as a limit of that aspect-dependent dimension; neither width nor height shows a final pop. Far raster dimensions also vary with model foreshortening and the legibility floor. No endpoint, model scale or minimum size was changed to game the fraction. Direct portrait sheets confirm reasonable continuous composition; no claim of monotone mesh footprint across every far pose is made.

## Render performance, separately from motion

| Run | Route | Median FPS | p50 ms | p95 | p99 | Worst | >33.3 ms | >50 ms | Long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline-matched | GP/TLE entry | 24.81 | 40.30 | 69.39 | 73.90 | 77.40 | 111 | 27 | 0 |
| baseline-matched | GP/TLE exit | 27.59 | 36.25 | 65.21 | 70.00 | 73.50 | 107 | 23 | 0 |
| baseline-matched | NASA OEM entry | 25.71 | 38.90 | 60.01 | 66.77 | 68.50 | 114 | 28 | 0 |
| baseline-matched | NASA OEM exit | 26.04 | 38.40 | 81.62 | 95.19 | 97.10 | 109 | 17 | 0 |
| perceptual-warmed | GP/TLE entry | 25.28 | 39.55 | 49.55 | 53.19 | 63.50 | 143 | 7 | 0 |
| perceptual-warmed | GP/TLE exit | 26.67 | 37.50 | 49.96 | 55.98 | 58.10 | 128 | 5 | 0 |
| perceptual-warmed | NASA OEM entry | 26.11 | 38.30 | 50.10 | 53.35 | 53.40 | 151 | 9 | 0 |
| perceptual-warmed | NASA OEM exit | 26.60 | 37.60 | 50.26 | 54.19 | 55.70 | 127 | 7 | 0 |

Sequential same-host/DPR-2/1280×720 comparisons use the same Chromium ANGLE Metal, initial camera, fixture UTC, imagery fallback and graphics quality. Entry duration differs by design, so total slow-frame counts have unequal observation windows. Median rendering remains about 25–27 FPS on this desktop workload; camera mathematics cannot provide a universal frame budget. GPU scene workload also changes as composition changes. Final warm traces contain zero transition long tasks. Mapping cost is at most 0.3 ms per captured frame (browser timer resolution ~0.1 ms), with no per-frame inverse-table construction.

The repeated first-GP-return pause was isolated to a 160.9 ms native globe shader compile, not camera lookup work. Before GL diagnostic, after startup warmup. Zero-texture and textured close-atmosphere variants now warm while the model is loading; original public alpha/fade fields are restored before readiness. Final slow GL calls occur only in startup. The earlier mobile trace also retains a single 563.2 ms frame gap; its cause was not proven by the later globe diagnostic. The mobile repeat and final warmed run have zero frames above 33.3/50 ms and zero long tasks, roughly 59–60 FPS, worst final frame 27 ms. This outlier is disclosed, not removed from history. Existing subpixel material/geometry shimmer limits remain.

## Validation and documentation

Final managed checkout: **112 frontend tests / 22 files**, typecheck and production build passed under Node 24. **82 backend tests**, zero failures/errors/skips, Maven test and verify passed under Java 21. Both full browser matrices passed: 6 source/epoch cases, 14 partial Back cases, 20 complete cycles (10/source), responsive and navigation cases per build; both extra suites and 14 reversal audits per build passed. Clean development/production smoke against the actual local backend has no QA hooks, no page errors, and completes GP and available OEM entry/return without API interception. Frontend log, backend report, clean live smoke. `git diff --check` passes. The existing Cesium bundle-size warning remains.

Updated frontend README, model/Inspection/rendering records, architecture 03/04 and ADR-0006/index. The evidence root points here while preserving the original strict review and starting source manifest. Existing ADR-0006 receives a dated presentation clarification; no new ADR or infrastructure is needed. `/Users/daniel/Desktop/mission1-project.md` is updated separately and remains outside Git. Full final diff, including original candidate additions, is reviewed before a new ordinary commit; accepted baseline history is preserved. SSH identity is the requested ED25519 key. Publication uses a normal main push, then fetch and direct GitHub-ref equality verification.

## Acceptance audit

| User visual gates | Evidence | Status |
| --- | --- | --- |
| A–D | Gradual close growth; no final pop; smooth primary metric; variable m/s intentional | Passed within the documented local measurement limits |
| E–G | Smooth direction; zero accidental offscreen; actual displayed target/lift preserved | Passed within the documented local measurement limits |
| H–L | Earth and Inspection endpoints; all seven Back checkpoints; incoming derivative continuity; exact handoffs | Passed within the documented local measurement limits |
| M–O | GP and OEM; both builds; ten cycles per source without drift | Passed within the documented local measurement limits |
| P | Separate matched performance; native first-return compile moved to startup; hot mapping ≤0.3 ms | Passed within the documented local measurement limits |
| Q | Model, materials, semantic picking, navigation and trajectory presentation retained | Passed within the documented local measurement limits |

The precommit audit covers requested checks 1–36. Checks 37–39 (new commit, SSH push, local/origin/GitHub equality) are verified after publication and reported with the resulting hash. The next single milestone is **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.

## Visual evidence

*Archived visual: Final GP/TLE entry*

*Archived visual: Final GP/TLE exit*

*Archived visual: Final NASA OEM entry*

*Archived visual: Final NASA OEM exit*

*Archived visual: Strict-speed rejected entry*

*Archived visual: Final portrait entry*

*Archived visual: GP/TLE entry plots*

*Archived visual: GP/TLE exit plots*

*Archived visual: NASA OEM entry plots*

*Archived visual: NASA OEM exit plots*
