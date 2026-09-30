# ADR-0005: Keep NASA OEM as a separate comparison trajectory

- Status: **Accepted**
- Date: **2026-09-30**
- Scope: orbital comparison source, persistence and Earth View delivery

## Context

The existing current ISS model and inspection camera follow a short Orekit sample buffer computed from CelesTrak GP/TLE. NASA independently publishes a 15-day ISS OEM predicted ephemeris in EME2000. It is useful for visual comparison but is neither onboard position telemetry nor an authority for replacing the selected GP-derived current state. The short buffer cannot describe one full orbital revolution or a symmetric far-side fade without changing its original animation purpose.

## Decision

Retain `GET /api/iss/orbit/samples` for the model, marker and inspection camera. Add `GET /api/iss/orbit/comparison` with separately named `primary` and `oem` products. The primary path uses 181 Orekit propagations from one selected TLE across one TLE mean-motion period, centered at response time. NASA OEM XML is fetched through a distinct adapter, validated, stored by content hash in PostgreSQL with source creation, HTTP Last-Modified and retrieval times kept separate, and read as an optional comparison layer. Its source vectors remain EME2000/km/km/s; display samples use bounded cubic Hermite interpolation from source position and velocity, then Orekit EME2000→ITRF transformation. The API names both the source classification and interpolation method.

The OEM fetch is on demand, no more than once every two hours after success; a failed attempt backs off for 15 minutes. A stored file can support a comparison within its vector span during an outage, marked `DEGRADED`. Without a usable file or covered window, the OEM product is `UNAVAILABLE` while the primary product remains. These intervals are MISSION1 request policies, not NASA publication guarantees.

Cesium renders the primary full revolution as one per-vertex colored polyline with opacity based on orbital phase distance from current scene time. It renders NASA OEM as a uniform dashed line. Both comparison lines are hidden in close inspection; the short computed buffer continues to drive the single ISS model in all modes.

## Alternatives considered

| Alternative | Reason not selected |
| --- | --- |
| Replace the current ISS state with OEM | Changes the product meaning and couples current model behavior to a separately published prediction and its outages. |
| Extend the existing short `/samples` window to a full orbit | Weakens the bounded animation contract and adds payload/CPU cost to all current-state clients. |
| Return one mixed trajectory array | Hides source lineage and lets clients mistake interpolated OEM prediction for GP propagation. |
| Frontend direct NASA fetch or browser-side frame conversion | Makes source verification, persistence and EME2000/ITRF semantics depend on the browser. |
| Add a second service or message broker | No independent scaling or asynchronous consumer need is present. |

## Consequences

- The application owns one more source adapter, Flyway table, bounded fetch policy and parsing/frame tests. NASA XML format changes can make only the OEM path unavailable.
- The comparison response is larger than the existing short buffer; it is polled separately and does not alter model motion or inspection semantics.
- Prediction quality and agreement are not accuracy or truth claims. Source creation, retrieval, transport modification and vector epochs remain distinct.
- EME2000→ITRF conversion depends on the pinned Orekit/EOP bundle; its supported date range limits comparison delivery.
- [ADR-0004](0004-local-gp-propagation-for-current-orbit.md) remains accepted for the primary orbital state.
