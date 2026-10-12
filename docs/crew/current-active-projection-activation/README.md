# Production Current Crew activation — ADR-0017

Canonical repository `/Users/daniel/Desktop/MISSION1`, direct `main`, starting commit
`f0f3dc706a0fd15480050d00608cb3814a8ebc12`. Acceptance: 2026-10-11 Europe/Rome.
[ADR-0017](../../adr/0017-production-current-active-membership.md) was written before implementation.
This activates membership only; V1–V10 migration bytes, source/parsers, V9 model/policy,
production identity declarations, orbital code and historical selectors are unchanged.
[Compact retained results](local-results.json) and [validation summary](validation-summary.json)
are tracked; complete JSON/SQL/HTTP/JFR/log/PNG evidence stays outside Git under
`/Users/daniel/.codex/exports/mission1-current-active-projection-activation/`.

## Publication and configuration

The read-only Current composition now selects V10 ACTIVE humans, then requests their
profiles in one batch through production V7 canonical knowledge. Membership authority
and identity authority are separate. V9 graph associations qualify V10 supports;
V9 representatives/automatic decisions never publish public UUIDs or write V7.
Retained LL2 provider ownership is checked independently. A non-publishable ACTIVE
anchor remains internal and increments a diagnostic; canonical collisions yield one
card plus a diagnostic. Neither path invents an identity or silently promotes shadow.

`MISSION1_CREW_CURRENT_MEMBERSHIP_MODE` defaults to `ACTIVE_PROJECTION`.
For deliberate rollback use `LEGACY_RETAINED_UNION` and restart; clear that override
and restart to reactivate. The equivalent Spring property is
`mission1.crew.current.membership-mode`. There is no automatic fallback, schema
reversal, data deletion, code revert or manual SQL operation. Actual fresh-process
reads return **7** in ACTIVE mode versus **10** in explicit legacy mode; rollback
also restores the one legacy unresolved Andrey report. Default behavior is ACTIVE.

## Compatibility, availability and freshness

`JdbcActiveMembershipReader` performs one set-based SELECT inside the existing
read-only repeatable-read transaction. It validates the configured lifecycle policy,
supported V10 identity mode/model, both original serialized SHA-256 hashes and JSON
agreement, exact relational cut pins, member/support/slot payloads and typed fields,
evidence/finding/capture completeness, counts and ACTIVE eligible support. Flyway
validates the unchanged ten migrations at startup. Latest committed revision selection
never skips an incompatible newest revision to resurrect an older result.

Missing, incompatible, corrupt/incomplete, unreadable model or future/UNAVAILABLE
projection yields a scoped `503` ProblemDetail; no member payload, legacy fallback or
claim of an empty physical station. Other Crew/detail/Expedition/orbital routes remain
independently available. HEALTHY/DEGRADED committed classifications can be served as
retained materialized state, with evaluation/age and independent request-time source
freshness. GET adds no TTL, source fetch, lifecycle evaluation or materialization.
The existing background worker owns source/expiry revisions; if it commits UNAVAILABLE,
Current returns 503. A committed N+1 revision is visible on the next request without
restart or an in-memory membership cache.

At this acceptance, source captures have aged since the previous milestone. Projection
3 still records its original evaluation; public structured/operational source freshness
is **STALE**. The seven-member response is explicitly retained classification, not a
fresh source acquisition or confirmation of physical occupancy. Testing does not
refresh source captures or fake the clock to keep seven.

Bounded change/failure logs and optional response diagnostics expose mode, revision,
member count, evaluation age, projection health, non-publication and collisions.
Biographies are not logged. Projection degradation does not mark orbital readiness down.

## Actual retained result

Projection **3**, evaluated **2026-10-11T00:17:26.156499Z**, health **DEGRADED**;
policy `crew-active-shadow-v1/crew-freshness-v1:PT6H:PT6H:PT72H:PT336H/roster=PT6H/topic=PT6H/personal=PT168H`.
Selected LL2 run137/snapshot57, editorial roster1/acquisition28, topic acquisition27/fact2,
V9 graph8, operational run/attempt140. Exact cut hashes/pins are in the JSON result.
Non-publishable active anchors **0**, canonical collisions **0**.

| Public member | Production canonical UUID | LL2 assignment |
| --- | --- | --- |
| Anna Kikina | 8036ce99-4648-40d8-9aa7-2956ddefaa91 | Flight Engineer |
| Anil Menon | 0aa26f8e-38e0-495d-b9a2-ced538c9e726 | Flight Engineer |
| Pyotr Dubrov | 6e32c904-e487-40ef-b9fc-089cf33eb216 | Commander |
| Jessica Watkins | 6e700f29-14ab-415a-87e4-6567860c1796 | Flight Engineer |
| Luke Delaney | 09dea926-7480-4fc5-a340-01d44a6e5dae | Flight Engineer |
| Joshua Kutryk | 345d3c45-c57a-4bcf-b3d6-ea811ba55416 | Flight Engineer |
| Sergey Teteryatnikov | 3e128b74-27e9-4cd5-acf2-bb76910dbe30 | Flight Engineer |

API order follows the existing structured assignment sequence, with canonical UUID
fallback for visitors. Existing UI grouping is preserved. All seven retain source
assignment roles/null validity, canonical profiles and media rights; no fabricated
portrait, career, biography, agency or nationality appears. Eleven canonical detail
responses compare byte-for-field with baseline after removing only the request evaluation
clock. Luke alias `9cd14c46-8b34-41b7-9fec-5ea736fa974b` and Watkins alias
`b4932ff9-75e7-4eb4-b8c1-0362acb27356` return the established canonical IDs and profiles.

Jessica Meir, Jack Hathaway and Sophie Adenot are removed from the prior ten-member
Current union because V10 classifies them RETAINED without eligible positive support.
Their detail/profile/history remain preserved. LL2 Andrei Fedyaev is also RETAINED and
addressable, already absent from the prior resolved Current union. NASA Andrey mentions
remain distinct unresolved source slots: the older occurrence is AUTO_DEFER; all eight
new departure subjects retain NO_AUTOMATIC_DECISION. No forced merge, new UUID, scoring
or departure-identity weakening occurs. Parser1.1.0 evidence21/27 remains immutable.

| Dimension | Actual value |
| --- | ---: |
| Published Current canonical humans | 7 |
| LL2 assignments | 7 |
| NASA editorial roster slots / resolved editorial supports | 7 / 3 |
| NASA website editorial reported aboard | 7, internal independent context |
| Public operational official / last-known aboard | null / 11 |
| Existing operational confirmed identities / unidentified count gap | 0 / 11 |
| Unresolved ACTIVE / RETAINED source slots | 8 / 15 |
| Raw public Current unresolvedSubjects | 0 |
| V10 operational official / V10 last-known count | null / null |

The public last-known eleven retains the established operational reconciliation semantics;
V10's independent shadow count cut does not replace it. Eight ACTIVE source slots are four
editorial and four operational positive mentions. Fifteen retained slots include the eight
new completed-departure subjects. Detailed slots remain internal and have no public UUIDs;
they do not add cards or humans. Source counts need not certify identical human sets.

## API and frontend boundary

Existing fields remain structurally compatible. The optional Current-only `membership`
object exposes mode/revision/evaluation/policy/health/age and publication/source-slot
cardinalities; it is omitted in rollback and unchanged Historical/Replay JSON. Public
`members` changes inclusion semantics, and raw historical unresolved reports are removed
from default Current. Operational presence, official/last-known counts, provenance and
source freshness retain their existing authority and calculations.

Current displays seven members separately from reported aboard and confirmed physical
presence. The consumer does not match identities, filter by names or request public sources.
Retained direct UUID detail remains independent of membership. Responsive behavior stays
roster → detail-only at Crew container≤716px and roster+detail above it; keyboard/touch,
focus restoration, scroll preservation, resizing and existing source presentation remain.

Historical/Replay at **2026-10-02T02:01:55Z** stays **ten members/one unresolved Andrey**,
with no future Expedition/assignment/departure. Full differential contains only four
coverage-end request clocks after evaluation/reconstruction clocks are excluded; no
orbital numeric delta. Public Replay never consults latest V10 membership.

## Verification and read audit

Java21 baseline: `mvn test` **935**, `mvn verify` **935**, no failures/errors/skips.
Final: **958** each. Added 16 Testcontainers production-read cases and seven corrupt/read
boundary cases. PostgreSQL16.10 covers ACTIVE reads, LL2 independence from NASA/V9,
qualified NASA support despite LL2 omission, operational visitor/departure/reentry,
canonical alias/collision, shadow-only non-publication, missing/incompatible/incomplete/
corrupt/future/UNAVAILABLE state, aged retained classification, revision N→N+1,
ACTIVE→RETAINED→ACTIVE, restart/explicit rollback, retained detail and all-table GET fingerprints.
Existing V7/V9/V10/Replay/alias/source-mock regressions pass. Minimal shared V10 fixture
metadata was completed so the same source-derived fixtures exercise the full public API.

Node24 frontend **759/61 baseline → 764/62 final**, typecheck and production build pass.
The existing Cesium chunk-size warning remains. Five added cases cover optional metadata,
independent counts, invalid successful health, seven Current cards and Historical isolation.
No mechanical ten-to-seven replacement is made in historical or legacy fixtures.

Development and production each pass Current/Historical at **1440×900,1024×768,768×1024,
390×844,320×568**, plus22 resize/8 container cases and keyboard/touch/reduced-motion flows.
Additional profile QA covers all **70** seven-person/build/viewport selections and eight
retained direct detail reads. Inspection covers **20** GP/TLE and NASA OEM enter/back
cases across both builds/five sizes. All reports have zero page/console errors. Desktop
and mobile screenshots were visually inspected; physical mobile browsers are not covered.

Actual Current/all-eleven detail/Luke+Watkins alias/Replay GETs compare all **70** table
fingerprints before/after, unchanged. JFR at zero socket thresholds records2061 socket
events initially and 2031 socket events in a separate final-process recording, all127.0.0.1 HTTP/PostgreSQL, zero TLS/external addresses. GET writes **0**,
V9 evaluations **0**, V10 materializations **0**, provider calls **0**. Fresh ACTIVE and
explicit rollback processes read persisted results without source acquisition or writes.

A separate existing orbital browser warm-up revalidated one mutable NASA OEM retrieval
metadata row. The full protected-row audit against the previous accepted milestone allows
only that recorded one-row update: all Crew/source/identity/reconciliation/V9/V10 rows,
ten migration hashes and five SHA-verified XML payloads remain unchanged. This orbital
cache side effect is separate from passing Crew GET audits, not omitted from the ledger.
The first full-test attempt ended in Surefire's fork shutdown handshake (553 tests completed,
no assertions failed); that failed attempt is retained outside Git. Complete reruns pass.

## Performance and reproduction

Actual read-only JDBC instrumentation, 10 warm-ups +100 reads per deliberate mode:

| Mode | SELECTs | Read median | Serialization median | JSON bytes |
| --- | ---: | ---: | ---: | ---: |
| ACTIVE_PROJECTION | 53 | 39.483ms | 0.381ms | 56,216 |
| LEGACY_RETAINED_UNION | 52 | 28.402ms | 0.455ms | 74,480 |

One set-based sealed-projection validation query is added; profiles remain batched.
No per-member SQL/N+1, scoring, lazy profile fetch or network is introduced. The serialized
response is24.5% smaller. These local measurements include instrumentation and concurrent
validation load; they are not a deployment SLA. The final failure-boundary tightening does
not change successful SQL/representation; a final repeat confirms the same query counts.

Run Java21 `mvn test`, `mvn verify`, Node24 tests/typecheck/build and `git diff --check`.
[CurrentReadValidation.java](scripts/CurrentReadValidation.java) starts a source-isolated
read-only context with the deliberate mode argument and absolute output path; use final
classes plus the Maven dependency classpath. It never invokes the materializer.
[readonly-smoke.py](scripts/readonly-smoke.py) validates this captured acceptance dataset,
all details/aliases and Replay through actual HTTP. [Browser navigation](scripts/browser-navigation.cjs)
and [all-profile matrix](scripts/browser-profiles.cjs) use real transported API bodies;
they do not substitute fixtures. Use `MISSION1_QA_BACKEND`, `MISSION1_QA_OUTPUT` and
Node24. Raw full logs and JSON remain outside Git; compact hash manifests are tracked.

The work is one ordinary commit on main, followed by authenticated normal SSH push and
local/origin/direct-GitHub equality verification. Final commit identity is recorded in the
external Git acceptance artifact and project context; this dossier avoids a self-referential
commit hash. Temporary QA services are stopped after validation; original5175/PostgreSQL remain.

## Subsequent Current presentation contract — ADR-0018

The activation acceptance numbers and captures above remain historical records. The
[Current semantic cleanup](../current-ui-semantic-cleanup/README.md) removes the Reported aboard and unidentified-gap
headlines and their Current-only DTO fields; operational count evidence/history remains
preserved. Current still uses V10 ACTIVE + V7, while V9 stays shadow. Historical/Replay
retains the previous count/report contract. The normal trial instance refreshed source
cuts before that cleanup: projection7 still has seven humans and8/15 ACTIVE/retained slots;
the operational gap changed from11−0 to11−4. That gap is not an unidentified-human count.

## Subsequent unified production architecture — 2026-10-12

[ADR-0021](../../adr/0021-production-operational-binding-and-unified-crew-replay.md) and [final validation](../final-crew-architecture-validation/README.md) activate S10 scoped operational bindings and the shared V10 Current/Historical lifecycle. V7 remains canonical; V9 general identity remains SHADOW. The earlier accepted capture and read-isolation results below retain their dated meaning. Historical now evaluates seven-day observations at T without backdating structured/editorial capture; clean-room empty-database bootstrap validation is the next separate milestone.
