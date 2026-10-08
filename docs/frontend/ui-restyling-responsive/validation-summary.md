# Final responsive validation

All final acceptance checks pass. Both builds use the same final application source: Vite development on port 5175 and the rebuilt production preview on port 4175. Chromium uses native Cesium/WebGL through ANGLE Metal. Existing backend, PostgreSQL and user development services are preserved.

## Tests and build

| Gate | Result | Evidence |
| --- | --- | --- |
| Actual branch baseline, Node 24 | 698 tests / 58 files PASS | [baseline log](validation/frontend-baseline-node24.log) |
| Final complete frontend suite, Node 24 | 698 tests / 58 files PASS | [final log](validation/frontend-final.log) |
| TypeScript | PASS | [typecheck](validation/typecheck.log) |
| Production build | PASS; existing large Cesium chunk warning | [build](validation/build-final.log) |
| Java 21 `mvn test` | 382 tests, zero failures/errors/skips | [test](validation/backend-test.log) |
| Java 21 `mvn verify` | 382 tests, zero failures/errors/skips; BUILD SUCCESS | [verify](validation/backend-verify.log) |
| Backend / graphics / camera freeze | 210 backend and 77 protected files unchanged | [freeze audit](audit/freeze-verification.json) |
| Working and staged `git diff --check` | PASS | [final acceptance ledger](audit/final-validation.json) |

The unsupported initial Node 20 attempt is retained as diagnostic history. It is excluded from the accepted baseline. No dependency installation/change was required. The final frontend count includes the user-authorized pre-existing Crew/Historical tests; the responsive implementation did not add superficial tests duplicating CSS.

## Complete viewport and state matrices

| Build | Normal states | Additional loading/error/variable states | Continuous resize | Native scene interactions |
| --- | --- | --- | --- | --- |
| Development | 20 × 20 = **400 PASS** | 11 × 20 = **220 PASS** | 113 widths × 11 open states = **1,243 PASS** | **8/8 PASS** |
| Production | 20 × 20 = **400 PASS** | 11 × 20 = **220 PASS** | 113 widths × 11 open states = **1,243 PASS** | **8/8 PASS** |

Final normal reports: [development](validation/final/development/matrix.json), [production](validation/final/production/matrix.json). Final additional-state reports: [development](validation/edge-states/development/matrix.json), [production](validation/edge-states/production/matrix.json). Native reports: [development](validation/native/development/interactions.json), [production](validation/native/production/interactions.json).

Every required width and height is covered in both matrices: 1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768, 900×700, 834×1194, 820×1180, 768×1024, 430×932, 412×915, 390×844, 375×812, 360×800, 320×568, 1920×700, 1024×600, 844×390, 932×430. All report zero unexpected page overflow, illegal critical-surface overlap, unreachable essential controls or broken canvas sizing. Intentional scene overlays and explicitly owned content scrolling are accounted for separately.

Normal states cover Earth GP and OEM, each source's provenance, Crew/evidence/profile/profile evidence, Historical Earth/calendar/Crew/evidence/profile/Inspection/provenance/module, Current Inspection/provenance/module and native attribution. The 11 extra states are Crew loading/error/empty/long content; profile loading/error/long biography/unavailable; Historical Crew pending/error/unavailable. Delays hold real requests; retries return real backend responses. Empty/long/null fixtures are labelled TEST ONLY in the capture and QA JSON, never shipped or presented as real ISS data.

Continuous resize preserves Viewer/canvas identity, selected source, accepted UTC, Crew selection and semantic module identity without reload. Width samples include existing breakpoint neighbors. No React, JavaScript, ResizeObserver loop or layout console error is recorded in the final reports. Injected HTTP 503 responses are expected error-state stimuli and are recorded separately; they are not application exceptions.

## Desktop reference and scene contracts

The 20 pre-edit golden desktop states are retained in [golden report](validation/golden/development/matrix.json). Final development [fidelity audit](audit/desktop-fidelity.json) and production [fidelity audit](audit/desktop-production-fidelity.json) preserve every surface rectangle, computed surface style and full-screen canvas at 1440×900. Nineteen development states also have identical matched control rectangles. Two inner controls in the Crew profile-evidence capture move together by 20px because its independently scrollable content was captured at a different scroll offset; their dimensions, enclosing geometry and styles are unchanged. Current UTC/orbit/freshness and lazily returned metadata naturally change over time. A whole-scene zero-pixel comparison across different real times would be invalid.

Native scene checks cover Earth drag/wheel/reset, Inspection entry/orbit/wheel, hover clear during camera movement, GPU semantic picking at exposed panel boundaries, color restoration and Back. Canonical fresh Inspection range is 90m with the existing portrait widening `90 × max(1, 1.2/aspect)`, elevation 42.5° and FOV 100°. Focal error remains below 2px and Earth restoration position error below 0.02m. Viewer and canvas remain persistent. Existing regression scripts additionally exercise all 14 semantic module identities for GP and OEM, reduced motion and synthesized touch orbit/pinch. No camera or rendering policy is modified.

## Feature regression evidence

All eight sequential regression runs have exit code zero in [run ledger](validation/regression-runs.json): development Inspection, Crew, astronaut, Historical Crew; production Crew, astronaut, Historical Crew and module selection. Existing 25-size coverage (ten primary plus fifteen intermediate sizes) is retained. Calendar independently passes both builds: [development](validation/edge/development/calendar/calendar-qa.json), [production](validation/edge/production/calendar/calendar-qa.json).

Crew/profile coverage includes real roster counts and provenance, A→B and rapid selection, lazy loading, failed request and real retry, retained valid selection on refresh, removal invalidation, long mission/names/biography, missing portraits, independent content scrolling and normal/reduced motion. Historical tests distinguish accepted T1 from pending/failed T2/T3, verify latest-request acceptance and real retry, preserve exact Historical UTC, and never substitute Current roster for absent history. Calendar covers focus/keyboard, touch, Cancel/Escape/outside dismissal, draft versus Apply, accepted-scene holding, latest request and return to Current without scene/time mutation from draft edits.

## Actual visual review and iteration

Every final capture was inspected through indexed contact sheets: **1,240 matrix screenshots + 139 native/regression screenshots = 1,379**, in **150 reviewed sheets**. [Review ledger](validation/review/manifest.json) maps every screenshot to its reviewed sheet. Twenty golden screenshots were reviewed separately before edits. [Screenshot index](screenshots.md) provides exact major-state paths at desktop, laptop, tablet, phone, short landscape and narrow stress sizes.

QA artifacts are losslessly encoded as WebP after decoded RGBA equality verification; [conversion manifest](validation/lossless-artifacts.json) records original PNG and final WebP SHA-256. Golden PNGs and JPEG review sheets retain their own formats. No application asset is converted.

Iterations corrected scene-bounded calendar placement/scroll ownership, native attribution stacking and vendor-selector specificity, and expanded Historical Crew evidence occupying only half the phone row. Initial iteration reports remain diagnostic history. Early module-control reachability failures were harness errors in scrolling an inline control under a sticky header; corrected hit testing and affected-state revalidation pass. A 120ms motion observer was changed to avoid missing a transition under host load. A transient backend 500 during overlapping GPU runs is retained as a diagnostic and the final sequential regression passed. The extra-state fixture initially used the wrong member ID and a stale delayed-route release callback; both were corrected in QA only. No unresolved responsive failure is reclassified as a limitation.

## Scope and genuine limits

The [41-family inventory](component-inventory.md) accounts for every visual family identified against main. The [runtime-only delta](audit/responsive-runtime-only.diff.gz) separates this milestone's four runtime files from the user-authorized initial Crew/Historical changes. Exact original branch and working-tree diffs are gzip archived with [decompression hashes](audit/preserved-diffs.json). [Initial-work verification](audit/pre-existing-work-verification.json) confirms 15 of 16 initial user files are unchanged; the remaining file receives only the compact open-evidence rule. [Evidence manifest](evidence-manifest.json) stores sizes and SHA-256 for the entire dossier, excluding itself. Display-only log normalization is recorded with original byte hashes in [log audit](audit/log-normalization.json).

Browser QA certifies this Chromium/Metal host and synthesized touch input. Physical Safari/iOS/Android chrome and hardware gestures require device-specific certification. Existing real-source coverage gaps, missing metadata and the large bundle warning remain. Backend/data contracts, imagery, stars, model assets, quality settings, trajectories and camera helpers are unchanged. Delivery is one ordinary commit and normal SSH push on ui/restyling; main is neither modified nor merged. The final commit is recorded in the external project context, outside Git, avoiding a self-referential second documentation commit.
