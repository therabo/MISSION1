# Second empty-store run and recovery

This is a separately identified, repeated experiment using the same immutable
backend artifact as the pristine run. It is a secondary compatibility/failure
profile, not a second measurement of the unmodified primary scheduler latency.

## Isolation and empty state

T0 is **2026-10-13 08:49:12.820905 UTC**. The first test's owned resources were
deleted after its final snapshots. The new project is
`mission1-cleanroom-20261013084910-38cb57`; the database is
`mission1_cleanroom_af84f0c250`. Its PostgreSQL container, named volume and
network are new. Ports are 55433 for PostgreSQL, 18081 for the backend and 14176
for the frontend. There is no connection to the first or canonical database.

Before the JVM, public tables and Flyway history are absent. Normal startup again
creates exactly the same explained 47 rows. V1–V12 apply in order with the same
checksums; Flyway execution takes 0.418 s, schema completion T0+2.214 s and Spring
HTTP readiness T0+3.355 s. Both runs use artifact SHA-256
`2bb317da709032c2985470b67ba67763e547cf1f96643cc568d0bb389a09382d`.
Fresh browser contexts again start with zero application storage.

## Explicit secondary profile

The JVM uses maintained Corretto 21.0.12.1 with TLS 1.2, the normal vendor trust
store and hostname validation. LL2/NASA fixed delays are one hour, their supported
minimum. Initial delays, identity gates, source URLs, authority modes, request
budgets and the CelesTrak 2h10m interval are unchanged. The event-aware one-minute
eligibility coordinator still controls source admission and durable cooldowns.

An owned loopback CONNECT proxy rejects LL2/NASA transport for twelve minutes,
CSA for 35 minutes and the first CelesTrak attempt through a finite 150-minute
window. It tunnels all admitted encrypted traffic unchanged; it neither decrypts
TLS nor supplies a provider response. CONNECT rejection is a local transport
fault, not an upstream HTTP status. Only the isolated JVM is proxy-configured.

The proxy was restarted at 09:26 UTC to add the CelesTrak fault; its original
08:49:10 UTC fault clock was explicitly preserved. This does not change the
application clock or invoke application workers.

## Partial-bootstrap restart

LL2 fails at 08:54:16 UTC and NASA RSS at 08:59:16 UTC, both NETWORK_ERROR with
null upstream status, no successful capture, no document and no human. Current
returns HTTP 503. The owned backend restarts at 09:02:11 UTC, before convergence.
Every table hash and Flyway row remains identical; both failure records, four
pending reviewed versions and 26 reviewed proof rows survive without duplication.

Normal cooldown prevents an immediate retry. V8 independently acquires eighteen
NASA resources/captures at 09:17 UTC; the LL2 planning catalog succeeds too.
Without V7 targets, early V10 state cannot publish Current and HTTP 503 remains
truthful. LL2 recovers automatically at 09:54:37.602623 UTC, creating seven source
humans. Current projection 3 commits at 09:55:17 UTC and is observed as HTTP 200
at 09:55:19 UTC. NASA RSS recovers at 09:59:38.998293 UTC. No stage or repair endpoint
was manually invoked.

## Later convergence

S10 first consumes source-qualified identities at **13:27:59.441085 UTC**, or
**T0+4h38m46.620s**. The six MATCH heads cover five existing people; four departing
subjects DEFER and zero CONFLICT is recorded. The extra MATCH relative to the
pristine run is Joshua's normally acquired CSA witness. Model, policy, thresholds
and authority are identical; this is a source-availability difference, not a
different identity rule. V10 revision 28 at 13:28:38 UTC consumes the qualified
heads without manual dispatch.

Current's shared typed LL2 provider roster matches both the first run and mature
Current. It reports seven ACTIVE, zero RETAINED, two fresh presence confirmations,
seven assignments, seven unresolved active source slots, zero non-publishable
active humans and zero canonical collisions. Health remains DEGRADED.

| Requested UTC | Second fresh resolved members | Mature resolved members |
|---|---:|---:|
| Oct 2 02:01:54 | 0 | 0 |
| Oct 2 02:01:55 | 0 | 11 |
| Oct 3 10:30:18.796289 | 0 | 11 |
| Oct 5 17:18:04 | 4 | 11 |
| Oct 7 12:04:59 | 5 | 11 |
| Oct 7 12:05:00 and +1 s | 5 | 7 |
| Oct 10 12:00 | 5 | 7 |
| Contemporary qualified cut | 7 | 7 |

The source-discovery and historical-capture classifications from the first run
still apply. Joshua's source-qualified October 5 observation explains the extra
resolved person. Anna/Pyotr's entry evidence and four outgoing targets remain
missing; no 11→7 timeline is manufactured.

CSA recovers normally at 11:47:47.896941 UTC, with HTTP 200 and typed agency-person
facts. The repeated JVM uses its normal vendor trust store/hostname checks.
NASA personal pages for Jessica Meir and Jack Hathaway are captured successfully
at 11:37:45 and 11:42:46 UTC; outgoing V7 anchors nevertheless remain absent.

The first CelesTrak CONNECT failure occurs at 11:12:13 UTC with NETWORK_ERROR and
null upstream status. No TLE is persisted and Orbit stays HTTP 503. Current remains
seven source-supported members. At 13:22:13.559 UTC the fixed-delay tick checks
377.466 ms before its UTC eligibility deadline, 13:22:13.936466 UTC, and skips an
entire 2h10m tick. This repeats the first-run near-boundary scheduling defect and
is not another transport/HTTP failure. The next ordinary tick is around 15:32 UTC.
No manual fetch, clock adjustment or weakened provider interval is used.

## Deliberate skip, remaining checks and cleanup

At 14:03 UTC the user asked to skip the long outstanding verification and continue
with the others. The ordinary 15:32 GP retry was not observed. No second GP/TLE,
OEM, Earth/Inspection/Reset/source-switch success is claimed; those actual paths
already passed in the pristine run. Second Orbit state/samples remain HTTP 503,
with zero element sets/OEM rows. Their fast no-data responses are not propagation
performance measurements.

After qualification, fresh desktop/mobile Current/detail/Data source/Historical-now
browser checks pass with seven actual second-run IDs, zero errors/overflow and
zero canonical API contacts. Historical API comparisons preserve the partial
counts above. The calendar truthfully refuses seeks without orbital coverage.

Twenty warmed worker-enabled measurements return HTTP 200: Current median/p95
36.70/45.89 ms, detail 29.59/33.26 ms, Historical plus embedded detail 23.44/26.55 ms.
The normal owned JVM/frontend/monitor are then stopped. A separate instrumented
process with the same immutable classes, Flyway/startup writers/workers disabled
performs 142 measured GETs plus 30 warmups. All 80 tables remain identical;
read-only SELECTs, external HTTP/source acquisition, S10/V9 scoring and V10
materialization counters prove zero side effects. This complements the initial
pre-qualification audit.

Final persistence: 4,835 rows; 14,114,816 relation bytes; 24,220,131 database bytes.
V9: 58 observations, 20 candidate records, 76 decisions. S10: 19 successful resource
versions, 25 attempts, 31 queue URLs, 160 revisions, 460 candidate children and
158 proof children. Latest heads stay six MATCH/four DEFER, with no new revisions
on unchanged reevaluations. V10 ends at 30 revisions, seven ACTIVE/zero RETAINED,
zero departure vetoes and seven unresolved active slots. Both own rolling-hour
source budgets are checked from actual permit rows.

After the GET context closes, exact container ID, project labels and exclusive
network membership are checked again. The deletion list is printed; only the
second container, network and named volume are removed individually. The owned
fault proxy is separately stopped after verifying its PID/command. Final canonical
fingerprints and resource identities prove preservation. Full repeated bootstrap
acceptance is not claimed; repeated Current/S10 is proven and the skipped Orbital
case remains explicit.
