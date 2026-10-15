# Periodic retained telemetry reconciliation validation

Implementation from clean `e9ba5691149fc6222b9713006bdadff6a6dfe897`, 2026-10-15.
[ADR-0025](../adr/0025-periodic-retained-telemetry-reconciliation.md) explicitly
supersedes the previous bootstrap-only acquisition policy. Native push, the
131-definition catalog (96 engineering/state,35 raw-only), provider comparability,
Historical and the complete frontend remain unchanged.

## Deterministic evidence

`RetainedReconciliationTest` uses a controlled Clock and the production deadline
abstraction, actual local HTTP adapters, normalizer/admission, Testcontainers
PostgreSQL16.10 and the normal REST controller. There are no real 30-minute sleeps
or network-dependent ordinary tests. Cases cover:

- Successful bootstrap A/R1, same-process provider change B/R2, eligible scheduled
  discovery, immutable insertion/head/REST and actual reconciliation provenance.
- Same value/new qualified time for both providers, repeated identical records,
  older records preserving newer heads, and unchanged history boundaries.
- Fresh zero-record and partial bootstrap, no immediate duplicate fetch, later
  discovery despite completed bootstrap state.
- Restart at 5 minutes preserves eligibility; at 31 minutes runs once. Existing
  completed/failed bootstrap initializes durable state without rewriting evidence.
- Failure deadlines 60/120/240/360 minutes, cap 6 hours, success reset 30 minutes;
  each provider fails independently while the other remains available.
- Two independent repository owners, an overdue slow claim, bootstrap overlap,
  interrupted ownership and restart pacing; repeated lifecycle/wakeups/close.
- Future SenseData responses succeed as acquisitions while dates remain unchanged
  and excluded. Immutable identity rejection survives restart/clock catch-up and
  formatting/status amendments, with no duplicate physical observations.
- A bounded 6300-record event alongside native queue work: blocked source I/O does
  not block the worker; concurrent batches retain bounded queue responsiveness.
  No priority subsystem is introduced.

The existing PostgreSQL suite still covers conflict, incomparable records,
cross-provider rounding, rank/chronology, raw-only units, all 131 definitions,
immutability and GET purity. Public V1/V2 checksums remain -1371784637/1338977865.
V3 starts with zero coordination/rejection/observation rows and validates normally.
Crew/Orbit integration assertions now expect three migrations; their domain-schema
and behavior checks are unchanged. The frozen V1 publication test is unchanged.

## Browser and runtime evidence

The external TEST_ONLY harness activates the actual readiness listener, production
Lightstreamer SDK 131-item subscription, real retained HTTP source and JDBC/controller.
The browser imports unchanged useModuleTelemetry/ModuleInfo/ContextDock, with its
ordinary serial 60-second Current refresh. Provider changes are discovered only
through controlled scheduler eligibility; the browser performs only normal reads.
Historical remains fixed with no Current polling leakage. Desktop/mobile screenshots
show the existing card, explicitly labeled TEST_ONLY. Synthetic data is confined to
a separately owned test database and never enters the canonical installation.

Full logs, source schema capture, typed database snapshots, scheduler traces,
performance observations and screenshots are outside Git under:
`/Users/daniel/.codex/exports/mission1-retained-reconciliation-2026-10-15`.
The detailed report distinguishes deterministic capability from actually observed
public-provider changes. No source SLA, lossless queue or authenticated calendar
lineage is claimed.

## Public default-cadence cycle, 2026-10-15

The canonical application acquired overdue retained data automatically at
09:16 UTC. A final deployment at 09:45:46 UTC preserved both original nextEligibleAt
values and made no immediate retained request. The definitive artifact then ran:

| Provider | Scheduled UTC | Started UTC | Completed UTC | Next eligible UTC |
| --- | --- | --- | --- | --- |
| SenseData | 09:46:16.037211 | 09:46:16.060267 | 09:46:17.687842 | 10:16:17.687842 |
| ISS.live | 09:46:24.169452 | 09:46:24.178639 | 09:46:28.282676 | 10:16:28.282676 |

Both completed successfully, 1800.023/1800.009 seconds after their prior successes.
No manual trigger, interval override, provider-state edit or test input was used.
SenseData fetched 7644 records/416594 bytes, mapped 782 and rejected 782 future dates;
ISS.live fetched 21/5264 bytes, all duplicates. Neither pass advanced a head. This
proves autonomous public-source checking, not a new observed onboard measurement.
The 740 distinct future rejection identities remain excluded and immutable.

Wake-to-start 23.06/9.19 ms; full passes 1627.58/4104.04 ms. SenseData fetch 920.61 ms
(including streaming read/parse 188.46 ms) and JDBC/admission 619.19 ms; ISS.live
fetch 4057.03 ms, parse 5.47 ms and JDBC 21.22 ms. Local REST after the pass: median 4.92 ms,
p95 7.66 ms/25 reads. Actual SDK callback during 6300 TEST_ONLY retained records:
46.21 ms to head, 0 drop; separate SenseData 503/native proof 188.13 ms,0 drop and 0
owned telemetry threads after close. These are local observations, not SLAs.

Canonical 1649 records and 1649 admissions remain unchanged; 1492→1528 acquisitions
and 2042→2346 evidence append without changing/removing any original typed row.
Bootstrap history remains identical. Native connected/subscribed 131 items;
Crew/Orbit HTTP 200 after the cycle. No fake observations or date advancement.
Calendar input beyond year 9999 is rejected as an unsupported codec representation,
including before rejection persistence; a malformed extreme date does not fail a pass.
The SenseData 2027 ambiguity is unchanged. Final Java21 mvn test and mvn verify each pass 1517 tests with zero failures,
errors or skips. Node24 frontend passes 861 tests in 72 files, typecheck and
production build; the existing Cesium chunk-size warning remains. The final
506 classes/resources match the active immutable jar byte-for-byte.
