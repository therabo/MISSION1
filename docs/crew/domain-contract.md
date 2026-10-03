# Crew domain contract — v1

**CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss.**

All production domain types are in `org.mission1.crew.domain`, with no Spring, Jackson, SQL, Orekit or provider DTO dependency. Collections are immutable defensive copies. Absolute times use `Instant`; cumulative elapsed times use `Duration`. Nullable optional fields mean unknown/not supplied, never zero, false or a fabricated event time.

| Actual Java type | Responsibility and identity |
| --- | --- |
| `Station` | MISSION1 station concept `ISS`; unrelated to NORAD or LL2 numeric keys. |
| `CrewSource`, `ExternalId` | Explicit provider/value pair, used in its person/agency/expedition/assignment context. LL2 IDs are not public MISSION1 IDs. |
| `PersonReference` | Nullable MISSION1 UUID before persistence, display name, external mappings and optional official profile URI. Unresolved NASA names can have zero external IDs. |
| `AstronautProfile` | Person, nullable agency, zero/multiple structured nationalities, optional biography/career/media and nullable source `inSpace`, with observation lineage. No aboard-ISS flag exists. |
| `Agency` | Source-neutral name, abbreviation, type and external mappings; not limited to NASA. |
| `Nationality` | Optional ISO alpha-2/alpha-3 and display name. An empty list means no nationality supplied, not statelessness. |
| `CareerStatistics` | Optional cumulative space/EVA durations, flights/spacewalk counts and first/last flight instants; negative statistics rejected. Not a current mission duration. |
| `CrewMediaAsset` | Source URL, thumbnail, credit, license name/link, nullable `singleUse`. Unknown rights remain unknown. No image downloading or mirroring. |
| `Expedition` | Nullable internal UUID before persistence, external identity, name, start/end, station and source reference/observation. Source-neutral model of an observed expedition, not canonical occupancy. |
| `CrewAssignment` | Person ↔ expedition reference, optional source assignment ID, normalized `CrewRole`, original label, optional individual validity times and source observation. LL2 does not supply individual presence/validity intervals; those remain null. |
| `StationPresence` | Separate person/station/as-of claim (`PRESENT`, `DEPARTED`, `UNKNOWN`), optional entry/departure bounds and evidence. Confirmed state requires a compatible assertion naming that person; count, membership or hatch opening alone cannot confirm it. Merely assigned/in-space can remain `UNKNOWN`. This milestone does not derive it automatically. |
| `CrewSourceObservation` | Source/URL, retrieval, optional publication/event times, optional ETag/raw HTTP Last-Modified, SHA-256, source generation and adapter/method version. |
| `CrewSourceSnapshot` | Structured station candidates, total active count, candidate completeness, expeditions, assignments and nested profiles with source observation. No canonical occupancy/count. |
| `NasaSourceType`, `CrewSourceDocument` | Distinct official document category and defensively copied body with observation. Fetching a document does not parse facts or prove presence. |
| `CrewVerificationEvidence` | Typed NASA assertion: entry/departure/current presence/count/membership/docking/undocking/hatch opening, named unresolved subjects where relevant, optional count, source type, observation, supporting text and evidence method. No boolean verified. |
| `CrewSourceState`, `CrewSourceResult` | Operation availability or semantic result plus value/observation or structured failure; no null-return/empty-success fallback. |
| `ReconciliationStatus` | Future agreement/uncertainty vocabulary only; no reconciliation algorithm. |

## Identity and roles

Persistence allocates MISSION1-owned person/expedition UUIDs, with separately unique, entity-scoped `(source, externalId)` mappings. Initial adapter observations leave internal UUIDs null; persisted graph reads populate them. Anchors hold identity and creation time only. Source-derived names/profile/expedition fields belong to immutable snapshot observations. Public resources must eventually use those internal IDs. No NASA IDs are manufactured from names. Prefer stable source IDs, then verified official profile URL/slug, then explicitly reviewed deterministic mappings. Name normalization/transliteration is supporting evidence, never automatic identity truth. For example, the capture contains LL2 “Andrei Fedyaev” and NASA “Andrey Fedyaev”; this milestone does not silently merge them.

The adapter normalizes validated source labels Commander/Flight Engineer to enum values, retains the label, uses `OTHER` for a new non-null role and `UNKNOWN` when role is absent. Source role IDs and priorities are source-only metadata, not cross-provider role logic.

## Time, quality and reproducibility

`retrievedAt` is the injected Clock instant after the HTTP response. Neither a new fetch nor an HTTP Date/Last-Modified means newly updated operational facts. LL2 provides no observation-level publication/event timestamp in the selected roster response; expedition `start`/`end` are expedition lifecycle fields. Cumulative durations can evolve independently and have no verified per-statistic update instant.

NASA prose can explicitly supply a publication instant and an event instant. The October 1 report gives an exact hatch-opening time; it says people entered after that event, without establishing each person's exact entry instant. Preserve the hatch event separately; named entry assertions may have `sourceEventAt=null`. Date-only “Page Last Updated” is not coerced into midnight UTC or treated as publication time.

Source availability, future value quality and reconciliation remain separate. The existing `orbital.domain.Quality` is Orbit-owned, not a suitable shared enum; importing it would violate independence. `CrewSourceState.STALE` reserves an operation result for future explicit as-of freshness policy. This milestone emits no freshness/accuracy certification and invents no Crew TTL or provider cadence. Retained observations must eventually expose their age; recently retrieved old editorial text cannot be called current solely because of fetch time.

SHA-256 identifies exact HTTP bytes. Fixture metadata distinguishes original-body hash from the projected fixture hash. Observation/evidence methods are versioned (`ll2-crew-v1`, `nasa-crew-document-v1`, reviewed test evidence `reviewed-evidence-v1`). Future reconciliation must identify input hashes, method/policy version, identity mappings and evaluation time for reproducibility; Replay must distinguish event time from what was known at retrieval time.

## Port boundaries

`StructuredCrewSource.fetchCurrentExpedition(Station)` returns source snapshots. `CrewProfileSource.fetchAstronautProfile(ExternalId)` performs explicit enrichment. `CrewSourceDocumentSource.fetchDocument(type, URI)` captures a NASA document. `CrewPresenceVerificationSource.verify(document)` defines future deterministic extraction into evidence, **without an implementation** today. None owns polling, persistence, public delivery or canonical reconciliation.

## Durable source history — 2026-10-03

[Persistence and ingestion](persistence-and-ingestion.md) separates sync attempts from unique source states. `CrewSourceSnapshot.sourceStationExternalId` retains the validated station mapping; `AstronautProfile.sourceProfileMode` retains the source response mode. `CrewSourceResult.httpStatus` preserves the actual transport result when available, including successful responses; timeout/network failures do not acquire an invented status. Immutable snapshot provenance contains the first retrieval; a later identical successful run carries its own retrieval time. Persistence truncates absolute instants to PostgreSQL microseconds explicitly. Durations retain nanosecond precision as ISO-8601 text. No source meaning, physical-presence inference or NASA contract changes.
