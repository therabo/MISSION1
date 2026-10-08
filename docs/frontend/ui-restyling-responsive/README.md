# ui/restyling responsive hardening — 2026-10-08

The accepted **1440 × 900** desktop composition is the visual reference. This milestone audits the entire redesign against `main`, retains its desktop presentation, and corrects compact calendar and native attribution defects. The scene remains full-screen behind independently sized overlays.

## Baseline and scope

| Reference | Initial value |
| --- | --- |
| Repository / branch | `/Users/daniel/Desktop/MISSION1`, `ui/restyling` |
| `main`, `origin/main`, merge-base | `12be75af376c0a18e510395ae59c58ee252f3800` |
| Initial `ui/restyling` | `36c36bd10757b7ec1442903d32e2f854696abb6e` |
| Initial `origin/ui/restyling` | `12be75af376c0a18e510395ae59c58ee252f3800` |
| Committed redesign vs main | 62 added, 14 modified, 0 removed files; 5,420 insertions / 300 deletions |
| Actual frontend baseline | Node 24: 698 tests / 58 files |
| Backend baseline | Java 21: 382 tests |

The branch already contained eight redesign commits and uncommitted Current/Historical Crew work. The user explicitly authorized including that work in the final ordinary commit **after verification**. Its exact initial diff and file list are retained under `audit/`. The initial Node 20 attempt failed because that runtime is unsupported; the recorded baseline and final runs use installed Node 24. No dependency change was needed.

Read project instructions and the external project context before implementation. Applied `frontend-design-codex`, `software-architect`, `devops-local-platform`, `iss-3d-earth-view`, `iss-3d-station-view`, `mission-replay`, and `telemetry-quality-and-provenance`. The frontend skill's optional `.shared/visual-runtime` is absent locally; equivalent browser assertions, native Playwright captures and contact-sheet review use the installed bundled runtime. This local layout correction retains existing ownership and introduces no significant architecture decision requiring a new ADR.

## Complete inventory and main comparison

[Pre-implementation component inventory](audit/component-inventory-before.md) was created before editing frontend code. [Final inventory](component-inventory.md) accounts for all **41 visual families**, including shared children changed through their parents, loading/error/evidence states, motion helpers, scene helpers, fonts/icons and attribution. [File-level branch diff](audit/branch-name-status.txt), [statistics](audit/branch-stat.txt), [full frontend diff](audit/branch-frontend.diff.gz), [history](audit/branch-history.txt), and [initial working tree](audit/initial-working-tree.diff.gz) preserve the comparison.

Main supplies the accepted behavioral contracts: source preference/availability guards; propagated GP versus source-provided OEM distinctions; timestamp, units, quality and evidence; native Inspection entry, orbit, zoom and Earth restoration; semantic module picking; lazy Crew profiles, presence versus assignment; historical reconstruction and explicit unavailable states. The redesign intentionally replaced LIVE/Replay labels and the legacy datetime/one-hour controls with Current/Historical and the approved calendar/10-minute controls. `ReplayControls` remains an isolated compatibility component, **unreachable from App**. Its tests remain part of the full suite; it is not misrepresented as a browser state.

The pre-existing Crew changes unify Current/Historical presentation in one workspace, retain accepted data during pending or failed replay requests, and provide a real retry. They are verified separately from this milestone's runtime edits in `HistoricalCalendar.tsx`, `HistoricalCalendar.css`, `styles.css`, and one compact expanded-evidence rule in `CurrentCrewWorkspace.css`.

## Desktop golden reference

Twenty desktop states were captured **before** runtime edits in [golden/development](validation/golden/development/matrix.json). The final matrix captures the same states, source preferences, native scene and real retained historical target `2026-10-03T12:04:00Z`. Current UTC, orbit and source freshness naturally advance; they are not frozen or replaced with synthetic data.

DOM geometry and computed surface styles are compared separately from changing Cesium pixels. The calendar wrapper uses `display: contents` on ordinary desktop, preserving the accepted flex arrangement. The new compact rules do not apply at 1440 × 900. Typography, control dimensions, borders, fills, glass/opacity, radii, fonts, icons and accepted spacing retain the original desktop rules. QA reports store rectangles and computed styles alongside each screenshot.

## Defects found and corrections

1. At 320 × 568 and short landscape sizes the calendar could rise over navigation/summary, and its former stress rule reduced date/time/action heights to 28px. Placement now derives its maximum height and vertical bounds from the actual `.earth-scene-ui` row. Compact date/time content has one scroll owner; month/Close and Cancel/Apply stay outside it. Focused dates and UTC fields remain reachable when resizing or using keyboard navigation. Editing a draft does not apply it or snap its scroll back to the selected date.
2. Cesium's mobile attribution overlay used z-index 1 beneath restyled chrome. A compact/short-height modal rule puts it above chrome, bounds it to the dynamic viewport, reserves title space for its 44px close target, and allows source-link scrolling. Selector specificity accounts for Cesium's later-injected mobile widget CSS. Ordinary desktop attribution retains native styling.
3. The app shell explicitly uses `100dvh` so mobile browser chrome changes the available viewport while the canvas remains fixed to its shell.
4. Visual review found expanded Historical Crew evidence confined to half the phone width with a large empty left column. At the existing ≤740px breakpoint, only the open assessment/evidence spans the full row. Closed counts/assessment and all desktop geometry stay unchanged.

The initial broad geometry audit alone did not catch the first two defects: actual screenshot review and hit tests exposed them. Iteration 1 confirmed the calendar fix and exposed an attribution specificity issue, which was corrected before final QA. The QA harness also corrected two false assumptions: Historical Earth has a status rather than a provenance disclosure (the disclosure is reachable in Historical Inspection), and screen-reader-only text/`display: contents` wrappers have no visible text rectangle/box. These are recorded as harness corrections, not application defects.

## Responsive policy

| Constraint | Purpose and retained mechanism |
| --- | --- |
| ≤1399px, ≥1244px | Reduce navigation margins when the desktop groups approach their intrinsic width. |
| ≤1243px | Wrapped navigation, 44px compact controls, fluid margins; bounded calendar content and attribution. |
| ≤740px | Summary/Inspection two-row grids; Crew rows become stacked records; astronaut detail uses the existing bottom surface. |
| ≤600px | Two-column phone navigation, date on its own row, two-row Historical bar, full available-width evidence. |
| ≤379px | Existing narrow stress spacing/reset width; no lost data. The former 28px calendar exception is removed. |
| ≤620px height | Existing module/astronaut height treatment plus bounded calendar/attribution content. |
| ≤500px height, ≥601px width | Existing reduced top padding for landscape. |
| `crew-roster` container ≤983 / ≤700px | Existing roster columns adapt to available width when a side detail is open, independently of viewport. |
| Coarse pointer ≤1243px | Existing visible 44px attribution row and reserved scene-tool/crew spacing. |
| Reduced motion | Existing short opacity transitions; no responsive remount or camera-time change. |

There are **no new width breakpoints**, observers, polling, per-frame DOM reads, camera offsets or React resize state. Flex/grid, `minmax(0, 1fr)`, intrinsic wrapping, bounded `min()`/`calc()` sizes and existing design tokens do the work. Fixed borders, icon sizes, gaps and desktop maxima retain their legitimate purpose. The only new sizing variable is calendar-local `--calendar-available-height`; its value is measured on existing open/draft/resize/animation events. No design-system rewrite or duplicated responsive state machine is introduced.

## Scroll, hierarchy and touch

The document and scene do not scroll. Crew owns `.crew-panel-content`; astronaut detail owns `.astronaut-profile-body`; module content/dock and orbital evidence own bounded information scrolling. Compact calendar owns `.calendar-body`, with no independently scrolling date grid; native attribution owns its bounded lightbox. Essential close/navigation/actions remain reachable. Long names and scientific/source timestamps wrap in their semantic cells; no important fact is hidden for mobile.

44px compact button heights and close/time targets retain smaller desktop glyphs. Seven calendar columns necessarily provide narrower date **widths** (about 32–40px) while retaining 44px heights; this is the documented 320px compromise. The 320 × 568 calendar shows fewer content rows at once and requires scrolling to UTC fields. The compact module dock retains its existing 45vw overlay and scrolls vertically; it keeps the station's central canvas available. These choices preserve approved hierarchy and content, rather than shrinking every value.

Existing contrast backing, focus indicators, disabled/selected states, local icon aspect rules, fonts and surface opacities remain. There is no new tablet/mobile opacity variant.

## Cesium and data freeze

[Freeze verification](audit/freeze-verification.json) checks all 210 tracked backend files and 77 tracked Cesium/asset/public files against the initial restyling checkout: **zero changed files**. Rendering-quality policy, imagery/night brightness, stars, GLB/PBR assets, antialiasing/MSAA/FXAA, atmosphere/lighting, trajectory generation, resolution policy, camera helpers and interaction adapter are untouched.

The existing workspace infrastructure continues observing actual overlay geometry. No full-height excluded column is added; the entire canvas, including space below/around panels, stays in the scene. Public focal/projection observations, persistent Viewer/canvas checks, native GPU picks and exposed-edge hit tests accompany layout assertions. Current values remain computed orbital states, not live onboard telemetry. Evidence retains units, source classification, timestamps, quality and historical/latest metadata distinctions.

## Browser evidence and automated checks

`validation/responsive-matrix.cjs` uses the real backend, native controls and Cesium. It records page/body overflow, top-group and scene-tool overlaps, surface bounds, text ranges, control hit tests/reachability, intentional scroll owners, full canvas, focal composition, persistent Viewer and selected source/member/module/UTC/mode. Popovers/modal/docks over the scene are intentional overlays; overlap with navigation/summary is rejected. Calendar draft edit is checked without changing accepted UTC.

The **20 sizes × 20 reachable states** matrix runs against both Vite development and production preview. Continuous resize samples 320→1920 in 16px steps plus breakpoint neighbors (**113 widths per state**) for 11 open states without reload. Historical loading/errors and Crew variable data use separate browser regressions. Any synthetic layout fixture is explicitly labelled **TEST ONLY**, kept in QA interception, and excluded from real-data captures and shipped runtime.

| Viewport | Layout / adaptation |
| --- | --- |
| 1920 × 1080, 1600 × 900, 1440 × 900 | Accepted desktop row, equal summary cells, side detail overlays. |
| 1366 × 768, 1280 × 720 | Desktop row with reduced intrinsic navigation margins; bounded details. |
| 1024 × 768, 900 × 700 | Wrapped compact context, 44px controls, fluid information surfaces. |
| 834 × 1194, 820 × 1180, 768 × 1024 | Tablet portrait, wrapped context; roster container adapts beside detail. |
| 430 × 932, 412 × 915, 390 × 844, 375 × 812, 360 × 800 | Phone context grid, two-row summaries/time bar, stacked roster/bottom detail. |
| 320 × 568 | Same semantics; narrow spacing, bounded content scroll; date-column width compromise. |
| 1920 × 700 | Wide desktop with shorter bounded information surfaces. |
| 1024 × 600 | Wrapped compact context plus short-height surfaces. |
| 844 × 390, 932 × 430 | Short landscape; reduced top padding, scrollable information/calendar. |

All normal states: Earth GP/OEM; each source's provenance; Crew, Crew evidence, astronaut detail/evidence; Historical Earth/calendar/Crew/evidence/detail/Inspection/provenance/module; Current Inspection/provenance/module; native attribution. Regressions also exercise delayed/loading/error/retry, long names/mission/biography, empty/null/unavailable data, reduced motion, touch scrolling/orbit/pinch and module identity/color restoration.

### Reproduction

Use installed Node 24, Java 21 and the existing local backend/PostgreSQL. The QA Playwright module can be configured with `MISSION1_PLAYWRIGHT_MODULE` (bundled default in the existing observer helper). Development URL is `http://127.0.0.1:5175/`; production preview is `http://127.0.0.1:4175/`. Build with the actual frontend package scripts before preview QA.

```sh
node docs/frontend/ui-restyling-responsive/validation/responsive-matrix.cjs http://127.0.0.1:5175/ development final
node docs/frontend/ui-restyling-responsive/validation/responsive-matrix.cjs http://127.0.0.1:4175/ production final
node docs/frontend/ui-restyling-responsive/validation/native-responsive-interactions.cjs http://127.0.0.1:5175/ development
```

The legacy regression scripts retain their existing QA-only instrumentation; no observation seam is shipped. Console/page errors, external request failures, real input envelopes, per-state screenshots and geometry are stored in JSON. `review-images.py` makes indexed contact sheets for actual human review, and optionally converts QA PNGs to lossless WebP **only after proving decoded RGBA equality**; the lossless manifest retains original and converted SHA-256 hashes. Runtime image assets are never converted.

## Validation results and delivery

The final machine-readable reports, desktop-fidelity audit, screenshot review ledger and test logs are linked from [validation summary](validation-summary.md). [Screenshot index](screenshots.md) provides exact state/viewport paths. The repository and final commit are verified independently of the outside-Git `/Users/daniel/Desktop/mission1-project.md` update. Delivery uses one ordinary commit and a normal SSH push of `ui/restyling`; `main` is neither modified nor merged.

Real limits: browser QA uses Chromium/Metal on this host, including synthesized native touch events; physical Safari/iOS/Android browser chrome and hardware gestures are not certified by this run. Existing public-data coverage gaps, retained metadata availability and build chunk-size warning remain explicitly visible rather than replaced with invented facts. No unresolved responsive defect is accepted as a limitation.
