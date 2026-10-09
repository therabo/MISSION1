# Crew spacing, evidence and immediate Inspection navigation — 2026-10-09

Starting baseline: clean `main` at `98114d2d23afb611df38c973f0c078cf84369f66`. Work stays on `main` and covers one Crew interaction milestone.

## Surface lifetime and scene lifetime

The Crew launcher now sets `crewOpen` and requests the existing Inspection return in the same application event. It does not request another return when the renderer is already `EXITING_INSPECTION`. `onViewModeChange` still dismisses Crew on native Inspection entry; exit-start and Earth-complete notifications leave Crew state alone. The former pending intent, completion consumer, pending-only Escape listener and launcher busy copy are removed. Existing Crew Escape, Close and focus restoration handle the immediately available surface.

`CurrentCrewWorkspace` continues to own the overlay's existing opacity motion and inert exit. Opening is interactive from its first render. Current/Historical resources, selected UUID, disclosures and profile DOM stay in their existing owners. Completing the camera transition cannot select, reset, mount or reopen Crew. Closing Crew during the return leaves that return running; reopening during that same exit does not restart it. Source/temporal/re-entry guards still follow renderer state.

The pointer hierarchy is unchanged: the top-level UI and workspace host use `pointer-events: none`; the actual roster and astronaut surfaces use `pointer-events: auto`. Their native scroll owners retain overscroll containment and `touch-action: pan-y`. Camera controls remain renderer-owned; no transition blocker is introduced. Browser QA sends native Crew mouse/wheel input and checks that Cesium's canvas receives none of it.

All Cesium camera/transition, workspace geometry, picking/hover, easing, duration, range/FOV and rendering code is unchanged. The existing layout-key/ResizeObserver/MutationObserver mechanism continues to measure eligible persistent dashboard bounds and their CSS visibility. As in the accepted baseline, Crew is a separate overlay, not a new persistent side dashboard. Its real responsive DOM geometry is available immediately; no Crew-specific camera offset or new occlusion policy is introduced. The full viewport and existing composition adaptation remain intact.

## Divider and evidence

The shared `.crew-roster-summary` border is the divider. Previously, Current desktop/tablet had no bottom padding and its intrinsic count cells crowded the border; only a compact rule supplied 12px. The shared summary now uses `padding-block-end: calc(var(--space-primary) / 2)`, a consistent 12px derived from the existing 24px spacing token. The redundant compact-only padding is removed. Current/Historical, split detail and roster-only layouts all inherit the same minimum gap.

The Current astronaut dock's redundant evidence shortcut, handler and dedicated details ref are removed from the source. The shared `CrewProfileEvidence` no longer accepts a ref for that shortcut. Both Current and Historical keep their bottom disclosure, source links, successful-fetch/original-observation clocks and presence assertions. Current's separate profile-observation footer remains, with intrinsic height rather than the shortcut's reserved 100px floor. Button-only footer CSS is removed. `ContextButton` remains imported because the genuine profile Retry still uses it.

The accepted 716px Crew-container split boundary, desktop/tablet roster plus detail, mobile detail-only with Back/Close, lazy profile loading, automatic refresh, reconciliation, presence, Historical reconstruction, freshness and Retry behavior are preserved. This removes an inappropriate navigation dependency within the existing architecture; it does not introduce a significant new architectural choice or require a new ADR.

## Validation

Actual pre-edit baseline: Node 24 **750 frontend tests / 61 files**, Java 21 **382 backend tests**, all passed. Baseline real-browser observations put Current interactive Crew at 5219.7ms and Historical at 5339.5ms, coincident with camera completion. The final measurements and gates are recorded below.

Focused unit cases use explicit renderer notifications and fake overlay timers, without waiting for real camera time. They cover immediate Current/Historical mounting, interactions during exit, selected-profile/disclosure/scroll identity across completion, Back/Close/focus, Retry, close/reopen without another camera request, and no completion-driven reopening. Current/Historical profile tests verify shortcut absence and functioning retained evidence. The native browser runner verifies the real 12px divider gap across viewports instead of relying on jsdom CSS layout.

Reproduce against the real local backend with Node 24:

```sh
node docs/frontend/ui-restyling-responsive/validation/crew-transition-timing.cjs http://127.0.0.1:5175/ development /tmp/mission1-crew-timing/development
node docs/frontend/ui-restyling-responsive/validation/crew-transition-timing.cjs http://127.0.0.1:4175/ production /tmp/mission1-crew-timing/production
```

No API response substitution or camera-clock manipulation is used. Full logs/JSON and transient captures remain outside Git. The local skill visual-runtime scripts are unavailable; scoped rendered overflow/spacing/responsive/pointer checks plus actual screenshot inspection provide visual QA. Chromium/Metal covers these browser interactions; physical Safari/iOS/Android is not certified.

## Final gates and native browser measurements

Frontend **759 tests / 61 files** PASS, nine additional cases over the actual 750/61 baseline. Full run uses `npm test -- --maxWorkers=2`; typecheck and production build PASS. Java 21 `mvn test` and `mvn verify`: **382 each**, zero failures/errors/skips. Diff checks PASS. The first over-parallel validation attempt exceeded default Vitest deadlines while WebGL, Maven and the build also ran; stopping that attempt and reducing test concurrency produced a complete passing run without altering those tests. A Historical QA selector was corrected to its actual disclosure owner and all Historical cases were rerun. No product change followed the passing source validation.

Both development and production pass Current/Historical at **1440×900, 1024×768, 768×1024, 390×844, 320×568 and 844×390**. Each build has **12 full viewport flows**, **4 isolated 716/717px container cases**, and **2 emulated-touch mobile transition flows**. The viewport flows each exercise Earth→Crew, settled Inspection→Crew and a separate close-Crew-before-completion sequence. Desktop native module hover/picking and Inspection Back pass in both builds. All applicable scroll, selection, detail, mobile Back, profile Close, Crew Close and roster/profile disclosures work during the background return. The selected UUID, roster/detail/profile DOM and open evidence survive camera completion. No Crew events reach the canvas, no Crew surface reappears after early Close, and one Viewer/canvas survives. Zero page/console errors. Existing projection/composition checks pass.

Times below are milliseconds from the native launcher click. DOM/hit-test readiness and exit-start are sampled in the same first rendered observation. Visible timing includes the first nonzero frame of the existing 200/240ms opacity dissolve; interaction is enabled during that dissolve. First astronaut selection occurs later because the runner deliberately scrolls and opens/closes roster evidence first. These are observations, not scheduling thresholds.

| Build | Crew DOM / interactive | First visible Crew frame | Exit started | First astronaut selection | Earth transition complete |
| --- | ---: | ---: | ---: | ---: | ---: |
| Development |30.4–136.2|46.7–166.3|30.4–136.2|350.1–1490.9|5047.3–5134.0|
| Production |22.0–28.3|31.8–74.8|22.0–28.3|322.8–489.0|5043.3–5079.1|

Crew mounting has no dependency on exit completion. The old baseline made interactive Crew coincide with completion at 5219.7ms (Current) /5339.5ms (Historical). Camera timing/easing code remains byte-identical; the existing geometry-dependent duration still owns the observed return. No camera mathematics, duration, easing, canonical pose, FOV/range, rendering, source or backend code changed.

Rendered summary boxes have an exact **12px content-box-to-divider gap** in every checked layout. The intrinsic Current footer measures 44px on desktop/tablet, with compact/short-layout text reflow preserved. Four representative lossless WebPs retain decoded-RGBA equality with the native captures: [desktop evidence and footer](screenshots/crew-transition-current-1440-evidence.webp), [Historical tablet detail](screenshots/crew-transition-historical-768-detail.webp), [Current narrow roster](screenshots/crew-transition-current-320-roster.webp), and [Historical mobile Back/Close](screenshots/crew-transition-historical-390-detail.webp). The narrow roster is captured after its existing opacity motion finishes, independently of the earlier interaction measurements.

The [compact validation record](validation/crew-transition-timing-summary.json) preserves viewport timings, container/touch results and all ten validated source/test fingerprints. Full logs and transient screenshots stay under `/tmp/mission1-crew-timing`, outside Git. The external project context is `/Users/daniel/Desktop/mission1-project.md`; delivery uses one ordinary main commit and a normal push, followed by remote-ref and clean-tree verification.
