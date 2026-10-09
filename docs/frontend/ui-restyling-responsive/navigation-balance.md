# Crew actions and compact navigation balance — 2026-10-09

Repository `/Users/daniel/Desktop/MISSION1`, branch `ui/restyling`. Starting SHA `c35416396a49aecd1b69506a83714f04976ca113`; reference main `12be75af376c0a18e510395ae59c58ee252f3800`. Actual pre-edit baseline: frontend **733 tests / 61 files**, Java 21 backend **382 tests**. This is one focused UI milestone; the general responsive-unit audit remains separate.

## Crew ownership and cleanup

Routine Refresh belonged to `CurrentCrewPanelView` (redesigned Current Crew) and `LegacyCrewPanel` (the standalone compatibility branch in `CrewPanel.tsx`). Both rendered buttons and their inline routine handlers are removed, including the Current-only `ContextButton` import and Refresh-only header/toolbar layout declarations. The retained resource prop is still required for Retry. The legacy summary no longer instructs the user to Refresh.

Current and Historical workspace headers contain title/expedition context and one Close control. The title block expands naturally while Close retains its accepted right edge, face/target and SVG. There is no placeholder, empty focusable element or stale aria reference. Counts, timestamps, warnings and provenance remain in their original assessment/roster structure; Current profiles, UUID selection and Historical evidence semantics are unchanged.

`useCrewResource`, REST clients, `CrewResource.refresh` and `CurrentCrewWorkspace` are unchanged. Opening the workspace still reads the API. The existing accepted Historical → Current handoff refreshes automatically and retains the previous dated response if that read fails. Backend ingestion, event-aware schedules and refresh implementation are untouched. Crew Retry, profile Retry and Historical transport recovery retain their existing error conditions. No polling or replacement routine action is introduced.

Two routine-action tests now assert absence. Two UUID tests use supplied roster updates instead of the deleted button. A new integration test verifies automatic Current return, retained assessment after HTTP 503 and Retry recovery. The native recovery probe injects transport failures only; successful responses always come from the real local backend.

## Compact calendar position

`HistoricalTimeBar` passes its existing `mobile` disclosure state to the body portal. Horizontal position uses `document.documentElement.clientWidth` and measured surface width, independent of the hidden bar's retained anchor rectangle. The existing `(max-width: 740px)` owner remains the only responsive presentation state.

Vertically, compact placement starts at the center of the safe scene row, with existing 12px navigation/summary clearance and bounded height. A vertical adjustment clears scene tools where space permits without shifting the horizontal center. At 320×568 the body scrolls while month/Close and Cancel/Apply remain fixed. This temporary surface can cover underlying scene tools on the constrained viewport, as in the accepted baseline; important navigation/summary and calendar actions remain clear/reachable.

Persistent anchor placement retains its original branch. **844×390 and 932×430 remain persistent tablet modes**, because disclosure uses width, not device labels or height. Their calendar stays anchored and the bar visible. This honors the frozen responsive state and persistent-position requirement; they are validated for fit and usable scrolling.

Development geometry, CSS pixels; production independently checked:

| Viewport | Actual mode | Calendar center X | Viewport center X | ΔX | Top–bottom | Fit |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 430×932 | Compact | 215 | 215 | 0 | 260.5–697.5 | Pass |
| 390×844 | Compact | 195 | 195 | 0 | 216.5–653.5 | Pass |
| 360×800 | Compact | 180 | 180 | 0 | 175–608 | Pass |
| 320×568 | Compact | 160 | 160 | 0 | 158–436 | Pass; body scroll |
| 844×390 | Persistent | 311 | 422 | 111 | 98–298 | Pass; body scroll |
| 932×430 | Persistent | 355 | 466 | 111 | 98–338 | Pass; body scroll |

The three-state disclosure machine, 4,000ms idle/reset/held-interaction rules, inert hidden bar, focus restoration, Apply → COLLAPSED, Cancel/Close/Escape → EXPANDED, exact ±600s, roving dates and UTC validation remain unchanged. Calendar control dimensions and animation language retain the c354 baseline.

## Navigation composition

At 741–1243px, five whole semantic groups share a grid row: branding; Earth/Inspection; textual source; Current/Historical; Crew. `repeat(5, auto)` plus `space-between` creates equal gaps between complete groups. The accepted 8px relationship remains inside each spatial/temporal pair. Native interactive DOM order remains Earth, Inspection, source, Current, Historical, Crew; CSS `order` is removed.

The date row spans all tracks between symmetric viewport gutters. Flex centers its actual visible label/time together. The invisible longest-label reservation is removed because separate rows already keep Current/Historical height stable. At ≤600px, the accepted two action rows plus date remain: branding left/spatial right; then source left, temporal controls centered in the middle track, Crew right. The second-row groups have equal gaps. At 601–740px the icon groups fit on one action row. Date centering is independent of unequal side widths.

Desktop ≥1244px retains the accepted icon + text flex arrangement. Tablet 741–1243px stays text only; mobile ≤740px stays icon only. GP/TLE and NASA OEM stay textual. SVG family/strokes, selected/disabled states, names and focus order remain accepted. No width-specific offsets, new breakpoints, observers or resize React state are added.

Header height stays 146px at ≤600px, is 94px at 601–1243px, and uses 86px in the existing ≥601px / ≤500px-height fallback. Desktop remains 64px. The deliberate 1243→1244 transition separates compact viewport-centered context from the frozen desktop composition. The 740→741 representation transition has no height jump.

Date measurement uses visible DOM text-range unions, excluding the hidden phone label, rather than the spanning wrapper. The tolerance is 2px:

| Viewport | Current center X | Historical center X | Viewport center X | Max ΔX |
| --- | ---: | ---: | ---: | ---: |
| 1024×768 | 512 | 511.9922 | 512 | 0.0078 |
| 900×700 | 450 | 449.9922 | 450 | 0.0078 |
| 768×1024 | 384 | 383.9922 | 384 | 0.0078 |
| 430×932 | 214.9922 | 214.9922 | 215 | 0.0078 |
| 390×844 | 194.9922 | 194.9922 | 195 | 0.0078 |
| 360×800 | 179.9922 | 179.9922 | 180 | 0.0078 |
| 320×568 | 159.9922 | 159.9922 | 160 | 0.0078 |

Visual review covers complete rows. Tablet group gaps are 80px at 1024, 49px at 900 and 16px at 768. Phone source/temporal/Crew gaps are 55px at 390 and 20px at 320. This distributes groups naturally while preserving their relationships and the independent date center. Current and Historical Crew title/subtitle/Close reflow is reviewed at desktop, tablet and phone sizes.

## Validation and scope

Results and representative artifacts are recorded in `navigation-balance/`; full raw matrices/corpora remain in `/tmp/mission1-balance-*` outside Git. The existing matrix now checks visible date/calendar centering, collisions, overflow, clipping and routine Crew action absence. Its sweep tests 113 widths from 320 to 1920, including 599/600/601, 739/740/741 and 1243/1244, across 11 mounted states, covering the requested 320→1440 interval.

Frontend final tests pass **735 / 61 files**, with typecheck and production build passing. Java 21 `mvn test` and `mvn verify` each pass **382**, with zero failures/errors/skips. Both builds pass **340 matrix captures + 1,243 continuous observations**, with no browser/console errors. Across compact surfaces, maximum visible-date ΔX is **0.0078125px** and compact-calendar ΔX is **0px**. Each build matches 80 desktop header rectangles/styles and 480 native top-control rectangles. All 168 desktop secondary rectangles match; 164 foreground masks are identical. The four translucent calendar surfaces differ by only 1–6 pixels in the luma-threshold mask under independently captured scene backgrounds, recorded separately rather than presented as full RGBA equality.

One repeated frontend run launched alongside two Metal browsers and Maven exceeded several existing five-second test deadlines and was stopped. The unchanged-source isolated rerun with two workers passed all 735 tests in 21.67s. No test timeouts or project configuration were changed. Ten representative lossless WebP captures total 2,018,038 bytes; decoded RGBA is verified against native PNG originals. Contact sheets and full screenshot corpora remain outside Git.

The 17-view matrix uses all requested desktop/tablet/mobile/short-landscape dimensions. Its 20 surfaces include Current Earth/Inspection/Crew, Historical collapsed/calendar/Inspection/Crew, astronaut/module details and GP/OEM/source/evidence variations. The disclosure harness separately covers expanded Historical, real timing, cancellation/apply, focus and responsive transitions. Secondary/native probes cover accepted density and actual scene interactions. The offline navigation report asserts equal semantic group gaps and compares desktop header styles and all six native top controls to the pre-edit baseline.

Both development and production disclosure probes pass 16 viewports, six complete mobile sequences, native keyboard order, reduced motion and 469 resize observations. Both secondary probes pass 17 viewports, 344 resize observations and three touch layouts, preserving all accepted zoom/Reset/legend/calendar/Close faces, targets and SVG sizes. Native Crew recovery passes in both builds, with four Current API attempts: two deliberately injected HTTP 503 failures and two real successful responses. The workspace stays mounted, the old dated roster survives the failed automatic return, Retry recovers it, and Close restores launcher focus. These two expected transport errors are explicitly recorded separately from zero unexpected console/page errors.

Both native scene probes pass eight viewports: actual Earth drag/wheel zoom/Reset, Inspection orbit/zoom, GPU module hover/picking, dock boundary blocking/pass-through, A→B selection, Close, original feature-color restoration and Back to the preserved Earth camera. One Viewer/canvas survives all context and viewport transitions. Browser/console errors are zero. The freeze report confirms 297 unchanged tracked files across the protected scopes, including all 210 backend files, and records SHA256 fingerprints for the 12 validated frontend files. Final `git diff --check` passes.

Runtime backend, Cesium, camera, picking, trajectory, hover, resolution, assets, API, replay-domain, quality and provenance are untouched. Accepted source/temporal ownership remains under ADR 0011; this presentation refinement introduces no significant architectural decision requiring a new ADR. `mission1-project.md` is updated outside Git. One ordinary commit and normal SSH push target only `ui/restyling`; main is not modified or merged.
