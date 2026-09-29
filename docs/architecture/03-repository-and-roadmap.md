# Repository structure and incremental roadmap

This is the implementation order for the revised [Architecture Baseline V1](02-architecture-baseline-v1.md) and [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md). The repository contains a working standard-GP adapter, deterministic Orekit orbital core, quality policy, PostgreSQL element history, current-state read API and controlled refresh in `backend/`, plus a Cesium Earth View in `frontend/`. The [ISS-E SupGP source-selection gate](../telemetry/iss-supgp-source-selection.md) retains standard GP as `PRIMARY` and defers SupGP pending exact segment semantics.

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
│       │   ├── propagation/    # Orekit TLE/SGP4-SDP4, TEME/ITRF/WGS84
│       │   └── persistence/    # PostgreSQL element-set adapter
│       ├── source/orbital/celestrak/  # GP HTTPS adapter
│       └── api/                # current-orbit REST; source status later
├── docs/
└── frontend/                   # added for Cesium in MVP2
```

The package tree is illustrative; dependency direction and ownership matter more than exact directory spelling. `OrbitalElementsSource` is distinct from future `StreamingTelemetrySource`, `PredictedEphemerisSource` and `ReferenceEphemerisSource`. No Kafka, microservices or Kubernetes are part of the first slices.

## Exact implementation sequence

1. **Completed — MVP1 orbital core:** one Spring Boot/Maven backend with CelesTrak `CATNR=25544&FORMAT=TLE` adapter, source-element domain record, Orekit 13.1.8 TLE propagation and offline deterministic parsing/propagation tests. A real fixture and independent reference values are recorded in `backend/README.md`.
2. **Completed — orbital quality/freshness policy:** [versioned current-state policy](../telemetry/orbital-quality-policy.md) distinguishes retrieval age, element epoch age, signed propagation offset, source health and computation outcomes. Its 24-hour boundary is **MISSION1-defined**, not the CelesTrak two-hour download rule or an accuracy guarantee. Standard GP remains primary; SupGP segment selection remains deferred.
3. **Completed — PostgreSQL element history:** [Flyway schema and JDBC adapter](../telemetry/orbital-element-history.md) retain validated sets and repeated retrieval observations with database-enforced identity. A latest-usable query uses source epoch and observed time; no scheduler or source-health event store was introduced.
4. **Completed — current orbital-state application service and read-only REST endpoint:** `GET /api/iss/state` computes from `latestUsable(now)` using one injected clock instant, Orekit, and the existing quality policy. Its [contract](../../backend/README.md#current-orbital-state-api) exposes source lineage, explicit units, computed classification and structured no-data/errors. It makes no provider request and does not claim live onboard telemetry.
5. **Completed — provider-respecting CelesTrak refresh orchestration and source-health tracking:** a delayed single-process scheduler, [retrieval policy](../telemetry/celestrak-refresh-policy.md), persisted observation lookup, one-request refresh result and process-local operational health run independently of API reads. The REST state adds a small health snapshot; orbital quality remains separate.
6. **Completed — Cesium Earth View data-delivery path:** the [REST sampled-window decision](04-earth-view-orbital-delivery.md) is supported by an offline interpolation experiment, bounded `GET /api/iss/orbit/samples`, one-set lineage, API tests and local size/cost measurements. Provider fetch cadence, backend delivery cadence and browser rendering rate remain distinct.
7. **Completed — React/TypeScript + CesiumJS Earth View:** the [first view](../../frontend/README.md) consumes the sampled REST window, renders one ISS marker and bounded path, and shows backend WGS84, independent quality/acquisition state and buffer health. The backend contract is unchanged.
8. **Completed — first detailed NASA ISS GLB in Cesium:** the [asset record](../frontend/iss-model.md) documents source verification, optimization, hierarchy and 2019 configuration limits. The model shares the sampled orbital position; its physical asset scale is 1 while its bounded Earth View display size is intentionally exaggerated and **not to scale**. Its pose is display-only local ENU; ISS attitude remains unavailable.
9. **Completed — interactive ISS station inspection:** the [feature-tagged NASA model](../frontend/iss-model.md) directly picks verified component geometry, with a static information panel and no module telemetry. The [cinematic inspection interaction](../frontend/iss-inspection-mode.md) moves the camera from Earth Overview to a sampled-position-following ENU station pivot and back without a second Viewer or orbital calculation.
10. **Completed — evidence-backed semantic station map:** all 132 asset nodes were classified in the [review matrix](../frontend/iss-semantic-review.json). The [semantic map](../frontend/iss-semantic-map.md) promotes 11 more identities, retaining Destiny/Columbus/Harmony feature IDs. Mapping and current configuration have independent statuses; Pirs is verified model geometry but documented as removed from the current station.
11. **Completed — progressive approach and illuminated Earth:** the [inspection interaction](../frontend/iss-inspection-mode.md) approaches the moving sampled ISS through a world-space flight and a local close phase before enabling the station pivot. Cesium scene-time solar lighting shows the terminator.
12. **Completed — graphics optimization and regression review:** the [rendering quality pass](../frontend/rendering-quality.md) uses tiled historical NASA GIBS Blue Marble day and Black Marble night imagery with local fallbacks, a NASA Tycho skybox, native scene-time Sun, and a source-quality PNG NASA station derivative. The model preloads before inspection and waits for complete texture and semantic readiness. Served-production picking, outage fallback, cold loading and repeated camera transitions were checked. These are frontend presentation changes; orbital delivery and data classification are unchanged.
13. **Next single task — assess historical versus current geometry presentation:** evaluate how to represent the difference between the NASA VTAD source-model configuration and the current station, without fabricating geometry or conflating it with computed orbital position. Do not start geometry replacement until authoritative current asset coverage and provenance are established.

## Phase gates

| Phase | Scope | Gate and display semantics |
| --- | --- | --- |
| MVP1 | Single backend, CelesTrak GP/TLE acquisition, Orekit SGP4/SDP4, TEME PV, ITRF/WGS84, PostgreSQL element sets, current-state REST, deterministic tests | Current orbital state is `COMPUTED_FROM_ORBITAL_ELEMENTS`. No raw GP redistribution claim or onboard measurement label. Exact age window and reproducible Orekit data tested. |
| MVP2 | Scheduled refresh, bounded short-path REST sample delivery and first Cesium Earth View implemented; full ground track and selected history remain planned | Each sample window uses one named element set. Past visual points are reconstructed, future points are computed GP/TLE predictions; no full-orbit or replay claim. Rendering rate is independent of network frequency. Periodically recheck ISSLive availability without gating Earth View. |
| MVP3, conditional | ISSLive streaming adapter and subsystem panels; station attitude only after channel and convention evidence. The first static NASA station model is already in MVP2. | At least one real payload and verified meaning/unit/time for each mapped channel. Current ISSLive status: `BLOCKED_BY_PUBLIC_SOURCE` in bounded 2026-09-28 observation, not permanent discontinuation. |
| MVP3 | NASA OEM predicted trajectory, separately labeled comparison, replay/alarms when meaningful data exists | OEM is independent predicted ephemeris; do not call GP propagation NASA prediction or mark SSCWeb comparison ground truth. |

NASA SSCWeb's verified, TLE-derived `Geo` epoch positions remain a **secondary/reference/history** option, not the MVP1 position source or mandatory validator. Direct Space-Track GP and OMM ingestion are future reviewed options; no automatic provider failover in MVP1. No orbital state vector is expected from the silent ISSLive bridge.

## Test and operations priorities

Offline tests freeze element lines, element epoch and requested UTC time. Include invalid checksums/catalog mismatch, propagation across supported cases, independent TEME PV reference, ITRF/WGS84 transformation, time/age boundaries, injected clock, database revisions and REST provenance. Do not compare Orekit only to itself. Keep a separate optional source smoke test so CI does not depend on public network availability. Log provider fetch/parse failure, last valid element age, propagation/frame failures and DB status separately from ISS health.
