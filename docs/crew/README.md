# ISS Crew operational context

Current milestone: **ISS Crew Ingestion + PostgreSQL Persistence**, completed and validated on 2026-10-03. Source validation and the domain contract are complete. Crew describes people, expedition assignments and evidence of physical station presence. It is a separate logical domain inside the existing Java backend; it has no dependency in either direction with Orbit, propagation or rendering.

[Source validation and captured divergence](source-validation/README.md) establishes the real LL2/NASA contracts. [Domain contract](domain-contract.md) defines the Java objects. [Authority and reconciliation](source-authority-and-reconciliation.md) specifies future field-aware interpretation. [Architecture](../architecture/05-crew-operational-context.md), [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md) and the [draft API](../api/crew-api-draft.md) describe the boundaries. [Validation and regression](validation-and-regression.md) records context review and acceptance gates.

Implemented: immutable source-neutral domain/value objects, separate structured/profile/document/verification ports, a read-only LL2 2.3.0 adapter, explicit NASA official-document capture, versioned evidence contract, frozen source fixtures, deterministic tests and an opt-in one-request Java probe. The verification port has **no semantic parser implementation**. A fetched NASA document is not a verified roster.

## Incremental Crew track

1. **Completed:** source validation, domain and adapter/evidence contracts.
2. **Completed:** ingestion and PostgreSQL persistence: durable sync runs, immutable deduplicated snapshots, stable internal UUID identities, low-frequency delayed LL2 ingestion and internal latest-source queries. See [persistence and ingestion](persistence-and-ingestion.md) and [ADR-0008](../adr/0008-immutable-crew-source-history-and-identity-anchors.md).
3. **Next:** NASA CREW VERIFICATION + RECONCILIATION, with reviewed cross-source identities and temporal evidence rules. Preserve source disagreement.
4. **Future:** Crew public REST API.
5. **Future:** Earth View Crew panel and astronaut details, with reconciled presence count and media-rights decisions.
6. **Future:** event-aware refresh.
7. **Future:** Mission Replay integration.

The separate orbital **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS** and Replay roadmap remain pending. The accepted orbit/graphics baseline `8b3f660` stays frozen.

[Acceptance evidence](ingestion-validation/README.md): 156 backend tests including 24 Crew PostgreSQL tests; 171 frontend tests/26 files; one bounded real LL2 ingestion, source-history/identity/rollback gates and unchanged orbital/graphics smoke.
