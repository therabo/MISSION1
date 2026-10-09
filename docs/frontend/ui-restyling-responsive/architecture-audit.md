# Responsive architecture audit — 2026-10-09

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](../qa-artifact-policy.md) for archive recovery and current evidence.

This audit preserves the accepted desktop, tablet and mobile presentation on `ui/restyling`. It reviews the actual branch against `main`, then corrects layout ownership and redundant constraints without changing data, interaction modes, camera/model or backend behavior.

## Baseline and methodology

Repository `/Users/daniel/Desktop/MISSION1` began **clean**, branch `ui/restyling`, HEAD `e0780705580bf23c841f0a415ed56ce9601a52d0`. Fetch succeeded. Local/reference main and merge base are `12be75af376c0a18e510395ae59c58ee252f3800`. Neither main nor its history is modified or merged. The complete main...ui comparison contains 2,404 paths / 2,069,112 additions / 396 deletions, largely the existing QA corpus. The frontend source comparison contains 81 paths / 5,401 additions / 396 deletions; fonts, assets and tests are included in those counts. No old evidence is regenerated or deleted.

Read project instructions, the external project context (particularly milestones 53–57), responsive inventories/dossiers/validation companions, actual changed renderers and all six CSS files. Applied frontend-design-codex, software-architect, devops-local-platform, iss-3d-earth-view, iss-3d-station-view and mission-replay. Existing React resource ownership, stable Cesium lifetime and effective-time boundary ([ADR-0011](../../adr/0011-effective-time-mission-replay.md)) remain. These local presentation corrections introduce no significant architecture/dependency/state-owner decision requiring a new ADR.

The declaration ledger records both baseline and final classifications; removed geometry is distinguished from overwritten patches. The review separates **CSS units**, **SVG ink coordinates**, **animation progress**, **color percentages**, **measured DOM rectangles** and **physical scene/orbital units**. A `1.5` SVG stroke is an optical primitive; a computed calendar `left` in CSS pixels is a measured portal placement, not a screenshot coordinate. Percentages inside colors or keyframes are not container dimensions.

All 802 baseline CSS rule blocks and 1,795 layout/typography declarations were reviewed, including inherited evidence/profile helpers and isolated compatibility presentations. The final stylesheet has 777 rule blocks and 1,768 such declarations. Counts include state/pseudo-element/animation rule blocks; declaration counts exclude animation progress blocks, palette values and timing-only tokens. [Reproducible declaration ledger](validation/architecture-evidence/dimension-decisions.csv) contains every baseline/final dimension or layout declaration (1,843 paired/added/removed records). [Summary and thresholds](validation/architecture-evidence/dimension-summary.json) record the exact scope and counting method. Classification supports judgment; it never triggers a mechanical unit conversion.

Classification vocabulary: `INTENTIONAL_FIXED` (optical/physical primitive), `BOUNDED_FIXED` (control/reading/density bound), `FLUID` (bounded variable space), `CONTENT_DRIVEN` (intrinsic flow), `CONTAINER_RELATIVE` (real containing box), `VIEWPORT_RELATIVE` (scene/body overlay), `BREAKPOINT_VARIANT` (deliberate mode), `ACCIDENTAL_HARDCODE` (removed unjustified constraint), `REDUNDANT_PATCH` (removed superseded rule). No component is `NOT_REVIEWED`.

## Complete component inventory and final verdicts

[Detailed 48-family inventory](validation/architecture-evidence/component-inventory.csv) records **source, parent, layout primitive, width, height, spacing/type units, positioning, every breakpoint/container query, viewport dependency, fixed/percentage/viewport values, bounds, risk and final verdict**. It expands the old 41-family inventory with shared CloseButton, ControlIcon, portrait rights, profile evidence, explicit compatibility branches and scene notices. `CurrentCrewPanel`/`CurrentCrewPanelView`, `CrewWorkspaceContent`, `CrewRosterRow`, `AstronautProfileResource`, `CrewReports`, `CrewSources`, `PresenceLabel`, `CrewProfile`, `CrewMemberDetail` and native Cesium credit children are mapped to their owners; none is omitted. Loading/empty/error/retry/disabled/selected/broken-image/evidence/exit states share those owners. Motion/native helpers and assets are included even though they have no independent DOM sizing box.

| # | Component | Before → final sizing/layout strategy | Verdict |
| --- | --- | --- | --- |
| 1 | Shell / full-screen scene | fixed bottom row → minimum + max-content | `REFACTORED` |
| 2 | Brand wordmark | absolute logo + spacer → real brand in cell | `REFACTORED` |
| 3 | TopContextBar / spatial navigation | flex / five-group grid / phone grid retained | `INTENTIONAL_BREAKPOINT` |
| 4 | ContextButton / selected-disabled-focus states | bounded control primitive retained | `INTENTIONAL_FIXED` |
| 5 | Orbital source select / value / chevron | absolute Y offsets → grid vertical alignment | `REFACTORED` |
| 6 | Scene UTC / temporal navigation / Crew entry | same modes and centered compact row; midpoint chevron | `INTENTIONAL_BREAKPOINT` |
| 7 | OperationalSummary identity / position cells | fixed heights → minima; row grows with content | `REFACTORED` |
| 8 | Orbital source quality disclosure / evidence | viewport width → parent bound; trigger minima | `REFACTORED` |
| 9 | DataLine / provenance / notices / model note | bounded keys + wrapping values / prose retained | `CORRECT_AS_IS` |
| 10 | TrajectoryLegend / source swatch | intrinsic width and accepted density retained; dead rules removed | `INTENTIONAL_FIXED` |
| 11 | SceneControls zoom / Reset | bounded face/actual target retained; dead86px removed | `INTENTIONAL_FIXED` |
| 12 | HistoricalTimeBar / UTC / steps | bounded parent-fluid bar and three states retained | `INTENTIONAL_BREAKPOINT` |
| 13 | HistoricalOrbitalSummary / no-data / lineage | shared content-growing summary; semantics retained | `REFACTORED` |
| 14 | HistoricalCalendar panel / month / Close | same placement/state; overwritten600px heights removed | `REFACTORED` |
| 15 | Calendar weekday / day grid / focus states | seven controlled tracks retained; redundant32px rule removed | `INTENTIONAL_FIXED` |
| 16 | Calendar UTC fields / validation / actions | same accepted field distribution; top offsets → midpoint | `REFACTORED` |
| 17 | InspectionStrip identity / selected module / status | fixed track/cell heights → minimum + auto growth | `REFACTORED` |
| 18 | Inspection Modules / Orbital toggles | bounded container-fitting controls retained | `INTENTIONAL_FIXED` |
| 19 | ContextDock foundation / header / content / footer | foundation retained; module identity now flexible | `CORRECT_AS_IS` |
| 20 | ModuleInfo identity / role / technical body | identity flex1; bounded metadata scroll; scene-relative45% width | `REFACTORED` |
| 21 | Module evidence/provenance footer | 100px height → minimum; wrapping retained | `REFACTORED` |
| 22 | Crew workspace host / temporal group | parent-relative grid span retained | `CORRECT_AS_IS` |
| 23 | CurrentCrewPanel / header / loading/error/retry | unchanged content-driven panel; no Refresh | `CORRECT_AS_IS` |
| 24 | Crew roster summary / counts / assessment | same tracks and actual container-query adaptation | `INTENTIONAL_CONTAINER_QUERY` |
| 25 | Crew roster columns / rows / mission / agency / presence | remove count multiplication/inline count; actual rows own minima | `REFACTORED` |
| 26 | Crew quality / reports / source evidence | wrap/scroll and open-evidence full row retained | `CORRECT_AS_IS` |
| 27 | CrewPortrait / initials / failed image | intentional fixed square retained | `INTENTIONAL_FIXED` |
| 28 | Crew astronaut split layout / selected row | named width/gap; remove redundant1399 detail patch | `REFACTORED` |
| 29 | CrewAstronautDock / heading / member selector | bounded overlay/actual scroll owners retained | `CORRECT_AS_IS` |
| 30 | Astronaut presence / assignment / mission / technical fields | wrapping body / flexible values retained | `CORRECT_AS_IS` |
| 31 | Astronaut biography / errors / unavailable / rights | same expandable biography and usable Retry | `CORRECT_AS_IS` |
| 32 | Astronaut source footer / presence evidence | same footer and explicit source evidence retained | `CORRECT_AS_IS` |
| 33 | Historical CrewPanel / detail navigation | shared panel; row count floor removed by shared refactor | `REFACTORED` |
| 34 | Historical CrewProfile / biography / career / sources | flow profile in one scroll owner retained | `CORRECT_AS_IS` |
| 35 | CrewTemporalNotice / pending / error / Retry | content-owned notice/Retry retained | `CORRECT_AS_IS` |
| 36 | ReplayControls compatibility | isolated compatibility strategy retained/tested | `INTENTIONAL_BREAKPOINT` |
| 37 | Overlay presence / reduced motion / workspace dissolve | no layout algorithm change / lifecycle retained | `CORRECT_AS_IS` |
| 38 | Inspection feature selection / hover | unchanged renderer and picking | `CORRECT_AS_IS` |
| 39 | Star time presentation | unchanged stable SkyBox | `CORRECT_AS_IS` |
| 40 | Fonts / calendar-source-crew assets | all font/SVG bytes and accepted icon sizes retained | `INTENTIONAL_FIXED` |
| 41 | Native attribution dialog / title / links / Close | accepted bounded native attribution retained | `INTENTIONAL_FIXED` |
| 42 | CloseButton shared visible face / actual target | same real targets and optical faces retained | `INTENTIONAL_FIXED` |
| 43 | ControlIcon action family / zoom glyphs | fixed optical icon primitive retained | `INTENTIONAL_FIXED` |
| 44 | CrewPortraitRights shared evidence | shared wrapping evidence retained | `CORRECT_AS_IS` |
| 45 | CrewProfileEvidence shared source disclosure | wrapping evidence and semantic labels retained | `CORRECT_AS_IS` |
| 46 | LegacyCrewPanel / CrewSummary / PresenceLabel / CrewMemberDetail | reviewed, kept isolated; Refresh remains absent | `INTENTIONAL_BREAKPOINT` |
| 47 | Legacy OrbitalStatus / TrajectorySelector presentation | reviewed fallback semantics; active evidence uses parent bound | `INTENTIONAL_BREAKPOINT` |
| 48 | Current/Historical scene issue and retry notice | add overflow-wrap:anywhere; same notice geometry | `REFACTORED` |

## Unit decision table

This table gives the component-level decisions. The linked declaration ledger supplies property-by-property coverage for the complete stylesheet, including fixed spacing/type literals, state variants, legacy rules and removed declarations.

| Component | Property | Before | Classification | Final | Reason |
| --- | --- | --- | --- | --- | --- |
| Shell | Height / canvas | 100dvh / inset0 | VIEWPORT_RELATIVE | Same | Dynamic browser chrome changes the full-screen scene, not a card width. |
| Overlay shell | Operations track | Fixed80/120/132px token | ACCIDENTAL_HARDCODE → CONTENT_DRIVEN | minmax(token,max-content) | Existing density is a minimum; extra lines may grow and reduce actual scene row. |
| Brand | DOM ownership / position | Empty120px identity spacer; separate absolute logo | ACCIDENTAL_HARDCODE | Actual logo inside identity grid/flex cell | The logo determines its own cell; compact gutters/date rows need no compensating offsets. |
| Brand | Optical box | 120×28px | INTENTIONAL_FIXED | Same | Accepted wordmark appearance; native2172×724 attributes are asset dimensions, not screen geometry. |
| Brand | Dormant fluid width | clamp144/16vw/180; mobile120/34vw/144 | REDUNDANT_PATCH | Removed | Always superseded by the restyled120px optical box. |
| Top navigation | Groups / height | Flex desktop; five auto tracks compact; three phone tracks | BREAKPOINT_VARIANT | Same | Representation/whole-group distribution changes deliberately; no fake centering spacer. |
| ContextButton | Height / width | 36 desktop;44 compact; caller width | BOUNDED_FIXED | Same | Physical hit target and finite action label; never percent-scaled. |
| Source selector | Width | 128/116px | BOUNDED_FIXED | Same | Two finite technical source labels and native interaction area. |
| Source selector | Value and arrow Y | top9.5/13.5 and15.25/19.25px | ACCIDENTAL_HARDCODE | Same grid cell, vertically aligned | Derived center formerly repeated per height; normal output is identical. |
| Source selector | Horizontal inset | 16/12px;11.25/9.25px arrow | INTENTIONAL_FIXED | Same margins within grid cell | Typography/ink clearance; not page alignment. |
| UTC / temporal / Crew | Date / controls | 220×36px desktop; independent full row compact | BREAKPOINT_VARIANT | Same | Finite ISO UTC text, stable controls and symmetric compact gutters. |
| Crew entry | Chevron Y | top12.25/16.25px | REDUNDANT_PATCH | top50% + translateY(-50%) | Midpoint of its own control; same optical coordinates. |
| OperationalSummary | Columns | repeat5 minmax0,1fr; phone three×two | CONTAINER_RELATIVE | Same | Actual grid distribution, shrinkable tracks. |
| OperationalSummary | Child boxes | fixed38/50px | ACCIDENTAL_HARDCODE | min-height38/50px | Additional status/identity lines can grow. |
| Orbital status trigger | Slot / summary height | fixed38/50px | ACCIDENTAL_HARDCODE | minimum38/50px | Shared source-state content remains intrinsic. |
| Orbital evidence | Width | min420px,100vw−48; phone100vw−24 | CONTAINER_RELATIVE | min420px,parent−48; phone parent−24 | A grid-area child follows its scene container. |
| Orbital evidence | Height / scroll | scene100%−24 max; ownY scroll | FLUID | Same | Actual scene row bounds content; no full-height fake sidebar. |
| DataLine / notices | Key / value | 105px basis;min-width0 dd;anywhere wrap | BOUNDED_FIXED / CONTENT_DRIVEN | Same | Stable readable label gutter, variable provenance value. |
| Legend | Width / backing | content-sized;8/6/5/4px backing | CONTENT_DRIVEN | Same | Finite technical label and fixed optical marker; percentages inappropriate. |
| Legend | Row / marker | 28/24/22/20px;24/20/16/14×2px | INTENTIONAL_FIXED | Same | Discrete accepted optical density. Superseded36px/68px-bottom/narrow duplicate rules removed. |
| Scene controls | Zoom faces / targets | 38/34/32 faces;44/44/40 targets | BOUNDED_FIXED | Same | Actual button owns hit box; face remains centered and bounded. |
| Scene controls | Reset | 124/112/102/92 targets | BOUNDED_FIXED | Same | Finite action text and rectangular visible face. Unreachable86px intermediate rule removed. |
| Historical bar | Width | min760,parent−48;compact max520;phone parent−24 | FLUID | Same | Content group within variable scene width, with useful maximum. |
| Historical disclosure | Collapsed box | 44×44px | BOUNDED_FIXED | Same | Explicit interaction primitive; no percentage growth. |
| Historical summary | Cells / evidence | Shared fixed summary heights | CONTENT_DRIVEN | Shared minimum/content tracks | Same coherent UTC/source/no-data semantics. |
| Calendar portal | Position / clearance | Measured anchor or compact viewport center;12/8px clearance | VIEWPORT_RELATIVE / INTENTIONAL_FIXED | Same | Body portal must use actual safe scene rectangles and viewport center. |
| Calendar panel | Width / height | 280px;phone min320,viewport−24;available scene height | FLUID / BOUNDED_FIXED | Same | Reading/day geometry bounded by actual available space. |
| Calendar month / Close | Row / target | 28 desktop;44 compact;40 narrow | BOUNDED_FIXED | Same | Pinned interaction row; remove overwritten32px phone exception. |
| Calendar day grid | Columns / days | 7 minmax0,1fr;28 desktop/44 compact high | CONTAINER_RELATIVE / BOUNDED_FIXED | Same | Seven controlled tracks; narrow width does not distort optical day height. |
| Calendar grid | Baseline min-height | 156px | BOUNDED_FIXED | Same | Minimum five-row desktop grid plus four4px gaps; sixth week grows naturally. Dead176px phone minimum removed. |
| Calendar UTC | Group / selects | 42px desktop;54px compact;28/40px select target | BOUNDED_FIXED | Same | Label+gap+target owns height; smaller visible face is independent. Overwritten36/44/50px phone rules removed. |
| Calendar UTC | First-field basis / separator | calc((100%−40px)/3);8px separator | CONTAINER_RELATIVE / INTENTIONAL_FIXED | Same | Parent-relative distribution preserves accepted first-field/gap geometry;40 is bounded baseline gap/separator compensation, not viewport positioning. |
| Calendar UTC | Arrow Y | 11.25/19.25/17.25px offsets | REDUNDANT_PATCH | Midpoint of own control | Optical9.5×5.5px arrow remains exact in28/40/44px controls. |
| Calendar footer | Cancel / Apply |96/88/80/72px Cancel;flex1 Apply | BOUNDED_FIXED / FLUID | Same | Fixed finite cancellation label, flexible primary action. |
| InspectionStrip | Tracks / cells | Fixed40/44/68px;mobile fixed40,68 rows | ACCIDENTAL_HARDCODE | Same minima; auto upper bounds | Long selected identity/labels can grow naturally. |
| Inspection toggles | Width / target |136/148 desktop;100% track compact;44 high | BOUNDED_FIXED / CONTAINER_RELATIVE | Same | Remain bounded controls inside distributed cells. |
| ContextDock | Foundation |336px overlay;flex column;min-height0 scroll | BOUNDED_FIXED | Same | Feature supplies ownership and bounds; generic720px fallback remains isolated. |
| ModuleInfo | Identity |236×56px | ACCIDENTAL_HARDCODE | flex1,min-width0,min-height56px | Close gets its own bound; title/context determine height. |
| ModuleInfo | Header |89px fixed; unbounded sticky metadata on phone/short screens | ACCIDENTAL_HARDCODE | min-height89px; desktop/tablet max50% of dock; phone title3lh/identifier2lh with own scroll | Normal density retained. Extreme 150% long metadata previously hid Close and obscured the body. A parent-relative header budget and line-based phone reading windows preserve both. |
| ModuleInfo | Width |336px /45vw mobile | CONTAINER_RELATIVE |336px /45% scene parent | Component depends on the scene grid area; accepted full-width shell renders identically. |
| Module body | Technical key / value |124px minmax0,1fr | BOUNDED_FIXED / CONTAINER_RELATIVE | Same | Reading gutter plus shrinkable/wrapping value; compact rows stack. |
| Module evidence footer | Height |100px fixed | ACCIDENTAL_HARDCODE | min-height100px | Additional evidence lines remain in flow; phone auto remains. |
| Crew host / group | Width / height |100% parent;24/12px margins; scene+operations span | CONTAINER_RELATIVE | Same | CSS owns workspace; does not resize or crop the native canvas. |
| CurrentCrewPanel | Header / scroll |min51px;flex1,min-height0 body | CONTENT_DRIVEN | Same | Long title/error flows; Close remains bounded; Retry conditional. |
| Crew counts / assessment | Tracks |280/280/300/remainder;224/224/244 detail;compact fr | BOUNDED_FIXED / CONTAINER_RELATIVE | Same | Accepted reading/density bounds; container queries protect reduced roster space. |
| Crew rows | Height bookkeeping |count×62.55556/65.55556px parent floor + child minima | REDUNDANT_PATCH | Parent min-height0; actual flex rows own minimum | Count cannot predict text height; real children and scroll owner determine content extent. |
| Crew rows | Density floor |62.55556/65.55556px repeated | BOUNDED_FIXED | One --crew-row-min-height per temporal presentation | These inherited fractional minima are deliberately retained to preserve accepted row density; they are not a fixed row height or screenshot-dependent total. Content may exceed them. |
| Crew row | Columns / identity |40px portrait + minmax0,1fr + bounded scientific fields | CONTAINER_RELATIVE | Same | Name shrinks/wraps; evidence stays a distinct field. |
| Crew quality / source reports | Width / height |Flow details;open mobile evidence spans full row | CONTENT_DRIVEN | Same | Source labels/hash/limitations wrap inside actual scroll owner. |
| CrewPortrait | Box / image |40/54px square;img100%×100%;cover | INTENTIONAL_FIXED / CONTAINER_RELATIVE | Same | Portrait primitive is square; percentage fills that fixed square. |
| Crew split | Remaining roster width |calc100%−360px | ACCIDENTAL_HARDCODE |calc(parent−detail width−detail gap) |336px dock and existing24px primary gutter are named owners, with no duplicated aggregate. |
| Crew split |1399 viewport patch |Repeat three-column assessment already selected by container | REDUNDANT_PATCH |Removed |At1399 the detail roster content is at most943px, already below983;700 query continues stacking independently. |
| Astronaut dock | Width / height / position |336px;parent100%;absolute overlay | BOUNDED_FIXED / CONTAINER_RELATIVE |Named336px; otherwise same |Independent entering/exiting overlay intentionally survives roster-width motion; replacing it with normal-flow tracks would change accepted exit behavior. |
| Astronaut fields | Key/value / typography |124px key;zero-min value;13/19 and14/20px | BOUNDED_FIXED / CONTENT_DRIVEN |Same |Reading columns wrap and body owns scrolling. |
| Astronaut biography / errors | Width / height |Flow sections;details for long biography |CONTENT_DRIVEN |Same |No independent fixed content height; genuine Retry usable. |
| Astronaut footer | Width / height |100% button;min100px;phone intrinsic |CONTAINER_RELATIVE / BOUNDED_FIXED |Same |Visible footer and evidence body retain separate responsibilities. |
| Historical Crew | Panel / row layout |Shared Crew workspace/row minimum bookkeeping |CONTENT_DRIVEN |Shared parent bounds; actual child row floor |No change to effective-time or latest-profile labels. |
| Historical CrewProfile | Profile flow |Intrinsic prose/career/details |CONTENT_DRIVEN |Same |Container scroll owns long names/biography/evidence. |
| CrewTemporalNotice | Notice / Retry |Content flow |CONTENT_DRIVEN |Same |Request error is information inside the workspace, not an independently positioned card. |
| ReplayControls compatibility | Width / wrap |Legacy viewport max + flex-wrap |VIEWPORT_RELATIVE |Same |Isolated optional component, not reachable from restyled App; tests retained. |
| Overlay motion helpers | Translate |16/8/6px,120–280ms |INTENTIONAL_FIXED |Same |Optical transition excursion; no layout sizing or polling. |
| Native feature / hover | Scene geometry |Existing model / projection / colors |CONTENT_DRIVEN (no CSS box) |Same |Physical scene units and native GPU picking are frozen. |
| Star helper | Scene extent |Native SkyBox |VIEWPORT_RELATIVE (scene) |Same |No CSS panel geometry. |
| Fonts / assets | Type / optical ink |Inter/Roboto Mono;pixel fonts;em tracking;local SVGs |BOUNDED_FIXED |Same |Exact accepted metrics; no broad px→rem conversion for conceptual uniformity. |
| Native attribution | Width / height / Close |min470,parent−24;100dvh−24;44/40px close |FLUID / VIEWPORT_RELATIVE / BOUNDED_FIXED |Same |Body overlay is genuinely viewport-dependent; native link scroll remains. |
| CloseButton | Face / target / X |38/32/30px face;44/40px target;18/16/14px X |BOUNDED_FIXED |Same |All reachable closes retain compact optical face and usable actual target. |
| ControlIcon | Optical box / stroke |22px primary;viewBox24;stroke1.5 |INTENTIONAL_FIXED |Same |SVG ink coordinates are stable internal geometry. |
| Portrait rights / profile evidence | Width / height |Flow details in owning profile |CONTENT_DRIVEN |Same |No viewport or fixed card dimension. |
| Legacy Crew components | Bounds / controls |Legacy344/310px or58dvh panel;44 controls |BOUNDED_FIXED / VIEWPORT_RELATIVE |Same |Supported compatibility branch; unrelated old modes are reviewed, not deleted. |
| Legacy Orbital/selector | Panel bounds |Legacy viewport/height constraints |VIEWPORT_RELATIVE |Same |Not used by accepted restyled App; inherited evidence typography is still reviewed. |
| Scene issue notice | Width / text |Parent bound;no explicit unbroken-text wrap |CONTENT_DRIVEN |overflow-wrap:anywhere |Long test-only errors remain within the actual surface. |
| Borders / focus / corners | Optical chrome |1/2px borders;2px outline;4/6px radii |INTENTIONAL_FIXED |Same |Hairlines/focus/optical curvature are physical primitives. |
| Secondary faces | Position / width |Local absolute50% midpoint;rectangular100%−8 |CONTAINER_RELATIVE |Same |Percentages refer to their actual control, not the viewport; no scale transform. |

## Breakpoints and container ownership

47 baseline conditional blocks were reviewed:45 media blocks and2 container queries. Final46 blocks:44 media and2 container queries. Repeated declarations within one deliberate breakpoint are not automatically duplicate patches; component files independently own feature rules. There are no new thresholds.

| Threshold | Classification / purpose | Outcome |
| --- | --- | --- |
|1399 / complementary1244 | CONTENT_REQUIRED: desktop navigation margins reduce before intrinsic groups exceed available row; full Crew counts switch to fr tracks | Retained. Only the separate **detail**1399 patch was REDUNDANT and removed. |
|1243 / ≥1244 | PRESENTATION_MODE: desktop icon+text and64px row → compact text-only groups, independent centered date and44px targets | Retained exactly. |
|740 / ≥741 | PRESENTATION_MODE: tablet text → phone icons; mobile disclosure; summary/Inspection stacked rows; phone astronaut overlay | Retained exactly. Heights do not change this semantic mapping. |
|600 / ≥601 | CONTENT_REQUIRED: five icon/source/brand groups become two action rows plus date; phone calendar max320px | Retained. Overwritten calendar-height rules at this breakpoint removed; phone panel width remains. |
|379 / ≥380 | CONTENT_REQUIRED: narrow320–379px optical secondary density/spacing;40px target compromise | Retained. Dead86px Reset and duplicate legend backing removed. |
|620px height | CONTENT_REQUIRED: module/astronaut whole-surface scroll with sticky header; calendar body and native attribution bound to actual height | Retained. Wide but short screens need genuine height handling. |
|500px height with ≥601px width | CONTENT_REQUIRED: reduce top padding by4px each side, recovering8px scene space | Retained. Brand now follows row alignment automatically. |
|crew-roster983px content width | CONTENT_REQUIRED: detail-neighbor counts/assessment become equal count columns + assessment row | Retained. Boundary matches224+224+244+72px gaps plus ~220px timestamp reading width. |
|crew-roster700px content width | CONTENT_REQUIRED: detail-neighbor roster records stack and summary becomes two columns | Retained; actual parent-width boundary checks at700/701 and983/984 pass. |
|720 /1100 /820,700/701 legacy widths;721 legacy height companion | LEGACY_PATCH / isolated compatibility policy | Retained in optional legacy presentations/foundation; not mounted by accepted restyled App. Removing those independently supported APIs is outside this audit. |
|coarse pointer ≤1243 | CONTENT_REQUIRED interaction policy: actual native attribution link target and reserved scene/host bottom gutter | Retained; emulated touch checks separate from pointer-fine matrix. |
|prefers-reduced-motion | PRESENTATION_MODE: opacity-only short motion, no semantic timer/scene change | Retained. |

The roster container has `container:crew-roster / inline-size`; its query width is the **content box**, not the viewport. Existing983/700 queries are sufficient; no new container query is needed. Module mobile width now follows45% of its full-width **scene parent**. Evidence is bounded by that same parent. Other component-space decisions use normal grid/flex/intrinsic sizing, not global queries. The enlarged module-title test exposed a sticky header larger than its dock at320×568 and844×390. The desktop/tablet header now has a half-dock maximum with a stretchable, scrollable identity; phone title/identifier reading windows use3lh/2lh, retain all normal verified module names and scroll exceptional text. Close remains in its own cell and the body/footer stay reachable. These local bounds introduce no viewport dependency or JavaScript measurement.

The astronaut overlay keeps absolute placement because its independent exit animation and retained inert contents are intentional; normal card content remains in flow.

## Height / aspect / scroll findings

| Size | Presentation and finding |
| --- | --- |
|1920×700 | Desktop primary modes retained; actual scene bounds constrain evidence/module/calendar. No viewport-height column is invented. |
|1366×768 | Desktop reduced navigation margins; bounded reading panels and normal content scroll fit. |
|1280×720 | Desktop modes retained, last narrow desktop range; all groups fit without breakpoint compensating coordinates. |
|1024×600 | Text-only navigation;620px height policy gives whole-dock scroll and bounded calendar content. |
|932×430 | Persistent tablet Historical mode retained; short header padding, calendar body scroll and reachable actions. |
|844×390 | Persistent tablet Historical mode retained; no mobile disclosure triggered by landscape alone. Calendar anchored as accepted, with bounded content. |
|320×568 | Icon-only phone; collapsed/expanded/calendar-open state retained; centered calendar body scroll; pinned Close/Cancel/Apply; stacked roster and bounded detail. |

Full matrix also includes1920×1080,1600×900,1440×900,1024×768,900×700,834×1194,820×1180,768×1024,430×932,412×915,390×844,375×812 and360×800. The document does not scroll. `crew-panel-content`, `astronaut-profile-body`, module content or compact/short whole dock (with separate oversized metadata scroll), orbital evidence, `calendar-body`, and native attribution each own their appropriate scrolling. No DOM box is intentionally left larger than its controlling surface to compensate for scaled ink.

## Navigation and Historical freeze

Compact visible date text remains viewport-centered through an independent full-width grid row between symmetric gutters, not side-group compensation. The empty brand reservation is gone. Native DOM/focus order remains Earth → Inspection → source → Current → Historical → Crew. Accepted desktop uses its original fixed group composition: its visible date center at1440px is56.617px left of the viewport center **before this audit**, and is preserved. Universal desktop centering would change the frozen desktop appearance; this audit does not claim it. Centering acceptance applies to the recent compact navigation correction.

Historical remains `COLLAPSED`, `EXPANDED`, `CALENDAR_OPEN`;4,000ms inactivity, held-pointer/focus pauses, ±600s requests, Apply→collapsed, cancellation→expanded, roving dates and UTC validation are untouched. Compact calendar uses measured viewport center and actual safe scene-height bounds. Persistent short-landscape calendar remains anchored. No magic217px-style anchor or viewport-scaled icon is introduced. Routine Crew Refresh remains absent; actual Retry and automatic resource reads remain.

## Unit findings / pixel verdict

| Unit / construct | Baseline → final declaration tokens | Semantic conclusion |
| --- | --- | --- |
|px |1143 →1094 |Borders, optical icons/faces/targets, reading-column maxima, density minima and approved spacing/type retained; unjustified absolute centers/fixed content heights/redundant overrides removed. |
|rem / em / lh |0 /14 /0 →0 /13 /2 |No mechanical conversion. Em glyph-relative tracking retained; most fonts use accepted optical pixels. Root font enlargement therefore does not enlarge every label; separate actual text-growth stress is required. The two new lh bounds represent three title lines and two identifier lines inside the phone module header; enlarged text remains scrollable. |
|% |54 →62 |Parent shell/image/control fill, minimum-height bounds and local decoration midpoint. Added module/evidence parent fractions replace inappropriate viewport dependency. Color/keyframe percentages excluded. |
|vw /vh /dvh /svh /lvh |20/3/8/0/0 →15/3/8/0/0 |Active shell/body portal/attribution legitimately viewport-relative. Five redundant/inappropriate vw uses removed. Remaining raw vw/vh values largely belong to isolated compatibility panels; they are not introduced into cards. |
|fr |27 →26 |Zero-min grid tracks distribute real space. Removed duplicated detail-summary query accounts for one occurrence. |
|min/max/clamp/minmax |final20/1/0/28 |Meaningful reading/safe-height bounds and structural track minima. Dormant logo clamps removed; no arbitrary fluid replacement of discrete modes. |
|absolute /fixed declarations |31/1 →28/1 |Removed fake brand placement and source value/chevron coordinates. Remaining overlay/decoration/accessibility geometry is intentional. |

Fractional CSS pixel values are not automatically accidental: source-chevron optical insets and inherited Crew row **minimum density** preserve accepted rendering. The row minimum is now one local semantic token per temporal presentation; each real child may grow with content and the list no longer estimates total height from count. A63px rounding or wholesale intrinsic row-density change would alter the accepted visual rhythm without fixing a remaining defect. This is an explicit retention judgment, not an undiscovered magic number.

## Before / after architecture and performance

Before: independently positioned logo plus reserved header box; repeated source/chevron Y centers; fixed content-cell/header/footer heights; unbounded exceptional module metadata; viewport width borrowed by nested panels; aggregate Crew height formula; redundant viewport detail query and overwritten density declarations.

After: real logo grid/flex item; source native select and decoration share a grid cell; local arrows center on their own controls; content uses minimum bounds and intrinsic growth; exceptional module metadata has explicit scrollable reading bounds; evidence/module widths follow their parent; actual Crew children determine list extent; named dock/gap ownership and existing container queries replace duplicated arithmetic/viewport patches.

No runtime dependency, new resize observer, resize polling, per-frame DOM reads or per-frame React layout state is added. Existing event-based calendar placement and workspace ResizeObserver/MutationObserver continue measuring actual rectangles. All backend files, public graphics assets, EarthView, camera, workspace/centroid logic, model/picking/hover, replay/date/disclosure hooks and API resource implementations remain byte-identical to baseline. CSS changes do not move/resize the full-screen Cesium canvas or create a fake excluded sidebar.

## Validation / visual regression

Baseline frontend735 tests /61 files; backend382 under Java21. Native pre-edit6-size×20-state matrix:120 captures, zero geometry/page errors. First candidate equivalent6-size matrix:120 captures, zero failures; surface rectangles identical except two sub-pixel (<0.4px) samples during the retained Crew width transition. These are transient timing, not settled layout differences. Final matrix ordering samples those two panels at a different point in the same animation; a read-only `git archive` of baseline, served temporarily against the same real backend, confirms identical settled workspace/dock rectangles across all six reference sizes in both builds after350ms. The temporary archive does not modify a checkout/ref and its server is stopped.

Visual fidelity evidence: each build has508/510 identical pre-edit surface rectangles (the two retained Crew transitions are checked separately),510/510 identical computed surface styles and1,336 exact fixed-control rectangles. Roster row fractional rounding differs by at most0.078125px after duplicated count arithmetic is removed. One portrait-rights disclosure is20px higher inside a separately scrolled profile body; viewport and content extent are identical, and capture scroll offsets were not frozen. All12 settled Crew build/size comparisons pass. Desktop42 control/legend/calendar regions preserve exact bounds;41 have identical bright-ink masks and the remaining full-calendar crop differs by19 threshold pixels, including15 around the three UTC chevron edges after structural midpoint alignment. Optical SVG sizes/positions and source assets are unchanged; this small raster difference is recorded, not described as pixel equality. Native comparison sheets were reviewed across desktop, tablet, phone,320px, landscape, Crew/detail/evidence, module and attribution. Independent astronomical scene/UTC pixels are not claimed byte-identical.

Final verification records all gates and the hashes of tested source/QA. Each build passes:

| Gate | Development | Production |
| --- | --- | --- |
| 20 viewports ×20 reachable states |400 captures;0 failures |400 captures;0 failures |
| Continuous320→1920px |11 states ×113 widths =1,243 observations |Same;0 failures |
| Navigation/disclosure |16 sizes;6 mobile sequences;keyboard;469 resize observations;reduced motion |Same;PASS |
| Secondary controls |17 sizes;344 calendar resizes;3 touch layouts |Same;PASS |
| Native Earth/Inspection |8 layouts;drag/wheel/zoom/reset/orbit/hover/pick/dock boundary/A→B/Back |Same;PASS |
| Loading/error/empty/long/unavailable |12 states ×20 sizes =240 captures |Same;PASS |
| Font/content/container stress |144 root-font +30 informational growth +4 boundaries |Same;PASS |
| Real-data Crew Retry |4 requests;2 deliberate503s;both recoveries |Same;PASS |

Font tests use root16/20/24px (100/125/150%) plus separate150% actual informational text growth. Module stress checks the last scrollable header text, Close and footer link. The12 edge states include delayed real requests, explicit503 failures, marked24-member long roster/biography, unavailable profiles/history and an unbroken long Current orbital-error label. The last case enters the real orbital503 path, keeps Inspection disabled without usable state, and recovers with the real backend; it never invents orbit values. Every fixture is test-only and marked.

Frontend **736 tests /61 files PASS** (baseline735/61); added one meaningful accessible brand-ownership regression. Typecheck and production build PASS; the existing Cesium chunk-size warning remains. Backend Java21 **mvn test382 and mvn verify382 PASS**, zero failures/errors/skips. `git diff --check` PASS. All332 protected files, including210 backend files, are byte-identical to baseline;10 changed frontend source/test fingerprints match tested files. There are9 runtime files changed, with no state/science/API/asset/renderer/centering changes.

QA corrections are distinguished from application defects: the first disclosure preservation probe sampled before native resize delivery, so that preservation check waits one frame while immediate CSS checks remain. A first secondary attempt saw two temporary backend500 responses during database connection recovery; fresh complete development/production suites pass with zero console errors. The oversized module-header failure required the production CSS correction documented above. Normal matrices, disclosure, secondary and native suites have zero page/console errors; deliberate503 evidence is recorded separately.

Nine representative lossless WebP screenshots total **2,197,694 bytes**. [Visual file manifest](validation/architecture-evidence/visual-files.json) verifies decoded RGBA equals each native PNG, with no resizing/retouch. The complete dimension/inventory CSVs, concise JSON and this report are retained; no massive screenshot corpus is added. [Evidence/reproduction index](validation/architecture-evidence/README.md) links the useful captures and existing tools. Full screenshot corpora and raw logs stay under `/tmp/mission1-architecture-audit`; only concise reports and useful representative lossless evidence are committed. Existing evidence is neither duplicated nor rewritten.

## MISSION1 responsive architecture policy

- Scene and body portals use actual viewport/safe scene bounds. The native canvas stays full-screen.
- Surfaces use grid/flex, shrinkable children, content-owned heights and explicit reading/interaction bounds.
- Controls, portraits and optical glyphs use bounded physical dimensions; smaller visible faces retain actual targets.
- Nested evidence, module widths and Crew detail layouts follow their parent; roster container queries own reduced component space.
- Typography retains approved optical metrics where frozen; reusable spacing uses the existing small token set. Introduce rem or new tokens only for a concrete content/scale requirement, not unit uniformity.
- Breakpoints express deliberate presentation/density or proven fit requirements. Derive centers structurally; remove declarations that are superseded in every reachable state.
- Scroll ownership and measured occlusion remain explicit. Changes must pass native scene interaction, finite-data/no-data, long-content and resize checks.

Residual limits: Chromium/Metal and emulated touch do not certify physical Safari/iOS/Android or native two-finger pinch. Optical px typography does not follow every root-font preference; browser zoom/effective CSS width and explicit informational text-growth tests cover layout failure, not full accessibility certification. At320px, seven day columns are narrower than44px horizontally, and accepted narrow secondary targets are40px; neither is silently advertised as44×44. Changing astronomical scene pixels/time behind translucent panels prevents full-scene byte-identical screenshots; geometry and stable chrome are compared separately. Accepted desktop date alignment is described above. Compatibility-only component policies remain isolated and tested.
