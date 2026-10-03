# ISS Crew event-aware refresh validation

Baseline: `4c7959edaa37726cbdb2c9e44c4d0c585bdbabfc`, clean main synchronized with origin. Design was written before runtime implementation. The final results below are populated only after execution.

## Source captures

Captured on 2026-10-03 from the authoritative LL2 2.3.0 API and NASA official RSS. Fixtures preserve exact bytes; metadata preserves requested URL, retrieval UTC, HTTP headers and SHA-256. The narrow calendar query returned 200, count 3, next null, event IDs 1519/1524/1525, station 4 and types 2/8. All astronaut relations empty: UNKNOWN classification. Two future planning dates were observed; no event-level completion/cancellation or cargo field was available. Discovery uses one bounded GET and no enrichment.

Research also checked docking occurrence endpoints and browsable schema. The undocumented `space_station=4` docking filter was ineffective; verified `space_station_target__id=4` correctly selected ISS. `/docking_events/` is excluded from future planning. One research request without the product User-Agent returned 403 and was not retried. These exploratory requests are separate from the runtime adapter budget.

NASA RSS returned 200 with ETag and Last-Modified. Its exact body matched the accepted baseline fixture. No live completed transfer occurred during the validation interval; completed-transfer flows are demonstrated with explicitly labeled offline test fixtures.

NASA raw RSS capture is retained as [nasa-feed.xml.gz](nasa-feed.xml.gz), with exact decompressed SHA-256 in [metadata](nasa-feed-metadata.json). Execution logs have trailing whitespace normalized; source captures are not reformatted.

## Implementation and audit

`CrewOperationalEvent` stores source identity/URI, docking/undocking kind, nullable schedule and precision, source update time, relevance (CREWED/CARGO/UNKNOWN), status (UNKNOWN/CANCELLED), astronaut and launch relations. `CrewEventSource` is a one-page planning port. `LaunchLibrary2CrewEventSource` validates the exact contract without enrichment. `CrewRefreshPolicy` contains Settings/Candidate/FollowUp/Decision/Target/Reason and pure eligibility, completed-context, settlement and supersession functions. `CrewRefreshCoordinator` consumes persisted inputs through the accepted ingestion services. Composition is in CrewRefreshConfiguration/Scheduler; JDBC operational state is behind CrewRefreshRepository.

V5 adds `crew_event_catalog_run`, `crew_operational_event_observation`, `crew_event_catalog_observation`, `crew_refresh_follow_up`, `crew_refresh_trigger`. Event versions and run associations cannot be updated/deleted. Semantic event A→B→A reuses A but retains each catalog selection. Completed catalog runs are immutable. Follow-ups allow one terminal transition; evidence ID uniqueness prevents restart/304 re-opening. Triggers use a unique target/reason/event-or-follow-up/source-generation key, immutable creation-time decision fields and one atomic source-run association. Source-target and follow-up/evidence foreign-key checks protect lineage. Accelerated intent is persisted while ineligible; policy/cooldown are reevaluated before claiming. Obsolete pending rows remain audit history and are never blindly drained.

NASA typed evidence → persisted completed transfer → durable follow-up/trigger → Clock-based LL2 eligibility → accepted structured ingestion transaction → accepted reconciliation. Planning or transfer events never directly write presence. Settlement checks every safely resolved person, this event's cited evidence, a primary fetch after context and corresponding LL2 assignment/absence. It never uses count equality. Unresolved/PARTIAL_MATCH ends by six actual attempts or context+24h; older fully resolved transitions can close SUPERSEDED. Failure and IN_PROGRESS consume attempts; skipped calls do not. Source guards plus process/tick guard and PostgreSQL advisory ownership prevent overlap. No reciprocal LL2→NASA follow-up exists, so a completed NASA event cannot initiate a feedback cycle.

## Configuration and request accounting

| Setting | Default | Basis |
| --- | --- | --- |
| LL2/NASA baseline | 2h / 2h | Accepted low-frequency policy, retained |
| Calendar | 6h, 15m startup, maximum age 12h | One bounded provider request; reschedules observed without high-frequency discovery |
| Event window | 6h before / 6h after | Bounded planning anticipation, never source completion evidence |
| NASA crewed / unknown / cargo | 30m / 1h / baseline 2h | Unknown gets weaker scheduling relevance; cargo stays inert |
| Completed NASA→LL2 | 1h | Shared quota and source-lag follow-up |
| Follow-up termination | 24h from event/publication, six actual attempts | Stable across restart; unresolved divergence cannot loop forever |
| Tick/startup | 1m; roster 5m, NASA 10m, calendar 15m | At most one due operation per tick; no startup fetch |
| Shared LL2 hard limit | 12 actual attempts in rolling hour | Published unauthenticated quota 15/h, three-request margin for other use |

Default automatic LL2 requests are much lower than the cap: roster at most 1/h during follow-up plus at most one catalog request in that hour, at most 2/h combined. NASA minimum default 30m permits at most two in a rolling hour. Baseline 24h: LL2 12+4=16, NASA 12. One follow-up contributes at most six accelerated attempts; conservative 24h bounds are LL2 28 and NASA 48 even across moving windows. These are local policies, not claims about provider update cadence or other clients' quota consumption. Delta-seconds and RFC-date Retry-After win; missing/invalid 429 header imposes 2h. No retries within a run.

## Trigger matrix

| Input | Behavior |
| --- | --- |
| Precise planned crewed docking/undocking | NASA 30m inside window; no presence write |
| Explicit cargo | Baseline; production adapter currently cannot prove cargo |
| Unknown | NASA 1h inside precise window; all captured real candidates are UNKNOWN |
| Completed named NASA arrival | LL2 1h bounded follow-up; eventual assigned/person evidence checks |
| Completed named NASA departure | LL2 1h bounded follow-up; eventual absent/person evidence checks |
| Planned NASA / count-only / docking-only | No completed-transfer follow-up |
| Catalog failure / stale / incomplete / coarse date | No anticipation; roster/NASA baseline continues |
| Source failure during follow-up | Audit failure, preserve graph, count attempt, wait normal accelerated interval |
| Rate-limited source | Persist intent; honor shared/per-source Retry-After; zero bypass |

## Deterministic case coverage (A–Y)

| Case | Evidence |
| --- | --- |
| A/B | Pure no-event/outside-window tests; 24h normal HTTP simulation |
| C/D/E | Precise inclusive windows, explicit cargo inert, recorded real UNKNOWN + validated astronaut relation fixture |
| F/G/H | Reschedule later/earlier pure tests; A→B→A immutable PostgreSQL history; cancelled policy input inert (source has no verified cancellation field) |
| I/J/K/L | Planned/count inert; completed arrival and departure through RSS→persistence→trigger→LL2→reconciliation |
| M | Pending completed trigger during LL2 429, coalesced after restart, linked only after cooldown |
| N | Baseline/accelerated LL2 race records SKIPPED_OVERLAP with one execution |
| O/P/Q/R | Lag follow-up, identity/assignment catch-up settlement, unresolved six-attempt exhaustion and horizon expiry |
| S/T | Conditional 304, evidence dedupe and immutable catalog versions/current associations |
| U | Late old context inert; newer confirmed opposite assertion supersedes older resolved transfer |
| V/W | Restart during anticipation and follow-up; interrupted claim remains IN_PROGRESS and consumes durable budget |
| X | UTC window start/event/end inclusive, follow-up horizon exclusive, future/null/coarse times and clock jumps |
| Y | One-way follow-up; 24h actual request ceilings and existing NASA count/cadence unchanged after LL2 fetches |

Adapter tests also prove missing/bad IDs/mode/station/time/URL/relations, duplicate rows, pagination/truncation and 429 fail closed with one request. Unverified completion/cancellation/cargo fields and past schedule dates cannot become facts. PostgreSQL tests cover empty→V5 and V4→V5 with hash-equal LL2/NASA/reconciliation/GP/OEM sentinels, event immutability/dedupe/audit, atomic association, restart, both source races, database coordinator contention and transaction rollback (including actual HTTP/hash provenance after a failed graph write). Existing baseline ingestion/verification/read-only API tests remain active. No H2 or external traffic in default tests.

Measured 24h loopback HTTP results:

| Scenario | LL2 roster | Calendar | Combined LL2 | NASA |
| --- | ---: | ---: | ---: | ---: |
| Normal | 12 | 4 | 16 | 12 |
| One crewed planning window | 12 | 4 | 16 | 31 |
| Rescheduled later | 12 | 4 | 16 | 22 |

These use a mutable injected UTC Clock, actual ingestion/conditional transports, real PostgreSQL and explicitly TEST_ONLY planning variants. They do not claim a real crew transfer occurred.

## Live source and runtime evidence

[Live runtime report](live-runtime.json): 2026-10-03T19:10:20.324020Z. One actual LL2 calendar GET → AVAILABLE/200, count 3 complete, one past and two future schedules; event IDs 1519/1524/1525 were observations, not code constants. All remain UNKNOWN. Exact rolling query is retained in the report. One LL2 roster GET → SUCCESS with existing snapshot reused. One NASA conditional GET → SUCCESS/304, retaining the existing document/evidence. All three requests have MANUAL_OR_TEST audit linked before HTTP. No retry/enrichment, no real transition during the validation interval. Initial classpath-order setup failure made zero source requests; production resources were then selected correctly.

Local PostgreSQL 16.10 upgraded V4→V5 and the packaged Java 21 backend started successfully. [API smoke](api-runtime.json) records all six 200 routes: `/api/iss/crew`, `/api/iss/crew/{uuid}`, `/api/iss/expedition/current`, `/api/iss/state`, `/api/iss/orbit/samples`, `/api/iss/orbit/comparison`. Crew responses retain no-store and unchanged accepted JSON; queries still perform no source fetch/write. Payload captures are dated current assessments, not expected fixed counts.

[Initial browser report](browser/report.json), uninstrumented dev5175 and served production4175 at 1280×720 and 390×844: real Crew list, UUID detail, Back/Close, Crew in Inspection, GP/TLE and OEM selection, full Inspection/Back and wheel zoom passed. No application page errors, no direct provider-data calls, no QA observer or fixture nodes. Last production/mobile context captured two resource console errors from a NASA GIBS image tile CORS response; existing imagery fallback retained usability. This is recorded, not presented as a clean provider console. Screenshots were visually inspected for desktop list, mobile detail and production mobile OEM Inspection. Camera/trajectory/Inspection code and physical source products remain frozen.

[Final packaged-backend browser report](browser-final/report.json) repeats all four dev/production/desktop/mobile contexts against the final JAR: both sources, Crew list/detail/Inspection/Back passed; zero application or console errors were captured in this final run. The earlier provider CORS incident remains recorded in the initial report. Final API smoke was repeated at 2026-10-03T19:41:50.507368Z. Backend PID6547 on 8080, dev5175 and production4175 remain available with the existing PostgreSQL volume.

Native two-finger pinch remains unverified unless a genuine native-touch test was performed. Status: **UNVERIFIED**, no genuine native-touch test performed, not a scheduling blocker. Headless mouse/wheel/browser input is not native pinch proof.

[Freeze audit](freeze.json): 245 accepted baseline files checked byte-for-byte, zero mismatches. It includes frontend runtime/assets/build configuration, Orbit/CelesTrak/Orekit/API source, Crew domain/read/reconciliation and NASA parser/source, historical test fixtures and V1–V4. Four existing PostgreSQL/migration tests changed only expectations for V5/26 Crew tables; source-disabled test properties include the new coordinator flag. No runtime dependency, UI, Orbit computation or API DTO change.

## Gates and reproducibility

Final gates: **355 backend tests**, zero failures/errors/skips; **273 Crew tests** overall, including **71 PostgreSQL persistence tests** (29 new refresh, 24 roster, 18 NASA/reconciliation) and **11 Crew PostgreSQL API tests**. Maven offline `test` and `verify` both exited 0. Frontend **269 tests / 30 files**, typecheck and production build passed. `git diff --check` passed. Counts and executable logs are in [test-results.json](test-results.json) and adjacent logs. Maven offline `test` and `verify`, frontend `test` (269/30), typecheck/build, API/browser smokes and whitespace checks are required. Existing Cesium chunk-size build warning remains. The new live probe is opt-in and outside Surefire discovery; normal tests disable every source scheduler.

Run the browser helper with the bundled Playwright module path in `MISSION1_PLAYWRIGHT_MODULE`, ports 5175/4175 and the packaged backend 8080. It operates real backend data and performs no route interception. Use the backend README's explicit live probe only after offline checks; it observes LL2 cooldown and does not perform retries. Reviewed context: [inventory](context-reviewed.md).

Documentation updated: Crew README/domain/source validation/authority/persistence/NASA/validation and previous ingestion/reconciliation/REST dossiers (dated evidence retained); implemented Crew API operational note; architecture03/05; backend/frontend READMEs; Crew-panel dossier; ADR index and new ADR-0010. New design and this dossier were created. External `/Users/daniel/Desktop/mission1-project.md` is updated separately outside Git with final commit/sync state. No self-referential final hash is embedded in this commit.

Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.
