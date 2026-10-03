# Context actually reviewed

This records files read for this milestone, not merely discovered by filename. Recursive inventories of repository instructions, skills, docs and implementations preceded code changes. Large historical graphics/context files were read in bounded current/relevant sections; this is not a claim to reread every old screenshot dossier. No additional repository-local AGENTS/Codex/CLAUDE instruction files were found in the target checkout.

## Instructions

- User's pasted milestone request, read through the final report/push requirements.
- /Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md, plus the user's supplied matching instructions.
- /Users/daniel/Desktop/mission1-project.md, current accepted context and relevant historical constraints (bounded sections).
- Tool/developer requirements: source verification, skills, read-only composition, ordinary main commit/SSH push; no unauthorized agent delegation.

## Skills actually read

Project SKILL.md files under /Users/daniel/Documents/ChatGPT/MISSION1/.codex/skills:

- mission-data-pipeline
- iss-ground-segment-architecture
- flight-dynamics-orekit
- telemetry-quality-and-provenance
- realtime-api-contracts
- devops-local-platform
- iss-3d-earth-view
- iss-public-data-sources
- architecture-decisions
- mission-replay (additional directly applicable skill)

Also /Users/daniel/.codex/skills/software-architect/SKILL.md and frontend-design-codex/SKILL.md.

Supporting references read: replay-time-model, state-reconstruction, orekit-conventions, flight-dynamics-validation, api-conventions, architecture-principles, component-design-checklist, quality-semantics, provenance-semantics, earth-view-contract, cesium-scene-conventions, local-runtime-contract and ci-definition-of-done. ADR guide, pipeline contracts and ADR template were reviewed in relevant sections.

## Crew documents actually read

- docs/crew/README.md
- domain-contract.md
- source-authority-and-reconciliation.md
- persistence-and-ingestion.md
- nasa-verification-and-reconciliation.md
- event-aware-refresh.md
- validation-and-regression.md
- source-validation/README.md
- ingestion-validation/README.md
- reconciliation-validation/README.md
- rest-api-validation/README.md
- event-aware-refresh-validation/README.md

## Orbit/API documents actually read

- docs/telemetry/orbital-element-history.md
- orbital-quality-policy.md
- celestrak-refresh-policy.md
- orbital-elements-verification.md
- docs/api/crew-api.md
- orbital-comparison.md and orbital-samples.md
- backend/README.md, current API/runtime sections

No draft API was treated as current authority.

## Frontend documents actually read

Current/relevant sections of frontend/README.md, docs/frontend/crew-earth-view-panel-review/README.md, earth-visualization.md, iss-inspection-mode.md, rendering-quality.md and iss-model.md. Accepted trajectory/Inspection/camera dossier context was reviewed through the architecture/ADR references and the source implementation. Older PNG evidence was inventoried, not all re-opened.

## Architecture and ADRs actually read

- docs/architecture/01-specification-review.md and 02-architecture-baseline-v1.md
- 03-repository-and-roadmap.md and 04-earth-view-orbital-delivery.md (current and relevant historical sections)
- 05-crew-operational-context.md
- docs/adr/README.md
- ADR-0001 through ADR-0010: backend/pipeline, PostgreSQL, source semantics, GP propagation, NASA OEM, selectable trajectories, independent Crew observations, immutable Crew history, reconciliation and event-aware refresh. Current decisions were read; long ADR-0006 dated graphics clarifications were read separately.

## Implementation inspected

Crew domain snapshots/assignments/profiles, repositories, JDBC persistence/read projections, source sync/document/evidence/resolution history, pure reconciliation engine/policy, reconciliation/current query services, REST composition/DTOs, ingestion/verification/event-aware configuration and offline/PostgreSQL fixtures. Orbit TLE parser, element repository/history, OEM parser/storage/trajectory service, Orekit context/propagator/state records and configuration; Flyway V1–V5 and Compose/test runtime. Frontend App, orbital/comparison hooks, Crew API decoder/resource/list/profile, EarthView clock/position/velocity/pick/Inspection/path lifecycle and display isolation. Existing API/Testcontainers/renderer tests and browser scripts were inspected before extension.

## External verification

Accepted source identifiers, NASA source URL, OEM frame/units and transformation conventions were checked against the existing verified adapter/parser and authoritative source documentation. The conservative GP ±24-hour rule was checked against official Orekit TLEPropagator documentation; it is an application bound, not an accuracy guarantee. No historical provider data was fetched for the audit or Replay implementation.
