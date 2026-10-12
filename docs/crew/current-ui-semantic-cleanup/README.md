# Current Crew semantic cleanup — ADR-0018

Canonical repository `/Users/daniel/Desktop/MISSION1`, direct `main`; baseline
`915b0e2baf66002cdccf849ccc468c7a1e1bc5ac`. One ordinary commit and normal push follow
all gates. Commit identity is recorded outside Git to avoid a self-referential hash.
[ADR-0018](../../adr/0018-current-crew-summary-semantics.md) documents the coordinated
Current-only contract removal. [Compact validation](validation-summary.json).
Full HTTP/SQL/JSON/JFR/log/PNG evidence: `/Users/daniel/.codex/exports/mission1-current-ui-semantic-cleanup/`.

## Proven cause, investigated before implementing

[Investigation](unresolved-identity-investigation.md) contains the actual relevant
runtime JSON, pre-implementation dataflow table, SQL/repository/engine/DTO/React trace,
the single underlying COUNT_ONLY assertion, all26 operational subject tuples, all23
V10 slots, and the eleven retained human anchors (explicitly not the scalar gap).
[Recorded state](investigation-state.json) retains exact keys/IDs/decisions/document
lineage; [read-only reproduction SQL](investigation.sql) makes classification auditable.

There are no eleven unidentified records. The old headline rendered
`crew.counts.unidentifiedAboard`, copied from `state.unidentifiedCount()`:
`max(0, operational count - confirmed aboard identities)`. Earlier11−0=11 came from
one operational count11, published2026-10-02T18:14:13Z, evidence1/document1, without
named subjects. Current's unresolvedSubjects array was empty and Current humans7.
The normal trial application's scheduled acquisitions refreshed sources before this
milestone: investigation reads11−4=7, still seven Current humans. Source cut changed
from projection3/graph8 to projection7/graph18; this cleanup does not change it.

The value is neither unresolved-assertion cardinality nor an ACTIVE+RETAINED slot sum.
The independent V10 result has8 ACTIVE slots (4 editorial,4 operational positive)
and15 retained operational slots (7 older positives,8 departure subjects). Typed slots
may repeat resolved people/source subjects. There is no name-based deduplication.

## Result and wording

Current's sole headline is **Current members7**, derived from production selection.
Reported aboard and Without confirmed identity are removed from Current roster and
legacy Current summary component. Obsolete summary-grid overrides were removed;
existing layout/tokens, scroll, responsive switching and controls remain intact.
Only the existing source-details section shows8 unresolved ACTIVE source slots,
explicitly separate from people. No retained-slot headline, guessed human count or
redundant replacement aboard statistic is introduced.

| Location | Previous | Current |
| --- | --- | --- |
| Current row / detail | Presence outdated | Presence not currently confirmed |
| Last operational line | Last known: confirmed aboard | Last operational confirmation: aboard · original UTC |
| Negative confirmation | Last known: confirmed not aboard | Last operational confirmation: not aboard · original UTC |
| Crew warning | Presence evidence is dated · last-known confirmation is not current confirmation. | Current membership is known, but physical presence is not currently confirmed by operational evidence. |

“Structured assignment does not confirm presence aboard.” remains. Presence enums,
applicability, freshness, source health, amber/green states and lifecycle are unchanged.
At this source cut4 Current people have confirmed operational presence and3 are stale;
this is independent of seven membership identities. Historical presence copy is frozen.

## API and schema

`CurrentCrew` / `CurrentCounts` replace the shared Current return type. Current removes
`counts.officialAboard`, `lastKnownOfficialAboard`, `unidentifiedAboard`, `unresolvedSubjects`
and root `unresolvedSubjects`. `counts.resolvedAboard` and `structuredAssignments` remain
useful independent operational/structured diagnostics. The Current mapper no longer
projects count applicability, gap or legacy unresolved subject entries. Current frontend
types/decoder cannot expose them. Replay uses dedicated Historical types/decoder and
retains its original `Crew` / `Counts` wire contract. Explicit legacy membership rollback
also uses the narrower Current contract; its inclusion setting remains deliberate.

The repository's frontend is the only runtime consumer; tests/scripts/docs were audited.
Backend and frontend release together, with no external deprecation/versioning requirement
found. This is a documented breaking removal on Current, not an indefinite deprecated field.

[Full schema/reference audit](database-audit.md) identifies writer, reader, meaning,
history, Replay, diagnostics and API use for every potentially related persisted field.
No persisted field exists solely for the obsolete UI presentation. **No migration**:
V1–V10 unchanged, no column/table dropped and no data deleted. Operational count facts,
last-known reconciliation count/gap history, editorial website observations/roster slots,
source/occurrence/identity history and V9/V10 projections remain preserved. Independent
counts remain independent even when several happen to equal7.

## Actual retained members and Fedyaev

Pyotr Dubrov, Anil Menon, Anna Kikina, Jessica Watkins, Luke Delaney, Joshua Kutryk,
Sergey Teteryatnikov: seven V10 ACTIVE humans published through unchanged V7 identities.
No hardcoding, V9 production matching or membership lifecycle change. All seven detail
profiles and four retained profiles remain addressable; Luke/Watkins aliases are unchanged.

LL2 Andrei Fedyaev `e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5` is RETAINED.
NASA Andrey evidence12:6 is retained/AUTO_DEFER; departure subjects21:3 and27:3 are
retained/AUTO_DEFER (decisions42 and36). They add zero Current cards and zero ACTIVE slot units;
they cannot be allocated one unit of the old eleven scalar. No forced merge occurs.

## Historical, GET and protected data

Replay2026-10-02T02:01:55Z remains ten members/one unresolved Andrey, without future
Expedition/assignment/departure. Actual `crew.state` compares **exactly** with baseline;
all13 Current/retained/alias detail JSON compare after only request evaluation clocks
are removed. Historical backend logic is unchanged and its original count/report/UI
presentation survives the DTO split. Five-size browser Historical checks pass.

Whole Replay envelope differences are request/coverage clocks and independent JVM orbital
floating-point differences: maximum position component1.228415µm and velocity component
1.173e-9m/s; no orbital source/code changed. The audit bounds numerical comparison at
10µm position/altitude,1e-8m/s velocity and1e-9degrees, not a claim of source accuracy.

Actual Current/detail/retained/aliases/Replay GETs preserve all70-table row fingerprints:
**writes0, provider calls0, V9 evaluations0, V10 materializations0**. JDBC probe records
only SELECT statements. Final JFR2322 zero-threshold socket events are all127.0.0.1,
TLS/external0. Source/V9/V10 workers and startup identity/backfill writes are OFF for
validation. All70 tables remain unchanged across the complete milestone's QA too;
no incidental orbital cache refresh was observed this time. All ten migration bytes match.

## Performance

Paired serial instrumented runs after heavy suites:10 warm-ups +100 reads per version,
using identical retained state, baseline classes and final classes. Earlier concurrent
measurements are preserved separately and not substituted for these paired measurements.

| Version | SELECTs | Read median ms | Serialization median ms | JSON bytes median |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 53 | 32.356 | 0.316 | 56263 |
| Cleanup | 53 | 32.248 | 0.331 | 56142 |

No queries added or removed, no N+1 or source fetch. Removing DTO mapping trims the payload;
shared reconciliation still needs its evidence/resolution reads for operational presence.
Small latency differences are local measurements with instrumentation, not an SLA.

## Gates and reproduction

Java21 baseline `mvn test`958 →final `mvn test`962 and `mvn verify`962, zero failures/errors/skips.
Four added parameterized API regressions cover gap0/3/7/11 with seven selected humans,
8 ACTIVE/15 retained slots and no read of the obsolete gap mapper. Existing PostgreSQL
membership/presence/source independence, Fedyaev, Replay and all-table GET audits pass.
Node24 baseline764/62 →770/63, full tests, typecheck and production build pass. Six new
frontend cases reproduce gaps11/7, ACTIVE-only slot diagnostics, row/detail/timestamp
wording, negative presence and frozen Historical. Existing Cesium chunk warning remains.
`git diff --check` passes.

Development and production each pass Current and Historical at1440×900,1024×768,
768×1024,390×844,320×568. Each also passes22 resize/8 container checks plus keyboard,
focus, profile scroll and reduced-motion/touch cases. Actual text range/cell/panel bounds
prove no clipping or horizontal overflow; missing image alt checks pass. Desktop/mobile
screenshots were visually inspected. The skill's optional shared visual-runtime files
are not installed; the existing repository Playwright runtime supplies geometric/text
lint, console capture and screenshots. Physical mobile devices are not covered.

All70 seven-person/build/viewport profile selections and8 retained direct reads pass.
All20 GP/TLE and NASA OEM Inspection entry/back cases across both builds/five sizes pass.
Page/console errors0. The final single-metric CSS cleanup repeats the five-size
Current/Historical navigation matrix on both builds. No scene/Inspection code changes.

Run Java21 `mvn test`, `mvn verify`, Node24 `npm test`, `npm run typecheck`, `npm run build`.
[readonly-smoke.py](scripts/readonly-smoke.py) is pinned to this recorded local cut and
performs only local HTTP/read-only SQL. [Browser navigation](scripts/browser-navigation.cjs)
and [Inspection smoke](scripts/browser-inspection.cjs) use actual backend responses via
`MISSION1_QA_BACKEND`; set `MISSION1_QA_OUTPUT` outside Git. The prior shared
CurrentReadValidation driver still benchmarks the purpose-specific Current result.

The prior normal trial server was paused during validation to protect source state.
After acceptance the final jar is restored on8080 with normal schedules; existing
frontend5175 and PostgreSQL are preserved. Temporary validation/preview services stop.

At the preceding activation cut (graph8), departure subjects had NO_AUTOMATIC_DECISION.
The normal trial worker evaluated them before this cleanup (graph18): the actual
captured departure slots now have AUTO_DEFER. This task neither evaluates nor changes
those decisions; all source/graph/decision fingerprints remain frozen from investigation onward.

## Membership-first presentation — ADR-0019

Every V10-published Current human receives the same primary **Current member** state. [Dated secondary evidence and validation](../current-operational-presence-validation/README.md) distinguish activity, completed entry and expired/missing reports. Identity-based presence explanations are removed. Current summary omissions and Historical contracts remain intact. Visible Current refetch is serial at120s after completion; it never calls NASA/LL2.

## Subsequent unified production architecture — 2026-10-12

[ADR-0021](../../adr/0021-production-operational-binding-and-unified-crew-replay.md) and [final validation](../final-crew-architecture-validation/README.md) activate S10 scoped operational bindings and the shared V10 Current/Historical lifecycle. V7 remains canonical; V9 general identity remains SHADOW. The earlier accepted capture and read-isolation results below retain their dated meaning. Historical now evaluates seven-day observations at T without backdating structured/editorial capture; clean-room empty-database bootstrap validation is the next separate milestone.
