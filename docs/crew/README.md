# ISS Crew operational context

Current milestone: **NASA Crew Verification + Reconciliation**, implemented and validated on 2026-10-03. Crew remains an independent logical domain inside the existing Java backend/PostgreSQL. The accepted Orbit/graphics subsystem is frozen.

[Authoritative NASA design](nasa-verification-and-reconciliation.md) describes automated official evidence, identity resolution, time ordering, freshness and immutable interpretation. [Validation dossier](reconciliation-validation/README.md) contains dated real-source results and acceptance gates. [Domain](domain-contract.md), [source authority](source-authority-and-reconciliation.md), [persistence](persistence-and-ingestion.md), [architecture](../architecture/05-crew-operational-context.md) and the [draft API](../api/crew-api-draft.md) describe current boundaries. Historical source and LL2 ingestion captures remain in [source validation](source-validation/README.md) and [ingestion validation](ingestion-validation/README.md).

CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss. Planned event != completed event. Partial omission != departure.

## Incremental Crew track

1. **Done:** source validation + domain contract.
2. **Done:** ingestion + PostgreSQL persistence under ADR-0008; the accepted LL2 pipeline is retained.
3. **Done:** NASA verification + reconciliation under [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md): delayed conditional RSS ingestion, XML/DOM parsers, immutable source documents/evidence, deterministic identity audits, temporal interpretation and internal canonical queries.
4. **Next:** ISS CREW REST API.
5. **Future:** Earth View Crew UI and astronaut details.
6. **Future:** event-aware refresh.
7. **Future:** Replay integration.

The independent orbital **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS** remains pending. No Crew controller or frontend was added. Live NASA coverage is partial; neither count equality nor source fetch success certifies a complete roster.
