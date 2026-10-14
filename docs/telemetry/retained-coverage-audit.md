# Retained telemetry coverage correction and audit

Verified: 2026-10-14. Starting revision: `da1b33f6466efc2a8982bad81231db7b89a3b20a`.
This is a corrective acquisition/mapping milestone. No power dashboard, UI redesign,
new service, catalog activation, timestamp reinterpretation or schema migration.
Public V1 and telemetry V2 remain byte-identical to the starting revision.

## Defect and provider contract

The former HTTP path accumulated the entire SSE data line and event, rejecting it
above 262,144 bytes. The adapter then limited the array to 512 records. Both limits
assumed a sparse latest-only response. The pinned SenseData server actually sends
one initial backfill array, followed by live events. Its 138-channel dictionary and
150-record per-channel rings permit up to 20,700 records; the backfill window is 450
seconds or a single latest record when no row meets that lower time boundary.

The initial investigation captured 395,853 bytes / 7,288 records. The exact subsequent
isolated application acquisition contained **410,860 bytes / 7,543 records**, 138 raw
IDs and at most 150 records per ID. The changing count is public buffer state, not
an expected hard-coded fixture count. Both legitimate stream shapes exceed the old
size and array limits. Source timestamps are still independently qualified.

First-party pinned references:
[server/framing](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/create-server.ts),
[buffer/backfill](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/buffer.ts),
[persistence/seed](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/persist.ts)
and [year inference](https://github.com/sensedata/space-telemetry/blob/1134b02f89bf6981091fa98a5c1b8e6b6cc34144/src/server/feed-time-to-unix.ts).
Original k/v/t/s remain raw ID/value/provider reconstructed Unix date/status; vm is
a mean and STATUS describes the provider process. Disk/seed versus replay source
mode is not exposed by these records. Neither deployment mode nor NASA sampling
time is inferred from connectivity.

## Bounded implementation and performance

The HTTP client now hands the response InputStream to an incremental SSE framer and
Jackson token parser. It never accumulates a complete data line/event tree. It closes
after the first complete records event, with no ongoing subscription to SenseData.
Only relevant bounded tuples remain until the complete event is verified; syntax,
truncation and hard-bound failures persist no partial observations. Malformed item
fields within token bounds are excluded/countable while other valid rows continue.

Defaults: 4 MiB framed bytes, 20,700 records, 15-second connection/header timeout and
30-second streamed-bootstrap deadline. Configurable ceilings: 8 MiB / 50,550 records,
bootstrap deadline 60 seconds. Framing headers are at most 256 bytes, field names 64,
preamble 16 KiB within the overall budget, nesting depth eight, number tokens 128,
decoded string tokens 1,024, relevant field values 128 characters and fields 16 per
record. Buffering is 4 KiB transport read-ahead plus Jackson's bounded token/input
buffers and at most the configured count of relevant tuples; excluded station-wide,
blocked, control and status tuples are not retained in that list. No unbounded stream
or JSON array tree is retained. The unchanged lineage guard also bounds canonical
numeric expansion before hashing malformed exponent input.

Exact isolated acquisition: event consumption/parsing **103.08 ms**, JDBC transactions
**38.20 ms**. The latter stores 12 bounded acquisition entries and zero SenseData
observations because every component date was rejected by the existing policy.
These are local measurements, not native throughput or an SLA. The external network
copy observer recorded exactly 410,860 bytes with zero read-ahead in this run; normal
framer read-ahead remains bounded at 4 KiB. It copied actual bytes without replacing
responses or supplying observations.

## Complete registry and binding audit

All 131 component definitions match an independent projection of the final research
qualified catalog: 96 engineering/state and 35 raw-only. The comparison checks raw ID,
semantic ID, component, category, labels, type, unit policy, exact enum mapping,
association notes, rounding, ISS.live key and cross-provider chronology qualification.
CSV/JSON partitions, enums, model/component inventories and cross-source/unbound
bindings were re-read. There are no wrong/missing component mappings, duplicate raw
or semantic identifiers, aliases, provider key typos, case/whitespace repairs or
prefix-based fallbacks. All 89 global blocked IDs and both controls remain excluded;
nine blocked definitions have selectable component associations.

The metadata-only source-scope index classifies 115 qualified station-system IDs and
controls without adding operational module definitions. RUSSEG000016/018/019 map to
Zarya/Rassvet/Poisk; 001–015 and 020–025 to Zvezda; 017 stays blocked. Quest retains
all AIRLOCK001–058 except blocked 054 (57 definitions), including the early family.
NODE3000020 remains qualified. Destiny has only its 25 reviewed definitions; other
USLAB station/GNC/communication identifiers are not assigned by prefix.

All 21 implemented ISS.live bindings match the explicit researched bindings and
cross-source comparisons. The two unresolved electrical keys remain quarantined.
Only the 21 qualified requested records were returned in this acquisition; there
were no unexpected, unrequested, blocked or unresolved ISS.live rows to discard.

## Actual pipeline reconciliation

| Stage | SenseData | ISS.live |
| --- | ---: | ---: |
| Provider array records fetched/parsed | 7,543 | 21 |
| Qualified component raw/key matches | 741 | 21 |
| Malformed / unbound component matches | 0 / 0 | 0 / 0 |
| Normalized dated eligible representations | 0 | 21 |
| Original future dates rejected | 741 | 0 |
| New immutable records persisted/admitted | 0 / 0 | 21 / 21 |
| Duplicate / cross-provider corroboration / conflict | 0 / 0 / 0 | 0 / 0 / 0 |
| Selected SQL heads | 0 | 21 |
| Component REST values | 0 | 21 |
| Rendered UI readings, including technical raw detail | 0 | 21 |

The SenseData partition reconciles exactly: 741 component, 4,049 qualified station
system, 2,602 blocked, 150 excluded control, one provider STATUS, zero unknown.
Every component input is traced by raw ID, semantic ID, component, original value,
original time and rejection. All 741 dates are in February 2027, beyond receipt+120
seconds. They are not rewritten to an earlier year or replaced by receipt. There are
42 distinct component IDs in that SenseData cohort, plus five additional distinct
parameters from ISS.live, for 47 distinct parameters observed across both providers.

The earlier 63-representation/47-head validation observed one retained September
record per relevant SenseData channel. Current SenseData backfill has changed to
multiple future-dated records; its component entries are now ineligible. This
explains why the same 47 observed parameter identities currently yield only 21
qualified dated heads. The streaming defect is corrected; no valid eligible row
is lost at mapping, parsing, persistence, SQL selection, REST grouping or UI decoding.

## All 14 component cards

Inputs below count provider-returned component tuples, including future-date policy
exclusions. Observed counts distinct semantic parameters. Admitted/REST/UI are dated
heads; missing counts supported definitions with no selected value. `P` means
REAL_RECORD_BLOCKED_BY_POLICY (future provider date), `N` means
SUPPORTED_DEFINITION_NO_REAL_RECORD, `M` means NO_VERIFIED_MAPPING for the component.

| Component | Definitions | Input tuples | Observed | Admitted | REST | UI | Missing | Reasons |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| DESTINY | 25 | 153 | 9 | 5 | 5 | 5 | 20 | 4 P, 16 N |
| COLUMBUS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 M |
| HARMONY | 7 | 261 | 5 | 1 | 1 | 1 | 6 | 4 P, 2 N |
| PIRS | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 M |
| POISK | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 N |
| ZVEZDA | 21 | 1 | 1 | 1 | 1 | 1 | 20 | 20 N |
| RASSVET | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 N |
| ZARYA | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 1 N |
| KIBO_EXPOSED_FACILITY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 M |
| KIBO_PRESSURIZED_MODULE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 M |
| QUEST | 57 | 29 | 20 | 6 | 6 | 6 | 51 | 14 P, 37 N |
| CUPOLA | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 M |
| TRANQUILITY | 16 | 318 | 12 | 8 | 8 | 8 | 8 | 4 P, 4 N |
| UNITY | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 2 N |

Totals: 131 definitions, 762 component input tuples, 47 observed semantic parameters,
21 admitted/REST/rendered values, 110 missing definitions: 26 future-date policy
exclusions and 84 with no returned retained observation. Five unmapped components
retain the existing minimal absence statement. No unavailable value is fabricated.

All 14 cards were inspected through the existing verified selection callback. Every
populated row was checked for selected component, semantic/raw ID, category, label,
value/state/unit, original UTC date and visibility. All 21 row screenshots were also
visually reviewed. The two raw readings are in Supporting technical detail → Raw
telemetry channels; the normal surface has 19 engineering/state readings. There is
no category whitelist/filtering defect and no production frontend edit. The accepted
frontend build assets remain identical. Native Inspection entry was exercised; the
external headless QA scene was then frozen to avoid SwiftShader render saturation
while auditing card DOM/scrolling. No production App/Viewer/model/camera file changed.

## Preservation, retry and idempotency

The schema and chronological admission rules are unchanged. No database reset or
observation mutation is required. `MISSION1_TELEMETRY_RETRY_FAILED_BOOTSTRAP=true`
(or the corresponding Spring startup argument) explicitly permits the same atomic
claim to consume a genuinely FAILED acquisition recorded since its previous attempt.
In-progress claims and completed passes cannot be forced; ordinary 24-hour pacing
remains the default. Successful retry is idempotent. A complete pass whose dates are
all policy-ineligible completes acquisition but creates no dated values.

The isolated database began with zero public tables, applied V1→V2 and initialized
runtime definitions normally. No captures, research values or fixtures seeded it.
The initial normal pipeline had an external byte-copy observer only; a subsequent
fixed production-jar restart, without that observer, preserved all record/acquisition
fingerprints (21 records, 13 acquisitions), skipped both completed providers and had
zero bootstrap/persistence errors. GETs and source connectivity do not alter dates.

The canonical production jar was restarted with the explicit failed-pass retry.
Its real event was 416,594 bytes / 7,644 records, with 782 component matches, zero
malformed/unbound matches and zero eligible normalized values. The complete pass
changed SenseData coordination from failed to completed through application logic;
ISS.live's completed pass was skipped. There were no bootstrap/persistence/conflict/
queue-drop errors. All 1,649 existing immutable records, 1,443 acquisitions and 1,780
evidence rows remained identical in their typed fields; new acquisition/status
evidence was appended. All 21 dated heads were preserved, with the same component
counts as the isolated validation. Crew and Orbit returned HTTP 200, and Crew member
representations were identical before/after. The active fixed jar's classes/resources
were compared byte-for-byte with final `mvn verify` output. The normal frontend on
port 5175 remains; no canonical database reset or manual coordination repair occurred.

## Regression validation

Maintained Java21/PostgreSQL16.10: full `mvn test` and `mvn verify` each pass **1,503
tests**, zero failures/errors/skips. Node24: **861 frontend tests in 72 files**, zero
failures; typecheck and production build pass. The existing large Cesium chunk
warning is unchanged. V1 checksum -1371784637 and V2 checksum 1338977865 are unchanged;
fresh migration tests still apply exactly V1→V2, without an installation-floor table.

New tests exercise large/multiline/chunked/CRLF/CR SSE, byte/record/field bounds,
truncation, malformed isolation, timeout/close, STATUS/vm exclusion, every research
definition and provider binding, Russian/Quest/Node20/station scope, all-definition
persistence/component responses, every frontend category/row, failed-only retry and
successful idempotency. A TEST_ONLY 6,300-record event crosses actual local HTTP,
the asynchronous worker and JDBC batches: all 6,300 immutable records/evidence rows
are persisted/admitted, producing 42 correct component heads. That input stays only
in a disposable test database and cannot populate operational runtime telemetry.

## Evidence

Full machine-readable expected/actual registry comparison, every SenseData/ISS.live
record trace, per-component coverage, SQL records, REST responses, UI row comparisons,
network captures, byte hashes, startup/restart logs, test/build logs and screenshots
remain outside Git at
`/Users/daniel/.codex/exports/mission1-retained-coverage-2026-10-14`.
The independent TEST definition reference contains metadata only, never observations.
This dated report records measured results; the maintained operational contract is
[module telemetry](module-telemetry.md), [REST](../api/component-telemetry.md) and
[ADR-0024](../adr/0024-component-telemetry-record-history.md).
