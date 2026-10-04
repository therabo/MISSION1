# Approved MISSION1 wordmark integration

Validated on 2026-10-04 (Europe/Rome). This milestone changes only the existing
upper-left branding presentation.

## Baseline correction and preserved history

The originally requested baseline `053054dc419f9333be41ecf71f4f31c86152b9f6`
was superseded after Phase 0 discovered three legitimate already-pushed
README/logo commits. With the user's explicit correction, implementation
preserved history and proceeded from clean synchronized baseline
`3c3ec87f20e85ae21fd21aa29d3f1fe191123956`.

| Preserved commit | Existing scope |
| --- | --- |
| `00bd014` — docs: add main README with MISSION1 logo | Added root README and PNG |
| `46e1544` — docs: update and center MISSION1 logo | Updated PNG and centered README image at width 800 |
| `3c3ec87` — docs: restore original logo with transparent background | Replaced PNG with the approved transparent artwork |

No reset, revert, rebase, squash, amendment or force push was used. All freeze
and implementation comparisons use `3c3ec87`, not the superseded baseline.

## Asset and implementation

The [root README](../../../README.md) references
`<img src="MISSION1-logo.png" alt="MISSION1" width="800">`.
The sole source is [MISSION1-logo.png](../../../MISSION1-logo.png): PNG with
transparency, **2172×724**, exact **3:1**, **1,067,446 bytes**.
SHA-256: `6a1bd669b7e47918725699caba05c9ac90c39f4ea4ccd290056decc3326a4fcb`.
The root README and source image are unchanged.

[App.tsx](../../../frontend/src/App.tsx) imports the original root asset directly.
Vite serves it in development and emits a hashed PNG containing identical bytes
in production. No duplicate source asset, image generation, recoloring,
rasterization or artwork alteration is introduced.

Previously, `.top-brand` contained a boxed M1 badge and plain-text MISSION1.
Those are replaced by the image inside the same container; the existing
Earth/approach/Inspection/return label remains. There is no new navigation,
header architecture or application shell.

[styles.css](../../../frontend/src/styles.css) confines changes to branding:
desktop width `clamp(144px, 16vw, 180px)`, mobile width
`clamp(120px, 34vw, 144px)` at the existing 720px breakpoint, `height: auto`,
`object-fit: contain`, and no image clipping or background. The container's
top offset accommodates the source's transparent padding above the unchanged
Replay control. Left offsets remain 26px desktop and 12px mobile.

## Responsive evidence

Chromium on macOS, native screenshots at DPR 1. The entire original PNG is
displayed; screenshots show a legible, sharp wordmark at normal DPI, preserved
transparency and ratio, no distortion/cropping, no logo/control overlap and no
horizontal overflow. Natural scene motion and data loading differ between
captures; these are layout checks, not pixel-identical orbital comparisons.

| Viewport | Rendered image, CSS pixels | Overview before | Overview after | Replay after |
| --- | --- | --- | --- | --- |
| 1440×900 | 180×60 | [Before](screenshots/before-5175-1440x900-overview.png) | [After](screenshots/after-5175-1440x900-overview.png) | [Replay](screenshots/after-5175-1440x900-replay.png) |
| 1280×720 | 180×60 | [Before](screenshots/before-5175-1280x720-overview.png) | [After](screenshots/after-5175-1280x720-overview.png) | [Replay](screenshots/after-5175-1280x720-replay.png) |
| 900×700 | 144×48 | [Before](screenshots/before-5175-900x700-overview.png) | [After](screenshots/after-5175-900x700-overview.png) | [Replay](screenshots/after-5175-900x700-replay.png) |
| 768×1024 | 144×48 | [Before](screenshots/before-5175-768x1024-overview.png) | [After](screenshots/after-5175-768x1024-overview.png) | [Replay](screenshots/after-5175-768x1024-replay.png) |
| 390×844 | 132.59375×44.1875 | [Before](screenshots/before-5175-390x844-overview.png) | [After](screenshots/after-5175-390x844-overview.png) | [Replay](screenshots/after-5175-390x844-replay.png) |

[Desktop Inspection](screenshots/after-5175-1440x900-inspection-gp.png),
[desktop OEM Inspection](screenshots/after-5175-1440x900-inspection-oem.png),
[mobile Inspection](screenshots/after-5175-390x844-inspection-gp.png),
[mobile Crew detail](screenshots/after-5175-390x844-crew-detail.png), and
[historical Crew detail](screenshots/after-5175-390x844-replay-crew-detail.png).

All twelve original before screenshots were captured before implementation and
copied byte-for-byte into this dossier. They were not recreated afterward.
[Screenshot hashes](screenshots-manifest.json) preserve their integrity.

## Accessibility and ongoing cost

The image exposes `alt="MISSION1"`; its container is no longer aria-hidden.
The retained decorative view label remains aria-hidden. There is no filename
announcement, link, button, tabindex or added keyboard action. `draggable=false`
and `pointer-events: none` on the container keep branding from intercepting
Cesium input. The intrinsic width/height reserve the correct ratio before load.

One image request per page was observed across LIVE, REPLAY, Crew/detail and
GP/OEM Inspection/Back, despite normal app rerenders. The new static load is
1,067,446 bytes; no claim of zero initial network/decode cost is made. No timers,
listeners, scene hooks, per-frame work or layout measurements enter product
code. Viewer, clock, model, shaders and camera code remain unchanged.

## Regression and scope

[Development report](after-5175-report.json) records all five viewports through
LIVE Overview, Crew/detail, Replay, historical Crew/detail and GP/OEM approach,
Inspection and Back. It checks natural dimensions, ratio, pointer style, zero
brand overlaps, document width, one image request, unchanged Viewer identity,
paused Replay time and camera preservation across mode changes.

The added mounted React test checks the approved source path, accessible alt,
intrinsic dimensions, absence of hidden/link/button ancestry, and retention of
the same image node through LIVE→REPLAY→LIVE.

No dashboard layout, Crew, Replay, Inspection, orbit control, Back, panel,
mobile sheet, typography system, global color/spacing, status/provenance,
backend or Cesium redesign was performed. **No new ADR required.**
**Native two-finger pinch remains UNVERIFIED.**

## Context actually reviewed

- The original milestone request and approved baseline correction;
  `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`; no additional applicable
  AGENTS/Codex/frontend instructions found in the target repository.
- `/Users/daniel/Desktop/mission1-project.md`, including the accepted Replay
  baseline and relevant historical constraints; it remains outside Git.
- Actual SKILL.md files: frontend-design-codex, software-architect,
  iss-3d-earth-view and devops-local-platform. Accessibility and visual QA use
  frontend-design-codex; no separate accessibility skill exists in this catalog.
- Earth-view-contract, cesium-scene-conventions, local-runtime-contract,
  ci-definition-of-done, and the shared visual-runtime contract/scripts.
- Root README, frontend README, current Earth illumination and Inspection
  documents; Crew panel review's integration/responsive/accessibility sections;
  Mission Replay README and validation dossier.
- Architecture baseline V1 (relevant sections), Earth View delivery and Mission
  Replay architecture; ADR index, ADR-0006 and ADR-0011.
- Actual App/CSS, Vite/TypeScript/package configuration, mounted App Replay test,
  existing browser Replay QA script and backend local-run/build configuration.

## Final gates

- **382 backend tests**, zero failures/errors/skips; final `mvn test` and
  `mvn verify` pass under Java 21. Backend source/tests/configuration remain
  byte-identical to the accepted baseline.
- **284 frontend tests / 34 files**, typecheck and production build pass under
  Node 24.21.0. The existing Cesium large-chunk warning remains.
- [Production browser report](after-4175-report.json): all five viewports,
  the same twelve states per viewport as development, zero page/console errors,
  one image request per page, no brand overlap or horizontal overflow.
  [Production desktop](screenshots/after-4175-1440x900-overview.png),
  [Inspection](screenshots/after-4175-1440x900-inspection-gp.png),
  [mobile](screenshots/after-4175-390x844-overview.png) and
  [mobile Replay](screenshots/after-4175-390x844-replay.png).
- [Input/accessibility smoke](input-smoke.json): desktop/mobile × dev/production
  expose exactly `img "MISSION1"`; hit-testing the logo center reaches the
  canvas, wheel input through the logo zooms Earth, native Earth drag works,
  Crew detail opens in Inspection, Close restores focus and Back succeeds.
- Shared visual runtime [capture](shared-capture-mobile/manifest.json),
  [console](shared-capture-mobile/console-events.json) and
  [request failures](shared-capture-mobile/request-failures.json) are retained.
  [Desktop lint](visual-lint-1440.json) / [mobile lint](visual-lint-390.json)
  contain no brand findings, broken wordmark, low-contrast or console error.
  Each shared-runtime page emits four GPU-driver `ReadPixels` stall warnings;
  these are retained alongside the main Metal browser QA, which reports zero
  console errors. No Cesium code is changed. Existing small text/Cesium credit
  metadata warnings remain. The major
  `text_overflow` finding is the intentional scrolling status panel, whose
  layout and overflow behavior are frozen and unchanged; it is not a new
  branding defect.
- [Served asset hashes](production-assets.json) match the production build;
  the served logo hash also matches the original approved PNG.
- [Freeze audit](freeze-audit.json): **5,110 existing tracked files unchanged**,
  including all **210 backend files** and **51 Cesium files**. The only existing
  changed files are App.tsx, branding CSS, AppReplay.test.tsx and frontend README.
  New files belong only to this dossier. Architecture/ADRs, root README, source
  logo, other frontend logic and assets are unchanged. `git diff --check` passes.

[Machine-readable gate results](test-results.json). No other dashboard
restyling was started.
