# Compact top controls — 2026-10-08

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../../qa-artifact-policy.md) for archive recovery and current evidence.

One presentation milestone on `ui/restyling`, starting at `83e95780fd186f1d4c8f1802752e2ab69fa1541a`. `main` remains `12be75af376c0a18e510395ae59c58ee252f3800`. No backend, API, replay, Crew, source-selection or Cesium implementation changes; no dependency or architecture decision. The final ordinary commit is identified by the branch tip and recorded in the delivery report and outside-Git project context.

## Audit and responsive variants

Reviewed `TopContextBar`, `ContextButton`, `TrajectorySelector`, `HistoricalTimeBar`, `HistoricalCalendar`, its draft formatter/UTC rules and calendar CSS, shared styles/tokens and all three existing interface SVGs. Also reviewed reachable Current/Historical Crew headers (Refresh/Close), Historical Crew detail Back, astronaut/module Close, the Inspection Modules/disclosure controls and Earth zoom/reset controls. These additional controls retain their existing presentation and behavior. The legacy Crew toolbar is not part of the redesigned top navigation.

No icon library is installed. `ControlIcon.tsx` supplies seven local SVG action glyphs, using the existing calendar's rounded 1.5-unit outline language, `currentColor`, a square viewBox and **22px** icon boxes. The original calendar asset is retained at 36px (its drawn outline is approximately 20px). No emoji or dependencies.

| Control | ≥1244px, including 1280/1440/1600/1920 | 741–1243px | ≤740px |
| --- | --- | --- | --- |
| Earth, ISS Inspection | Original text | Icon + original text | Icon only |
| Current, Historical | Original text | Icon + original text | Icon only |
| Crew | Original text + original chevron | Icon + text | Icon only |
| Orbital source | Original SOURCE label + GP/TLE / NASA OEM | 116px textual selector; label retained for assistive technology | Same explicit source identities |
| Calendar opener | Original calendar asset/button | Same asset, 44px target | Same asset, 44px target |
| Historical ±10 minutes | Original `-10 min` / `+10 min` text | Directional icons, 44×44px | Same icons/targets |
| Historical selected date | Original full ISO date/time + UTC | Same full ISO UTC string | Two lines: `YYYY-MM-DD`, `HH:MM:SS UTC` |

Only the established 1243/740/600px rules change. Existing 1399/379px and short-height rules remain. There are no new breakpoints, resize hooks, polling, per-frame reads, render-loop changes or responsive React state. Shared selection/focus/disabled rules and all original design tokens stay intact. The desktop string is kept as one text node: an initial split of ISS/Inspection altered desktop text shaping and was removed after pixel comparison.

At ≤600px the first row pairs the wordmark with Earth/Inspection; the second pairs the source with Current/Historical and Crew; the last shows the complete Scene UTC timestamp. This follows native interactive order: **Earth → Inspection → source → Current → Historical → Crew**. It avoids moving Crew ahead of earlier DOM controls. The uppercase date heading is omitted on phones; the full UTC value remains readable. Above 600px the existing flex composition wraps as needed, with consistent 8px compact gaps.

## Date and temporal group

The date formatter uses the existing ISO/UTC convention, without an ambiguous shortened year or locale conversion. Tablet 768/834/1024px retains `2026-10-03 12:04:00 UTC`; phone 430/390/375/360px and very narrow 320px show **2026-10-03** above **12:04:00 UTC**. The `time` element retains the exact requested ISO instant, including milliseconds. Scene UTC continues to identify the presented coherent scene separately from a pending requested Historical target.

The detached Historical surface is one row: **calendar | date/time | previous/next 10 minutes**. Mobile uses 44px controls, an 8px surface gap and a 4px step-pair gap; it does not expand into a second action row. The date is independently clickable, and both original openers retain their dialog relationship and focus restoration. At 320px the selected-date button falls from **214px to 126px**; the Historical surface from **110px to 60px**; the header from **219px to 146px**. At 390px the old header/Historical heights of **198/114px** become **146/60px**. Numeric text remains 14px. The 320px calendar retains its existing content scrolling and seven columns; the selected date remains visible in Scene UTC when the popup overlays the detached bar.

Every top icon has an explicit name: Earth, ISS Inspection, Current, Historical, Crew; steps retain Historical back 10 minutes / Historical forward 10 minutes. The calendar names its action and the date opener now names its full requested UTC. SVGs are decorative and non-focusable. Pressed, expanded, busy, described-by guards and disabled states remain. Active controls retain the full cyan outline, selected fill and brighter icon; selection does not depend on a small color difference. Compact action targets are **44×44px**; source and date targets are at least 44px tall. Calendar/date compact focus uses the existing cyan indicator. Ordinary desktop styling, including default calendar focus/cursor treatment, is preserved.

## Verification and evidence

Node **24.21.0** baseline: **698 tests / 58 files**. Final: **702 / 59**. Four targeted cases cover preserved desktop text, accessible glyph names, independent selection/guards, native order/action dispatch and compact UTC context. Existing calendar, application and replay tests retain exact behavior. Typecheck and production build pass; the pre-existing Cesium chunk warning remains. Java **21.0.3** baseline, `mvn test` and `mvn verify`: **382 tests**, zero failures/errors/skips. Test logs retain concise command results; backend source is unchanged.

- Development matrix and production matrix: **20 states × 15 viewports** each; no page overflow, clipping, collisions, unreachable calendar controls or application errors.
- Desktop fidelity: **160** identical top/calendar geometry and surface-style comparisons; **8** header pixel comparisons in real Historical Inspection at 1920×1080, 1600×900, 1440×900 and 1280×720. Development has zero changed header pixels; production differs by at most one 8-bit channel value from GPU compositing of the unchanged translucent surfaces. Current UTC and translucent scene pixels naturally advance, so whole live screenshots are not asserted byte-identical.
- Development controls and production controls: generated accessible trees, keyboard order/visible focus, actual responsive text/icon visibility, touch geometry, both calendar openers/focus restoration and exact ±600-second requests. **151 widths from 320 to 1440**, including breakpoint neighbors, are checked immediately and on the next animation frame.
- Native interaction summary: both builds verify Earth drag/wheel/reset, native Inspection orbit/wheel, module hover and its suppression during movement, GPU module picks, dock-edge pass-through, color restoration and Earth return across eight desktop/tablet/mobile/landscape sizes.
- Each full matrix also checks **113 widths in 11 open states** without reload, retaining source, selected member/module, requested UTC and Viewer/canvas identity.
- Freeze and visual review: backend/API/Cesium/assets and UI review findings. Screenshot manifest records ten representative captures and verified pixel-identical lossless WebP conversions.

The viewport matrix is 1920×1080, 1600×900, 1440×900, 1280×720, 1024×768, 834×1194, 768×1024, 430×932, 412×915, 390×844, 375×812, 360×800, 320×568, 844×390 and 932×430. States include Current Earth GP/OEM, provenance, Crew/evidence/detail, Current Inspection/module, Historical Earth/calendar/Crew/evidence/detail/Inspection/module and native attribution. All use real local backend responses and the actual controls; no invented station data or shipped QA seams.

The pre-existing servers stopped during one intermediate run and were restarted with unchanged configuration. Excess concurrent GPU QA delayed one supplemental run beyond its initial 30-second wait; the real API state resolved in the subsequent bounded run. Final reports are completed runs, not these interrupted attempts. Chromium/Metal and synthesized native touch are covered; this run does not certify physical Safari/iOS/Android hardware. No unresolved layout defect is accepted.

## Representative review

| Evidence | Purpose |
| --- | --- |
| Before desktop Current, after | Original text, geometry, surfaces and hierarchy |
| Before desktop Historical, after | Full desktop date/steps retained |
| Before 320px Historical, after | Reduced height, coherent icon/date group |
| 320px calendar | Seven columns, Close/Cancel/Apply, bounded scroll |
| 430px Current | Action proportions and group balance |
| 1024px Historical | Intermediate icon + text presentation |
| 844×390 Historical | Short landscape reachability |

Only these **ten screenshots** are retained. No new contact sheets, full capture corpus or duplicate production screenshots are committed. Scratch captures stay outside Git under `/tmp/mission1-compact-*`. The outside-Git context is `/Users/daniel/Desktop/mission1-project.md`.

## Reproduction

Use the existing Node 24, Java 21 backend/PostgreSQL, Vite development (5175) and production preview (4175). Build before production QA. Run GPU-heavy jobs sequentially or at limited concurrency.

```sh
MISSION1_QA_OUTPUT=/tmp/mission1-compact-final-dev MISSION1_QA_VIEWPORTS='[[1920,1080],[1600,900],[1440,900],[1280,720],[1024,768],[834,1194],[768,1024],[430,932],[412,915],[390,844],[375,812],[360,800],[320,568],[844,390],[932,430]]' node docs/frontend/ui-restyling-responsive/validation/responsive-matrix.cjs http://127.0.0.1:5175/ development final
node docs/frontend/ui-restyling-responsive/compact-navigation/controls-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-compact-controls-dev
```

Repeat with production URL/build/output paths. `retain-evidence.py` condenses the before/development/production matrices and verifies the retained lossless images. `git diff --check` and the final commit/push verification accompany delivery; only `ui/restyling` is committed and pushed. `main` is neither modified nor merged.
