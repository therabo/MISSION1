# Earth View camera and useful-detail envelope

Implemented 2026-10-16, from the two user-supplied desktop screenshots. EarthView
still owns one Viewer and the native Cesium interaction controller. These are
camera interaction and useful-detail bounds, never global object-visibility bounds.

## Reference measurement

The original PNGs are 2880×1800. Browser chrome occupies the first 180 pixels;
the application canvas is 2880×1620 (1440×810 CSS at DPR 2). Header/footer are
overlays, not subtractions from the lens. A runtime probe of the accepted build
confirms the existing 60° longer-side perspective FOV, zero principal-point
offset, 0.1m near plane and 10^10m far plane.

The first image is maximum zoom-out (A); the second is maximum zoom-in (B).
Robust limb fits exclude the cyan trajectory, stars and UI. A's dark hemisphere
precludes a reliable complete ellipse: its visible limb gives a circular fit of
374.844px diameter, 0.867px residual RMS. B includes independently detected day
and shadow limbs, yielding a 2680.183px horizontal diameter, 0.626px RMS. Rounded
to whole measured pixels, the calibration diameters are **375px and 2680px**.
The corresponding longer-side fractions are 0.1302083333 and 0.9305555556.
The photographic/atmospheric edge and WGS84 shape limit precision; these are
approximate visual matches, not recovered exact historical camera poses.

For a perspective tangent sphere of WGS84 equatorial radius R=6,378,137m, FOV F
and apparent diameter / longer canvas side q:

```
projectedRadius = focalLength × R / sqrt(distance² − R²)
height = R × (sqrt(1 + 1 / (q × tan(F/2))²) − 1)
```

This inverts the actual measured framing, rather than choosing distances or
wheel counts. The resulting fixed **WGS84 geodetic camera-height** limits are:

| Limit | Height above ellipsoid | Equatorial centre distance |
| --- | ---: | ---: |
| A / maximum zoom-out | 78,704,202.447202m | 85,082,339.447202m |
| B / maximum zoom-in | 7,098,413.244216m | 13,476,550.244216m |

Centre distance varies slightly with latitude because WGS84 is an ellipsoid;
geodetic height is the enforced metric. No scientific ISS position is involved.
An independent WGS84 tangent-conic projection at the reconstructed reference-region
pose gives 375.056px and 2681.791px horizontal diameters: within 0.1% of both
measured fits. Full camera manifests retain the reconstructed world basis/lens.
The screenshots do not uniquely determine Cartesian position, full basis or
camera latitude/longitude. The external evidence records measured limb centres
and reconstructed compatible camera manifests, not invented original vectors.

## Responsive and input ownership

The existing longer-side 60° lens and full-screen projection are unchanged.
Landscape uses horizontal FOV; portrait uses vertical FOV. Thus Earth prominence
scales with the longer viewport dimension, rather than a fixed CSS-pixel size.
There is one physical range for desktop, tablet and phone, with the accepted
portrait cropping at close Earth scale. Resize changes neither physical range
nor Reset geometry.

`earthCameraEnvelope.ts` installs public controller minimum/maximum settings
before `inspectionControlProfile` captures the Earth profile. Native wheel,
fractional trackpad-equivalent wheel, right-drag and touch/pinch retain Cesium's
input handling and inertia. In pinned Cesium 1.145, `zoom3D` uses geodetic height
above the terrain-picking threshold, while `handleZoom` multiplies its minimum
by `clamp(abs(dot(unitPosition,direction)), .25, 1)`. Public `Scene.preUpdate`
compensates that factor before native input; otherwise a nadir WGS84 test crossed
the near bound by 36.84m. Public `Scene.preRender` bounds residual off-axis/rotation
movement before Globe refinement and drawing. It changes only position when
outside the range; there is no corrective flight, scheduler or visible overshoot.

Toolbar +/- retain their native straight-line 20% step inside the range and
truncate a boundary-crossing step before movement. Repeated forbidden button
input invokes no camera operation. Rotating at either limit remains supported.

Both callbacks run only while Earth owns the camera and inputs are enabled.
The existing Inspection profile independently owns entry, 35–2000m controls,
90m / 42.5° / 100° desktop endpoint, portrait widening, orbit/pivot and exit.
Earth constraints resume only on `EXIT_COMPLETE`. Temporary startup Sun/Moon
preparation locks inputs, so its distant camera draws remain unrestricted.

The accepted Earth Reset endpoint is strictly inside the range: **17,000,000m**,
selected-source scene-time position, nadir/north-up, held lens, original 2.5s
transition. Its implementation is unchanged. It retains its temporary input
lock and exact endpoint from either limit, rotation and Inspection return.

## Work and resources

Camera enforcement precedes Globe refinement, preventing the newly unreachable
close-camera states from triggering finer Earth work. Existing Cesium screen-space
error selection already requests only useful visible detail at each allowed pose.
At the controlled 1440×900 DPR2 B pose, Globe reaches level 3 and GIBS imagery
level 4; both match the unbounded baseline placed at the same pose. Global day
and night providers retain their verified maximum level 8. Lowering that shared
provider cap would also affect Inspection and larger future viewports; it adds
no demonstrated savings inside the measured envelope. No extra LOD cap is used.
The former unbounded build at a diagnostic 100km camera height selects Globe
level 9 / imagery level 8. That Earth-only camera state is now unreachable.

The WGS84 EllipsoidTerrainProvider generates small flat tiles locally: there is
no terrain acquisition. Globe SSE=2, cache=100, ancestor preload=true and sibling
preload=false remain unchanged. Ancestors support refinement and fallback;
geographically new tiles still load during rotation. There is no ISS-centred
crop, fixed geographic cache or camera-dependent scientific API policy.

| Resource | Classification and result |
| --- | --- |
| Globe geometry | Detail-dependent; naturally bounded by distance/SSE; no terrain HTTP |
| NASA GIBS day/night | Render-essential and detail-dependent; same global providers, retries, fallback and sampling |
| Local Natural Earth II / Black Marble | Render-essential bundled fallbacks; already bounded at levels 2 / 0 |
| Clouds | Render-essential; existing 4096×2048 texture, 15km display shell, Current-only automatic revalidation and Historical hiding unchanged |
| NASA VTAD ISS | Render-essential; one existing model/readiness/material/feature owner; no safe unreachable preparation identified; deferred LOD remains deferred |
| GP/OEM trajectories | Render-essential; physical samples, extent, geometry, temporal reveal and presentation updates unchanged |
| Moon | Render-essential / already minimal: native ellipsoid and one bundled 256×128, 18,196-byte moonSmall.jpg texture; no lunar tiles/metadata/polling |
| Sun | Render-essential / already minimal: native procedurally generated texture and native astronomical updates; no remote solar dataset |
| Stars / Milky Way | Render-essential / already minimal: same six bundled 4096² NASA/Tycho faces and scene-time rotation, no ongoing acquisition |
| Orbital/API state | Required independent scientific/UI work; unchanged and independent of framing |
| Auxiliary camera-only acquisition | None found to remove |

Native celestial time/transform evaluation remains necessary for correct display.
Moon, Sun, stars and Milky Way are never hidden because their physical distance
exceeds a camera limit. No far-plane, atmosphere, AA/MSAA/OIT, framebuffer,
postprocess, resolution, asset, cloud-quality or scientific-data change is included.

## Validation and evidence

Focused tests cover inversion, all five viewport lenses, buttons, tilted native
minimum semantics, render guard, cleanup, mode ownership, restored settings,
startup celestial draws and unchanged Reset. Browser evidence and network/LOD
inventories, controlled same-camera/time comparisons, interaction traces, celestial
views and production pacing remain outside Git:

`/Users/daniel/.codex/exports/mission1-earth-view-bounds-2026-10-16/`

The five-viewport browser matrix passes 75 captured states: Current GP/OEM,
automatic retained Historical GP/OEM, wheel/fractional-wheel/native touch pinch,
buttons, both-limit rotation, Reset and responsive Inspection return. Settled
matched B has 38 Globe tiles and 101 transition requests in either build; rotation
has 30 tiles and still acquires new regions at the same levels. There is no settled
network activity. Native input's 1m stop tolerance permits approximately 0.22m
inward numerical settling at the far limit, with no outward overshoot or visible
jitter; the near-limit repeated wheel probe has zero displacement.

This is a reversible policy within the existing camera/graphics owner, with no
new dependency, contract, structural or cross-cutting decision. Existing Earth
architecture documentation is updated; no new ADR is warranted.

Public references, cross-checked against installed Cesium 1.145 sources:
[controller](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html),
[Globe](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html),
[perspective frustum](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html).
