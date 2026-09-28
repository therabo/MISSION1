# ADR-0004: Use local GP/TLE propagation for the current ISS orbital state

- Status: **Accepted**
- Date: **2026-09-28**
- Scope: orbital position and velocity source strategy; no production implementation in this decision task

## Context

MISSION1 initially selected [NASA SSCWeb](../telemetry/sscweb-verification.md) as its first queryable real-data path after the public [ISSLive stream](../telemetry/source-verification.md) accepted sessions but delivered no item payload in bounded diagnostics. SSCWeb is usable for time-indexed, TLE-derived ephemeris, but its basic response is not a live onboard measurement and does not supply the desired complete position/velocity state. A continuously moving Earth view would otherwise depend on repeated external position queries or on unspecified interpolation semantics.

[CelesTrak GP](../telemetry/orbital-elements-verification.md) currently serves an unauthenticated, validated ISS/NORAD 25544 TLE. Orekit 13.1.8 supports TLE propagation via `TLEPropagator.selectExtrapolator`, selecting SGP4 or SDP4, with TEME position/velocity and frame/geodetic transformation APIs. CelesTrak recommends richer OMM XML for future catalog compatibility, while its TLE service remains supported for the five-digit ISS ID. Direct Space-Track GP access needs authentication and has terms requiring review before public redistribution; it was not tested with credentials.

## Decision

Use **CelesTrak GP `CATNR=25544&FORMAT=TLE` as the first orbital-element source**. Validate and persist each source-provided set with NORAD identity, raw lines/hash, element epoch, retrieval time, provider/upstream lineage and unknown publication time. Keep the domain representation provider-neutral behind an `OrbitalElementsSource` port. Do not add automatic Space-Track fallback in MVP1.

In MVP1, use **in-process Orekit TLEPropagator** at a requested UTC instant. Preserve native **TEME** PV, transform with Orekit to an Earth-fixed **ITRF** frame and WGS84 geodetic point with reproducible auxiliary/EOP data. The result is a **computed orbital state** linked to the element set; it is not measured/live onboard telemetry. Evaluate now through an injectable clock and allow only a documented bounded nearby-time window. Element refresh cadence and state evaluation/rendering cadence are separate. Do not call CelesTrak for every frontend position update.

Store element sets as the initial durable source record. Compute current state on demand; persist selected derived state samples only if history/replay needs justify it. The first REST result exposes propagation time, element epoch/age, retrieval time, nullable publication time, frames/units, method and computed quality/provenance. Project-defined orbital age and window policy must be documented and tested before production behavior; successful propagation does not imply accuracy.

## Alternatives considered

| Alternative | Why it is not the first current-position path |
| --- | --- |
| NASA SSCWeb position queries | Verified and retained as a secondary/reference or historical ephemeris source. Its basic `Geo` response supplies epoch-indexed position without velocity and unknown per-point definitive/predictive category; repeated queries are not needed when the latest available valid GP set can be propagated locally with its age exposed. |
| ISSLive orbital telemetry | Lightstreamer connection/subscription works but no payload was observed in the official demo or a matched Java client on 2026-09-28. Candidate vector fields also have unit, frame and time blockers. Future streaming telemetry remains a separate port. |
| Third-party current latitude/longitude APIs | May be useful for display, but would hide orbit model, element age, reference-frame and velocity semantics and make the Earth view dependent on provider request cadence. No candidate passed a stronger evidence gate than current CelesTrak GP. |
| Direct Space-Track GP | Upstream-authoritative, but account authentication, API guidance and data-transfer terms add friction to an open-source first slice. Revisit with account/terms review; no automatic failover yet. |
| OMM in MVP1 | CelesTrak recommends OMM XML for future compatibility and richer metadata. TLE is verified for ISS 25544 and maps directly to Orekit's supported GP propagation API. A later OMM migration needs its own parsing/propagator verification; no guessed conversion. |
| NASA OEM | Independently sourced NASA predicted ephemeris intended for later comparison, not a current onboard position stream or GP replacement. |

## Consequences

- Orekit, deterministic propagation and frame/geodetic tests move into MVP1. The project now owns element-age, update, model and numerical validation policy.
- Output can be recalculated for now, nearby past/future timestamps and later ground tracks without per-point external requests. Predicted future points remain labeled as propagation from a specific element set.
- Source-provided elements, computed state, SSCWeb ephemeris, OEM prediction and potential onboard telemetry have separate identities and lineage. Provider publication/fit accuracy and onboard measurement time remain unknown; visual smoothness cannot upgrade provenance.
- Reproducible Orekit data and safe propagator concurrency handling become implementation concerns. PostgreSQL stores elements and revision history, avoiding high-volume computed-state writes by default.
- [ADR-0001](0001-single-backend-and-in-process-pipeline.md) single backend, [ADR-0002](0002-postgresql-for-initial-history.md) PostgreSQL, and [ADR-0003](0003-verified-source-mapping-and-value-semantics.md) verification/provenance still apply. This ADR changes the earlier **implementation route** documented in the baseline, not those accepted principles; none is superseded.

**2026-09-28 follow-up:** [The ISS-E SupGP source-selection gate](../telemetry/iss-supgp-source-selection.md) examined NASA-OEM-derived six-hour segments after this decision. Their exact selection/validity boundaries remain unverified, so this ADR's standard-GP primary source and local Orekit propagation decision stay accepted. SupGP remains deferred; the diagnostic comparison is not an accuracy ranking. This note does not change the original rationale or authorize a production source switch.
