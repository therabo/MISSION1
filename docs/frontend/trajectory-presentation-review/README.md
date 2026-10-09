# Adaptive trajectory and Earth View presentation review — 2026-09-30

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

This review refines synchronized baseline `389736fb7a90721357a331284dd2c5478c81b2b0`. It changes frontend presentation only. GP/TLE remains computed orbital state; NASA OEM remains independently sourced predicted ephemeris. Neither is onboard telemetry or ground truth. RTN analysis and Mission Replay have not begun.

## Phase 0: synchronization before source changes

The initial repository was clean, main five commits ahead. The reused agent socket was `/var/run/com.apple.launchd.yyEW3pZryk/Listeners`; `ssh-add -l` initially returned “The agent has no identities.” No GitHub-specific SSH stanza existed. Default identity was id_ed25519; AddKeysToAgent was false and UseKeychain was not configured. SSH configuration and remote were preserved.

`ssh-add --apple-use-keychain /Users/daniel/.ssh/id_ed25519` loaded the intended Ed25519 identity using macOS Keychain without human passphrase entry. The public fingerprint is `SHA256:XXc3h5zF/tCKvcBhSCPHcgmSXraDCUHHGs+mGsBxhT8`. No private key or passphrase was read, printed, captured or copied. Explicit-key GitHub authentication succeeded for therabo; its normal no-shell response returned exit 1.

Explicit-key ordinary `git push origin main` pushed, in order, `f449e04`, `0150d9f`, `054e825`, `8146055`, `389736f` to `git@github.com:therabo/MISSION1.git`. Fetch, local main, origin/main and GitHub ls-remote agreed at `389736fb7a90721357a331284dd2c5478c81b2b0` **before any source edit**. No history was rewritten or HTTPS fallback used.

## Context and runtime

Read/applied: private MISSION1 AGENTS; external `/Users/daniel/Desktop/mission1-project.md`; actual `iss-3d-earth-view`, `iss-3d-station-view`, `frontend-design-codex`, `telemetry-quality-and-provenance`, `iss-ground-segment-architecture`, `devops-local-platform` skills and applicable references. `architecture-decisions` was consulted for the reversible dated clarification of ADR-0006; no new ADR was warranted. No API contamination was found, so realtime-api-contracts was unnecessary.

Read frontend/backend README; orbital-trajectory-rendering, rendering-quality, iss-inspection-mode, iss-model; architecture 03/04; comparison API; ADR-0005/0006/index and the preceding trajectory-fix-review with measurements/screenshots.

Stopped old Vite, preview and backend instances; preserved the healthy PostgreSQL 16 data volume. Used fresh Node 24 Vite dev on 5173, current dist preview on 4173 and Java 21 Spring on 8080. CelesTrak acquisition was disabled for controlled review; stored source quality remained honestly STALE / ELEMENT_TOO_OLD and acquisition UNKNOWN. The isolated baseline archive on 4174 was stopped after performance comparison. Production code has no temporary QA globals, lift overrides or silhouette overrides.

The final live-API browser pass in both builds had zero console/application errors and successfully inspected/returned with both sources. `globalThis.__qa` was absent. The served `index-ByTq9vfF.js` hash matched local dist: `f7c9f71baf5c569a3e7300c5a07d5c11e0057f0889e95e75f9b90c5de49babe5`. Raw final live verification, development, production.

## Rounded start and adaptive clearance

The public Fabric composition retains PolylineGlow. Alpha starts with smoothstep; a matching `st.t` width mask narrows the visible start. The ramp spans 1–4 projected CSS pixels, converted using each own source's projected local rate. It is about 8.44 / 1.91 / 0.193 seconds in the far / medium / close views. No cap point, dot, path displacement or extra primitive is added. The inverse-smoothstep endpoint, 85% primary mean-motion horizon and bounded OEM coverage persist.

Range is Euclidean distance to the selected displayed ISS anchor (physical position plus WGS84-normal 75 km lift), not Earth center. With range in meters:

```text
p = clamp(log(max(range, 2,000,000) / 2,000,000) / log(17,000,000 / 2,000,000), 0, 1)
gapCSS = 0.75 + 3.25 × p²(3 − 2p)
```

The hull projects eight conservative pinned-GLB bounds corners, accounting for model translation, minimumPixelSize, maximumScale and off-origin geometry. Public boundingSphere excludes minimum-pixel enlargement; Camera.getPixelSize reproduces the pinned policy. ENU bounds in meters are min (-33.2,-56,-29.1), max (25.5,56,39.8). Pinned GLB hash remains `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`. This is a conservative presentation envelope, not an attitude or dimension claim.

Each own bounded property is searched on real sample intervals then bisected to 1 ms, at up to 10 Hz. The result changes the temporal start only. A public Fabric submaterial clips **every halo/body fragment** against the hull plus silhouette, with a 0.75 CSS-pixel smooth edge. Lightweight hull/mask uniforms follow each frame; retained uniform objects and primitives are reused. The complete 20/8 px envelope is protected, not merely its centerline. Failed projection or insufficient coverage hides the trail; no extrapolation occurs. Geometry changes only on a new response; native Earth depth remains.

The full-halo-radius threshold and taper-only estimate were evaluated but gave excessive close-view gaps under perspective/lift. The fragment mask resolves that issue while preserving physical centerlines. The measured result is:

| Selected source | View / range km | Desired CSS px | Measured CSS px | Start offset s | Approximate path km |
| --- | ---: | ---: | ---: | ---: | ---: |
| GP/TLE | Far / 17,000 | 4.000 | 6.0 | 68.220352 | 501.844 |
| GP/TLE | Medium / 6,000 | 2.440 | 4.5 | 22.238056 | 163.584 |
| GP/TLE | Close / 1,500 | 0.750 | 3.0 | 5.207814 | 38.309 |
| OEM | Far / 17,000 | 4.000 | 6.0 | 68.220352 | 501.832 |
| OEM | Medium / 6,000 | 2.440 | 4.5 | 22.237110 | 163.574 |
| OEM | Close / 1,500 | 0.750 | 3.0 | 5.206869 | 38.301 |

Both development and production agree: **far > medium > close > 0**, no contact in these views. Path distance is the approximate sum along the own delivered ITRF polyline, not inertial traveled distance or a speed estimate. Raw records also distinguish endpoint chord displacement. Targets are lower bounds relative to a conservative footprint; visible clearance also includes taper, glow, silhouette and raster anti-aliasing.

Production geometry, development geometry, pixel observations. The manual photometric estimate isolates background, model and trail at frozen UTC/camera, measures nearest RGB-difference pixels in original DPR-2 crops, then divides raster distance by 2. Thresholds 4/8/16 all produce the same results. Reproduce with `python measure-clearance.py` using Pillow/NumPy. These are evidence measurements, not brittle screenshot assertions.

*Archived visual: Rounded starts in both selections and all three ranges*

## Subtle white silhouette

Public Model silhouette uses white RGB, alpha **0.12**, size **0.5**. Compared all twelve size 0.5/0.75/1/1.25 × alpha 0.12/0.2/0.35 combinations. The smallest pair gives a restrained useful edge without the thicker white border of larger settings. Day/ocean, bright Earth imagery, night/city lights and terminator were reviewed in both builds. Earth imagery remains historical, including any bright cloud/ice-like regions; no live weather is claimed.

It remains throughout ready Overview, including source switches, refresh, native camera movement and zoom. Size and alpha follow smoothstep to zero within the first 1.75 seconds of entry. Inspection uses size/alpha 0 and natural NASA PBR. Back restores both over 1.2 seconds from captured current values, including partial Back. No duplicate model or extra bloom. Fallback locator is visible while loading/failure with valid data and hidden once ready.

*Archived visual: Restrained silhouette trials*

## Display-only lift proof

Fixed UTC: **2026-09-30T15:45:59.875908Z**. Browser selected coordinates are physical ITRF meters:

| Value | GP/TLE | NASA OEM |
| --- | --- | --- |
| Physical XYZ m | (-2739880.332081, -6160206.731052, -918032.757564) | (-2738254.644424, -6161214.444647, -915747.674287) |
| Display anchor XYZ m, lift on | (-2770076.989666, -6228099.350715, -928218.731549) | (-2768433.624960, -6229118.710300, -925908.375050) |
| Offset m | 75000.00000000015 | 74999.99999999933 |
| Physical WGS84 altitude m | 426508.254368 | 426456.375435 |
| Lift off | Display anchor equals physical XYZ; offset 0 | Display anchor equals physical XYZ; offset 0 |

With lift off/on, canonical XYZ, physical altitude, scene UTC and all source vertex/timestamp hashes are identical. The combined vertices hash is `03bf23d1c57b026214ff86e5c4b77738c2108f8427e47d89177cb83621b6b6ba`. Model origin additionally includes the existing small asset-centering translation; the anchor above removes that translation. Raw browser on/off record.

The unchanged production Orekit propagator, same real element hash `c1278ac312d701dc21def7fbdefa271c7629648e65365277c17962c2d09086ea`, at exactly that UTC gives physical **TEME velocity (-4102.317157, -2605.289614, 5913.472896) m/s**, speed **7654.129717 m/s**. ITRF velocity is (3603.913262,-2481.402054,5913.466594) m/s. Exact propagated ITRF position/altitude differ from the browser's short bounded linear interpolation by approximately 0.039 m; this interpolation difference is independent of lift and is not a positional accuracy claim. Physical propagator record.

Velocity in `/iss/state` is physical backend propagation. The frontend has no velocity readout or differentiation of display positions; comparison is position-only and does not expose a fabricated OEM velocity. Tests retain the actual physical velocity/epoch record across lift toggles. `modelDisplayPosition` rejects output/input aliasing. For both source properties, the two fixed physical samples remain unchanged and their travel interval is exactly 10 s with lift off/on. Propagation/source epoch, scene advancement and horizon duration have no display-lift dependency. Inspection ENU pivot uses the canonical physical point.

Does lift alter physical velocity? **NO.** Scene/source time? **NO.** Orbital travel time? **NO.** Trajectory coordinates? **NO.** Only the Overview model's display translation differs. This is `DISPLAY_ONLY_EARTH_VIEW_OFFSET`, never physical altitude.

## Inspection and regression

| Check | Development | Production |
| --- | --- | --- |
| Both GP/TLE and OEM moving approaches / physical pivot | 0 m pivot error | 0 m pivot error |
| Final camera position handoff | 0 m both sources | 0 m both sources |
| Direction / up discontinuity | <5.5×10⁻¹¹ degrees | <8.5×10⁻¹¹ degrees |
| Lift / silhouette in Inspection | 0 / (0,0) | 0 / (0,0) |
| Back restores selected source, lift, size and silhouette | 75 km, 80, (0.5,0.12) | Same |
| Partial-entry Back / ready-model click | Smooth captured-value restore; pick succeeds | Same |
| Twelve repeated source/controlled zoom changes | Same ready model, visible throughout, primitive count 6 | Same |
| Native wheels in/out and drag, seventeen observations | Same visible ready model and stable silhouette | Same |
| New real recorded response refresh | Model retained, OEM selection retained, ready replacement | Same |
| OEM unavailable during Inspection | Explicit primary fallback + Overview + notice | Same |
| GLB delayed 5 s | Locator before readiness, hidden afterward | Same |
| Day/ocean, night/city lights, terminator, Earth occultation | Preserved native lighting and depth | Same |
| 390×844 CSS mobile, Overview and Inspection | No horizontal overflow | Same |
| Console / application errors in final matrix | 0 | 0 |

Development handoffs, production handoffs, development regression, production regression, development surfaces, production surfaces, development native motion, production native motion.

The source-failure test changes only availability and removes unusable OEM samples; it leaves real GP coordinates intact. An additional HTTP 503 experiment also returned safely to GP; its expected browser resource error is not counted as an unexpected application failure. Refresh/night inputs are recorded real backend responses, not application fallbacks. Final native live QA uses actual backend delivery without mocks. One ready PNG model persists through transitions; no texture reload, white flash, persistent locator or duplicate start marker was seen. NASA authored colors/PBR and existing source colors remain.

## Performance and validation

Same frozen UTC/camera, one fresh active test page per run, Chromium with Metal, 1280×720 CSS / DPR 2 / **2560×1440 drawing buffer**, existing 4× MSAA. Waited 10 s for settling and discarded one additional 5 s warmup; measured five steady 5 s windows sequentially:

| Build | Median FPS | Steady windows FPS |
| --- | ---: | --- |
| Untouched synchronized `389736f` | **27.011** | 27.140, 26.949, 26.986, 27.103, 27.011 |
| Refined presentation | **25.142** | 25.142, 25.034, 25.358, 24.984, 25.144 |
| Refined, silhouette disabled only for diagnostic | **27.284** | 27.718, 28.266, 27.284, 26.788, 26.785 |

Matched decrease is **6.9%**. Removing the silhouette recovers most of it; the mandatory outline adds model passes, while adaptive search/taper/mask is near baseline in this local observation. This is a measurable presentation cost, accepted with the requested minimal public silhouette and no primitive churn. The previous milestone's 24.171 FPS reference had different session conditions; do not claim a speedup from cross-session numbers. Earlier unsettled runs and a diagnostic that toggled silhouette at preRender each frame were discarded: the latter caused draw-command churn and was not a valid cost measurement. No override enters final code. GPU memory is uninstrumented; thermal/cache/imagery/GPU variability limits inference.

Baseline, final, silhouette-off diagnostic.

Final frontend: **77 tests / 16 files**, typecheck and production build pass. Backend: **82 tests**, 0 failures/errors/skips, full `mvn test` and `mvn verify` pass on Java 21. `git diff --check` passes. Existing Cesium bundle-size warning remains. No backend source, API semantics or new dependency changed. Tests cover bounded own-source searches, monotonic target/bounds, soft start configuration, silhouette transitions, source switching/fallback and physical/display isolation; no screenshot assertion was introduced.

Updated frontend README, orbital-trajectory-rendering, rendering-quality, iss-inspection-mode, iss-model, architecture 03/04, comparison API presentation note and existing ADR-0006's dated refinement. External project context is updated locally and excluded from Git. Final commit/push identity is reported in the task response.

Limits: conservative footprint approximation depends on the pinned model/size policy and needs revalidation if these change. Measured gap ordering applies to reviewed camera ranges, not every oblique/occulted/extreme pose. The enhanced, lifted Overview station remains NOT TO SCALE; native Earth occultation is preserved. No data accuracy or live-telemetry claim follows from these visual improvements.

Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**. Not started.

## Subsequent visual-frame milestone

The later [trajectory-aligned Inspection review](../inspection-orientation-review/README.md) supersedes the ENU model/camera orientation, 340 m range and 80→158 minimum-footprint entry described here. Adaptive gap/style, lift/silhouette values and physical position interpolation remain. These original dated measurements are retained unchanged.
