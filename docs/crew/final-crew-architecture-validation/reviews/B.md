# B — Final Historical / Replay temporal review

Review date: 2026-10-12 Europe/Rome (HTTP/source instants below are UTC). Baseline: `91664c4111c2c9208ed71609390f6907e484fa64`. Canonical working tree and PostgreSQL were read-only for this agent. No production acquisition, mutation, scoring, source import or materialization was invoked.

**Review verdict: PASS for the integrated temporal implementation and actual retained reconstruction.** The main agent still must integrate/rerun the twelve E production-path tests (including the three requested regression cases) and its final full acceptance suite before committing. This verdict is not a claim that those pending main-agent gates have completed. There are no remaining identified temporal implementation blockers after the corrections described below.

## Independent evidence

- Complete initial reading and design findings: `b-historical.md`.
- Fourteen actual pre-change legacy HTTP responses, including full orbit/state/profile bodies: `b-legacy-replay.json`.
- Twenty-one actual modern HTTP cuts through isolated read-only backend8081, full member assignments/annotations/unresolved inputs and exact S10 retained lineage: `real-timeline.json`.
- Reproduction: `b-review-timeline.py`; `MISSION1_B_QA_URL` overrides its default8081. It makes same-origin local GETs plus one SELECT-only latest-binding query. Its timestamp comparison preserves nanoseconds.
- Automated future-event/source-capture/assignment validation: `b-future-event-audit.json`, zero violations over21 cuts.
- Twenty explicit TEST_ONLY pure-policy cases: `BTemporalPolicyAudit.java`, `b-temporal-pure.log`, all PASS against compiled production policy. No Spring context, database or network is involved in this runner.
- Orbit differential at the original14 exactcuts: `b-orbit-differential.json`, identical source hashes; largest position difference approximately5.05e-8m and velocity difference4.59e-11m/s across fresh processes. Those finite numerical cache/frame differences are far below the existing accepted tolerances; Crew migration does not alter orbital policy.

## Engine and authority review

Normal `ReplayConfiguration` constructs `UnifiedCrewReplay`; legacy query remains explicit `mission1.replay.crew.mode=LEGACY` only. Modern mode uses the same `ActiveMembershipPolicy` as production Current and includes only ACTIVE humans after independently checking provider-safe V7 publication. Its policy is:

`crew-active-production-v1/crew-freshness-v2:PT6H:PT6H:PT168H:PT336H/count=PT72H/roster=PT6H/topic=PT6H/personal=PT168H`.

There is no historical query of the latest Current projection and no duplicate handwritten historical lifecycle policy. Existing pure reconciliation is auxiliary count/operational interpretation only. V9 graph/source decisions are excluded from normal retained-input loading. Editorial slots require existing explicitly verified V7 resource correspondence; operational slots consume exact sealed `s10-scoped-production-v1` decisions. Neither path creates people, aliases, equivalences or profile values.

Two evaluation contexts are explicit: the one-argument loader is Current and retains its existing materializer transaction; the two-argument loader is Historical and joins the controller's read-only REPEATABLE_READ transaction using REQUIRED. Historical context is not inferred from whether T happens to equal knownAt. A historical query at equal clocks therefore still applies effective-time semantics.

## Clock and source boundaries

Operational assertions and compatible immutable source versions are selected at current knowledge time, then filtered by source effective time<=T. S10 identity/proof eligibility uses knownAt rather than T, so a valid Oct11 binding can interpret an Oct2/Oct7 assertion without pretending it was known then. Original document/source/binding timestamps remain unchanged.

LL2 state selection now requires successful committed data<=knownAt and real retrieved/capture time<=T; an acquisition finishing afterT cannot postpone its already observed effective capture in best-current reconstruction. Editorial membership begins at its original acquisition.completedAt capture and selects successful roster/topic captures<=T. Neither CMS time, Expedition start nor latest Current assignments backdate support. Successful omissions retract only their own source support; failure does not create omission/departure.

Historical eligibility is computed relative to T. Seven-day OBSERVED and fourteen-day completed-entry intervals are inclusive at their exact ends and stale at +1ns. Departure veto remains an episode closure even after fresh physical-confirmation expiry. Future arrival/observation/departure/reentry facts cannot affect earlier membership or selected operational evidence. Today’s feed failure is independent from old effective-event eligibility; original collection health/provenance stays attributed.

Modern coverage now includes retained editorial capture intervals, so editorial-only positive support is not discarded merely because LL2/operational coverage is absent. No row is persisted per arbitrary user-selected timestamp.

## Corrections found and independently rechecked

The first implementation review found these issues, which the primary agent corrected:

1. Public reconciliation `PARTIAL` was outside the existing API enum. It now emits `PARTIAL_MATCH`; S10 unresolved states map to public UNRESOLVED/AMBIGUOUS, preserving detailed internal state separately.
2. Historical context was inferred by `T!=knownAt`; it is now explicit, including equal-clock queries.
3. LL2 selection delayed assignment until completion despite coverage starting at retrieval; it now separates knowledge completion and capture/effective boundaries. Actual first-capture ±1ns reads verify the correction.
4. Coverage omitted editorial-only support; modern coverage includes capture-bounded editorial intervals. E added a dedicated normal-ingestion/editorial fixture regression.
5. Historical `presence.lastKnownState` was always null. It now preserves the raw selected episode, including dated confirmed-aboard context. Actual Current/Historical same-T member fields now compare exactly.

## Real retained UTC timeline

The eleven-person overlap set is:

Andrei Fedyaev, Anil Menon, Anna Kikina, Jack Hathaway, Jessica Meir, Jessica Watkins, Joshua Kutryk, Luke Delaney, Pyotr Dubrov, Sergey Teteryatnikov, Sophie Adenot.

The seven-person successor set is:

Anil Menon, Anna Kikina, Jessica Watkins, Joshua Kutryk, Luke Delaney, Pyotr Dubrov, Sergey Teteryatnikov.

All available real rows have zero unresolved operational subjects. “Assignments” below is the independently attributed selected structured-source cardinality, not membership. The actual member assignment role/null is included per person in `real-timeline.json`.

| Effective UTC T | Membership | Structured assignments | Confirmed operational annotation | Resolved departure subjects |
|---|---:|---:|---:|---:|
|2026-10-02T02:01:54.999999999Z|UNAVAILABLE|—|—|0|
|2026-10-02T02:01:55Z|11|—|11|0|
|2026-10-03T12:04:00Z|11|7|11|0|
|2026-10-05T17:18:03.999999999Z|11|7|11|0|
|2026-10-05T17:18:04Z|11|7|11|0|
|2026-10-06T17:57:54.999999999Z|11|—|11|0|
|2026-10-06T17:57:55Z|11|—|11|0|
|2026-10-07T12:04:59.999999999Z|11|7|11|0|
|2026-10-07T12:05:00Z|7|7|7|8|
|2026-10-07T12:05:00.000000001Z|7|7|7|8|
|2026-10-08T12:00:00Z|7|7|7|8|
|2026-10-09T16:35:39.999999999Z|7|7|5|8|
|2026-10-09T16:35:40Z|7|7|5|8|
|2026-10-10T12:00:00Z|7|7|5|8|
|2026-10-03T10:30:18.796288999Z|11|—|11|0|
|2026-10-03T10:30:18.796289Z|11|7|11|0|
|2026-10-03T10:30:18.856620Z|11|7|11|0|
|2026-10-09T02:01:54.999999999Z|7|7|7|8|
|2026-10-09T02:01:55Z|7|7|7|8|
|2026-10-09T02:01:55.000000001Z|7|7|5|8|
|2026-10-11T22:05:07.552306Z|7|7|5|8|

Before the first proxy there is no retained evidence to prove a seven-person roster: entry evidence2 and old-seven observation12 both begin at2026-10-02T02:01:55Z. This is an evidence gap, not a physical empty station. The actual retained flagship transition is unavailable→11→7. The separate TEST_ONLY production-equivalent suite supplies the required full7→11→7 rather than inventing a pre-proxy seven.

Before real departure, selected LL2 roles belong to the outgoing seven: Meir Commander; Hathaway/Adenot/Fedyaev/Menon/Dubrov/Kikina Flight Engineer; the incoming four have no captured assignment. At/after departure until provider recapture, the incoming four remain ACTIVE from qualified operational support with assignment null; Menon/Dubrov/Kikina retain their historical Flight Engineer roles. At the sealed late Current cut all successor seven have assignments; Dubrov is Commander, six others Flight Engineer. This proves modern Replay does not substitute today's incoming roles or Commander designation into earlierT.

Eight source-subject departures are two immutable assertions for four humans. Both become effective at explicit minute2026-10-07T12:05:00Z, although publication is12:10:34Z/12:48:02Z and captures/identity resolution are later. The policy removes four humans once; no count subtraction occurs.

## Selected observation boundaries

- Source Josh Kutryk: at2026-10-05T17:18:03.999999999Z, latest selected episode is Oct2 completed entry; exactly17:18:04Z, selected episode advances to the Oct5 activity. Display remains canonical Joshua; original source spelling Josh is retained in exact S10 lineage.
- Anil Menon: before2026-10-06T17:57:55Z, selected observation remains Oct2; exactly at that proxy it advances to Oct6. No Anna identity appears.
- Luke Delaney: before2026-10-09T16:35:40Z, selected observation is Oct5; exactly at that proxy it advances to Oct9.
- Kikina/Dubrov: Oct2 observation remains fresh at2026-10-09T02:01:55Z, stale at +1ns. Fresh structured support retains them in the seven-member roster. Staleness is not fabricated departure.

The automated field audit inspected every selected presence/evidence asOf, all contributing assertion effective times, each assignment validity interval, and structured provenance observedAt. None exceededT or displayed ended/future assignment validity.

## Binding knowledge provenance

The exact latest production heads126–150 were all known at `2026-10-11T22:04:08.277929Z`. They remain later than the historical source events. Every retained source subject/version, evidence/document/hash, provider/canonical target and original source capturedAt is recorded in the JSON. IDs map:

| Evidence/indices | Binding revisions | Source scope |
|---|---|---|
|2/0–3|126–129|four completed incoming entries|
|12/0–6|130–136|seven observed old-crew subjects, including source Andrey Fedyaev|
|21/0–3|137–140|four outgoing completed departures|
|27/0–3|141–144|same four humans in independent immutable departure assertion|
|58/0|145|Anil Oct6 activity|
|59/0–3|146–149|Watkins, Delaney, source Josh Kutryk, Teteryatnikov Oct5 activity|
|64/0|150|Delaney Oct9 activity|

At firstproxy all eleven profiles contain latest canonical metadata captured later (Oct9/Oct11) with no assignment backfill. This is the documented product policy, not future operational leakage. No public probability, runnerProbability, margin or confidence fields appear in any captured response. Query-time Historical membership revision0 is explicitly a sentinel, not a persisted V10 revision; exact production binding times remain internally auditable and the ADR/dossier maps its release.

## Every legacy differential explained

The baseline uses `crew-freshness-v1`72h/retained union and excludes timed departure facts. Modern mode uses V10 ACTIVE, v2 seven days and compatible S10 bindings.

| T / group | Baseline→modern roster | Membership / annotation / unresolved explanation |
|---|---|---|
|Before firstproxy|UNAVAILABLE→UNAVAILABLE|No new historical support is invented.|
|Firstproxy|10→11|Qualified Fedyaev binding resolves the one legacy unresolved person; no assignment is supplied.|
|Oct3 12:04|11→11|Legacy Fedyaev is assignment-only/unverified; S10 supplies real scoped operational support. Unresolved1→0; modern confirmed11 vslegacy10.|
|Oct5 beforeactivity|11→11|Seven-day observations still apply while legacy72h expired. Modern confirmed11 vslegacy4; legacy Fedyaev unresolved1→0.|
|Oct5 activity boundary|11→11|Four exact activity subjects resolve and advance selected operational times; legacy unresolved5→0. Modern confirmed11 vslegacy4.|
|Oct6 beforeMenon|10→11|The source capture gap is preserved (no assignments). Modern Fedyaev remains supported by seven-day qualified observation; legacy union loses his assignment-only context. Legacy unresolved5→0.|
|Oct6 Menon boundary|10→11|Same gap; Menon now receives his Oct6 source-specific observation instead of another unresolved report. Legacy unresolved6→0.|
|Departure-1ns|11→11|Future departure cannot remove anyone before its effective minute. All modern eleven still have qualifying positive support.|
|Departureexact/+1ns|11→7|Modern includes the qualified timed departure assertions and V10 vetoes; legacy excludes them and retains four outgoing people. Legacy unresolved6→0.|
|Oct8|11→7|Same four valid vetoes override lagging old structured support. Source reported count is not arithmetically converted into7.|
|Oct9 Delaney before/at|10→7|Legacy now independently lacks Fedyaev but retains stale Meir/Hathaway/Adenot. V10 excludes those three; selected Delaney date advances only at the exact Oct9 boundary. Modern confirmed5 vslegacy4 reflects Menon's new qualified observation; Anna/Dubrov remain members with stale observations.|
|Oct10|10→7|Same three stale outgoing legacy contexts disappear under persistent veto. Seven ACTIVE members remain; selected observation dates are modern scoped facts rather than legacy unresolved activity reports.|

All member addition/removal, count, selected operational date and assignment gaps have the source/policy explanations above. The original raw API bodies plus modern per-field payloads make the differential reviewable. Modern additional membership/policy metadata and restored lastKnownState carry the modern interpretation; canonical identity/profile values remain V7-owned. Orbital source/hash/physical-state selection remains equivalent within the accepted numerical tolerance.

## Current / Historical same-cut agreement

Actual Current revision23 is evaluated at2026-10-11T22:05:07.552306Z, seven ACTIVE/four departed; Replay at that sealed time reconstructs the same seven-member set using the same current committed evidence/policy. The later actual comparison fetched Current at2026-10-11T22:13:24.058728Z and immediately requested Replay at that exact evaluation instant. Canonical UUID/name, assignment, full presence including lastKnownState/asOf/evidence/provenance all compare exactly: zero member semantic differences. Response clocks/mode/projection metadata retain their different documented purpose.

## Test and integration scope

The pure20-check runner passes seven-/fourteen-day inclusive/next-nanosecond boundaries; all event types force-marked eligible yet future-filtered;7→11→7; reentry to8; persistent departure after14d; equal-time ambiguity; historical/current source-health separation; repeated deterministic evaluation. It is explicitly synthetic and does not replace production-path tests.

E’s final twelve-case PostgreSQL suite adds normal source-ingestion coverage for the three implementation corrections: equal-clock Historical with NASA failure; retrievedAtT/completionT+30s with same historical assignment atT/T+5s; editorial-only qualified V7 member with expired prior LL2 support, zero operational facts and no S10 binding. The main agent must confirm this suite and final full backend/API/browser gates. GET write/network/scoring instrumentation and performance are reviewed by G; this agent independently traced the historical call graph and transaction joining, and its own real calls exercised only query paths.

Final B conclusion: the modern Historical path is a read-only evaluation of the same V10 production lifecycle atT, with current-known V7/S10 identity and auditable original knowledge times. Report the real pre-entry evidence gap and avoid any claim of historical truth/completeness beyond retained qualified support.

### Resume audit note

At the parent's post-limit resume, a fresh probe of8081 and8080 returned connection-refused; no backend process was serving either port at that moment. This does not replace or invalidate the twenty-one successful post-fix captures above, and no source change/new semantic regression was found in the read-only source recheck. It prevents claiming an additional HTTP pass after that resume until the primary restarts its owned read-only server. The preserved `unified-10-production-ingestion-pass.log` reports10/10, zero errors/failures/skips; the newly expanded twelve-case run was still pending when B freed its concurrency slot. Primary final acceptance must run the expanded suite and fresh runtime checks.
