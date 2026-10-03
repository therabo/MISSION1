# Repository structure and incremental roadmap

**Current Crew milestone (2026-10-03):** [Event-aware refresh](../crew/event-aware-refresh.md) adds a Clock-driven coordinator and five PostgreSQL table groups via V5, retaining the modular monolith and source/reconciliation boundaries. [ADR-0010](../adr/0010-crew-event-aware-refresh.md) records the choice. Orbit and frontend runtime remain frozen. Next single milestone: **ISS CREW REPLAY INTEGRATION**, not started; earlier roadmap entries below are historical where they name an earlier next step.

## Explicit camera focus refinement — 2026-10-01

Earth↔ISS now uses an explicit positive focal ray independently of the retained cubic/hybrid position path. It captures the actual Earth composition and actual orbited/zoomed Inspection pose, blends a quaternion rail with smooth angular containment around the displayed station, and retains focal as well as pose derivatives on partial Back. There is no target threshold switch or final recenter. The canonical 90m /42.5° /100° and 6/5s remain; captured range/angle gives bounded durations for other starts. The same selected-source physical frame, lift/silhouette/FOV, native resolution and NASA PNG/PBR asset remain. Automatic motion copies the public world camera basis, avoiding Cesium’s nadir heading/roll conversion. Graphics readiness requires the retained Moon/Sun startup draws and eight model/globe preparation renders; temporary celestial views cannot count toward model readiness. Optional imagery failure retains the existing local fallback. [Focus definition, gates, arbitrary geometry, profiles and evidence](../frontend/camera-transition-perfecting-review/focus-optimization/README.md). The earlier dated records below preserve preceding behavior; the focal model above supersedes their residual-aim composition.

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
11. **Completed — progressive approach and illuminated Earth:** the earlier two-stage entry introduced an ISS tracking defect; the [inspection interaction](../frontend/iss-inspection-mode.md) now records its correction. Cesium scene-time solar lighting shows the terminator.
12. **Completed — graphics optimization and regression review:** the [rendering quality pass](../frontend/rendering-quality.md) uses tiled historical NASA GIBS Blue Marble day and Black Marble night imagery with local fallbacks, a NASA Tycho skybox, native scene-time Sun, and a source-quality PNG NASA station derivative. The model preloads before inspection and waits for complete texture and semantic readiness. Served-production picking, outage fallback, cold loading and repeated camera transitions were checked. These are frontend presentation changes; orbital delivery and data classification are unchanged.
13. **Completed — moving ISS approach correction:** the camera now interpolates its offset in the current sampled ISS ENU frame, aims at the station throughout the visible approach, checks Earth clearance and hands the same final pose to the inspection pivot. The model footprint grows smoothly without changing orbital state or remounting the model. The [inspection record](../frontend/iss-inspection-mode.md) includes baseline and corrected browser measurements.
14. **Completed — current geometry assessment:** the [research record](../frontend/iss-current-geometry-assessment.md) inventories NASA VTAD and NASA/JSC IGOAL variants, current structural references, Pirs removal, missing-component geometry and exact-transform gaps. `KEEP_CURRENT_VTAD` is the selected strategy; no production geometry, runtime semantic feature, or model URI changed. The newer IGOAL files are a distinct authoritative asset family, not a demonstrated VTAD revision or automatically current station snapshot.
15. **Completed — IGOAL-to-VTAD registration evidence gate:** the [numerical research record](../frontend/iss-geometry-registration.md) fits verified common geometry with independent-scale and holdout checks. Alignment is approximate, source-local additions are traceable, and RSNode/Prichal is strongly supported but not publisher-explicit. `CURRENT_VTAD_REMAINS_UNMODIFIED`; no runtime asset or semantics changed.
16. **Completed — public frame/interface evidence search:** the [evidence matrix](../frontend/iss-geometry-reference-frames.md) records NASA station/module frame definitions and six iROSA parent relationships, but no public asset-to-frame mapping or matched control points. The registration remains approximate; no numerical rerun or geometry build was justified. The NASA frame standard found in public procurement material has a use restriction and is discovery evidence only.
17. **Completed — NASA OEM trajectory comparison:** [ADR-0005](../adr/0005-separate-nasa-oem-comparison-trajectory.md) adds a verified NASA OEM XML adapter, durable source-file history, separate [comparison API](../api/orbital-comparison.md), one TLE-derived full revolution, and Cesium lines with a moving symmetric primary fade and uniform dashed OEM. The ISS model and inspection remain driven by the original GP/TLE sampled state. An OEM outage leaves the primary Earth View usable. The geometry asset-coordinate request remains a separate research gate, not a prerequisite for this orbital milestone.
18. **Completed — orbital trajectory presentation correction:** the [diagnosis and review](../frontend/orbital-trajectory-rendering.md) confirms expected temporal ITRF non-closure and physically close GP/TLE–OEM curves. A continuous soft primary halo/body, sparse uniform OEM dashes, and ready-model-only picking improve presentation without moving centerlines or changing APIs. The temporary loading/failure locator remains.
19. **Completed — selectable forward trajectory visualization:** [ADR-0006](../adr/0006-selectable-forward-trajectory-visualization.md) establishes GP/TLE default and bounded selectable NASA OEM position for model and Inspection, common 85% future horizon and full inverse-smoothstep dissolution. The subsequent [verification-and-fix](../frontend/trajectory-fix-review/README.md) reopened the rejected presentation: 75 s source-specific gap, cyan PRIMARY / amber OEM active accents, subdued inactive alpha 0.08, 80 px Overview footprint and 75 km model-only normal lift smoothly removed before close Inspection. At that prior milestone silhouette was disabled. Both builds verified selected physical position, several-pixel halo clearance, source-consistent zero-jump Inspection and fallback; no backend orbital semantics changed.
20. **Completed — adaptive trajectory and Earth View presentation:** the [review](../frontend/trajectory-presentation-review/README.md) replaces the fixed gap with a bounded screen-space target and an own-source future-time search. A public Fabric alpha/width taper softens both starts; a conservative fragment mask protects the full halo/body envelope. White silhouette 0.5/alpha 0.12 stays in Overview and fades with the isolated 75 km display lift. Physical values, clock, duration, source vertices and Inspection pivot remain unchanged; no backend/API or infrastructure change.
21. **Pending orbital task — GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS:** quantify time/frame-aligned radial, along-track and cross-track separation with preserved source lineage and explicit non-truth semantics. Not implemented in this milestone.

## Phase gates

| Phase | Scope | Gate and display semantics |
| --- | --- | --- |
| MVP1 | Single backend, CelesTrak GP/TLE acquisition, Orekit SGP4/SDP4, TEME PV, ITRF/WGS84, PostgreSQL element sets, current-state REST, deterministic tests | Current orbital state is `COMPUTED_FROM_ORBITAL_ELEMENTS`. No raw GP redistribution claim or onboard measurement label. Exact age window and reproducible Orekit data tested. |
| MVP2 | Scheduled refresh, bounded short-path REST sample delivery and Cesium Earth View; separate full-revolution comparison delivery now implemented | The short primary buffer and forward comparison use distinct bounded contracts. The selector can drive model and Inspection from covered independently sourced NASA OEM prediction; GP/TLE remains mandatory and default. Rendering rate is independent of network frequency. Periodically recheck ISSLive availability without gating Earth View. |
| MVP3, conditional | ISSLive streaming adapter and subsystem panels; station attitude only after channel and convention evidence. The first static NASA station model is already in MVP2. | At least one real payload and verified meaning/unit/time for each mapped channel. Current ISSLive status: `BLOCKED_BY_PUBLIC_SOURCE` in bounded 2026-09-28 observation, not permanent discontinuation. |
| MVP3 | NASA OEM predicted trajectory comparison implemented ahead of replay/alarms | OEM is independent predicted ephemeris; do not call GP propagation NASA prediction or mark either trajectory ground truth. |

NASA SSCWeb's verified, TLE-derived `Geo` epoch positions remain a **secondary/reference/history** option, not the MVP1 position source or mandatory validator. Direct Space-Track GP and OMM ingestion are future reviewed options; no automatic provider failover in MVP1. No orbital state vector is expected from the silent ISSLive bridge.

## Test and operations priorities

Offline tests freeze element lines, element epoch and requested UTC time. Include invalid checksums/catalog mismatch, propagation across supported cases, independent TEME PV reference, ITRF/WGS84 transformation, time/age boundaries, injected clock, database revisions and REST provenance. Do not compare Orekit only to itself. Keep a separate optional source smoke test so CI does not depend on public network availability. Log provider fetch/parse failure, last valid element age, propagation/frame failures and DB status separately from ISS health.

## Trajectory-aligned visual inspection — 2026-09-30

One selected physical ITRF position/velocity now supplies the shared model and moving-camera visual frame. Orientation is `TRAJECTORY_ALIGNED_VISUAL_ORIENTATION`; actual attitude remains unavailable. The rear camera arrives at 119 m (65% closer than 340 m), with 85° perspective FOV and narrow-aspect adaptation. Camera range supplies close framing; model scale 1 and minimumPixelSize 80 remain. Inspection-only wheel/pinch zoom is proportional, bounded and reversible; native drag orbits the physical station pivot. Back restores all Overview settings. Existing lift, silhouette, trails, source selection and feature picking remain.

The existing sample responses add Earth-fixed velocity components and `velocityUnit:m/s`; GP uses existing Orekit PV, OEM the analytic source-Hermite derivative transformed as complete PV. Position samples, lineages, cadence, frames, storage and source classifications are unchanged. No infrastructure or new source is added. [Evidence and limitations](../frontend/inspection-orientation-review/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.

## Inspection rendering optimization — 2026-10-01

Canonical Inspection now arrives behind and above the selected physical ISS at 90 m slant range / 42.5° elevation / 100° FOV. A single retained quintic pose pipeline coordinates 5-second entry and return, with a continuous Earth-clear arc when required and interrupted-entry tangents. Back restores the captured world camera and controller state. The selected physical source, shared trajectory visual frame, source sampling and delivery contracts remain unchanged; actual attitude remains unavailable. Full PNG textures persist. Stable ambient environment generation, bounded specular antialiasing and MSAA/FXAA address measured rendering costs and shimmer without modifying geometry. [Evidence, performance and limitations](../frontend/inspection-rendering-optimization-review/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Perceptual camera transition refinement — 2026-10-01

The subsequent camera milestone inspected and retained the uncommitted cubic/display-target candidate. Strict Cartesian constant-speed traversal was evaluated and rejected because it produced non-uniform apparent scale and a final close-up pop. Entry now takes 6 seconds; return 5. A once-built inverse metric allocates 20% to normalized log lens distance, 60% to inverse lens distance and 20% to path viewing-direction travel. C2 temporal rate ramps and a C1 inverse map preserve gradual progress; physical speed may vary substantially. FOV, lift and silhouette follow range rather than independent timers. Camera composition uses the displayed target; the stable 90 m / 42.5° Inspection pivot remains physical. Partial Back retains actual incoming camera derivatives. Return restores world pose, frustum, transform and controllers. A 0.8-second presentation translation prevents an unavailable OEM anchor from teleporting out of the close return view while physical GP selection, readouts and provenance change immediately.

This updates presentation within ADR-0006, with no new service, source contract, browser propagator, asset or rendering-quality policy. Earlier dated timing records remain historical. [Quantitative and browser evidence](../frontend/camera-transition-perfecting-review/perceptual/README.md). Next single milestone: **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS**, not started.


## Historical Crew foundation roadmap — 2026-10-03 (superseded by accepted replay milestone below)

The accepted orbital/graphics subsystem is frozen. [Crew Source Validation + Domain Contract](../crew/README.md) is the completed independent Crew foundation: verified LL2 2.3.0 structured observations, NASA official evidence categories, source-neutral records/ports, minimal read-only adapters and offline fixtures/tests. [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md) separates assignment from physical presence and establishes field-aware authority. See [Crew architecture](05-crew-operational-context.md).

Crew track:

1. **Done:** source validation + domain contract.
2. **Done:** [ingestion + PostgreSQL persistence](../crew/persistence-and-ingestion.md), with sync runs, immutable observations and UUID anchors under ADR-0008.
3. **Done:** [NASA verification + reconciliation](../crew/nasa-verification-and-reconciliation.md), immutable evidence and temporal canonical queries under ADR-0009.
4. **Done:** [ISS Crew REST API](../api/crew-api.md), read-only reconciled/structured/person resources.
5. **Done:** [ISS Crew Earth View panel](../frontend/crew-earth-view-panel-review/README.md), API-only DOM list/lazy detail and responsive quality/provenance.
6. **Next:** ISS CREW EVENT-AWARE REFRESH.
7. **Future:** Replay integration.

 Orbital **GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS** and the existing Replay plans remain pending, not abandoned. Earlier dated “next” notes above are historical orbital context.

## Historical Crew REST roadmap — 2026-10-03 (superseded by accepted replay milestone below)

1. **Done:** source validation + domain contract.
2. **Done:** ingestion + PostgreSQL persistence.
3. **Done:** NASA verification + reconciliation.
4. **Done:** ISS Crew REST API, public UUID DTO boundary, source quality/provenance and unresolved-subject support.
5. **Done:** [ISS Crew Earth View panel](../frontend/crew-earth-view-panel-review/README.md), API-only DOM list/lazy detail and responsive quality/provenance.
6. **Next:** ISS CREW EVENT-AWARE REFRESH.
7. **Future:** Replay integration.

[Implemented contract](../api/crew-api.md) and [REST evidence](../crew/rest-api-validation/README.md). The independent GP/TLE ↔ NASA OEM RTN TRAJECTORY-SEPARATION ANALYSIS remains pending. Orbit/graphics and Crew source/reconciliation/schedulers are unchanged. Earth View Crew UI is implemented through the existing REST boundary; no events, history or Replay UI is added.


## Accepted replay milestone — 2026-10-03

Current Crew track:

1. Source validation + domain contract — DONE.
2. Ingestion + persistence — DONE.
3. NASA verification + reconciliation — DONE.
4. Crew REST API — DONE.
5. Earth View Crew UI — DONE.
6. Event-aware refresh — DONE.
7. Crew Replay integration — DONE.

 The orbital gate is FULL within the narrow retained Crew support interval; synchronized computed position/velocity replay is implemented with separate GP/OEM lineage. [Replay evidence](../replay/validation/README.md).

Next single milestone: **ISS REPLAY EVENT TIMELINE**. Do not begin it in this milestone. RTN remains independently pending; historical trajectories and knowledge-time reconstruction are not implemented.
