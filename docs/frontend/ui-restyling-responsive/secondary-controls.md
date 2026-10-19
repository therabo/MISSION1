# Secondary control density — 2026-10-09

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

Starting `ui/restyling`: `b4c0cd4098411b1fa75ca29c68f31a88dd82a049`. Main: `12be75af376c0a18e510395ae59c58ee252f3800`. Actual pre-edit baseline: 726 frontend tests / 60 files; 382 backend tests.

## Close inventory recorded before implementation

| Action | Owner / reachability | Accepted desktop |
| --- | --- | --- |
| Close crew panel, Current | CurrentCrewPanelView in CurrentCrewWorkspace | 36×36, text × at 22px |
| Close crew panel, Historical, including selected member | ReplayCrewPanel in CurrentCrewWorkspace | Same Crew header; detail uses Back rather than a separate close |
| Close astronaut detail | CrewAstronautDock → ContextDock | 36×36, inherited 14px × |
| Close module information, Current and Historical | ModuleInfo → ContextDock | 36×36, inherited 14px × |
| Close Historical calendar | HistoricalCalendar | 34×28, transparent, 14px × |
| Close Data attribution | Native Cesium CreditDisplay | Vendor presentation; existing compact 44×44 target |
| Generic Close {title} | ContextDock foundation | Used by astronaut/module, no additional App dock |
| Close crew panel, standalone | LegacyCrewPanel, compatibility branch; App always supplies workspace | Retained legacy presentation; audit only, unreachable from restyled App |

Earth orbital source evidence, Crew assessment/source evidence, portrait rights and profile evidence use native disclosure summaries or the existing evidence toggle. They have no × action. Inspection has no Orbital Details panel, disclosure or X after the 2026-10-19 cleanup; its position fields are informational. Back to crew, Back to Earth, Exit Historical and refresh are separate actions and keep their semantics. Calendar has seven day columns, Close, three native UTC selects, Cancel and Apply; no visible previous/next month buttons. Its existing PageUp/PageDown keyboard month navigation stays intact.


## Final responsive dimensions

Dimensions are CSS pixels, **visible face → effective outer target**. Existing 1399/1243/740/600/379px composition is retained; density changes use 1243, 740 and 379 only. No transform scaling, new breakpoint, dependency or architectural boundary. Desktop refers to ≥1244px at the validated desktop heights; the existing short-height fallback is preserved.

| Control | Desktop ≥1244 | Tablet 741–1243 | Mobile 380–740 | Narrow ≤379 |
| --- | --- | --- | --- | --- |
| Zoom − / + | 44×36 → 44×36, original 14px glyph | 38×38 → 44×44, 18px SVG | 34×34 → 44×44, 16px SVG | 32×32 → 40×40, 14px SVG |
| Reset view | 124×36 → 124×36, 14px text | 106×38 → 112×44, 13px text | 92×34 → 102×44, 13px text | 84×32 → 92×40, 12px text |
| Reachable × closes | Crew/docks 36×36; calendar 34×28; native credit 14.016×28 at 24px glyph, all unchanged | 38×38 → 44×44, 18px SVG | 32×32 → 44×44, 16px SVG | 30×30 → 40×40, 14px SVG |

Scene group outer gaps: 8 / 4 / 2 / 2px. Existing right offsets: desktop24, compact16, ≤600px12; bottom24 or coarse-pointer64. Smaller faces are centered inside the actual button; transparent target space participates in pointer hit testing. Faces use physical width/height, borders and padding, without transforms. Focus rings cover the outer target. Close buttons share the local `close.svg`: React embeds the static asset as decorative SVG, native Cesium uses it as a CSS mask. The asset contains no user HTML. All Xs have the same geometry/1.5-unit rounded stroke, normal/hover face tokens and compact focus treatment. Desktop text glyphs remain visible; compact SVGs are hidden there.

The small shared variables (`--secondary-target`, `--secondary-face`, `--secondary-icon`, `--calendar-action-face`) eliminate duplicated compact sizing. Rectangular controls provide their own face width/height and calendar actions a 40px target height. No design-system rewrite. Existing disabled opacity and callback ownership are retained. All reachable closes in the inventory follow this policy; the unreachable LegacyCrewPanel stays unchanged. Source/provenance/evidence disclosure summaries remain disclosure controls, without newly invented close actions.

## Legend

| Width | Row height | Font / line | Marker | Inner gap | Horizontal backing padding | Scene offset |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop | 28 | 13 / 16 | 24×2 | 8 | 8 each side | left24, bottom28 |
| Tablet | 24 | 12 / 16 | 20×2 | 6 | 6 each side | left24, bottom34 |
| Mobile | 22 | 11 / 15 | 16×2 | 5 | 5 each side | left20 at ≤600, otherwise24; bottom35 |
| Narrow | 20 | 11 / 15 | 14×2 | 4 | 4 each side | left12, bottom34 |

Coarse compact pointers retain the separate credit row; legend bottom74 aligns the smaller row with controls at bottom64. Vertical padding is the centered difference between row and line heights (6 / 4 / 3.5 / 2.5px per side). Width remains content-based: GP/TLE content is approximately 78.25 / 68.69 / 60.14 / 57.14px before backing padding. NASA OEM retains its full name and its corresponding content width. The .84 graphite contrast backing, source colors, selected-source content/title and computed GP/TLE versus source-provided predicted OEM meaning are unchanged. Crew still hides scene chrome; Inspection retains its scene relationship.

## Calendar density and interaction

| Element | Desktop | Tablet | Mobile | Narrow |
| --- | --- | --- | --- | --- |
| Cancel face → target | 96×28 → same | 80×36 → 88×40 | 72×32 → 80×40 | 64×30 → 72×40 |
| Apply face → target | 152×28 → same | 154×36 → 162×40 | 204×32 → 212×40 at 320px panel | 212×30 → 220×40 at 360 viewport; 188×30 → 196×40 at 320 viewport |
| UTC select face → target height | 28 → 28 | 36 → 40 | 32 → 40 | 30 → 40 |
| UTC value typography / padding | 14/20, left10 right22 | 13/20, left8 right22 | Same compact | Same compact |
| UTC group height / label gap | 42 / 2 | 54 / 2 | 54 / 2 | 54 / 2 |
| Month header height | 28 | 44 | 44 | 40 |
| Calendar/body spacing | 8 | 6 | 4 | 4 |
| Footer gap | 8 | 6 | 4 | 4 |
| Close | 34×28 | 38 face / 44 target | 32 face / 44 target | 30 face / 40 target |
| Day cells | 32×28 at 280px panel | Unchanged 32×44 at 280px panel | Unchanged ~37.72×44 at 320px panel | Unchanged ~37.72×44 at 360 viewport; ~34.28×44 at 320 viewport |

Apply remains flexible with the panel width; listed widths are actual measured representative sizes. Footer faces have 4px horizontal target padding on each side, centered explicit 12/16px action text, and 0 button padding. UTC widths stay fluid: ~72/76/76px at tablet, ~85.33/91.33/91.34px at a 320px panel, ~77.33/83.33/83.34px at a 296px panel. Native selects retain their full 40px interactive height, value editing, labels and validation. Close, footer and body scroll ownership stay accepted; on 320×568 and short landscape the dates/time scroll together while Close/Cancel/Apply remain reachable. The seven day columns, availability, selected/today states, keyboard roving focus and PageUp/PageDown are unchanged. There are no visible month previous/next controls to resize.

HistoricalTimeBar, useHistoricalDisclosure, calendar positioning/draft/date algorithms and App replay ownership have no implementation changes. COLLAPSED / EXPANDED / CALENDAR_OPEN, 4,000ms idle, interaction reset/hold, Apply→COLLAPSED, Close/Cancel→EXPANDED, hidden/inert bar during the calendar and exact ±600s requests remain accepted. Short calendar overlays may cover scene controls as in the baseline; foreground calendar controls are tested separately from exposed Current-Earth targets.

## Verification and evidence

Applied frontend-design-codex, software-architect, devops-local-platform, mission-replay, iss-3d-earth-view and iss-3d-station-view. Existing local ownership/ADR-0011 remains; no structural ADR. Baseline Node24 frontend726/60files and Java21 backend382; final frontend **733/61files**, typecheck/build PASS, Java21 `mvn test` **382** and `mvn verify` **382**, no failures/errors/skips. Seven new tests exercise close naming/decorative representations, forwarding, disabled state, outer focus/caller attributes, distinct zoom/Reset callbacks and matching zoom geometry. Existing disclosure/calendar/Crew/module tests keep their assertions. Build retains the existing Cesium chunk-size warning.

Development5175 and production4175 each pass **20 states ×17 sizes =340 captures**, zero geometry failures, clipping, overflow, new collisions or application/console errors, and **1,243 resize observations across11 surface states**. The17-size matrix includes1920×1080,1600×900,1440×900,1280×720,1024×768,900×700,834×1194,820×1180,768×1024,430×932,412×915,390×844,375×812,360×800,320×568,844×390,932×430. Earth GP/OEM/evidence, Current/Historical Crew/details/evidence, collapsed Historical, calendar, Current/Historical Inspection/module and native attribution are included. The unchanged disclosure QA additionally passes16 sizes,6 complete mobile sequences, keyboard/reduced motion and469 resize observations in each build; this covers expanded mobile explicitly and exact UTC stepping/cancellation/Apply focus.

The [secondary face/target harness](validation/secondary-controls-qa.cjs) passes all17 sizes,344 rendered-calendar resize observations (86 widths, both directions, two observations) and emulated touch sequences at390×844,320×568,844×390 in each build. It measures actual pseudo-element faces/outer controls, catches faces larger than their targets, probes center/outer hit space, verifies native credit and Close via keyboard, checks UTC outlines and taps Zoom/Reset, calendar Cancel, Crew/astronaut/credit closes. Native selects retain their browser `auto` focus outline on desktop; compact shared closes use the explicit token outline. Disabled styles/validation retain the original tests. Viewport transport may resolve before native resize delivery; calendar checks wait for that event's first rendered frame before checking the accepted inline portal placement. Source identity and the original Viewer/canvas are retained.

Desktop before/after captures at all4 desktop sizes have **168 identical region rectangles per build**. All120 Zoom/Reset/Close and44 legend foreground masks are identical. Whole-calendar threshold masks differ by1–3 boundary pixels in development and3–10 in production among~93,000 pixels, with the same geometry/typography/content. Full RGB differences are explicitly reported because independently captured real scenes vary behind translucent surfaces; no claim of full-scene RGBA equality. The [fidelity comparator](validation/secondary-controls-fidelity.py) records both bright-foreground masks and underlying RGB variance. The14px desktop glyphs,22px Crew glyph, native credit glyph and accepted faces remain intact.

Reviewed actual desktop1440, tablet768 and short844 screenshots, plus zoom/legend/calendar/footer/UTC/Close/Crew/astronaut/module images at390,360,320. Final faces are proportionate, titles clear and seven-column dates usable. Native credit close uses the same X and reachable outer focus target. QA is Chromium/Metal with emulated touch; physical Safari/iOS/Android devices are not certified.

Representative retained images are limited to **13 lossless WebP captures (~3.8MB)**: desktop before/after Current/calendar, tablet768 calendar, phone390 Current/calendar/Crew/astronaut/attribution,320 calendar/module,844 calendar. Image hashes verify decodedRGBA equality with original PNGs. Full680 after captures,120 before captures, contact sheets, resize corpus and raw logs remain outside Git under `/tmp/mission1-secondary-*`. Final concise gates are recorded in verification.json. External project context `/Users/daniel/Desktop/mission1-project.md` stays outside Git.

```sh
# Node24; real backend8080/local PostgreSQL; no ISS fixtures.
node docs/frontend/ui-restyling-responsive/validation/secondary-controls-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-secondary-development
node docs/frontend/ui-restyling-responsive/validation/secondary-controls-qa.cjs http://127.0.0.1:4175/ production /tmp/mission1-secondary-production
# Existing matrix: set MISSION1_QA_OUTPUT to scratch and MISSION1_QA_VIEWPORTS
# to the17 pairs above, then use responsive-matrix.cjs URL BUILD final.
# Existing controls-qa.cjs and native-responsive-interactions.cjs remain unchanged.
```

Early review caught a rectangular pseudo-face inheriting square height; independent face-height tokens fixed it and the browser harness now guards face bounds. Existing portrait tests caught an unnecessary image element; the shared static SVG is embedded decoratively without altering portrait assertions. Harness corrections preserve native focus outlines, wait for credit layout/native resize delivery and separate foreground popovers from intentionally covered background controls. These were resolved before final gates; no application-state or scene workaround.

The unchanged native interaction suite passes **8 viewport sizes in development and8 in production**: real Earth drag/wheel/zoom/Reset, Inspection orbit/wheel/canonical pose, hover suppression during movement, GPU module picks, dock-edge pass-through, module A→B, color restoration and Back with the original Viewer/canvas. Zero application/console errors. `git diff --check` passes; all210 backend files, all77 existing scene/public/assets files and frozen replay/API/App files remain unchanged. Only the new UI close SVG is added to assets. Normal commit/push details are recorded in the external context and delivery report.
