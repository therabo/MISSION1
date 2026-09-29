# Earth View orbital delivery decision and validation

Status: **selected for MVP2 backend delivery**, 2026-09-28. Decision gate: `REST_SAMPLED_WINDOW`.

## Requirement and boundary

The Earth View needs a computed current ISS location at a known UTC instant, smooth motion, a short recent/future orbital arc, the generating TLE's epoch/retrieval/hash, current quality, and a clear response to source or API outages. It does not yet need an orbit-long ground track, replay, attitude, station modules, or telemetry. The CelesTrak retrieval interval (~2h10m MISSION1 policy), API sample spacing (10 s default), REST refresh interval (120 s recommended), and browser render cadence (potentially 60 FPS) are independent.

The backend selects one `latestUsable(generatedAt)` set, creates one request-local Orekit TLE propagator, and calculates Earth-fixed positions for the entire bounded window. It never calls CelesTrak or writes generated positions. The browser interpolates only for visualization; it does not run SGP4, TEME-to-ITRF, or a custom WGS84 transform. Earth-fixed Cartesian meters map directly to Cesium's `Cartesian3` in `ReferenceFrame.FIXED`. The response also carries the backend's WGS84 geodetic point at `generatedAt` for geographic readout. Cesium's [SampledPositionProperty](https://cesium.com/learn/cesiumjs/ref-doc/SampledPositionProperty.html) defaults to FIXED, supports runtime `addSamples`, linear degree-1 interpolation, and `NONE` extrapolation. [Entity.position](https://cesium.com/learn/cesiumjs/ref-doc/Entity.html), [PositionProperty](https://cesium.com/learn/cesiumjs/ref-doc/PositionProperty.html), [PathGraphics](https://cesium.com/learn/cesiumjs/ref-doc/PathGraphics.html), [Clock](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html), and [Timeline](https://cesium.com/learn/cesiumjs/ref-doc/Timeline.html) support a moving entity and time-indexed arc without frame-rate network traffic. Cesium's [Transforms docs](https://cesium.com/learn/cesiumjs/ref-doc/Transforms.html) identify its fixed axes as Earth-fixed/ITRF; [ModelGraphics](https://cesium.com/learn/cesiumjs/ref-doc/ModelGraphics.html) can attach a glTF URI to a positioned entity in a later frontend task. Model attitude is unavailable and must remain neutral/labeled.

## Transport comparison

| Option | MVP assessment |
| --- | --- |
| Repeated `GET /api/iss/state` | Good for exact status cards and diagnostics. At 120 s intervals, a moving object lacks a future position. Polling it every 1–10 s still gives network-timed point arrivals, requires interpolation logic and gives no short future path; 1 Hz would be 86,400 requests/day/client. |
| Bounded `GET /api/iss/orbit/samples` | 73 positions by default, about 10 KB JSON and about 4–6 ms median warm local generation (fixed fixture, Testcontainers/PostgreSQL on one developer machine). A 181-sample configuration produced about 23 KB JSON and took about 5–11 ms in warm local runs. One request per 120 s is 720/day/client; the browser can render between samples at its own frame rate. Includes future path and failure buffer. |
| SSE | Push could announce an occasional new element revision, but does not improve deterministic interpolation between revisions. It adds reconnect, ordering and stream-lifetime behavior with no present benefit for this orbital-only view. |
| WebSocket | Bidirectional subscriptions are unnecessary for one ISS computed path. It adds connection state, backpressure, reconnect and gap semantics without providing more authoritative orbital information. |

The sampled REST contract extends the accepted single-backend REST architecture and introduces no durable push choice, so no new ADR is needed. Reconsider push when a measured latency or multi-topic telemetry requirement exceeds this contract.

## Interpolation experiment

The offline `OrbitalInterpolationExperimentTest` uses the verified 2026-09-28 ISS TLE fixture, Orekit ITRF positions every 0.5 s over 10 minutes starting at 15:00 UTC, and compares each intermediate reference position with endpoint interpolation. These are **deviations from MISSION1's Orekit computation**, not physical ISS position errors. Cubic Hermite uses Orekit Earth-fixed velocity at both endpoints; linear uses positions only.

| Step | Linear max / mean | Cubic Hermite max / mean |
| --- | ---: | ---: |
| 1 s | 0.999 / 0.998 m | 0.000003 / 0.000002 m |
| 2 s | 3.995 / 3.327 m | 0.002779 / 0.001622 m |
| 5 s | 24.966 / 18.301 m | 0.007119 / 0.004325 m |
| 10 s | 99.865 / 69.876 m | 0.014251 / 0.008455 m |
| 30 s | 898.751 / 608.907 m | 0.043337 / 0.028558 m |

Hermite materially reduces interpolation error and could use wider intervals, but the Earth-scale MVP does not need centimeter-level agreement with a TLE model. Ten-second linear sampling keeps velocity derivatives and their frame semantics out of the API while limiting observed deviation to about 100 m in this test. The experiment covers one fixture and ten minutes, so the numeric result is a design check, not an accuracy guarantee for every element set or camera zoom. `PathGraphics.resolution` is a separate **render path tessellation** setting; it does not change API sample times.

## Buffer and lineage rules

The default window is 2 minutes past + 10 minutes future (12 minutes total). The fixture's mean motion is 15.48675883 revolutions/day, about 93 minutes per orbit, so this is a short local arc and intentionally not a full ground track. Its 73 samples are sufficient for smooth object motion and a short `PathGraphics` lead/trail. A future full-orbit ground-track product likely needs a longer horizon and coarser points; design it separately if the frontend actually requires it.

The frontend should load the response into a `SampledPositionProperty(ReferenceFrame.FIXED)`, use linear degree 1 and `ExtrapolationType.NONE`, and align Cesium's clock to the server-provided `generatedAt`/sample times. Use the monotonic duration of the request to account for transport delay where useful; never require browser wall-clock equality. Refresh every 120 s. That leaves about 8 minutes of future coverage after a normal refresh point. Keep existing samples when a refresh fails and show API connectivity separately from orbital quality. When the buffer ends, stop the moving pose and show a degraded/stale indication; do not extrapolate indefinitely or silently hold a supposedly current ISS marker. A new response with the same element hash can replace overlapping samples. When the hash changes, replace the old window as a unit and show the new source epoch; do not splice two TLE revisions into one visual arc. A source outage can still yield HTTP 200 with cached elements and `STALE` quality. A backend/DB outage can yield 503/500; already buffered positions remain usable only until their timestamp horizon, with their last known quality and source metadata visible.

Past points are model reconstructions from the **currently selected** TLE, not what MISSION1 knew at those past instants and not measured historical truth. Future points are computed GP/TLE predictions, not NASA OEM. `qualityAtGeneratedAt` assesses the current computation under `orbital-current-v1`; it is not a positional uncertainty bound for the whole path. Historical as-of selection, NASA OEM comparison, and a full ground track remain separate future contracts.

See the [exact API contract](../api/orbital-samples.md) and the [current-state API](../../backend/README.md#current-orbital-state-api).

## First frontend implementation

The [React/TypeScript Earth View](../../frontend/README.md) implements the selected contract with one stable Cesium Viewer and ISS entity. Its relative `/api` request uses a Vite development proxy; one completed request schedules the next after 120 seconds. Validation precedes a complete in-memory `SampledPositionProperty` replacement, so TLE hashes never mix. The property is Earth-fixed, linearly interpolated, and bounded by its first/last backend samples. A failed request preserves an active buffer with a separate degraded-delivery indication; an expired buffer hides the moving entity. Orbital quality and acquisition health are displayed independently. NASA GIBS imagery is a frontend visual layer with bundled local fallback; ellipsoid terrain and the local fallback require no ion token.

The later [ISS Inspection Mode](../frontend/iss-inspection-mode.md) consumes this same property and clock. Its camera follows the sampled position in a local ENU navigation frame while the user orbits the model; it neither extends the backend window nor requests positions at camera-frame rate. An expired buffer exits inspection before the target becomes undefined. A replacement window changes the tracked point atomically, retaining the selected lineage's existing no-splice semantics. This is camera presentation, not a new orbital-delivery contract or spacecraft attitude.

The corrected progressive entry reads the current position from that bounded property at the same scene time as the model on every camera tick. It interpolates a camera offset in the moving ENU frame and hands the final pose to the same pivot used for user inspection. There is no future fixed flight target, orbital extrapolation or new network cadence. Cesium's [scene-time Earth lighting and historical night imagery](../frontend/earth-visualization.md) are presentation only; they do not alter state, sample provenance, or quality.

The deterministic backend ITRF XYZ → Cesium fixed Cartesian → WGS84 sanity check found latitude, longitude, and height differences below 5×10⁻¹³ degrees and 10⁻⁹ meters, respectively, against the backend WGS84 point at the same fixture instant. The test tolerances are 0.0001 degrees and 1 meter; this is a frame/unit compatibility check, not a physical-orbit accuracy estimate. Browser smoke testing covered development and served-production assets, globe, marker/path, backend status, and camera navigation.
