# Responsive navigation and mobile Historical disclosure — 2026-10-08

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../../qa-artifact-policy.md) for archive recovery and current evidence.

Starting branch: `ui/restyling`, `370054725eb197f48842774b5aa72612fae2a349`. Main remains `12be75af376c0a18e510395ae59c58ee252f3800`, without modification or merge. This focused milestone supersedes the prior text / icon+text / icon navigation policy.

## Representation

| Width | Earth / ISS Inspection / Current / Historical / Crew |
| --- | --- |
| ≥1244px | Icon + text, accepted desktop widths, 6px internal gap |
| 741–1243px | Text only, zero icon gap/padding; widths 64 / 116 / 80 / 96 / 64px |
| ≤740px | Icon only, 22px SVG boxes and 44×44px targets |

The existing 1399px rule adjusts desktop margins; 1243px owns wrapped compact layout, 740px owns mobile representation and disclosure, 600px owns phone header grid, and 379px owns narrow spacing. No new width breakpoint or dependency. Height/coarse-pointer/summary/calendar rules remain accepted. Full “ISS Inspection” text fits tablet; its accessible name is identical at every width. Technical source selection stays textual, 128px desktop / 116px compact. Decorative SVGs have `aria-hidden`, empty image alternatives and no extra spoken names. Pressed/disabled/Crew busy/expanded guards remain unchanged.

## Three-state presentation

| Trigger | From | To / effect |
| --- | --- | --- |
| Enter mobile Historical | Current / absent controls | `COLLAPSED` |
| Compact calendar activation | `COLLAPSED` | `EXPANDED` |
| Four seconds idle | `EXPANDED` | `COLLAPSED` |
| Pointer movement / activation / ±10m | `EXPANDED` | Reset one four-second window |
| Held pointer or keyboard focus | `EXPANDED` | Pause until release or focus departure |
| Expanded date or calendar activation | `EXPANDED` | `CALENDAR_OPEN`, cancel idle timeout |
| Apply valid UTC draft | `CALENDAR_OPEN` | `COLLAPSED`, existing target callback exactly once |
| Close / Cancel / Escape / outside cancellation | `CALENDAR_OPEN` | `EXPANDED`, restart idle window |
| Leave Historical / unmount | Any | Cancel timer/listeners and discard draft |
| Leave mobile | Collapsed / expanded | Persistent `EXPANDED`, no timer |
| Leave mobile with calendar open | `CALENDAR_OPEN` | Preserve calendar, restore persistent bar |
| Enter mobile | Persistent bar | `COLLAPSED` |
| Enter mobile with calendar open | `CALENDAR_OPEN` | Preserve calendar, hide detached bar |

`useHistoricalDisclosure` owns only this transient presentation state. App remains the single owner of requested/accepted Historical time. One nullable timeout handle is cleared before rearming and on every lifecycle boundary; matchMedia subscribes to the existing 740px threshold. Pointer release/cancel is observed on the document so a gesture ending outside the bar cannot leave it paused. No polling, new replay session, source/data substitution or per-frame production work.

The collapsed icon retains the existing calendar SVG (36px asset box, 20px outlined ink) in a 44px target. Date and step children are `hidden` while collapsed. During the mobile calendar, the entire detached section is invisible, inert and excluded from speech; retaining its layout rectangle preserves existing calendar anchoring without changing the portal implementation. Desktop/tablet calendar and persistent-bar behavior are unchanged.

Focus returns after destination DOM visibility updates: cancellation to the opener (date when opened from date), Apply to the compact disclosure, automatic collapse to that disclosure if focus was in the bar. Keyboard focus pauses idle collapse, so a focused date/step cannot disappear; cancellation restarts the idle window, with the same focus protection. Current return retains the existing Current focus behavior. The disclosure has the explicit name “Open Historical controls”, collapsed expanded state and a surface reference; calendar openers retain `aria-haspopup="dialog"`, expanded state and calendar reference. The non-modal dialog's seven columns, roving date focus, UTC fields, validation, scroll owners and Close/Cancel/Apply semantics remain unchanged.

New disclosure fades are opacity-only using `--motion-fast` (120ms). Existing bar/calendar presence respects reduced motion with short inert exits; the semantic idle interval remains **4,000ms**.

## Verification and evidence

The 24 deterministic disclosure tests cover initial state, full expansion, exact idle boundary, both step resets, movement/activation reset, held pointer release/cancel outside, keyboard focus protection, automatic focus return, hidden/inert calendar bar, four cancellation paths, Apply exactly once, all resize states, persistent non-mobile behavior, Current/re-entry cleanup, unmount subscriptions and reduced motion. Existing calendar/replay/application tests retain their contracts.

Native browser QA uses real local API data and the existing Viewer, without ISS fixtures. The [controls script](controls-qa.cjs) asserts CSS icon/text variants, accessible trees, focus order, target sizes, zero phantom icon spacing, geometry/overflow, the exact mobile interaction sequence, ±600 seconds, distinct Apply/cancellation focus, keyboard behavior, continuous resizing and legitimate open-calendar preservation. The existing [native scene script](../validation/native-responsive-interactions.cjs) covers drag/wheel/reset/orbit/hover/picking/dock boundaries/color restoration/Back; its only change is an optional scratch-output directory.

```sh
node docs/frontend/ui-restyling-responsive/navigation-disclosure/controls-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-disclosure-development
node docs/frontend/ui-restyling-responsive/navigation-disclosure/controls-qa.cjs http://127.0.0.1:4175/ production /tmp/mission1-disclosure-production
MISSION1_QA_OUTPUT=/tmp/mission1-disclosure-native-development node docs/frontend/ui-restyling-responsive/validation/native-responsive-interactions.cjs http://127.0.0.1:5175/ development
MISSION1_QA_OUTPUT=/tmp/mission1-disclosure-native-production node docs/frontend/ui-restyling-responsive/validation/native-responsive-interactions.cjs http://127.0.0.1:4175/ production
```

Use Node 24, the existing Playwright module, Java 21 backend8080 and real local PostgreSQL. Validation viewport matrix: 1920×1080,1600×900,1440×900,1280×720,1024×768,900×700,834×1194,768×1024,430×932,412×915,390×844,375×812,360×800,320×568,844×390,932×430. The last two widths use tablet text-only representation. Generated captures remain outside Git; only representative settled before/after images and concise reports/log excerpts are retained here. Physical Safari/iOS/Android devices are not certified by Chromium/Metal QA.

Baseline: frontend **702 tests / 59 files**, backend **382 tests**. Final: **726 frontend tests / 60 files**, typecheck and build PASS; Java 21 `mvn test` and `mvn verify` each **382 tests**, no failures/errors/skips. Both browser builds pass all **16 viewports**, **6 complete mobile sequences**, keyboard/reduced motion, **469 resize observations** (116 widths in both directions, immediate + next frame, plus 5 calendar-preservation sizes), and **8 native scene sizes**, with zero application/console errors. Crew, GP/OEM, requested UTC, original Viewer/canvas and input regressions pass. `git diff --check` passes. All 210 backend and 77 scene/public/asset files, App replay ownership and calendar/draft/API implementations have zero changes.

Final gate results, image hashes and scope evidence are in verification.json. Ten retained lossless images (two before / eight after) have decoded RGBA equality verified; native contact sheets and intermediate captures stay outside Git. The existing Cesium build chunk warning remains. A CSS specificity defect caught in early mobile target QA was fixed before final checks. Harness corrections inject the standalone geometry function into the browser, settle screenshots after entry fades, and wait for matchMedia delivery when an open calendar retains its state across resizing; the corrected resize segment was rerun in both builds without application changes.

Representative desktop icon + text, tablet text, mobile collapsed, expanded, and calendar with hidden bar show the final composition.

No significant architecture change: existing local React ownership and replay boundary (ADR-0011) remain intact. Applied frontend-design-codex, software-architect, devops-local-platform and mission-replay, with quality/provenance guidance reviewed. Shared visual runtime is absent; native Playwright geometry, accessibility, screenshots and visual inspection provide the equivalent checks. External project context stays in `/Users/daniel/Desktop/mission1-project.md`, outside Git.
