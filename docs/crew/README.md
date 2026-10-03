# ISS Crew operational context

Current milestone: **Crew Source Validation + Domain Contract**, implemented 2026-10-03. Crew describes people, expedition assignments and evidence of physical station presence. It is a separate logical domain inside the existing Java backend; it has no dependency in either direction with Orbit, propagation or rendering.

[Source validation and captured divergence](source-validation/README.md) establishes the real LL2/NASA contracts. [Domain contract](domain-contract.md) defines the Java objects. [Authority and reconciliation](source-authority-and-reconciliation.md) specifies future field-aware interpretation. [Architecture](../architecture/05-crew-operational-context.md), [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md) and the [draft API](../api/crew-api-draft.md) describe the boundaries. [Validation and regression](validation-and-regression.md) records context review and acceptance gates.

Implemented: immutable source-neutral domain/value objects, separate structured/profile/document/verification ports, a read-only LL2 2.3.0 adapter, explicit NASA official-document capture, versioned evidence contract, frozen source fixtures, deterministic tests and an opt-in one-request Java probe. The verification port has **no semantic parser implementation**. A fetched NASA document is not a verified roster.

## Incremental Crew track

1. **Completed:** source validation, domain and adapter/evidence contracts.
2. **Next:** ISS CREW INGESTION + POSTGRESQL PERSISTENCE. Design bounded acquisition, source observation history and identity mappings using existing PostgreSQL/JDBC/Flyway conventions; not implemented here.
3. **Future:** reviewed identity resolution, operational evidence ingestion and temporal, field-aware reconciliation. Preserve source disagreement.
4. **Future:** public read APIs, Earth View Crew panel and astronaut details, with reconciled presence count and media-rights decisions.
5. **Future:** docking-triggered acquisition and Mission Replay integration after durable observation/event time semantics exist.

The separate orbital **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS** and Replay roadmap remain pending. The accepted orbit/graphics baseline `8b3f660` stays frozen.
