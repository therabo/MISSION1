# Crew responsive detail navigation — 2026-10-09

The subsequent [Crew spacing and transition timing correction](crew-transition-timing.md) preserves this 716px container model, removes the evidence shortcut, and opens Crew during the existing Inspection return. Its measurements supersede earlier completion-gated Crew navigation.

Implemented directly on `main`, starting from clean, synchronized `b39f692d304ea9887d528eb5fa855b359804e2bc`. This is a presentation/navigation correction within the accepted responsive architecture. Resource, selected-UUID and temporal-context ownership stay in their existing components; no new dependency, measurement loop, service or architectural decision is introduced.

## Navigation and available space

Current and Historical retain their roster DOM and render one adjacent detail surface. Selecting another roster entry updates that surface. Close dismisses the detail and restores the selected row; the roster's own Close still dismisses Crew. Current keeps its lazy profile resource and existing interruptible exit snapshot. Historical still renders only the accepted replay envelope and its retained profile, including the explicit unavailable-profile state.

`CrewDetailActions` supplies both detail headers with the existing `ControlIcon` previous-arrow SVG and shared `CloseButton`. Mobile Back has the accessible name **Back to Crew** with no visible text. Its SVG is decorative (`aria-hidden`, `focusable="false"`). A structural grid header places the action row above the name, with Back at the start and Close at the end. Both targets are 44×44px; the established compact faces remain inside them. The Current selector and its handler/CSS are removed entirely.

The existing `.crew-workspace-group` is now the named `crew-workspace / inline-size` container. At **content width ≤716px**, the selected roster is hidden and the detail occupies the same grid cell. At **>716px**, both remain visible and Back is hidden. In the normal compact shell, two 12px workspace gutters make this equivalent to the required viewport boundary 740/741px. Narrower Crew parents inside a desktop window use the same mobile interaction without any viewport JavaScript.

Split tracks are `minmax(0, 1fr) minmax(0, min(42%, var(--crew-detail-width)))`, with the existing named 336px desktop detail cap and 24px gap. At 768px viewport/744px Crew width, roster/detail widths are407.53/312.47px; at 820px/796px they are437.69/334.31px. The detail cap preserves desktop geometry. Existing `crew-roster` 983/700px container queries reflow the narrower roster and are shared by both temporal presentations. There is no width subtraction, aggregate roster height or duplicated viewport patch.

Selection and profile lifetime do not depend on layout size. CSS changes tracks/visibility without remounting the roster, detail or profile, or issuing another profile request. Native scroll anchoring can adjust the Historical pixel offset as wrapped text reflows; the profile remains scrolled and its DOM stays identical. Selection still revalidates against new data under the existing rules.

## Validation

Actual pre-edit baseline: Node 24 **736 frontend tests/61 files**, Java 21 **382 backend tests**. The shell's initial Node20 attempt could not run the required toolchain; the recorded baseline is the successful Node 24 run.

Final gates: frontend **744 tests/61 files**, typecheck and production build PASS; Java 21 `mvn test` and `mvn verify` **382 each**, zero failures/errors/skips. Existing Cesium bundle-size warning only. `git diff --check` PASS. Unit coverage replaces the deleted selector-switch test with selector absence, shared accessible Back/Close, focus restoration, retained Historical roster/detail updates and resize lifetime checks. Rendered browser assertions supply the real CSS/tablet visibility coverage.

Development 5175 and production 4175 each pass Current and Historical at every requested viewport:

| Category | Viewports | Result |
| --- | --- | --- |
| Desktop |1920×1080,1440×900,1280×720| Roster + detail; no Back |
| Tablet |1024×768,900×700,834×1194,820×1180,768×1024| Roster + detail; switching updates one surface; Close retains roster |
| Mobile |430×932,412×915,390×844,375×812,360×800,320×568| Roster → detail → icon Back → same roster entry |
| Short landscape |932×430,844×390| Split according to actual Crew space; scrolling and Close reachable |

Each build has 32 complete mode/viewport flows, 22 mounted-profile resize observations, 8 isolated parent-width cases at 716/717/600/900px and 6 emulated-touch/reduced-motion flows at 390/320/768px. Checks cover document/Crew horizontal overflow, row bounds, Back/Close/name collisions, profile scrolling, accessible names, hidden Back exclusion, mobile focus entry/return and tablet keyboard order from the last roster entry into detail Close. Resizing preserves UUID, roster/detail/profile DOM and existing profile request count. Zero page or console errors.

Current desktop baseline comparison proves all 18 measured surface/header/body/footer rectangles identical across the three required desktop sizes. Historical intentionally gains the requested split surface. Back and Close use no absolute positioning. All backend, API/resource clients, Crew reconstruction/provenance/profile rendering, Earth/Inspection/navigation/temporal/calendar/trajectory/legend/SceneControls/Cesium files and existing assets remain unchanged. The optional `ContextDock.headerActions` slot leaves its default module header intact. Routine Refresh remains absent; existing automatic refresh and error Retry tests pass.

Four representative screenshots were inspected: [Current desktop](screenshots/crew-navigation-current-1440x900.webp), [Historical tablet](screenshots/crew-navigation-historical-768x1024.webp), [Current mobile](screenshots/crew-navigation-current-390x844.webp), [Historical narrow mobile](screenshots/crew-navigation-historical-320x568.webp). They are lossless WebP conversions with decoded RGBA verified against native PNGs. Full matrices/logs/JSON stay outside Git under the host temporary `mission1-crew-navigation` directory. The skill's `.shared/visual-runtime` scripts are unavailable on this host; the dedicated browser runner performs scoped overflow/collision/control/keyboard checks, followed by actual screenshot inspection. Chromium/Metal and emulated touch do not certify physical Safari/iOS/Android.

Reproduce against the real local backend with Node 24:

```sh
node docs/frontend/ui-restyling-responsive/validation/crew-detail-navigation.cjs http://127.0.0.1:5175/ development
node docs/frontend/ui-restyling-responsive/validation/crew-detail-navigation.cjs http://127.0.0.1:4175/ production
```

`MISSION1_QA_OUTPUT` can select an external output directory. The external project context remains `/Users/daniel/Desktop/mission1-project.md`, outside Git. Delivery is one ordinary commit and a normal SSH push to `origin/main`.
