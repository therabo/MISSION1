# Computed ISS orbital sample window

`GET /api/iss/orbit/samples` returns one bounded, request-time Orekit calculation for Earth View animation. It is read-only and makes no provider network request. `GET /api/iss/state` remains the exact current-state/status operation for cards and diagnostics.

## Request

| Query parameter | Default | Accepted values |
| --- | ---: | --- |
| `pastSeconds` | 120 | Integer 0–300, multiple of `stepSeconds` |
| `futureSeconds` | 600 | Integer 30–1200, multiple of `stepSeconds` |
| `stepSeconds` | 10 | Integer 5–30 |

The inclusive sample count is `(pastSeconds + futureSeconds) / stepSeconds + 1` and must be at most **181**. The total window must be at most **1200 seconds**. Validation occurs before any database read. The inclusive time grid begins at `generatedAt − pastSeconds`, contains `generatedAt` exactly, and ends at `generatedAt + futureSeconds`. Defaults produce 73 samples. The 20-minute total and 181-sample caps protect CPU/payload size for ISS model motion and inspection; the separate [comparison endpoint](orbital-comparison.md) delivers a full revolution. The 5-second minimum is denser than the chosen 10-second default and gives headroom for a closer camera; 30 seconds is the coarsest supported step after the interpolation experiment.

## HTTP 200 response

| Field | Meaning |
| --- | --- |
| `generatedAt`, `windowStart`, `windowEnd` | Backend UTC instants; `generatedAt` is the one captured request evaluation time and an exact sample time. |
| `stepSeconds`, `frame`, `positionUnit` | Sampling interval; `frame = ITRF_2020_IERS_2010`; `positionUnit = m`. Cartesian axes are Earth-fixed, compatible with Cesium `ReferenceFrame.FIXED`. |
| `classification` | `COMPUTED_FROM_ORBITAL_ELEMENTS`; positions are not onboard measurements. |
| `timeSemantics.past`, `.atGeneratedAt`, `.future` | Respectively `RECONSTRUCTED_FROM_SELECTED_ORBITAL_ELEMENTS`, `COMPUTED_CURRENT_FROM_ORBITAL_ELEMENTS`, and `COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS`. Determine a sample's role by comparing its `time` with `generatedAt`. No NASA prediction claim is made. |
| `source` | `noradCatalogNumber`, `provider`, `upstreamOrigin`, `sourceFormat`, `elementEpoch`, `retrievedAt`, nullable `publishedAt`, `elementSha256`, source `classification`, and `propagationMethod = OREKIT_TLE_SGP4_SDP4`. One selected element set generates every sample. No TLE lines or database ID are exposed. |
| `qualityAtGeneratedAt` | `status`, `reason`, `policy`, signed `elementAgeSeconds` and `retrievalAgeSeconds` for the **current** sample only. `orbital-current-v1` recency is not an accuracy estimate for future samples. |
| `sourceHealth` | Same independent operational acquisition snapshot as `/api/iss/state`; durable last success can coexist with process-local `UNKNOWN` after restart. |
| `currentGeodetic` | Backend-computed WGS84 latitude/longitude in degrees and ellipsoidal altitude in meters at `generatedAt`. |
| `samples[]` | Ascending records `{time, xMeters, yMeters, zMeters}`. Each is an Earth-fixed position in meters at its own UTC propagation instant. Full metadata is shared at response level. |

The API selects `latestUsable(generatedAt)` once and uses one request-local TLE propagator. A concurrent refresh cannot change the selected TLE halfway through the response. Generated states are not persisted. The quality/status may be `STALE` while coordinates remain HTTP 200. A `DEGRADED` source-health snapshot does not by itself invalidate previously stored orbital elements.

## Errors

Errors use `application/problem+json` with stable `type`, `status`, `title`, and safe `detail`:

| Condition | HTTP | Type |
| --- | ---: | --- |
| Missing usable element set | 503 | `urn:mission1:problem:no-orbital-elements` |
| Invalid range, interval, divisibility, count, or noninteger query | 400 | `urn:mission1:problem:invalid-orbital-sample-window` |
| Invalid stored metadata | 500 | `urn:mission1:problem:orbital-data-integrity-error` |
| Invalid selected TLE | 500 | `urn:mission1:problem:invalid-orbital-elements` |
| Propagation or EOP/frame failure | 500 | `urn:mission1:problem:orbital-calculation-failed` |
| Unexpected internal failure | 500 | `urn:mission1:problem:orbital-internal-error` |

No error returns invented coordinates. The contract is additive to `/api/iss/state`; no existing client must migrate. Refer to the [Earth View delivery decision](../architecture/04-earth-view-orbital-delivery.md) for interpolation, polling, buffering, and scope.

## Additive physical velocity delivery — 2026-09-30

Each sample additionally includes `vxMetersPerSecond`, `vyMetersPerSecond`, `vzMetersPerSecond`; its product declares `velocityUnit = m/s`. Position and velocity use the same sample UTC and `ITRF_2020_IERS_2010`. These are Earth-fixed velocities, not TEME or inertial speed. Existing XYZ/time/lineage/quality and coverage are unchanged. Legacy position-only consumers can ignore the new fields; the current frontend requires finite nonzero velocities and the explicit unit, and ships with the backend. There is no inferred velocity fallback.

GP forwards its existing Orekit Earth-fixed PV. NASA OEM differentiates the same bounded cubic Hermite source-position polynomial and transforms the full EME2000 PV at that epoch with Orekit (including the Earth-rotation contribution). This is computed processing of source-provided **predicted** ephemeris, never measured onboard motion or attitude. Browser position and velocity use separate bounded degree-one properties; position interpolation is deliberately unchanged. Visual alignment is along that evaluated velocity and does not assert exact source accuracy or equality with the derivative of the browser's piecewise-linear position path.

Default short-response cost measured 18,534 bytes / 12.00 ms median; maximum 181-sample response 43,885 bytes / 19.92 ms warm generation in the local test. The payload guard grows from 35 KB to 50 KB for the maximum window to account for three velocity components. No request cadence or propagation operation is added. [Numerical and browser review](../frontend/inspection-orientation-review/README.md).
