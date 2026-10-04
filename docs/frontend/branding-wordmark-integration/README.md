# Approved MISSION1 wordmark integration

Original integration validated on 2026-10-04 (Europe/Rome), with its visual
evidence preserved below. Subsequent follow-ups are recorded first.

## Standalone wordmark and attribution follow-up — 2026-10-04

Starting from clean synchronized `7fa39af0733b83a04336ab2b151edb2105edd004`,
`frontend/src/App.tsx` now renders only the existing image inside `.top-brand`.
The adjacent `em` presentation (`/ EARTH VIEW`, `/ ISS INSPECTION` and transition
labels) is removed. The `viewMode`, `inspecting`, `approaching`, `returning` and
`stationFocused` state/logic remain unchanged. The frontend-owned PNG, import,
responsive CSS, placement, accessible alt and pointer behavior are unchanged.
The existing LIVE/REPLAY wordmark test now also checks that the brand has no text.

The [Cesium attribution audit](../cesium-attribution-audit/README.md) records
`ION_ATTRIBUTION_NOT_REQUIRED`: only the default ion logo is removed through the
public `CreditDisplay.cesiumCredit` API. NASA model/imagery/skybox acknowledgments
and their credit popup are retained. Its dossier preserves development/production
before/after screenshots, all five responsive measurements and regressions.
Both Maven gates pass with 382 tests; frontend has 284 tests/34 files with
typecheck/build passing. Backend, Cesium scene/camera/providers/assets and all CSS
are unchanged. No new ADR. **Native two-finger pinch remains unverified.**

The ownership correction and original integration below are historical records;
their references to a retained view label describe those earlier milestones.
All prior screenshots and machine-readable evidence are preserved byte-for-byte.

## Asset ownership correction — 2026-10-04

**Verdict: `ROOT_ASSET_COUPLING_FOUND_AND_FIXED`.** This small corrective
milestone started from clean synchronized `main` / `origin/main` / GitHub main
at `9ca553bb4f01b7de5620dd7ffc4114b4647136bf`. History is preserved.

The previous exact runtime import in `frontend/src/App.tsx` was:

```ts
import mission1Wordmark from "../../MISSION1-logo.png";
```

It reached the repository-root README asset. The final import is:

```ts
import mission1Wordmark from "./assets/branding/MISSION1-logo.png";
```

The frontend owns [src/assets/branding/MISSION1-logo.png](../../../frontend/src/assets/branding/MISSION1-logo.png).
This small imported image follows the existing Vite module-import convention;
large Cesium/model/imagery resources retain their existing `public/` convention.
The original [root image](../../../MISSION1-logo.png) and
[root README](../../../README.md) remain byte-for-byte unchanged. The image was
copied without moving, symlinking, editing, recompressing or re-exporting it.

| Asset | Responsibility | SHA-256 |
| --- | --- | --- |
| `MISSION1-logo.png` | Root README / repository documentation | `6a1bd669b7e47918725699caba05c9ac90c39f4ea4ccd290056decc3326a4fcb` |
| `frontend/src/assets/branding/MISSION1-logo.png` | Application runtime | `6a1bd669b7e47918725699caba05c9ac90c39f4ea4ccd290056decc3326a4fcb` |

Both files are **PNG, 2172×724, 3:1, 1,067,446 bytes, RGBA with transparency**.
The only runtime source change is the import above; JSX and all CSS are unchanged.
The existing branding test now compares the rendered source with the imported
frontend asset. Comprehensive frontend search finds no runtime reference to the
root logo; the frontend README's root link is documentation only.

Vite emits `assets/MISSION1-logo-Cobk_ZMu.png` with the same approved hash.
The emitted JS, CSS and PNG hashes all equal the accepted pre-correction build.
An isolated source build succeeded with no root logo or root README. Its
existing typecheck requires three recorded Crew JSON test fixtures from
`docs/crew/rest-api-validation`; those were copied separately, with no product
or configuration change. Dependencies were reused through `node_modules` only.
The resulting `dist` was copied to a separate directory and served on port 4185,
with real backend API requests proxied to the existing 8080 service. The logo,
JS and CSS returned HTTP 200 with matching hashes; `/MISSION1-logo.png` and
`/README.md` returned HTTP 404. Runtime deployment therefore needs only the built
frontend artifact for branding, independently of the README asset location.

Before/after browser measurements match exactly in development and the isolated
production artifact, including image/container size, placement, fit, accessible
alt, pointer behavior, state label, zero brand overlap and no horizontal overflow.
Screenshots were visually inspected; transparency, sharpness and lack of cropping
are unchanged. Scene UTC, orbital motion and imagery loading can differ.

| Viewport | Unchanged image rectangle, CSS pixels | Current isolated artifact |
| --- | --- | --- |
| 1440×900 | x=26, y=8, 180×60 | [Screenshot](asset-ownership/1440x900.png) |
| 1280×720 | x=26, y=8, 180×60 | [Screenshot](asset-ownership/1280x720.png) |
| 900×700 | x=26, y=8, 144×48 | [Screenshot](asset-ownership/900x700.png) |
| 768×1024 | x=26, y=8, 144×48 | [Screenshot](asset-ownership/768x1024.png) |
| 390×844 | x=12, y=7, 132.59375×44.1875 | [Screenshot](asset-ownership/390x844.png) |

Final gates: **382 backend tests** with zero failures/errors/skips in both
`mvn test` and `mvn verify` (Java 21); **284 frontend tests / 34 files**,
typecheck and production build pass (Node 24.21.0). Desktop/mobile browser smoke
in development and the isolated artifact covers LIVE, REPLAY, current/historical
Crew/detail, GP and OEM approach/Inspection/Back: one logo image request per page,
zero page/console errors, retained Viewer, paused Replay time and restored LIVE.
Shared visual-runtime lint has no branding findings; existing small-text and
intentional status-panel overflow findings remain. Its capture records four
GPU-driver `ReadPixels` warnings and no failed requests. The accepted Cesium
large-chunk build warning remains. `git diff --check` passes.

[Machine-readable verification](asset-ownership/verification.json) records asset
integrity, standalone deployment, all five layout comparisons, browser smoke,
test gates and the freeze audit against `9ca553b`. All previous evidence below
is preserved: 5,163 of 5,167 existing tracked files are unchanged, including all
210 backend files, 51 Cesium files and 52 prior dossier evidence files. Those
original sections describe the earlier integration,
including its superseded root import; they are historical rather than current
asset-ownership guidance.

Context review for this correction: actual AGENTS.md and external project
context; no additional applicable repository instructions found; actual
frontend-design-codex, software-architect, iss-3d-earth-view and
devops-local-platform skills and relevant reference contracts; root/frontend
READMEs and this dossier; architecture baseline/repository/Earth View delivery
documentation; App, branding CSS, AppReplay test, main entry point, asset
conventions, package/Vite/TypeScript configuration and local Maven layout.

No redesign or behavior change to dashboard, Crew, Replay, Inspection, GP/OEM or
Back. Backend and Cesium are unchanged. No new ADR is required.
**Native two-finger pinch remains unverified.** No other dashboard restyling
was started.

## Original integration record — preserved

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
