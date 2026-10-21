# MISSION1 Earth View

Earth View and ISS Inspection share one informational bottom bar:
**Latitude | Longitude | Altitude | Over**. Both use identical typography,
spacing and four desktop columns, with a 2×2 mobile layout. The visible ISS / WGS84,
ISS / Inspection identities and General Perturbations quality status/detail
presentation are removed. WGS84 and GP/TLE scientific quality/provenance remain
in their existing state/contracts; physical values keep the accepted formatter
and exclude Overview's display lift. Over now classifies that same accepted physical
state against pinned local Natural Earth country 10m 5.1.1 geometry, with individual
local SVG flags displayed directly at 24 px height and automatic native width,
without a common shape, frame, background, distortion or cropping. Only country no-country
falls through to a separate local marine 10m 5.1.0 catalog and 16 approved macro
names, rendered as text only. Country diagnostics never fall through; marine
readiness never blocks a country. No-region, ambiguity or unavailable geography
displays —. All geographic names have at most two visible lines. Both assets
start in parallel once after render. Historical uses coherent accepted state
against the fixed installed catalogs. [Over contract and provenance](../docs/frontend/over-country.md). Operational
failure notices remain outside the bar. [Shared contract](../docs/frontend/position-status-bar.md).

Earth zoom is bounded to the two measured user references through the existing
camera owner. The shared range preserves Reset, independent Inspection, global
Earth imagery and distant celestial visuals.
[Derivation, responsive behavior and useful-detail audit](../docs/frontend/earth-camera-envelope.md).

Earth includes an optional WGS84 cloud shell with automatically revalidated
8192×4096 processed EUMETSAT-derived imagery and subdued night-side visibility.
It is always hidden in Historical;
source failure retains the last good image or leaves Earth cloud-free. The NASA
Tycho Milky Way treatment is generated offline at unchanged 4096² cube resolution.
[Source, rights, refresh, generation and lifecycle](../docs/frontend/clouds-and-milky-way.md)
· [ADR-0026](../docs/adr/0026-current-only-optional-cloud-imagery.md).

Component telemetry populates the existing ModuleInfo/ContextDock. Selected Current
records refresh through local REST every 60 seconds while visible; Historical uses
the accepted UTC and does not poll. Each value retains its Last telemetry record date.
The card emphasizes Function and recorded engineering/state readings; raw channels
and definitions without observations are omitted. Supporting technical detail keeps
module/asset identifiers and one compact telemetry source entry. Configuration context
and the model/reference footer are removed from this presentation. Navigation and
camera behavior are unchanged. [Contract and limits](../docs/telemetry/module-telemetry.md).
**Telemetry source** shows **ISS Live · Lightstreamer** and one **Source ↗** link to
the [official demo](https://demos.lightstreamer.com/ISSLive/), reusing the verified
`lightstreamer_live_demo` URL in the source registry. No nested source disclosures,
per-parameter evidence links or technical provenance are shown here; full precision,
source/retainer metadata and evidence remain in the API and internal systems.
The card also omits Limitations /
availability, the bottom numbered module name, identity verification date and display
scale note; source metadata, mappings and model rendering remain intact.

The public database rebaseline changes only Historical's development-era wire label
to `UNIFIED_HISTORICAL` and its profile-policy terminology. REST fields, rendering,
geometry and controls remain unchanged. [Publication validation](../docs/architecture/database-publication-baseline.md).

Current production uses `CurrentCrewWorkspace` → `CurrentCrewPanelView` /
`ReplayCrewPanel`, with shared `CrewSourceEvidence` and `CrewProfile`.
`TrajectorySelector` is the context-bar source selector; `PositionStatusBar` supplies
the shared physical readouts. `OrbitalNotice` / `HistoricalOrbitNotice` retain real
operational failure notices without the removed quality status/detail UI. `HistoricalTimeBar` and
`HistoricalCalendar` own Historical navigation. Earth Reset and Inspection retain
their accepted separate responsibilities.

[Current architecture](../docs/architecture/current-production.md) ·
[Cleanup inventory and checks](../docs/maintenance/production-code-cleanup.md).
The dated validation sections below remain historical records.

**Earth Reset correction — 2026-10-13:** tracing the actual visible Earth control
proved the earlier 0.8s/2.5s changes affected an added Inspection Reset instead.
Inspection is restored to e82ad438 behavior without that button; branding/Crew
work is preserved. Earth now returns progressively in 2.5s from its actual pose,
with coordinated C2 position/clearance/orientation, held FOV/transform and the
existing 17,000km geodetic-height/nadir/north-up endpoint policy. The reference
uses accepted selected-source scene state, fixing the former retained Current
GP lookup in Historical/OEM. Actual UI clicks, rendered-camera traces and
normal-speed videos cover Current/Historical and both builds.
[Root cause, restoration and validation](../docs/frontend/branding-crew-simplification/README.md#actual-earth-reset-correction-and-selective-inspection-restoration--2026-10-13).

**Unified Crew Historical — 2026-10-12:** modern Historical consumes backend UNIFIED_HISTORICAL membership metadata, labels every returned human Member at Historical UTC, and separates assignment/operational evidence at T from latest canonical biography/career. Annotation age uses accepted T; no Current roster/profile lifecycle fallback occurs. Current retains120-second visible serial polling; Historical pauses it. Date picker, ±10-minute navigation, <=716 detail/back behavior and native Cesium/Inspection ownership remain intact. Confidence/scoring stays private. Missing membership metadata is legacy rollback rendering only. [Final validation](../docs/crew/final-crew-architecture-validation/README.md).


## Responsive restyling — 2026-10-08

The accepted 1440×900 desktop layout remains the visual reference. Current/Historical navigation, summary, Crew and detail surfaces use the existing content-driven flex/grid and roster container queries. Compact controls retain 44px heights; long content scrolls inside its information surface while the `100dvh` shell and Cesium canvas remain full-screen. The Historical calendar is bounded to the actual scene row with one compact date/time scroll owner and reachable Close/Apply actions. Native compact attribution owns the foreground above chrome. Resizing retains source, member/module selection and accepted UTC; camera, graphics and data contracts are unchanged. See the [complete responsive inventory, golden comparison and browser dossier](../docs/frontend/ui-restyling-responsive/README.md).

## Rendering quality restoration — 2026-10-05

The current policy explicitly enables browser WebGL antialiasing (`contextOptions.webgl.antialias=true`) alongside Cesium MSAA 4 and the existing FXAA behavior. Both tiled and local Black Marble night layers use brightness **1.8**, gamma 1 and contrast 1. Native DPR/resolutionScale, 4K Tycho stars, ISS PNG/PBR, trajectory geometry, camera, full-screen occlusion-aware framing and progressive loading/retries remain unchanged. Visual quality takes priority over the measured extra GPU cost. [Matched comparisons, performance and validation](../docs/frontend/rendering-quality-restoration/README.md).

The two settings in the preceding performance milestone are superseded; its dated measurements remain historical.

## High-fidelity rendering and measured performance — 2026-10-04

The current rendering policy preserves the full NASA VTAD PNG/PBR model and the accepted camera, trajectory and full-screen occlusion-aware geometry. NASA SVS Tycho II now uses its verified 16K TIFF source and six seam-checked 4096² lossless WebP cube faces. Blue Marble August 2004 and Black Marble 2016 remain fixed historical imagery; independent probes refine local day/night layers, with at most two retries per failing tile rather than removing a whole high-detail layer. Night brightness is 1.15 (formerly 1.8), with neutral contrast/gamma and no invented emission.

Stars refine the bundled skybox after ISS texture, feature and first-use shader readiness; this measured ordering protects first Earth/ISS use. The maximum-quality configuration is fixed, including native DPR, existing low-DPR supersampling and Cesium MSAA 4. The reference Apple M1 does not reach the requested 60 FPS; the dossier reports actual performance without a reduced-quality fallback being presented as a pass.

Cesium MSAA 4, retained mode-aware FXAA, atmosphere, native DPR and low-DPR 1.25 supersampling remain. Only redundant browser drawing-buffer antialiasing is disabled; the resolved image still receives Cesium AA. Maximum quality is fixed, without an adaptive resolution controller. The 60 FPS target is **not achieved** on the reference M1 Air; the [complete measured report, source inventory, loading tradeoff and reproducible QA](../docs/frontend/high-fidelity-rendering-performance/README.md) documents the real result. No dashboard restyling, backend/data change, texture upscaling or geometry decimation was performed. Earlier dated records below retain historical settings.


## Occlusion-aware full-screen framing — 2026-10-04

Cesium remains full-screen. In left-dashboard layouts, the dashboard is treated
as an occluding overlay and focal composition is derived dynamically from the
remaining visible area. Its actual clipped width, height and position determine
the free-area centroid; margins and space below it stay in the scene. Bottom or
hidden panels retain normal full-viewport horizontal centering. Public perspective
frustum offsets and a pinned Cesium input/pixel-scale/globe-ray compatibility adapter
preserve the accepted physical camera and apparent scale. [Correction, native
picking tests and evidence](../docs/frontend/occlusion-aware-workspace-centering/README.md).

## Application branding and Crew presentation — 2026-10-12

The application and root README share one canonical user-supplied
[`public/branding/MISSION1-logo.png`](public/branding/MISSION1-logo.png).
The final replacement uses the new `MISSION1-logo.png` exactly as supplied:
RGBA PNG, 2172×724, existing alpha preserved, SHA-256
`1e24b1ad4e9f0a79eb1f8a85e2ce7d0d3aeb8ee1935e62f305542350d5e3339f`.
It is an exact byte copy, without crop, trim, segmentation or recoloring.
README's repository-relative path and App's Vite base-relative path stay unchanged;
standalone builds include the same public asset. The intrinsic 3:1 ratio,
120×40px image box, `object-fit: contain`, navigation height and Cesium canvas
geometry remain accepted. Earlier conversion records are historical.

Current Crew shows Current members and the latest successful source fetch on one
summary row above the divider. The essential **Data source** accordion follows all
astronauts and restores the prior native, initially collapsed details/summary
interaction, marker and keyboard/focus behavior. Its LL2 and NASA groups each expose successful fetch, source state,
original observation, publication or Unavailable, and their actual source link;
Reconciled remains dynamic. Current and Historical detail emphasize Structured
assignment, Role followed by Nationality, Career and retained profile information.
Membership/presence explanatory blocks, assignment/cumulative disclaimers and the
portrait-rights disclosure are removed from detail presentation. The correction
also removes Profile context and Profile observation, including the shared original
profile-observation timestamp in Current/Historical evidence. The unavailable
reuse-permission caption and its dedicated row are also removed. Portrait permission
checks and metadata remain intact. Historical still uses its accepted roster and
assignment at UTC T, separately from latest canonical biography/career.

This supersedes the older visible Crew/branding descriptions below and in the
[dated panel review](../docs/frontend/crew-earth-view-panel-review/README.md).
Polling, UUID selection, error/Retry, <=716px detail Back/Close, backend/API and
V7/S10/V10 semantics are unchanged. [Validation and asset provenance](../docs/frontend/branding-crew-simplification/README.md).

## Cesium attribution audit — 2026-10-04

**Verdict: `ION_ATTRIBUTION_NOT_REQUIRED`.** Installed CesiumJS 1.145.0 uses
direct NASA GIBS imagery, existing local imagery/model/skybox assets and
`EllipsoidTerrainProvider`; geocoding is disabled. There is no configured ion
token, ion imagery/terrain/Asset Depot dependency or observed ion service request
in the development/production audit. The library's bundled default token is unused.
`src/main.tsx` sets the documented public `CreditDisplay.cesiumCredit` to an empty
`Credit` before Viewer creation, removing only the default combined Cesium ion logo.
The visible NASA VTAD model acknowledgment and **Data attribution** popup with
NASA imagery/star-map acknowledgments remain intact. No credit container, CSS,
provider or scene logic is changed. [Provider terms, exact credit inventory,
network evidence and before/after screenshots](../docs/frontend/cesium-attribution-audit/README.md).

**Backend scheduling note (2026-10-03):** [Crew event-aware refresh](../docs/crew/event-aware-refresh.md) changes background backend source eligibility. Frontend runtime and accepted Crew API contract are byte-identical to the Crew panel baseline; source quality, presence and assignment distinctions remain unchanged. Historical visual evidence below is retained. Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

## ISS Crew Earth View panel — 2026-10-03

Open **ISS Crew** in the existing ISS orbital-information surface, in Overview or Inspection. Crew is a bounded DOM panel in the same Earth View; opening it issues no camera command. Selecting a mapped station module closes Crew so the two detail surfaces cannot overlap. Closing Crew restores keyboard focus to its launcher. Escape returns from a person to their card, then closes the list; the existing Earth/ISS Back control remains separate.

`api/crewApi.ts` consumes the [implemented MISSION1 contract](../docs/api/crew-api.md), with explicit nullable types/runtime decoding in `crew/`. One `GET /api/iss/crew` loads the list. A resolved person opens one lazy `GET /api/iss/crew/{MISSION1 UUID}`. The client supports `/api/iss/expedition/current`, but this panel does not request it: the collection already carries its exact structured Expedition context. Hooks own cancellable HTTP state; the memoized CrewPanel owns selected detail state. There is no new global state library, polling timer, Cesium dependency, or provider acquisition/parsing/reconciliation in the frontend. Source/media hyperlinks are references; exact-person HTTPS portraits use the [dynamic portrait policy](../docs/crew/portraits.md): the compact roster prefers the attached thumbnail; the personal portrait in a stable shared 877:1000 viewport using centered cover fit prefers the same person’s original. Both retain the existing same-person candidate fallback and initials. Rights metadata is preserved, not a universal rendering gate.

The main view separates official current count, confirmed identities, retained count, unidentified gap, assignment count and unresolved assertion entries. Roles come from backend assignment codes; NASA-only confirmed identities are **Other confirmed crew**, without invented roles. Unresolved reports have no profile button or UUID. All eight backend quality states retain text labels, with expandable explanations and source/freshness detail. The displayed assessment is explicitly as of the response; Refresh obtains a new backend evaluation. HTTP errors remain local to Crew, and useful prior responses remain visibly dated on refresh failure.

Person detail shows assignment separately from presence, safe plain-text biography, nationalities, source cumulative career totals with deterministic ISO elapsed-duration formatting, profile/source timestamps and active photo credit once directly below the large portrait, omitted when unavailable. Mission metadata contains no photo credit. Missing structured NASA-only fields remain unavailable. Exhausted/unsafe portraits use initials; no images are mirrored. Future people with usable attached provider media need no bundled image or per-person code entry. Biography text is directly visible under Biography, including long content, and wraps inside the vertically scrolling detail card.

Desktop uses a 344 px side panel (310 px on narrow desktop). Tablet widths 721–820 px use a compact 430 px bottom drawer; mobile uses a sheet with safe-area spacing and at most 58dvh/520 px. Orbital information is temporarily hidden underneath the Crew drawer/sheet, then restored. Earth pointers outside the surface, source controls and Back remain accessible; the document does not scroll. Crew controls use visible focus and 44 px minimum touch targets.

Validation: 269 tests/30 files, typecheck/build, real API and development/production browser checks. `jsdom` is a test-only dependency. [Native screenshots, state/error matrices, measured request/latency/frame/lifecycle results and limits](../docs/frontend/crew-earth-view-panel-review/README.md). Camera/orbital/rendering source and assets remain byte-identical. No events, automatic refresh, notifications, history/admin or Replay UI are added. Next single Crew milestone: **ISS CREW EVENT-AWARE REFRESH**; independent orbital RTN remains pending.

## Night-side protection and rounded trajectory joins — 2026-10-03

The station protection mask now checks visibility per fragment at the Earth limb, and retained trajectory segments render rounded joins without halo overdraw. Physical data, origin/reveal policy, camera and graphics quality remain unchanged. [Screenshot reproductions, isolation, native raster, GPU property tests and matched regression evidence](../docs/frontend/trajectory-rendering-artifact-review/dark-side-oblique-fixes/README.md). Earlier dated sections preserve the accepted rendering history.

## Trajectory rendering correction — 2026-10-02

The renderer retains camera-independent physical paths and the exact future horizon. Each `preRender` uses the current camera/source/UTC/model snapshot for a bounded first temporal exit, curved local re-entry mask and capsule coverage of both layers. An ambiguous start never hides the safe far body. The local search also handles an exit before the next projection crosses the camera plane. Camera, assets, quality, source interpolation and provenance remain frozen. [Classification, physical invariants, native raster traces, independent fast-motion tests, performance and regressions](../docs/frontend/trajectory-rendering-artifact-review/final-candidate/README.md). Earlier dated trajectory start/mask descriptions are historical; the original failed investigation remains preserved.

## Progressive Inspection Reset view — 2026-10-12

The original 0.8s implementation below is superseded by the perceptual correction:
Reset uses a **2.5-second** C2 ease-in/ease-out timeline. A full click-path audit
and browser camera spies confirm no pre-animation camera movement. The actual
local pose, basis and FOV are captured before interpolation; position, radial
orbit, log range, roll and FOV retain the same coordinated progress. Current and
Historical follow their own accepted physical frame and UTC, including legitimate
backend-selected Historical OEM. Native interruption/restart, responsive target,
accepted framing and entry/exit remain unchanged. [Root cause and validation](../docs/frontend/branding-crew-simplification/README.md#reset-view-softness-correction--2026-10-12).

Earlier implementation record:

Inspection exposes Reset view through the existing camera-control bridge. One
0.8-second C2 smootherstep transports the actual camera basis along the shortest
local radial arc while unwinding roll and interpolating logarithmic range in the
same moving selected-source frame as the ISS. A capture-time clearance preflight
keeps close outward resets monotone without changing the model bounds. It keeps the accepted responsive rear offset, 42.5° elevation,
100° FOV, physical pivot, projection offsets and model scale. Current and Historical
share the same Viewer tick and algorithm; Reset never selects a source or UTC.
Wheel/pinch/orbit cancels at the current pose, including roll; repeated presses
replace the one reset. Resize cancels without recentering; the next reset captures
its new responsive target. Entry, Back and Earth Reset keep their existing behavior.
[Implementation, validation and source limits](../docs/frontend/branding-crew-simplification/README.md).

## Inspection range and trajectory clearance audit — 2026-10-02

Runtime measurement confirms the accepted desktop endpoint was already **90 m / 42.5° / 100°**, about the selected physical Inspection pivot; camera code stays unchanged. The temporal trail start now clears the downstream edge of the displayed-model hull along its own projected future direction. Visible automatic transitions refresh that start every frame; Overview retains the 10 Hz search. Physical vertices and reveal policy stay unchanged. [Diagnosis and regression evidence](../docs/frontend/final-graphics-regression-fixes/README.md).

## Trajectory visibility during Inspection transitions — 2026-10-02

The accepted `c3d24ae` camera/focus/path/clock/readiness remains frozen. A single retained `trajectoryTransitionVisibility` multiplies existing selected/inactive halo/body alpha in both directions: stable Inspection is zero; close departure stays hidden; Earth Overview is one. During entry/exit, C2 smootherstep over log camera-to-displayed-ISS range reveals between **100 km and 10,000 km**. The far edge is capped at the captured actual Overview range; the hidden edge is `min(100 km, farEdge/2)` for nearer starts. It does not use a timeline threshold or immediately show/hide at a mode assignment. Both products share the policy. Existing clearance/mask updates run only while opacity is nonzero, retaining their geometry and source-specific search; automatic visible transitions now refresh the start each frame, while Overview keeps the 10 Hz bound. No camera tuning, source contract, shader/asset/texture/quality change or new infrastructure. [Measured windows, frame samples, browser/regression and performance evidence](../docs/frontend/trajectory-transition-visibility-review/README.md). Earlier dated visibility descriptions are historical.

## Explicit camera focus refinement — 2026-10-01

Earth↔ISS now uses an explicit positive focal ray independently of the retained cubic/hybrid position path. It captures the actual Earth composition and actual orbited/zoomed Inspection pose, blends a quaternion rail with smooth angular containment around the displayed station, and retains focal as well as pose derivatives on partial Back. There is no target threshold switch or final recenter. The canonical 90m /42.5° /100° and 6/5s remain; captured range/angle gives bounded durations for other starts. The same selected-source physical frame, lift/silhouette/FOV, native resolution and NASA PNG/PBR asset remain. Automatic motion copies the public world camera basis, avoiding Cesium’s nadir heading/roll conversion. Graphics readiness requires the retained Moon/Sun startup draws and eight model/globe preparation renders; temporary celestial views cannot count toward model readiness. Optional imagery failure retains the existing local fallback. [Focus definition, gates, arbitrary geometry, profiles and evidence](../docs/frontend/camera-transition-perfecting-review/focus-optimization/README.md). The earlier dated records below preserve preceding behavior; the focal model above supersedes their residual-aim composition.

## Perceptual camera transitions — 2026-10-01

The inspected strict-speed candidate is preserved in the [camera transition review](../docs/frontend/camera-transition-perfecting-review/README.md). Its constant metres-per-second traversal was rejected because it concentrated close-up growth in the final frame. The cubic geometry and display-target fix remain; a once-built inverse perceptual table combines normalized log lens distance (20%), inverse lens distance/apparent scale (60%) and viewing-direction travel (20%). A C2 clock ramps its rate during the first/last 10%, with uniform central progression. Physical speed deliberately varies with range. [Frame traces, actual raster footprints, reversals and performance](../docs/frontend/camera-transition-perfecting-review/perceptual/README.md).

## Current Inspection rendering — 2026-10-01

Canonical desktop Inspection is 90 m behind/above the physical selected-source pivot at 42.5° elevation, zero lateral offset and 100° FOV. Entry takes 6 seconds; return takes 5. Both use the retained cubic path, or one Earth-clear arc when required. Partial Back starts at the actual pose and retains incoming position/orientation/FOV derivatives over a range-bounded interval of at most 0.4 seconds. Lift and silhouette follow the same path range; composition targets the actual displayed station. Back restores the captured world pose, frustum, transform and controller profile; narrow viewports adapt range. Inspection has no dedicated orbital panel; physical position is shown directly in its bottom strip. Earth and Inspection share the four-field physical position bar; dedicated quality evidence UI is removed while scientific state remains.

The unchanged NASA PNG model uses generated trilinear mipmaps. A stable captured ambient environment avoids shader regeneration on each kilometre of orbital/display motion; direct Sun and Earth lighting still follow UTC. Bounded specular antialiasing and MSAA 4 + retained FXAA (bypassed in Overview) address measured highlight and thin-edge shimmer at native device resolution. Ground fog is confined below 100 km (with compensated ground density), avoiding the model shader rebuild at Cesium's default 800 km ceiling. Close-view atmospheric shaders warm during model loading, including the zero-imagery variant that caused a measured first-return compile stall. Public layer alpha and atmosphere fade fields restore before Inspection is enabled; providers, cached textures and final quality are retained. A retained native-resolution FXAA stage uses a uniform bypass in Overview, so changing modes does not destroy/reallocate its GPU resources. No geometry, asset swap, orbital contract or source semantics changed. [Framing, diagnosis, raw performance and remaining limits](../docs/frontend/inspection-rendering-optimization-review/README.md). Earlier dated camera figures below are historical.

The Earth View is a React 19 / TypeScript 7 / Vite 8 / CesiumJS 1.145 client. It consumes the [bounded orbital samples contract](../docs/api/orbital-samples.md) for the ISS model and the separate [trajectory comparison contract](../docs/api/orbital-comparison.md) for the two globe lines. It does not fetch orbital elements or propagate an orbit in the browser. The [NASA ISS model record](../docs/frontend/iss-model.md) documents the selected asset, provenance, scale, configuration limits, validation and reproducible optimization.

## Self-hosted installation

Use the [root Quick Start](../README.md). Compose builds the unchanged frontend
with Node 24 and serves static dist through nonroot nginx, including all public
and Cesium assets. `/api` is proxied to the internal backend; Vite is not the user
runtime. No frontend environment file or browser API secret is required.

## Native development

Use Node.js **24.15+ within 24.x** (`.nvmrc` pins the tested 24.21.0 release) and npm 11. From the repository root:

```sh
docker compose -p mission1-dev -f compose.yaml -f compose.dev.yaml up -d --wait postgres
```

In a second terminal, from `backend/`:

```sh
mvn spring-boot:run
```

In a third terminal, from `frontend/`:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The `/api` development proxy points to Spring on `127.0.0.1:8080`. The frontend uses relative `/api/iss/orbit/samples` and `/api/iss/orbit/comparison` requests. No backend CORS setting or frontend API secret is needed. After backend readiness, the normal CelesTrak eligibility check runs promptly. A fresh database can return HTTP 503 and an unavailable orbital state until a real valid set has been acquired; container readiness does not wait for that data. For the browser verification of this milestone, PostgreSQL already contained the verified CelesTrak ISS TLE observation from 2026-09-28 13:58:32 UTC. The UI labeled its source and element epoch; it was not a production fallback.

## Build and test

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` typechecks and writes `dist/`. `npm run preview` serves that build and proxies `/api` for a local runtime check. The Cesium/Vite configuration uses `vite-plugin-static-copy` to serve Cesium's `Workers`, `Assets`, `Widgets`, and `ThirdParty` under `/cesiumStatic/` in development and copy them into the production build. `CESIUM_BASE_URL` points there. The WGS84 ellipsoid uses tiled NASA GIBS Blue Marble: Next Generation day imagery and fixed 2016 Black Marble night imagery. Bundled Natural Earth II and the 779,638-byte local Black Marble JPEG remain outage fallbacks. Credits remain visible; no Cesium ion imagery, terrain or token is required. The six local NASA Tycho skybox faces are served from `public/skybox/`. Their sources and hashes are in [the rendering record](../docs/frontend/rendering-quality.md).

The 32.7 MB semantically enriched NASA GLB uses deduplicated, lossless source PNG textures and is served at `/models/iss-vtad-source-png.glb` from `public/models/` in development and copied by Vite to `dist/models/` for production. It has no external texture requests. The model preloads at Viewer start with texture streaming disabled, stays hidden until geometry, textures and semantic nodes are ready, and persists across camera modes. A missing GLB leaves the orbital marker and path usable; model state is reported separately. The desktop quality policy uses device pixels, 4× MSAA where supported, and a small low-DPI resolution increase. See [renderer settings and hardware observations](../docs/frontend/rendering-quality.md).

## Time, provenance, and failure behavior

The browser validates frame (`ITRF_2020_IERS_2010`), meters, timestamps, uniform grids, bounded positions and source lineage. The primary short buffer uses linear degree-one `SampledPositionProperty(FIXED)` with no extrapolation. Optional OEM has its own bounded property from backend source-vector Hermite/ITRF samples. `selectedPositionAt` is the single physical source for model, loading locator, approach and moving Inspection pivot. Selection is immediate with no cross-source interpolation.

The backend-aligned 1× scene clock starts at `generatedAt` plus half request duration. The shared position bar shows the accepted WGS84 physical coordinates for the selected scene/source, with the existing UTC/source context retained in the top bar; backend geographic/orbital state is unchanged. Requests refresh separately every 120 seconds after completion. Primary failure retains a labeled bounded buffer; expiry hides the pose and exits Inspection. Comparison failure hides the lines and explicitly returns selected OEM to primary. A normal slightly-ahead refreshed comparison waits on its preceding still-valid moving buffer until covered, preventing a false OEM loss at a clock seam. True unavailability is adopted immediately.

Overview's accessible **Position / trajectory source** selector defaults to **MISSION1 GP/TLE**, with **NASA OEM** available only within source and sample coverage and the 300 s response display limit. Covered `DEGRADED` OEM is allowed with its status visible. Source controls lock during entry, Inspection and return. Selection is not persisted across sessions. OEM remains **NASA predicted ephemeris**; primary remains computed from orbital elements. GP quality, CelesTrak acquisition and OEM availability remain independent.

The GLB remains **NOT TO SCALE**, with `minimumPixelSize: 80`, `maximumScale: 20000` and physical asset scale 1. Controlled 92/88/84/80 trials selected 80. The model alone receives a **75 km display-only lift along the selected physical point's WGS84 normal** in Overview. Trials at 2/5/8/10 km projected below 0.5 CSS pixel; 25/50/75/100 km selected 75 as the smallest tested lift giving several pixels of extra limb clearance. Physical readout, trajectories and the stable Inspection pivot never receive it. Lift and white silhouette (size 0.5 / alpha 0.12) disappear over the path's 1,000→100 km far range and return over 100→1,000 km, including captured partial-entry values. Camera composition follows the displayed target throughout. OEM unavailability switches physical selection immediately to GP; a shared model/camera display translation settles over 0.8 seconds during return, without blending samples, readouts or trajectories. Existing off-origin asset centering remains. The ready model alone is clickable; point/label are loading/error fallbacks with valid selected positions. Orientation is `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION`, attitude `UNAVAILABLE`, and textures/features must be ready before reveal.

## Earth Overview and ISS Inspection

EARTH_OVERVIEW keeps the globe freely navigable, the two continuous forward trails visible when available, and the display-enhanced ISS model visible. Click the ready ISS model, or use Inspect ISS, to enter ENTERING_INSPECTION when the model and orbital buffer are available. One six-second moving-target approach reads the selected bounded SampledPositionProperty at the same scene time as the model on every tick. The camera follows the current trajectory visual F/L/U frame from the captured Overview pose toward the 90 m rear/elevated composition. Earth-unsafe routes use one continuous preflighted arc. MinimumPixelSize remains 80; the camera supplies the gradual close-up. No fixed future flight target, second orbit model or new API is involved.

At arrival, Camera.lookAtTransform adopts the same current F/L/U frame and offset without a visible pose change. The user can drag around the moving physical ISS pivot immediately, wheel or pinch to zoom, and use Back to Earth View during entry or after arrival. Return restores the saved Overview world pose over five seconds. A missing or expired sample buffer, model failure or unmount safely stops entry. Sample-window refresh does not restart the approach. The same Viewer, model primitive and scene clock persist. Cesium's native Sun and the NASA Tycho skybox remain enabled; the Sun appears only when the geometry places it in view.

The globe uses Cesium solar lighting with the scene clock, Sun and atmosphere to show day, night and a moving terminator. NASA GIBS tiled Blue Marble imagery shows daytime geography; a second tiled layer on the same globe shows historical 2016 Black Marble with dayAlpha 0, nightAlpha 1 and twilight interpolation. Night lights are not live city electricity or population telemetry. Network failures leave local fallback imagery usable. See [source, alignment and visual limits](../docs/frontend/earth-visualization.md).

In stable Inspection, the existing recognized modules show a transient cyan hover tint and pointer cursor. Camera manipulation, inertia and entry/exit suspend it; settlement re-picks the current pointer once. [Hover interaction validation](../docs/frontend/inspection-module-hover/README.md). Native touch has no hover gesture.

At inspectable camera distances (up to 1,000 m from the sampled ISS center), direct clicks can select 14 verified component identities: Destiny, Columbus, Harmony, Pirs, Poisk, Zvezda, Rassvet, Zarya, Kibo Exposed Facility, Kibo Pressurized Module, Quest, Cupola, Tranquility, and Unity. Pirs is explicitly marked as removed in 2021; its presence reflects the historical NASA VTAD model, not the current station. The panel separates asset identity from current configuration and says live module telemetry is unavailable. All other geometry remains unmapped; global-view clicks do not infer module identity. The [semantic map](../docs/frontend/iss-semantic-map.md) and [ISS model record](../docs/frontend/iss-model.md) document evidence, feature metadata, picking and hashes.

The inspection camera keeps the user's local F/L/U offset as the sampled physical ISS pivot moves. A long-drag excursion is bounded to 2,000 m. Camera/model trajectory alignment is visual; spacecraft attitude is `UNAVAILABLE`. Canonical opening geometry is rearward 66.354960 m, upward 60.803119 m and zero lateral offset. Native station orbit and the scoped wheel/pinch controls remain; Earth Overview restores its captured controller settings. See the [inspection interaction record](../docs/frontend/iss-inspection-mode.md) for measured geometry and interruption details. Earlier dated sections below are historical.

## Coordinate boundary check

The deterministic test uses Orekit output at 2026-09-28 15:00:00 UTC from the verified ISS TLE fixture. Backend ITRF 2020 XYZ meters `(-243964.3795801904, 6767562.779805377, 552206.5345118039)` converted through Cesium `Cartesian3` and `Ellipsoid.WGS84.cartesianToCartographic` differs from backend WGS84 by **4.27×10⁻¹⁴° latitude**, **4.69×10⁻¹³° longitude**, and **8.74×10⁻¹⁰ m altitude** (rounded). Test tolerances are 0.0001° and 1 m. This checks coordinate-axis/unit compatibility for the integration; it is not an ISS positional-accuracy claim.

## Forward-only comparison styling

The backend primary delivers 181 actual propagations from response time through one current TLE mean-motion period. This buffer supplies refresh headroom; the scene renders only **future direction**, from an **adaptive genuine future source time** through **scene time +0.85T**. No past trail, appended first point, closing segment or extrapolated OEM geometry appears. OEM uniformly samples its real coverage intersection, includes exact boundaries and shortens honestly when coverage ends earlier.

Both products use identical continuous halo/body primitives (20/8 px; halo multiplier 0.26; glow powers 0.35/0.22). Active PRIMARY is cyan `#53d9cd`; active OEM is amber `#edb86a`, both with body maximum alpha 0.85. Inactive color is `#71939c`, maximum alpha 0.08. Actual retained material uniforms update for both halo and body; inactive halo/body precede active halo/body. Source-specific accents make selection visible even when real paths overlap within a pixel. Exact trajectory coordinates do not change on selection. No dash material remains.

Normalized future phase `u=(sampleTime-start)/(end-start)` fades by `1-u²(3-2u)`, with zero alpha before the gap and at/after the real endpoint. Public Fabric composes this temporal mask with built-in `PolylineGlow`, a short smoothstep alpha/width taper and a CSS-space hull mask for every halo/body fragment. Range to the selected displayed ISS sets a bounded logarithmic smoothstep target (0.75–4 CSS px); each own bounded source property is searched to 1 ms at up to 10 Hz. A conservative projected pinned-GLB footprint includes minimum pixel enlargement, maximumScale, off-origin translation and silhouette. Lightweight mask uniforms follow camera motion every frame. The ramp spans 1–4 projected CSS px. No new point, curve displacement or backend resampling is introduced. Scene ticks change uniforms, not geometry; complete hidden replacement groups become visible only after all layers are ready. Both trails hide in Inspection. See the [visual review and performance evidence](../docs/frontend/orbital-trajectory-rendering.md) and [ADR-0006](../docs/adr/0006-selectable-forward-trajectory-visualization.md).

The [adaptive presentation review](../docs/frontend/trajectory-presentation-review/README.md) records both-build measured clearances, physical/display isolation, silhouette trials, browser regression and matched performance.

## Trajectory-aligned visual inspection — 2026-09-30

One selected physical ITRF position/velocity now supplies the shared model and moving-camera visual frame. Orientation is `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION`; actual attitude remains unavailable. The rear camera arrives at 119 m (65% closer than 340 m), with 85° perspective FOV and narrow-aspect adaptation. Camera range supplies close framing; model scale 1 and minimumPixelSize 80 remain. Inspection-only wheel/pinch zoom is proportional, bounded and reversible; native drag orbits the physical station pivot. Back restores all Overview settings. Existing lift, silhouette, trails, source selection and feature picking remain.

The existing sample responses add Earth-fixed velocity components and `velocityUnit:m/s`; GP uses existing Orekit PV, OEM the analytic source-Hermite derivative transformed as complete PV. Position samples, lineages, cadence, frames, storage and source classifications are unchanged. No infrastructure or new source is added. [Evidence and limitations](../docs/frontend/inspection-orientation-review/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Replay integration — 2026-10-03

The main Earth View now has LIVE/REPLAY controls. Replay uses a UTC date/time and ±1 hour steps, partial coverage metadata, 250 ms debounce, request cancellation and latest-request-wins. It fetches only backend replay/coverage endpoints; LIVE orbital/comparison polling pauses. Crew panel shows historical operational state and latest retained profile metadata with explicit career labels. Cesium pauses at T, uses returned ITRF position/velocity, hides current paths and hides the ISS if orbit is unavailable. Exit restores current polling/clock/Crew with the same Viewer and no page reload or camera command. Native two-finger pinch remains UNVERIFIED. [Validation](../docs/replay/validation/README.md).

## Current Crew membership — 2026-10-11

Current consumes the backend ACTIVE member array; the optional committed-membership metadata identifies its evaluation/health. Current members, structured assignments, reported aboard and confirmed physical presence remain distinct. No frontend identity matching, name filtering or source fetch occurs. Unavailable Current uses the existing explicit API error view. Responsive selection/detail/back behavior and retained direct UUID details are unchanged. Historical/Replay retain their temporal member sets and prior count labels. See [activation acceptance](../docs/crew/current-active-projection-activation/README.md).

## Current Crew summary cleanup — 2026-10-11

Current shows only **Current members**, derived from its published V10 member array.
Reported aboard and Without confirmed identity headlines are removed. Current decodes
only presence/assignment diagnostics; Historical uses its own frozen count/report decoder.
Source details retain unresolved ACTIVE source slots, explicitly separate from people;
retained evidence does not contribute. Current stale wording is “Presence not currently
confirmed”, with “Last operational confirmation: aboard” and operational UTC. The amber
state, assignment disclaimer, profiles, aliases and Historical presentation are unchanged.
See [investigation and validation](../docs/crew/current-ui-semantic-cleanup/README.md).

## Current membership and dated operational evidence

Every published Current human has the same primary Current-member state. Activity observations, entries and expired/unavailable evidence are separate dated annotations with detail provenance. Current refetches same-origin REST every120s after completion while visible/active; hidden/Historical presentation pauses polling. UUID selection survives arrivals; departing selections return to the roster. Refresh never contacts source providers or owns Cesium/camera transitions. [ADR-0019](../docs/adr/0019-current-membership-and-dated-operational-observations.md) and [validation](../docs/crew/current-operational-presence-validation/README.md).
