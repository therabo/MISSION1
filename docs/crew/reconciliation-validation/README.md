# NASA Crew verification and reconciliation — acceptance dossier

Validated 2026-10-03 UTC against clean synchronized baseline `c2ada2b1ae76b3d49090ffb9b050ba679d0b2d44`. Repository `/Users/daniel/Desktop/MISSION1`; original context `/Users/daniel/Desktop/mission1-project.md` remains outside Git. No public Crew REST or frontend was implemented. Next single milestone: **ISS CREW REST API**.

## Context reviewed and scope

Project AGENTS in Documents/MISSION1, original external context (including the latest accepted source/domain and ingestion sections), project skills and their supporting references; all Crew documents/source validation/ingestion dossier, architecture03/05, draft API, ADR0007/0008/index and backend README. Existing Crew domain/ports, NASA capture/verification ports, LL2 HTTP/DTO/source, repository/JDBC/V3, ingestion/policy/query, Spring configuration/scheduler and tests were inspected. Skills applied: iss-public-data-sources, mission-data-pipeline, iss-ground-segment-architecture, telemetry-quality-and-provenance, software-architect, devops-local-platform, architecture-decisions, realtime-api-contracts and flight-dynamics-orekit for frozen boundaries. No subagents were used. Earlier historical external-context portions were inspected with bounded reads; the complete long historical file is not claimed to have been reread line by line.

CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss. Planned event != completed event. Partial omission != departure.

## Official source discovery and boundaries

[Source discovery metadata](source-discovery.json) records bounded official captures. At 10:40:50–10:40:53 UTC, the official [Space Station blog](https://www.nasa.gov/blogs/spacestation/) advertised its [RSS](https://www.nasa.gov/blogs/spacestation/feed/); RSS returned 200, `application/rss+xml; charset=UTF-8`, ten full-content items, stable GUID/link, RFC1123 item pubDate, ETag `"9c2bd54a32996414d5cbdaff669bdf19"` and Last-Modified `Sat, 03 Oct 2026 04:05:00 GMT`. Container lastBuildDate is feed metadata, not the event time of every assertion.

The feed is the only runtime NASA source, type NASA_ISS_OPERATIONAL_FEED. Individual evidence is NASA_ISS_OPERATIONAL_POST, with article links discovered from RSS. It provides named positive partial-presence and completed-entry assertions plus separate count/hatch evidence. It is not an exhaustive current roster or guaranteed complete event log. Current expedition remains the existing dynamic LL2 active-expedition query; NASA expedition phrases are contextual source text. No current expedition or dated article constant exists in production code.

The station overview, its actual linked expedition directory and a dated mission page were investigated; mixed editorial sections/date-only updates did not qualify them as exhaustive/time-safe runtime rosters. The officially exposed WordPress route root was research only. A guessed expeditions URL returned 404 once, without retry. No visiting-vehicle source is used as individual occupancy authority. Direct research made nine bounded NASA requests (blog, RSS, guessed404, WP routes, overview, mission page, linked directory, two profile pages); browser/search research was read-only discovery, never runtime behavior. No archived HTML research pages are committed. Runtime uses official NASA only: no unofficial mirror, search engine, LLM/NLP or fuzzy model.

[Official profile validation](official-profile-validation.json), 11:17:46–11:17:47 UTC: Watkins and Delaney /people/ URLs returned HTTP200, original URL unchanged, single-person page titles, recorded SHA-256. Runtime trusts a validated subject-naming NASA paragraph link/profile structure and makes no per-person profile requests. NASA Safe Links are decoded locally and restricted to official /people/ targets.

## Parser and fixture evidence

NasaOperationalFeedParser/1.0.0 validates secure XML/channel/title/GUID/official link/pubDate/full content. NasaOperationalPostParser/1.0.0 parses DOM paragraphs with explicit agency/person and entry/current/departure/count anchors. Both parser versions are preserved; a post-grammar change must also bump the feed version so unchanged documents are reprocessed under a new key. Additional markup is ignored; missing mandatory metadata or a recognized transition without its person anchor is MALFORMED_RESPONSE, never empty successful verification.

Original recorded test fixture: `backend/src/test/resources/fixtures/crew/nasa/verification/operational-feed.xml.gz`, gzip-compressed with 53,621 byte-exact decoded source bytes, SHA-256 `12257a99814dba2d2336ca0a51533ae10a94f9e651d825e8dfa6f6b0cffeeb0e`, retrieval10:40:51.042658 UTC. Its adjacent manifest labels RECORDED_OFFICIAL_SOURCE_TEST_ONLY and parser1.0.0. Mutations and all identity/status/temporal scenarios are synthetic tests. The raw NASA response contains whitespace-only lines; gzip preserves exact decoded bytes and the asserted original SHA-256 without changing source content to satisfy source-code whitespace checks. None is a runtime fallback.

Live output: four immutable assertions: PERSON_ENTERED_STATION (four subjects, PARTIAL, COMPLETED), PERSON_CURRENTLY_ABOARD (seven, PARTIAL, OBSERVED), CREW_COUNT_ABOARD (eleven, COUNT_ONLY), HATCH_OPENED (EVENT_ONLY, COMPLETED). The clock wording is retained; individual entry time and hatch absolute time remain null in this RSS parser when independently explicit dates are absent. Publication is the weaker time context. Planned command transfer/departure produces no completed evidence.

Named explicit departure grammar has synthetic positive tests. The authoritative [completed Crew-11 undocking](https://www.nasa.gov/blogs/spacestation/2026/01/14/dragon-undocks-from-station-heads-for-splashdown/) was also inspected as a counterexample: mission-only undocking cannot safely establish named individual departures, so that semantic shape fails closed. It does not infer people from Crew-N. Wider editorial grammar requires source revalidation and a versioned parser change.

## Actual live validation and comparison

Isolated integration source traffic: **two requests only**, both to the official feed, zero article/profile/LL2 requests or retries. The subsequent normal runtime first tick made one additional NASA GET after its configured ten-minute delay, outside this isolated probe; [runtime evidence](runtime-scheduler-smoke.json) records success and derived state. Source run2 started **2026-10-03T11:24:52.975840Z**, completed11:24:53.422080Z, HTTP200; run3 started11:24:53.671787Z, completed11:24:53.707489Z, conditionalHTTP304. ETag and Last-Modified from the first capture were sent by the actual adapter. Body/hash/document/evidence counts remained unchanged after304.

[Live report](live-reconciliation.json) includes both durable sync runs, document observation, parsed assertions, UUIDs, exact source snapshot, evidence/identity lineage, source health and counts. Initial export had an Optional serialization error after both requests completed. The probe now registers Jdk8Module; export was recovered using --report-only, zero requests and zero writes. One earlier boot had loaded test properties before production properties and exited before source acquisition; no extra source request occurred. Final read-only interpretation at **2026-10-03T11:52:29.179076Z** uses the final compiled implementation.

| Dated comparison | Observed result |
| --- | --- |
| LL2 input | snapshot1/run1, Expedition75/external168, fetched2026-10-03T10:03:14.437689Z, source hash7d391ce4dd63dbc5dbf94cafa8cd82b96be50da74dc82ff4ddd11932f3573f91 |
| Structured assignments | 7 |
| NASA document | id1, source run2 (200) and3 (304); hash12257a99814dba2d2336ca0a51533ae10a94f9e651d825e8dfa6f6b0cffeeb0e |
| Article evidence | arrival/already-aboard pub2026-10-02T02:01:55Z; separate count pub2026-10-02T18:14:13Z |
| Official count | 11, separate from identified list |
| Shared resolved identities | 6: Jessica Meir, Jack Hathaway, Anil Menon, Sophie Adenot, Pyotr Dubrov, Anna Kikina |
| LL2-only | Andrei Fedyaev (UNVERIFIED, not a negative NASA assertion) |
| NASA-only resolved | Jessica Watkins, Luke Delaney; no LL2 profile or assignment fabricated |
| Unresolved NASA subjects | Joshua Kutryk, Sergey Teteryatnikov, Andrey Fedyaev |
| Identity methods | external ID0; official profile2; exact unique6; unresolved3; ambiguous0 |
| Count gap | 3 unidentified; no three invented people or guessed spelling merge |
| Final status | PARTIAL_MATCH |
| Reconciliation | runs1 and2 SUCCESS, snapshot1 reused; presence/count inputs evidence1/2/4, resolution11 audits, document1. Hatch evidence3 is retained source history but does not affect occupancy. |

NASA article publication predates LL2 retrieval, live coverage is partial and three subjects are unresolved. These inputs do not establish NASA_AHEAD or exhaustive MATCH. Counts/names are dated observations, never permanent fixtures of current reality. Retained source success and independent quality remain explicit.

## PostgreSQL lineage, counts and migration

V4__crew_nasa_verification_and_reconciliation.sql adds twelve Crew tables (21 total with V3), restrictive FKs, source-specific successful-input checks, semantic/content/state uniqueness, URL/time/resolution/latest indexes and immutable graph update/delete rejection. It reuses crew_source_sync_run and stable UUID/external-ID anchors; source and derived graphs remain separate. Both empty migrations and upgrade from actual V3 with Crew/orbital sentinels pass. V1/V2/V3 checksums stay unchanged. Local main database also migrated V3→V4 successfully with its prior LL2 snapshot preserved.

| Validation database rows | Count |
| --- | --- |
| crew_source_sync_run | 3 (one retained LL2, two NASA) |
| crew_source_snapshot | 1 |
| crew_person / crew_person_external_id | 9 / 12 |
| crew_document_body / crew_source_document | 1 / 1 |
| crew_verification_evidence / crew_evidence_subject | 4 / 11 |
| crew_identity_resolution | 11 |
| crew_reconciliation_run / crew_reconciliation_snapshot | 2 / 1 |

Exact bodies use deduplicated BYTEA/TOAST, accepted max2MiB. Document key is URL/hash/parser; semantic evidence key is the assertion, not container retrieval/hash. Changed feeds retain body/doc associations while unchanged assertions reuse evidence. Resolution decisions carry subject/candidates/key/version; immutable prior audits survive later resolution. Runs accumulate, identical interpretation deduplicates; changed policy version yields another snapshot. The snapshot preserves first computation/input context, while the canonical query exposes latest source and reconciliation operations separately. No retention deletion or cascade was added.

## Temporal, status, count and failure validation

24 pure engine tests cover MATCH (only exhaustive resolved comparable sets), NASA_AHEAD (explicit new completed entries after LL2 retrieval), constrained LL2_AHEAD (new validFrom after exhaustive NASA roster), PARTIAL_MATCH, VERIFICATION_UNAVAILABLE, PRIMARY_UNAVAILABLE, STALE and AMBIGUOUS. Recorded live state is partial. Source failure retains profile/evidence history but current presence loses fresh verification; stale read-time evaluation cannot relabel historical state as current.

Temporal gates cover completed arrival/departure, planned/future inertness, event-type-without-COMPLETED rejection, late old arrival, reversed insertion order, roster followed by event, partial omission and fully resolved exhaustive negative omission after prior presence. PostgreSQL additionally persists departure then late older arrival then future plan and proves no rewind, preserving all four documents/seven typed assertions. Count-only equality cannot create MATCH. A count larger than resolved people exposes unidentifiedCount, a count smaller than confirmed people yields AMBIGUOUS, and later completed transitions invalidate an older count even for an unresolved subject. Superseded expired count does not taint newer valid evidence.

HTTP tests cover200/304,404/429/500/503, timeout/network and actual-status preservation with zero retry. XML/official link/required metadata/person grammar/semantic anchor failures are explicit. PostgreSQL tests cover unchanged/change captures,304validators, raw failed parse retention, immutable subjects/identity/derived graph, same/versioned dedupe, document/evidence and derived transaction rollback, durable eligibility/429, ambiguous identities, source failure, read-only query, overlap and temporal ordering. Persistence failure keeps the prior graph and records failure where the database remains available. Total outages/crash can leave IN_PROGRESS, deliberately observable until a future ownership/liveness recovery policy.

## Scheduling, query and budget

NASA enabled by default, fixedPT2H/minPT1H, initialPT10M/minPT6M; LL2 PT2H/PT5M defaults unchanged. Conditional GET uses previously parsed same-version document validators. Actual-attempt eligibility/Retry-After survive restart, no immediate retry or startup fetch, and process-local AtomicBoolean prevents overlap. Root schedulers reconcile persisted inputs after actual attempts without other-provider network coupling; skips produce no derived run. Manual internal callers ingest then reconcile explicitly.

Bootstrap is at most ten current feed items within fourteen days, no full historical crawl or publication-watermark-only shortcut. Poll changed content to catch edits. Raw immutable history and stale last-known facts remain queryable. The canonical query evaluates effective freshness read-only and exposes structured current expedition/profile data, source health, last parse failure, last derived attempt, unresolved subjects, current presence/count/status and input provenance. No controller exists.

Measured first NASA ingestion operational span446.240ms (network+parse/storage), conditional span35.702ms; first reconciliation persisted span92.157ms, unchanged second23.580ms. Offline parse of retained live bytes **96.590ms**; current canonical query **133.128ms**, measured at export. SQL statement count was not instrumented. Source requests have no per-person fanout; source subjects/identity candidates/derived reads use batch queries. New/changed identity audits have bounded per-subject writes/readback; unchanged decisions are reused. Current evidence reads span retained assertions and grow with history; a future indexed projection/retention policy is needed if this becomes material, rather than claiming constant database cost.

## Acceptance and frozen regressions

| Gate | Result |
| --- | --- |
| Maven test / verify, Corretto21.0.3 | 225 tests, 0 failure/error/skip; 156 accepted +69 new |
| Crew real PostgreSQL16.10 Testcontainers | 42 tests:24 retained LL2 +18 NASA/derived; no H2 |
| Frontend | 171 tests /26 files; typecheck/build pass, existing large-chunk warning |
| Backend startup | Packaged final jar, PID82475, port8080; Flyway4 and PostgreSQL healthy |
| Startup source isolation | Before configured delay, one retained LL2 run, zero new NASA runs; both scheduling defaults enabled. First NASA tick at11:45:45 UTC then succeeded, reconciliation SUCCESS; LL2 tick skipped as not yet due |
| Orbital API smoke | state/samples/comparison HTTP200 at2026-10-03T12:06:20.357001+00:00; [record](orbital-api-smoke.json) |
| Browser dev5175/prod4175 | Four GP/OEM Inspection/Back cycles, real source responses, no interception/clock override; console0/page errors0/request failures0; served bundle equals build |
| Frozen-byte audit | 144 files unchanged:92 frontend/52 backend;35 additional retained Crew runtime files unchanged; [record](frozen-baseline-audit.json) |
| Diff check / complete scope review | Passed before commit; no unrelated production or credentials introduced |

CelesTrak, Orekit, GP/TLE, NASA OEM, V1/V2 orbital persistence, orbital REST, trajectory, camera/Inspection, station model/assets/textures/rendering remain byte-identical to the accepted baseline. The only existing orbital test edit updates the expected total Flyway version from3→4. No architecture dependency from Crew to Orbit or reverse was added. [Browser record](browser-smoke.json), [GP Earth](production-PRIMARY_GP_TLE-earth.jpg), [OEM Earth](production-NASA_OEM-earth.jpg), [GP Inspection](production-PRIMARY_GP_TLE-inspection.jpg), [OEM Inspection](production-NASA_OEM-inspection.jpg); development evidence is adjacent. Screenshots were visually inspected for rendered Earth/model, source labels and Inspection, without product changes.

## Documentation and architecture decision

Created NASA authoritative design, this dossier plus bounded metadata/JSON/screenshots, and ADR0009 **Reconcile Crew through field-aware source authority**. Updated Crew README, domain contract, source authority, source validation (historical captures preserved), persistence/ingestion, validation/regression, architecture03/05, draft API, backend README and ADR index. Original external project context is updated separately and remains outside Git. ADR0007/0008 remain accepted;0009 explains independent source/evidence/identity/derived lineage and bounded official extraction in the existing process/database. REST API, Earth View Crew UI, event-aware refresh and Replay remain future; independent RTN work remains pending.

The final internal query includes exact typed evidence/identity audits and NASA-only names/profile links. It reads structured LL2 inputs by the interpretation’s snapshot/run references rather than another latest lookup, preserving coherence if ingestion completes concurrently. The PostgreSQL test uses the same deterministic Clock for ingestion, reconciliation and canonical query.

Post-push metadata review found and corrected persistence failures incorrectly labelled as malformed NASA responses. Real PostgreSQL document/subject rollback tests now assert the parsed AVAILABLE source state alongside PERSISTENCE_FAILURE/error code. The actual parse state is retained independently, and the current interpretation still degrades because ingestion failed. The correction is a normal additional commit; the feature commit is retained without amendment.
