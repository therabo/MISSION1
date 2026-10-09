# Occlusion-aware full-screen Earth centering

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

Corrective milestone, 2026-10-04. Accepted starting commit:
`47b295601da2ba6a90112e4b4212985c48d4be79`, parent
`f8ca08b3134773327cf18549402b8acc8bb0d99e`. Before editing, clean local `main`,
`origin/main` and direct GitHub `refs/heads/main` were equal to that baseline.
Its history is preserved. This correction uses one ordinary child commit and
ordinary SSH push; final identity/synchronization is recorded in the external
project context and completion report.

[Context actually reviewed](context-reviewed.md) identifies instructions,
skills, current/historical documents, ADRs, installed Cesium sources and tests.
All browser data comes from the unchanged real local backend. No synthetic ISS
values, mocked responses, source substitutions or backend changes are used.
QA-only camera, clock, DOM and counter probes are confined to browser scripts.

## Defect and before reproduction

The previous geometry helper reduced the dashboard to its right edge.
`EarthView.tsx` rendered `.earth-view` with inline `left: workspace.left`; CSS
animated that edge for 650ms. Its native symmetric FOV crop preserved canonical
pixel scale, but the **actual Cesium canvas** began at `dashboardRight` for the
entire screen height. Thus every pixel in the left strip, including space below
the dashboard and its real margins, was excluded. This was the wrong geometric
model even though its dynamic measurement and picking evidence were valid.

At 1440×900 LIVE Overview, the viewport was `(0,0)–(1440,900)`, dashboard
`(24,82)–(380,865)`, size 356×783. The old canvas was
`(380,0)–(1440,900)`, size 1060×900. Its principal/focal point was `(910,450)`;
projected physical Earth center was `(910,452.122649)`. The actual remaining-area
centroid is `(861.942669,443.560516)`. Those are distinct quantities. Inspection
cropped the canvas at 302px and the 100° canonical lens to 86.567463° native FOV.
Replay cropped at 390px despite its panel occupying only the lower-left area.

Before geometry/physical camera captures and
1440×900 before Overview were captured
from the accepted baseline before runtime edits. Before screenshots also cover
1280×720,900×700,768×1024,390×844, desktop Inspection and Replay. The old
[dynamic-workspace dossier](../dynamic-workspace-centering/README.md) remains
historical evidence with an additive supersession note; its old results and
binary evidence are unchanged.

## Full-screen geometry contract

`frontend/src/cesium/workspaceGeometry.ts` is a pure layout helper.
`WorkspaceGeometry` contains full viewport bounds, clipped optional occlusion,
width/height, viewport/occlusion/free areas and a focal point in **CSS pixels
relative to the viewport origin**. Layout owns geometry; Cesium owns optics.

For viewport `V` and the single active persistent left dashboard `D`:

```text
D' = intersection(V,D)
A = width(V) × height(V)
a = max(0,right(D')−left(D')) × max(0,bottom(D')−top(D'))
freeArea = A−a
C_V = (width(V)/2,height(V)/2)
C_D = center(D')−origin(V)
C_free = (A×C_V−a×C_D)/(A−a)
```

Subtract only the intersection, never off-screen area. With no visible side
owner, invalid/zero/outside dashboard bounds or bottom layout, use the normal
viewport center. Invalid viewport input falls back to an empty finite viewport.
If `freeArea ≤ A×1e−9`, retain the clipped area metadata but safely use the viewport
center rather than divide by a tiny/zero area. `sameWorkspace` compares viewport
size/origin, occlusion presence and **all four** occlusion bounds; subquarter-pixel
jitter is suppressed. There are no dashboard dimension constants in projection.

For the representative desktop above: `A=1,296,000`, `a=278,748`,
`freeArea=1,017,252 CSS px²`. Top/left margins and the 35px-high region below the
panel participate in the free region. It is a rectangle with a rectangle removed,
not the old right-side rectangle.

## Owners, events and lifecycle

- LIVE and LIVE Inspection: actual `aside.status-panel`, measured through the
  existing App shell ref and `useEarthWorkspace`.
- REPLAY, including Replay Inspection: actual `aside.replay-orbit`. LIVE and
  REPLAY replace one another; no rectangle union or unrelated-overlay heuristic
  is needed in the current product.
- CSS's existing `--earth-workspace-side` declares side/bottom ownership. Existing
  visibility/display rules determine whether the actual panel is active.
- Wordmark, source switcher, controls, Cesium credits, tooltips, module detail and
  Crew/detail are excluded. They do not own this persistent dashboard footprint.
- At desktop 1440, Crew remains a separate right overlay: open/detail/closed have
  identical centroid. At 768, LIVE Crew hides the persistent status panel and
  centering becomes `(384,512)`; closing restores the side centroid. REPLAY's
  persistent panel remains visible at 768. At 390 all bottom/hidden states retain
  horizontal center 195px and no stale desktop projection offset.

One layout ResizeObserver measures shell and active panel. One separate
EarthView ResizeObserver handles actual Cesium container dimensions. One scoped
MutationObserver observes only root/panel `class`, `style`, `hidden` attributes,
covering position/visibility changes that need not resize. One window resize
listener measures layout. Existing `${replaying}:${crewOpen}:${stationFocused}`
layout state rebinds actual DOM owners. Cleanup disconnects both layout observers
and the listener; Viewer cleanup removes its observer, projection listener,
reduced-motion listener and input adapters. No observer measures on each frame.
No per-frame layout React state is introduced.

## Public projection and Cesium 1.145 compatibility

The `.earth-view` container uses `position:absolute; inset:0`, without inline
left, canvas transform or CSS translation. Viewer/canvas cover the complete app
shell in every tested state. Only the obsolete left-edge CSS transition is
removed. Dashboard CSS, responsive breakpoints and assets remain unchanged.

With normalized focal deltas `u=C_free.x/W−0.5`, `v=C_free.y/H−0.5`, near plane
`n` and vertical half-height `h=n×tan(fovy/2)`:

```text
PerspectiveFrustum.xOffset = −2×u×h×aspectRatio
PerspectiveFrustum.yOffset = +2×v×h
```

These public near-plane offsets move the principal point to the free-area
centroid while preserving camera position/basis/target, lens FOV and pixel
scale. Overview retains its canonical full-window lens. Inspection native and
canonical FOV are both 100°; the obsolete 86.567463° crop is removed. Authoritative
API contracts: [PerspectiveFrustum](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html),
[Camera](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html),
[Scene](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html).

The actual installed/pinned 1.145.0 sources were audited. They need a local
compatibility adapter in `workspaceProjection.ts`:

1. Native perspective `getPickRay` and perspective GPU pick culling assume a
   symmetric lens. This scene instance's public methods convert visible screen
   coordinates to the equivalent symmetric coordinates, retaining native rays
   and native GPU feature IDs.
2. Native off-center pixel dimensions use twice right/top rather than the
   left-right/top-bottom span. `WorkspacePerspectiveFrustum.getPixelDimensions`
   delegates to a cached symmetric lens, preserving the accepted apparent model
   scale/minimum footprint independently of composition.
3. Native perspective `clone` omits public x/y offsets. The subclass explicitly
   copies them. Cesium modifies the working clone's near plane for scene-depth
   partitions; a local accessor on that clone's public `near` rescales both
   offsets with the near-plane ratio. The supplied clone result identity is
   preserved. This keeps globe, atmosphere and model passes aligned. Visual QA
   rejected an earlier unscaled clone candidate despite passing principal-point
   arithmetic; final evidence was recaptured after fixing the depth behavior.
4. The synchronous pick-only lens also uses the subclass, explicitly carrying
   **zero** offsets into reused working clones. If the equivalent pick coordinate
   lies beyond the symmetric viewport, expand only that temporary lens and
   compensate its temporary minimum pixel footprint. `finally` restores the
   original render frustum and footprint even on error. No visible frame, camera
   pose, asset scale, orientation or scientific value changes during picking.
5. `GlobeFS.computeEllipsoidPosition` reconstructs the far ground-atmosphere ray
   from a symmetric window and twice right/top pixel dimensions. Visual review
   rejected a second candidate with a circular surface cut despite correct
   numeric centering. A neutral public [Globe.material](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#material)
   [Fabric material](https://cesium.com/learn/cesiumjs/ref-doc/Material.html)
   now corrects the window ray and pixel span only in the far fragment-atmosphere
   branch. Alpha zero leaves imagery colour unchanged; native scattering, Sun,
   lighting parameters and near/Inspection atmosphere remain unchanged. This
   scoped shader compatibility assumes the current 3D globe without imagery
   splitting or globe clipping. Those features or a Cesium upgrade require
   revalidation. All final browser evidence was recaptured after this correction.

There are no Cesium private-field accesses, global prototype patches, edited
engine dependencies or custom feature-ID substitutes in application code.
Adapter code manipulates public frustum fields and clone results; the engine's
internal sources were read only to audit behavior. The implementation is pinned
to the single-Viewer Cesium 1.145 product; upgrades require rerunning these lens,
clone, depth-partition, globe fragment-ray, scale, ray and native GPU regression tests.

## Adaptation, Overview, Inspection and Replay

Layout-only changes interpolate cached normalized x/y projection offsets over
650ms with quintic smootherstep. The frame callback does only bounded numeric
arithmetic and exits while inactive. Reduced motion settles immediately. Actual
viewport changes resize once and settle against fresh matching full-viewport
geometry, preventing stale side-layout offsets during side↔bottom transitions.

Physical focus/path/prewarm and transition pacing remain unchanged. Canonical
entry is 6s and exit 5s, with the previously accepted adaptive range/angle policy
retained. No viewport width/height changes occur during camera transitions.
Overview's physical principal-ray focus, rather than the physical Earth origin,
is the composition reference: its accepted camera aim can project Earth a few
pixels vertically away from that focus, depending on actual orbital/start pose.
Both are recorded separately in JSON. This correction does not rotate/move the
camera to erase that existing residual. Earth is not scaled down to fit a panel.

Inspection remains 90m slant range, 42.5° elevation, zero canonical lateral
coordinate and 100° native/canonical FOV. Accepted portrait widening remains 144m
at 768×1024 and 233.723077m at 390×844. The selected-source physical ISS pivot
projects at the centroid. Model orientation, NASA GLB, native orbit/zoom and
Back remain. Normal viewport/DOM occlusion can still conceal portions of a close
model at its accepted scale; native orbit/zoom are available.

Replay subtracts the real lower-left panel rectangle, pauses at historicalT and
retains existing source semantics/coverage. Seek 23:00→22:00→23:00 changes real
historical state but preserves centroid when panel geometry is unchanged.
Return to LIVE restores the status owner. Crew detail adds no extra offset.
Replay docs/ADR-0011 contain no rectangular crop rule and need no changes.

## Globe fragment-ray raster regression

The final public Fabric adapter is checked separately at fixed real scene time
and identical physical camera/imagery, with the globe material toggled through
public APIs. Tolerances declared before capture: neutral ROI maximum RGB delta
≤3; shifted lit-surface samples within RGB30 (one-pixel neighbourhood for
fractional translation) in at least99% of samples. Both builds produce **zero**
RGB delta in all498,000 neutral ROI pixels. Offset renders agree in6637/6647
samples (99.8496%) in development and6675/6682 (99.8952%) in production.
Camera position difference is0m. The few raster outliers, including trajectory
and overlay pixels, are retained rather than hidden. No colour/lighting setting
was changed to satisfy the test. These supplementary pixel checks catch the
circular surface cut missed by principal-point arithmetic; the primary centering
gate below remains geometric. Raw results,
symmetric native,
neutral symmetric adapter,
correct off-center globe.

## Numeric/browser validation

Acceptance tolerance set before judgment: **≤2 CSS px** between independently
measured free-area centroid and projected principal/focal point, and also the
physical ISS pivot in stable Inspection. Primary projection uses public
`camera.viewMatrix` and `frustum.projectionMatrix` homogeneous multiplication,
equivalent to Cesium's world-to-window projection. DOM geometry and native ray
agreement supplement it; screenshots are independently inspected. No raster-only
centering claim is used.

The Overview presentation focus is the accepted positive camera ray, as retained
by `TransitionComposition.earthFocus` (closest point on that ray to Earth's
origin). Projecting any positive point on it is equivalent. It is not necessarily
the literal world origin: the existing geodetic/nadir camera basis leaves a
small, latitude-dependent vertical Earth-origin residual. Final development
Overview records 3.9560/3.6515/2.9318/2.5849/2.9510/2.4542px at the six required
sizes. These are recorded separately in `earth` and are **not** reported as
≤2px origin errors. The 2px primary gate applies to accepted presentation focus
and the physical ISS pivot in stable Inspection. Adjusting the physical basis or
the accepted focus rail solely to zero this inherited residual would violate
the camera/focus freeze. Width/height changes preserve that residual and scale.

### Dynamic width, height and combined dimensions

All states below use full 1440×900 Cesium. Temporary browser CSS is restored;
physical pose and lens pixel scale remain identical. Width-only and height-only
are distinct probes, with no refresh or camera constant change.

| Probe | Dashboard rectangle | Size | Occlusion/free area | Expected centroid | Projected focus | ΔCSSpx |
| --- | --- | --- | --- | --- | --- | --- |
| overview | (24,82)–(380,865) | 356×783 | 278748/1.01725e+06 | (861.942669, 443.560516) | (861.942669, 443.560516) | 5.81e-10 |
| width-436 | (24,82)–(460,865) | 436×783 | 341388/954612 | (890.942188, 441.595938) | (890.942188, 441.595938) | 5.81e-10 |
| height-633 | (24,82)–(380,715) | 356×633 | 225348/1.07065e+06 | (829.027269, 460.839584) | (829.027269, 460.839584) | 5.81e-10 |
| combined-436x583 | (24,82)–(460,665) | 436×583 | 254188/1.04181e+06 | (836.625518, 468.664963) | (836.625518, 468.664963) | 5.81e-10 |
| position-only | (24,132)–(380,815) | 356×683 | 243148/1.05285e+06 | (839.628081, 444.572857) | (839.628081, 444.572857) | 5.81e-10 |
| reduced-motion-height | (24,82)–(380,582) | 356×500 | 178000/1.118e+06 | (802.472272, 468.787120) | (802.472272, 468.787120) | 5.81e-10 |

Restoration rows in both build JSONs return exactly to the initial centroid.
The height-only case keeps width 356px/right 380px while bottom changes 865→715px;
both x and y change, proving the actual 2D footprint is used.

### Required responsive LIVE Overview matrix

All canvas bounds are `(0,0)–(W,H)`; panels below are measured DOM bounds.
The bottom panel is shown for context but contributes zero side occlusion.

| Viewport | Layout | Actual persistent panel | Occlusion/free area | Expected centroid | Projected focus | ΔCSSpx |
| --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | LEFT | (24,82)–(380,865) | 278748/1.01725e+06 | (861.942669, 443.560516) | (861.942669, 443.560516) | 5.81e-10 |
| 1280×720 | LEFT | (24,82)–(380,685) | 214668/706932 | (773.003717, 352.863956) | (773.003717, 352.863956) | 9.09e-13 |
| 1024×768 | LEFT | (24,82)–(380,733) | 231756/554676 | (641.524912, 374.181176) | (641.524912, 374.181176) | 5.15e-11 |
| 900×700 | LEFT | (24,82)–(380,665) | 207548/422452 | (571.840834, 338.454598) | (571.840834, 338.454598) | 1.45e-09 |
| 768×1024 | LEFT | (24,82)–(380,989) | 322892/463540 | (510.777288, 495.630405) | (510.777288, 495.630405) | 3.3e-09 |
| 390×844 | BOTTOM | (9,605)–(381,810) | 0/329160 | (195.000000, 422.000000) | (195.000000, 422.000000) | 1.36e-09 |

Responsive 900→390→1024→768→900 passes: zero mobile offsets, then automatic
restoration of real side-panel geometry. Inspection and Replay use their actual
short/lower panels rather than reusing Overview dimensions. At 1440, LIVE
Inspection centroid is `(732.334707,457.031004)` and Replay centroid is
`(770.193749,424.733968)`. Production repeats the entire matrix.

Full raw viewport/panel/intersection/area/centroid/projected Earth/ISS/focus,
physical pose, lens, native ray and error rows:
development,
production.

## Space below the dashboard

Annotated Overview proof
uses browser-only panel height 633px and ordinary native wheel zoom. Its dashed
rectangle identifies the lower-left area; a native Earth surface pick there
confirms that those visible canvas pixels render Earth. The separate
normal Inspection proof
shows Earth terrain beneath the actual short dashboard on the full-screen scene.
Both have production counterparts at 4175; raw bounds, poses and world pick are
in full-scene-edge.json. Annotation is DOM-only
QA content and no altered width/height or zoom constants are committed to product
CSS/camera logic. At the normal Overview zoom the Earth limb need not physically
reach every free corner; those corners remain rendered scene and contribute to
composition regardless of the contents at that instant.

## Input, physical camera and idle/performance results

Final-source browser matrix:65 development +65 production states, zero application
JS errors or ResizeObserver warnings. Maximum focal error: development
2.32284946833e-09px; production3.30362581931e-09px,
against the prespecified2px tolerance. Development mobile logged four NASA GIBS
CORS tile failures (four distinct CORS messages plus the repeated ERR_FAILED
message); the existing local imagery fallback remained visible. Production
logged zero console errors. These external messages are retained and deduplicated
in the network audit rather than reported as zero.

Native interaction regression passes in four real browser cases: development/production
×1440/390. Earth drag, wheel zoom, native ISS GPU pick followed by actual click,
Inspection orbit/zoom, all 14 semantic module IDs with actual UI selection and Back
pass (56 module clicks). The real scene clock is paused only for the overview
surface scan/click/entry, then resumed for orbit/zoom/module interactions. A first
scan selected a moving edge and the click missed before dispatch; its timeout
is retained in input-moving-edge-attempt.txt.
No product/data code or input handler was changed to satisfy the probe. Principal native ray dot-direction differs from 1 by
less than 1e−10. GP/OEM selectors and historical Replay are exercised by the
separate transition/source matrix. Input rows.

Two extra real GPU edge probes (one per build) pick an **unmapped solar-array
model surface** at visible pixel `(1390,120)`, equivalent symmetric x 1750px,
outside the original 1440px lens. The render frustum/offset and accepted minimum
footprint restore exactly. These probes do not invent a semantic module identity
for that surface; all 14 mapped module identities are verified separately.
Surface/edge proofs.

Transitions: 12 source/build/viewport cases, 7,651 post-render samples.
LIVE GP and OEM observe 6s entry/5s exit; Replay observes6.1–6.2s entry/5.1–5.2s exit under the
unchanged adaptive duration policy. Composition uses the independent 650ms C2
interpolation. Maximum consecutive 2D composition steps are 13.279155px entry
and15.056823px exit (predefined 40px sampling gate; mobile 0px).
Seven successful cases were recorded with the normal live scene clock (Replay
was naturally paused). A host clock/scheduling leap subsequently expired the
real buffer and correctly disabled Inspection; that timeout is retained in
transitions-clock-attempt.txt. The five
remaining cases use a fresh real-data page per source and pause only scene time;
flight timing still uses performance.now. No synthetic state, mocked delivery or
runtime clock/policy change is introduced. The reproducible script supports an
explicit resume option; a clean run uses one fresh page per case. Maximum raw
frame interval is1931.9ms in the production GP trace, including cold/runtime
scheduling work; it is not attributed to layout arithmetic or hidden.

All samples retain full canvas width/height, final native FOV 100°, accepted
range, and exact restored world position (error 0m). There is no transient old
rectangular viewport, CSS translation or double offset. Large frame intervals
are retained in raw traces, not hidden or called zero-cost; local capture includes
startup/flight work. Traces/durations.

Physical freeze compares real Replay at2026-10-02T23:00:00Z against retained
baseline before captures,1440 and390 in both builds. After the runtime restart,
maximum component differences are camera position0.9835µm, tracking/pivot
translation1.0096µm, local offset0.0354µm, range3.551e−9m and basis/HPR2.916e−10.
Tolerances are1mm for position/pivot/range and1e−8 for basis components/HPR radians;
tracking rotation is checked separately from translation. An initial1e−10
angular check was stricter than the measured numerical variation and failed;
the final physically meaningful tolerance and actual nonzero values are explicit.
All original before/after vectors are retained. Width/height/combined layout
probes preserve Overview position/basis/target/HPR and pixel scale exactly.
FOV change from the native crop to canonical100° is the intentional projection
correction. 12 camera comparisons.

Two settled 10-second idle probes and four Crew open/close cycles per build:

| Build | Layout reads | Resize/Mutation callbacks | Render offset writes | Active Resize/layout Mutation/window resize | Median/P95 frame ms | Pixel helper mean CPU ms/call |
| --- | --- | --- | --- | --- | --- | --- |
| Development | 0 | 0/0 | 0 | 2/1/1 | 26.900/30.000 | 0.004313 |
| Production | 0 | 0/0 | 0 | 2/1/1 | 27.300/30.300 | 0.002997 |

Zero ResizeObserver warnings, geometry oscillation or leaks. The global browser
MutationObserver total is 3: one scoped application layout observer and two
existing library observers on unrelated detached targets. The first QA attempt
incorrectly treated that global total as the layout count; the corrected probe
identifies app-shell targets and also verifies stable global totals after cycles.
All raw rows/counters remain in idle-lifecycle.json.

The pixel helper's measured **inclusive** native+adapter CPU totals are
8.0ms development/5.5ms production over10 seconds, about
0.0216/0.0150ms per rendered frame on this host. No layout activity is
introduced during idle. This is a local headless Chromium/ANGLE Metal observation,
not a matched before/after FPS claim or universal budget; timing resolution and
normal rendering work remain. No extra data/provider API code paths or geometry-triggered HTTP calls exist.
Unintercepted network inventory contains only
existing loopback, NASA GIBS and Crew portrait domains. Natural imagery tile
selection can change with the mandated full-screen projection.

Visual lint: 8 dev/prod desktop/mobile Overview/Inspection states, no horizontal
overflow, unnamed controls, clipped controls, unnamed DOM images or JS blockers.
Inherited small text remains in the raw findings per state (same frozen styles),
not suppressed. Lint rows.

## Automated gates and reproducibility

Backend unchanged: Java 21 `mvn test` and `mvn verify`, both 382 tests with zero
failures/errors/skips. Frontend normal npm scripts: 319 tests/37 files, typecheck
and production build pass. Previous frontend baseline 298/36 is preserved and
extended: 24 geometry/projection-scale cases, 4 observer hook cases, 7 direct
public Cesium compatibility cases. Independent centroid property sums four
remaining rectangles at 1e−10 tolerance; same dashboardRight with different
bottom produces a different 2D result. Hidden/bottom/responsive/clipped/degenerate
cases, native rays, scratch clone identity/depth-near rescaling, pixel scale,
GPU-lens cleanup and expanded-edge behavior are covered.

Gate log, runtime/bundle hashes
and freeze audit retain validation provenance.
An inherited large-bundle build warning remains; no dependency/build or graphics
change is made to suppress it. A lint invocation initially omitted the external Playwright module path; rerunning with the documented environment resolved it without a product/dependency change. One full test run concurrent with GPU QA exceeded
the inherited 5s GLB test timeout; the isolated final full run passed without a
modified timeout/test assertion. A temporary test-only union-type cast error was
corrected before final gates. These failed attempts are not counted as passes.

Run one GPU browser script at a time against the existing real backend 8080,
dev 5175 and final production preview 4175:

```bash
export MISSION1_PLAYWRIGHT_MODULE=/path/to/playwright
export MISSION1_PNG_MODULE=/path/to/pngjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/browser-qa.cjs 5175 development
node docs/frontend/occlusion-aware-workspace-centering/scripts/browser-qa.cjs 4175 production
node docs/frontend/occlusion-aware-workspace-centering/scripts/input-regression.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/full-scene-edge.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/transitions.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/idle-lifecycle.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/visual-lint.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/globe-projection.cjs
node docs/frontend/occlusion-aware-workspace-centering/scripts/evidence-audit.cjs
```

`baseline-capture.cjs` is the historical pre-edit capture workflow. Run only
against 47b2956 with a fresh `MISSION1_BASELINE_EVIDENCE_DIR`, never overwrite
retained before evidence. A mobile-only capture retry supplied the complete
mobile before set. QA Viewer retrieval/counters use browser-only inspection of
the existing React ref; no debug globals or instrumentation enter product source.

## Screenshot index

Paths below are relative to this dossier. The JSON rows identify every additional
mode, restore, resize, Crew/detail, source and build capture.

| Evidence | Exact path |
| --- | --- |
| Before defect | `evidence/before-1440x900-overview.png` |
| After desktop | `evidence/after-production-1440x900-overview.png` |
| After 1280×720 | `evidence/after-production-1280x720-overview.png` |
| After 900×700 | `evidence/after-production-900x700-overview.png` |
| After Inspection | `evidence/after-production-1440x900-inspection.png` |
| After Replay | `evidence/after-production-1440x900-replay.png` |
| After tablet | `evidence/after-production-768x1024-overview.png` |
| Tablet Crew | `evidence/after-production-768x1024-live-crew.png` |
| After mobile | `evidence/after-production-390x844-overview.png` |
| Mobile Inspection | `evidence/after-production-390x844-inspection.png` |
| Altered width | `evidence/after-production-1440x900-width-436.png` |
| Altered height | `evidence/after-production-1440x900-height-633.png` |
| Combined size | `evidence/after-production-1440x900-combined-436x583.png` |
| Lower-left Overview proof | `evidence/space-below-dashboard-overview-4175.png` |
| Lower-left Inspection proof | `evidence/space-below-dashboard-inspection-4175.png` |
| Real GPU edge model pick | `evidence/gpu-edge-pick-4175.png` |

## Freeze, documents and ADR review

Only runtime `EarthView.tsx`, `workspaceGeometry.ts`, new `workspaceProjection.ts`,
`useEarthWorkspace.ts` and the obsolete scene-left transition in `styles.css`
change. Focused tests are geometry, hook and new projection tests. App.tsx,
Inspection controls/focus/path/duration/prewarm, trajectory samples/colors/fade/
joins/masks/75km display lift, model/scale/orientation/materials/textures/mipmaps,
lighting parameters/scattering, NASA day/night imagery, Tycho skybox, MSAA/FXAA/resolution settings and
all backend/provider/science/data/API code are unchanged. The blob audit checks
443 existing frozen files, including 210 backend files and the previous dossier's
unchanged scripts/evidence. The globe's neutral Fabric material corrects the
projection ray only; it does not restyle imagery or alter the model's material.
No new runtime/provider/backend requests are added.
Rendering more of the full screen may naturally require different imagery tiles;
that is the existing imagery provider behavior, not a new source or polling path.

Current documents updated: `frontend/README.md`,
`docs/frontend/earth-visualization.md`, `docs/frontend/iss-inspection-mode.md`,
`docs/architecture/04-earth-view-orbital-delivery.md`, additive supersession note
in `docs/frontend/dynamic-workspace-centering/README.md`. Created: this dossier,
`context-reviewed.md`, focused reproducibility scripts and intentional evidence.
`/Users/daniel/Desktop/mission1-project.md` is updated separately and remains
outside Git, including the final commit identity. Replay architecture/frontend
semantics and historical accepted validation conclusions remain unchanged.

**No new ADR required.** Review of the ADR index, ADR-0006 and Replay ADR-0011
finds no accepted architectural rule requiring a cropped Cesium viewport. The
change is a reversible frontend layout/projection/input adapter within the
existing App/Cesium boundary; no service, source, contract, dependency or
infrastructure decision is superseded. Current architecture documentation is
corrected and the historical dossier is explicitly marked superseded.

Remaining limitations: the adapter is pinned to Cesium 1.145 and should be
revalidated on upgrades; unchanged close-model clipping and inherited tiny-text/
bundle diagnostics remain. Local headless ANGLE Metal frame measurements are not
a universal FPS guarantee. **Native two-finger pinch remains unverified.**

The scene now remains full-screen and the dashboard is treated only as an actual 2D occlusion region. The space below the dashboard is part of the Earth workspace.

No other dashboard restyling was started.
