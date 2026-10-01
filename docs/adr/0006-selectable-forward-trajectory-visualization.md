# ADR-0006: Select one bounded trajectory for ISS visualization

- Status: **Accepted**
- Date: **2026-09-30**
- Supersedes: [ADR-0005](0005-separate-nasa-oem-comparison-trajectory.md); its independent adapter/persistence/frame and fetch-policy choices are retained below.
- Scope: visualization source, forward comparison delivery and Inspection target

## Context

GP/TLE propagation and NASA OEM prediction can overlap to within a screen pixel at Earth scale. Dash identity is insufficient, and keeping the model permanently on GP/TLE prevents exploring OEM as a position product. The user explicitly selected a visualization source selector and future-only trails before RTN analytics.

## Decision

Keep GP/TLE mandatory and default. Let accessible Overview controls select `PRIMARY_GP_TLE` or `NASA_OEM`. Selection immediately chooses one bounded sampled physical position for the model, geographic readout, progressive approach and moving Inspection ENU pivot. No interpolation between sources occurs. Selection expresses visualization intent, never correctness or accuracy. NASA remains `SOURCE_PROVIDED_PREDICTED_EPHEMERIS`; GP remains `COMPUTED_FROM_ORBITAL_ELEMENTS`.

Retain the single backend, NASA XML adapter and hash-based PostgreSQL source-file history, separate creation/retrieval/HTTP times, bounded cubic Hermite interpolation in EME2000 and Orekit epoch-specific ITRF conversion. Retain the two-hour successful fetch interval and 15-minute failure backoff as MISSION1 policies. A covered stored prediction can remain `DEGRADED`; coverage loss makes it unusable. No additional infrastructure is introduced.

Keep `/orbit/samples` as the short primary animation buffer. Change `/orbit/comparison` to 181 primary samples from response time through one TLE mean-motion period (`currentSampleIndex=0`). OEM uses the real intersection of that interval and its source vector span, sampled uniformly at no more than 181 points including exact coverage boundaries. Adopt a normal refreshed comparison only when it covers scene time: retain the previous moving, still-valid product across a <=3-second clock-alignment seam. Unavailable or genuinely uncovered new products are adopted immediately. The pre-release frontend and contract change ship together.

Render only `[adaptiveTrueFutureStart, sceneTime+0.85T]`, shortening OEM at coverage. Public Fabric temporal clipping, a rounded alpha/width start ramp and inverse smoothstep give exactly zero alpha at the endpoint; no past line or closure is rendered. Both products use coincident halo/body layers and the same continuous language. Selection swaps accent/subdued styling; inactive layers are ordered before active layers. No centerline offsets are allowed. GPU temporal clipping permits uniform-only updates without rebuilding moving geometry.

Lock source controls outside `EARTH_OVERVIEW`. An invalid selected OEM exits Inspection and explicitly returns to primary with a notice. Primary buffer expiry hides the model. Returning from valid Inspection preserves selection. Source availability, GP quality and CelesTrak acquisition health remain separate.

The initial presentation choice reduced Overview minimum pixel size from 96 to 92 and selected smaller-only after +5km lift / subtle-silhouette trials. That zero-lift visual result was subsequently rejected by the user; the dated correction below records the replacement without changing the bounded source-selection architecture. Model scale/attitude semantics and hidden-until-textures/features-ready lifecycle remain.

### Presentation correction — 2026-09-30

Controlled development and production review of `8146055` confirmed correct state/material mutation and selected physical positions, but insufficient visual contrast, gap, size reduction and Earth separation. PRIMARY and OEM active accents are now cyan `#53d9cd` and amber `#edb86a` (alpha 0.85); inactive alpha is 0.08. The true 75-second source-specific future gap measured about 5 CSS pixels including the halo in the final canonical views. Minimum pixel size is **80**, chosen from 92/88/84/80 trials; physical scale remains 1 and maximumScale 20000.

Only the model receives a **75 km WGS84-normal display lift**, chosen after 2–10 km projected under 0.5 CSS pixels and 25/50/75/100 km extended trials found 75 sufficient. A separate physical position still drives geographic readout, approach and pivot. Lift smoothly reaches zero within the first 1.75 seconds of entry and returns over the existing 1.2-second exit. Inspection handoff is physical with zero positional camera jump for both sources. At that correction silhouette was disabled. This reversible presentation correction adds no backend contract, source semantics or infrastructure; a new ADR is unnecessary. Its cost is an explicitly nonphysical model display point in Overview, disclosed in the UI and isolated in code. [Measurements, browser matrix and limits](../frontend/trajectory-fix-review/README.md) preserve the evidence.

### Adaptive presentation refinement — 2026-09-30

The user subsequently requested rounded starts, a permanent subtle white perimeter and a gap that decreases with zoom. Replace the fixed 75-second presentation rule with a bounded logarithmic smoothstep target of 0.75–4 CSS px using range to the selected displayed ISS. Search each own bounded sampled source for the earliest future projected centerline exit to 1 ms at up to 10 Hz. A public Fabric per-fragment CSS-space mask then protects the complete 20/8 halo/body envelope from the conservative projected model hull plus silhouette; no spatial coordinates change. The alpha/width smoothstep start ramp spans 1–4 projected CSS px. The far-to-close reviewed visible clearances are 6→4.5→3 CSS px for both sources/builds. The 85% horizon, coverage bounds, selected source semantics and ready-group replacement persist.

Use public Model silhouette white, size 0.5 / alpha 0.12, selected from restrained 12-value trials. It is permanent in ready Overview and reaches zero with the lift by 1.75 seconds of entry, restoring smoothly over 1.2 seconds. Lift stays 75 km and minimumPixelSize stays 80. Deterministic and browser on/off tests prove the physical position, altitude, UTC and source vertices are independent of the display translation; physical velocity is computed only in the unchanged backend. Inspection retains the true selected-source ENU pivot. [Measurements and limits](../frontend/trajectory-presentation-review/README.md).

This reverses only presentation tuning within the existing selectable visualization decision; no new ADR or backend contract is needed. Alternatives actually tested were a full-halo radius time threshold and a taper-envelope-only estimate; perspective and lift made close-view gaps grow. The retained public fragment mask supplies a dependable margin without geometry offsets. Costs are a small deterministic fragment loop, lightweight per-frame hull projection and an asset-specific conservative bound that needs revalidation when the pinned GLB changes. This does not promise strict visible-gap ordering for every oblique, occulted or extreme camera pose.

## Alternatives considered

| Alternative | Reason not selected |
| --- | --- |
| Permanent GP model and dashed OEM | Does not satisfy source exploration; almost coincident paths obscure identity. |
| Blend positions or separate lines spatially | Invents orbital geometry. |
| OEM extrapolation or last-point hold | Conceals unavailable prediction coverage. |
| Switching during Inspection | Adds pivot/camera handoff cases without a current need. |
| Original smaller-only / zero lift | Initially selected; later user review rejected it. Controlled trials now justify model-only lift, with outline then disabled; the subsequent requested perimeter is recorded above. |
| New source service or broker | No independent scaling need. |

## Consequences

OEM selection depends on both valid OEM coverage and the mandatory primary buffer. Comparison delivery now also supports a selected visualization position, but does not replace `/iss/state` or claim measured position. OEM display interpolation is linear within delivered ITRF samples; it is separate from backend source-vector Hermite interpolation and is not an accuracy estimate. The geographic panel converts the same selected ITRF scene point through Cesium WGS84, without changing backend state or altitude. Four small polyline primitives replace the former two plus dashed entity. Geometry changes only on response refresh. RTN analysis, Replay and historical trails remain deferred.

### Visual-frame and camera clarification — 2026-09-30

Retain the selected-source physical/display boundary and existing deployment. Deliver the already available GP ITRF velocity and the OEM source-Hermite derivative transformed as full PV through the existing sample DTOs, with explicit m/s units. This small additive contract supplies a visualization need; it does not introduce a new source, persistence boundary, physical attitude model or frontend propagation.

Use one trajectory visual frame for model rotation and the moving physical Inspection pivot. The pinned asset's measured render axes are +X forward/+Z up. Label it `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION`; onboard attitude remains unavailable. Arrive directly rearward at 119 m on canonical desktop (previous 340 m), easing FOV to 85°. Preserve scale 1 and minimum 80; narrow views widen range. Keep native orbit and restrict other navigation; public Inspection-only wheel/pinch actions supply proportional bounded pivot zoom after trials showed native zoomFactor tuning still too slow. Back restores all captured Overview settings/FOV.

Alternatives considered: continuing ENU orientation fails selected tangent/rear alignment; screen-coordinate differencing discards available physical velocity; separate camera/model frames invite inconsistent transforms; raising native zoomFactor alone remains slow with close-range floor semantics; smaller 119→102→85 m framing crops structures increasingly. The chosen 119 m / 85° camera meets closeness with full structural framing. Costs: additional velocity payload, asset-axis dependence, direction-dependent conservative close-range clearance and a small scoped public zoom handler.

This clarifies the existing selectable visualization decision, leaving source architecture and operational boundaries intact; no new ADR is warranted for this reversible presentation extension. [Measured evidence](../frontend/inspection-orientation-review/README.md). RTN analysis and Replay remain deferred.

### Elevated camera and stable rendering refinement — 2026-10-01

Replace the 119 m horizontal camera with 90 m slant range at 42.5° rear elevation, with 100° FOV and narrow-aspect widening. The lower FOV used in the previous horizontal composition clips the newly elevated opening view. Entry and exit now use one 5-second monotonic quintic pose pipeline, selected-source moving-frame evaluation, coordinated presentation and interrupted-entry tangents. Overview pose, FOV, near/far and controller settings restore exactly. Source state, model scale, lift isolation, semantic identities and delivery are unchanged.

Generate the approximate Cesium ambient environment once rather than invalidating it every 1 km of orbital/display movement; retain scene-time direct Sun lighting and all source PNG/PBR inputs. Public screen-space specular filtering and MSAA/FXAA address measured highlight/edge aliasing. Restrict ground fog below a 100 km visualization ceiling, compensating its density curve for ordinary ground views, to avoid the measured shader reset at 800 km. Warm the close-view atmosphere while the model is loading and retain a native-resolution FXAA stage with a uniform Overview bypass so mode changes do not recreate GPU resources. Ambient environment capture is approximate and fixed for the Viewer lifetime; it is not an attitude/illumination product. Rejected alternatives include disabling mipmaps, global material flattening, normal-map removal, private sampler patches and rewriting NASA geometry. The retained postprocess output and imperceptible outline pass have measurable GPU cost; the matched review records lower steady FPS alongside fewer long transition stalls, with residual subpixel shimmer. They do not guarantee a 50 ms frame budget. No new ADR is necessary for these reversible presentation controls. [Evidence and limits](../frontend/inspection-rendering-optimization-review/README.md). RTN and Replay remain deferred.


### Perceptual transition pacing clarification — 2026-10-01

The strict constant-metres-per-second candidate was reproduced and rejected: a roughly 17,227 km path in 5 seconds left the last kilometre to about 0.29 ms, concentrating apparent growth in the final frame. Retain its cubic geometry and displayed-target composition, but invert a normalized hybrid metric (20% log lens distance, 60% inverse lens distance, 20% route viewing-direction travel). Lens distance incorporates displayed-target range and perspective FOV. A 1024-interval C1 inverse and C2 temporal rate ramps avoid per-frame projection work. Entry is 6 seconds; exit 5. Physical speed intentionally varies. Range coordinates FOV, model-only lift and outline. Actual incoming camera derivatives support partial Back; exact world pose, frustum, transform and controllers restore.

On OEM unavailability, physical GP selection and provenance switch immediately. A shared camera/model display translation settles over 0.8 seconds during the return, preserving close-view composition without source-sample interpolation. This is temporary presentation state; stable Inspection, physical velocity, geographic readout and trajectories use the selected physical source. No attitude is inferred. Alternatives rejected: constant arc-length traversal (scale pop), pure apparent-size timing (far steering whip), independent lift/FOV timers (composition mismatch), and screen-space projections on every frame (unnecessary work). The hybrid keeps the original cubic geometry and rendering policy. This reversible refinement needs no new ADR or infrastructure. [Evidence and limitations](../frontend/camera-transition-perfecting-review/perceptual/README.md); RTN remains deferred.
