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

Render only `[sceneTime+75s, sceneTime+0.85T]`, shortening OEM at coverage. Public Fabric temporal clipping and inverse smoothstep give exactly zero alpha at the endpoint; no past line or closure is rendered. Both products use coincident halo/body layers and the same continuous language. Selection swaps accent/subdued styling; inactive layers are ordered before active layers. No centerline offsets are allowed. GPU temporal clipping permits uniform-only updates without rebuilding moving geometry.

Lock source controls outside `EARTH_OVERVIEW`. An invalid selected OEM exits Inspection and explicitly returns to primary with a notice. Primary buffer expiry hides the model. Returning from valid Inspection preserves selection. Source availability, GP quality and CelesTrak acquisition health remain separate.

The initial presentation choice reduced Overview minimum pixel size from 96 to 92 and selected smaller-only after +5km lift / subtle-silhouette trials. That zero-lift visual result was subsequently rejected by the user; the dated correction below records the replacement without changing the bounded source-selection architecture. Model scale/attitude semantics and hidden-until-textures/features-ready lifecycle remain.

### Presentation correction — 2026-09-30

Controlled development and production review of `8146055` confirmed correct state/material mutation and selected physical positions, but insufficient visual contrast, gap, size reduction and Earth separation. PRIMARY and OEM active accents are now cyan `#53d9cd` and amber `#edb86a` (alpha 0.85); inactive alpha is 0.08. The true 75-second source-specific future gap measured about 5 CSS pixels including the halo in the final canonical views. Minimum pixel size is **80**, chosen from 92/88/84/80 trials; physical scale remains 1 and maximumScale 20000.

Only the model receives a **75 km WGS84-normal display lift**, chosen after 2–10 km projected under 0.5 CSS pixels and 25/50/75/100 km extended trials found 75 sufficient. A separate physical position still drives geographic readout, approach and pivot. Lift smoothly reaches zero within the first 1.75 seconds of entry and returns over the existing 1.2-second exit. Inspection handoff is physical with zero positional camera jump for both sources. No silhouette is needed. This reversible presentation correction adds no backend contract, source semantics or infrastructure; a new ADR is unnecessary. Its cost is an explicitly nonphysical model display point in Overview, disclosed in the UI and isolated in code. [Measurements, browser matrix and limits](../frontend/trajectory-fix-review/README.md) preserve the evidence.

## Alternatives considered

| Alternative | Reason not selected |
| --- | --- |
| Permanent GP model and dashed OEM | Does not satisfy source exploration; almost coincident paths obscure identity. |
| Blend positions or separate lines spatially | Invents orbital geometry. |
| OEM extrapolation or last-point hold | Conceals unavailable prediction coverage. |
| Switching during Inspection | Adds pivot/camera handoff cases without a current need. |
| Original smaller-only / zero lift | Initially selected; later user review rejected it. Controlled trials now justify model-only lift, while outline remains unnecessary. |
| New source service or broker | No independent scaling need. |

## Consequences

OEM selection depends on both valid OEM coverage and the mandatory primary buffer. Comparison delivery now also supports a selected visualization position, but does not replace `/iss/state` or claim measured position. OEM display interpolation is linear within delivered ITRF samples; it is separate from backend source-vector Hermite interpolation and is not an accuracy estimate. The geographic panel converts the same selected ITRF scene point through Cesium WGS84, without changing backend state or altitude. Four small polyline primitives replace the former two plus dashed entity. Geometry changes only on response refresh. RTN analysis, Replay and historical trails remain deferred.
