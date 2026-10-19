# ISS Inspection Mode

## Shared Earth / Inspection position bar — 2026-10-19

Both modes now use exactly **Latitude | Longitude | Altitude | Over** through one
persistent `PositionStatusBar`: four equal desktop columns and a 2×2 mobile grid.
The previous five-field Inspection strip and Earth summary are superseded. The
ISS / Inspection / Spatial investigation and ISS / WGS84 identity blocks and the
General Perturbations quality status/disclosure/card are removed completely.
WGS84 scientific semantics and GP/TLE quality, validation, source-health and
provenance state remain internally; only their dedicated presentation is removed.

The unchanged PositionReadouts guard/formatter consumes existing Current physical
samples or the coherent Historical state at selected UTC/source. No display lift
or camera coordinate is used. Over remains a static — without geographic logic.
Delivery/scene/buffer/fallback and Historical failure notices remain separate;
Inspection interaction guidance, model/module behavior and cameras are preserved.

[Full shared-bar contract](position-status-bar.md). Evidence remains outside Git:
`/Users/daniel/.codex/exports/mission1-unified-bottom-bar-2026-10-19/`.

## Earth Reset path correction; Inspection restoration — 2026-10-13

The dated Reset sections below are historical and superseded. Runtime tracing
of the actual Earth `.earth-scene-controls .secondary-reset` proved that the
0.8s/2.5s milestones animated a newly added **Inspection** control; the real
Earth control still called synchronous `camera.setView`. They are different
branches of one bridge, not the same camera action.

Inspection is selectively restored to **e82ad438**: no Reset button, no reset
helper/tick/retained basis, original native tracking/orbit/zoom/pinch. Accepted
90m desktop /42.5° elevation /100° FOV, responsive rear offset, physical F/L/U
frame, entry 6s, exit 5s, composition, model scale and module picking remain.
Branding and Crew work from the later commits is preserved.

The actual Earth button now runs its own `EarthResetTransition`: exact rendered
capture, 2.5s C2 timeline, positive WGS84 clearance, coherent transported basis,
held FOV/transform and canonical Earth 17,000km geodetic height/nadir/north-up.
Its reference is the accepted selected-source physical state at scene UTC,
correcting the previous retained Current-GP lookup in Historical/OEM. Current
updates that endpoint each frame; Historical keeps T. Native interruption,
repeat, resize, source/time handoffs and Inspection entry relinquish Earth camera
ownership in place. It does not modify Inspection flight formulas.

The [correction dossier](branding-crew-simplification/README.md#actual-earth-reset-correction-and-selective-inspection-restoration--2026-10-13)
records the proven wrong path, earlier validation gap, selective restoration,
actual-button render traces and both-build normal-speed acceptance. All large
artifacts and the final Git report stay outside the repository.

## Reset view perceptual correction — 2026-10-12

The 0.8s reset introduced at `9134a2e` was numerically progressive but was
rejected after user observation as almost instantaneous. Its call path is
App → existing controls bridge → capture-only `InspectionResetTransition`
constructor → existing Viewer tick. The click does not call `setView`, `lookAt`,
`lookAtTransform`, reset a controller/range/transform or place the camera at an
intermediate canonical pose. The constructor copies the actual local position,
direction, up and FOV; its clearance preflight changes only private scratch data.
Right is derived from the captured orthonormal basis; the existing physical frame
supplies world position/orientation. Browser before/after-click vectors, world
basis, transform and FOV are identical, with zero camera API calls in dispatch.

The actual problem was borrowing the **0.8s source-display repair duration** for
a deliberate user flight. In the retained far/off-axis baseline trace, range
falls from 487m to 125m in about 216ms between the middle and three-quarter
frames. Logarithmic range distributes relative zoom, but the useful close-up
change is compressed into a fraction of a second. Neither the C2 easing nor a
pre-animation snap caused the problem.

Reset now takes a fixed **2.5s** for every meaningful movement. No adaptive rule
is needed within the existing 35–2000m Inspection bounds; this keeps all devices
and sources predictable. An already canonical pose remains a visual no-op.
The unchanged monotonic C2 smootherstep `6t⁵ − 15t⁴ + 10t³` supplies one eased
progress for radial quaternion turn, roll, logarithmic range and FOV. Spatial
position is that direction multiplied by range. The existing close-camera
clearance preflight shapes the radial path from the same progress, without a
separate zoom clock or a change to the accepted box/clearance. It prevents an
array intersection and range reversal, including very close off-axis starts.

Current uses the evolving selected-source physical F/L/U frame on every tick;
Historical uses its unchanged selected UTC. Both use the identical reset class.
Native wheel/pinch/orbit cancels at the reached pose with its actual basis
retained; repeated reset replaces one flight from that pose. Resize cancels in
place and the next press uses the existing responsive endpoint. The 90m desktop,
42.5° elevation, 100° FOV, zero lateral intent, projection composition, model
scale, accepted entry/exit timing and original Earth restoration are unchanged.

The [existing correction dossier](branding-crew-simplification/README.md#reset-view-softness-correction--2026-10-12)
records root-cause traces, 0/10/25/50/75/90/100% screenshots and poses, endpoint
handoff measurements, real Historical OEM availability and both-build validation.
The dated 0.8s implementation and its evidence below remain historical.

## Progressive Reset view — 2026-10-12

The accepted 90 m desktop /42.5° elevation /100° FOV endpoint, responsive
`rearInspectionOffset`, physical selected-source F/L/U pivot and model scale stay
unchanged. The preceding baseline had only an instantaneous Earth Reset command;
its toolbar was hidden in Inspection. The existing camera-control bridge now also
exposes a dedicated Inspection Reset view button in the scene overlay, enabled
only in stable Inspection. It does not change navigation or canvas geometry.

`InspectionResetTransition` captures the actual local camera position, direction,
up and canonical FOV at the press. The existing Viewer tick evaluates one normalized
wall-clock progress, using the existing C2 `smootherstep`. One quaternion turn transports the actual basis along the shortest radial arc;
roll unwinds continuously toward the accepted up vector. Range and FOV derive
from that same eased progress. A bounded capture-time clearance preflight adjusts
outward radial progress only for close poses that would otherwise meet an array
edge and produce a range reversal; the existing clearance values stay unchanged. Quaternion orbit avoids a pole-induced
up-vector flip. The existing directional clearance clamp still applies. Duration
is 0.8s, matching the existing local `DisplayRetarget` correction; there was no
accepted Inspection-reset duration to preserve. Entry/exit duration and formulas
are untouched. No Cesium flight, extra animation listener or timeout chain is added.

Each frame installs this local pose in the same freshly evaluated physical frame
already used by Inspection. Current follows the moving selected-source sample;
Historical follows its accepted UTC T and backend primary state. No world target,
Current state fallback, physical sample change, scene-time change or source request
is introduced. Perspective offsets keep their existing composition policy. At
completion the local position is exactly the existing rear offset; the next native
lookAt has the same target orientation, with no visible numerical handoff.

Wheel, pinch and pointer orbit cancel the one reset without moving the camera.
The current local basis is retained on subsequent tracking ticks and proportional
zoom, preventing an interrupted roll from snapping to the canonical up vector.
Repeated presses capture the current interpolated pose and replace the reset.
Resize cancels it in place; a later reset uses the new responsive range. Leaving
Inspection cancels reset before the existing Back transition captures/uses its
actual pose. Source loss and temporal guards retain their accepted semantics.

[Final branding/reset validation](branding-crew-simplification/README.md) records
intermediate 25/50/75% tests, native browser traces and the Historical OEM availability
limit. Historical currently consumes the backend primary automatically; availability
of an OEM secondary alone does not enable a selectable Historical OEM scene.


## Restyled responsive validation — 2026-10-08

The existing strip and module overlays were audited across desktop, tablet, phone and short landscape sizes without changing their accepted composition. Compact module content remains internally scrollable; exposed canvas pixels around the dock still accept native picks and orbit/zoom input. Native browser QA checks 90m desktop range, 42.5° elevation, 100° FOV, the existing portrait widening, hover clearing during camera motion, selection/color restoration and Earth return. Camera and Cesium code remain byte-identical to the initial restyling branch. [Complete layout and interaction dossier](ui-restyling-responsive/README.md).

## Semantic module hover — 2026-10-05

In stable Inspection, recognized ISS modules provide a transient hover affordance. Hover feedback is suspended during camera manipulation and transitions and resumes only after the scene becomes stable.

The existing feature ID + `moduleCode` manifest resolver gates both click and hover. Only one recognized module receives the temporary cyan tint; leaving it restores its exact previous appearance. The cursor is `pointer` only over a valid module while static. Pointer-down and wheel input clear feedback immediately; orbit, inertia, programmatic local camera/lens changes, entry and exit keep it off. After 200 ms without a view change, the current pointer is re-picked once. Station tracking itself moves the camera and model together and remains interactive. Mouse movement triggers picking only at changed coordinates; no render-frame picking or hover React state exists. Touch has no hover gesture. Existing module clicks and information panels are unchanged.

[Implementation, all 14 modules, motion/pick traces, screenshots and validation](inspection-module-hover/README.md). Native two-finger pinch remains unverified.

## Browser antialiasing restored — 2026-10-05

The existing Viewer now requests `contextOptions.webgl.antialias=true`, retaining Cesium MSAA 4, Inspection FXAA, DPR/resolutionScale, native ISS textures and all camera/transition/framing behavior. Black Marble brightness returns to 1.8 with gamma/contrast 1. [Matched native ISS thin-geometry, trajectory and responsive QA plus measured frame cost](rendering-quality-restoration/README.md). The earlier dated browser-AA removal is superseded. Native two-finger pinch remains unverified.

## Source fidelity and redundant-AA removal — 2026-10-04

The 90 m / 42.5° / 100° canonical pose, accepted 6s entry/5s return, responsive widening, source frame and occlusion-aware projection remain byte-identical in their helpers. One persistent NASA VTAD model retains its 19 original full-resolution 512²/1024² PNGs, original PBR and all 14 semantic feature identities. No model reload, decimation or material/detail invention is introduced.

Cesium MSAA 4 and retained complementary FXAA remain. Public Viewer options disable only the redundant browser drawing-buffer antialiasing applied after Cesium's resolved output. The source/fidelity and native sampler audit, close/oblique views, both-build input/module QA, exact camera regression and actual FPS are in the [high-fidelity review](high-fidelity-rendering-performance/README.md). Native two-finger pinch remains unverified.

The eight model/globe preparation renders and celestial readiness gate remain. High-resolution star refinement starts afterward, preserving source-texture readiness before reveal and avoiding an extra star-decoder delay before the Inspection control becomes available. This is loading order within the same Viewer; steady camera and rendering semantics are unchanged.


## Canonical pose and occlusion-aware composition — 2026-10-04

The station's physical pivot, 90m slant range, 42.5° elevation, zero lateral
canonical geometry, 100° FOV and accepted 6s entry/5s return policy remain.
Responsive range widening uses the full shell aspect: 144m at 768×1024 and
233.723077m at 390×844. Camera focus, path, warmup and native controls are retained.

Cesium stays full-screen beneath the dashboard. The actual visible side panel's
clipped two-dimensional footprint defines the remaining area's centroid; its
short Inspection height has less composition weight than the Overview panel.
Public perspective frustum offsets compose the physical pivot at that centroid.
The former 86.567463° native crop is removed: the full-screen native/canonical
Inspection FOV is now 100°. Apparent scale stays unchanged. Mobile bottom panels
apply zero desktop offset. Canonical pose and screen composition remain distinct.

Cesium 1.145 needs local adapters for its symmetric native input ray/pick culling
and offset-dependent pixel-size helper. Native GPU feature IDs remain the source
of module selection; synchronous picking restores its temporary lens and minimum
footprint before the next scene render. No physical position, basis, model scale,
asset or onboard-attitude semantics change. [Correction and native picking/
physical-pose evidence](occlusion-aware-workspace-centering/README.md).

## Inspection range and clearance audit — 2026-10-02

The selected physical pivot, frame translation and centred model coincide in stable Inspection. Measured GP and OEM desktop ranges before and after the clearance correction are **90 m**, with Forward **−66.354960 m**, Left **≈0 m**, Up **+60.803119 m**, elevation **42.5°** and FOV **100°**. Arbitrary Earth entries reach that same endpoint without a handoff correction. Accepted portrait widening remains `90 × max(1, 1.2/aspect)`; 390×844 uses 233.723077 m. No camera change was required. [Full measurements and reveal audit](final-graphics-regression-fixes/README.md).

## Trajectory visibility during Inspection transitions — 2026-10-02

The accepted `c3d24ae` camera/focus/path/clock/readiness remains frozen. A single retained `trajectoryTransitionVisibility` multiplies existing selected/inactive halo/body alpha in both directions: stable Inspection is zero; close departure stays hidden; Earth Overview is one. During entry/exit, C2 smootherstep over log camera-to-displayed-ISS range reveals between **100 km and 10,000 km**. The far edge is capped at the captured actual Overview range; the hidden edge is `min(100 km, farEdge/2)` for nearer starts. It does not use a timeline threshold or immediately show/hide at a mode assignment. Both products share the policy. Existing clearance/mask updates run only while opacity is nonzero, retaining their geometry and source-specific search; automatic visible transitions now refresh the start each frame, while Overview keeps the 10 Hz bound. No camera tuning, source contract, shader/asset/texture/quality change or new infrastructure. [Measured windows, frame samples, browser/regression and performance evidence](trajectory-transition-visibility-review/README.md). Earlier dated visibility descriptions are historical.

## Explicit camera focus refinement — 2026-10-01

Earth↔ISS now uses an explicit positive focal ray independently of the retained cubic/hybrid position path. It captures the actual Earth composition and actual orbited/zoomed Inspection pose, blends a quaternion rail with smooth angular containment around the displayed station, and retains focal as well as pose derivatives on partial Back. There is no target threshold switch or final recenter. The canonical 90m /42.5° /100° and 6/5s remain; captured range/angle gives bounded durations for other starts. The same selected-source physical frame, lift/silhouette/FOV, native resolution and NASA PNG/PBR asset remain. Automatic motion copies the public world camera basis, avoiding Cesium’s nadir heading/roll conversion. Graphics readiness requires the retained Moon/Sun startup draws and eight model/globe preparation renders; temporary celestial views cannot count toward model readiness. Optional imagery failure retains the existing local fallback. [Focus definition, gates, arbitrary geometry, profiles and evidence](camera-transition-perfecting-review/focus-optimization/README.md). The earlier dated records below preserve preceding behavior; the focal model above supersedes their residual-aim composition.

## Perceptual camera transition review — 2026-10-01

The strict-speed candidate was inspected and reproduced before modification. Constant metres per second is no longer an acceptance criterion; gradual apparent scale, displayed-target framing and derivative continuity govern the transition. Cubic geometry, exact endpoints and captured Earth restoration remain. [Historical rejection and current review](camera-transition-perfecting-review/README.md).

## Elevated Inspection and rendering stability — 2026-10-01

The current canonical desktop camera uses a **90 m slant range**, **42.5° rear elevation**, zero lateral offset and **100° FOV**. Its trajectory-frame offset is calculated as `(-90 cos(42.5°), 0, 90 sin(42.5°))`, approximately **(−66.354960, 0, 60.803119) m**. Scale remains 1 and Overview minimumPixelSize remains 80. Narrow aspect ratios widen the range by `max(1, 1.2/aspect)` while retaining elevation. Inspection has no dedicated orbital panel; physical position is shown directly in its bottom strip. Earth and Inspection share the four-field physical position bar; dedicated quality evidence UI is removed while scientific state remains.

Entry takes **6 seconds**, return **5 seconds**. The inspected strict Cartesian-speed candidate was rejected because almost all close-up growth occurred in its final frame. Its cubic geometry, 8192-segment arc-length measurement and displayed-target correction remain. Timing now inverts a normalized hybrid metric: **20% log lens distance + 60% inverse lens distance/apparent scale + 20% viewing-direction travel**. Lens distance is displayed-target range times `tan(FOV/2)`. A 1024-interval monotone C1 Hermite inverse is built once; a C2 clock has 10% start/stop rate ramps and a uniform central 80%. No scene projection or table construction runs per frame. Physical speed intentionally varies. FOV completes its change during far travel and remains 100° in the close view. Lift/silhouette follow the same path range (100–1,000 km), with camera aim following the actual displayed target. Partial Back starts at the current actual pose and retains incoming world velocity, quaternion and FOV derivatives over a range-bounded interval of at most 0.4 seconds. Earth world pose, FOV, near/far, transform and controller state restore exactly. OEM unavailability immediately selects physical GP; a shared camera/model display translation settles over 0.8 seconds during return, never changing samples, readouts, velocity or trajectories. The stable Inspection pivot remains physical. [Perceptual traces, actual raster footprints, reversals and separate performance comparison](camera-transition-perfecting-review/perceptual/README.md).

The default Cesium environment-map invalidation at every 1 km caused repeated draw-command/shader regeneration as orbital motion and 75 km display lift changed the model translation. Generate that approximate ambient environment once, retaining its full diffuse/specular maps; position/time invalidation tolerances are infinite. Direct Sun, Earth lighting, terminator and historical city imagery continue to follow scene UTC. Ambient reflections are a stable visualization approximation, not an ISS radiometric simulation. A public CustomShader filters unresolved normal variance into bounded specular roughness; source base colors, metallic factors, normal maps and PNG bytes remain inputs. MSAA 4 remains active; complementary FXAA reduces thin-edge outliers during entry, Inspection and exit, while Overview keeps MSAA alone on supported hardware. All modes retain native DPR resolution. The public silhouette width/alpha stay at imperceptible positive floors (1e-6 px / 1e-12) in Inspection so Cesium can retain a valid compiled pipeline; the visible outline is zero. Back-face culling is restored there. Overview still uses 0.5 px / alpha 0.12. Ground fog is confined below 100 km (with compensated ground density), avoiding the model shader rebuild at Cesium's default 800 km ceiling. Close-view atmospheric shaders warm during model loading. A retained native-resolution FXAA stage uses a uniform bypass in Overview, so changing modes does not destroy/reallocate its GPU resources. No asset, geometry, source contract, low-resolution LOD or texture reload is introduced.

[Diagnosis, framing trials, browser checks, raw frame times and remaining limits](inspection-rendering-optimization-review/README.md). Earlier dated sections below retain historical behavior and are superseded by this section.


## Trajectory visual orientation and closer Inspection — 2026-09-30

The selected bounded physical position **and ITRF velocity at the same scene UTC** now drive one shared visualization/navigation frame: X forward along velocity, Y left, Z orthogonalized WGS84 up. The verified pinned VTAD axis conversion gives render-local +X forward and +Z up; no additional asset rotation is required. `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION` is a presentation choice. Verified onboard attitude remains `UNAVAILABLE`.

The five-second moving approach arrives on the exact rear axis at **119 m** in the canonical desktop viewport, versus the measured previous **340 m** (65% reduction). Its perspective FOV eases to 85°; narrow aspect ratios widen the range. Camera placement supplies the close view: physical scale stays 1 and minimumPixelSize stays 80 throughout. Lift 75 km and white silhouette 0.5 / alpha 0.12 still fade to zero by 1.75 s, and Back restores their captured values, the Overview camera/FOV and all controller settings. The final camera pivot is physical.

Inspection keeps Cesium's station-centered native drag orbit with spin inertia 0.7. Native zoom is disabled only there; public wheel/pinch actions change the local pivot range proportionally, with fractional input precision, bounded per-event changes, a directional geometry clearance and a 2 km maximum. Translation/look/tilt are restricted. No second orbit controller, external source, browser propagator or attitude feed is added. One model and its verified feature IDs persist.

The existing REST products add `velocityUnit:m/s` and `vxMetersPerSecond/vyMetersPerSecond/vzMetersPerSecond` in the same ITRF frame as XYZ. GP delivers its existing Orekit Earth-fixed PV. OEM evaluates the analytic derivative of its existing bounded source Hermite polynomial and transforms the complete PV through Orekit, including Earth rotation. Browser degree-one velocity interpolation is bounded and separate from the unchanged degree-one physical position interpolation. Velocities never come from lifted model positions or screen coordinates.

[Axes, numerical epochs, camera/zoom measurements, browser evidence and validation](inspection-orientation-review/README.md). The next milestone remains **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.

The record below documents preceding implementations; the 2026-10-01 perceptual section above defines current behavior.

Earth Overview and ISS Inspection share one Cesium Viewer, clock, ISS entity, preloaded model primitive and bounded backend-derived SampledPositionProperty in the fixed Earth frame. One selected physical sampled position drives the scene and camera: default GP/TLE propagation or explicitly selected NASA OEM predicted ephemeris. Neither is onboard position telemetry. The model is a historical NASA VTAD asset with display-only ENU orientation; spacecraft attitude remains unavailable.

## Why the earlier approach failed

The former 3.6-second Camera.flyToBoundingSphere leg used one future sampled ISS position as a fixed bounding-sphere center. Cesium's flight also interpolated its camera orientation toward that fixed endpoint. It did not continue aiming at the current rendered station. In a 563 × 722 development viewport, the sampled station moved from (288, 364) to (303, 2163) during that leg: it left the viewport while camera aim error reached about 71°. The fixed destination differed from the actual station by about 26 km at entry and less than 1 km near handoff. The dominant defects were CAMERA_FORWARD_VECTOR_DRIFT and WORLD_TO_LOCAL_HANDOFF_DISCONTINUITY, rather than orbital prediction error. The 1.8-second Camera.lookAt close leg abruptly reacquired the station at screen center. A fixed future point could not correct that orientation path.

The model's translated bounding-sphere center coincided with the sampled orbital pivot in the diagnostic run (rounded separation 0 m). Its display-only centering offset did not cause the screen drift. MinimumPixelSize 72 also kept the model's apparent footprint nearly constant through much of the former flight, delaying visible growth.

## Historical moving-target approach — 2026-09-29

Entering Inspection captures the world camera pose and its offset in the ISS east-north-up (ENU) frame at the current scene time. Every Cesium clock tick then reads the current station position from the active SampledPositionProperty at that same time. It rebuilds the ENU frame at that position, interpolates the camera's local offset toward the 340 m inspection offset, and sets the world camera pose with public Camera.setView. Range decreases logarithmically with a smooth start and finish; the offset direction turns gradually toward heading 35° and pitch −10°. Camera direction and up rotate from the actual Overview pose to station-centered framing over the initial part of the move. No Camera.flyTo call is repeated, no independent velocity or orbit model exists in the browser, and no future sample is used as the camera target.

A visible, line-of-sight Overview start enters the five-second moving approach immediately. The intended path is checked against the WGS84 ellipsoid at entry and each applied camera pose is checked again as the sampled target moves. If the ISS is occulted or that path would enter the globe, a 2.4-second acquisition first climbs along the starting radial to a shell safely beyond Earth's maximum radius, then turns toward the current station direction before starting the same moving approach. The acquisition also reads the current sampled station position each tick. A camera already inside the globe is not eligible to start Inspection. The station may initially be hidden behind Earth; once visible, the close approach keeps it centered. The normal visible approach does not climb to a Cesium geographic flight arc.

The detailed model is ready before entry. Its presentation-only minimum footprint rises smoothly from 96 to 174 pixels during approach, while physical GLB scale remains 1 and maximumScale remains 20000. This makes the station grow steadily instead of waiting until the last few hundred meters. During the 1.2-second return flight, the minimum footprint eases back to the far-view 96 pixels, avoiding a size pop at Back. The temporary loading/failure locator hides when the model is ready and remains hidden in Overview and Inspection. The ready model is the visible interaction target. The primitive is never remounted.

At the final tick, Camera.lookAtTransform adopts the same current ENU frame and final Cartesian offset already used to calculate the world camera pose. Development measurements found 0 m camera-position change and less than 0.000000001° change in direction/up across this handoff. Only then are user inputs enabled and the mode changed to ISS_INSPECTION. Subsequent ticks retain the user's local camera offset as the sampled pivot moves, with the existing 2 km excursion bound. User dragging and zooming are not overridden by an entry controller.

## Time, refresh, interruption and return

The camera and model use the same scene clock instant and active sampled window. An orbital-window refresh swaps the property atomically. If that refresh realigns the scene clock, the camera start time is shifted by the same amount so approach progress does not restart or jump; a real change between TLE lineages remains visible and is never fabricated into a blended orbit. Missing or expired samples and model failure abort entry, clear selection, restore the world transform and return to Earth Overview. Back to Earth View also cancels entry and returns over 1.2 seconds to the saved Overview world pose. The tick listener belongs to the Viewer lifecycle and is removed on unmount; there is no separate persistent camera animation listener.

The bounded computed path, 14 verified feature identities, selection panel, native Sun, scene-time Earth lighting, NASA Black Marble night layer and Tycho skybox keep their existing semantics. The model's ENU display orientation and the camera's ENU navigation frame do not assert ISS attitude.

## Development verification

Use the development-only approachDiagnostics URL query to log sampled scene time, camera range, angular aim error, projected ISS position, normalized screen error, globe occlusion, model-center difference and model minimum pixel size at roughly 400 ms intervals. It also logs the exact final handoff difference. The optional diagnostic point marks the orbital pivot; normal and production views omit it.

A desktop development run at a 1164 × 727 scene viewport went from 16,583 km through 3,237 km, 58 km, 5.1 km and 403 m to 340 m. The ISS screen point stayed within about 20 pixels of center and never left the viewport; Earth occlusion stayed false. A right-side start began at normalized screen error 0.262, entered center in about 0.9 seconds and converged from 21,754 km to 340 m. Five repeated entry/return cycles completed without accumulating entry work or changing the final handoff. The sampled model center remained on the pivot. These are local browser observations, not a claim of physical station-scale accuracy.

A temporary development-only rapid poll of the real backend swapped the active sampled window several times during a single approach, including responses generated at 17:51:03, 17:51:05 and 17:51:07 UTC on 2026-09-29. Measured camera range continued downward from 16,514 km to 403 m with the ISS at or close to screen center and no Earth occlusion. The refresh probe was removed after the test; the normal 120-second poll interval remains in source.

A separate temporary scene-time probe selected a real sample near the end of the existing bounded window, placing the station on the sunlit side at the upper-right of the 1280 × 800 viewport. Range fell from 18,094 km through 7,594 km and 761 km to 423 m; the maximum range reversal across ten recorded samples was 0 m. Normalized screen error fell from 0.248 to 0.001 within about 0.8 seconds, then remained at center. Earth occlusion stayed false. The probe was removed; the production clock remains backend-aligned. Normal browser runs also covered the night side and the moving terminator.

## Selectable trajectory source — 2026-09-30

`selectedPositionAt` supplies the same physical point to the model, progressive approach, Earth-occlusion checks and moving ENU camera pivot. PRIMARY reads the original short computed buffer; NASA OEM reads its separately bounded predicted ITRF property. Selection is immediate and never blends the two products. The selector is enabled only in `EARTH_OVERVIEW`, locked in `ENTERING_INSPECTION`, `ISS_INSPECTION` and `EXITING_INSPECTION`. Back preserves a still-valid selected source and unlocks switching only after return completes.

OEM source or sample coverage loss, response expiry or failed delivery exits Inspection and explicitly selects primary with a visible notice; there is no held last OEM point or extrapolation. Normal refreshed buffers slightly ahead of the scene clock retain their valid predecessor until the new buffer covers scene time, avoiding a false loss during Inspection. Primary buffer expiry remains the mandatory no-position gate.

Overview minimum footprint is **80 pixels**, rising smoothly to **158** during entry and returning to 80 over the existing 1.2-second exit. The model remains NOT TO SCALE. Following the user's rejection of smaller-only, controlled trials selected a **75 km model-only WGS84-normal display lift**. The camera always approaches the true selected physical position. A smoothstep removal reaches zero in the first 35% / 1.75 seconds of the five-second entry, before close range. The final model and moving pivot coincide with the selected physical position. Back restores lift smoothly, including an interrupted entry. That prior milestone had no silhouette. Both builds measured **0 m camera-position handoff discontinuity**, below 8×10⁻¹¹° direction/up change, and **0 m pivot error** for both sources. Model/physical residual was below 2×10⁻⁹ m. See the [measured handoffs and partial-entry Back](trajectory-fix-review/README.md#f--inspection-and-browser-matrix). Both forward trails hide in Inspection. Direct model entry, semantic picking and hidden-until-textures/features-ready lifecycle are retained. The [current browser record](orbital-trajectory-rendering.md) covers both sources and handoff observations.

## Adaptive presentation and lift isolation — 2026-09-30

A white 0.5-size / 0.12-alpha silhouette now remains in ready Overview. Both size and alpha follow the same early smoothstep removal as the 75 km model-only lift, reaching zero by 1.75 seconds of the existing five-second entry. Inspection retains the natural NASA PBR response. Back captures the current lift and silhouette visibility, then eases both to their Overview values over 1.2 seconds. Partial-entry Back has continuous starting values. Minimum footprint remains 80→158→80.

The selected physical point always drives approach, Earth-occlusion checks and final moving ENU pivot. `modelDisplayPosition` accepts only a distinct output object and rejects aliasing the canonical physical input. Deterministic tests and browser lift-on/off observations cover both GP/TLE and OEM, including unchanged UTC, physical altitude and trajectory-vertex hash. Physical backend velocities are computed independently of the renderer. Adaptive trail searches and masks run only for Overview; no trajectories or silhouette remain in Inspection. [Current handoffs and browser evidence](trajectory-presentation-review/README.md).


## Replay integration — 2026-10-03

Historical position/velocity uses the separate [Mission Replay contract](../api/replay-api.md) at the exact requested UTC epoch. Current delivery remains current; Replay hides current paths and pauses the scene. The accepted model, shader, visual-frame and camera/Inspection machinery is retained. [Validation](../replay/validation/README.md).
