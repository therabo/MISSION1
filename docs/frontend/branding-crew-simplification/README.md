# Branding refresh and Crew presentation — 2026-10-12

## Corrective milestone — Crew presentation and interrupted logo work

This correction starts from clean `main` at
`a0969cd3192784690fdfa3667dafbe3d23904b22`. The first conversion **clipped original
lettering/artwork**. Its foreground-preservation acceptance below was incorrect
and is superseded by this correction; the original report remains historical.
The first milestone's always-visible Data source treatment is also superseded.
Final commit/remote equality is recorded outside Git to avoid a self-reference.

**Final user steering:** after generation and pixel/browser checks, the user
confirmed removing the Desktop original and asked to stop image work and conclude
the remaining tasks. The already generated canonical PNG below remains at its
last working version; no further logo processing is performed. Its recorded
source hash is from generation, and a final on-disk source equality check is
unavailable because the user removed that file. Logo work is therefore recorded
as interrupted, rather than claiming completion of every original logo gate.

### Logo rebuilt from the untouched original

The only generation input was
`/Users/daniel/Desktop/Mission1_ Orbital Engineering Logo.png`, RGB PNG
at 2172×724 with the original hash at generation. The user clarified that the spatial background, including the nebula
above the letters and Earth below, should be removed while preserving lettering,
antennas, details and artwork glows. The rejected transparent PNG is used only for
comparison, never as generation input.

| Artifact | SHA-256 |
| --- | --- |
| Untouched Desktop original | `fca02414248c3b804ea41439422a574b1455a8ce2fa67a181236b390b96ec0c4` |
| Rejected first transparent PNG | `180191e188086632ebe488d05c4b14553f35c8838aeaf8f28b3c99c07d5f9af9` |
| [Corrected canonical PNG](../../../frontend/public/branding/MISSION1-logo.png) | `94771f02713aa1d00bec6858286879a8ea2d871645489ec3a43e66931ca2d763` |

Deterministic local processing estimates the dark background palette from the
outer image border and identifies connected background using conservative RGB
distance and local gradient limits. Source-coordinate preservation guards protect
glyphs, dark material panels, antenna extensions and glows. Separately reviewed
exterior sky/Earth and the actual O aperture are background. Uncertain adjacent
pixels retain alpha, with color-distance-dependent soft coverage in the edge band (avoiding a fixed-opacity
halo around background-like blue pixels); preservation takes
priority over removing a small semitransparent fringe. This is not GrabCut and
does not erode foreground. No generative service or product dependency is added.

The output is RGBA **2172×724**. **Every RGB pixel at every coordinate is identical
to the original**; only alpha changes. Crop, trim, bounding-box reduction, resize
and geometric transformation are all absent. Processing did not write the source.

Native pixel QA compares original and output recomposited using locally estimated
source-background pixels, with amplified difference and restored-edge overlays.
Reviewed glyph masks contain 351,557 source edge pixels: none are absent; 277,597
bright material/glow pixels remain fully opaque. The correction restores 75,189
checked source edges absent in the rejected PNG. Opaque foreground recomposition
has zero error; the checked source-edge error's 95th percentile is zero. These
mask checks support, rather than replace, visual inspection of the full artwork.

All eight characters and 46 explicitly selected real extrema/details are inspected
at 100%, 200% and 400%, including antenna tips, hooks, feet and internal rims. Dark
application, black, medium gray, white and checkerboard composites retain the
complete wordmark without a background rectangle. A modest soft edge remains
where the source boundary is uncertain; no hard foreground cut is introduced.
Native PNG QA is independent of the much smaller navigation rendering.

README and App paths are unchanged. Both still use the one canonical public
asset, including its original 3:1 canvas ratio. The 120×40 image box, navigation
height and canvas rectangles match the earlier baseline at every tested size.
Development and production serve the exact corrected PNG hash. The archived root
artwork remains untouched; no duplicate logo copy is introduced.

### Restored source disclosure and reduced detail

The parent `451f1d6` used native `<details className="crew-sources">` and `<summary>`
without `open`: initially collapsed. The correction restores that same primitive
and inherited marker/focus styling at the **bottom after all astronauts**. There
was no custom open/close animation to restore. Browser-native disclosure semantics
expose Data source and expanded false/true in Chromium's accessibility tree;
redundant manual ARIA or custom accordion state is not added. Enter and Space
toggle, the chevron follows state, focus is visible and source links are reachable
when open. An open disclosure survives normal source-value refresh.

The two simplified groups remain Structured roster · Launch Library 2 and NASA
verification. Each retains Last successful fetch, Source state, Original
observation, Published/Unavailable and Source reference; Reconciled follows.
Values are taken dynamically from the exact API response. Removed diagnostics and
freshness prose stay removed. Current members / Last update remain above the
divider, with the source section following the empty state when no rows exist.

Current detail removes the complete Profile context section and Profile
observation footer, including their dedicated spacing and dead imports. Shared
Current/Historical profile evidence also hides Original profile observation.
Useful biography, permitted portrait handling, assignment/mission, Career, profile
fetch/source references and retained evidence remain. Role is followed by one
Nationality. Earlier membership/presence blocks, disclaimers and portrait-rights
presentation removals remain accepted. Backend profile/context/observation and
portrait provenance/permission data are preserved.

### Correction validation and frozen scope

Java 21 / Node 24. Actual baseline: backend `mvn test` **1163** with zero
failures/errors/skips; frontend **801 tests / 67 files**. Final `mvn test` and
`mvn verify`: **1163 each**, zero failures/errors/skips. Final `npm test`:
**803 / 67 files**; typecheck, build and `git diff --check` pass. Two new tests
exercise source open/close and state retention across changing source values;
existing presentation assertions are updated without changing data-semantic tests.
The existing Cesium large-chunk warning remains.

Development 5175 and production 4175 use real local 8080 API bodies, without
fixture substitution. Both cover 1440×900, 1024×768, 768×1024, 390×844 and 320×568:
shell/logo, Current summary/roster, source collapsed/expanded, Current/Historical
detail, keyboard/focus/Back/Close, 716px container boundary, resize and emulated
touch. Earth GP/TLE, GP Inspection and NASA OEM Inspection, calendar/replay controls,
native wheel and semantic module picking are included. Screenshots and geometry,
overflow, contrast, control-name, image-alt and source/API checks are retained.
Chromium/Metal and emulated touch do not certify physical Safari/Android devices.

Correction evidence is outside Git at
`/Users/daniel/.codex/exports/mission1-branding-crew-correction/`: original-source
processing script and preservation annotations, pixel/extrema JSON, native and
background composites, browser reports/screenshots and test logs. Failed interim
attempts remain separate from successful final gates. A broad fixed-alpha fringe
in the interim candidate was refined after native white-background inspection;
the complete pixel/extrema gates were repeated for the final alpha. The initial source QA runner
incorrectly expected Playwright's ARIA snapshot to print the native disclosure's
expanded property; the final runner checks the browser accessibility tree directly.
An accidental interim detail-CSS overwrite was caught in diff review and restored
before the final tests/browser checks; only the removed footer's rule is deleted.

Backend, API DTOs/decoders, database/Flyway, source acquisition, Cesium/Orbit and
architectural validation files remain byte-identical to `a0969cd`. V7 identity,
V8 intake, V9 SHADOW, S10 production binding and V10 lifecycle are unchanged.
Current/Historical still use the accepted V7 + S10 + V10 effective UTC semantics;
Historical roster/assignment are selected at T, canonical profile metadata remain
latest retained. No ADR or dependency change is required. Frontend README and UI
notes describe the correction; external project context is updated outside Git.
AGENTS.md and external skills are unchanged. The next milestone remains
**clean-room empty-database bootstrap validation**.

## Initial milestone record — superseded where corrected above

The following records the first implementation and its reported checks. In
particular its logo preservation claim and always-visible source behavior are
historical, not the current acceptance result. The linked canonical PNG now points
to the corrected asset; the old hash identifies the first commit's rejected bytes.

Presentation-only milestone on `main`, starting from clean accepted
`451f1d6f67c1730e0e11a2491ae8b5e81333a17f`. Final commit and remote equality are
recorded outside Git to avoid a self-referential hash. No new ADR is required.

## Canonical artwork

The user corrected the supplied filename to
`/Users/daniel/Desktop/Mission1_ Orbital Engineering Logo.png`. The original is
RGB PNG, 2172×724, without alpha, and remains unchanged. Its background is a
nonuniform exterior starfield and Earth horizon surrounding the metallic letters.

| Artifact | Dimensions | SHA-256 |
| --- | --- | --- |
| Desktop original | 2172×724 | `fca02414248c3b804ea41439422a574b1455a8ce2fa67a181236b390b96ec0c4` |
| [Canonical transparent PNG](../../../frontend/public/branding/MISSION1-logo.png) | 2172×724 | `180191e188086632ebe488d05c4b14553f35c8838aeaf8f28b3c99c07d5f9af9` |

Local deterministic processing selects sizeable connected lettering within the
wordmark region, closes narrow panel gaps, protects interior foreground with a
trimap, and runs seeded OpenCV GrabCut. Small enclosed dark panels are restored;
the large O aperture remains background. A two-pixel edge band uses local
foreground/background estimates for alpha and edge decontamination. Opaque
artwork RGB pixels are unchanged; only fully transparent RGB is zeroed for
lossless compression. No generative service, recoloring, rescaling or new product
dependency is used.

Final RGBA alpha spans 0–255, with transparent/partial/opaque pixels; artwork bounds
are `(78,95)–(2089,523)`. Checkerboard, application-dark and light composites were
inspected, including the original-resolution edge regions: no background rectangle,
obvious halo, clipped letter strokes or damaged metallic shading. The new artwork
has no embedded nebula that needs separate removal. The original space scene is
retained in the unchanged Desktop source.

README uses a repository-relative `<img>` at width 800 and its natural 3:1 ratio.
GitHub can resolve the committed PNG without an external host. The application
uses `BASE_URL + branding/MISSION1-logo.png`, public in dev and copied into dist.
The old frontend-owned copy is deleted. The older root `MISSION1-logo.png` remains
byte-identical only to preserve linked historical artwork, and is not displayed.

## Visible Crew behavior

Current members is left and dynamic Last update right, above the summary divider.
The explanatory membership line and Current information disclosure are removed.
The timestamp remains the latest valid successful Crew source fetch; failed
attempt/evaluation/assertion times are never substituted.

Data source is an always-visible secondary section after every roster row (or
after the empty-roster message). Exactly two groups remain: Structured roster ·
Launch Library 2 and NASA verification. Each has Last successful fetch, Source
state, Original observation, Published and Source reference. Missing timestamps
remain Unavailable. Reconciled follows the NASA group. Diagnostics remain in REST.

[LL2 reference](https://ll.thespacedevs.com/2.3.0/expeditions/?space_station=4&is_active=true&mode=detailed&ordering=-start&limit=10)
and [NASA reference](https://www.nasa.gov/blogs/spacestation/feed/) both returned
HTTP200 during this milestone; local API provenance identifies those exact URLs.
Original observation, successful revalidation and publication remain distinct.
UI tests deliberately change timestamps/state/publication and verify null fallbacks;
browser checks compare rendered fields with the exact real collection response.
No user-example timestamp is a runtime constant.

Current and modern Historical detail remove membership and operational-presence
blocks, assignment/cumulative disclaimers and Portrait credit & rights disclosure.
Role is followed by one Nationality inside Structured assignment, falling back to
roster nationality until a lazy Current profile arrives. Career totals and all
other useful biography/profile data remain. Portrait credit, permission checks,
rights models, profile evidence and immutable source metadata are preserved.
Historical assignment comes exclusively from the accepted member at T; canonical
biography/career stay latest retained. Current and Historical roster operational
annotations and their accepted lifecycle semantics remain unchanged.

## Validation

Java 21 / Node 24. Baseline `mvn test`: 1163, zero failures/errors/skips. Final
`mvn test` and `mvn verify`: 1163 each, zero failures/errors/skips. Baseline
frontend 791/66 files; final 801/67 files, typecheck/build pass. Ten additional
presentation tests and updated existing assertions preserve decoder, timestamp,
permission, selection, operational-boundary and Historical lifecycle checks.
Existing large Cesium chunk warning only. `git diff --check` passes.

The browser evidence covers development 5175 and production 4175 with real 8080 API
transport at 1440×900, 1024×768, 768×1024, 390×844 and 320×568. Shell, Current roster,
bottom Data source, detail, Historical roster/detail, Earth and GP/TLE/NASA OEM
Inspection are inspected. Navigation/canvas rectangles match the before matrix;
logo rendering keeps 3:1 and served PNG hashes match the canonical asset. Source
links are keyboard reachable and have provider-specific accessible names. Crew
headings/control labels, focus return, no orphaned expanded controls, overflow,
contrast and image alt checks pass. Mobile Back/Close and the 716px container model
remain accepted. Native wheel and semantic module-picking regression are exercised.
Chromium/Metal and emulated touch do not certify physical Safari/Android devices.

Raw logs, segmentation script, source HTTP captures, exact asset metadata, failed
attempts and complete screenshots/reports remain outside Git at
`/Users/daniel/.codex/exports/mission1-branding-crew/`. The existing project browser
runners/visual lint are reused with only presentation assertions updated externally;
the skill's shared visual runtime is unavailable. Original failed runner attempts
are retained and excluded from successful gates.

## Frozen boundaries and documentation

All backend/API/domain/schema/migration and Cesium files remain byte-identical to
the baseline. V7 canonical identity, V8 acquisition, V9 SHADOW, S10 production
thresholds/authority and V10 Current/Historical lifecycle are unchanged. No new
migration, REST semantic change, dependency or architecture decision is introduced.
ADR-0021, final Crew architecture validation and historical architectural evidence
are preserved. Frontend README and relevant UI dossiers have narrow current
presentation/supersession notes. AGENTS.md and external Codex skills are unchanged.
The external project context is updated outside Git. The next milestone remains
clean-room empty-database bootstrap validation.
