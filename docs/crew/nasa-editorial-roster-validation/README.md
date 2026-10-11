# NASA editorial Expedition roster — immutable shadow source

Accepted baseline: `b0b7eb4d95fb8151c5dfefb6fbb76cead1c20c67`, main. Validation date: 2026-10-10. Implementation follows [ADR-0014](../../adr/0014-nasa-editorial-roster-shadow-observations.md). Full raw investigation artifacts remain outside Git under `/Users/daniel/.codex/exports/mission1-nasa-expedition-source-investigation/`; new local audit/log outputs are under `/Users/daniel/.codex/exports/mission1-nasa-editorial-roster-validation/`.

## Authority and rollout boundary

This is an independent **shadow acquisition stream**. Public Crew GETs, Current member selection/counts/presence, UUID detail routes, reviewed V7 identities, Replay and frontend code remain unchanged. There is no public editorial endpoint, profile crawler, probabilistic resolver, automatic match/split/defer decision or reconciliation trigger.

LL2 remains primary for structured Expedition, assignments and station roles. NASA operational assertions remain primary for named physical presence, completed arrival/departure and operational official count. NASA topic Expedition/count are secondary editorial context; mission membership/roles are secondary editorial observations. Personal resources supply about-person evidence only. An editorial roster never establishes physical presence; omission never means completed departure. Website count is not onboard telemetry and never populates `officialAboard`.

CMS publication/modification are resource metadata, never crew-event times. Future editorial Replay must select successful capture≤T; publication, modified time and Expedition start cannot backdate membership. This milestone does not consume editorial data in Replay. Historical mission pages captured today are parser fixtures, not recovered website observations at a past T.

## Discovery and acquisition

1. Bootstrap from the configured [canonical research-news page](https://www.nasa.gov/international-space-station/space-station-research-and-technology/latest-news-from-space-station-research/). Validate HTTPS/www.nasa.gov, exact canonical link, visible `Station Research News` identity and one advertised typed `/wp-json/wp/v2/topic/{id}` resource. The REST title is independently `Latest News from Space Station Research`. This distinction was verified live; neither a generic ISS slug nor a fixed numeric ID is the bootstrap.
2. Parse topic `Expedition` and `Crew Members Aboard` independently in minimal heading/container scopes. Missing, malformed, conflicting duplicate or out-of-range fields have null values and attributed errors. Expedition bounds1–999 and count0–100 are parser/project validation limits, not ISS occupancy claims. Preserve text/locator; a bad count does not block a valid Expedition.
3. Discover/cache Active and ISS taxonomy using exact type, slug and name. IDs10828/11040 were observed, not embedded in production selection. Empty, ambiguous or incompatible terms block a new roster. Cache expiry revalidates the lookup; stale/incompatible terms cannot silently select another mission.
4. Perform a bounded Active/ISS `search=Expedition` probe. Validate observed numeric Expeditions and reject another qualifying active numbered mission. Broad collection-total mismatch records `DISCOVERY_COVERAGE_UNKNOWN`; it does not assert exhaustive uniqueness. Unrelated Active mission content is not a numeric Expedition candidate.
5. Query exact `mission?slug=expedition-{N}&mission-status={active}&mission-target={iss}&per_page=100`. Require exactly one record and compatible exact collection headers, published mission type, exact title/slug/number, Active/ISS membership and exact NASA mission canonical URL. Empty/multiple/type/title/status/target conflicts fail closed. No first/newest/highest-ID fallback exists.
6. Parse both named roster sections, retain the immutable interpretation and capture, then perform bounded explicit personal-link acquisition. Profile failures cannot invalidate the mission roster. The writer uses its own captured slots even if another explicit writer has completed a newer capture.

Full GET is used when no usable HTTP validator exists. Real validators are sent when retained;304 requires the same resource/parser's compatible successful body. Capture stores requested/final URLs, every checked redirect, headers/status, UTC start/completion, raw SHA256 and typed resource metadata. HTTP bodies are cancelled before buffering beyond2MiB; complete-body subscription and request timeout bound the exchange. Rejected oversized bodies cannot be retained as complete raw documents.

## Parser and source disagreements

Semantic headings/DOM scope own extraction, not CSS classes. Supported forms are `Crew Members` or `Crew` heading with `<br>` line groups, and current `At the Station` cards plus a separate line list. Names must be nonempty, unique under safe NFC/case/whitespace retrieval normalization, and roster size1–30. Unsupported/empty lines, duplicate names with different links, ambiguous sections or different section member sets fail closed. Unknown card labeling cannot silently fall back to the line list.

Each member preserves line and card mentions, section locators, exact visible name/role/agency prose, image URL/alt and source links. Source bytes remain the exact-text archive; DOM-visible text is whitespace/NFC normalized for safe comparison. Generic press-release anchors and social SVGs never become personal profiles or portraits. Captions explicitly naming the member and a Crew-N flight are `PERSONAL_FLIGHT_CAPTION`; other role/photo prose is `GENERIC_ROLE_TEXT`. Images/faces never prove identity and no portrait policy changes.

Current captured source disagreements:

- Pyotr Dubrov: card Flight Engineer versus line Commander; the line agrees with LL2 Commander.
- Joshua Kutryk: card NASA versus personally scoped caption CSA and LL2 CSA.

All source fields survive; no card value overwrites LL2. Agency comparison accepts a claim present in the retained LL2 agency name/abbreviation, so Roscosmos versus LL2's RFSA label does not manufacture a disagreement.

## Typed personal-resource relations

Persist `OBSERVED_LINK`, `VERIFIED_ABOUT_PERSON_RELATION` and `REJECTED_MISMATCH` separately. Only explicit source-provided NASA personal topic/people paths are acquired; no per-member name search or general site crawl occurs. Validate type, publication status, origin, canonical/final URL, advertised ID and target title compatibility with the source subject. Follow a labeled Biography link and validate the people target independently. Biography locators retain the parent topic/acquisition scope; redirects remain HTTP provenance.

Observed live paths:

| Member | Personal topic | People resource |
| --- | --- | --- |
| Anil Menon |620006|40775|
| Jessica Watkins |255064|88101|
| Luke Delaney |619970|129838|

Watkins's Biography URL has two official redirects to the canonical people page. These are typed CMS resources, never universal personnel IDs. Equal titles do not create same-human bindings and different IDs do not prove different humans. The real Expedition74 Sophie Adenot link to Hathaway is covered by source fixtures/target validation; that wrong relationship is rejected as identity evidence. No historical roster was ingested into the local production database.

## Schema, versioning and integrity

[V8](../../../backend/src/main/resources/db/migration/V8__crew_nasa_editorial_shadow.sql) is additive; V1–V7 are byte-for-byte unchanged. Existing body/document retention is reused; legacy sync runs, V6 NASA-blog article keys, evidence/resolutions and V7 decision tables are not editorial write targets.

| Table | Responsibility |
| --- | --- |
| `crew_editorial_resource` | Typed kind+WordPress ID identity; separate topic/mission/people/status/target namespaces. |
| `crew_editorial_roster_version` | Mission-owned semantic hash, Expedition number, parser/version, editorial completeness and conflicts. |
| `crew_editorial_roster_member` | Source slot kind, stable index within version, name/role/agency, separate mention payloads/conflicts and member hash; no person UUID. |
| `crew_editorial_acquisition` | Independent stream/resource attempt and health, document/resource metadata, UTC capture, HTTP provenance and optional successful roster lineage. |
| `crew_editorial_topic_fact` | Independent typed Expedition and NASA website editorial reported aboard count, unit/text/locator/hash/version. |
| `crew_editorial_fact_capture` | Fact-to-acquisition lineage, including unchanged revalidation. |
| `crew_editorial_resource_relation` | Slot-owned observed/verified/rejected resource relation, target acquisition and source locator. |
| `crew_nasa_request_budget` | Mutable shared NASA pacing/cooldown only. |
| `crew_editorial_refresh_lease` | Mutable durable scheduled eligibility only. |

Semantic/history tables reject UPDATE/DELETE. Restrictive FKs, typed composite ownership, unique semantic version identities, unique slot order/name, integer/string bounds and insert-lineage checks prevent namespace collision, wrong parent/subject/document/resource association and accidental cascading deletion. JSONB is limited to bounded mention/HTTP/conflict metadata; version/member/fact/resource/lineage/query identity remains relational.

Identical bodies deduplicate generic documents, semantic-equivalent HTML noise/modification metadata reuse roster meaning, and each acquisition remains appended. A→B→A reuses semantic A but selects its newer successful acquisition; failed captures do not create empty successful rosters. Latest selection orders successful capture time/lineage, never WordPress modified time or original version ID. Parser name/version constrain compatible reads and cache reuse.

## Health, cadence and security

`NASA_EDITORIAL_TOPIC`, `NASA_EDITORIAL_EXPEDITION` and `NASA_PERSON_RESOURCE` have resource-scoped outcomes, reasons, last attempts, last-good captures and retry eligibility. The internal health report includes the unchanged operational-feed status through its separate legacy port. Editorial success never heals operational RSS failure; profile404 never fails roster; count parsing failure degrades only that fact. A blocked mission attempt is retained independently while the last-good roster remains queryable. Outage never implies departure.

Project policy: topic/exact mission about2h, canonical/bounded discovery6h, validated taxonomy/stable personal paths7d, negative profile404 cache6h. Other failures back off15m;429 honors bounded seconds or HTTP-date Retry-After, with15m fallback and a seven-day cap. No synchronous retry. Shared durable NASA request reservations pace operational and editorial clients at one request/second, with at most two in-process requests. This is MISSION1 policy, not a claimed NASA quota. Durable2h scheduler eligibility survives process restart; initial15m delay prevents immediate startup acquisition. Event-window acceleration remains deferred.

Only exact www.nasa.gov HTTPS/default port/no credentials is fetched. Every redirect is checked; limit5, loop/cross-origin/private/local-address rejection. Enforce body2MiB, headers64KiB/100 keys, DOM40,000 elements/depth100, finite links/text, six eligible personal paths per capture and safe Unicode. Scripts/styles/iframes/templates are removed; remote content is never executed or treated as instructions. External agency/PDF/generic links remain observed source metadata without fetching.

## Internal shadow and future V8

The read-only repeatable-read comparison consumes the latest accepted NASA capture and selected LL2 assignments, after existing canonical knowledge. Latest explicit LL2 no-active outcome does not resurrect old assignments. Verified resources can reuse existing profile ownership or reviewed typed bindings. Unique equal names are exposed as **candidates only**, with null canonical IDs when no existing resource relation qualifies; they never write mappings.

Slot classifications include matched existing canonical, NASA-only, LL2-only, unresolved and source field conflict. Conflicts remain separate from identity completeness. Live comparison is7 NASA slots /7 LL2 assignments /7 exact-name agreements, with existing resource ownership for Menon/Watkins/Delaney and four unbound editorial slots. No canonical decision is manufactured for the other four. Public Current remains its accepted broader10-member union.

Future V8 has persisted typed roster slots/membership, names, source locators/hashes/times, explicit personal topic/people relations, personally scoped flight captions and field conflicts. It must apply its own calibrated model, witness/ambiguity/component guards and audited decisions. No automatic actor/method or identity universe is introduced here. Future public Current activation and editorial Replay require separate milestones/contracts.

## Validation and reproducibility

Pre-edit baseline: Java21 `mvn test`436/0 failures/0 errors/0 skipped; frontend759 tests/61 files. Final actual totals and bounded source hashes/times are recorded in [validation summary](validation-summary.json) and [live capture summary](live-capture-summary.json).

Coverage includes75 fixture shapes with/without CSS, the75 full external pages with/without CSS, current dual sections/conflicts/captions, malformed/missing/duplicate stats and rosters, actual wrong-person link, typed discovery/changed IDs, empty/multiple/wrong candidate cases, URI/redirect/body/Unicode limits,304/429/timeout/cooldown, independent health, shadow set/field conflicts, fresh and V7-upgrade Testcontainers PostgreSQL, immutable constraints, identical/noise/modified captures, A→B→A/failure and durable scheduler/repository restart. Synthetic mutations are explicitly test-only.

Measured live cold acquisition:18 logical GETs plus two redirect hops; next refresh2. A fresh OS process then reused persisted context/profile cache and made2 GETs per refresh. There is no unconditional per-person routine network fetch. Public GET query paths do not read this source at all; existing batch-query tests and actual GET fingerprints confirm no added N+1 work, writes or provider calls. Latest editorial-roster read uses four bounded set queries independent of member count; profile comparison uses the existing batched person read.

Real local audit protects all41 original tables, including original body/document rows and V1–V7 Flyway history. Only V8 history, editorial rows and new shared documents/bodies were added. Topic-count consistency is recorded on each acquisition; a count-only change does not duplicate unchanged mission roster meaning. Identity anchors/mappings/decisions, old evidence/occurrences and reconciliation snapshots remain identical. Current/detail/Replay data equality excludes only documented request evaluation/reconstruction times and coverage endpoints equal to that reconstruction time. All50 table fingerprints remain unchanged across GETs. Across JVMs, orbital Replay differences are limited to floating-point roundoff (maximum35.4nm position difference), explicitly recorded under strict tolerances; orbital code is unchanged.

Browser QA reuses the accepted five viewport suite (1440×900,1024×768,768×1024,390×844,320×568), Current/details/Historical, resize/touch/focus flows and Inspection transitions. The small wrapper routes browser API transport to the real separately started updated backend; it substitutes no data and changes no frontend source. Results/screenshots stay outside Git, with compact acceptance recorded here.

Run the explicit writer only when intentionally validating local ingestion:

```sh
cd backend
mvn dependency:build-classpath -Dmdep.outputFile=/tmp/mission1-editorial-classpath.txt
cd ..
IFS= read -r editorial_dependencies < /tmp/mission1-editorial-classpath.txt
java -cp "backend/target/classes:$editorial_dependencies" \
  docs/crew/nasa-editorial-roster-validation/scripts/EditorialLiveValidation.java \
  /absolute/output/live.json
```

Add `--read-only` to emit retained diagnostics without acquisition. The runner disables schedulers and legacy startup writers; it registers no production endpoint/runner. `EditorialCorpusValidation.java` takes the external full fixture directory and output path and makes no network/database calls. Browser wrapper accepts `MISSION1_QA_BACKEND` and `MISSION1_QA_OUTPUT`, with the same URL/build arguments as the accepted navigation script.
## Subsequent identity integration

V9 now consumes these immutable source slots, personal captions and verified topic/Biography/people relations through the [automatic shadow resolver](../automatic-identity-shadow-validation/README.md). Source observations retain their original meaning. No editorial count, physical presence, active Current selection or public identity behavior is activated. Rejected about-person relations remain retrieval failures and never become positive human evidence.

## Subsequent production Current activation — ADR-0017 / 2026-10-11

The dated results above remain the original milestone record. [Production Current activation](../current-active-projection-activation/README.md) now consumes the compatible V10 ACTIVE result through V7 publication. This does not activate V9 identity, alter source observations/parsers or redesign Replay; all V1–V10 migration bytes remain unchanged.
