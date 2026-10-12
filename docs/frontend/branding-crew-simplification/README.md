# Branding refresh and Crew presentation — 2026-10-12

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
