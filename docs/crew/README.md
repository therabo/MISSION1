# ISS Crew operational context

Current milestone: **ISS Crew Earth View panel**, implemented and validated on 2026-10-03. Crew remains an independent logical domain inside the existing Java backend/PostgreSQL. The accepted Orbit/graphics subsystem is frozen. [UI acceptance and evidence](../frontend/crew-earth-view-panel-review/README.md).

[Authoritative NASA design](nasa-verification-and-reconciliation.md) describes automated official evidence, identity resolution, time ordering, freshness and immutable interpretation. [Validation dossier](reconciliation-validation/README.md) contains dated real-source results and acceptance gates. [Domain](domain-contract.md), [source authority](source-authority-and-reconciliation.md), [persistence](persistence-and-ingestion.md), [architecture](../architecture/05-crew-operational-context.md) and the [implemented API](../api/crew-api.md) describe current boundaries. Historical source and LL2 ingestion captures remain in [source validation](source-validation/README.md) and [ingestion validation](ingestion-validation/README.md).

CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss. Planned event != completed event. Partial omission != departure.

## Incremental Crew track

1. **Done:** source validation + domain contract.
2. **Done:** ingestion + PostgreSQL persistence under ADR-0008; the accepted LL2 pipeline is retained.
3. **Done:** NASA verification + reconciliation under [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md): delayed conditional RSS ingestion, XML/DOM parsers, immutable source documents/evidence, deterministic identity audits, temporal interpretation and internal canonical queries.
4. **Done:** read-only Crew REST API, stable public DTOs, UUID person resources, quality/provenance and unresolved assertions.
5. **Done:** ISS Crew Earth View panel, list/lazy UUID detail, quality/provenance, unresolved reports and responsive DOM overlays.
6. **Next:** ISS CREW EVENT-AWARE REFRESH.
7. **Future:** Replay integration.

The independent orbital **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS** remains pending. Earth View now consumes the existing Crew REST boundary, without provider calls, source parsing or reconciliation. Refresh is manual/on panel open; event-aware refresh is not started. Live NASA coverage is partial; neither count equality nor source fetch success certifies a complete roster.

[REST validation dossier](rest-api-validation/README.md) records JSON/error contracts, no-network/no-write evidence, PostgreSQL HTTP coverage, performance and frozen regressions.
