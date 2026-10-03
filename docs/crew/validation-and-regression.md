# Crew milestone validation and regression — historical records and current gate

**Current scheduling extension (2026-10-03):** [ISS Crew event-aware refresh](event-aware-refresh.md) adds a bounded LL2 docking/undocking calendar, conservative NASA anticipation and durable completed-NASA-transfer follow-up. Planning events remain separate from crew presence and assignment truth. Baseline 2h source schedules, parser/reconciliation semantics and this document’s dated validation evidence remain applicable. New operational history uses V5; see the [new validation dossier](event-aware-refresh-validation/README.md). Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

## Earth View Crew panel acceptance — 2026-10-03

The current frontend gate is [the Crew Earth View dossier](../frontend/crew-earth-view-panel-review/README.md). It records 269 frontend tests/30 files, API/SSR/mounted-hook tests, all eight statuses and six presence states, request/cancellation/no-polling tests, count/group/unresolved semantics, safe biography/media/duration cases, real PostgreSQL-backed API smoke, native desktop/narrow/tablet/mobile screenshots, development/served-production workflows, keyboard/focus checks, passive camera/time/frame measurements and bounded lifecycle observations. Backend Maven test/verify retain 268 passing tests with zero source changes. Graphics/orbital/backend byte-freeze and complete diff checks are required before commit. Physical touch-pinch verification is explicitly distinguished from unchanged tested pinch wiring; no unobserved gesture is claimed. Next single Crew milestone: **ISS CREW EVENT-AWARE REFRESH**.

Current NASA verification/reconciliation acceptance is recorded in [the current dossier](reconciliation-validation/README.md). The source/domain foundation and LL2 ingestion records below remain dated historical evidence.

## Source/domain foundation record — 2026-10-03

Baseline verified before implementation: clean `main`, `origin/main` and direct remote `main` at `8b3f660c66f9ba6adc0c01f49ee873406c8f7a1c`, remote `git@github.com:therabo/MISSION1.git`. Changes are confined to independent Crew Java records/ports/adapters/configuration/tests/fixtures and Crew/architecture documentation. The external project context is `/Users/daniel/Desktop/mission1-project.md`, outside the repository.

## Context actually inspected

- Project AGENTS at `/Users/daniel/Documents/ChatGPT/MISSION1/AGENTS.md` and the external project context.
- Actual project skills: `iss-public-data-sources`, `iss-ground-segment-architecture`, `telemetry-quality-and-provenance`, `realtime-api-contracts`, `devops-local-platform`, `architecture-decisions`; supporting `flight-dynamics-orekit` only for the frozen dependency boundary, and `mission-data-pipeline` for adapter mechanics. Source-validation, registry, architecture, quality/provenance, API, local-runtime/CI and ADR reference instructions were applied.
- `software-architect` and its ADR/fitness-function references. Frontend implementation/design skill was unnecessary because no Crew UI was authorized.
- Backend/frontend READMEs; architecture 03/04; orbital-comparison API; ADR index and ADRs 0001/0002/0003/0005/0006; source registry, orbital persistence and refresh documentation.
- Existing package boundaries, CelesTrak/NASA HTTP clients, DTO placement, Clock configuration, operation/quality models, Spring JDBC/Flyway resources and PostgreSQL/Testcontainers/API test conventions.

## Source and scope gates

[Source validation](source-validation/README.md) and the fixture capture manifest record nine explicit LL2 JSON GETs, one standalone docs probe (403) and five NASA official page captures. No repeated live test loop or quota exhaustion experiment occurred. A single opt-in production adapter call ran after offline Crew tests passed. Default tests never call those external services.

The implementation makes no startup Crew request and creates no scheduler, Crew entity/table/migration, public Crew controller, frontend Crew UI, reconciliation engine or runtime prose/LLM parser. ApplicationContextRunner proves zero Crew requests during bean registration; module fitness checks prohibit Crew↔Orbit dependencies and domain infrastructure imports. Counts and hatch/membership evidence cannot alone confirm an individual's presence.

## Automated gates

| Gate | Observed result |
| --- | --- |
| Java runtime | Amazon Corretto 21.0.3 |
| `mvn -o test` | **120 tests**, zero failures/errors/skips; 82 existing + 38 Crew tests. |
| `mvn -o verify` | **120 tests**, zero failures/errors/skips; build/repackaged jar succeeded. |
| Node runtime | Node 24 via `/opt/homebrew/opt/node@24/bin`. |
| Frontend `npm test` | **171 tests / 26 files**, all passed. |
| Frontend `npm run typecheck` | Passed. |
| Frontend `npm run build` | Passed; existing large-chunk warning retained. |
| Real backend startup | Java 21 jar on port 8080, existing PostgreSQL 16.10 healthy at localhost:5432; Flyway validated existing 2 migrations, schema version 2, no new migration. |
| Orbital HTTP smoke | `/api/iss/state`, `/api/iss/orbit/samples`, `/api/iss/orbit/comparison`: HTTP **200** at 09:06:05–09:06:06 UTC. Existing computed GP / source-predicted OEM semantics retained. |
| `git diff --check` | Passed before staging/commit. |

Java used `JAVA_HOME=/Users/daniel/Library/Java/JavaVirtualMachines/corretto-21.0.3/Contents/Home`; no dependency/version changes were required. Maven offline mode uses the already-installed dependency cache; PostgreSQL integration tests use the existing Docker/Testcontainers image, not LL2/NASA. The local Docker VM had stopped before integration validation and was restarted using the installed Docker runtime, preserving the PostgreSQL volume.

## Frozen-system audit and browser smoke

Byte comparison against the accepted baseline verified **4,707 pre-existing tracked files unchanged**, including all **92 frontend files** and **69 backend files** outside README/configuration. The original orbital configuration remains byte-for-byte intact; only six Crew lines were appended. The four existing changed files are backend README, application properties, ADR index and architecture roadmap. Recorded fixture hashes match both the manifest and companion metadata.

Production browser smoke used the built frontend on port 4175 and the real backend, without source interception, time override or injected scene state. Earth imagery, ISS model and forward trajectory rendered; GP/TLE Inspection/Back and NASA OEM source switch/Inspection/Back completed. Source labels, physical readouts, model-ready state and unavailable real attitude remained explicit. Browser console observation returned zero error/warning entries. A development smoke on port 5175 also checked the existing app against the same backend.

This is a focused unchanged-system smoke, not a new graphics/camera performance or geometry audit. No rendering files/assets changed. Crew adds inert beans and explicit-call capabilities, with no continuous workload; no new FPS benchmark or provider cadence guarantee is claimed.

## Completed scope and next gate

Real source evidence, semantic domain/ports, minimal LL2 adapter, NASA document/evidence contract, fixture/error/startup/dependency tests, authority matrix and ADR-0007 are implemented. Persistence, periodic ingestion, canonical temporal reconciliation, REST/UI, docking-triggered refresh and Crew Replay remain future phases. Orbital RTN analysis and the existing Replay roadmap remain pending.

Next single milestone: **ISS CREW INGESTION + POSTGRESQL PERSISTENCE**. It has not been started.

## Subsequent persistence milestone

The dated source/domain milestone above remains historical. Current ingestion/persistence acceptance is recorded separately in [ingestion validation](ingestion-validation/README.md), with [persistence semantics](persistence-and-ingestion.md) and ADR-0008.

## NASA verification/reconciliation acceptance — 2026-10-03

Starting baseline c2ada2b1ae76b3d49090ffb9b050ba679d0b2d44, clean main/origin/main. Context reviewed: project AGENTS, original external context, all Crew documents and architecture03/05, draft Crew API, ADR0007/0008/index; existing Java domain/ports/HTTP/source adapters, LL2 ingestion/policy/query/JDBC migration/history, root configuration and scheduler/tests. Applied skills: iss-public-data-sources, mission-data-pipeline, iss-ground-segment-architecture, telemetry-quality-and-provenance, software-architect, devops-local-platform, architecture-decisions, realtime-api-contracts and flight-dynamics-orekit for frozen boundaries. No delegated agents or frontend implementation skill was needed.

225 offline backend tests include 42 real Crew PostgreSQL/Testcontainers tests (24 retained LL2 + 18 NASA/reconciliation). New parser/identity/status/time/count/error/configuration tests cover partial/count-only safety, planned/completed/future events, old late arrivals, insertion-order independence, exhaustive omission, unknown/ambiguous identities, all eight statuses, stale read-time quality, conditional HTTP, overlap/rate limits and transaction rollback. V4 empty migration and V3 upgrade preserve Crew and orbital sentinel rows. Maven test/verify, frontend171 tests/26 files, typecheck/build, executable startup, orbital API/browser smoke and byte-freeze evidence are summarized in [the dossier](reconciliation-validation/README.md). No default public-source requests or H2 substitution.

Scope ends at internal canonical query. No Crew controller/frontend, universal NASA override, fuzzy/LLM identity extraction, docking refresh, RTN analysis or Replay implementation. [ADR0009](../adr/0009-field-aware-crew-reconciliation.md) records the significant derived-state and field-authority decision without superseding ADR0007/0008. Next single milestone: ISS CREW REST API.

## Crew REST acceptance — 2026-10-03

The current milestone is ISS CREW REST API; older sections above remain historical. [REST validation](rest-api-validation/README.md) is the current gate. Controller JSON tests cover every existing status, the 11/8/3/7 partial-match class, LL2-only and NASA-only separation, missing/stale/degraded state, unknown/malformed UUID, historical/partial profiles, Unicode/text/durations/media rights and public provenance. PostgreSQL Testcontainers applies Flyway and proves actual persisted HTTP reads, no network/write side effects, read-only repeatable-read transactions and constant SQL count as the roster grows. Maven test/verify and retained frontend test/typecheck/build/API/browser gates must pass before commit/push. Orbit, source parsers, reconciliation and schedulers remain frozen. Next: ISS CREW EARTH VIEW PANEL.
