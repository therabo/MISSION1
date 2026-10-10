# Crew domain contract — v1

## Source occurrence versioning — 2026-10-10

Article identity is the verified RSS GUID resource key, distinct from raw/observed URL and document/body hash. An assertion occurrence represents a uniquely located typed source claim across compatible revisions; a subject occurrence represents a source mention within that claim. Existing evidence and `(evidence_id, subject_index)` retain their immutable version-lineage roles. Own subject metadata versions preserve additions/removals without carrying stale fields forward. None of these source identities establishes a canonical MISSION1 person UUID.

Exact normalized scope, article/station/type/time context, ordered mentions/count/completeness and explicitly supported parser semantics govern compatibility. Strong-key conflicts and uncertain scope remain independent; names retain spelling/script distinctions and are never global human keys. Current/Replay count selected unresolved source occurrences, including retained non-applicable entries, rather than raw evidence revisions. See [ADR-0012](../adr/0012-versioned-crew-source-occurrences.md) and [validation](source-occurrence-versioning-validation/README.md).

**Current scheduling extension (2026-10-03):** [ISS Crew event-aware refresh](event-aware-refresh.md) adds a bounded LL2 docking/undocking calendar, conservative NASA anticipation and durable completed-NASA-transfer follow-up. Planning events remain separate from crew presence and assignment truth. Baseline 2h source schedules, parser/reconciliation semantics and this document’s dated validation evidence remain applicable. New operational history uses V5; see the [new validation dossier](event-aware-refresh-validation/README.md). Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

## Earth View consumption — 2026-10-03

The implemented [Crew panel](../frontend/crew-earth-view-panel-review/README.md) preserves domain distinctions through the public REST DTOs. `officialAboard` is the main nullable count, never member-array length; confirmed resolved identities, retained official count, unidentified gap, unresolved assertion entries and structured assignments retain separate labels. Role grouping uses backend assignment codes. NASA-only confirmed people have no invented assignment; unresolved subjects remain source reports without a person UUID or canonical presence. The frontend displays backend presence/status/applicability rather than deriving new states. Cumulative career duration is formatted as elapsed time, independently of timestamps and the Cesium clock. No domain behavior changes.

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

Persistence allocates MISSION1-owned person/expedition UUIDs, with separately unique, entity-scoped `(source, externalId)` mappings. Initial adapter observations leave internal UUIDs null; persisted graph reads populate them. Anchors hold identity and creation time only. Source-derived names/profile/expedition fields belong to immutable snapshot observations. Public resources must eventually use those internal IDs. No NASA IDs are manufactured from names. Prefer stable source IDs, then verified official profile URL/slug, then explicitly reviewed deterministic mappings. Conservative exact unique name normalization is now an audited fallback; transliteration and fuzzy matching are forbidden. For example, the capture contains LL2 “Andrei Fedyaev” and NASA “Andrey Fedyaev”; this milestone does not silently merge them.

The adapter normalizes validated source labels Commander/Flight Engineer to enum values, retains the label, uses `OTHER` for a new non-null role and `UNKNOWN` when role is absent. Source role IDs and priorities are source-only metadata, not cross-provider role logic.

## Time, quality and reproducibility

`retrievedAt` is the injected Clock instant after the HTTP response. Neither a new fetch nor an HTTP Date/Last-Modified means newly updated operational facts. LL2 provides no observation-level publication/event timestamp in the selected roster response; expedition `start`/`end` are expedition lifecycle fields. Cumulative durations can evolve independently and have no verified per-statistic update instant.

NASA prose can explicitly supply a publication instant and an event instant. The October 1 report gives an exact hatch-opening time; it says people entered after that event, without establishing each person's exact entry instant. Preserve the hatch event separately; named entry assertions may have `sourceEventAt=null`. Date-only “Page Last Updated” is not coerced into midnight UTC or treated as publication time.

Source availability, future value quality and reconciliation remain separate. The existing `orbital.domain.Quality` is Orbit-owned, not a suitable shared enum; importing it would violate independence. `CrewSourceState.STALE` reserves an operation result for future explicit as-of freshness policy. The source/domain foundation emitted no freshness policy; current reconciliation adds explicit configurable MISSION1 applicability limits, without provider cadence or accuracy guarantees. Retained observations must eventually expose their age; recently retrieved old editorial text cannot be called current solely because of fetch time.

SHA-256 identifies exact HTTP bytes. Fixture metadata distinguishes original-body hash from the projected fixture hash. Observation/evidence methods are versioned (`ll2-crew-v1`, `nasa-crew-document-v1`, reviewed test evidence `reviewed-evidence-v1`). Future reconciliation must identify input hashes, method/policy version, identity mappings and evaluation time for reproducibility; Replay must distinguish event time from what was known at retrieval time.

## Port boundaries

`StructuredCrewSource.fetchCurrentExpedition(Station)` returns source snapshots. `CrewProfileSource.fetchAstronautProfile(ExternalId)` performs explicit enrichment. `CrewSourceDocumentSource.fetchDocument(type, URI)` captures a NASA document. `CrewPresenceVerificationSource.verify(document)` now has the versioned RSS/DOM implementation described in the NASA design. None owns polling, persistence, public delivery or canonical reconciliation.

## Durable source history — 2026-10-03

[Persistence and ingestion](persistence-and-ingestion.md) separates sync attempts from unique source states. `CrewSourceSnapshot.sourceStationExternalId` retains the validated station mapping; `AstronautProfile.sourceProfileMode` retains the source response mode. `CrewSourceResult.httpStatus` preserves the actual transport result when available, including successful responses; timeout/network failures do not acquire an invented status. Immutable snapshot provenance contains the first retrieval; a later identical successful run carries its own retrieval time. Persistence truncates absolute instants to PostgreSQL microseconds explicitly. Durations retain nanosecond precision as ISO-8601 text. No source meaning, physical-presence inference or NASA contract changes.

## Implemented NASA/reconciliation additions — 2026-10-03

`CrewVerificationEvidence` now includes explicit Completeness (EXHAUSTIVE/PARTIAL/EVENT_ONLY/COUNT_ONLY) and Assertion (OBSERVED/COMPLETED/PLANNED). `CrewIdentityResolution` records immutable per-subject decisions, candidates, keys and resolver version. `CrewReconciliationSnapshot` carries algorithm/policy version, evaluation instant, input IDs/fetch contexts, per-person current/last-known presence, unresolved subjects, comparison sets, separate official count and unidentifiedCount. Immutable lists preserve record value semantics. `CrewReconciliationQueryService` recalculates age using persisted inputs without changing history.

Current states are CONFIRMED_ABOARD, CONFIRMED_NOT_ABOARD, UNVERIFIED, UNKNOWN, STALE and AMBIGUOUS. A person can have a NASA-only UUID and no LL2 profile/assignment. A source person with no safe resolution remains a named evidence subject, not an invented identity. Exact name matching does not merge Andrei/Andrey Fedyaev. See [implemented authority, status and time rules](nasa-verification-and-reconciliation.md).

## Public REST identity and representation — 2026-10-03

[Implemented API](../api/crew-api.md) uses persisted MISSION1 person/expedition UUIDs; external LL2/NASA identifiers remain labeled mappings. Assignment and canonical presence are distinct objects. Collection members form the current reconciler's resolved union; NASA-only persons can have no assignment/profile. Unresolved assertion subjects have no fabricated ID or canonical presence: public source assertion/time/applicability and resolution state are exposed separately. Official current count, retained count, confirmed resolved count, unresolved assertion count and assignment count remain different quantities. No domain meaning or reconciler policy changed.


## Replay integration — 2026-10-03

Replay retains assignment/presence and planned/completed distinctions. Operational fields are evaluated at T; profile metadata may be newer and is labeled. Knowledge-time reconstruction is separate. [Crew Replay](../replay/crew-replay.md).
