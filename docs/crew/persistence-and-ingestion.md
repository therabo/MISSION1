# Crew persistence and ingestion

**Final database initialization — 2026-10-21:** all Crew and telemetry DDL is now
contained in the single [canonical V1](../architecture/database-publication-baseline.md#final-clean-install-consolidation--2026-10-21).
Existing development Flyway histories require deliberate recreation; numbered
migration references below describe their original historical milestones.

## Source occurrence versioning — 2026-10-10

Flyway V6 adds eight immutable article/observation, assertion/version/scope and subject/metadata/link tables around the existing evidence. Primary/unique/composite foreign keys prevent contradictory memberships; rejection triggers preserve history. Idempotent startup backfill runs after Flyway and before HTTP acceptance, under the verification source lock. Successful NASA ingestion maintains associations atomically with evidence and successful-run completion. Existing rows/hashes and identity audits are preserved.

Identity/scope extraction reads already retained RSS bytes; it makes no extra HTTP call and no GET invokes it. A read-only V5-compatible `DRY_RUN` previews association counts before mutation; APPLY/OFF modes and commands are in the [backend README](../../backend/README.md). The additive schema supports application downgrade without migration reversal, restoring previous version-row interpretation. Set-based reads and batched writes avoid per-subject queries. See [ADR-0012](../adr/0012-versioned-crew-source-occurrences.md) and [backfill/query-plan/rollback evidence](source-occurrence-versioning-validation/README.md).

**Current scheduling extension (2026-10-03):** [ISS Crew event-aware refresh](event-aware-refresh.md) adds a bounded LL2 docking/undocking calendar, conservative NASA anticipation and durable completed-NASA-transfer follow-up. Planning events remain separate from crew presence and assignment truth. Baseline 2h source schedules, parser/reconciliation semantics and this document’s dated validation evidence remain applicable. New operational history uses V5; see the [new validation dossier](event-aware-refresh-validation/README.md). Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started.

## Design recorded before implementation — 2026-10-03

LL2 → existing source adapter → `CrewIngestionService` → existing Spring JDBC/PostgreSQL → internal `CrewQueryService`. Crew remains independent of Orbit. A fetch attempt is a sync run; a unique validated source state is an immutable snapshot. Two identical successful fetches produce two runs and one snapshot. Latest state follows the latest successful run, including a run reusing an older snapshot.

Use small UUID person/expedition anchors and separate, unique `(source, external_id)` mappings. Resolve only exact source IDs, never names. Relational snapshot-owned expedition/person/assignment rows preserve the observation graph. Agency, multiple nationalities and media rights use bounded typed JSONB structures within the person observation; they are not global master data. Identity, roles, durations, dates, lineage and query fields remain relational. No full upstream payload retention or image mirroring. ISO-8601 duration text preserves Java Duration exactly, including fractions, without PostgreSQL interval/calendar ambiguity.

Snapshot uniqueness includes source, station, source station ID, API version, adapter version and exact HTTP-byte SHA-256. Including normalization version prevents a future mapper revision from silently reusing an incompatible normalized state. First-observed provenance stays immutable; each run retains its own retrieval/HTTP metadata. All absolute instants use TIMESTAMPTZ/Instant, truncated explicitly to PostgreSQL microseconds at the storage boundary.

Commit the started run before HTTP. Commit new identities, the complete snapshot graph and successful run completion atomically in a separate transaction. On failure, roll back that transaction and complete the already committed run as failed in another transaction. A database outage can prevent failure completion too: retain/log the started run, never claim guaranteed durable recording while PostgreSQL is down. A process crash can leave an IN_PROGRESS run, which is observable rather than silently called successful.

Foreign keys use default NO ACTION, with no destructive cascades. Database triggers reject updates/deletes to snapshots and observation rows; future retention requires an explicit migration/policy. Composite FKs require assignments to reference person/expedition observations belonging to the same snapshot. Uniqueness and known-query indexes enforce deduplication and support latest runs, external identity lookup and snapshot graph reads.

The single-instance coordinator prevents concurrent network/persistence work. Scheduled policy is enabled by configuration, fixed delay PT2H and initial delay PT5M; tests disable it. Persisted attempt times protect restart loops, and persisted Retry-After suppresses all calls before eligibility. Skips are recorded separately from source outcomes and do not move the last actual fetch attempt. There are zero retries per run and one LL2 expedition request, with no automatic astronaut enrichment. Multi-node scheduler ownership is deferred until deployment requires it.

Only AVAILABLE, complete, single-expedition observations are stored as graphs. NO_ACTIVE_EXPEDITION, AMBIGUOUS, malformed, HTTP/network failures and rate limits remain run history and preserve the last successful graph. Fresh retrieval means recently fetched LL2 observations, never authoritative physical presence. LL2 in_space is profile data only. The V3 milestone introduced no canonical presence. V4 now adds NASA verification and derived presence, as documented below; Crew REST is implemented in the read path below; frontend remains future.

Implementation is complete. See [acceptance evidence](ingestion-validation/README.md) for the dated offline, PostgreSQL and live gates.

## Actual schema and query support

Flyway `V3__crew_source_observation_history.sql` adds the following tables. V1/V2 and their orbital tables are unchanged.

| Table | Responsibility / primary key | Relationships, uniqueness and known-query indexes |
| --- | --- | --- |
| `crew_source_sync_run` | Every invocation, including explicit skips; bigint identity PK | Nullable composite snapshot/source/station FK; success iff snapshot exists; completed state iff completed timestamp exists. Latest-attempt index `(source,station,started_at DESC,id DESC)`, partial latest-success index by completion/id, partial failure index, partial Retry-After index. |
| `crew_source_snapshot` | Unique immutable source state; bigint identity PK | Unique `(source,station,source_station_external_id,source_api_version,adapter_version,content_hash)` supports hash lookup. Additional unique id/source(/station) keys support consistency FKs. |
| `crew_person` | Small stable person anchor; UUID PK | Creation time only; referenced by mappings/observations. |
| `crew_person_external_id` | Exact source person mapping; `(source,external_id)` PK | Person UUID FK; unique triple including person UUID enforces observation identity. PK supports external-ID lookup. Mapping cannot be rewritten/deleted. |
| `crew_expedition` | Small stable expedition anchor; UUID PK | Creation time only; referenced by mappings/observations. |
| `crew_expedition_external_id` | Exact source expedition mapping; `(source,external_id)` PK | Expedition UUID FK; unique triple including UUID; PK supports external-ID lookup. Mapping cannot be rewritten/deleted. |
| `crew_expedition_observation` | Snapshot-owned observed expedition; `(snapshot_id,expedition_id)` PK | Snapshot/source/station and exact identity-mapping FKs. Name, lifecycle dates, station/external station ID. PK supports snapshot reads. |
| `crew_person_observation` | Snapshot-owned profile; `(snapshot_id,person_id)` PK | Snapshot/source and exact mapping FKs. Nullable profile/flags/statistics, source mode, agency/nationalities/media JSONB. PK supports snapshot reads. |
| `crew_assignment_observation` | Expedition membership, never presence; `(snapshot_id,expedition_id,person_id)` PK | Composite FKs to the same snapshot's person and expedition observations. Unique `(snapshot_id,source,external_id)` prevents repeated source assignment. PK supports snapshot roster reads. |

All FKs use NO ACTION; no cascading history deletion. Database triggers reject snapshot/observation updates/deletes and external-ID remapping. Snapshot graphs are inserted once. Operational runs transition once from IN_PROGRESS to a terminal outcome; the adapter refuses a second completion. The database is not an authorization system: administrative DDL/TRUNCATE can still change data. No retention cleanup job is authorized by this milestone.

### Relational fields and bounded JSONB

Person observations contain `display_name`, optional official URL and source mode, nullable `in_space`/biography, presence of a career object, ISO durations, optional counts and first/last flight instants. Structured agency JSON preserves name/abbreviation/type/external mappings; nationality JSON is an ordered zero-to-many list of alpha-2/alpha-3/display values; media JSON preserves URL/thumbnail/credit/license/link/nullable single-use. No opaque full-domain JSON blob, global agency system, raw source archive or media download exists. The adapter's existing source-body limit bounds the input.

## Actual components and transactions

- `CrewRepository` defines run history, atomic successful graph persistence, snapshot reads, latest success/failure and durable eligibility. `JdbcCrewRepository` implements it with the established JdbcTemplate pattern.
- `CrewSnapshotValidator` checks complete single LL2 ISS candidates, root/child lineage, exact external IDs, unique profiles/assignments and matching relationships before storage.
- `CrewIngestionService.ingest()` is explicit; `ingestScheduled()` additionally checks fixed-delay eligibility. Both enforce rate limits and overlap. The service has no HTTP controller, NASA reconciliation or Orbit dependency.
- `CrewQueryService.latest(source,station)` follows the most recently completed successful run (id breaks completion-time ties), then reconstructs the immutable graph in four queries. It exposes both first observation and last successful retrieval through separate records.
- `CrewQueryService.status()` returns last invocation, success, failure, Retry-After and current rate-limit eligibility. Last invocation can be a recorded skip; `CrewRepository.lastFetchAttemptAt` independently returns the last actual-attempt start.
- `CrewIngestionConfiguration` composes services/policy; `CrewIngestionScheduler` is the configurable delayed Spring trigger. The source/evidence capabilities remain in `CrewConfiguration`.

All write-port methods use REQUIRES_NEW. The started run commits before HTTP. Success writes identities and graph and completes the run in one transaction. If any graph/constraint/write fails, that transaction rolls back and a distinct completion transaction records PERSISTENCE_FAILURE. Source results complete only the run. An outage that prevents the initial run insert makes zero source requests; an outage preventing failure completion leaves the committed IN_PROGRESS attempt inspectable and is logged by the scheduler. Process-crash recovery/reclassification is deferred; incomplete runs are not rewritten as fictitious failures or successes.

The database transaction advisory lock `(73491,1)` serializes Crew identity allocation by direct repository writers and avoids concurrent orphan UUID allocations. It does not reserve scheduler ownership or prevent network requests from multiple application instances. Multi-node coordination is future work. Anchor lookups are batched once per entity type, and inserts use JDBC batches per collection, with no query per profile field or source enrichment loop.

## Configuration and operational results

| Property / environment override | Default | Validation / behavior |
| --- | --- | --- |
| `mission1.crew.ingestion.enabled` / `MISSION1_CREW_INGESTION_ENABLED` | `true` | `false` disables only the scheduled trigger; explicit service/query capabilities remain. Test properties set false. |
| `mission1.crew.ingestion.fixed-delay` / `MISSION1_CREW_INGESTION_FIXED_DELAY` | `PT2H` | Minimum PT1H; delay measured after a synchronous tick. Durable actual-attempt start additionally protects restart loops. |
| `mission1.crew.ingestion.initial-delay` / `MISSION1_CREW_INGESTION_INITIAL_DELAY` | `PT5M` | Minimum PT1M; no constructor/startup source call. |
| `mission1.crew.request-timeout` / `MISSION1_CREW_REQUEST_TIMEOUT` | `PT20S` | Existing transport timeout; zero per-run automatic retries. |

[The provider overview](https://thespacedevs.com/llapi), rechecked 2026-10-03, publishes 15 unauthenticated requests/hour. PT2H is a conservative project policy, not a source update guarantee or assertion of remaining quota. The verified active detailed request remains the only normal source request. Manual detail enrichment is separate and unused by ingestion.

A 429 persists HTTP status, raw Retry-After and parsed eligibility (delta seconds relative to receipt, or HTTP-date). Before eligibility, an invocation records SKIPPED_RATE_LIMIT without HTTP. Missing/malformed headers apply PT2H fallback backoff, explicitly local policy; expired headers do not impose a new delay. Scheduled timeout/5xx/network/malformed/no-active/ambiguity waits until normal eligibility. Skips are observable and do not postpone actual-attempt eligibility. There is no retry loop.

A fresh snapshot remains an LL2 structured observation. Source publication/event times remain null unless actually supplied; no Crew TTL or canonical truth quality is fabricated. `in_space` exists only in the source profile observation. NASA contracts stay intact and are now implemented by the independent V4 pipeline below. REST is implemented below; UI, docking-triggered refresh and Replay remain future.

## Developer verification

Use the existing `docker compose up -d --wait postgres`, Java 21 `mvn test` and `mvn verify` workflow. Testcontainers uses PostgreSQL 16.10, not H2. Default tests disable external scheduling and use recorded source fixtures, loopback HTTP or mocks. The opt-in `LiveCrewValidation ... --persist` command is documented in [backend README](../../backend/README.md#crew-ingestion-and-postgresql-history--2026-10-03). It boots non-web with both schedulers off, migrates, runs one ingestion, writes a report outside Git and stops. Do not repeat it as a polling loop. Provision a separate validation DB and set `MISSION1_DB_URL` when isolating live acceptance data.

## NASA verification extension — Flyway V4, 2026-10-03

The accepted V3 LL2 graph/repository/source and request budget are retained. V4 adds:

| Table | Immutable history responsibility |
| --- | --- |
| crew_document_body | Exact raw feed bytes by SHA-256, 1–2 MiB accepted bound. |
| crew_source_document | URL/hash/parser version, first retrieval/HTTP metadata and parsed eligibility. |
| crew_verification_evidence | Typed semantic assertions, article publication/event times, excerpts and parser version. |
| crew_evidence_subject | Original named subjects, external IDs and validated profile link. |
| crew_document_evidence | Same semantic assertion in later feed captures. |
| crew_identity_resolution | Audited subject→UUID or unresolved/ambiguous decision. |
| crew_reconciliation_run | Operational derived attempt/completion/failure. |
| crew_reconciliation_snapshot | Deduplicated immutable interpretation and algorithm/input context. |
| crew_reconciliation_evidence | Exact assertion inputs. |
| crew_reconciliation_resolution | Exact identity decision inputs. |
| crew_reconciled_person | Derived presence/last-known/assignment/as-of state per UUID. |
| crew_reconciled_person_evidence | Per-person supporting assertion lineage. |

Existing crew_source_sync_run gains verification_document_id; LL2 success still requires its source snapshot and NASA success its parsed document. Source acquisition and resolution reuse existing person UUID/external-ID anchors; no LL2 field is mutated. Source documents/evidence/subjects/associations commit together; individual resolution audits and derived graph completion are separate transactions. Source failure keeps the prior successful capture. FK/unique/check constraints, indexes for URL/hash/version, time, subject resolution and successful reconciliation protect integrity. UPDATE/DELETE history triggers and restrictive FKs forbid accidental destructive edits. V1/V2/V3 files are byte-identical to the accepted baseline.

Unchanged 200/304 produce new fetch runs but no new body/evidence graph. Changed content stores a new document, reusing unchanged semantic assertions with associations. Changed interpretation/policy version creates a new derived snapshot; identical interpretation reuses it while operational runs accumulate. Raw bytes remain in PostgreSQL TOAST for parser replay/audit; no source archive service, compression job or retention deletion is introduced.

NASA scheduling and canonical query semantics, including normal PT2H/PT10M delays, startup isolation, durable rate limits, process-local overlap and the deferred stale-run ownership decision, are defined in [the authoritative NASA design](nasa-verification-and-reconciliation.md). The canonical query remains internal; public Crew REST adapts it through the read path below. Crew UI remains future. History reads use batch queries; current evaluation currently reads retained assertions and may require indexed projection/retention design if history becomes large. [Real PostgreSQL and live evidence](reconciliation-validation/README.md).

## REST read path — 2026-10-03

PostgreSQL → CrewQueryService/CrewReconciliationQueryService and CrewReadQueryService → CrewRestQueryService → CrewController → public DTO JSON. CrewReadRepository/JdbcCrewReadRepository adds only set-based persisted identity/profile reads and a structured semantic-outcome lookup. Latest known profiles follow successful fetch runs, including snapshot reuse. No migration or writer was changed. REST composition runs in a read-only REPEATABLE_READ transaction, so one response sees coherent persisted inputs while ingestion can commit independently. Four person projection SQL reads are independent of roster size; there is no per-person source/SQL loop. GET never starts/completes an ingestion or reconciliation run, resolves identities, invokes a scheduler or makes provider requests. [HTTP/read evidence](rest-api-validation/README.md).


## Replay integration — 2026-10-03

Replay reads existing immutable snapshots, observations, evidence and identity resolutions without ingestion, identity writes, reconciliation persistence or trigger discovery. No schema/retention change. [Replay contract](../api/replay-api.md).

## Independent NASA editorial acquisition — 2026-10-10

[V8 and ADR-0014](nasa-editorial-roster-validation/README.md) retain topic facts, typed resources, semantic roster/member versions, relations and each acquisition in isolated shadow tables, reusing generic body/documents. No editorial writes target legacy sync runs, identity mappings/decisions, operational evidence or reconciliation. Capture ordering preserves A→B→A, source-local failure and restart/cache lineage. Mutable lease/budget rows govern scheduled eligibility and shared NASA pacing only. Public GETs do not call these writers or read new observations.


## Completed operational departure parser — 2026-10-11

The [departure validation dossier](nasa-operational-departure-validation/README.md) documents parser
1.1.0, exact captured source grammar, named subjects, explicit event/publication/capture time,
minute precision and independent source health. The existing V6 occurrence and evidence schema
supports additive retained reinterpretation with immutable bodies/history; no migration is added.
No operational or editorial count is derived from subject cardinality. New timed departure evidence
flows to V10 shadow only; public Current membership, profile identity and Replay remain on the
accepted legacy evidence path. V9 decisions remain separate and unmodified by this command.

## Current activation boundary — ADR-0017 / 2026-10-11

Current membership now comes from the latest compatible committed V10 ACTIVE projection, followed by established V7 canonical identity and latest-retained LL2 field authority. It remains distinct from operational presence, assignment and source count facts. Retained people and aliases stay detail-addressable; V9 identity remains shadow-only and Historical/Replay selection stays unchanged. No source/history/migration change occurs. [Activation contract, rollback and acceptance](current-active-projection-activation/README.md).
