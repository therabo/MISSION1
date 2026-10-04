# Dynamic Earth centering in the free workspace

Implemented 2026-10-04 from clean synchronized baseline
`f8ca08b3134773327cf18549402b8acc8bb0d99e` (`refactor: simplify MISSION1 viewport branding`).
Before editing, HEAD, fetched origin/main and direct GitHub main were identical.
Repository: `/Users/daniel/Desktop/MISSION1`; external project context remains
`/Users/daniel/Desktop/mission1-project.md`, outside Git.

## Previous behavior and actual dashboard owner

`.earth-view` filled the entire shell, with the panels absolutely positioned over
it. Earth's principal ray was at half the browser width, even with a persistent
left dashboard. The current live dashboard is exactly `aside.status-panel`,
including its 24px left margin: rendered width 356px, right edge 380px. During
Inspection it becomes 278px wide, right edge 302px. Replay replaces it with
`aside.replay-orbit`: left 30px, width 360px, right edge 390px.

Crew is **right-side** at desktop widths, not an extension of the left dashboard.
Opening Crew/detail there leaves the left allocation unchanged. The 721–820px
live Crew drawer hides the status panel; no visible left owner remains. Mobile
status and Crew are bottom panels. Replay independently switches to its full-width
bottom card at its existing 700px rule. The wordmark, Replay launcher/time
controls, source selector, module card, attribution popup, hints and tooltips do
not define a left workspace allocation.

[Original baseline geometry](evidence/before-layout.json) records real runtime
LIVE, REPLAY, Inspection, Crew and person-detail states at desktop/tablet/mobile.
All prior repository screenshots remain untouched.

## Geometry and implementation choice

CSS sets `--earth-workspace-side` in each existing panel responsive rule. This is
a layout-role declaration, not a camera width constant. `useEarthWorkspace`
reads the root and visible side owners' `getBoundingClientRect()` at mount,
ResizeObserver notifications, window resize and relevant layout-state changes.
It filters hidden/display-none/empty panels and computes:

```text
workspaceLeft = max(0, visible side panels' right edge - shell.left)
workspaceRight = shell.width
workspaceCenterX = shell.left + workspaceLeft
                   + (workspaceRight - workspaceLeft) / 2
```

Without a visible side owner, `workspaceLeft=0`. Allocation is clamped to the
shell. Equality with 0.25 CSS-pixel edge tolerance avoids redundant React updates.
Changing only panel CSS width changes the result; JavaScript contains no copied
356/360/278px width, margin or responsive breakpoint.

**Selected strategy: real Cesium viewport ownership with a symmetric lens crop.**
The existing absolute `.earth-view` receives its measured left inset; its right,
top and bottom remain zero. Its canvas truly becomes the free viewport. The app
shell and dashboard DOM structure stay intact. No canvas/globe transform, fake
screen displacement, physical target change, camera lateral offset or zoom is
used. Native dimensions, projection, screen coordinates and pointer rays agree.

The installed CesiumJS 1.145.0 audit found that although
[`PerspectiveFrustum.xOffset`](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html#xOffset)
is public, `Camera.js:getPickRayPerspective` and
`Picking.js:getPickPerspectiveCullingVolume` omit it. Using that offset alone would
break the required interaction geometry. No private API/prototype patch or
library modification is introduced. A conventional symmetric viewport uses
Cesium's supported [`Viewer.resize`](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html#resize),
[`PerspectiveFrustum.fov`](https://cesium.com/learn/cesiumjs/ref-doc/PerspectiveFrustum.html#fov),
normal picking and native controllers.

Cesium defines FOV on the larger viewport axis. Simply narrowing its viewport
with the same raw FOV would shrink Earth and change close-view apparent scale.
Instead the native crop preserves the full-window lens's pixel scale:

```text
nativeFOV = 2 atan(tan(canonicalFOV / 2)
                 * max(freeViewportWidth, freeViewportHeight)
                 / max(shellWidth, shellHeight))
```

Canonical camera pose/snapshots/transition derivatives retain the original FOV.
Only the native viewport frustum gets the derived crop. X/Y frustum offsets stay
zero. Both projected-pixel dimensions match the full-window lens in deterministic
tests; physical camera position, direction/up, heading/pitch/roll, target and
range do not change to create the composition.

## Resize, transition and lifecycle behavior

One ResizeObserver owns shell/dashboard measurement and one window resize
listener handles breakpoint/spacing changes. The observer rebinds on LIVE/REPLAY,
Crew visibility and Inspection layout changes and disconnects its predecessor.
A second observer owns the **different** Cesium container, using observer
content dimensions to invoke `Viewer.resize`, update the native lens and request
a render only after a size change. A workspace effect also reapplies the lens
when the full-shell reference dimensions change. Both observers are removed on
unmount. Ordinary position/time/member text updates do not remeasure geometry.

Left inset adaptation uses a bounded **650ms CSS ease**, with no transition when
`prefers-reduced-motion: reduce`. This changes the actual viewport; it does not
translate a fixed canvas. Each size change is delivered by the container observer,
without a requestAnimationFrame/layout polling loop. A 250ms candidate was rejected
because native buffer resizing produced 24.67px entry /27.96px exit composition
steps in the observed frames. [Rejected trace](evidence/rejected-250ms-transition.txt)
is retained. The final easing preserves existing physical 6s/5s camera paths and
smooths the independent layout adjustment; it does not add a camera recenter.
The layout can finish settling for up to 650ms after a mode changes.

## Overview, Inspection and Replay

Overview retains its original camera world pose and 60° canonical lens, with the
Earth at the free viewport's horizontal center. Dragging still permits deliberate
user composition; the feature changes the viewport reference, not the user's
geographic aim or saved Earth pose.

Inspection also follows its actual visible side owner's right edge. At 1440×900:
90m slant range, 42.5° elevation, zero lateral geometry, 100° canonical full-window
lens; native cropped FOV **86.567463°**, center **871px**. At 768×1024: accepted
portrait range **144m**, same elevation/lateral/canonical FOV, center **535px**.
At 390×844: accepted portrait range **233.723077m**, native/canonical FOV **100°**,
center **195px**. Full-shell aspect continues to determine canonical range; a
narrower workspace never retunes the physical endpoint. Source frame, orientation,
6s entry/5s return constants and existing range/angle duration policy remain intact.

Live Crew and detail do not move Earth on desktop. At 768×1024, opening the
bottom drawer clears the hidden left panel's allocation: center 574→384px;
closing restores 574px. Detail itself changes no left geometry. Mobile stays 195px.
Replay uses the same geometry adapter: desktop right edge 390px and center 915px
at 1440px; changing the historical timestamp does not recenter. LIVE/REPLAY switches
follow their actual replacement panel edge, retain one Viewer and physical Earth
pose, pause/restore the existing clock and retain existing historical semantics.

## Measured results

The primary predeclared QA tolerance is **2 CSS pixels** for projection of Earth's
physical center/principal ray (and the centered station in Inspection). Browser
projection uses the current public camera basis and symmetric native frustum;
[development](evidence/development-browser.json) and
[production](evidence/production-browser.json) preserve unrounded values. Numerical
results are not claims of pixel-exact raster limb estimation.

| Viewport | Actual LIVE layout | Dashboard left /width /right | Expected Earth X | Observed projection X, dev /prod |
| --- | --- | --- | ---: | ---: |
| 1440×900 | LEFT_DASHBOARD | 24 /356 /380 | 910 | 910 /910 |
| 1280×720 | LEFT_DASHBOARD | 24 /356 /380 | 830 | 830 /830 |
| 1024×768 | LEFT_DASHBOARD | 24 /356 /380 | 702 | 702 /702 |
| 900×700 | LEFT_DASHBOARD | 24 /356 /380 | 640 | 640 /640 |
| 768×1024 | LEFT_DASHBOARD, Crew closed | 24 /356 /380 | 574 | 574 /574 |
| 390×844 | FULL_WIDTH /BOTTOM_PANEL | 9 /372 /381, no side allocation | 195 | 195 /195 |

All viewportLeft values are zero; viewportRight is the first table dimension.
Maximum primary numerical error across the 120 recorded browser/panel states is
**2.7563 × 10⁻⁹ CSS pixels**; this numerical projection result does not imply that
a raster contour can be measured to that precision.
Baseline centers were respectively 720, 640, 512, 450, 384 and 195px, confirming
the former full-window composition rather than free-workspace composition.

| 1440×900 width-only probe | Dashboard right | Expected X | Observed X | Projection difference |
| --- | ---: | ---: | ---: | ---: |
| Normal rendered width 356px | 380 | 910 | 910 | <0.000001px |
| Temporary CSS width 436px | 460 | 950 | 950 | <0.000001px |
| Removed temporary style | 380 | 910 | 910 | <0.000001px |

This runs in both builds without editing a camera constant or refreshing the page.
World camera position and native pixel-lens scale are unchanged. The temporary
style is browser-only and absent from source/build/commit.

Supplementary [native raster limb fits](evidence/raster-measurements.json) estimate
visual centers from radial gradients with a trimmed circle fit. The globe is an
ellipsoid with atmosphere and partially occluded/cropped contours, so that method
has a coarser approximately **4px interpretation band**. It is a separate visual
cross-check, not the primary 2px projection test. Its unrounded centers/radii and
sample counts are retained; finite fitting precision is explicit. Before/after
screenshots were captured at different real scene times, not with synthetic ISS
state or a fabricated fixed epoch.

## Browser and interaction regression

Real backend API responses only; no provider fixture, camera hook in the product,
API interception, native-touch claim or fabricated station pose. Passive QA reads
the existing Viewer through React references; all checked-in scripts stay outside
frontend imports/builds. Resize/orientation-equivalent sequence 900×700→390×844→
1024×768→768×1024→900×700 recomputes correctly without refresh.

[Input regression](evidence/input-regression.json) covers development/production ×
1440px/390px: principal-ray Earth picking at the actual canvas center, Earth drag,
wheel zoom, visible ISS clicks entering Inspection, Inspection native orbit and
wheel zoom, **14 verified module picks in each of four combinations**, and Back.
Picking converts local canvas coordinates to global browser coordinates with the
actual canvas bounds; a visual ISS/module click opens the correct visible action.
The passive observer globals exist only in those disposable browser pages.

[Transition traces](evidence/transitions.json) cover GP/TLE, NASA OEM and historical
REPLAY, desktop/mobile, development/production, in both directions. Canonical
range/FOV, finite composition steps, exact saved Earth world-pose restoration and
frame counts are retained: **8,515 frames**, maximum viewport-center step
**8.945313px entry /11.359375px exit**, saved world-position error **0m**. These
steps describe the bounded layout easing, not a physical camera discontinuity.
Automatic physical basis and path implementation remain
unchanged. No final camera correction, target takeover or second camera animation
is added; actual viewport adaptation follows layout state once.

[Additional panel-state checks](evidence/panel-states.json) cover 48 Inspection
and Replay Crew closed/open/detail/reclosed states in both builds at 1440, 768
and 390px. Detail changes no allocation; closing restores the measured side
edge. Physical camera position/basis stay identical while these panels change.
Only in the disposable live Inspection QA page, the existing clock is paused
to separate composition from natural station motion. Reduced-motion viewport
adaptation is also checked in both builds.

[Equivalent visual lint](evidence/visual-lint.json) checks eight desktop/mobile
Overview/Inspection states for horizontal overflow, unnamed controls, clipped
controls and unnamed images. No blockers. Existing small-text findings are retained;
no unrelated dashboard restyling is started. The requested shared
`capture_page.mjs`/`visual_lint.mjs` runtime is unavailable on this host; equivalent
Playwright screenshots, console/error capture and local lint are used.

## Performance, tests and freeze

[Idle/lifecycle probes](evidence/idle-lifecycle.json) measure 10s in each build:
**zero dashboard/root geometry reads, zero observer callbacks** at idle; two active
observers and one added window resize listener. Four Crew open/close cycles retain
two active observers with their predecessors disconnected. No ResizeObserver loop,
oscillation or new frame-driven React state. No feature geometry reads occur in
preRender, postRender, camera.changed or requestAnimationFrame loops. The existing
camera transition tick performs only the lens arithmetic where it previously set
FOV, using cached layout dimensions. Native resize/GPU resource work is finite
during layout motion; no universal FPS or zero total render cost is claimed.

Fourteen focused tests cover geometry, full-width return, coordinate origin,
bounds, dynamically changed dashboard width, responsive/layout replacement,
observer cleanup and eight full/cropped lens pixel-scale cases. Final gates:
**298 frontend tests /36 files**, typecheck and production build; **382 backend
tests** in both `mvn test` and `mvn verify`, zero failures/errors/skips. Node
24.21.0 and Java 21.0.3. Existing large Cesium bundle warning remains.
`git diff --check` and a [baseline byte inventory](evidence/freeze-audit.json)
validate the final diff: **5,197 of 5,205 existing files unchanged**, including
all **210 backend files**, **9 assets** and **4,182 prior frontend evidence files**.
Of 51 existing Cesium files, only EarthView's local viewport adapter changes.
[Machine-readable validation](evidence/verification.json) records exact checks,
freeze counts, measured maxima and screenshot hashes.

Backend runtime changes: **zero**. Source/provider adapters, CelesTrak/TLE history,
Orekit, NASA OEM, Crew logic, Replay semantics, APIs, database, scheduling and
reconciliation are unchanged. ISS GLB/textures, lighting/imagery/terrain, trajectory
physical coordinates/rendering/mask/reveal/joins/colors, visual orientation,
display-only lift, MSAA/FXAA and resolution policy are byte-identical to baseline.
Only the viewport and its supported projection composition change.

## Context and architecture review

Read project `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`, searched repository,
frontend and parent instruction locations (no additional applicable instructions),
and read external `mission1-project.md`. Inspected project-local skills; applied
frontend-design-codex, iss-3d-earth-view (data/scene reference contracts),
software-architect (ADR guide), devops-local-platform (runtime/CI references), and
architecture-decisions for the ADR threshold review. No dedicated Cesium framing,
responsive or performance skill was available beyond the applicable Earth/frontend
skills.

Reviewed frontend README; Earth visualization; accepted Inspection, focus and
camera transition results; orbital trajectory rendering; Crew panel dossier;
Replay architecture; architecture baseline and Earth delivery; ADR index and
ADR-0006. Inspected App, styles, OrbitalStatus, Crew/Replay panel layout, EarthView,
inspection controls/transition/composition, sky/model warmup, package/Vite config,
existing AppReplay tests and installed Cesium PerspectiveFrustum/Camera/Picking/
CesiumWidget resize code. Runtime rendering and measured geometry informed the
choice, rather than CSS alone.

Updated frontend README, Earth visualization, Inspection composition and architecture
04; added this dossier, focused tests and evidence. No new ADR required: this
reversible local adapter preserves the existing module/dependency boundaries,
Viewer owner, source contracts and deployment. External context is updated with
the final commit and validation, outside Git. One ordinary commit and normal SSH
push to `git@github.com:therabo/MISSION1.git`, main; final identity is in Git history
and the external context/turn report, avoiding a self-referential commit hash here.

## Evidence and reproduction

Before: `evidence/before-{width}x{height}-overview.png` at all six viewports, plus
Crew/detail/Replay/Inspection at 1440, 768 and 390px. After:
`evidence/after-{development|production}-{width}x{height}-overview.png`, additional
Crew/detail/Replay/seek/Inspection/Back/resizes, and
`after-{build}-1440x900-altered-dashboard-width.png`. All 94 screenshots and their SHA-256 hashes
are listed in the verification summary. The scripts are diagnostic-only. Validation text logs normalize trailing whitespace;
the test results and diagnostics are retained.

From the repository root, set `MISSION1_PLAYWRIGHT_MODULE` to the installed
Playwright module, use Node24, run the real backend with persisted data and dev5175/
preview4175. Execute `scripts/browser-qa.cjs 5175 development` and
`... 4175 production`, then input, panel-state, idle, transition and visual-lint scripts. The
baseline-capture script requires the original revision and is never run on the
candidate as historical baseline evidence. `scripts/measure-raster.py` uses
Pillow/NumPy. Ports and runtime dependencies follow the frontend README.

## Genuine limitations

At preserved camera/model scale, a narrow free viewport can crop Earth's limb or
outer ISS arrays. This is actual viewport clipping; the feature does not zoom out
or alter the physical/canonical pose to fit them. Native orbit/zoom remain usable.
User-panned Earth compositions remain user-controlled. Raster fitting is finite
precision and atmosphere/ellipsoid/UI-dependent. Native two-finger pinch remains
unverified; no genuine native touch-device validation was performed.

No other dashboard restyling was started.
