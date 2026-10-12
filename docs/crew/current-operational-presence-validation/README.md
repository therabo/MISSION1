# Current membership and operational observation validation

Milestone date: 2026-10-11. Starting main: `de2aec8cda1d44b514e7c21788eb7ffd0bac035d`.
[ADR-0019](../../adr/0019-current-membership-and-dated-operational-observations.md)
records the accepted meaning. Generated logs, captures, source audit and performance
results are outside Git at `/Users/daniel/.codex/exports/mission1-current-operational-presence/`.
Synthetic turnover scenarios are confined to Testcontainers and explicit browser
response fixtures. Canonical processing uses real retained source bytes and one
normal NASA acquisition only.

## Policy and UI

V10 ACTIVE plus V7 public identity means **Current member** for every row/detail.
Operational observations and entry implications are separate dated annotations.
Current observations use seven days (`PT168H`), inclusive at exactly seven days and
expired one instant after. Entry continuity remains fourteen days. Verification
availability/fetch age remains six hours; count evidence remains seventy-two hours.
These are project policies, not NASA physical-continuity guarantees.

The new key starts `crew-freshness-v2:PT6H:PT6H:PT168H:PT336H/count=PT72H` and is
embedded in the V10 key. A policy change appends a new cut outside GET; no old
revision is relabeled. Public Replay explicitly retains the v1 72-hour observation
window and its effective-time selection. V10 is not activated in Replay.

Current rows show name, membership, role and secondary operational evidence. The
detail separates Current membership, structured assignment and operational evidence,
including source link, type-specific explanation, effective/proxy date and precision.
The common notice explains source-supported membership and dated evidence. An
assignment is never physical-presence confirmation. Expired/no evidence does not
make the Current membership treatment uncertain.

## Parser 1.2.0

The exact real RSS fixture is
`backend/src/test/resources/fixtures/crew/nasa/verification/activity-feed.xml.gz`.
Decompressed SHA-256:
`312a35ef56856f9081731b0fb505eff999291d134ee1100778951424a712f54c`.
Its metadata records the URL, UTC capture, status and semantic scope.

Supported activity categories are monitoring/working/conducting/servicing/performing/
transferring/exercising in present progressive, selected completed activity verbs,
and ongoing living/working station clauses. Subjects require a typed agency/crew/role
introduction or a unique same-paragraph surname reference to such an introduction.
Location belongs to the activity predicate: explicit ISS/station/orbital-laboratory
phrasing or verified Destiny, Kibo or Harmony module context. Other named clauses,
quotes/captions, plans, negation, preflight/training, historical/year-dated activity,
biography/roles/lists alone and completed return/departure stories do not qualify.
Unsupported wording is omitted conservatively; the extractor is not general NLP.

Each result is partial `PERSON_CURRENTLY_ABOARD/OBSERVED` source evidence with no
canonical UUID. The complete source paragraph remains the immutable locator while
only the qualifying clause's subjects are emitted. Exact personal links are retained
as locators; a legacy NASA personal route is not normalized into a canonical profile
key. Agency/mission context stays in the exact excerpt; no personal biography or
flight witness is manufactured from a co-mention. V9 threshold, scope and shadow
authority are unchanged.

Supported explicit `At <clock> EDT/EST` activity time is minute-qualified and checked
against the article date/publication. Otherwise event time is null and method metadata
marks `PUBLICATION_TIME_PROXY`. An earlier controller/cargo clock is never applied to
an astronaut's later sentence. Existing 1.0/1.1 transition facts keep their semantic
identities; 1.2 interpretations append and inherit original capture lineage without
healing an old failed acquisition record.

## Real retained processing

The supported command reprocessed ten retained distinct body versions, appending
interpretations 118–127. Source documents 90 and 91 yielded three new assertions:

| Source article | Source subjects | Observation proxy time |
|---|---|---|
| [Oct 5 station activities](https://www.nasa.gov/blogs/spacestation/2026/10/05/expedition-75-welcomes-crew-13-and-preps-for-crew-12-departure/) | Jessica Watkins, Luke Delaney, source spelling Josh Kutryk, Sergey Teteryatnikov | 2026-10-05 17:18:04 UTC |
| [Oct 6 health research](https://www.nasa.gov/blogs/spacestation/2026/10/06/crew-12-ready-to-depart-as-new-residents-begin-advanced-health-research/) | Anil Menon, activity in Destiny | 2026-10-06 17:57:55 UTC |
| [Oct 9 monitoring aboard](https://www.nasa.gov/blogs/spacestation/2026/10/09/cygnus-xl-cargo-spacecraft-departing-station-soon-on-nasa/) | Luke Delaney | 2026-10-09 16:35:40 UTC |

These are six subject occurrences across three assertions, not a complete new roster.
Repeated reprocessing appended zero additional evidence. A real NASA fetch succeeded
as run145 using the same retained body. Reconciliation and V10 materialization ran as
explicit application commands outside GET. Revision13 published seven under v2;
ordinary later materialization can append successor cuts as retained inputs change.
All pre-installation evidence, documents, V10 revisions and identity declarations
were compared and remained unchanged.

## Real Current seven

Capture 2026-10-11 14:05:49 UTC; exact later ages are available in the external result
matrix. All seven have **Current member** as primary state and a structured Expedition
75 assignment. Role comes from the assignment, not the operational report.

| Person | Role | Latest bound public operational type | Proxy time UTC | Secondary status | Public binding |
|---|---|---|---|---|---|
| Pyotr Dubrov | Commander | observed aboard | Oct 2 02:01:55 | No recent operational confirmation | accepted legacy exact-name audit |
| Anna Kikina | Flight Engineer | observed aboard | Oct 2 02:01:55 | No recent operational confirmation | accepted legacy exact-name audit |
| Anil Menon | Flight Engineer | observed aboard | Oct 2 02:01:55 | No recent operational confirmation | retained NASA external profile identity |
| Jessica Watkins | Flight Engineer | completed entry | Oct 2 02:01:55 | Operational entry confirmed | approved V7 correspondence |
| Luke Delaney | Flight Engineer | observed activity aboard | Oct 9 16:35:40 | Operational presence recently observed | approved V7 profile correspondence |
| Joshua Kutryk | Flight Engineer | completed entry | Oct 2 02:01:55 | Operational entry confirmed | accepted legacy exact-name audit |
| Sergey Teteryatnikov | Flight Engineer | completed entry | Oct 2 02:01:55 | Operational entry confirmed | accepted legacy exact-name audit |

Oct2 evidence is approximately 9.5 days old: expired as an observation, still applicable
as a 14-day entry implication. Delaney's activity is approximately 1.9 days old. New
V9 operational source subjects remain DEFER: name/profile locators alone lack qualified
personal corroboration, and Josh/Joshua is not silently name-merged. V7 can attach the
Oct9 Delaney profile-key assertion independently. The Menon new personal URL route
does not acquire a new canonical mapping. Nothing forces seven recent observations.
Public operational annotations continue through the existing V7 reconciliation
binding. A qualified V9 fixture can advance V10's retained presence episode without
promoting its subject into that public operational binding. The real Delaney update
demonstrates the public path through an already approved profile correspondence.
Watkins/Delaney public UUIDs, aliases and profile fields remain unchanged.

## Production-service turnover tests

`CrewTurnoverPostgresTest` uses real source ingestion, immutable persistence, database
job triggers, worker, V10 and MockMvc Current/detail. Qualified fixtures have explicitly
synthetic typed personal evidence supplied by a test adapter; the unchanged model and
durable worker evaluate it. No manual SQL inserts of people/evidence/mappings or manual
rescore are used to drive the lifecycle. Test cleanup uses disposable SQL only.

| Scenario | Source / identity condition | V10 and Current |
|---|---|---|
| Base | seven LL2 provider-owned assignments |7, unique IDs, readable profiles |
| Arrival | four new provider people + qualified arrivals; two source orders |7→11; unresolved NASA-first remains7 until safe support |
| Departure | four qualified completed departures; lagging LL2/editorial data |11→7; later editorial recapture cannot reopen |
| Unresolved departure | name-only operational source; LL2 still positive |11; no guessed human veto |
| Successful support removal | all remaining eligible positives for outgoing people end |11→7, RETAINED without fabricated departure |
| LL2-only omission | linked NASA editorial still supports the person |remains Current |
| Editorial-only omission | LL2 still assigns |remains Current |
| Failure | LL2 timeout; operational NASA HTTP500 or malformed response |last-good eligible Current retained, no omission/departure |
| Editorial failure | LL2 omission followed by editorial HTTP500 or malformed acquisition |sole remaining last-good editorial support preserves Current |
| Reentry | strictly later qualified operational arrival |7→8 for one reentrant |
| New observation | later qualified observation after reentry |dated source episode advances; old assertions retained |
| Observation expiry | three retained successive observations, then >7 days |fresh assignments preserve Current; no artificial departure |
| Known visitor | retained LL2 human, no current assignment, qualified arrival |Current without expedition assignment |
| Unknown visitor | no retained safe provider human |unresolved slot, no fabricated public UUID |
| Restart/order | durable pending imports, new worker, policy transition |converges; old cut unchanged; unchanged cut idempotent |

The fixture driver invokes scheduled service/worker/materializer entry points
deterministically rather than waiting two hours. `CrewLifecycleSchedulerTest` checks
the actual bounded scheduler dispatch and cadence; existing source/order/lease/retry/
restart suites remain active. Zero-touch qualification of every real operational
subject is not claimed: this milestone preserves that documented limitation.

## Browser refresh and isolation

Current polls every 120 seconds after a request completes, visible and active only;
hidden/inactive sessions pause. Visibility resumes with a read; Historical return
explicitly refreshes Current. Rapid close/reopen preserves the recent session response
and its remaining cadence. Manual retry aborts the old request. Late responses cannot
replace newer state. Background reads retain existing rows/detail/scroll, with no
full-page reload or scene/camera transition.

React integration tests and explicit TEST_ONLY browser fixtures exercise7→11→7,
preserved selection on arrival, clearing a departing selection at desktop and phone,
stable roster focus/canvas and last-good error recovery. Normal dev/production QA
uses real APIs and native Cesium at 1440×900,1024×768,768×1024,390×844 and320×568.
Generated captures and zero-unexpected-error reports remain external. HTTP fault
unit tests are separate from browser malformed-DTO recovery, which produces no
console error.

## Performance and invariants

At the measured real seven-person cut,20 Current reads used48 prepared SELECTs each,
all on read-only connections, with median63.5ms and p95~189.8ms under concurrent local
QA load. Source transport, V9 scoring and V10 materialization are absent from GET.
Thirteen actual HTTP reads (one Current, seven profiles, two aliases and three Replay)
returned 200 and left fingerprints of all 67 Crew/Flyway tables unchanged. Alias
responses retain the same Luke/Watkins canonical UUIDs.
An idempotent ten-document reprocessing batch used141 prepared statements, including
41 SELECTs and zero new subject inserts; new source subjects/occurrence metadata use
existing batch writes, not per-person fetches or enrichment queries. Real parser
times were 5.7–15.8ms after an 89.1ms cold first parse. Isolated activity extraction for
the three retained qualifying paragraphs had warmed medians 0.059–0.165ms and
p95 values 0.098–0.307ms across 500 iterations per paragraph, including reflection
overhead but excluding DOM creation, HTTP and persistence. Materialization measured 245.3ms
internally /253.1ms including the proxy transaction. These are local measurements,
not throughput or publisher-latency promises. Frontend steady rate is30 Current
GETs/hour per continuously visible panel, plus explicit/visibility reads.

V1–V10 migrations are unchanged. V7 identity, V9 SHADOW, provider UUID allocation,
typed support union and temporal departure/reentry rules remain authoritative.
Counts never add/subtract humans. Public Replay remains effective-time isolated.
Full test/verify/build/typecheck/diff and browser results are recorded in the external
milestone report. Java 21 `mvn test` and `mvn verify` each pass 1,008 tests with zero
failures, errors or skips (baseline 962). Node 24 passes 786 tests in 65 files
(baseline 770/63), typecheck and production build. Validation results are also
summarized in `results.json`.

## Subsequent S10 investigation layer — 2026-10-11

[S10 Phase 1](../operational-subject-binding-shadow-validation/README.md) qualifies all six retained parser-1.2 activity subjects in an independent shadow repository. Those bindings do not advance production observations, change the accepted seven-day policy, or alter this milestone’s production/Replay/frontend boundary. In particular, the potential Anil Menon Oct 6 advancement remains a reported counterfactual.

## Subsequent final production architecture — 2026-10-12

[ADR-0021](../../adr/0021-production-operational-binding-and-unified-crew-replay.md) and [final validation](../final-crew-architecture-validation/README.md) activate the separately versioned S10 operational consumer and unify Current/Historical V10 lifecycle. V7 remains canonical; V9 general identity remains SHADOW. This dossier and its original immutable rows retain their dated acceptance meaning. Historical now uses seven-day observations relative to T, without backdating captured rosters. The next milestone is dedicated clean-room empty-database bootstrap validation.
