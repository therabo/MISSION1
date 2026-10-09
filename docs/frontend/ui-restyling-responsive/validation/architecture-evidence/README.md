# Responsive architecture evidence — 2026-10-09

Start: `e0780705580bf23c841f0a415ed56ce9601a52d0`, branch `ui/restyling`; main/merge-base `12be75af376c0a18e510395ae59c58ee252f3800`. See [audit](../../architecture-audit.md) for decisions, rationale and limits.

- [48-family inventory](component-inventory.csv): every source/parent/layout/unit/threshold/scroll strategy and verdict.
- [Declaration ledger](dimension-decisions.csv): 1,843 before/final records, including removed constraints and baseline classifications.
- [Dimension summary](dimension-summary.json): reproducible counts and all media/container thresholds.
- [Scope/freeze](scope.json): 81 compared source paths,9 runtime changes,332 unchanged protected files and10 source/test hashes.
- [Verification](verification.json): final gates, native checks, fixtures, expected503s, recovery and QA hashes.
- [Visual fidelity](visual-fidelity.json): original6-size ×20-state baseline, exact surface/style/fixed-control comparison, separate settled Crew checks and measured raster differences.
- [Lossless file manifest](visual-files.json):9 files /2,197,694 bytes; decoded RGBA equals source PNG.

| Capture | Purpose |
| --- | --- |
| [Before desktop](before-desktop-earth.webp) / [final desktop](desktop-earth.webp) | Accepted chrome; dynamic computed orbital/scene instant is intentionally not frozen |
| [Tablet](tablet-earth.webp) | Text-only navigation / independently centered date |
| [Phone](phone-earth.webp) | Icon-only navigation / compact controls |
| [Narrow calendar](narrow-calendar.webp) |320px centered portal, pinned actions and shared content scroll |
| [Landscape calendar](landscape-calendar.webp) |844×390 persistent tablet Historical policy and bounded scroll |
| [Astronaut](phone-astronaut.webp) |Parent-bounded phone detail and shared target policy |
| [Module](narrow-module.webp) |Accepted normal module geometry |
| [Module stress](narrow-module-stress.webp) |Marked150% long text, readable scrolling title/context, reachable Close/body |

Whole-scene byte equality is not asserted. Each build has508/510 exact baseline surface rectangles, with two differently timed Crew width-transition samples separately validated after350ms;510 identical style comparisons;1,336 exact fixed-control rectangles. Crew row rounding is below0.08px, and one independently scrolled informational disclosure differs20px in position.41/42 desktop foreground masks match;19 threshold pixels differ in the full-calendar crop, including15 around the three structurally centered UTC chevrons. These differences are explicitly retained in the fidelity report.

## Reproduction

Use the existing real PostgreSQL/backend8080, Node24, Java21, development5175 and the current built preview4175. These are ordinary local services, not new infrastructure. Do not use fixture values as ISS facts. Run each browser suite sequentially to avoid competing GPU workloads. All generated corpora go to an external temporary directory.

From the repository root:

```sh
node docs/frontend/ui-restyling-responsive/validation/architecture-dimensions.cjs
MISSION1_QA_OUTPUT=/tmp/mission1-matrix-development node docs/frontend/ui-restyling-responsive/validation/responsive-matrix.cjs http://127.0.0.1:5175/ development final
node docs/frontend/ui-restyling-responsive/navigation-disclosure/controls-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-disclosure-development
node docs/frontend/ui-restyling-responsive/validation/secondary-controls-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-secondary-development
MISSION1_QA_OUTPUT=/tmp/mission1-native-development node docs/frontend/ui-restyling-responsive/validation/native-responsive-interactions.cjs http://127.0.0.1:5175/ development
MISSION1_QA_OUTPUT=/tmp/mission1-edges-development node docs/frontend/ui-restyling-responsive/validation/edge-state-matrix.cjs http://127.0.0.1:5175/ development
node docs/frontend/ui-restyling-responsive/validation/architecture-layout-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-stress-development
node docs/frontend/ui-restyling-responsive/validation/crew-retry-qa.cjs http://127.0.0.1:5175/ development /tmp/mission1-retry-development
```

Repeat against4175 with `production` and separate output folders. The six pre-edit references are1440×900,1024×768,768×1024,390×844,320×568 and844×390. The existing matrix supports `MISSION1_QA_VIEWPORTS` as JSON and phase `golden` for those captures. `secondary-controls-fidelity.py BEFORE AFTER OUTPUT` compares desktop controls with Pillow. This audit's original baseline and full logs/corpora remain under `/tmp/mission1-architecture-audit` outside Git; temporary read-only archived-baseline5179 was used for settled Crew comparison and stopped afterward. Recreating that comparison requires serving frontend source archived from the baseline SHA against the same real backend and waiting350ms after each resize (the retained transition is240ms).

Run frontend tests/typecheck/build in `frontend`; run `mvn test` and `mvn verify` in `backend` under Java21. No ordinary CSS-literal test corpus is added. Browser stress measures geometry, native reachability, state retention and actual scrolling.
