# Selectable forward ISS trajectories — 2026-09-30

Current implementation is governed by [ADR-0006](../adr/0006-selectable-forward-trajectory-visualization.md). The previous centered/dashed correction is preserved as history below and in commit `054e825`; it does not describe the current renderer. RTN separation analytics have not been started.

## Source and physical position policy

The accessible two-button selector defaults to `PRIMARY_GP_TLE` for each page session. It changes the actual sampled target as well as the active trail. GP/TLE uses the mandatory short Orekit/ITRF animation buffer; NASA OEM uses bounded linear display interpolation between the comparison API's real OEM samples. Those samples come from the existing bounded cubic Hermite source-vector interpolation and epoch-specific EME2000→ITRF conversion. The selected physical position is shared by the GLB, temporary locator, approach target, moving local ENU Inspection pivot, and WGS84 readout. A switch selects the other property immediately; no blending between sources or spatial displacement is added.

NASA OEM remains `SOURCE_PROVIDED_PREDICTED_EPHEMERIS`, explicitly labeled **NASA predicted ephemeris**. GP/TLE remains `COMPUTED_FROM_ORBITAL_ELEMENTS`. Neither is truth or live onboard telemetry. The active metadata shows the selected product's creation/element epoch, coverage where applicable, retrieval and hash. GP quality and CelesTrak acquisition remain independently visible. The real stored elements in this review remain honestly `STALE / ELEMENT_TOO_OLD`; source acquisition is `UNKNOWN` with refresh disabled for this local check.

OEM selection requires non-UNAVAILABLE delivery, actual sample and source coverage of scene time, and comparison response age within the existing 300-second display policy. Covered DEGRADED predictions remain explicitly degraded. Invalid OEM disables its button; loss while selected exits Inspection and returns to GP/TLE with a visible status notice. No stale-position freeze or extrapolation occurs. A new normal poll may start up to 3 seconds ahead of the aligned scene clock: the prior valid, still-moving bounded product is retained until the new one covers scene time. True outages and coverage loss are accepted immediately. A browser check retained OEM Inspection across several real 120-second refreshes (14:28:43 through 14:36 UTC); the final approach handoff measured 0 m positional discontinuity and approximately 7.08×10⁻¹¹° direction / 1.27×10⁻¹¹° up discontinuity.

## Forward geometry and fade

The [real response capture](trajectory-selection-review/diagnostic-comparison.json) records the verified stored inputs. For its TLE mean motion 15.48685648 rev/day:

| Quantity | Current value |
| --- | --- |
| Primary period, `86400 / meanMotion` | 5578.924303429717 s / 92.9820717 min |
| Delivered primary grid | 181 points, 180 equal intervals, `generatedAt` through `generatedAt + T`, current index 0 |
| Delivered OEM grid | Up to 181 uniform points over the real vector/request intersection, exact coverage boundaries; 181 in this real capture |
| First visible time | `sceneTime + 40 s` |
| Start-gap physical displacement in this capture | GP 294060.793 m; OEM 294056.054 m, from the same bounded display interpolation |
| Nominal endpoint | `sceneTime + 0.85T` = +4742.08565791526 s / 79.034761 min |
| Nonzero temporal span after the gap | 4702.08565791526 s / 78.368094 min = 84.2830159% of T |
| Partial OEM endpoint | Earlier of nominal endpoint and actual final OEM sample |

The temporal masks reject every time before the start gap and every time at/after the endpoint. For `u = (sampleTime − visibleStart) / (visibleEnd − visibleStart)`:

```text
alphaMultiplier = 1 − u²(3 − 2u),  0 ≤ u < 1
alphaMultiplier = 0 outside that interval
```

The inverse smoothstep is monotonic, with zero slope at both ends and exactly zero endpoint opacity. There is no fade-in, periodic wrap, past/rear path, copied first point, endpoint bridge or loop. At response time 151 primary grid vertices lie strictly inside the nonzero interval; exact start/end clip boundaries are evaluated by the material along sampled segments. All 181 source points remain in the unclosed, temporally masked geometry. Sampling and positions remain unchanged by styling. Earth occultation remains physically credible.

Each source has two coincident primitives with identical source XYZ, `ArcType.NONE`, non-pickable and unclosed. Both sources use the same public Fabric composition of `PolylineGlow` and temporal clipping/fade; no dashed material remains.

| Layer | Width | Alpha scale | Glow power |
| --- | ---: | ---: | ---: |
| Halo | 20 px | 0.26 | 0.35 |
| Body | 8 px | 1 | 0.22 |

Active color is `#53d9cd`, maximum alpha 0.85; inactive is `#71939c`, maximum alpha 0.12. Selection swaps these colors/opacities and raises the selected halo/body after the inactive pair. Native Cesium depth and translucent rendering remain in use; ordering does not invent separation or disable globe depth. Real centerlines nearly overlap at this scale, so the inactive source can be mostly hidden under the active one. The pressed control and source text make selection explicit.

Geometry rebuilds only when a new response arrives. All two/four replacement primitives prepare hidden and reveal together; the old ready group stays until then. Ticks change only temporal and color uniforms. Materials/primitives are cleaned up on replacement/unmount.

## Model decision gate and Inspection

Earth View `minimumPixelSize` is **96→92**, physical asset scale 1 and `maximumScale=20000` unchanged. The GLB is still explicitly NOT TO SCALE. Trials compared [20-second gap](trajectory-selection-review/gap-20-size-92.jpg), [30 seconds](trajectory-selection-review/gap-30-size-92.jpg), and [40 seconds](trajectory-selection-review/gap-40-size-92.jpg). Twenty seconds touched the enhanced model; thirty was marginal; forty provided a small clear gap.

The smaller-only trial was sufficient. A [+5 km outward display lift](trajectory-selection-review/size-92-lift-5km.jpg) and [1 px white silhouette at alpha 0.30](trajectory-selection-review/size-92-lift-5km-outline.jpg) were evaluated and omitted. The latter capture differs in viewport/camera and is qualitative evidence, not a controlled pixel comparison. Final `DISPLAY_ONLY_EARTH_VIEW_OFFSET=0`; there is no silhouette or lift to remove in Inspection. Only existing off-origin asset-centering translation remains. Position, altitude, samples and camera pivot are physical and unmodified in every mode.

Ready GLB alone is directly clickable; locator/label are temporary loading/error fallbacks at valid selected positions. Texture/feature readiness gates the initial hidden model reveal. PRIMARY and OEM both retain the moving approach, naturally lit close view, orbit/zoom controls and semantic module picking. Source controls lock during entry, Inspection and exit; Back to Earth preserves the source. Both trails hide outside Overview. The existing 78-pixel approach enhancement now grows from 92 to 170 and returns to 92.

## Browser matrix

Development and served production were checked using real stored inputs. Temporary localhost QA proxies changed only OEM availability or GLB delivery latency; they left real sampled coordinates unchanged and are not production integration code. Their missing HMR WebSocket forwarding is a proxy limitation. Normal development/production reported no application/WebGL errors. Screenshots represent observed camera/time compositions, not exhaustive GPU guarantees.

| Required case | Development | Served production |
| --- | --- | --- |
| Default PRIMARY, switch OEM, back PRIMARY, repeated switches | Pass | Pass |
| Selected source changes physical model position and lineage | Pass; source diagnostics and regression test | Pass; readout/selection and visible model |
| OEM unavailable / disabled, GP preserved | [Pass](trajectory-selection-review/development-oem-unavailable.jpg) | [Pass](trajectory-selection-review/production-oem-unavailable.jpg) |
| Day Earth | [Pass](trajectory-selection-review/development-oem-day.jpg) | [Pass](trajectory-selection-review/production-oem-day.jpg) |
| Night Earth | [Pass](trajectory-selection-review/development-night.jpg) | [Pass](trajectory-selection-review/production-night.jpg) |
| Terminator | [Pass](trajectory-selection-review/development-terminator.jpg) | [Pass](trajectory-selection-review/production-terminator.jpg) |
| Global rotation / native globe occultation | Pass | Pass |
| Medium zoom | [Pass](trajectory-selection-review/development-medium.jpg) | [Pass](trajectory-selection-review/production-medium.jpg) |
| Forward start gap, future-only, 85% nominal, endpoint fade | Pass; sample/mask tests and rotation | Pass; continuous fade, no closure |
| Smaller model, improved separation, no silhouette | Pass; decision trials above | Pass |
| Direct ready model click | Pass; solar-array surface | Pass; solar-array surface |
| PRIMARY Inspection | [Pass](trajectory-selection-review/development-primary-inspection.jpg) | [Pass](trajectory-selection-review/production-primary-inspection.jpg) |
| OEM Inspection | [Pass](trajectory-selection-review/development-oem-inspection.jpg) | [Pass](trajectory-selection-review/production-oem-inspection.jpg) |
| Back to Earth / source retained / controls unlock | Pass | Pass |
| Delayed GLB locator → ready model only | [Pass, 30-second delay](trajectory-selection-review/development-loading-fallback.jpg) | [Pass, 30-second delay](trajectory-selection-review/production-loading-fallback.jpg) |
| OEM stays selected through ordinary polling in Inspection | [Pass](trajectory-selection-review/development-oem-inspection-refresh.jpg) | Pass; retained through multiple polls |
| Active OEM loss while inspecting | Unit source/coverage/expiry tests | [Pass: explicit GP fallback](trajectory-selection-review/production-oem-loss-fallback.jpg) |
| Semantic module click | [Columbus panel](trajectory-selection-review/development-module-picking.jpg) | Existing routing and ready model picking retained |
| Narrow responsive controls / Inspection | Same responsive implementation | [Overview](trajectory-selection-review/production-mobile.jpg), [Inspection](trajectory-selection-review/production-mobile-inspection.jpg); no horizontal overflow |

Responsive QA requested 390×844; the native browser backing scale resulted in a 354-CSS-pixel viewport. [DOM measurements](trajectory-selection-review/mobile-layout.json) show the selector and Back action inside the viewport and Inspection status separated vertically from the selector. Visual lint found no clipped controls or panel overlap. The installed frontend skill's shared lint scripts were unavailable, so screenshot inspection and read-only DOM layout measurements provided the equivalent local check.

## Eight final visual answers

1. **Ahead of model:** yes, the 40-second real temporal gap visibly separates the start from the enhanced model in the reviewed global and medium views.
2. **No rear path:** yes, temporal clipping removes all past and near-current samples.
3. **Dissolves before closure:** yes, inverse smoothstep reaches zero at 85% of the mean-motion period; no bridge or closure is drawn.
4. **Active selection obvious without dashes:** yes, bright cyan active trail plus pressed source control/label; both source trails are continuous.
5. **Model uses actual selected position:** yes, source switching selects the corresponding bounded position property shared with readout and camera; no cross-source blend or offset. At Earth scale the small physical difference is often subpixel, so the property/diagnostic check supplements the visual observation.
6. **Slightly smaller and separated from Earth:** yes in reviewed views, 92 pixels improves the footprint and the real orbital altitude supplies separation. No visibility guarantee is made for every occulted viewing angle.
7. **Silhouette necessary:** no; smaller-only was sufficient, so final silhouette is omitted.
8. **Natural Inspection for both:** yes; same moving selected ENU pivot, zero positional handoff, source preserved on Back and no oversized trails.

## Performance and gates

The [raw performance record](trajectory-selection-review/performance.json) compares clean archive `054e825` (frontend and backend on temporary ports) against the final implementation sequentially. Both use real stored TLE/OEM inputs, one active Earth View, 1280×720 CSS viewport / DPR 2 / 2560×1440 drawing buffer, 4× MSAA, FXAA off, HDR off and the same initial camera convention. Adjacent current-epoch five-second windows reduce the cache/time-of-day confound; they do not freeze physical time.

| Five steady windows | Min FPS | Median FPS | Max FPS |
| --- | ---: | ---: | ---: |
| Archived previous renderer | 17.6 | 19.1 | 20.1 |
| Final PRIMARY | 17.6 | 19.1 | 19.4 |

Median difference **0.0 FPS**. The historical accepted multi-view reference was approximately 17.5 FPS at the same drawing-buffer size. An earlier single-view baseline median 21.1 versus a later final 19.1 prompted this adjacent rerun; both raw observations are retained rather than attributing the earlier difference to code. No material regression was detected in the adjacent comparison. Scene epoch/imagery/cache differ, and GPU memory is not instrumented.

Four small halo/body primitives replace the previous two plus one dashed entity: one additional primitive. Source changes reuse geometry and change four materials plus the sampled target; ticks update uniforms, while geometry only rebuilds on a response. A separate equal-native-viewport comparison (2327×1309 CSS / 2559×1439 drawing buffer, five windows each) measured PRIMARY median **20.2 FPS** and OEM **20.3 FPS**. No measurable source-selection penalty was observed. This native viewport is not directly comparable to the archived-vs-final table above; a discarded 1238×1590 OEM observation is explicitly excluded in the raw record.

Frontend **60 tests / 13 files**, typecheck and production build passed on Node 24. Backend **82 tests**, zero failures/errors/skips, `mvn test` and `mvn verify` passed. `git diff --check` passed. The existing Cesium bundle-size warning remains. Regression tests cover source selection/pivot/locks, invalid or expired OEM, no extrapolation, normal refresh clock seam, source labels, exact forward period/grid, real partial coverage boundaries, future clipping/gap/fade and identical reusable trail geometry. The `.tsx` test inclusion now also runs the pre-existing module panel suite.

The source contract changes are documented in [API specification](../api/orbital-comparison.md); canonical `/state` and short `/samples` semantics are unchanged. No source adapter, propagation physics, persisted orbit product, RTN metric or analytics API was added.

## Authoritative verification

- [NASA ISS ephemeris publication](https://www.nasa.gov/general/spaceflight-nasa-gov-has-been-retired/) identifies predicted state vectors; current XML was rechecked for EME2000, UTC, km and km/s before relying on the existing adapter.
- [Cesium public Material](https://cesium.com/learn/cesiumjs/ref-doc/Material.html) / Fabric and pinned 1.145 PolylineGeometry were checked for the temporal material and normalized uniform sample-index coordinates.
- [Cesium public Model](https://cesium.com/learn/cesiumjs/ref-doc/Model.html) documents silhouette size in pixels and color; the final renderer does not enable it.

---

## Historical correction before source selection

### Orbital trajectory presentation correction — earlier 2026-09-30 milestone

Scope: endpoint and overlap diagnosis, primary trail/OEM differentiation, ready ISS locator removal. Backend propagation, source selection, interpolation, API windows, attitude and physics are unchanged. The full RTN analytics milestone is deferred.

## Baseline reproduction and diagnosis order

Before editing, development and served production showed the sharp cyan 4 px primary, a dense amber OEM dash (2.5 px, cycle 18 px, pattern `0x00ff`), and a persistent locator/label over the ready model. Inspection entry/exit was reproduced. The original primary was already one continuous per-vertex-colored primitive; its 15 s alpha refresh replaced geometry after readiness. Numerical diagnosis was completed before material changes. A clean archive of parent commit `0150d9f` was subsequently served separately to compare FPS against the final source.

### Recorded real-source window

The [captured comparison response](trajectory-review/diagnostic-comparison.json) is an observation used for this diagnosis, not a runtime fallback. Current state remained honestly labeled `STALE / ELEMENT_TOO_OLD` for this stored set.

```text
TLE line 1: 1 25544U 98067A   26272.11005302  .00004557  00000+0  91790-4 0  9991
TLE line 2: 2 25544  51.6312 145.7721 0007123 200.7262 159.3438 15.48685648587861
Element epoch: 2026-09-29T02:38:28.580928Z
Retrieved:     2026-09-29T18:50:20.789922Z
Element SHA256: c1278ac312d701dc21def7fbdefa271c7629648e65365277c17962c2d09086ea
Provider/origin: CELESTRAK_GP / USSF_GP_VIA_CELESTRAK
T0:       2026-09-30T11:29:18.225693Z
Period:   86400 / 15.48685648 = 5578.924303429717 s (92.9820717 min)
First:    2026-09-30T10:42:48.763541285Z
Last:     2026-09-30T12:15:47.687844715Z
Count:    181, center index 90, 180 equal temporal intervals
```

First and last are `t0 ± T/2`, rounded to nanoseconds. All epochs are unique and strictly ordered; no sample or endpoint is missing. The browser's strengthened validation permits 2 ms for its millisecond timestamp representation and requires every sample to lie on the uniform phase grid.

### Endpoint values

XYZ positions are meters. TEME states came from the selected production Orekit propagator; TEME was transformed **at each endpoint epoch** to a common EME2000 frame using the same pinned Orekit/EOP context. The inertial result is not obtained by comparing Earth-fixed vectors.

| Frame | First XYZ (m) | Last XYZ (m) | Endpoint distance |
| --- | --- | --- | ---: |
| TEME | (3954527.672035, 1988015.726101, −5162451.740423) | (3947593.700244, 1987445.823122, −5167975.634457) | 8883.589 m |
| EME2000 common inertial | (3952834.809255, 1964161.429224, −5172868.687586) | (3945883.093162, 1963632.779446, −5178374.455655) | 8883.654 m |
| ITRF 2020/IERS 2010 | (−3544618.557888, −2650690.224692, −5162453.315808) | (−4297298.488818, −1032801.479945, −5167974.061840) | 1784410.700 m |

| WGS84 | First | Last | Last − first |
| --- | ---: | ---: | ---: |
| Latitude | −49.569268860° | −49.640711495° | −0.071442635° |
| Longitude | −143.210606391° | −166.485990209° | −23.275383819° |
| Altitude | 434315.183628 m | 434341.940607 m | +26.756979 m |

Common-frame position angular residual: **0.074851203°**. Signed in-plane phase residual: **+0.042391805°**, from `atan2(r1·tangent0, r1·radial0)` with radial0 = normalized first position, normal0 = normalized first `r×v`, tangent0 = normal0×radial0. It describes the residual after approximately one revolution, not total accumulated phase. The mean-motion period is not a guarantee of exact geometric closure of a perturbed SGP4 orbit. Earth rotates approximately 23.31° during this period; the measured longitude change and much larger ITRF distance explain the apparent far-side gap.

**Classification: `EXPECTED_EARTH_FIXED_NON_CLOSURE`, with `ITRF_FRAME_EFFECT`.** The harsh baseline endpoint alpha (0.08) increased the impression of a broken line. There was no off-by-one, window asymmetry, duplicated/missing endpoint or segmentation seam in this capture. OEM covered the complete 181-point window, so an OEM coverage boundary did not explain this case. Orbital state varies continuously in time; the first/last positions at different epochs are not required to be the same point.

## Measured GP/TLE–OEM proximity

The captured NASA OEM file has source creation `2026-09-28T17:13:16.701Z`, coverage `2026-09-28T12:00:00Z` through `2026-10-13T12:00:00Z`, retrieval `2026-09-30T10:52:58.531150Z`, HTTP Last-Modified `2026-09-28T17:27:12Z`, SHA256 `14f2dce1e0263fba4fee8e042a89173ec632768f8cd54190e7c0d99040ef2433`.

Both delivered products are ITRF 2020/IERS 2010 in meters, with exactly matching UTC epochs. The existing backend evaluates bounded cubic Hermite interpolation from OEM EME2000 source position/velocity and performs the epoch-specific EME2000→ITRF transform. Diagnostic Euclidean subtraction is therefore frame/time aligned; no TEME–EME2000 subtraction occurs.

| 181 aligned pairs | Separation |
| --- | ---: |
| Minimum | 2522.007638 m |
| Median | 3294.596414 m |
| Maximum | 3713.372130 m |

Reproduce these distances from the checked-in capture with Python `math.dist` over `(xMeters,yMeters,zMeters)` for equal `time`, then `min`, `statistics.median`, `max`. This is a diagnostic snapshot, not persisted analytics or an accuracy/ground-truth claim.

**Yes: physical proximity is the primary reason the curves look alike.** At about 330 px Earth radius, 3.713 km is less than 0.2 px in an Earth-scale projection, while original line widths were 4 and 2.5 px. Near-total overdraw is expected. Dense 9 px on/9 px off OEM dashes, modest contrast and primary core overdraw added a rendering contribution. The corrected sparse contrast treatment changes detectability without moving either centerline.

## Selected visual design

### Primary: actual temporal orbit, soft envelope

One exact 181-point unclosed sequence, `ArcType.NONE`. No spatial perturbation, copied endpoint, loop, closing interpolation or reference-ring substitution. Two coincident `PolylineGeometry` primitives share the same positions array:

| Layer | Width | Alpha multiplier | Glow power |
| --- | ---: | ---: | ---: |
| Halo | 20 px | 0.26 | 0.35 |
| Body | 8 px | 1 | 0.22 |

Color `#53d9cd`. Given cycles `c = abs(sampleTime − sceneTime)/T`, phase `p = c − floor(c)`, normalized orbital phase distance `d = 2×min(p,1−p)`:

```text
alpha(d) = 0.025 + 0.825 × (1 − d² × (3 − 2d)),  0 ≤ d ≤ 1
```

Peak 0.85 at ISS; monotonic and symmetric; minimum 0.025 half a revolution away. Smoothstep has zero slope at both bounds. Halo minimum is 0.0065. Glow edge alpha multiplies the phase envelope; the finite trail center remains nonzero on the far side. Camera occultation can still hide any part behind Earth.

Built-in `PolylineGlow` was evaluated first. Unmodified emission made a white, laser-like center; a constant halo also weakened the opposite-side fade. The existing per-vertex alpha geometry was already continuous and had no segmentation defect, but color alone lacked soft edges. The selected **public Fabric composition** uses built-in `PolylineGlow` for edge alpha and built-in `Fade` for periodic phase distance, with restrained cyan emission. No handwritten shader source, private APIs or animated/procedural noise are required. `taperPower=1` disables a one-direction taper, preserving past/future symmetry. Since Cesium's polyline `st.s` is sample index divided by 180 and the API grid is uniform in time, phase texture coordinates represent the specified temporal fade.

Each tick changes only the Fade phase uniform. Geometry rebuilds only for a new comparison response; both replacement primitives prepare hidden and are revealed together when ready while the old group persists. Layers are non-pickable and their primitives/materials are destroyed on replacement/unmount. OEM/model picking and globe depth remain independent.

### OEM: secondary, uniform and sparse

Supported `PolylineDashMaterialProperty`: orange `#ff984f`, width **5.5 px**, fixed alpha **0.92**, transparent gap, **64 px** cycle, **`0x000f`** 16-bit pattern (16 px on / 48 px off). No phase fade or organic modulation. The broader low-alpha primary envelope remains visible around OEM dashes and within gaps even when centerlines project onto the same pixels. World-space coordinates remain unchanged. Cesium's native depth testing is retained; no depth-fail material or global depth override is introduced.

### ISS lifecycle and interaction

Ready model only: no point and no label at any valid Overview range. `minimumPixelSize` **72→96** increases its existing bounded display enhancement; maximumScale and physical asset scale remain unchanged, and the UI still says **NOT TO SCALE**. The model's existing feature/id picking is the interaction target. Loading or failure keeps the temporary locator/label with valid buffered positions; expiry hides both. Inspection approach, moving ENU target, module picking and smooth return persist, and both large paths hide in Inspection.

## Verification evidence

Development and served production were checked with real stored sources. Controlled localhost proxies exercised OEM `UNAVAILABLE` and delayed GLB loading, while passing the real primary/model sampled coordinates unchanged. They are QA-only processes, not runtime source changes or synthetic ISS observations.

Browser matrix and local performance results are recorded below. Screenshots are evidence of one time/camera composition, not pixel regression tests.

## Public Cesium references

- [Material and built-in material parameters](https://cesium.com/learn/cesiumjs/ref-doc/Material.html)
- [Public Fabric composition](https://github.com/CesiumGS/cesium/wiki/Fabric)
- [PolylineGeometry](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGeometry.html)
- [PolylineMaterialAppearance](https://cesium.com/learn/cesiumjs/ref-doc/PolylineMaterialAppearance.html)
- [PolylineDashMaterialProperty](https://cesium.com/learn/cesiumjs/ref-doc/PolylineDashMaterialProperty.html)

The pinned Cesium 1.145 implementation was also checked for normalized per-index texture coordinates and material uniform-only updates.

### Manual browser matrix

| Case | Development | Served production |
| --- | --- | --- |
| Global daytime Overview / bright Blue Marble | Pass | Pass; [day](trajectory-review/production-day.jpg) |
| Global nighttime / historical city-light regions | Pass; [night](trajectory-review/development-night.jpg) | Pass; [night/endpoints](trajectory-review/production-night-endpoints.jpg) |
| Terminator | Pass | Pass; [terminator](trajectory-review/production-terminator.jpg) |
| Opposite orbital phase and actual distinct endpoints | Faint trail retained when not occulted | Faint trail retained when not occulted; no bridge |
| Globe rotation / Earth depth | Native drags; correct occultation | Native drags; correct occultation |
| Zoom in and out / intermediate dash readability | Pass | Pass |
| Ready model without point or label | Pass | Pass |
| Direct model click → approach → Inspection | Pass; solar-array surface click | Pass; visible model click |
| Inspection → Overview / moving target / uncluttered paths | Pass; [inspection](trajectory-review/development-inspection.jpg) | Pass |
| Real 120 s comparison/window refreshes | Several refreshes; ready replacement retained, no observed popping | Repeated refreshes; same group-readiness behavior |
| OEM unavailable | Controlled localhost response; [primary/model remain](trajectory-review/development-oem-unavailable.jpg) | Controlled localhost response; [primary/model remain](trajectory-review/production-oem-unavailable.jpg) |
| Delayed GLB → ready | Temporary locator observed, hidden at readiness | Temporary locator observed; [early loading](trajectory-review/production-loading-fallback.jpg), hidden at readiness |
| Semantic picking | Existing routing tests pass | Actual Poisk click opens the matching module panel |

The early loading screenshot includes the locator before globe imagery finishes. The QA proxy delayed the GLB by 12 s; readiness was about 13.1 s in production and 13.7 s in development. It changed only optional OEM availability/empty samples and asset delivery delay, leaving the real primary coordinates intact. Development HMR WebSocket forwarding was outside this temporary HTTP proxy; normal development and served-production renderer logs were checked separately.

No shimmer, crawling texture, alpha flicker, or segment popping was observed during the sampled rotation/zoom/approach/refresh checks. Final clean development and production tabs reported no application/WebGL errors. An earlier experimental Fabric child name `glow` collided with a local identifier inside the built-in shader; using the distinct child name `edgeGlow` resolved it before final validation. This discarded intermediate trial is not a residual production error. Manual observation is not an exhaustive guarantee on other GPUs.

### Visual review answers

1. **Softer/organic:** yes, a translucent feathered envelope replaces the sharp flat line; no unstable noise is needed.
2. **Exact computed centerline:** yes, both layers receive the identical unmodified 181 ITRF points.
3. **OEM dash recognizable under near-overlap:** yes, sparse contrasting dashes remain legible at global and intermediate views.
4. **ISS visible without the point:** yes, the bounded 96 px display-enhanced model is identifiable and directly clickable.
5. **Far endpoints intentionally faint:** yes, inverse smoothstep fades both temporal ends without a cutoff or invented physical connection. Earth occultation remains natural.

### Local performance

The [raw five-second observations](trajectory-review/performance.json) compare parent `0150d9f` against the refined source sequentially. Both use DPR 2, a 1280×720 viewport, a 2560×1440 drawing buffer, 4× MSAA, no FXAA, HDR off, and an initially centered daytime Overview. The same additional production Earth View tab remained open in both measurements; each measured view was opened separately. The NASA imagery/cache and real scene epoch may vary, so this is a local regression observation, not an isolated GPU benchmark.

| Five steady windows | Min FPS | Median FPS | Max FPS |
| --- | ---: | ---: | ---: |
| Parent rendering | 17.6 | 17.8 | 18.0 |
| Refined trail | 17.1 | 17.5 | 17.8 |

Median difference −0.3 FPS (about −1.7%): no material FPS regression was detected in this session. A separate single-view lower-DPR observation of the refined scene was 44.9–48.2 FPS at 1600×900; that is not the matching baseline comparison. The renderer adds one small polyline primitive (two instead of one), while removing the old 15-second geometry rebuild. GPU memory was not instrumented.

### Automated gates and audit

- Frontend: **52 tests / 9 files**, typecheck and production build passed with Node 24. The existing large Cesium bundle warning remains.
- Backend: **82 tests**, both `mvn test` and `mvn verify` passed. The only backend change is the full-orbit window regression test.
- Tests cover centered bounds/period/181 ordered unique epochs, missing/asymmetric/irregular grid rejection, symmetric monotonic bounded fade, uniform OEM dash material, identical layer vertices/unclosed sample sequence, deterministic parameters/uniform-only updates, loading/ready/expired representation, and existing model/feature interaction routing.
- `git diff --check` passed. No source geometry/physics change, loop, duplicated endpoint, fake OEM offset, animated random noise, global depth override, or analytics API was added.
- `/api/iss/orbit/comparison` and `/api/iss/orbit/samples` contracts are unchanged; API documentation therefore needs no semantic revision.

Final served-production refresh observations retained `ACTIVE / READY / AVAILABLE` through response times **13:00:37 → 13:02:38 → 13:04:38 UTC** on 2026-09-30. Development retained the path through response times 12:47:27 through 12:53:27 UTC and refreshed during a later Inspection session without restarting its camera. The final representation policy depends only on buffer validity and model readiness; camera distance cannot re-enable a ready-model locator.
