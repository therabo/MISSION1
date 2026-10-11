# Current unresolved identity investigation — before implementation

Baseline `915b0e2baf66002cdccf849ccc468c7a1e1bc5ac`; canonical repository, direct main.
Captured actual HTTP and read-only SQL on 2026-10-11 before editing application code.
Full responses, profiles, schema, immutable rows and 70-table fingerprints are outside Git:
`/Users/daniel/.codex/exports/mission1-current-ui-semantic-cleanup/`.
Source acquisition was disabled after capturing the normal running application's state.
The earlier trial instance had legitimately refreshed sources: LL2 run141/snapshot63,
NASA operational run142, editorial acquisition32, graph18 and projection7. This is a
changed source cut compared to projection3 in the preceding activation dossier.
No time, source capture or identity was modified for this investigation.

## Dataflow, established before implementation

| Display | Database / repository | Domain / application | DTO / frontend | Rendered label |
| --- | --- | --- | --- | --- |
| Reported aboard | `crew_verification_evidence.crew_count`; `JdbcCrewVerificationRepository.publicEvidenceAsOf`; compatible occurrence versions/captures | `CrewReconciliationEngine` chooses operational count; `CrewRestQueryService.crew` checks source health/applicability | `counts.officialAboard` → `decodeCrew` → `CurrentCrewRoster` | Reported aboard / Unavailable |
| Current members | sealed `crew_active_projection_revision/member/support`, `JdbcActiveMembershipReader`; batched V7 profiles | `ProductionCurrentMembership.select` selects ACTIVE; REST builds members | `members.length` (membership metadata cardinality also7) | Current members7 |
| Without confirmed identity | same operational count plus resolved subject/presence claims; **no eleven-row SQL query** | engine `max(0, count - aboard.size())` → `state.unidentifiedCount()` | `counts.unidentifiedAboard` → `decodeCrew` → `CurrentCrewRoster` | Without confirmed identity11 (previous cut),7 (current cut) |
| Last-known operational count | raw evidence plus persisted `crew_reconciliation_snapshot.official_crew_count` | read-time engine preserves historical count | `counts.lastKnownOfficialAboard` | legacy count context |
| Confirmed presence | `crew_evidence_subject`, `crew_identity_resolution`, occurrence versions | applicable canonical operational claims only; CONFIRMED_ABOARD | `counts.resolvedAboard`; member presence | physical confirmation, independent of membership |
| Unresolved source reports | evidence/subject/resolution tuples | `state.unresolved`; default ACTIVE publishes empty collection | `unresolvedSubjects=[]`, `counts.unresolvedSubjects=0` | no report entries |
| Active source slots | `crew_active_projection_slot.state` at sealed revision7 | V10 `counts.unresolvedActiveSlots` | `membership.unresolvedActiveSourceSlots=8` | source details, not people |
| Retained slots | same table, RETAINED_OPERATIONAL_SLOT | V10 `unresolvedRetainedSlots=15` | internal result, no Current people field | no Current headline |
| Editorial count / roster | `crew_editorial_topic_fact.value`, `crew_editorial_roster_member` | typed V10 count context and supports | internal websiteReportedAboard7 / roster slots7 | independent source facts |

## Exact relevant runtime JSON

```json
{
  "counts": {
    "officialAboard": null,
    "lastKnownOfficialAboard": 11,
    "resolvedAboard": 4,
    "unresolvedSubjects": 0,
    "unidentifiedAboard": 7,
    "structuredAssignments": 7
  },
  "unresolvedSubjects": [],
  "membership": {
    "mode": "ACTIVE_PROJECTION",
    "revision": 7,
    "evaluatedAt": "2026-10-11T10:10:24.077526Z",
    "policyVersion": "crew-active-shadow-v1/crew-freshness-v1:PT6H:PT6H:PT72H:PT336H/roster=PT6H/topic=PT6H/personal=PT168H",
    "health": "DEGRADED",
    "ageSeconds": 466,
    "resolvedCurrentMembers": 7,
    "nonPublishableActive": 0,
    "canonicalCollisions": 0,
    "unresolvedActiveSourceSlots": 8
  },
  "reconciliation": {
    "status": "STALE",
    "evaluatedAt": "2026-10-11T10:18:10.803473Z",
    "reconciledAt": "2026-10-11T10:02:26.437336Z",
    "algorithmVersion": "crew-reconciliation-v3/crew-canonical-identity-v1/crew-freshness-v1:PT6H:PT6H:PT72H:PT336H",
    "lastAttemptAt": "2026-10-11T10:02:26.437336Z",
    "lastAttemptCompletedAt": "2026-10-11T10:02:26.485223Z",
    "lastAttemptResult": "SUCCESS"
  },
  "freshness": {
    "evaluatedAt": "2026-10-11T10:18:10.803473Z",
    "structuredSource": {
      "source": "LAUNCH_LIBRARY_2",
      "sourceState": "AVAILABLE",
      "lastAttemptAt": "2026-10-11T09:57:23.895531Z",
      "lastAttemptResult": "SUCCESS",
      "lastSuccessfulFetchAt": "2026-10-11T09:57:25.149984Z",
      "lastFailureAt": "2026-10-10T11:19:11.432674Z",
      "lastRefreshFailed": false,
      "rateLimited": false,
      "retryAfterAt": null,
      "stale": false
    },
    "verification": {
      "source": "NASA_OFFICIAL",
      "sourceState": "AVAILABLE",
      "lastAttemptAt": "2026-10-11T10:02:25.581565Z",
      "lastAttemptResult": "SUCCESS",
      "lastSuccessfulFetchAt": "2026-10-11T10:02:25.937060Z",
      "lastFailureAt": "2026-10-10T19:25:05.015972Z",
      "lastRefreshFailed": false,
      "rateLimited": false,
      "retryAfterAt": null,
      "stale": false
    },
    "stale": true
  },
  "members": [
    {
      "id": "8036ce99-4648-40d8-9aa7-2956ddefaa91",
      "name": "Anna Kikina",
      "presence": "STALE"
    },
    {
      "id": "0aa26f8e-38e0-495d-b9a2-ced538c9e726",
      "name": "Anil Menon",
      "presence": "STALE"
    },
    {
      "id": "6e32c904-e487-40ef-b9fc-089cf33eb216",
      "name": "Pyotr Dubrov",
      "presence": "STALE"
    },
    {
      "id": "6e700f29-14ab-415a-87e4-6567860c1796",
      "name": "Jessica Watkins",
      "presence": "CONFIRMED_ABOARD"
    },
    {
      "id": "09dea926-7480-4fc5-a340-01d44a6e5dae",
      "name": "Luke Delaney",
      "presence": "CONFIRMED_ABOARD"
    },
    {
      "id": "345d3c45-c57a-4bcf-b3d6-ea811ba55416",
      "name": "Joshua Kutryk",
      "presence": "CONFIRMED_ABOARD"
    },
    {
      "id": "3e128b74-27e9-4cd5-acf2-bb76910dbe30",
      "name": "Sergey Teteryatnikov",
      "presence": "CONFIRMED_ABOARD"
    }
  ]
}
```

## Exact root cause of the previous eleven

The recorded production response from the previous activation (projection3) has:

```json
{
  "counts": {
    "officialAboard": null,
    "lastKnownOfficialAboard": 11,
    "resolvedAboard": 0,
    "unresolvedSubjects": 0,
    "unidentifiedAboard": 11,
    "structuredAssignments": 7
  },
  "unresolvedSubjects": [],
  "membership": {
    "mode": "ACTIVE_PROJECTION",
    "revision": 3,
    "evaluatedAt": "2026-10-11T00:17:26.156499Z",
    "policyVersion": "crew-active-shadow-v1/crew-freshness-v1:PT6H:PT6H:PT72H:PT336H/roster=PT6H/topic=PT6H/personal=PT168H",
    "health": "DEGRADED",
    "ageSeconds": 32411,
    "resolvedCurrentMembers": 7,
    "nonPublishableActive": 0,
    "canonicalCollisions": 0,
    "unresolvedActiveSourceSlots": 8
  }
}
```

`CurrentCrewRoster.tsx` rendered `{crew.counts.unidentifiedAboard}` directly under
“Without confirmed identity”. The REST mapper copied `state.unidentifiedCount()`. This is freshly computed by the read-time engine from persisted inputs; it is not a direct read of the stored snapshot unidentified_count column. The stored snapshot is independently loaded for reconciliation diagnostics/history.
`CrewReconciliationEngine` calculates `count == null ? 0 : Math.max(0, count - aboard.size())`.
The one raw count assertion is evidence1/document1, COUNT_ONLY, crew_count11,
published2026-10-02T18:14:13Z, parser1.0.0, source NASA_ISS_OPERATIONAL_POST:
[Station crew expands](https://www.nasa.gov/blogs/spacestation/2026/10/02/station-crew-expands-as-nasas-spacex-crew-12-prepares-to-depart/).
It contains **no named subjects**. Older physical-presence claims had expired, hence11−0=11.
Fresh operational collection made four completed-entry claims applicable again, so11−4=7
at investigation time. Current membership stayed seven in both cases. Fetch health and
assertion applicability remain independent; the count itself is still last-known.

There are **no eleven underlying unidentified objects to enumerate**: eleven is a scalar
reconciliation gap. Inventing eleven records or assigning this gap to named people would
fabricate identity information. Below are every actual source slot, every operational
subject tuple and the eleven retained human anchors, explicitly distinct from that scalar.

A. Eleven is not a count of current unidentified astronauts.
B. It is not a count of unresolved assertions/occurrences (Current array length0).
C. It is a legacy operational count-minus-confirmed-presence diagnostic.
D. It does not sum ACTIVE and RETAINED slots; those independent cardinalities are8/15.
E. Frontend reads the intended legacy scalar, but labels it as unidentified people.
F. The backend exposes a misleading legacy scalar on Current; the empty public unresolved
collection is also obsolete for default ACTIVE Current. Historical's collection stays useful.

## All actual V10 source slots (8 ACTIVE +15 RETAINED)

Internal slot key includes observation occurrence identity; `evidence:index` and
`roster:index` below are its exact relational subject locator. Full key is in
[investigation-state.json](investigation-state.json). Each has human=null in V10.

| Locator / internal observation | Source stream | Document/assertion or roster acquisition | Display name | Scope | V9 / V10 identity state | Active roster slot? |
| --- | --- | --- | --- | --- | --- | --- |
| evidence12:1; observation20 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Jack Hathaway | RETAINED_OPERATIONAL_SLOT | decision9: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:5; observation22 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Anna Kikina | RETAINED_OPERATIONAL_SLOT | decision34: AUTO_DEFER; AUTO_DEFER | No |
| evidence27:3; observation193 | NASA_OPERATIONAL_FEED | document92 / PERSON_DEPARTED_STATION | Andrey Fedyaev | RETAINED_OPERATIONAL_SLOT | decision36: AUTO_DEFER; AUTO_DEFER | No |
| evidence27:1; observation194 | NASA_OPERATIONAL_FEED | document92 / PERSON_DEPARTED_STATION | Jack Hathaway | RETAINED_OPERATIONAL_SLOT | decision37: AUTO_DEFER; AUTO_DEFER | No |
| evidence27:2; observation195 | NASA_OPERATIONAL_FEED | document92 / PERSON_DEPARTED_STATION | Sophie Adenot | RETAINED_OPERATIONAL_SLOT | decision38: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:4; observation24 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Pyotr Dubrov | RETAINED_OPERATIONAL_SLOT | decision39: AUTO_DEFER; AUTO_DEFER | No |
| evidence21:2; observation197 | NASA_OPERATIONAL_FEED | document90 / PERSON_DEPARTED_STATION | Sophie Adenot | RETAINED_OPERATIONAL_SLOT | decision40: AUTO_DEFER; AUTO_DEFER | No |
| evidence21:1; observation198 | NASA_OPERATIONAL_FEED | document90 / PERSON_DEPARTED_STATION | Jack Hathaway | RETAINED_OPERATIONAL_SLOT | decision41: AUTO_DEFER; AUTO_DEFER | No |
| evidence21:3; observation199 | NASA_OPERATIONAL_FEED | document90 / PERSON_DEPARTED_STATION | Andrey Fedyaev | RETAINED_OPERATIONAL_SLOT | decision42: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:2; observation25 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Anil Menon | RETAINED_OPERATIONAL_SLOT | decision43: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:6; observation26 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Andrey Fedyaev | RETAINED_OPERATIONAL_SLOT | decision15: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:3; observation28 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Sophie Adenot | RETAINED_OPERATIONAL_SLOT | decision17: AUTO_DEFER; AUTO_DEFER | No |
| evidence27:0; observation204 | NASA_OPERATIONAL_FEED | document92 / PERSON_DEPARTED_STATION | Jessica Meir | RETAINED_OPERATIONAL_SLOT | decision45: AUTO_DEFER; AUTO_DEFER | No |
| evidence21:0; observation205 | NASA_OPERATIONAL_FEED | document90 / PERSON_DEPARTED_STATION | Jessica Meir | RETAINED_OPERATIONAL_SLOT | decision46: AUTO_DEFER; AUTO_DEFER | No |
| evidence12:0; observation29 | NASA_OPERATIONAL_FEED | document17 / PERSON_CURRENTLY_ABOARD | Jessica Meir | RETAINED_OPERATIONAL_SLOT | decision47: AUTO_DEFER; AUTO_DEFER | No |
| roster1:0; observation224 | NASA_EDITORIAL_EXPEDITION | acquisition32 | Pyotr Dubrov | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision51: AUTO_DEFER; AUTO_DEFER | Yes |
| roster1:2; observation226 | NASA_EDITORIAL_EXPEDITION | acquisition32 | Anna Kikina | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision53: AUTO_DEFER; AUTO_DEFER | Yes |
| roster1:5; observation229 | NASA_EDITORIAL_EXPEDITION | acquisition32 | Joshua Kutryk | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision56: AUTO_DEFER; AUTO_DEFER | Yes |
| roster1:6; observation230 | NASA_EDITORIAL_EXPEDITION | acquisition32 | Sergey Teteryatnikov | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision57: AUTO_DEFER; AUTO_DEFER | Yes |
| evidence2:1; observation19 | NASA_OPERATIONAL_FEED | document1 / PERSON_ENTERED_STATION | Luke Delaney | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision32: AUTO_DEFER; AUTO_DEFER | No |
| evidence2:0; observation21 | NASA_OPERATIONAL_FEED | document1 / PERSON_ENTERED_STATION | Jessica Watkins | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision33: AUTO_DEFER; AUTO_DEFER | No |
| evidence2:2; observation23 | NASA_OPERATIONAL_FEED | document1 / PERSON_ENTERED_STATION | Joshua Kutryk | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision35: AUTO_DEFER; AUTO_DEFER | No |
| evidence2:3; observation27 | NASA_OPERATIONAL_FEED | document1 / PERSON_ENTERED_STATION | Sergey Teteryatnikov | UNRESOLVED_ACTIVE_SOURCE_SLOT | decision44: AUTO_DEFER; AUTO_DEFER | No |

The four ACTIVE editorial slots and four ACTIVE operational subjects are source subjects,
not additional humans. All already have source names that may overlap resolved Current
profiles; the typed graph has not qualified those slot-to-human associations. Repetition
across streams/occurrences is visible; no name grouping is used to compute a human count.
Retained evidence12 has seven positive mentions; evidence21 and27 each have four completed
departure mentions. Same display names recur across these tuples; that does not itself
establish canonical equivalence. Actual typed V9 decisions remain authoritative in shadow.

## All operational source subject rows

These26 persisted tuples are not eleven unknown people. Compatible occurrence selection
uses evidence1,2,3,12,21,27 at projection7; older evidence6 is retained version history.
Production V7 resolutions are separate from V9 decisions in the preceding table.

| Internal evidence:index | Document | Assertion | Source name | Production resolution | Person UUID / retained evidence status |
| --- | --- | --- | --- | --- | --- |
| 2:0 | 1 | PERSON_ENTERED_STATION (COMPLETED) | Jessica Watkins | 21: AUTHORITATIVE_MAPPING | 6e700f29-14ab-415a-87e4-6567860c1796; immutable source history |
| 2:1 | 1 | PERSON_ENTERED_STATION (COMPLETED) | Luke Delaney | 22: AUTHORITATIVE_MAPPING | 09dea926-7480-4fc5-a340-01d44a6e5dae; immutable source history |
| 2:2 | 1 | PERSON_ENTERED_STATION (COMPLETED) | Joshua Kutryk | 19: EXACT_UNIQUE_NAME | 345d3c45-c57a-4bcf-b3d6-ea811ba55416; immutable source history |
| 2:3 | 1 | PERSON_ENTERED_STATION (COMPLETED) | Sergey Teteryatnikov | 20: EXACT_UNIQUE_NAME | 3e128b74-27e9-4cd5-acf2-bb76910dbe30; immutable source history |
| 4:0 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Jessica Meir | 5: EXACT_UNIQUE_NAME | 4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2; immutable source history |
| 4:1 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Jack Hathaway | 6: EXACT_UNIQUE_NAME | 2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed; immutable source history |
| 4:2 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Anil Menon | 7: EXACT_UNIQUE_NAME | 0aa26f8e-38e0-495d-b9a2-ced538c9e726; immutable source history |
| 4:3 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Sophie Adenot | 8: EXACT_UNIQUE_NAME | 9735513f-4ad9-44ba-863d-4f05978fca61; immutable source history |
| 4:4 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Pyotr Dubrov | 9: EXACT_UNIQUE_NAME | 6e32c904-e487-40ef-b9fc-089cf33eb216; immutable source history |
| 4:5 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Anna Kikina | 10: EXACT_UNIQUE_NAME | 8036ce99-4648-40d8-9aa7-2956ddefaa91; immutable source history |
| 4:6 | 1 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Andrey Fedyaev | 11: UNRESOLVED | No production identity; immutable source history |
| 12:0 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Jessica Meir | 12: EXACT_UNIQUE_NAME | 4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2; immutable source history |
| 12:1 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Jack Hathaway | 13: EXTERNAL_ID | 2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed; immutable source history |
| 12:2 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Anil Menon | 14: EXTERNAL_ID | 0aa26f8e-38e0-495d-b9a2-ced538c9e726; immutable source history |
| 12:3 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Sophie Adenot | 15: EXACT_UNIQUE_NAME | 9735513f-4ad9-44ba-863d-4f05978fca61; immutable source history |
| 12:4 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Pyotr Dubrov | 16: EXACT_UNIQUE_NAME | 6e32c904-e487-40ef-b9fc-089cf33eb216; immutable source history |
| 12:5 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Anna Kikina | 17: EXACT_UNIQUE_NAME | 8036ce99-4648-40d8-9aa7-2956ddefaa91; immutable source history |
| 12:6 | 17 | PERSON_CURRENTLY_ABOARD (OBSERVED) | Andrey Fedyaev | 18: UNRESOLVED | No production identity; immutable source history |
| 21:0 | 90 | PERSON_DEPARTED_STATION (COMPLETED) | Jessica Meir | None: None | No production identity; immutable source history |
| 21:1 | 90 | PERSON_DEPARTED_STATION (COMPLETED) | Jack Hathaway | None: None | No production identity; immutable source history |
| 21:2 | 90 | PERSON_DEPARTED_STATION (COMPLETED) | Sophie Adenot | None: None | No production identity; immutable source history |
| 21:3 | 90 | PERSON_DEPARTED_STATION (COMPLETED) | Andrey Fedyaev | None: None | No production identity; immutable source history |
| 27:0 | 92 | PERSON_DEPARTED_STATION (COMPLETED) | Jessica Meir | None: None | No production identity; immutable source history |
| 27:1 | 92 | PERSON_DEPARTED_STATION (COMPLETED) | Jack Hathaway | None: None | No production identity; immutable source history |
| 27:2 | 92 | PERSON_DEPARTED_STATION (COMPLETED) | Sophie Adenot | None: None | No production identity; immutable source history |
| 27:3 | 92 | PERSON_DEPARTED_STATION (COMPLETED) | Andrey Fedyaev | None: None | No production identity; immutable source history |

## Eleven retained human anchors (not the unidentified-count gap)

| UUID | Name | V10 membership | Source |
| --- | --- | --- | --- |
| 8036ce99-4648-40d8-9aa7-2956ddefaa91 | Anna Kikina | ACTIVE | LL2 profile; V7 canonical knowledge |
| 0aa26f8e-38e0-495d-b9a2-ced538c9e726 | Anil Menon | ACTIVE | LL2 profile; V7 canonical knowledge |
| 6e32c904-e487-40ef-b9fc-089cf33eb216 | Pyotr Dubrov | ACTIVE | LL2 profile; V7 canonical knowledge |
| 6e700f29-14ab-415a-87e4-6567860c1796 | Jessica Watkins | ACTIVE | LL2 profile; V7 canonical knowledge |
| 09dea926-7480-4fc5-a340-01d44a6e5dae | Luke Delaney | ACTIVE | LL2 profile; V7 canonical knowledge |
| 345d3c45-c57a-4bcf-b3d6-ea811ba55416 | Joshua Kutryk | ACTIVE | LL2 profile; V7 canonical knowledge |
| 3e128b74-27e9-4cd5-acf2-bb76910dbe30 | Sergey Teteryatnikov | ACTIVE | LL2 profile; V7 canonical knowledge |
| 4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2 | Jessica Meir | RETAINED | LL2 profile; V7 canonical knowledge |
| 2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed | Jack Hathaway | RETAINED | LL2 profile; V7 canonical knowledge |
| 9735513f-4ad9-44ba-863d-4f05978fca61 | Sophie Adenot | RETAINED | LL2 profile; V7 canonical knowledge |
| e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5 | Andrei Fedyaev | RETAINED | LL2 profile; V7 canonical knowledge |

## Selected correction

Remove both Reported aboard and Without confirmed identity from every Current summary.
Publish a purpose-specific Current count DTO with only independently useful confirmed
presence and structured assignments; remove Current official/last-known/gap/report counts
and the obsolete Current unresolvedSubjects collection. Historical/Replay retains its
existing DTO, counts, reports and UI unchanged. Keep8 unresolved ACTIVE source slots only
inside Data sources & freshness, explicitly source slots that may repeat resolved people.
Do not surface15 retained slots as Current crew. No name-based grouping or forced identity.

## Fedyaev

LL2 Andrei UUIDe0ead20d-bbb0-4a6e-8da8-bf6b857a68b5 is RETAINED, detail addressable.
NASA Andrey evidence12:6 is RETAINED_OPERATIONAL_SLOT/AUTO_DEFER. Departure tuples21:3
and27:3 are RETAINED_OPERATIONAL_SLOT/AUTO_DEFER (decisions42 and36). They contribute zero to8
ACTIVE source slots and zero Current cards. They cannot be assigned one unit of the legacy
eleven scalar. No transliteration merge or presentation deduplication is introduced.

## Reproduction

1. Start the baseline jar with all source/V9/V10 workers and identity/backfill writes OFF.
2. `curl http://127.0.0.1:8080/api/iss/crew` and compare counts/member IDs/revision above.
3. SELECT count evidence, subject tuples and latest sealed slot state using
   [investigation.sql](investigation.sql), in a read-only transaction.
4. To inspect original eleven use the preserved activation response, not fake clock/data.
5. Compare engine arithmetic, REST mapper, decoder and roster expressions listed above.

At the preceding activation cut (graph8), departure subjects had NO_AUTOMATIC_DECISION.
The normal trial worker evaluated them before this cleanup (graph18): the actual
captured departure slots now have AUTO_DEFER. This task neither evaluates nor changes
those decisions; all source/graph/decision fingerprints remain frozen from investigation onward.
