# Frontend QA artifact policy

The final integration removes generated QA corpora from the tracked tree. Product source, fonts/icons/branding, ISS/skybox assets, tests and their fixtures remain intact. Architectural and design explanations, validation conclusions and reusable QA tooling remain reviewable in Markdown.

## Retained evidence

- The [responsive architecture audit](ui-restyling-responsive/architecture-audit.md), its 48-family inventory, declaration decision ledger and dimension summary document the accepted layout.
- [Six final screenshots](ui-restyling-responsive/screenshots.md) cover desktop, tablet, phone, narrow calendar, module detail and astronaut detail. Their lossless manifest totals 1,263,644 bytes.
- Model inventory/semantic-review metadata, the semantic Cupola reference capture, and recorded real response/model-axis inputs used by tests and reusable diagnostic scripts remain available. They are historical QA inputs, never production fallbacks or current ISS facts.
- The [final validation summary](ui-restyling-responsive/validation-summary.md) records the integration gates. The [integration smoke script](ui-restyling-responsive/validation/integration-smoke.cjs) exercises real backend data and native Cesium at four representative sizes.

## Removed material and archive recovery

Generated viewport matrices, contact sheets, duplicated before/after screenshots, raw JSON traces, test-runner logs, gzip diff copies, image conversion indexes and rejected strict-speed source copies were removed. Earlier dossier text remains a historical record; links to removed artifacts are rendered as readable labels with an archive notice.

The complete pre-cleanup tree remains recoverable at `b3036793614280f0842acb21c3145dd7b3f0097a` on the retained feature history. For a specific historical artifact, use `git show b3036793614280f0842acb21c3145dd7b3f0097a:PATH > /tmp/FILE`, or `git archive` to an external directory. Do not restore corpora to the working repository merely to inspect them.

The older compact-navigation assertions encode a superseded representation policy; the current navigation/disclosure suite replaces them. Milestone-specific evidence packers and the old review-sheet/conversion script are removed because they regenerated the discarded tracked corpus. General browser, raster, diagnostic and regression tools remain available; historical diagnostic runs may require archived inputs or an instrumented temporary checkout as described in their headers.

## Output ownership

Use `/tmp/mission1-…` or an explicitly chosen external directory for generated captures, logs and reports. The responsive matrix, native interaction, edge-state, declaration and regression runners now default to temporary directories. Pass explicit external output arguments to other retained tools. Do not commit regenerated outputs.

`/Users/daniel/.codex/exports/mission1-responsive-review/` remains outside Git. `.gitignore` covers named local QA/export folders and the removed responsive corpus locations; it does not ignore source assets, all documentation, or intentional representative samples.

## Reproduction

Use Node 24, Java 21 and the existing PostgreSQL/backend. From `frontend`, run `npm test -- --maxWorkers=2`, `npm run typecheck`, and `npm run build`. From `backend`, run `mvn test` and `mvn verify` with Java 21. Serve the current production build with its ordinary API proxy to the backend.

From the repository root:

```sh
node docs/frontend/ui-restyling-responsive/validation/integration-smoke.cjs http://127.0.0.1:4175/ production /tmp/mission1-integration-smoke
node docs/frontend/ui-restyling-responsive/navigation-disclosure/controls-qa.cjs http://127.0.0.1:4175/ production /tmp/mission1-disclosure
```

Smoke coverage includes Current Earth, GP/TLE, NASA OEM, Crew, Inspection, native module picking, Cesium wheel input, Historical disclosure, calendar draft/cancellation and Historical Crew. It never replaces real ISS responses with synthetic data. Chromium/Metal smoke evidence does not certify physical mobile Safari/Android or native two-finger pinch.
