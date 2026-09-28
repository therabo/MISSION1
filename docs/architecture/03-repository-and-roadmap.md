# Repository structure and incremental roadmap

This is the implementation order for the revised [Architecture Baseline V1](02-architecture-baseline-v1.md) and [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md). The repository now contains a working standard-GP adapter and deterministic Orekit orbital core in `backend/`; persistence, API and frontend directories below are **planned**. The [ISS-E SupGP source-selection gate](../telemetry/iss-supgp-source-selection.md) retains standard GP as `PRIMARY` and defers SupGP pending exact segment semantics.

## Current documentation

```text
MISSION1/docs/
├── architecture/   # review, baseline, roadmap
├── adr/            # accepted architectural decisions
└── telemetry/      # source evidence, including GP, SSCWeb, ISSLive, OEM
```

## Planned single-backend layout

```text
MISSION1/
├── backend/                    # one Java/Spring Boot/Maven process
│   └── src/main/java/.../
│       ├── orbital/
│       │   ├── domain/         # OrbitalElementSet, OrbitalState, age/provenance
│       │   ├── application/    # acquire/select elements, state(t), injected clock
│       │   └── propagation/    # Orekit TLE/SGP4-SDP4, TEME/ITRF/WGS84
│       ├── source/orbital/celestrak/  # GP HTTPS adapter
│       ├── persistence/        # PostgreSQL element-set adapter
│       └── api/                # current-orbit REST, source status
├── docs/
└── frontend/                   # added for Cesium in MVP2
```

The package tree is illustrative; dependency direction and ownership matter more than exact directory spelling. `OrbitalElementsSource` is distinct from future `StreamingTelemetrySource`, `PredictedEphemerisSource` and `ReferenceEphemerisSource`. No Kafka, microservices or Kubernetes are part of the first slices.

## Exact implementation sequence

1. **Completed — MVP1 orbital core:** one Spring Boot/Maven backend with CelesTrak `CATNR=25544&FORMAT=TLE` adapter, source-element domain record, Orekit 13.1.8 TLE propagation and offline deterministic parsing/propagation tests. A real fixture and independent reference values are recorded in `backend/README.md`.
2. **Completed — orbital quality/freshness policy:** [versioned current-state policy](../telemetry/orbital-quality-policy.md) distinguishes retrieval age, element epoch age, signed propagation offset, source health and computation outcomes. Its 24-hour boundary is **MISSION1-defined**, not the CelesTrak two-hour download rule or an accuracy guarantee. Standard GP remains primary; SupGP segment selection remains deferred.
3. **Next single task — PostgreSQL element history:** add durable element-set/revision storage, last-valid selection and source fetch status. Guard MVP1 startup/explicit fetches with a shared cache and bounded rate per [CelesTrak usage policy](https://celestrak.org/usage-policy.php); retain cached elements during provider failure, with degraded status and age shown. Stop automated queries on non-200 responses until investigated, per provider policy.
4. Add REST current-state and source-status contracts with explicit source/element/propagation time, frames/units, computed classification and no-data/invalid/stale outcomes. Demonstrate one real fetched set through adapter → storage → Orekit → REST. This completes the MVP1 backend slice; the state is computed, not live onboard telemetry.
5. In MVP2 add scheduled element refresh and cache policy, bounded historical/near-future `state(t)` evaluation, justified track sampling and Cesium Earth View. Keep backend state update cadence separate from element cadence and browser rendering rate; interpolate display states only with clear lineage. Use REST polling until a measured need justifies WebSocket.

## Phase gates

| Phase | Scope | Gate and display semantics |
| --- | --- | --- |
| MVP1 | Single backend, CelesTrak GP/TLE acquisition, Orekit SGP4/SDP4, TEME PV, ITRF/WGS84, PostgreSQL element sets, current-state REST, deterministic tests | Current orbital state is `COMPUTED_FROM_ORBITAL_ELEMENTS`. No raw GP redistribution claim or onboard measurement label. Exact age window and reproducible Orekit data tested. |
| MVP2 | Scheduled refresh, Cesium Earth View, local ground track/near-future path, selected history; optional push only if useful | Track and future samples are computed from named elements; refresh rate follows provider policy, rendering rate is independent. Periodically recheck ISSLive availability without gating Earth View. |
| MVP3, conditional | ISSLive streaming adapter and subsystem panels; detailed station model/attitude only after channel and convention evidence | At least one real payload and verified meaning/unit/time for each mapped channel. Current ISSLive status: `BLOCKED_BY_PUBLIC_SOURCE` in bounded 2026-09-28 observation, not permanent discontinuation. |
| MVP3 | NASA OEM predicted trajectory, separately labeled comparison, replay/alarms when meaningful data exists | OEM is independent predicted ephemeris; do not call GP propagation NASA prediction or mark SSCWeb comparison ground truth. |

NASA SSCWeb's verified, TLE-derived `Geo` epoch positions remain a **secondary/reference/history** option, not the MVP1 position source or mandatory validator. Direct Space-Track GP and OMM ingestion are future reviewed options; no automatic provider failover in MVP1. No orbital state vector is expected from the silent ISSLive bridge.

## Test and operations priorities

Offline tests freeze element lines, element epoch and requested UTC time. Include invalid checksums/catalog mismatch, propagation across supported cases, independent TEME PV reference, ITRF/WGS84 transformation, time/age boundaries, injected clock, database revisions and REST provenance. Do not compare Orekit only to itself. Keep a separate optional source smoke test so CI does not depend on public network availability. Log provider fetch/parse failure, last valid element age, propagation/frame failures and DB status separately from ISS health.
