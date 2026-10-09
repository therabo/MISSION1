# Earth View verification and fix — 2026-09-30

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

This evidence corrects the rejected presentation at `814605509fc1cc94b8a4aeac9cc3211dfab5e4f8`. It verifies the five reported problems in development and a served production build. No RTN analytics, replay, new source, backend orbital semantics, or asset geometry change is included.

## Context and clean runtime

Before editing, the private `AGENTS.md`, external `/Users/daniel/Desktop/mission1-project.md`, frontend/backend READMEs, trajectory/rendering/Inspection/model documents, repository roadmap, delivery architecture, comparison API, ADR-0005, ADR-0006 and ADR index were read. Applied skills: `iss-3d-earth-view`, `iss-3d-station-view`, `frontend-design-codex`, `telemetry-quality-and-provenance`, `iss-ground-segment-architecture`, and `devops-local-platform`, with their relevant references. `architecture-decisions` was consulted for the existing ADR correction. No API contract bug or new architecture justified another ADR.

Git was clean at `8146055`, with four existing local commits ahead of `origin/main`. Stale frontend PID 20706 and backend PID 20705 were stopped. PostgreSQL was kept healthy with its persistent data intact. Fresh Java 21 backend PID 22594 serves `http://127.0.0.1:8080`; Node 24 Vite PID 22456 serves `http://127.0.0.1:5173/`; production preview PID 24152 serves `http://127.0.0.1:4173/`. Final bundle `index-CbI5rWv5.js` was confirmed from the browser after the final build. Final clean runtime check confirms ready model, both enabled source controls, physical-readout notice, no QA globals and no application errors. A clean archive of `8146055` was served temporarily on 4174 only for controlled baseline comparison, then stopped. No old application instance remains on the project ports.

## A — Visible source styling

Baseline React selection, both retained materials and primitive reorder already changed correctly. Both active products used cyan, while their real positions overlapped at subpixel scale. The resulting browser highlight therefore appeared unchanged. This was a presentation contrast failure, not stale React state or a captured material.

The complete flow remains selector → selected source → both retained halo/body material uniforms. Geometry is retained on selection; the actual `primitive.appearance.material.uniforms` are mutated. New response geometry still prepares hidden and replaces the old ready group atomically.

| Setting | Final value |
| --- | --- |
| Active PRIMARY | Cyan `#53d9cd` |
| Active OEM | Amber `#edb86a` |
| Active body / halo alpha | 0.85 / 0.221 |
| Inactive color | `#71939c` |
| Inactive body / halo alpha | 0.08 / 0.0208 |
| Halo/body width | 20 / 8 px |
| Halo alpha multiplier | 0.26 |
| Halo/body glow power | 0.35 / 0.22 |
| Primitive order | Inactive halo, inactive body, active halo, active body |

Actual production order and both source uniforms are recorded in source verification. Ten repeated switches in each build retained the same six scene primitives, including four trail primitives. Cesium's normal translucent/OIT and depth behavior remain enabled: collection order alone is not a guarantee of translucent overpainting. The brighter source-specific accent and lower inactive alpha give the active product visual dominance without moving either curve. Compare baseline PRIMARY, baseline OEM, final PRIMARY, and final OEM.

## B — Selected physical position

At fixed scene UTC **2026-09-30T15:45:59.875908Z**, both builds evaluated the same captured real API products. XYZ are scene FIXED / ITRF 2020 meters. Browser linear interpolation remains bounded by the delivered samples; these are computed/predicted positions, not measured telemetry.

| Quantity | PRIMARY_GP_TLE | NASA_OEM |
| --- | --- | --- |
| X (m) | −2739880.332081 | −2738254.644424 |
| Y (m) | −6160206.731052 | −6161214.444647 |
| Z (m) | −918032.757564 | −915747.674287 |
| WGS84 latitude | −7.802378505° | −7.782899369° |
| WGS84 longitude | −113.978103531° | −113.962000627° |
| Physical altitude | 426508.254368 m | 426456.375435 m |
| Product epoch | Elements: 2026-09-29T02:38:28.580928Z | Creation: 2026-09-28T17:13:16.701Z |
| Classification | COMPUTED_FROM_ORBITAL_ELEMENTS | SOURCE_PROVIDED_PREDICTED_EPHEMERIS |

Physical 3D separation is **2979.924937 m**, projecting to **0.199280 CSS px** at the canonical camera. Lack of visible model movement at globe scale is **EXPECTED**. Selection immediately chooses the corresponding position property; no artificial source displacement or source blending was added.

`selectedPositionAt` feeds the physical locator/readout, approach target and moving Inspection ENU pivot. Only the model matrix receives the separate display position described below. In Overview, model center equals selected physical point plus the documented normal lift; in Inspection it equals the selected physical point within 2×10⁻⁹ m. The Inspection pivot error was 0 m for both sources. See development measurements, production measurements, [real short-buffer response](real-samples.json), and [real comparison response](real-comparison.json), including hashes, retrieval and coverage. GP remained honestly `STALE / ELEMENT_TOO_OLD`; CelesTrak acquisition was `UNKNOWN` because refresh was disabled for this check. NASA is explicitly predicted ephemeris, never truth or automatically more accurate.

## C — Forward visual gap

Controlled trials used identical camera/time and 80-pixel model size. Image differences isolated the visible model and full halo/body envelope, rather than relying on Cesium's physical bounding sphere, which does not include the minimum-pixel display enhancement. Distances were checked at RGB difference thresholds 4, 8 and 16. PNG originals used for measurement are retained locally outside Git; the JPEGs here are review copies, not pixel-test fixtures.

| Future omission | Approximate clean margin, controlled trial |
| --- | ---: |
| 40 s | 0 CSS px, contact |
| 50 s | 0 CSS px, contact |
| 60 s | 1 CSS px, marginal |
| **75 s** | **7.1 CSS px** |
| 90 s | 13.8 CSS px |
| 105 s | 20.9 CSS px |
| 120 s | 27.6 CSS px |

Final size-plus-lift screenshots measured **5.0 CSS px PRIMARY / 4.95 CSS px OEM**, including the full visible halo. A second real phase at a limb camera measured **5.83 CSS px** with 75 s; 90 s gave 8.38 px and was unnecessary. The selected-source physical displacement at the 75-second clip boundary was **551588.178 m PRIMARY / 551535.525 m OEM**. This is epoch-to-epoch ECEF displacement, not distance traveled or an accuracy metric. Each gap follows its own source timestamps. No points are moved, generated, lifted or laterally offset; the start clips the genuine bounded source-sampled geometry.

The nominal horizon remains `sceneTime + 0.85T`, where `T=5578.924303429717 s` for the stored elements. The nonzero temporal span is `0.85T−75=4667.08565791526 s`, about 83.66% of T. OEM ends earlier at real delivered coverage when needed. Inverse smoothstep reaches exactly zero at the endpoint; no past/rear path, fade-in, periodic wrap, bridge or closure is drawn. Camera angle and occultation affect any projected gap; these measurements establish the reviewed canonical and limb cases, not an all-camera pixel guarantee.

Evidence: controlled crops, trial measurements, final geometry, final pixels, second-phase geometry, second-phase pixels.

## D — Smaller model

At the same camera/time, the measured footprint was:

| minimumPixelSize | Visible width × height |
| --- | ---: |
| 92 | 35 × 78.5 CSS px |
| 88 | 33.5 × 75 CSS px |
| 84 | 32 × 72 CSS px |
| **80** | **31 × 68 CSS px** |

80 is the smallest tested adjustment that gave the requested clear reduction while retaining a visible, directly clickable station. Height fell about 13.4%; bounding footprint area about 23%. At the final canonical phase the footprint was approximately 32.5 × 64.5 px PRIMARY and 32 × 64.5 px OEM. Physical asset scale **1**, `maximumScale=20000`, original PNG textures, feature mapping and GLB hash remain unchanged. Minimum pixel size is a Cesium presentation setting, not a literal silhouette dimension. The model remains explicitly **NOT TO SCALE**. See size settings, measured footprints and controlled crops.

## E — Earth separation and outline

The prior zero-lift decision was reopened after the user's visual rejection. The model-only display position is `physicalPosition + WGS84_normal × liftMeters`. Controlled global-limb projection trials measured:

| Lift | Additional model-center projection |
| --- | ---: |
| 0 km | 0 CSS px |
| 2 km | 0.081 CSS px |
| 5 km | 0.202 CSS px |
| 8 km | 0.323 CSS px |
| 10 km | 0.404 CSS px |
| 25 km | 1.010 CSS px |
| 50 km | 2.020 CSS px |
| **75 km** | **3.030 CSS px** |
| 100 km | 4.041 CSS px |

2–10 km were visually negligible beside the enlarged station. 75 km was the smallest tested value producing several pixels of extra limb clearance; 100 km was unnecessary. This bounded **display-only** lift separates the reviewed station presentation from the globe. Its screen effect is camera-dependent and small near nadir. Physical Earth occultation is retained; an occulted station is not promised visible. See lift trials, production limb, medium view, and night station.

Backend state, API XYZ, both trajectories, physical altitude, provenance and camera pivot are unchanged. The UI explicitly says the model is enlarged and visually lifted while readouts remain physical. Lift smoothly reaches zero during the first **35% / 1.75 s** of the five-second entry, before close range, and is zero in Inspection. Back restores it smoothly over the existing 1.2-second return, including interrupted entry. Partial-entry Back measured about 30111.8 m before the click and 30111.9 m at the first return frame, then 75000 m at Overview; no discrete reset occurred.

**Outline disabled**, `silhouetteSize=0`. After smaller-plus-lift, the station remained identifiable against ocean, daytime clouds/continents, terminator and historical night/city lights. Step 2 was sufficient; no white silhouette, bloom or extra silhouette pass was added. Night evidence uses another actual backend buffer: Earth surface beneath the station was on the night side, which does not imply the station itself was in Earth's full shadow. No artificial station light was introduced.

## F — Inspection and browser matrix

Direct ready-model picking entered Inspection for both sources. The selected physical ENU target remained consistent, with selector locked, trajectories hidden, and model footprint growing **80→158**. Back preserved the source and restored **80** and the display lift. Exact camera handoff measurements:

| Build / source | Camera-position jump | Direction jump | Up jump | Final pivot error |
| --- | ---: | ---: | ---: | ---: |
| Development PRIMARY | 0 m | 3.13×10⁻¹¹° | 1.88×10⁻¹¹° | 0 m |
| Development OEM | 0 m | 6.21×10⁻¹¹° | 4.55×10⁻¹¹° | 0 m |
| Production PRIMARY | 0 m | 7.86×10⁻¹¹° | 7.83×10⁻¹¹° | 0 m |
| Production OEM | 0 m | 7.27×10⁻¹¹° | 7.23×10⁻¹¹° | 0 m |

Numerical model/physical-position residual was below 2×10⁻⁹ m at final handoff. Development PRIMARY, development OEM, production retain transition frames and exact measurements.

| Browser case | Development | Served production |
| --- | --- | --- |
| Canonical PRIMARY / OEM, obvious color swap | Pass: PRIMARY, OEM | Pass: PRIMARY, OEM |
| Numerical selected position / lineage | Pass | Pass |
| Gap including halo, no rear path, future fade | Pass | Pass |
| Smaller model / model-only lift / no outline | Pass | Pass |
| Day / ocean / clouds and continents | Pass | Pass |
| Night / city lights | Pass | Pass |
| Terminator | Pass | Pass |
| Globe rotation / native Earth occultation | Pass | Pass |
| Medium zoom | Pass | Pass |
| Global zoom | Pass | Pass |
| Direct ready-model click | Pass | Pass |
| PRIMARY Inspection | Pass | Pass |
| OEM Inspection | Pass | Pass |
| Back / source retained / unlock | Pass | Pass |
| Ten repeated source switches, same primitives | Pass | Pass |
| OEM unavailable, primary preserved | Pass | Pass |
| Selected OEM loss during Inspection | Pass | Pass |
| Eight-second delayed GLB locator → ready model only | Pass | Pass |
| 390×844 mobile Overview, no overflow | Pass | Pass |
| 390×844 mobile Inspection, no overlap | Pass | Pass |

Availability and latency faults were browser-local QA stubs; actual orbital coordinates/times were left unchanged. The outage probe accelerated only its intercepted poll timer, then returned HTTP 503. Both builds visibly returned to GP/TLE with the explicit OEM-unavailable notice. Fallback results, loading/mobile results. Normal development and production reported no application/WebGL errors. The frontend skill's shared lint scripts were unavailable; screenshot inspection and DOM layout measurements provided local visual QA. Temporary browser probes were removed by closing those pages; no diagnostic UI or logging was added to production source.

## Comparable performance and gates

One active browser Earth View at a time, 1280×720 CSS / DPR 2 / **2560×1440 drawing buffer**, 4× MSAA, FXAA off. Both baseline and final used the identical frozen UTC and exact camera recorded in the JSON. Five-second warmup was discarded, followed by five five-second windows.

| Renderer | Five FPS windows | Median |
| --- | --- | ---: |
| Untouched `8146055` | 23.31, 24.24, 24.91, 24.91, 25.10 | **24.905** |
| Final production | 19.38, 21.74, 24.17, 24.54, 24.41 | **24.171** |

Median difference **−2.95%**, with overlapping observed windows: no material regression detected locally. GPU memory is not instrumented; cache, imagery/network and warmup variability limit inference. The earlier ~19 FPS reference used different scene/workload conditions and is not evidence of a speedup. No silhouette cost exists because silhouette is disabled. Geometry/primitive count is unchanged by this fix. Baseline, final.

Final gates: frontend **66 tests / 14 files**, TypeScript check and production build passed on Node 24; backend **82 tests**, zero failures/errors/skips, Java 21 `mvn test` and `mvn verify` passed. `git diff --check` passed. The existing large Cesium bundle warning remains. Tests cover exact retained material updates/order, selected physical property/approach/pivot, source-specific 75-second clipping, no past path, size/scale settings, model-only normal lift, zero Inspection lift, smooth entry/return, OEM coverage/expiry/fallback and normal refresh seams. Pixel measurements above are manual QA evidence, not brittle screenshot assertions.

Updated documentation: frontend README; current orbital trajectory review; rendering quality; Inspection; ISS model; delivery architecture; comparison API's frontend policy; roadmap; ADR-0006's dated correction. The local external `mission1-project.md` was updated outside Git. Existing architectural boundaries remain; no new ADR was created. All prior commits are preserved. SSH agent inspection returned **“The agent has no identities.”** No key unlock or push is attempted; the passphrase-protected `/Users/daniel/.ssh/id_ed25519` must already be unlocked in the user's agent for the optional SSH sync.

The next milestone remains **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, unstarted.
