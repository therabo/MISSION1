# Architecture baseline V1

Status: selected design baseline, revised **2026-09-28** by [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md) after [orbital-element verification](../telemetry/orbital-elements-verification.md). The orbital core, quality policy, PostgreSQL element history, current-state read API, [provider-respecting refresh](../telemetry/celestrak-refresh-policy.md), bounded [Earth View sample delivery](04-earth-view-orbital-delivery.md), and first [Cesium Earth View](../../frontend/README.md) are implemented. Earlier SSCWeb and ISSLive verification remains valid within its stated scope.

The [final ISS-E SupGP source-selection check](../telemetry/iss-supgp-source-selection.md) retained standard GP as the current `PRIMARY` element source and marked ISS-E `DEFERRED` until exact segment validity and selection semantics are verified. The TLE/Orekit core, [element-set persistence](../telemetry/orbital-element-history.md), [current-state API](../../backend/README.md#current-orbital-state-api), [sample-window API](../api/orbital-samples.md), and first Earth View are implemented and tested. No SupGP production selection or alternate propagator is part of the current path.

## Goal and first end-to-end slice

**CelesTrak GP TLE for ISS/NORAD 25544 → orbital-element adapter → validated and persisted element set → in-process Orekit SGP4/SDP4 propagation at requested UTC → TEME state → Orekit ITRF/WGS84 conversion → REST API.** The position and velocity are computed model outputs, not onboard measurements. One Spring Boot backend and PostgreSQL suffice. [The roadmap](03-repository-and-roadmap.md) places Cesium, scheduled refresh and track display in MVP2.

Element-set update and position update are different operations. The current API reads persisted elements only; a delayed scheduler independently refreshes from CelesTrak under the [retrieval policy](../telemetry/celestrak-refresh-policy.md). Never fetch once per animation frame or per API read. The current endpoint evaluates the retained validated set at one injected clock time. A frequently changing display does not imply frequently arriving source data. No 1 Hz push rate, propagation horizon, or numerical accuracy is asserted without client needs and tests.

## Logical and deployment view

```text
CURRENT IMPLEMENTABLE PATH (one backend process except PostgreSQL)
CelesTrak GP / CATNR=25544 / FORMAT=TLE
  → CelesTrakOrbitalElementsAdapter (HTTPS, validation, fetch status)
  → OrbitalElementsSource port → versioned OrbitalElementSet → PostgreSQL
  → OrbitalPropagation port / Orekit TLEPropagator.selectExtrapolator
  → TEME position + velocity at requested UTC
  → Orekit TEME → ITRF → WGS84 geodetic coordinates
  → OrbitalState (computed, element lineage, age, quality)
  → REST current-state API → later Cesium Earth View

FUTURE INDEPENDENT PATHS
ISSLive / Lightstreamer → StreamingTelemetrySource → subsystem telemetry
NASA OEM → PredictedEphemerisSource → NASA predicted trajectory
NASA SSCWeb → ReferenceEphemerisSource → secondary comparison/history
```

These ports reflect different interaction models. Do not force an element query, callback stream and ephemeris file/query behind one shapeless `ExternalSource` contract. The browser calls MISSION1, not providers. Provider HTTP/DTOs remain in adapters; Orekit in flight dynamics; domain time roles, quality, IDs and classifications remain provider-neutral. No Kafka, orbital microservice, gateway or Kubernetes is justified.

## Components and dependencies

| Boundary | Responsibility | Failures and tests |
| --- | --- | --- |
| `OrbitalElementsSource` / CelesTrak adapter | Fetch only `CATNR=25544&FORMAT=TLE` on explicit MVP1 acquisition; honor [usage policy](https://celestrak.org/usage-policy.php); validate identity, line structure/checksums and Orekit parse; record `retrievedAtUtc` and fetch status. Publication time unknown. | Reject bad/empty/mismatched data. A non-200 response stops automated queries per provider policy, retains the last valid set and exposes degraded status for investigation. Offline fixtures and optional live smoke. |
| Orbital domain/application | Select last valid set; preserve source, element epoch, lines/hash, retrieval and lineage. Evaluate `OrbitalState at Instant t` with injectable clock for `now`; enforce a bounded time/age policy. | `NO_DATA` without elements, `INVALID` on processing failure, `STALE` by documented project policy. Fetch health separately. Frozen-time tests. |
| Orekit flight dynamics | `TLEPropagator.selectExtrapolator(TLE)` selects SGP4/SDP4 for GP mean elements; output TEME PV in m/m/s; Orekit transforms at same instant to ITRF and WGS84 geodetic point. | Explicit failure for absent auxiliary/EOP data or transform error. No manual SGP4/Earth rotation, generic Kepler, silent fallback, or unsafe shared mutable propagator. Independent numerical reference tests. |
| PostgreSQL adapter | Persist coherent validated source element sets and separate retrieval observations; computed current state is reproducible from set, time and method/data version. Persist selected computed samples only for a demonstrated history need. | Deduplicate by provider, catalog and TLE-content SHA-256; preserve repeat retrieval times without overwriting revisions. Flyway and PostgreSQL Testcontainers integration tests. |
| REST adapter | Return coherent computed state at `propagationTime` with frame/unit labels, WGS84, source element identity/age, quality policy and small operational source-health snapshot. An optional bounded `at` query is later. | Explicit no-data and processing errors; never zero coordinates. Contract tests. |

Dependencies point inward: domain does not import provider, Orekit, HTTP or SQL types; controller does not directly query provider or database. Orekit moves into **MVP1**. `OrbitalElementSet` and `OrbitalState` have no invented Module/Subsystem parent. Future subsystem telemetry retains separate `TelemetryParameter`/`TelemetrySample` concepts.

## Data, timestamps, quality and provenance

**Source input:** `iss.orbit.gp_elements` denotes a source-provided GP/TLE set, not an ISS telemetry channel. Preserve `CELESTRAK_GP`, upstream `USSF_GP_VIA_CELESTRAK`, NORAD `25544`, format `TLE`, both raw lines, element epoch, MISSION1 retrieval time and content identity. Provider publication time and per-set accuracy are `UNKNOWN`/`null`; HTTP `Date` is transport time, not publication time.

**Computed output:** `iss.orbit.propagated_state` denotes a computed product with propagation time, TEME position/velocity, WGS84 point, source element ID/epoch, signed `propagationOffset = propagationTime − elementEpoch`, method/version, quality and `COMPUTED_FROM_ORBITAL_ELEMENTS`. Current `elementEpochAge = evaluationTime − elementEpoch` and `retrievalAge = evaluationTime − retrievedAt` are separate. State at now is real-time **calculation from the latest available elements**, never `LIVE_ONBOARD_TELEMETRY` or `MEASURED`. Future track points are `COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS`; NASA OEM is distinct `PREDICTED_EPHEMERIS`. API conversion from internal m/m/s and rad/m must label output units. Any scalar speed must name its frame.

`GOOD`, `STALE`, `NO_DATA`, `INVALID`, `UNKNOWN` are MISSION1-derived. Orbit-element age policy differs from later ISSLive sample freshness. Successful math is not proof of observed truth or positional accuracy. The [current-state age threshold](../telemetry/orbital-quality-policy.md) is a documented application rule with deterministic boundary tests, not a USSF/CelesTrak guarantee. A general nearby-time propagation window remains deferred; non-current calculations receive `UNKNOWN` current-display quality. Provider fetch failure does not retroactively corrupt stored elements; a retained set can support a transparently stale estimate.

The [source registry](../telemetry/source-registry.yaml) records evidence and readiness without importing the ISSLive dictionary. External identifiers remain mappings, never canonical domain identity.

## REST, delivery and runtime

The implemented read operation is [`GET /api/iss/state`](../../backend/README.md#current-orbital-state-api), without an `at` parameter. It uses an injectable UTC clock and returns propagation time, element epoch/retrieval time, nullable publication time, signed age, TEME PV and WGS84 coordinates with explicit units, source/upstream, computed classification, quality policy and separate source-health snapshot. Empty history returns 503; a valid stale computation remains 200. A standalone source-status resource and bounded historical or future `at` queries remain later capabilities. No `LIVE` boolean follows from asking for now.

MVP2 now exposes a bounded `GET /api/iss/orbit/samples` visual window: one request-time TLE selection and one Orekit propagator produce timestamped ITRF positions, with shared lineage and current-time quality. The measured [interpolation experiment](04-earth-view-orbital-delivery.md) supports 10-second linear samples and a 120-second REST refresh; Cesium can render between those samples at its own frame rate. This short path does not assert historical truth or provide a full-orbit ground track. `GET /api/iss/state` stays separate for exact current/status reads. SSE/WebSocket remain deferred pending a measured need. The frontend never queries CelesTrak per frame.

Pin Java/Spring Boot/Orekit and reproducible Orekit auxiliary/EOP data when implemented; verification used [Orekit 13.1.8 APIs](../telemetry/orbital-elements-verification.md). Offline deterministic tests cover syntax/checksums/identity, epoch, SGP4/SDP4 where applicable, frozen PV/frame/geodetic outputs against independent references, age boundaries, clock, database revisions and API labels/errors. One optional live smoke verifies provider reachability. The first end-to-end demo sends one genuinely fetched validated public element set through adapter → persistence → Orekit → REST with all time roles distinct. Operational metrics track fetches, last-valid age, rejects, propagation failures and DB health as platform diagnostics, not spacecraft alarms.

**Orbital-core implementation detail (2026-09-28):** the first backend pins Java 21, Spring Boot 3.5.6 and Orekit 13.1.8. It packages UTC–TAI history and IAU-2000 `finals2000A.all` EOP from a pinned Orekit-data revision, uses a private data context, and transforms TEME to **ITRF 2020 / IERS 2010 with full EOP corrections** before WGS84 conversion. Canonical internal units are m, m/s, rad and `Instant`/`Duration`. EOP coverage is checked explicitly. [Backend implementation notes](../../backend/README.md) record file hashes and independent reference tolerances. The core propagator alone returns `UNKNOWN`; the [versioned MISSION1 current-state quality policy](../telemetry/orbital-quality-policy.md) classifies a computed state using explicit evaluation time, element epoch, and a 24-hour operational boundary. Source acquisition health remains separate and is not inferred from stored elements. The newly approved bounded visual sample window is not a general historical/replay query or a position-accuracy guarantee.

## Other sources and decisions

`NASA_SSCWEB` is verified for queryable TLE-derived `Geo` ephemeris, but is **secondary/reference**, not ground truth for GP or the first position API. `ISS_LIVE` remains a future streaming adapter, currently `BLOCKED_BY_PUBLIC_SOURCE`; add it only after payload/semantics verification. `NASA_OEM` is a separate predicted ephemeris for later comparison. None is interchangeable with a GP element set.

[ADR-0001](../adr/0001-single-backend-and-in-process-pipeline.md), [ADR-0002](../adr/0002-postgresql-for-initial-history.md) and [ADR-0003](../adr/0003-verified-source-mapping-and-value-semantics.md) remain accepted. [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md) selects local propagation; no earlier ADR is superseded.
