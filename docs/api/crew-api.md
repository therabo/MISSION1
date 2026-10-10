# ISS Crew REST API

**Operational scheduling note (2026-10-03):** [Event-aware refresh](../crew/event-aware-refresh.md) can shorten background source eligibility near verified planning windows and after completed named NASA transfers. These three GET routes, JSON fields, read-only behavior, status/freshness semantics and reconciliation rules are unchanged. Events never directly alter presence or official count. No refresh or event endpoint is added.

## Earth View consumer — 2026-10-03

The [Crew panel](../frontend/crew-earth-view-panel-review/README.md) reads the collection once on open and fetches one UUID detail when selected. It uses the collection's structured input and does not also request the independently latest Expedition endpoint. Refresh is user initiated; no automatic polling or provider request is added. Abort/late-response protection prevents abandoned detail from replacing the current view. The consumer preserves nulls, all public status/presence values, distinct counts and assertion applicability; it performs no identity matching. Biography is rendered as text. Media is displayed only under an explicit reviewed reuse policy, with original URL and credit. This consumer note does not change the backend contract below.

Contract selected before implementation, 2026-10-03. Three read-only resources:

- `GET /api/iss/crew`: current age-aware reconciled interpretation plus structured context.
- `GET /api/iss/expedition/current`: latest structured LL2 expedition outcome; assignment is not presence.
- `GET /api/iss/crew/{astronautId}`: known MISSION1 UUID person, including NASA-only and historical persons.

Public DTOs are separate from domain/persistence types. Controller → REST composition/read service → existing Crew queries and a batched persisted-person query → PostgreSQL. Reads run in a read-only repeatable-read transaction. No source fetch, identity resolution write or reconciliation run is allowed on GET.

Selected field groups: station, expedition, counts, members, unresolvedSubjects, reconciliation, freshness, provenance. Separate official current count, last-known official count, confirmed resolved count, unresolved assertion-subject count, unidentified count gap and structured assignment count. Unknown optional values are explicit null; collections are arrays. UUIDs are MISSION1 identities; external IDs are labeled source/value pairs. UTC instants and elapsed durations use ISO-8601 strings. Media rights stay attached to media. Biography stays text.

Unresolved subjects retain the source assertion and resolution status, without a fabricated ID or inferred canonical presence. The existing engine has no canonical unresolved-person state. Source applicability and assertion time remain visible. Last-known count may be retained while current authoritative count is null.

Availability: usable partial/last-known state → 200 with existing reconciliation status. No usable persisted state → 503. Explicit NO_ACTIVE_EXPEDITION → 200/null expedition/empty assignments, even without a prior graph. Latest transport failure preserves the previous valid state with health. Malformed UUID → 400; unknown UUID → 404; internal errors → sanitized 500. Follow existing ProblemDetail URN conventions. Cache-Control no-store; no ETag because time changes quality without changing source bytes. Existing CORS/security unchanged.

ADR review: ADR-0007 already governs field authority/public UUIDs, ADR-0008 immutable history, ADR-0009 effective reconciliation. This implements those boundaries using existing JDBC/REST conventions; no new ADR is required.

## Wire rules and stability

All successful resources return `200 application/json`, `Cache-Control: no-store`. Optional scalars/objects are explicitly `null`; collections always serialize as `[]` when empty. No endpoint returns source DTOs or database row identifiers. URI fields are JSON strings. UUIDs use canonical hyphenated syntax; uppercase request hex is accepted. Instants are UTC ISO-8601 strings. Career durations are ISO-8601 elapsed-duration strings (`Duration.toString()`, e.g. `PT10470H28M11S`); a day-based input can normalize to hours with the same duration. They are cumulative source career totals, not current mission elapsed time. Role/presence/status values are enum names, never localized labels.

Clients should tolerate future additive optional fields and new external IDs. Changing field meaning, ID policy or removing/renaming fields requires explicit compatibility review and contract tests. No Springdoc/OpenAPI dependency existed; Markdown and executable JSON tests remain the specification. Existing security/CORS configuration is unchanged. GET/HEAD are the only resource reads registered here; no mutation operations, history or subscriptions are added.

## `GET /api/iss/crew`

Returns the current effective reconciliation evaluated from persisted observations/resolutions. It can remain available with degraded sources or aging facts. It does not fetch NASA/LL2 or persist the read-time evaluation. Expedition/assignments correspond to the exact LL2 input used by that interpretation; this is last-known structured context when a later semantic source outcome exists. The dedicated Expedition endpoint exposes the latest structured semantic outcome independently.

| Field | Representation and meaning |
| --- | --- |
| `station` | `{id:"ISS", name:"International Space Station"}`; provider station IDs never replace this identity. |
| `expedition` | Nullable `{id: MISSION1 UUID, name, start, end, externalIds:[{source,value}]}`. Start/end are nullable source lifecycle instants. Membership does not mean occupancy. |
| `counts.officialAboard` | Nullable authoritative current count from the reconciler, additionally requiring usable NASA health and count applicability under the unchanged policy. Never derived from an array. |
| `counts.lastKnownOfficialAboard` | Nullable retained reconciler count, possibly stale/unverified. Later transitions can invalidate it; this is not an unbounded historical lookup. |
| `counts.resolvedAboard` | Number of resolved people whose **effective current** presence is `CONFIRMED_ABOARD`. |
| `counts.unresolvedSubjects` | Number of unresolved **assertion-subject entries** in `unresolvedSubjects`, not a claim of distinct/current people. Different assertions can mention the same unresolved name. |
| `counts.unidentifiedAboard` | Existing reconciler's nonnegative count gap (retained count minus effective confirmed resolved people, clamped at zero). It may differ from unresolved entry count, especially when stale/degraded. It never creates placeholder people. |
| `counts.structuredAssignments` | Nullable number of assignments in the interpretation's structured input; null when there is no such input. |
| `members` | Resolved-person union returned by the current reconciliation: structured assignments plus resolved NASA presence context, including stale/departed persons retained by the engine. Ordered by UUID. No biography in collection. |
| `unresolvedSubjects` | `{displayName,resolution,evidence,applicable}`. Resolution is `UNRESOLVED` or `AMBIGUOUS`. No person UUID, candidates, parser key or guessed profile. The source assertion is exposed; no canonical unresolved-person presence is invented. |
| `reconciliation` | Exact existing `status`, `evaluatedAt`, nullable persisted snapshot's original `reconciledAt`, `algorithmVersion`, nullable `lastAttemptAt`, `lastAttemptCompletedAt`, `lastAttemptResult`. Evaluation and persisted run times are distinct. |
| `freshness` | `evaluatedAt`, separate `structuredSource`/`verification` health, and whether overall reconciliation status is `STALE`. Per-member stale/ambiguous states remain explicit even when another status has precedence. |
| `provenance` | Nullable `structuredSource` observation for the exact LL2 input, nullable `verification` observation from the latest successful NASA operation, and `contributingAssertions` from all used evidence. Multiple source documents/hashes and article URLs are retained honestly. |

**Official/current Crew count need not equal member array length, confirmed resolved count, unresolved entry count, or LL2 assignment count.** The dated partial-match class is official 11, resolved aboard 8, unresolved entries 3, structured assignments 7, members 9 (six in both, one LL2-only unverified, two NASA-only). Do not use array length as `crewCount`. Count equality alone never certifies exhaustive agreement.

Each member has `{id,name,agency,nationalities,image,assignment,presence,externalIds}`. Name may be null for an identity anchor without a known public name. Agency/image/assignment are nullable. `nationalities` and `externalIds` are arrays. Agency has `name,abbreviation,type,externalIds`; nationality has nullable `alpha2,alpha3,displayName`. Image fields are documented below. Collection profiles belong to the exact structured input; detail may expose a latest known historical profile.

`assignment` has MISSION1 `expeditionId`, nullable original `role`, normalized `roleCode`, nullable `validFrom,validUntil`. Role codes: COMMANDER, FLIGHT_ENGINEER, OTHER, UNKNOWN. NASA-only members have null assignment. LL2-only members remain UNVERIFIED under the existing reconciler; `in_space` is never used to confer presence and is not exposed here.

`presence` has `state,lastKnownState,asOf,authority,evidence`. States are CONFIRMED_ABOARD, CONFIRMED_NOT_ABOARD, UNVERIFIED, UNKNOWN, STALE, AMBIGUOUS. `lastKnownState`, `asOf`, `authority` are nullable. Authority is NASA_OFFICIAL when source evidence supports current/retained claims, including stale context; it is not a blanket verification boolean. Evidence is an array of the public assertion objects below.

Reconciliation statuses are unchanged: MATCH, NASA_AHEAD, LL2_AHEAD, PARTIAL_MATCH, PRIMARY_UNAVAILABLE, VERIFICATION_UNAVAILABLE, STALE, AMBIGUOUS. Their authority/ordering rules remain in [the reconciliation design](../crew/nasa-verification-and-reconciliation.md).

Unresolved subjects exist when official public evidence names someone without a safe persisted identity resolution. They carry the assertion type/time, source and applicability. A departure assertion is not presented as current aboard; repeated/equal-time/conflicting assertions are not silently folded into an invented canonical person. Only the existing resolved-person engine establishes canonical presence. Source text excerpts, subject indices and candidate identity internals are omitted.

## Shared health/provenance objects

`SourceHealth` fields: `source`, nullable `sourceState,lastAttemptAt,lastAttemptResult,lastSuccessfulFetchAt,lastFailureAt,retryAfterAt`, booleans `lastRefreshFailed,rateLimited,stale`. Last attempt can be a persisted scheduler skip; failure/success remain separate. `lastRefreshFailed` describes a newer nonsuccessful operational outcome; explicit NO_ACTIVE_EXPEDITION is a normal semantic result and excluded from that boolean. `stale` describes age of an existing successful fetch under the configured source policy; no successful fetch means null time, not a fresh invented observation. `rateLimited` and retry eligibility come from the existing query, not HTTP retry behavior in REST.

Observation fields: `source,sourceType,sourceUrl,observedAt,sourcePublishedAt,sourceEventAt,contentHash,sourceVersion,methodVersion`. Optional publication/event times are null when unavailable. `observedAt` is original persisted observation retrieval; latest successful fetch time is separate. An assertion contains `source,sourceType,type,assertion,completeness,asOf,provenance`; `asOf` is event time when explicitly available, otherwise publication context. `sourceType` distinguishes operational post evidence from feed transport. Assertion/completeness enums retain the domain vocabulary. Method versions and hashes identify interpretation inputs, never parser diagnostics. No raw HTML/XML, source-document body, internal database IDs, SQL, stack trace or matching key is exposed.

## `GET /api/iss/expedition/current`

Returns **structured LL2 assignment semantics**, independently of physical presence. Schema: `{station,expedition,assignmentCount,assignments,sourceState,freshness,provenance}`. Station/expedition/health/observation use the shapes above. Assignments have `{personId,name,role,roleCode,agency,nationalities}`; personId is a MISSION1 UUID, agency is nullable, nationalities is an array. No aboard boolean/presence inference is included.

Latest usable `AVAILABLE` → last successful graph, including when a later transport/parse/storage attempt fails. `assignmentCount` is the number of **assignments**, never aboard count. `sourceState=NO_ACTIVE_EXPEDITION` → 200, expedition null, assignmentCount 0, assignments []; this persisted semantic outcome survives a later transport failure until a newer successful structured observation. The read projection checks successful graph and explicit no-active outcomes; it never rewrites the source history. If neither has ever existed → 503 crew-primary-unavailable. Ambiguous/failed attempts with an older usable graph → 200 retained graph plus health.

## `GET /api/iss/crew/{astronautId}`

`astronautId = MISSION1 UUID`, never the LL2 astronaut integer. Existence belongs to the persisted person anchor, independent of current membership. Schema:

`{id,name,officialProfileUrl,externalIds,agency,nationalities,biography,image,career,profileAvailability,currentAssignment,currentPresence,reconciliation,profileProvenance,profileLastSuccessfulFetchAt}`.

Biography is nullable source **text**, including punctuation/newlines or HTML-like characters; JSON does not confer HTML trust. Future clients must render it as text. `profileAvailability=AVAILABLE` means a structured profile observation exists, not that every field is supplied; `UNAVAILABLE` is valid for NASA-only/identity-only people. Missing agency/biography/image/career/provenance/fetch time stay null, nationalities empty. NASA-only names/profile links/external IDs come from persisted resolutions and mappings; no profile enrichment occurs on GET. A historical person returns the latest known persisted successful profile, current assignment null if absent, and current reconciler state (UNKNOWN without current evidence). No history array is added.

`image` has nullable source `url,thumbnailUrl,credit,licenseName,licenseUrl,singleUse`. Unknown rights remain unknown, not reusable permission. Source media URLs are never downloaded/mirrored by REST.

`career` is nullable and has nullable `timeInSpace,evaTime,flightsCount,spacewalksCount,firstFlight,lastFlight`. Durations are ISO-8601 elapsed durations; counts are numbers without invented zeros. `currentAssignment`, `currentPresence`, reconciliation and profile provenance use shared shapes. Current presence is always an object, UNKNOWN with null context/empty evidence if no current state exists.

## HTTP errors

All errors use existing Spring `application/problem+json`: `type` stable URN, `title,status,detail`, request `instance`. Details are sanitized. No source error/SQL/parser text is reflected.

| Condition | HTTP | Type |
| --- | --- | --- |
| Malformed/noncanonical UUID (including LL2 integer) | 400 | urn:mission1:problem:bad-request |
| Genuinely unknown MISSION1 person | 404 | urn:mission1:problem:person-not-found |
| No usable persisted Crew interpretation | 503 | urn:mission1:problem:crew-state-unavailable |
| No usable structured outcome | 503 | urn:mission1:problem:crew-primary-unavailable |
| One source degraded, usable partial/retained state exists | 200 | Quality/health in normal response |
| Unexpected database/mapping/application failure | 500 | urn:mission1:problem:crew-internal-error |

Error example:

```json
{"type":"urn:mission1:problem:person-not-found","title":"Crew person not found","status":404,"detail":"No persisted MISSION1 person has this UUID.","instance":"/api/iss/crew/00000000-0000-0000-0000-000000000099"}
```

Full dated response examples and HTTP validation evidence are in [REST validation](../crew/rest-api-validation/README.md). These are persisted-source observations at a stated date, never permanent current roster invariants. Synthetic contract-test people remain test-only.

## Dated success examples

The full JSON examples were read from the existing real PostgreSQL state at **2026-10-03T12:59:23Z** with Crew source scheduling disabled. They contain provenance and nullable fields exactly as serialized, not abbreviated schema illustrations:

- Crew: [full response](../crew/rest-api-validation/crew-response.json) — PARTIAL_MATCH, official aboard 11, resolved aboard 8, unresolved assertion subjects 3, structured assignments 7, members 9.
- Structured Expedition: [full response](../crew/rest-api-validation/expedition-response.json) — AVAILABLE, seven assignments in the persisted LL2 Expedition context, without a presence claim.
- MISSION1 person: [full response](../crew/rest-api-validation/person-response.json) — persisted UUID/profile, ISO durations, media rights, separate current assignment/presence and profile/reconciliation provenance.

No-active representation has the same field groups with `expedition:null,assignmentCount:0,assignments:[],sourceState:"NO_ACTIVE_EXPEDITION"`; source health and available observation provenance still apply. NASA-only person has `profileAvailability:"UNAVAILABLE"`, nullable structured fields/provenance and a persisted public name/identity/current evidence when available.


## Replay integration — 2026-10-03

Current Crew endpoints remain current. Historical operational state is exposed through the independent [Mission Replay API](replay-api.md), with latest retained profile metadata clearly distinguished.


## Compatible source versions — 2026-10-10

Public DTO fields and routes are unchanged. Before reconciliation, the shared ADR-0012 selector chooses the latest successfully observed compatible evidence interpretation per conservative logical source occurrence. `counts.unresolvedSubjects` and `unresolvedSubjects` count interpreted unresolved source occurrences, including retained/non-applicable entries, rather than every stored evidence version. Distinct articles/claims/events remain distinct; this is not a count of unique humans. `officialAboard`, `lastKnownOfficialAboard`, resolved presence and assignments retain their existing applicability and authority rules. A freshly observed old article does not become a newly timed operational fact.

Unselected evidence and subject metadata revisions remain available in immutable internal occurrence/version lineage. They do not create additional public unresolved rows or replace selected fields with older non-null metadata. Canonical identity remains separate: NASA Andrey and LL2 Andrei are not merged. GET is database-backed, repeatable-read, network-free and write-free; association/backfill occurs outside the read path. See [validation](../crew/source-occurrence-versioning-validation/README.md).


## Canonical identity compatibility — ADR-0013

Members and person details add `canonicalProfile`: canonical/requested IDs, aliases, identity/profile policy markers, availability, profile observation/fetch time, typed NASA profile resources and field authority/provenance. Existing UUID URLs remain HTTP 200; alias requests return canonical `id` and retain the requested alias in metadata. The collection projects assignments and assertions to canonical humans before reconciliation. Latest retained LL2 profile metadata is independent of current assignment membership; nulls/removals and media rights remain authoritative. [Contract and maintenance](../crew/canonical-identity.md), [validation](../crew/canonical-identity-validation/README.md).

## NASA editorial shadow ingestion — 2026-10-10

[Independent editorial retention](../crew/nasa-editorial-roster-validation/README.md) adds no public route/DTO field and does not enter Current member/count/presence selection, UUID detail metadata or Replay. All accepted GETs remain read-only and provider-network-free. Internal diagnostics distinguish editorial roster/count/context/profile health from the existing NASA operational feed.

## Independent active membership shadow — 2026-10-11

The public Current member array remains the accepted legacy retained union. V10's positive-support lifecycle is an internal [shadow projection](../crew/active-membership-shadow-validation/README.md), with no new endpoint or DTO field. RETAINED in shadow does not remove a public member or detail/profile resource. Public canonical UUID aliases, counts, assignment/presence quality and Replay reconstruction retain their existing behavior. Activation requires a separate milestone and contract review.
