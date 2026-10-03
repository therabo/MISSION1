# Context actually reviewed

The request attachment, `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md`, repository/skill inventories, Git status/history/remotes and relevant current sections of external `/Users/daniel/Desktop/mission1-project.md` were reviewed. No additional repository-local AGENTS.md or instruction file was found in the managed repository. Historical external/visual dossiers were reviewed in relevant sections; this is not a claim to have inspected every historical asset or every external-context line.

## Skills read and applied

Skill sources under `/Users/daniel/Documents/ChatGPT/MISSION1/.codex/skills/`:

| SKILL.md | Concrete application |
| --- | --- |
| mission-data-pipeline | Accepted ingestion ports/atomic source graph, no retry/enrichment or event bus |
| iss-public-data-sources | Authoritative browsable schema plus exact bounded captures before field reliance |
| iss-ground-segment-architecture | Single backend, Crew/Orbit boundaries, no distributed infrastructure |
| telemetry-quality-and-provenance | Receipt/publication/event/plan time separation, last-known history and unknown classification |
| devops-local-platform | PostgreSQL 16.10 Testcontainers, offline Maven and actual packaged runtime |
| architecture-decisions | Actual next ADR number 0010; significant decision recorded before implementation |
| realtime-api-contracts | Existing Crew JSON and read-only API semantics frozen |
| iss-3d-earth-view | Current source/model/Inspection regression surfaces and lifecycle frozen |
| flight-dynamics-orekit | Computed GP and predicted OEM distinctions and physical frames left intact |

Also read `/Users/daniel/.codex/skills/software-architect/SKILL.md` (architecture consistency/ADR guide) and `/Users/daniel/.codex/skills/frontend-design-codex/SKILL.md` (browser/responsive/visual QA). References reviewed include pipeline-contracts, source-verification-protocol, component checklist, provenance-semantics, quality-semantics, local-runtime-contract, architecture-principles, ADR template and software-architect adr-guide. No sub-agent was used.

## Project documents

Current Crew README, source-validation/README, domain-contract, source-authority-and-reconciliation, persistence-and-ingestion, nasa-verification-and-reconciliation, validation-and-regression, ingestion-validation/README, reconciliation-validation/README, rest-api-validation/README; implemented docs/api/crew-api; backend/README; frontend/README and docs/frontend/crew-earth-view-panel-review/README.

Architecture 01-specification-review, 02-architecture-baseline-v1, 03-repository-and-roadmap, 04-earth-view-orbital-delivery and 05-crew-operational-context were reviewed, with emphasis on current accepted boundaries. ADR index and 0007/0008/0009 were read; no later ADR existed before this change. Current Inspection/rendering/orbital-trajectory documentation and the accepted camera perceptual/focus-optimization, final trajectory candidate and dark-side-oblique-fixes dossiers were reviewed in relevant current sections. Historical measurements and source snapshots remain unchanged.

## Implementation areas

Composition: CrewConfiguration, ingestion/verification configurations and schedulers, properties, Flyway V1–V4 and test setup. Crew application: ingestion policies/services, repository ports, query service, reconciliation query/service/engine/policy, sync outcomes, identity resolution and evidence contracts. Persistence: JDBC roster, verification, reconciliation and read adapters, transaction/history/dedupe rules. Sources: LL2 current-expedition mapper/DTO/HTTP helper and official NASA RSS conditional source/parser. API: accepted Crew controllers/query/DTO/architecture and PostgreSQL tests. Frontend: accepted Crew panel/detail/summary and source/Inspection selectors used to reproduce regression; no source edit. Existing Testcontainers/migration/overlap/rate-limit tests and opt-in live probes were inspected. New policy/adapter/persistence/coordinator/configuration/tests and docs were reviewed after implementation.
