# MISSION1 orbital core

**Component telemetry — ADR-0024/0025:** native SDK push remains continuous;
SenseData and ISS.live now reconcile independently after readiness and every PT30M
following successful acquisition, including empty/rejected/duplicate-only responses.
Durable PostgreSQL deadlines survive restart; provider claims prevent duplicate
fetches and failure backoff doubles to PT6H. Bounded I/O is outside the native worker.
The common normalizer/admission/JDBC model and 131 definitions are unchanged.
V1/V2 remain byte-identical; structure-only V3 adds provider coordination and
immutable SenseData future-time rejection identities. No year rewrite or UI change.

Configuration: `MISSION1_TELEMETRY_RETAINED_RECONCILIATION_ENABLED=true`,
`MISSION1_TELEMETRY_RETAINED_RECONCILIATION_INTERVAL=PT30M`,
`MISSION1_TELEMETRY_RETAINED_RECONCILIATION_MAXIMUM_BACKOFF=PT6H`.
Existing bootstrap/native enablement and bounds remain; the failed-bootstrap retry
override is retired. Diagnostics report both durable provider outcomes/deadlines.
[Policy, APIs, provenance and bounds](../docs/telemetry/module-telemetry.md),
[periodic validation](../docs/telemetry/retained-reconciliation-validation.md),
[earlier coverage audit](../docs/telemetry/retained-coverage-audit.md).

**Public database baseline — ADR-0023, followed by ADR-0024 telemetry:** startup applies
`V1__initial_schema.sql` as the frozen baseline, followed by telemetry V2 and retained-coordination V3. V1 creates 80 domain tables with no preloaded observations,
source captures, memberships or coordination rows. Application initialization creates
six mutable coordination registers separately; the packaged reviewed identity manifest
and frozen model remain explicit application reference inputs. All operational history
comes from normal acquisition/workers. The pre-publication V1–V13 chain was squashed
before first public release; old development databases are intentionally unsupported.
Use a new database or deliberately discard the local development volume with
`docker compose down -v`, then `docker compose up -d --wait postgres`.

Production always uses qualified Operational Subject Binding, canonical identity and
one membership lifecycle for Current/Historical. No old database names or rollback
selectors are accepted. Scheduler namespaces are `mission1.crew.identity-research`,
`mission1.crew.membership` and `mission1.crew.operational-binding`. Their existing
cadences remain: initial 15m, research/binding/membership evaluation 1m and resource
acquisition 5m. `mission1.crew.operational-binding.acquisition-enabled=false` disables
resource acquisition for isolated validation. Current's `ACTIVE_PROJECTION` response
label remains; Historical uses `UNIFIED_HISTORICAL`. GET cannot acquire, score or write.

[Publication schema and validation](../docs/architecture/database-publication-baseline.md),
[current architecture](../docs/architecture/current-production.md) and
[dynamic discovery](../docs/crew/dynamic-resource-discovery.md) describe the public
runtime. The dated clean-room/crew dossiers below remain historical evidence.

This is one Java 21 / Spring Boot 3.5.6 application, built with Maven. Run `mvn test` or `mvn verify` from this directory. Startup applies PostgreSQL migrations and starts HTTP, then promptly checks GP eligibility. An empty installation acquires its first real GP through the normal CelesTrak path. Crew retains its independent delayed schedules. The Earth View now consumes the existing read-only Crew REST endpoints through a DOM list/detail panel; backend behavior and the independent orbital track are unchanged. [Frontend evidence](../docs/frontend/crew-earth-view-panel-review/README.md).

## Data path and meaning

`CelesTrakOrbitalElementsSource` requests the [verified ISS GP TLE URL](https://celestrak.org/NORAD/documentation/gp-data-formats.php) with `CATNR=25544&FORMAT=TLE`. It expects one three-line response, rejects a malformed or checksum-invalid TLE through Orekit `TLE.isFormatOK`, checks catalog identity through Orekit parsing, and records MISSION1 receipt time. HTTP status failures are surfaced without retry. In particular, a 403 is visible to the caller. The eligibility scheduler obeys [CelesTrak's usage policy](https://celestrak.org/usage-policy.php), including durable pacing and non-200 suspension.

`OrbitalElementSet` carries the explicit `TLE` format, two original element lines, SHA-256 identity, catalog 25544, source provider `CELESTRAK_GP`, upstream lineage `USSF_GP_VIA_CELESTRAK`, source URI, element epoch, and retrieval time. Provider publication time is unknown (`null`). Its classification is `SOURCE_PROVIDED_ORBITAL_ELEMENTS`.

`OrekitOrbitalPropagator.propagate(elements, Instant)` creates a fresh `TLEPropagator` for each call; `propagateAll` creates one request-local propagator for a bounded sample window. Orekit selects SGP4/SDP4 and returns TEME position and velocity at the requested time. Orekit then transforms the same state to **ITRF 2020 with IERS 2010 conventions and full EOP corrections** (`simpleEOP=false`), and `OneAxisEllipsoid` with Orekit WGS84 constants computes geodetic latitude, longitude and ellipsoidal altitude. `OrbitalState` is `COMPUTED_FROM_ORBITAL_ELEMENTS` and links to the source set through its hash, epoch, provider, upstream lineage, URI and retrieval time. Its signed `propagationOffset` is `propagationTime − elementEpoch`; current freshness instead uses `evaluationTime − elementEpoch`, and retrieval age uses `evaluationTime − retrievedAt`. A request near “now” is still a calculation from older elements, not onboard telemetry.

Canonical units are meters for Cartesian position and WGS84 altitude, meters/second for Cartesian velocity, radians for angles, and `Instant`/`Duration` for times and age. Both Cartesian states name their frames. Only the API converts geodetic angles to degrees. The low-level propagator returns `UNKNOWN`; it throws on invalid input or computation failure. The `OrbitalQualityEvaluator` takes a retained set (or `null`), explicit evaluation and propagation times, and separate source acquisition health. It returns a coordinate-bearing `GOOD`, `STALE`, or `UNKNOWN` state, or a coordinate-free `NO_DATA`/`INVALID` result with a stable reason. The [versioned current-state policy](../docs/telemetry/orbital-quality-policy.md) defines the MISSION1 24-hour epoch-age boundary and its limits; neither successful computation nor `GOOD` certifies positional accuracy.

## PostgreSQL element history

The `OrbitalElementSetRepository` port and Spring JDBC adapter accept an already obtained, validated set through `storeIfNew`. The adapter revalidates the TLE and its epoch/hash/catalog metadata, then atomically stores a unique source set and its retrieval observation. Flyway owns the schema. `findById`, bounded `recent(limit)`, and `latestUsable(asOf)` reconstruct domain objects. See [element-history semantics](../docs/telemetry/orbital-element-history.md) for identity, ordering, and timestamp rules. Flyway inserts no fetched set, and no quality result or computed orbital state is stored.

For local development, run `docker compose up -d --wait postgres` from the repository root, then `mvn spring-boot:run` from `backend/`. Flyway applies the migration and the HTTP server starts on port 8080. The root Compose file contains only PostgreSQL. Defaults are `jdbc:postgresql://localhost:5432/mission1`, user `mission1`, and password `mission1_local`: these are **local-only development values**. Override `MISSION1_DB_URL`, `MISSION1_DB_USER`, and `MISSION1_DB_PASSWORD` outside a local machine. `docker compose down` stops the database while retaining the named volume; `docker compose down -v` deliberately removes local database history.

`mvn test` and `mvn verify` run the existing offline orbital tests plus PostgreSQL integration tests using Testcontainers. Docker must be available for the latter. Those tests use the frozen real TLE fixture and a clearly marked test-only altered revision, never CelesTrak network calls or H2.

## Current orbital state API

`GET /api/iss/state` reads only the persisted element history and the in-process source-health snapshot. It captures one UTC instant, selects `latestUsable(now)` (epoch and retrieval time both no later than now), propagates that set with the existing Orekit path, and applies `orbital-current-v1` at the same instant. The endpoint never fetches CelesTrak; an empty database returns 503 until scheduled acquisition stores a set. This is a **current-time computation from previously retrieved elements**, never live onboard ISS position telemetry. Historical data availability does not prove provider availability.

The state fields in this HTTP 200 example were recorded during the local check on 2026-09-28; `sourceHealth` illustrates the post-restart snapshot for the same stored fixture. It uses the frozen, previously retrieved real TLE fixture and a request-time Orekit computation; it is not a live onboard measurement or a production fallback:

```json
{
  "satellite": { "noradCatalogNumber": 25544 },
  "propagationTime": "2026-09-28T15:42:33.884625Z",
  "state": {
    "frame": "TEME",
    "positionMeters": { "x": -4576163.0332699055, "y": 4654362.09928317, "z": -1924575.7290375482 },
    "velocityMetersPerSecond": { "x": -4686.502871824431, "y": -2294.8556528583485, "z": 5597.579576609157 }
  },
  "geodetic": { "datum": "WGS84", "latitudeDegrees": -16.526524907495478,
                "longitudeDegrees": -108.5573298380022, "altitudeMeters": 428604.3645357017 },
  "source": {
    "provider": "CELESTRAK_GP", "upstreamOrigin": "USSF_GP_VIA_CELESTRAK",
    "elementEpoch": "2026-09-28T03:24:39.835008Z",
    "retrievedAt": "2026-09-28T13:58:32Z", "publishedAt": null,
    "elementSha256": "151bdb4cf2b7128ac815aa975736ffec0c28211751963e8be7263aad7b7abc71",
    "classification": "SOURCE_PROVIDED_ORBITAL_ELEMENTS"
  },
  "classification": "COMPUTED_FROM_ORBITAL_ELEMENTS",
  "quality": {
    "status": "GOOD", "reason": "NONE", "policy": "orbital-current-v1",
    "elementAgeSeconds": 44274.049617, "retrievalAgeSeconds": 6241.884625,
    "propagationOffsetSeconds": 44274.049617
  },
  "sourceHealth": {
    "status": "UNKNOWN", "lastAttemptAt": null,
    "lastSuccessAt": "2026-09-28T13:58:32Z", "lastFailureAt": null,
    "consecutiveFailures": 0, "lastFailureCategory": null,
    "lastSuccessfulResult": null
  }
}
```

The response uses SI Cartesian units, WGS84 ellipsoidal altitude in meters, and geodetic angles converted from canonical radians to degrees at the API boundary. Longitude follows Orekit's `[-180°, +180°]` convention. `elementEpoch` is the TLE solution epoch, `retrievedAt` is MISSION1 observation time, and nullable `publishedAt` is provider publication time when verified; none is substituted for another. `elementSha256` identifies the source content without exposing raw TLE lines or a database key. Ages are signed decimal seconds; `propagationOffsetSeconds` is propagation time minus element epoch. `GOOD` and `STALE` are MISSION1 recency judgments, not accuracy guarantees or stored properties of the TLE. A computed `STALE` state remains HTTP 200 with coordinates and an explicit stale reason.

`sourceHealth` is operational acquisition status, separate from `quality`. On restart, status and failure count reset to `UNKNOWN`/zero; `lastSuccessAt` is reconstructed from durable retrieval observations and does **not** imply `HEALTHY`. Valid new or repeated data makes status `HEALTHY`; provider/validation failure makes it `DEGRADED`. No arbitrary failure-count threshold for `UNAVAILABLE` is used. A local database failure returns `PERSISTENCE_FAILURE` from refresh without blaming CelesTrak. The prior valid orbital set remains available after a provider failure, and its quality continues to depend on element epoch through `orbital-current-v1`.

## Earth View orbital samples API

`GET /api/iss/orbit/samples` returns a bounded Earth-fixed Cartesian window computed from **one** selected persisted TLE, using one request-local Orekit propagator. Its defaults are 120 seconds past, 600 seconds future, and 10-second spacing (73 samples). The response includes the backend `generatedAt`, exact first/last times, `ITRF_2020_IERS_2010`/meters, current WGS84 geodetic location, shared source element hash/epoch/retrieval and provenance, `orbital-current-v1` quality at generation time, and separate source health. It never fetches CelesTrak or persists computed states. Past samples are reconstructed from the selected TLE; future samples are computed GP/TLE predictions, not NASA OEM. A `STALE` set still yields HTTP 200 with explicit quality. Invalid bounds return 400 ProblemDetail; absent elements return 503; calculation and stored-data errors return sanitized 500. The [API contract](../docs/api/orbital-samples.md) gives every field and bound.

The [Earth View delivery decision](../docs/architecture/04-earth-view-orbital-delivery.md) selects `REST_SAMPLED_WINDOW`: linear Cesium interpolation between 10-second backend samples, with a recommended 120-second REST refresh and no unbounded extrapolation. The offline interpolation experiment observed 99.865 m maximum deviation from Orekit over its fixed 10-minute segment at this spacing. The default JSON response was about 10 KB and warm local median generation about 4–6 ms; a 181-sample response was about 23 KB and took about 5–11 ms in warm local runs. These are sizing observations on one developer machine, not service guarantees. `GET /api/iss/state` remains a separate, small exact-current operation.

## Automatic CelesTrak refresh

The default `mission1.orbital.celestrak.refresh.enabled=true` performs one prompt
eligibility check after readiness. `MISSION1_CELESTRAK_REFRESH_INTERVAL` remains
`PT2H10M`, with a two-hour minimum; `MISSION1_CELESTRAK_REFRESH_ENABLED=false`
disables scheduling. The former initial-delay property is removed. A durable recent
successful retrieval or request reservation suppresses duplicate restart requests.
TLE element epoch never controls source fetch eligibility.

The service atomically reserves the cooldown in `celestrak_request_state` before HTTP, then uses the
unchanged production adapter, TLE validation and `storeIfNew`. One timer follows the
actual `nextEligibleAt`, including after an early check and transport failure.
Non-200 responses (including 403) suspend automatic acquisition across restart
pending operator review. Local DB read/reservation failures make no HTTP request;
after-fetch failures preserve the reservation. Original source set/hash/receipt
lineage and separate computed orbital quality remain unchanged. See the
[exact scheduling and recovery policy](../docs/telemetry/celestrak-refresh-policy.md).

This is **MISSION1 operational policy**, chosen with a ten-minute buffer beyond [CelesTrak's approximately two-hour GP update/download guidance](https://celestrak.org/usage-policy.php) to avoid repeatedly hitting the same provider update window. It is not TLE epoch freshness, retrieval age, or positional-accuracy guidance. Orbital state quality remains governed by `orbital-current-v1` and its independent 24-hour element-epoch boundary. See [refresh policy](../docs/telemetry/celestrak-refresh-policy.md).

Errors use `application/problem+json` with a stable `type` URN, status, title and safe detail. `503` with `urn:mission1:problem:no-orbital-elements` means no set was both observed and eligible at evaluation time. Invalid stored metadata yields `500` with `orbital-data-integrity-error`; an invalid selected TLE yields `invalid-orbital-elements`; Orekit/EOP/transform failures yield `orbital-calculation-failed`. Unexpected server errors yield `orbital-internal-error`. Failures return no fake coordinates. A successful response does not assert that CelesTrak is currently healthy.

## Reproducible Orekit data

Only `tai-utc.dat` and `Earth-Orientation-Parameters/IAU-2000/finals2000A.all` were copied from the [Orekit data repository](https://gitlab.orekit.org/orekit/orekit-data/) at commit `3e376b326373467647b1e246ebb083cd9e57cd68` into `src/main/resources/orekit-data/`. The SHA-256 values are:

| File | SHA-256 |
| --- | --- |
| `tai-utc.dat` | `3524e1ae34d67e858873a89e59983bbc5bd100221da898e796c1b36036a310c3` |
| `finals2000A.all` | `e3905ff7a74b791744704aa3e900a2161e96db97a30095d8fc442b04e4cfe058` |

A private Orekit `LazyLoadedDataContext` loads those classpath files. UTC, TEME and ITRF all use that context; no global Orekit directory or machine configuration is consulted. The code requires nonempty EOP and refuses propagation outside its tabulated coverage. The EOP file contains forecast rows as well as observations; use of a forecast row does not turn a computed state into an observed state. Updating the bundle later requires pinning a new revision, rechecking provenance and reference outputs, and running the offline tests.

## Frozen, independent reference

`src/test/resources/iss-2026-09-28.tle` is the real, checksum-valid response recorded in the [project's CelesTrak verification](../docs/telemetry/orbital-elements-verification.md) at **2026-09-28 13:58:32 UTC**. Its TLE epoch is **2026-09-28 03:24:39.835008 UTC**. It is an offline historical test fixture, never a production fallback or current position.

The expected TEME values were generated with [python-sgp4 2.25](https://github.com/brandon-rhodes/python-sgp4), which wraps Vallado's SGP4 code, independently of Orekit. Earth-fixed and WGS84 values were generated with [Skyfield 1.53](https://rhodesmill.org/skyfield/earth-satellites.html) using its built-in time scale and ITRS/WGS84 routines. The fixed UTC test times are the TLE epoch and one hour later. `reference/generate_reference.py` reproduces these numbers without provider access; its separate Python dependencies are pinned in `reference/requirements.txt` and are **not** used by Maven or the production backend.

At the one-hour time the independent reference yields TEME position `(5245553.221649, 875882.115212, -4235873.375230) m`, TEME velocity `(-3859.158777, 5515.945720, -3646.518240) m/s`, ITRS position `(2360181.378210, -4765767.718096, -4235873.375230) m`, and WGS84 `(-38.7127913707°, -63.6537145463°, 429129.640797 m)`. Tests allow **0.01 m per TEME position component** and **0.0001 m/s per velocity component** to catch propagation changes while allowing rounding. For the Earth-fixed/geodetic cross-check they allow **150 m per Cartesian component, 0.002° per angle and 100 m altitude** because Skyfield's ITRS/time-orientation path differs from the pinned Orekit ITRF/EOP path; the observed one-hour Cartesian difference is tens of meters. These are software cross-check tolerances, not ISS orbit accuracy estimates.

## NASA OEM comparison trajectory

`GET /api/iss/orbit/comparison` is a separate Earth View contract; see its [field and failure specification](../docs/api/orbital-comparison.md). It returns 181 computed GP/TLE points from request time through one mean-motion revolution, with current index 0, and an optional NASA OEM predicted ephemeris path limited to actual vector coverage. The short `/samples` buffer remains mandatory and drives the default GP/TLE position. The frontend may select bounded OEM positions for the model and Inspection camera; `/state` retains its canonical computed GP/TLE semantics. Neither product is an onboard measurement or designated truth.

The NASA/JSC TOPO [current XML OEM](https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml) is fetched through a separate source adapter and validated for ISS/Earth/EME2000/UTC, CCSDS OEM 2.0, ordinal-year epochs and explicit km/km/s units. Source vectors are normalized to SI, bounded cubic Hermite interpolation supplies aligned display points, and Orekit transforms EME2000 to the pinned ITRF frame. PostgreSQL Flyway V2 keeps exact source bytes by SHA-256 and separate OEM creation, HTTP Last-Modified and MISSION1 retrieval times. The NASA current URL is mutable; no publication timestamp or per-point accuracy flag is invented. Successful fetches are cached for two hours; failures back off for 15 minutes. A stored file can be used within its covered time span with `DEGRADED` availability; absence or invalid coverage gives `UNAVAILABLE` within an otherwise successful primary response. These request intervals are local policy, not NASA cadence guarantees.

Offline tests use a labeled 2026-09-30 NASA XML excerpt for parsing, unit/frame rejection, time alignment and OEM failure, plus Testcontainers for V2 persistence and API contract coverage. The fixture is not a runtime fallback. `mvn test` and `mvn verify` do not require NASA availability.

## ITRF velocity delivery for visual orientation — 2026-09-30

The sample DTOs previously omitted the available physical velocity. They now add `velocityUnit:m/s` and three Earth-fixed velocity components at each existing sample UTC. GP forwards the propagated Orekit ITRF PV; OEM evaluates the analytic derivative of the existing bounded source-Hermite polynomial and transforms the complete EME2000 PV, including Earth rotation. Position samples, source classifications, quality, cadence, storage and deployment remain unchanged. The independent OEM centered-position-difference test detects a missing rotating-frame velocity term.

This additive contract enables frontend trajectory alignment; it supplies no verified attitude. [API contract](../docs/api/orbital-samples.md), [comparison contract](../docs/api/orbital-comparison.md), [measured review](../docs/frontend/inspection-orientation-review/README.md). Next milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Historical implementation notes

The dated sections below describe development milestones and their validation
checkouts. Their old migration counts, configuration selectors and source labels
are historical evidence. Current setup, schema and supported modes are defined
above and in ADR-0023; they do not require the development migration chain.

## Independent Crew source/domain foundation — 2026-10-03

`org.mission1.crew.domain` defines people/profiles, expeditions, assignments, independent physical-presence evidence, media rights, external IDs, observation hashes/times and conflict/result vocabulary. `crew.application` exposes separate structured/profile/document/verification ports. `source.crew.ll2.LaunchLibrary2CrewSource` implements dynamic active-expedition discovery and explicit profile enrichment using the existing Java HttpClient/Jackson stack. `source.crew.nasa.NasaCrewDocumentSource` captures explicitly chosen official documents; NASA RSS semantic parsing is now implemented in the V4 extension below.

At the completed source/domain foundation milestone, Crew was independent of Orbit/Orekit and `CrewConfiguration` registered inert capabilities using the UTC Clock, without persistence or polling. Current ingestion/persistence is described in the following section; there is still no immediate startup fetch; Crew REST is now implemented below, with frontend unchanged. Assignment and LL2 `in_space` do not prove physical ISS presence. See [Crew docs](../docs/crew/README.md) and [validated source contract](../docs/crew/source-validation/README.md).

| Setting | Environment override | Default |
| --- | --- | --- |
| `mission1.crew.ll2.base-url` | `MISSION1_CREW_LL2_BASE_URL` | `https://ll.thespacedevs.com/2.3.0/` |
| `mission1.crew.ll2.iss-external-id` | `MISSION1_CREW_LL2_ISS_EXTERNAL_ID` | `4`, verified external LL2 mapping for MISSION1 `ISS` |
| `mission1.crew.request-timeout` | `MISSION1_CREW_REQUEST_TIMEOUT` | `PT20S` |

A snapshot makes one bounded detailed-expedition request, retaining ambiguous candidates without pagination or per-person requests. Detail enrichment is explicit. Non-2xx/timeout/network/invalid payload failures return structured results without retry. The default test suite uses frozen fixtures and loopback/mock HTTP, with no LL2/NASA network requirement. Testcontainers still requires local Docker and the existing PostgreSQL image.

For one intentional live-source validation **after offline tests**, from `backend/`, using Java 21:

```sh
mvn -o test
mvn -o dependency:build-classpath -Dmdep.outputFile=target/crew-probe-classpath.txt
MISSION1_CREW_LIVE_VALIDATION=1 java -cp "target/test-classes:target/classes:$(cat target/crew-probe-classpath.txt)" \
  org.mission1.source.crew.ll2.LiveCrewValidation /tmp/mission1-crew-live-report.json
```

The manual main is not a JUnit test. It makes exactly one LL2 request, no retries/profile enrichment, and writes an external report. Confirm remaining provider budget before intentionally running it; do not use it in a refresh loop. API generation 2.3.0 is validated; a generation change needs revalidation, DTO/mapping review and fixtures. Current expedition IDs/names exist only in timestamped evidence/tests, never application constants.

## Crew ingestion and PostgreSQL history — 2026-10-03

[Persistence and ingestion](../docs/crew/persistence-and-ingestion.md) is the authoritative current Crew document. Flyway V3 adds nine Crew-only tables, using the existing JDBC/Flyway/PostgreSQL stack. `CrewIngestionService` receives validated structured LL2 results through the existing source port. `CrewRepository` atomically persists UUID identity anchors and immutable observation graphs; `CrewQueryService` follows the latest successful run to its snapshot. Two identical fetches produce two runs and one graph. A source/persistence failure preserves prior successful observations and records operational outcome. No canonical ISS presence is inferred from `in_space` or expedition membership.

| Setting | Environment override | Default |
| --- | --- | --- |
| `mission1.crew.ingestion.enabled` | `MISSION1_CREW_INGESTION_ENABLED` | `true` |
| `mission1.crew.ingestion.fixed-delay` | `MISSION1_CREW_INGESTION_FIXED_DELAY` | `PT2H`, minimum `PT1H` |
| `mission1.crew.ingestion.initial-delay` | `MISSION1_CREW_INGESTION_INITIAL_DELAY` | `PT5M`, minimum `PT1M` |

These are MISSION1 policies. Startup applies migrations and registers scheduling without an immediate Crew request. Persisted actual-attempt times also enforce scheduled eligibility after restart. Persisted `Retry-After` suppresses both manual and scheduled calls until eligibility; there are zero immediate retries. A normal refresh makes one expedition GET, no astronaut detail calls. A process-local guard prevents overlap. Tests disable both Crew and CelesTrak scheduling, and all default tests use fixture/loopback/mock sources plus real PostgreSQL Testcontainers, never H2 or public network dependence.

The existing local startup commands apply V4 automatically; no manual table setup is needed. Database unavailability can prevent completing a failed run; the scheduler logs this and continues future ticks. No failure erases observations. NASA semantic ingestion/reconciliation is implemented in V4 below; Crew REST is implemented below; frontend remains future work.

A controlled **one-request** live ingestion can use the same opt-in probe with persistence, after offline gates:

```sh
mvn -o dependency:build-classpath -Dmdep.outputFile=target/crew-probe-classpath.txt
MISSION1_CREW_LIVE_VALIDATION=1 java -cp "target/classes:target/test-classes:$(cat target/crew-probe-classpath.txt)" \
  org.mission1.source.crew.ll2.LiveCrewValidation /tmp/mission1-crew-live-ingestion.json --persist
```

The `--persist` mode boots the actual non-web application with both schedulers disabled, applies Flyway, makes one service ingestion, writes the run/snapshot/UUIDs/timing/counts to an external report and shuts down. It writes to the configured database; set `MISSION1_DB_URL` to a separately provisioned validation database when isolation is desired. Source-only mode retains its original one-path invocation. Do not run either probe in a retry loop.

## NASA Crew verification and reconciliation — 2026-10-03

[Authoritative design](../docs/crew/nasa-verification-and-reconciliation.md) and [validation dossier](../docs/crew/reconciliation-validation/README.md). Flyway V4 adds twelve Crew tables for exact raw documents, typed evidence, identity audits and immutable derived state, reusing V3 sync runs and UUIDs. Official NASA RSS uses conditional HTTP, secure XML and jsoup DOM parsing. Partial article coverage never means an exhaustive roster. Required-anchor failures preserve the prior capture and degrade current verification. Reconciliation remains separate from source parsing and preserves LL2 profile/assignment authority.

| Setting | Environment override | Default |
| --- | --- | --- |
| mission1.crew.verification.enabled | MISSION1_CREW_VERIFICATION_ENABLED | true |
| mission1.crew.verification.fixed-delay | MISSION1_CREW_VERIFICATION_FIXED_DELAY | PT2H, minimum PT1H |
| mission1.crew.verification.initial-delay | MISSION1_CREW_VERIFICATION_INITIAL_DELAY | PT10M, minimum PT6M |
| mission1.crew.verification.primary-max-age | MISSION1_CREW_PRIMARY_MAX_AGE | PT6H |
| mission1.crew.verification.fetch-max-age | MISSION1_CREW_VERIFICATION_FETCH_MAX_AGE | PT6H |
| mission1.crew.verification.current-assertion-max-age | MISSION1_CREW_CURRENT_ASSERTION_MAX_AGE | PT72H |
| mission1.crew.verification.event-implication-max-age | MISSION1_CREW_EVENT_IMPLICATION_MAX_AGE | P14D |

These are configurable project policies, not NASA guarantees. No immediate NASA startup request; one RSS request per normal tick, no retry or article/profile fetch. Independent schedulers trigger persisted-input reconciliation, with no provider coupling. `CrewReconciliationQueryService` is the internal read-only current interpretation/health entry point. Crew REST is now implemented below; Crew frontend remains future. Default tests disable all public-source scheduling and use mocks/fixtures/PostgreSQL Testcontainers.

After offline gates, an explicit manual validation can make **two NASA requests**, the second conditional, with both source schedulers disabled. It never fetches LL2; use a database already holding a dated validated LL2 snapshot. Provision a separate database if isolation is needed.

```sh
mvn -o test
mvn -o dependency:build-classpath -Dmdep.outputFile=target/crew-probe-classpath.txt
MISSION1_NASA_CREW_LIVE_VALIDATION=1 java -cp "target/classes:target/test-classes:$(cat target/crew-probe-classpath.txt)" \
  org.mission1.source.crew.nasa.LiveNasaCrewValidation /tmp/mission1-nasa-reconciliation.json
```

Production classes must precede test classes so the real datasource configuration is loaded. Set MISSION1_DB_URL when using a validation database. The optional `--report-only` argument exports retained PostgreSQL observations/current interpretation with **zero requests and zero writes**, including recovery after report export errors; it is not a retry mode. Do not loop live validation. Raw official fixture bytes are test-only, never a runtime fallback. Crash/total-database-outage IN_PROGRESS runs stay observable; abandoned-run recovery is deliberately deferred until ownership/liveness rules exist.

## ISS Crew REST API — 2026-10-03

- GET `/api/iss/crew`: effective reconciled interpretation, structured context, distinct counts, resolved members, unresolved NASA assertions, reconciliation/freshness/provenance.
- GET `/api/iss/expedition/current`: latest usable structured LL2 outcome; assignments do not establish physical presence. Explicit NO_ACTIVE_EXPEDITION returns 200/null expedition/empty assignments; later failures retain the last valid semantic state.
- GET `/api/iss/crew/{astronautId}`: persisted MISSION1 UUID person, including partial NASA-only and historically known identities; LL2 integer IDs are external mappings.

Every GET reads PostgreSQL in a read-only repeatable-read composition transaction. Zero NASA/LL2 requests, source refreshes, identity-resolution writes or reconciliation writes. Source failure/staleness retains useful state with quality; total absence gives 503. Unknown UUID gives 404, malformed UUID 400, sanitized internal errors 500 ProblemDetail. Official current count is nullable and distinct from resolved/member/assignment counts. Durations and timestamps are ISO-8601 strings; media rights remain attached. The subsequent Crew frontend consumes these resources; no new runtime configuration, migration, CORS/security change or production scheduler-default change. Cache-Control no-store avoids frozen age-based quality. [Full contract](../docs/api/crew-api.md), [HTTP/PostgreSQL/read-only/performance evidence](../docs/crew/rest-api-validation/README.md).

For source-isolated local HTTP validation, start the usual database/backend with temporary `MISSION1_CREW_INGESTION_ENABLED=false`, `MISSION1_CREW_VERIFICATION_ENABLED=false` and `MISSION1_CELESTRAK_REFRESH_ENABLED=false`. These runtime overrides do not change committed defaults. Read known UUIDs from `/api/iss/crew`; then request the detail resource. All default tests are offline, with real PostgreSQL Testcontainers where applicable.

## Bounded Crew event validation (explicit live opt-in)

After offline tests and classpath generation, use Java 21:

```sh
MISSION1_CREW_EVENT_LIVE_VALIDATION=1 java -cp "target/classes:target/test-classes:$(cat target/crew-probe-classpath.txt)" \
  org.mission1.source.crew.ll2.LiveCrewEventRefreshValidation /tmp/mission1-crew-event-live.json
```

This probe disables all automatic source schedules, migrates the configured PostgreSQL database to V5, persists one calendar request and one roster request, then checks the accepted NASA conditional pipeline (one request, with a second only following 200). It has no retries or enrichment. The result report retains URI, timestamps, hash, candidate history and sync-run lineage. Use a disposable database for repeat experiments; do not run this as a default test or startup hook.


## Replay integration — 2026-10-03

Read-only Mission Replay endpoints are available at /api/iss/replay?at=<UTC instant> and /api/iss/replay/coverage. They use retained source/evidence only, with independent Crew/orbit availability. Configure mission1.replay.gp-max-offset (default PT24H, positive and at most PT24H). [Contract](../docs/api/replay-api.md).


## Crew source occurrence versioning — ADR-0012 / Flyway V6

Normal startup runs an idempotent additive Crew occurrence backfill after Flyway; successful NASA ingestion maintains the same links atomically with evidence/run completion. It reads retained RSS, makes no additional source requests and never changes old evidence or subject rows. Current/Replay reads share the pure successful-capture selector and perform no backfill or identity writes.

For a read-only pre-migration association preview, launch with `--spring.main.web-application-type=none --spring.flyway.enabled=false --mission1.crew.occurrences.backfill-mode=DRY_RUN` and all source schedulers disabled as in the existing offline validation commands. The preview supports the legacy V5 schema and logs evidence/assertion/subject/version/conflict/ambiguous/unassociated counts. `APPLY` is the normal backfill mode; `OFF` skips startup association writes. Do not disable Flyway for normal serving. A downgrade can use the previous application against V6's additive tables; it restores previous version-row interpretation without deleting evidence or reversing migration history.

Full Java21/PostgreSQL migration, backfill, rollback, source-identity, selector and Current/Replay regression tests are documented in [the validation dossier](../docs/crew/source-occurrence-versioning-validation/README.md). Frontend runtime/DTO shape and NASA profile enrichment are unchanged.


## Canonical Crew identity — ADR-0013 / V7

[Identity/profile policy](../docs/crew/canonical-identity.md) and [validation](../docs/crew/canonical-identity-validation/README.md). Additive reviewed bindings, UUID equivalence and proof rows preserve V1–V6 histories. Startup `mission1.crew.identity.review-mode` supports `OFF`, `DRY_RUN`, `APPLY` (default). Apply/revoke/supersede run transactionally outside GET; pending declarations never create people. Successful source writes synchronize the approved provider-key manifest under the shared identity lock. Current/Replay/detail use batch canonical reads, with aliases returning 200 and latest retained LL2 profiles independent of assignment membership. Default tests disable startup synchronization and all source schedules.

## NASA editorial Crew shadow source

[ADR-0014 implementation and validation](../docs/crew/nasa-editorial-roster-validation/README.md) adds generic NASA research-topic/taxonomy/Expedition acquisition and immutable V8 observations. `MISSION1_CREW_EDITORIAL_ENABLED` defaults true; initial delay15m and fixed delay2h are configurable conservatively. Discovery caches6h, taxonomy/personal resources7d and negative profile404 responses6h. A durable lease survives scheduler restart, and shared NASA budget/cooldown paces operational and editorial HTTP. No startup HTTP, GET acquisition, public editorial route, Current/Replay activation or automatic human identity decision is added. Set the flag false to pause scheduled collection while retaining internal read/explicit acquisition capabilities; do not reverse Flyway or delete source history.
## Automatic Crew identity SHADOW

[ADR-0015 and validation](../docs/crew/automatic-identity-shadow-validation/README.md) add V9 automatic identity history/jobs/graph without changing production V7. `mission1.crew.identity-research.enabled` defaults true; a bounded16-job worker polls every minute after15minutes, with a durable daily safety sweep. `false` pauses that worker; retained sources and public reads stay independent. Missing/invalid frozen model artifacts fail closed and expose separate resolver health. Scoring is Java21, retained-evidence-only and network-free. There is no production promotion flag, runtime training or per-person approval requirement for shadow. Explicit local validation uses the documented standalone runner outside application startup.

## Crew active membership shadow — ADR-0016 / Flyway V10

The independent `crew.membership` overlay uses retained JDBC inputs only. Its internal `ActiveMembershipStore.latest()`/`health()` expose immutable revisions and separate resolved humans, retained humans, unresolved slots, supports, counts, findings and stream health. `LegacyMembershipComparison.read()` compares to V7/public Current after materialization. No public REST endpoint/DTO or Replay dependency is added.

`MISSION1_CREW_ACTIVE_SHADOW_ENABLED` defaults to true. The bounded worker starts after `MISSION1_CREW_ACTIVE_SHADOW_INITIAL_DELAY` (PT15M), then reconciles every `MISSION1_CREW_ACTIVE_SHADOW_FIXED_DELAY` (PT1M, minimum one minute), independently of GET. PostgreSQL notifications preserve generation across restart; each tick also evaluates expiry. Editorial roster/topic maximum ages default to PT6H; personal-resource health to P7D via `MISSION1_CREW_ACTIVE_SHADOW_ROSTER_MAX_AGE`, `MISSION1_CREW_ACTIVE_SHADOW_TOPIC_MAX_AGE` and `MISSION1_CREW_ACTIVE_SHADOW_PERSONAL_MAX_AGE`. Existing LL2/operational temporal properties remain authoritative. All default tests disable the worker and use offline fixtures/Testcontainers. See the [algorithm, retained-data runner and acceptance dossier](../docs/crew/active-membership-shadow-validation/README.md).


## NASA completed named departures and retained reinterpretation

Parser 1.1.0 supports verified named ISS undocking with explicit date-sensitive EDT/EST time and
MINUTE precision. No migration is added. New timed departure assertions are shadow V10 inputs;
Current/Replay use the explicit public legacy eligibility boundary. Identity scoring remains separate.
See [ADR-0009](../docs/adr/0009-field-aware-crew-reconciliation.md) and the
[validation dossier](../docs/crew/nasa-operational-departure-validation/README.md).

The explicit application command reinterprets up to32 retained operational bodies under the current
parser, preserving original capture/HTTP metadata and all failed interpretations. It performs no
network, identity scoring or health reset. From the repository root, after building with Java21:

```sh
IFS= read -r departure_dependencies < /tmp/mission1-active-classpath.txt
javac -cp "backend/target/classes:$departure_dependencies" -d /tmp/mission1-departure-validation-classes \
  docs/crew/active-membership-shadow-validation/scripts/ActiveMembershipValidation.java \
  docs/crew/nasa-operational-departure-validation/scripts/DepartureValidation.java
java -cp "/tmp/mission1-departure-validation-classes:backend/target/classes:$departure_dependencies" \
  DepartureValidation /absolute/output/reprocessing.json
```

Generate the classpath first with backend `mvn dependency:build-classpath
-Dmdep.outputFile=/tmp/mission1-active-classpath.txt`, and create the output/classes directories.
The runner disables all schedules/startup review/backfill, executes the supported command, then
explicitly materializes V10 from persisted inputs and exports source/identity/precision/SQL/timing
lineage. Repeat in a fresh process to verify idempotency. Append `--live` to intentionally execute
one normal operational acquisition instead; it honors the existing gate/cooldown and records actual
HTTP/hash/time/parse state. Neither mode calls production reconciliation or V9 evaluation. There is
no automatic startup reprocessing, public write endpoint or frontend change.

## Production Current active membership — ADR-0017

Default `MISSION1_CREW_CURRENT_MEMBERSHIP_MODE=ACTIVE_PROJECTION` makes `/api/iss/crew` read the latest compatible sealed V10 revision through a SELECT-only reader, then publish ACTIVE humans through the established V7 canonical/profile layer. The worker retains its existing independent source/expiry cadence; GET does not acquire, score or materialize. Missing/incompatible/incomplete/UNAVAILABLE projections return scoped 503 without fallback. Revision age and independent source health remain explicit.

For deliberate operational rollback, start with `MISSION1_CREW_CURRENT_MEMBERSHIP_MODE=LEGACY_RETAINED_UNION` (or `--mission1.crew.current.membership-mode=LEGACY_RETAINED_UNION`). Restart to apply the configuration. Clear the override/restart to reactivate. No migration reversal, identity switch, source/history deletion or Replay change is involved. Do not leave rollback configured after acceptance. See [activation validation and diagnostics](../docs/crew/current-active-projection-activation/README.md).

## Current operational observations (ADR-0019)

NASA operational parser1.2.0 emits conservative named onboard activity observations through the immutable pipeline. Current OBSERVED applicability is seven days (`P7D`/`PT168H`); entry remains fourteen days, counts seventy-two hours and public Replay v1. Retained bodies can be reinterpreted additively using `NasaOperationalReprocessingService`; normal reconciliation and V10 materialization occur outside GET. No migration or general V9 promotion is added. [Grammar, real sources, Testcontainers turnover, GET audit and performance](../docs/crew/current-operational-presence-validation/README.md).

## S10 operational subject binding shadow — ADR-0020 / Flyway V11

The retained-input `crew.operational` linker has no production consumer. `MISSION1_CREW_OPERATIONAL_SHADOW_ENABLED` defaults true; initial delay 15m, evaluation 1m and acquisition 5m are separate background schedules. Setting it false pauses scheduled work while retaining history and explicit internal validation capability. Never reverse V11 or delete history to roll back shadow evaluation.

V11 adds immutable policy/resource/attempt/binding/candidate/proof history, mutable leased work and append-only request reservations. New cache bodies are deduplicated by URL/hash/parser; compatible V8 personal captures are referenced in place. Refresh is seven days, last-good proof validity 30 days and ordinary failure retry 1h; bounded Retry-After can extend it. Strict HTTPS/host/path classes, checked same-host redirects, public-address checks, 2MiB bodies, 20s requests and bounded host budgets constrain acquisition. The S10 LL2 budget is 3/hour, with a 15/hour combined guard and existing provider cooldown; NASA also uses its shared gate. Source discovery seeds can be overridden with `mission1.crew.operational-binding.resource-seeds`; they are verified resource URLs, never human mappings. Unsupported source classes defer.

The resolver uses pinned ICU4J 78.3 for generic comparison transliteration and the already frozen Java logistic scorer. No new AI, fitting API, Python runtime, semantic model, vector/graph database, broker or service is added. Missing proof, incomplete candidates, unknown publication target and contradictions fail closed. GET performs no S10 work. [Source/schema/threshold/correction/GET/performance/dependency acceptance](../docs/crew/operational-subject-binding-shadow-validation/README.md).
