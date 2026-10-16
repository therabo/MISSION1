# Earth View orbital delivery decision and validation

## Earth camera interaction and detail envelope — 2026-10-16

The existing Viewer/camera owner now enforces the two measured user-reference
zoom limits through native controller settings and public scene events. The
toolbar shares those physical limits. Inspection and Reset keep their separate
ownership; scientific/API state and required distant celestial visuals remain
independent of camera range. Existing view-dependent Globe/imagery refinement
needs no extra provider cap. This reversible local policy adds no structural
boundary or dependency and needs no new ADR.
[Derivation and resource semantics](../frontend/earth-camera-envelope.md).

## Existing graphics controls restored — 2026-10-05

Browser WebGL antialiasing is explicitly enabled again and historical Black Marble brightness returns to 1.8 (gamma/contrast 1). Cesium MSAA 4, retained FXAA, source/loading ownership and all delivery/camera boundaries remain unchanged. This supersedes the browser-AA removal described in the preceding dated milestone; it creates no architecture decision or new ADR. [Matched quality comparisons and measured frame cost](../frontend/rendering-quality-restoration/README.md).

## Graphics source fidelity and loading ownership — 2026-10-04

EarthView still owns one Viewer and its graphics lifecycle. The Earth-imagery helper owns independent source probes, ordered local/tiled layers and per-tile bounded retry cleanup. It uses only public imagery APIs; data acquisition, persistence, GP/OEM delivery and Replay are unaffected. The pinned NASA SVS Tycho product now uses a lossless TIFF input and 4096² cube derivatives; NASA VTAD geometry/PNG/PBR stays unchanged. Public Viewer context options remove redundant browser AA while keeping Cesium MSAA 4 and its retained FXAA pipeline.

Within that same lifecycle, ISS resources and existing first-use rendering preparation have priority; high-resolution stars refine the visible bundled skybox after model readiness. No extra service, global asset cache, per-frame UI state or new data contract is introduced.

These are reversible controls and preprocessing within the existing graphics/source boundary, with no new library, service, API, deployment or cross-cutting convention. No new ADR is required; ADR-0006 remains unchanged. The [graphics dossier](../frontend/high-fidelity-rendering-performance/README.md) records the quality/memory tradeoff, rejected alternatives and the honest 60 FPS target failure on the reference machine.


## Full-screen occlusion presentation boundary — 2026-10-04

App owns event-driven rendered dashboard geometry; CSS owns side/bottom/hidden
layout roles. EarthView retains sole ownership of the full-screen Viewer, physical
camera and projection/input adaptation. The DOM dashboard occludes only its
actual clipped rectangle. The layout prop carries viewport, occlusion, areas and
remaining-area centroid, without source/API coupling or copied panel dimensions.

Two ResizeObservers retain separate responsibilities: shell/dashboard geometry
and native full-screen Cesium size. One scoped attribute observer also detects
position/visibility-only changes. Window resize/layout state rebinds actual owners;
all observers/listeners/adapters are cleaned up. No frame-loop DOM reads occur.
Public perspective frustum offsets preserve canonical pose/FOV and pixel scale;
a local Cesium 1.145 compatibility adapter preserves native rays/GPU picking
and the globe's far ground-atmosphere projection ray through a neutral public
Fabric material. Imagery colour and native lighting/scattering remain unchanged.
Only cached projection arithmetic interpolates for 650ms after a layout change.

The superseded right-side rectangular viewport assumption was a reversible local
presentation adapter, not an accepted service/module/API/ADR boundary. This
correction changes no backend, dependency, persistence, source or deployment rule;
no new ADR is required. [Derivation, API audit, trade-offs, regressions and limits](../frontend/occlusion-aware-workspace-centering/README.md).

## Night-side protection and rounded trajectory joins — 2026-10-03

The existing physical/presentation boundary is unchanged. Constant adjacent-endpoint attributes support GPU capsule ownership; fragment-ray visibility limits the curved station mask at the Earth limb. Geometry is prepared once on response replacement, never on camera motion. Sources, backend, API, first temporal exit, camera and provenance remain unchanged. [Screenshot reproductions, isolation, native raster, GPU property tests and matched regression evidence](../frontend/trajectory-rendering-artifact-review/dark-side-oblique-fixes/README.md). Earlier dated sections preserve the accepted rendering history.

## Trajectory physical/presentation boundary — 2026-10-02

The existing physical/presentation boundary now explicitly separates retained source geometry, bounded first temporal exit, local curved re-entry masking and GPU capsule cross-section. Camera-only updates mutate current-frame uniforms; source/UTC/window continue to determine physical samples and the endpoint. A missing local projection cannot globally blank the body. Source adapters, persistence, APIs, orbital computation and camera implementation remain byte-identical to the accepted baseline. [Physical camera-independence, fast-motion and regression evidence](../frontend/trajectory-rendering-artifact-review/final-candidate/README.md). ADR-0006 is unchanged; no new ADR or infrastructure was introduced. Earlier dated 10 Hz/support-direction notes describe the previous baseline.

## Downstream reveal clearance — 2026-10-02

The physical/display boundary remains: each real bounded path supplies a temporal presentation start beyond the displayed model's downstream hull edge. Visible camera transitions refresh the start each frame before applying reveal; stable Overview retains its 10 Hz cadence. Runtime confirms the physical desktop Inspection pivot already gives 90 m / 42.5° / 100°, so camera behavior is unchanged. [Narrow correction and regression evidence](../frontend/final-graphics-regression-fixes/README.md). No new architecture decision or infrastructure is introduced.

## Presentation-only trajectory visibility — 2026-10-01

The accepted `c3d24ae` camera/focus/path/clock/readiness remains frozen. A single retained `trajectoryTransitionVisibility` multiplies existing selected/inactive halo/body alpha in both directions: stable Inspection is zero; close departure stays hidden; Earth Overview is one. During entry/exit, C2 smootherstep over log camera-to-displayed-ISS range reveals between **100 km and 10,000 km**. The far edge is capped at the captured actual Overview range; the hidden edge is `min(100 km, farEdge/2)` for nearer starts. It does not use a timeline threshold or immediately show/hide at a mode assignment. Both products share the policy. Existing clearance/mask updates run only while opacity is nonzero, retaining their geometry and source-specific search; automatic visible transitions now refresh the start each frame, while Overview keeps the 10 Hz bound. No camera tuning, source contract, shader/asset/texture/quality change or new infrastructure. [Measured windows, frame samples, browser/regression and performance evidence](../frontend/trajectory-transition-visibility-review/README.md). Earlier dated visibility descriptions are historical.

## Explicit camera focus refinement — 2026-10-01

Earth↔ISS now uses an explicit positive focal ray independently of the retained cubic/hybrid position path. It captures the actual Earth composition and actual orbited/zoomed Inspection pose, blends a quaternion rail with smooth angular containment around the displayed station, and retains focal as well as pose derivatives on partial Back. There is no target threshold switch or final recenter. The canonical 90m /42.5° /100° and 6/5s remain; captured range/angle gives bounded durations for other starts. The same selected-source physical frame, lift/silhouette/FOV, native resolution and NASA PNG/PBR asset remain. Automatic motion copies the public world camera basis, avoiding Cesium’s nadir heading/roll conversion. Graphics readiness requires the retained Moon/Sun startup draws and eight model/globe preparation renders; temporary celestial views cannot count toward model readiness. Optional imagery failure retains the existing local fallback. [Focus definition, gates, arbitrary geometry, profiles and evidence](../frontend/camera-transition-perfecting-review/focus-optimization/README.md). The earlier dated records below preserve preceding behavior; the focal model above supersedes their residual-aim composition.

Status: **selected for MVP2 backend delivery**, 2026-09-28. Decision gate: `REST_SAMPLED_WINDOW`.

## Requirement and boundary

The Earth View needs a computed current ISS location at a known UTC instant, smooth motion, a short recent/future orbital arc, the generating TLE's epoch/retrieval/hash, current quality, and a clear response to source or API outages. It does not yet need an orbit-long ground track, replay, attitude, station modules, or telemetry. The CelesTrak retrieval interval (~2h10m MISSION1 policy), API sample spacing (10 s default), REST refresh interval (120 s recommended), and browser render cadence (potentially 60 FPS) are independent.

The backend selects one `latestUsable(generatedAt)` set, creates one request-local Orekit TLE propagator, and calculates Earth-fixed positions for the entire bounded window. It never calls CelesTrak or writes generated positions. The browser interpolates only for visualization; it does not run SGP4, TEME-to-ITRF, or a custom WGS84 transform. Earth-fixed Cartesian meters map directly to Cesium's `Cartesian3` in `ReferenceFrame.FIXED`. The response also carries the backend's WGS84 geodetic point at `generatedAt` for geographic readout. Cesium's [SampledPositionProperty](https://cesium.com/learn/cesiumjs/ref-doc/SampledPositionProperty.html) defaults to FIXED, supports runtime `addSamples`, linear degree-1 interpolation, and `NONE` extrapolation. [Entity.position](https://cesium.com/learn/cesiumjs/ref-doc/Entity.html), [PositionProperty](https://cesium.com/learn/cesiumjs/ref-doc/PositionProperty.html), [PathGraphics](https://cesium.com/learn/cesiumjs/ref-doc/PathGraphics.html), [Clock](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html), and [Timeline](https://cesium.com/learn/cesiumjs/ref-doc/Timeline.html) support a moving entity and time-indexed arc without frame-rate network traffic. Cesium's [Transforms docs](https://cesium.com/learn/cesiumjs/ref-doc/Transforms.html) identify its fixed axes as Earth-fixed/ITRF; [ModelGraphics](https://cesium.com/learn/cesiumjs/ref-doc/ModelGraphics.html) can attach a glTF URI to a positioned entity in a later frontend task. Model attitude is unavailable and must remain neutral/labeled.

## Transport comparison

| Option | MVP assessment |
| --- | --- |
| Repeated `GET /api/iss/state` | Good for exact status cards and diagnostics. At 120 s intervals, a moving object lacks a future position. Polling it every 1–10 s still gives network-timed point arrivals, requires interpolation logic and gives no short future path; 1 Hz would be 86,400 requests/day/client. |
| Bounded `GET /api/iss/orbit/samples` | 73 positions by default, about 10 KB JSON and about 4–6 ms median warm local generation (fixed fixture, Testcontainers/PostgreSQL on one developer machine). A 181-sample configuration produced about 23 KB JSON and took about 5–11 ms in warm local runs. One request per 120 s is 720/day/client; the browser can render between samples at its own frame rate. Includes future path and failure buffer. |
| SSE | Push could announce an occasional new element revision, but does not improve deterministic interpolation between revisions. It adds reconnect, ordering and stream-lifetime behavior with no present benefit for this orbital-only view. |
| WebSocket | Bidirectional subscriptions are unnecessary for one ISS computed path. It adds connection state, backpressure, reconnect and gap semantics without providing more authoritative orbital information. |

The sampled REST contract extends the accepted single-backend REST architecture and introduces no durable push choice, so no new ADR is needed. Reconsider push when a measured latency or multi-topic telemetry requirement exceeds this contract.

## Interpolation experiment

The offline `OrbitalInterpolationExperimentTest` uses the verified 2026-09-28 ISS TLE fixture, Orekit ITRF positions every 0.5 s over 10 minutes starting at 15:00 UTC, and compares each intermediate reference position with endpoint interpolation. These are **deviations from MISSION1's Orekit computation**, not physical ISS position errors. Cubic Hermite uses Orekit Earth-fixed velocity at both endpoints; linear uses positions only.

| Step | Linear max / mean | Cubic Hermite max / mean |
| --- | ---: | ---: |
| 1 s | 0.999 / 0.998 m | 0.000003 / 0.000002 m |
| 2 s | 3.995 / 3.327 m | 0.002779 / 0.001622 m |
| 5 s | 24.966 / 18.301 m | 0.007119 / 0.004325 m |
| 10 s | 99.865 / 69.876 m | 0.014251 / 0.008455 m |
| 30 s | 898.751 / 608.907 m | 0.043337 / 0.028558 m |

Hermite materially reduces interpolation error and could use wider intervals, but the Earth-scale MVP does not need centimeter-level agreement with a TLE model. Ten-second linear sampling keeps velocity derivatives and their frame semantics out of the API while limiting observed deviation to about 100 m in this test. The experiment covers one fixture and ten minutes, so the numeric result is a design check, not an accuracy guarantee for every element set or camera zoom. `PathGraphics.resolution` is a separate **render path tessellation** setting; it does not change API sample times.

## Buffer and lineage rules

The default window is 2 minutes past + 10 minutes future (12 minutes total). The fixture's mean motion is 15.48675883 revolutions/day, about 93 minutes per orbit, so this is a short local arc and intentionally not a full ground track. Its 73 samples are sufficient for smooth object motion and a short `PathGraphics` lead/trail. A future full-orbit ground-track product likely needs a longer horizon and coarser points; design it separately if the frontend actually requires it.

The frontend should load the response into a `SampledPositionProperty(ReferenceFrame.FIXED)`, use linear degree 1 and `ExtrapolationType.NONE`, and align Cesium's clock to the server-provided `generatedAt`/sample times. Use the monotonic duration of the request to account for transport delay where useful; never require browser wall-clock equality. Refresh every 120 s. That leaves about 8 minutes of future coverage after a normal refresh point. Keep existing samples when a refresh fails and show API connectivity separately from orbital quality. When the buffer ends, stop the moving pose and show a degraded/stale indication; do not extrapolate indefinitely or silently hold a supposedly current ISS marker. A new response with the same element hash can replace overlapping samples. When the hash changes, replace the old window as a unit and show the new source epoch; do not splice two TLE revisions into one visual arc. A source outage can still yield HTTP 200 with cached elements and `STALE` quality. A backend/DB outage can yield 503/500; already buffered positions remain usable only until their timestamp horizon, with their last known quality and source metadata visible.

Past points are model reconstructions from the **currently selected** TLE, not what MISSION1 knew at those past instants and not measured historical truth. Future points are computed GP/TLE predictions, not NASA OEM. `qualityAtGeneratedAt` assesses the current computation under `orbital-current-v1`; it is not a positional uncertainty bound for the whole path. Historical as-of selection, NASA OEM comparison, and a full ground track remain separate future contracts.

See the [exact API contract](../api/orbital-samples.md) and the [current-state API](../../backend/README.md#current-orbital-state-api).

## First frontend implementation

The [React/TypeScript Earth View](../../frontend/README.md) implements the selected contract with one stable Cesium Viewer and ISS entity. Its relative `/api` request uses a Vite development proxy; one completed request schedules the next after 120 seconds. Validation precedes a complete in-memory `SampledPositionProperty` replacement, so TLE hashes never mix. The property is Earth-fixed, linearly interpolated, and bounded by its first/last backend samples. A failed request preserves an active buffer with a separate degraded-delivery indication; an expired buffer hides the moving entity. Orbital quality and acquisition health are displayed independently. NASA GIBS imagery is a frontend visual layer with bundled local fallback; ellipsoid terrain and the local fallback require no ion token.

The later [ISS Inspection Mode](../frontend/iss-inspection-mode.md) consumes this same property and clock. Its camera follows the sampled position in a local ENU navigation frame while the user orbits the model; it neither extends the backend window nor requests positions at camera-frame rate. An expired buffer exits inspection before the target becomes undefined. A replacement window changes the tracked point atomically, retaining the selected lineage's existing no-splice semantics. This is camera presentation, not a new orbital-delivery contract or spacecraft attitude.

The corrected progressive entry reads the current position from that bounded property at the same scene time as the model on every camera tick. It interpolates a camera offset in the moving ENU frame and hands the final pose to the same pivot used for user inspection. There is no future fixed flight target, orbital extrapolation or new network cadence. Cesium's [scene-time Earth lighting and historical night imagery](../frontend/earth-visualization.md) are presentation only; they do not alter state, sample provenance, or quality.

The deterministic backend ITRF XYZ → Cesium fixed Cartesian → WGS84 sanity check found latitude, longitude, and height differences below 5×10⁻¹³ degrees and 10⁻⁹ meters, respectively, against the backend WGS84 point at the same fixture instant. The test tolerances are 0.0001 degrees and 1 meter; this is a frame/unit compatibility check, not a physical-orbit accuracy estimate. Browser smoke testing covered development and served-production assets, globe, marker/path, backend status, and camera navigation.

## 2026-09-30: selectable forward comparison delivery

[ADR-0006](../adr/0006-selectable-forward-trajectory-visualization.md) supersedes ADR-0005's permanent-GP model and centered/dashed presentation. The primary short REST buffer remains mandatory and the default visualization source. Comparison delivery supplies 181 real primary propagations from response time through one TLE-derived mean-motion period, with current index 0. OEM uses independently persisted predicted source vectors and bounded Hermite/ITRF conversion; its uniformly sampled intersection includes true coverage boundaries at no more than 181 points.

A single selected physical position drives the geographic display, progressive approach and Inspection ENU pivot; the model display position is derived separately from it. GP/TLE is `COMPUTED_FROM_ORBITAL_ELEMENTS`; OEM is `SOURCE_PROVIDED_PREDICTED_EPHEMERIS`. Source selection is a visualization preference, not a change to `/iss/state` or a correctness claim. Controls lock outside Overview. Selected OEM must cover scene time in source and delivered samples and satisfy the existing 300-second comparison display lifetime. Covered degraded stored OEM remains explicit. Loss exits Inspection and returns to primary with a notice. The scene keeps evaluating the preceding valid moving prediction across a normal <=3-second refresh alignment seam until the new product covers scene time; genuine outages are applied immediately.

Both continuous trails render only `[adaptiveTrueFutureStart, sceneTime+0.85T]`, using the primary period. OEM clips to coverage and fades fully at its real endpoint. Inverse smoothstep and glow soft edges update with temporal uniforms; geometry changes only on response refresh and replacement layers reveal together. Active PRIMARY cyan / OEM amber and subdued inactive styling swap through retained material uniforms, without trajectory offsets. The corrected Overview model uses an 80-pixel minimum and **75 km model-only WGS84-normal display lift**. That lift smoothly reaches zero during the first 1.75 seconds of entry; the approach and final Inspection pivot remain physical throughout. Back restores the lift over 1.2 seconds. Overview now has a white 0.5-size, 0.12-alpha public model silhouette, smoothly removed/restored with the lift. Each trail searches its own bounded property for a screen-space start at up to 10 Hz. Public Fabric adds a 1–4 CSS-pixel soft start and a per-fragment conservative model-hull clearance mask; cheap mask uniforms follow each frame. No source coordinates are displaced. Selected physical position, reported altitude, asset scale and attitude semantics remain unchanged. [Rendering review](../frontend/trajectory-presentation-review/README.md) records browser evidence and performance.

## Trajectory-aligned visual inspection — 2026-09-30

One selected physical ITRF position/velocity now supplies the shared model and moving-camera visual frame. Orientation is `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION`; actual attitude remains unavailable. The rear camera arrives at 119 m (65% closer than 340 m), with 85° perspective FOV and narrow-aspect adaptation. Camera range supplies close framing; model scale 1 and minimumPixelSize 80 remain. Inspection-only wheel/pinch zoom is proportional, bounded and reversible; native drag orbits the physical station pivot. Back restores all Overview settings. Existing lift, silhouette, trails, source selection and feature picking remain.

The existing sample responses add Earth-fixed velocity components and `velocityUnit:m/s`; GP uses existing Orekit PV, OEM the analytic source-Hermite derivative transformed as complete PV. Position samples, lineages, cadence, frames, storage and source classifications are unchanged. No infrastructure or new source is added. [Evidence and limitations](../frontend/inspection-orientation-review/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.

## Inspection rendering optimization — 2026-10-01

Canonical Inspection now arrives behind and above the selected physical ISS at 90 m slant range / 42.5° elevation / 100° FOV. A single retained quintic pose pipeline coordinates 5-second entry and return, with a continuous Earth-clear arc when required and interrupted-entry tangents. Back restores the captured world camera and controller state. The selected physical source, shared trajectory visual frame, source sampling and delivery contracts remain unchanged; actual attitude remains unavailable. Full PNG textures persist. Stable ambient environment generation, bounded specular antialiasing and MSAA/FXAA address measured rendering costs and shimmer without modifying geometry. [Evidence, performance and limitations](../frontend/inspection-rendering-optimization-review/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Perceptual camera transition refinement — 2026-10-01

The subsequent camera milestone inspected and retained the uncommitted cubic/display-target candidate. Strict Cartesian constant-speed traversal was evaluated and rejected because it produced non-uniform apparent scale and a final close-up pop. Entry now takes 6 seconds; return 5. A once-built inverse metric allocates 20% to normalized log lens distance, 60% to inverse lens distance and 20% to path viewing-direction travel. C2 temporal rate ramps and a C1 inverse map preserve gradual progress; physical speed may vary substantially. FOV, lift and silhouette follow range rather than independent timers. Camera composition uses the displayed target; the stable 90 m / 42.5° Inspection pivot remains physical. Partial Back retains actual incoming camera derivatives. Return restores world pose, frustum, transform and controllers. A 0.8-second presentation translation prevents an unavailable OEM anchor from teleporting out of the close return view while physical GP selection, readouts and provenance change immediately.

This updates presentation within ADR-0006, with no new service, source contract, browser propagator, asset or rendering-quality policy. Earlier dated timing records remain historical. [Quantitative and browser evidence](../frontend/camera-transition-perfecting-review/perceptual/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Replay integration — 2026-10-03

REPLAY adopts backend position and velocity at the identical requested UTC instant, pauses the scene and hides current trajectories. Mode changes issue no camera commands; accepted LIVE buffers, source selection, visual lift, shaders and transitions remain. [Mission Replay](06-mission-replay.md).
