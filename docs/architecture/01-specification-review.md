# MISSION1 specification review

Date: **2026-09-28**. Input: the complete [original project specification](/Users/daniel/Desktop/mission1-project.md), revised after the [GP source gate](../telemetry/orbital-elements-verification.md). This review separates validated facts from design decisions. The historical [SSCWeb verification](../telemetry/sscweb-verification.md) and [ISSLive/OEM verification](../telemetry/source-verification.md) remain evidence.

## Sound intent

- A real-data backend path should precede the Earth view. The browser should use MISSION1's API, not provider feeds.
- Provider-specific acquisition, domain orbital/telemetry meaning, persistence and API delivery need clear boundaries in one maintainable deployable.
- Source identity, element/point/request time, units, frames, quality and source-provided versus computed meaning must survive every boundary.
- A detailed ISS model, onboard subsystem telemetry, alarms and replay remain valuable later goals, contingent on verified sources and conventions.

## Corrected assumptions

| Earlier assumption or proposal | Correction |
| --- | --- |
| SSCWeb is the required first current-position path | NASA SSCWeb remains verified queryable TLE-derived ephemeris, but [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md) selects current public CelesTrak GP elements plus local Orekit propagation. SSCWeb is secondary/reference, not a live ground-truth feed. |
| ISSLive must supply the orbit vector or cabin values | Its correctly configured public bridge accepted subscriptions but delivered no values in bounded browser/Java diagnostics; status `BLOCKED_BY_PUBLIC_SOURCE`, not permanent withdrawal. No ISSLive item is an MVP1 dependency or approved production mapping. |
| Real-time moving position equals live ISS telemetry | An at-now state from a retained TLE is a **real-time computed orbital estimate**. The element epoch may be hours old and retrieval/publication times differ. Position, velocity and geodetic point are computed, not onboard measurements. |
| TLE mean elements are an ordinary J2000 Cartesian state | TLE is a GP mean-element set. Orekit `TLEPropagator` chooses SGP4/SDP4; native output is **TEME**, transformed with Orekit to ITRF/WGS84. Do not use a generic Keplerian propagator or infer J2000. |
| A continuously animated Earth view needs continuous external position requests | Fetch elements at provider-respecting cadence; propagate locally at requested times. Backend state-update cadence and Cesium render rate are separate. |
| Orbit source data guarantees current positional accuracy | The response has no provider accuracy/status field or source publication time. Preserve element epoch, retrieval time, source lineage and an application-defined age/window/quality policy; a successful calculation is not proof of accuracy. |
| Sample pressure `760.1 torr` or attitude quaternion is an implementable mapping | Both remain examples. `USLAB000058` has a dictionary `PSI` unit but no payload; attitude frame/order/time are unverified. No fake values or module mappings. |
| OEM is the same kind of predicted path as a locally propagated TLE | NASA OEM is an independently produced predicted ephemeris with separate file creation and vector epochs. A TLE-derived future path is `COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS`. Preserve separate lineage. |
| Every orbital quantity belongs to an ISS module/subsystem | The orbital element set and computed orbital state are spacecraft-level concepts with no evidence-based module owner. |
| Distributed services and Kafka are needed early | One backend, in-process boundaries and PostgreSQL are sufficient. Add operational complexity only for observed needs. |

## V1 scope and deferrals

MVP1 uses a verified CelesTrak ISS TLE and in-process Orekit 13.1.8-compatible APIs to calculate TEME position/velocity and WGS84 geodetic state at a requested UTC time. It validates and durably stores source element sets in PostgreSQL, exposes a computed current-state REST operation and source/fetch status, and tests against independent frozen references. Age limits, Orekit auxiliary/EOP data and exact API shape are implementation gates, not provider facts. MVP2 adds periodic element refresh, local track generation and Cesium Earth View; WebSocket only if justified. Detailed station view, ISSLive subsystem telemetry, attitude, NASA OEM comparison, replay and alarms follow independent evidence gates in MVP3.

Do not create a `current measured position` claim, a mandatory one-Hz push loop, a table row for every rendered frame, direct browser CelesTrak access or automatic Space-Track fallback. Space-Track requires authentication and terms review. OMM is the provider-recommended future format, but TLE is currently verified for ISS 25544 and the simplest supported Orekit propagation input. The format decision is explicitly revisitable.

## Source evidence ledger

| Source | Current verified scope | Architecture role |
| --- | --- | --- |
| [CelesTrak GP](../telemetry/orbital-elements-verification.md) | No-auth `CATNR=25544&FORMAT=TLE` returned valid current element set; USSF GP via CelesTrak. Element epoch is available, publication time/accuracy unknown. | **Primary MVP1 source of elements**, not onboard telemetry. |
| [Space-Track GP](../telemetry/orbital-elements-verification.md#space-track-gp-possible-future-direct-source) | Official API/format/auth/guidance documented; no authenticated payload tested, transfer terms require review. | Future optional direct provider, no MVP1 fallback. |
| [NASA SSCWeb](../telemetry/sscweb-verification.md) | `VERIFIED` time-indexed, TLE-derived `Geo` X/Y/Z km with UTC ephemeris epoch; per-point definitive/predictive class unknown. | Secondary/reference/history, not first current state or guaranteed ground truth. |
| [ISSLive / Lightstreamer](../telemetry/source-verification.md) | Public connection/subscription verified; no payload in bounded 2026-09-28 demo/Java diagnostic, `BLOCKED_BY_PUBLIC_SOURCE`. | Future onboard/subsystem stream only after re-verification. |
| [NASA OEM](../telemetry/source-verification.md#source-b-nasa-iss-orbit-ephemeris-message) | `VERIFIED` NASA TOPO predicted ephemeris, distinct creation and vector epochs. | Later independently sourced predicted trajectory. |
| Official reusable ISS 3D asset and operational thresholds | `UNVERIFIED` for this project. | Defer model licensing and source-claimed alarm limits. |

The source-adapter rule of [ADR-0003](../adr/0003-verified-source-mapping-and-value-semantics.md) made the source change possible without altering [ADR-0001](../adr/0001-single-backend-and-in-process-pipeline.md) or [ADR-0002](../adr/0002-postgresql-for-initial-history.md). [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md) records the new orbital computation ownership.
