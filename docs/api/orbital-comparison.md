# ISS orbital trajectory comparison

`GET /api/iss/orbit/comparison` returns two **separate** Earth View trajectory products. The short `GET /api/iss/orbit/samples` contract remains the mandatory primary animation buffer; a selected OEM visualization uses the OEM sampled property from this response for model and Inspection. `/api/iss/state` remains the computed GP/TLE current-state API. There are no query parameters in this first bounded contract.

## Response

`generatedAt` is the backend UTC evaluation instant. `primary` has `classification = COMPUTED_FROM_ORBITAL_ELEMENTS`, `frame = ITRF_2020_IERS_2010`, `positionUnit = m`, `orbitalPeriodSeconds`, `currentSampleIndex = 0`, `source`, `qualityAtGeneratedAt`, `sourceHealth`, and 181 time-ordered `{time, xMeters, yMeters, zMeters}` samples. The first sample is exactly at `generatedAt`. One selected CelesTrak GP/TLE set and one request-local Orekit propagator generate one complete TLE mean-motion revolution from `generatedAt` forward. The source and quality fields have the same meanings as the [short samples API](orbital-samples.md). Future samples are computed predictions; this comparison response contains no primary past samples. They are not onboard measurements.

`oem` has `classification = SOURCE_PROVIDED_PREDICTED_EPHEMERIS`, `sourceFrame = EME2000`, `frame = ITRF_2020_IERS_2010`, `positionUnit = m`, `sampleMethod = CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY`, `availability`, `reason`, nullable `source`, and time-ordered `samples`. Source vectors carry UTC epochs, positions in km and velocities in km/s; the backend interpolates only within adjacent source vectors and transforms to Earth-fixed meters with Orekit. OEM samples uniformly cover the intersection of the primary interval and the actual first/last source vector epochs, with at most 181 samples. Exact real coverage boundaries are included, even when not on the primary grid. Samples never extrapolate outside that span and contain no implied measured state. `source` includes `creationDate`, segment `startTime`/`stopTime`, application `retrievedAt`, nullable HTTP `httpLastModified`, `sha256`, and stable current `sourceUrl`. HTTP Last-Modified is transport metadata, not an OEM publication time. The current URL is mutable; the hash identifies the exact bytes. NASA provides no per-vector accuracy or quality flag in this verified file.

`availability` is scoped to NASA OEM, separate from CelesTrak acquisition health and GP-derived state quality:

| Value | Meaning |
| --- | --- |
| `AVAILABLE` | Valid stored/fetched OEM covers the entire requested forward comparison revolution. |
| `DEGRADED` | A stored file is used after fetch failure, or OEM only covers part of the requested window. `reason` identifies which. |
| `UNAVAILABLE` | No valid OEM file, no usable source window, or frame conversion failed. `samples` is empty. |

An OEM outage returns HTTP 200 with a complete `primary` product when GP/TLE calculation succeeds. The frontend shows a primary-only globe and an OEM-unavailable status. An absent/invalid GP element set keeps the existing primary orbital 503/500 errors. This contract supplies bounded visualization positions; it does not change the canonical computed current-state endpoint. The two paths may differ; neither is designated truth.

## Source and scope

[NASA's ISS trajectory description](https://www.nasa.gov/general/spaceflight-nasa-gov-has-been-retired/) calls the OEM a predicted TOPO ephemeris. The current [NASA XML product](https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml) was rechecked on 2026-09-30: CCSDS OEM 2.0, ISS, Earth center, `EME2000`, UTC ordinal-year vector epochs, km positions and km/s velocities. The file's creation time and HTTP modification time differ. NASA describes approximately three updates per week, not a guaranteed SLA. A captured source excerpt in backend test resources is an offline fixture only.

## Visualization and compatibility

This pre-release contract changed `currentSampleIndex` and the temporal grid from a centered revolution to a forward one. The frontend parser and backend ship together; old centered clients must update. No query parameters or source preference are sent to the backend.

The scene chooses the primary short-buffer property or the separately bounded OEM property at one scene time. GP/TLE is the session default. OEM is selectable only when availability is not `UNAVAILABLE`, real source coverage and delivered samples contain scene time, and response age is within the existing 300-second comparison display limit. `DEGRADED` stored OEM is permitted while covered and remains labeled degraded; no extra undocumented NASA age/accuracy threshold is invented. Ordinary refreshes slightly ahead of the scene clock wait on the previous still-valid moving buffer for at most a 3-second alignment seam. Real outages are adopted immediately. Unusable selected OEM explicitly returns to primary and exits Inspection if necessary. No extrapolation, final-point hold, or cross-source position blend is allowed.

Both visible trails use the primary period and the same future interval, from a frontend-selected genuine future source point to scene time +0.85T. OEM ends at its real delivered coverage boundary when earlier and fades fully there. Source metadata and physical altitude never inherit model presentation settings. The frontend model alone uses an 80-pixel minimum and 75 km Overview display lift, smoothly removed before close Inspection; API samples and the physical approach/pivot are unchanged. Backend Hermite/ITRF conversion and browser degree-one bounded display interpolation remain distinct. Selecting OEM is not a truth or accuracy claim.

The adaptive start, rounded alpha/width ramp, screen-space halo/body mask and white Overview silhouette are frontend presentation policies only. Neither this contract nor any physical velocity, timestamp, period, source lineage or position is changed. See the [display-isolation record](../frontend/trajectory-presentation-review/README.md).
