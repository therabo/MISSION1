# NASA operational completed-departure validation

Validated on 2026-10-11 against accepted main
`c32d99086bb04cf3f06074fd7ca8b64972343e88`, Java 21, Node 24 and the actual local
PostgreSQL database. This milestone repairs source interpretation and supplies the
existing V10 shadow inputs. Public membership activation remains a separate milestone.
No migration or frontend change is included; V1–V10 remain byte-identical.

## Regression source and the two original defects

The deterministic gzip fixture expands to all 65,347 original research bytes, SHA-256
`312a35ef56856f9081731b0fb505eff999291d134ee1100778951424a712f54c`.
Its metadata records the research capture `2026-10-10T14:09:37.143134Z`.
The researched article is [NASA’s SpaceX Crew-12 Undocks in Dragon for Ride Home](https://www.nasa.gov/blogs/spacestation/2026/10/07/nasas-spacex-crew-12-undocks-in-dragon-for-ride-home/),
RSS GUID `https://www.nasa.gov/?post_type=nasa-blog&p=1054276`, stable article
`nasa.gov:wp:nasa-blog:1054276`. Its first paragraph provides the named undocking.
The authoritative article was also verified during implementation.

Executing the accepted 1.0.0 classes against the exact body reproduces
`MALFORMED_RESPONSE`. Two independent defects are recorded:

- The earlier cargo headline “Cygnus XL Cargo Spacecraft Departing Station Soon on
  NASA+” matched the generic transition-title check and failed with
  `Required operational assertion anchor absent`.
- The named completed undocking paragraph did not match the old “have departed the
  International Space Station” grammar. Its crew-undocking guard failed with
  `Crew undocking requires explicit person-departure subjects`.

The new parser excludes explicitly cargo/prospective headlines from the required
named transition check and accepts the bounded named completion grammar. Unsupported
crew-transition wording still fails closed. Both feed and post parser versions are
1.1.0. Previously supported evidence retains its original 1.0.0 semantic method and
identity rather than acquiring duplicate rows just because the outer parser changed.

## Grammar and time

The new clause is anchored at the beginning of a paragraph: `At h:mm a.m./p.m.
EDT/EST`, optional bounded weekday, agency-qualified person list, `undocked from`
the ISS or a supported ISS port/module, and `aboard` a supported Dragon/Soyuz
spacecraft. Person spelling and source order survive unchanged. Inline HTML is
normalized; captions, quoted paragraphs, unrelated paragraphs and splashdown reports
do not supply departure subjects. The parser performs no identity or profile lookup.

For the researched article, the assertion is `PERSON_DEPARTED_STATION`, `COMPLETED`,
`PARTIAL`; event time is **2026-10-07T12:05:00Z**, source clock **8:05 a.m. EDT**,
zone **America/New_York**, precision **MINUTE**. Seconds `00` represent the beginning
of the supported minute, not source second precision. Publication is independently
**2026-10-07T12:48:02Z**.

The explicitly dated article URL supplies calendar context. Publication's local date
must agree and bounds the completed event; publication is never substituted as the
event instant. An optional weekday selects its single occurrence within the explicit
article-date-minus-six-days through article-date interval. Missing date, conflicting
date, future event, invalid clock and incompatible EDT/EST fail closed. America/New_York
zone rules handle summer/winter, spring gaps and fall overlaps; the explicit
abbreviation disambiguates a repeated fall minute.

The existing event column holds UTC. A bounded, versioned encoding in the existing
150-character evidence-method field preserves local representation, zone, date basis
and precision without schema expansion:

```text
NasaOperationalPostParser/1.1.0|MINUTE|2026-10-07T08:05|8:05 a.m.|EDT|America/New_York|ARTICLE_DATE
```

| Source name | Article locator | Subject index | Actual V9 departure state |
| --- | --- | ---: | --- |
| Jessica Meir | 1054276 / paragraph 0 | 0 | NO_AUTOMATIC_DECISION; unresolved |
| Jack Hathaway | 1054276 / paragraph 0 | 1 | NO_AUTOMATIC_DECISION; unresolved |
| Sophie Adenot | 1054276 / paragraph 0 | 2 | NO_AUTOMATIC_DECISION; unresolved |
| Andrey Fedyaev | 1054276 / paragraph 0 | 3 | NO_AUTOMATIC_DECISION; unresolved |

The second retained article `1053640` has the same four paragraph-0 indices and the
same unresolved identity states. Full occurrence and subject keys are in
[local-results.json](local-results.json). NASA's `Andrey` spelling stays independent
from retained LL2 `Andrei`; no person mapping, merge or forced match is performed.

## Planned, historical and count protection

Fixtures cover will/scheduled/planned/expected/targeting, delayed/cancelled language,
historical/modal/quoted clauses, cargo, vehicle-only movement, arrival, launch,
splashdown and unrelated names. Each creates zero new completed named-departure
assertions. Invalid relevant completed grammar returns `MALFORMED_RESPONSE`; a
supported prospective announcement can be available with zero completed assertions.
`will leave seven` produces no current-count assertion. No subtraction of four,
roster omission, LL2 omission or editorial-count arithmetic is introduced.

## Immutable retained interpretation and real acquisition

The explicit `NasaOperationalReprocessingService` command reads at most 32 retained
operational bodies and invokes the accepted parser/repository write boundary. It
does not run on startup or GET and performs no HTTP, identity scoring or health reset.
The repository rereads and validates the retained bytes and metadata before writing.

Actual local results:

- Ten old 1.0.0 retained body versions reinterpreted successfully; ten new 1.1.0
  interpretation documents 89–98 appended. Zero new raw bodies and zero old-row edits.
- Exact regression old document **52** and failed acquisition **138** remain intact;
  new interpretation **91** links the same body. Retained reprocessing preserves the
  original capture time and keeps the old success/failure health records unchanged.
- Two new completed evidence rows **21** and **27**, two article-scoped assertion
  occurrences, eight subject occurrences/versions and eight subject links appended.
  Evidence 21 first originates in interpretation 90, captured
  `2026-10-07T13:28:55.899560Z`; later bodies including 91 reuse that evidence.
  Evidence 27 first originates in 92, captured `2026-10-07T12:28:49.762252Z`.
- Articles **1054276** and **1053640** independently report the same physical
  undocking at 12:05 UTC. They remain distinct source assertions under V6, rather
  than being counted as two physical departures. Article 1053640 publication is
  `2026-10-07T12:10:34Z`. Same-article metadata republication and A→B→A reuse the
  logical occurrence while retaining distinct evidence versions/observations.
- Existing accepted evidence 1,2,3,12 remains unchanged. New document links and V6
  observations retain the original capture/run lineage, including the old failed
  acquisition that supplied an interpretable retained body. Reinterpretation does
  not fabricate a successful acquisition.
- One normal live adapter acquisition, run **140**, HTTP 200, captured
  `2026-10-11T00:17:25.755257Z`, returned the exact regression hash again. It reused
  interpretation 91 and added zero documents/evidence/raw bodies. ETag
  `"160e59052ee1a5fab52f42f28e383848"`; Last-Modified
  `Sat, 10 Oct 2026 14:37:05 GMT`.
- A fresh-process repeat appended zero documents/evidence, preserved semantic hash
  and projection revision **3**, and made zero provider requests.

Retained interpretation leaves operational health `MALFORMED_RESPONSE`, last success
64, latest failure 138, independently stale. The real successful acquisition changes
operational acquisition health to `AVAILABLE/FRESH`, last success 140; failure 138
remains auditable. This does not refresh the age of an old article assertion. NASA
editorial roster/topic/personal health remains independent and unchanged.

## V9 boundary and V10 result

No V9 decision, feature, model, policy or graph row changes. Graph **8** remains the
selected graph. The normal import notification can coalesce an existing mutable
job; the scoring worker is disabled for this validation. Each of the eight new
departure slots has `NO_AUTOMATIC_DECISION`, no shadow human, decision or observation
binding, and remains explicitly retained/unresolved. An older, different Fedyaev
operational slot remains `AUTO_DEFER`; it is not borrowed as a departure decision.

V10 consumes the accepted evidence through its existing retained-input adapter and
ordinary materialization. Reinterpretation produced revision **2**; normal source
acquisition produced revision **3**. Actual revision 3 has:

| Result | Value |
| --- | ---: |
| ACTIVE humans | 7 |
| RETAINED humans | 4 |
| Resolved departure vetoes | 0 |
| Unresolved departure slots | 8 |
| Total unresolved active / retained slots | 8 / 15 |
| LL2 assignments / editorial slots / resolved editorial support | 7 / 7 / 3 |
| Website reported aboard | 7 |
| Operational official / shadow last-known count | null / null |

ACTIVE: Pyotr Dubrov, Anil Menon, Anna Kikina, Jessica Watkins, Luke Delaney,
Joshua Kutryk, Sergey Teteryatnikov. RETAINED: Jessica Meir, Jack Hathaway,
Sophie Adenot, LL2 Andrei Fedyaev. Seven stays seven because no new departure
subject has a qualifying V9 identity decision and the four corresponding retained
humans already lack fresh positive support. The old operational count eleven becomes
ineligible in shadow following a later explicit transfer, without deriving a new
count from the named subjects. Projection health remains `DEGRADED` for unresolved
and independent source conflicts.

The PostgreSQL integration test uses explicitly **SYNTHETIC TEST** V9 witness evidence
to prove parsed departure → unresolved slot → qualified match → veto of an older
positive/assignment → later qualified reentry. A newer capture alone leaves the
episode closed. Before/exact/after event boundaries and minute precision are tested.
Those synthetic test decisions are never applied to actual local people.

## Public boundary, Replay and protected data

New timed-departure evidence is withheld by the explicit `publicEvidenceAsOf` release
boundary. V10 reads the full accepted set. Current and public Replay retain legacy
membership/identity behavior; no shadow lifecycle, V9 identity or ten-to-seven switch
is activated. Current still returns ten members, seven structured assignments and
one unresolved NASA Andrey subject. Luke/Watkins canonical aliases and independently
retained Meir/Hathaway/Adenot profiles remain addressable.

The required real acquisition legitimately changes existing public acquisition
provenance, freshness and presence labels: resolved-aboard 0→4, last-known
unidentified 11→7, some UNVERIFIED labels become STALE/CONFIRMED_ABOARD. These are
the legacy reconciliation rules responding to source-health recovery, not a new
projection. Operational current count remains null and legacy last-known count
remains eleven. The saved complete HTTP difference ledger records these changes.

At Replay `2026-10-02T02:01:55Z`, ten legacy members and the one unresolved subject
remain; assignments/count stay absent as before. No October 7 departure appears
backward. Existing latest-success metadata and request/coverage clocks can advance;
capture-correct historical freshness activation remains a later milestone. Tiny
cross-process orbital numerical differences are independent of this Crew change.

Read-only SQL fingerprints cover all 70 public tables. Before/after retained
reinterpretation and live acquisition preserve every old immutable row. The final
row audit additionally forbids additions to protected V7/V9, editorial, LL2 and
orbital tables. All old raw source rows and all ten migration file hashes match.
Permitted additions are enumerated in the compact results; mutable changes are the
existing job, projection-work and NASA-budget bookkeeping only.

The initial browser warm-up invoked the existing two-hour OEM refresh and changed
one OEM retrieval-metadata row. The first overlapping GET audit therefore failed;
it is not counted as a pass. Orbital implementation remains unchanged, all five
retained XML payloads verify against their SHA keys, and the refresh is separately
reported by an explicit audit option. Subsequent first/final GET audits both pass
with all 70 table fingerprints identical across their requests. Java Flight Recorder
socket I/O during final GETs records only loopback HTTP/PostgreSQL addresses, with
zero external addresses. This validates Crew/detail/Replay GETs after normal orbital
cache initialization; it does not change the pre-existing orbital first-use policy.

## Verification and performance

Baseline backend `mvn test` and `mvn verify`: **900** each. Final Java 21 runs:
**935** each, zero failures/errors/skips. Added coverage comprises 31 bounded parser
cases, three PostgreSQL immutable-reinterpretation/version tests and one PostgreSQL
identity/membership lifecycle integration test. Existing API source-mock guards,
canonical identity, profiles, V6, V9, V10 and Replay regressions pass.

Frontend **759 tests / 61 files**, typecheck and production build pass. The build
retains its existing Cesium chunk-size warning. `git diff --check` passes. Browser
development and production Current/Historical/detail checks cover 1440×900, 1024×768,
768×1024, 390×844 and 320×568, plus resize/container/touch behavior. GP and OEM
Inspection enter/return checks cover the same five sizes on both builds. No console
or page errors; desktop/mobile screenshots visually inspected. Physical mobile
devices are not covered by this headless Chromium run.

Measured local timings (validation instrumentation included): full retained feed
median **5.624 ms**, departure item median **0.124 ms**, first ten-document
reinterpretation **1607.187 ms** (319 prepared statements, 145 SELECTs), normal live
command **735.526 ms** (28 statements), downstream V10 **153.605 ms** (28 statements,
20 SELECTs). First reinterpretation batches eight subjects in two assertion writes,
without a per-subject lookup loop. A contended fresh-process repeat took **8911.259 ms**
while full verify/browser QA ran concurrently; it added nothing. Retained
reinterpretation and shadow materialization perform **zero provider requests**.

## Reproduction and artifacts

The explicit command and disabled-worker configuration are documented in the
[backend README](../../../backend/README.md). Run the retained command first;
`--live` is the deliberate one-normal-acquisition option. The
[row audit](scripts/row-audit.py) uses repeatable-read, read-only PostgreSQL snapshots.
The `--allow-orbital-qa-refresh` option is only for recording the independently
observed single existing OEM metadata refresh; ordinary Crew runs use strict mode.

[local-results.json](local-results.json) and [validation-summary.json](validation-summary.json)
retain compact actual results and SHA-256 manifests. Complete raw reports, HTTP
snapshots, SQL ledgers, JFR and screenshots remain outside Git at
`/Users/daniel/.codex/exports/mission1-nasa-operational-departure-validation/`;
the original research capture remains in its investigation directory. The gzip
fixture and its metadata are retained under backend test resources.

ADR-0009 owns the clarified operational semantics; its dated update and ADR index
preserve the V6/V9/V10 boundaries. Source, domain, persistence, NASA verification and
shadow lifecycle documentation link this dossier. External project context stays
outside Git. Next milestone: explicitly activate the validated identity/membership
projection for production Current, with a separate capture-correct Replay decision.
Remaining grammar coverage is deliberately narrow: unsupported port/vehicle,
undated/ambiguous time and unknown crew-transition phrasing remain fail-closed.
