# ISS orbital trajectory comparison

`GET /api/iss/orbit/comparison` returns two **separate** Earth View trajectory products. It does not change `GET /api/iss/orbit/samples`, which still drives the ISS model, marker and inspection camera. There are no query parameters in this first bounded contract.

## Response

`generatedAt` is the backend UTC evaluation instant. `primary` has `classification = COMPUTED_FROM_ORBITAL_ELEMENTS`, `frame = ITRF_2020_IERS_2010`, `positionUnit = m`, `orbitalPeriodSeconds`, `currentSampleIndex = 90`, `source`, `qualityAtGeneratedAt`, `sourceHealth`, and 181 time-ordered `{time, xMeters, yMeters, zMeters}` samples. The middle sample is exactly at `generatedAt`. One selected CelesTrak GP/TLE set and one request-local Orekit propagator generate one complete TLE mean-motion revolution, centered on the current state. The source and quality fields have the same meanings as the [short samples API](orbital-samples.md). Past samples are reconstructed from that selected set; future samples are computed predictions. They are not onboard measurements.

`oem` has `classification = SOURCE_PROVIDED_PREDICTED_EPHEMERIS`, `sourceFrame = EME2000`, `frame = ITRF_2020_IERS_2010`, `positionUnit = m`, `sampleMethod = CUBIC_HERMITE_FROM_SOURCE_POSITION_VELOCITY`, `availability`, `reason`, nullable `source`, and time-ordered `samples`. Source vectors carry UTC epochs, positions in km and velocities in km/s; the backend interpolates only within adjacent source vectors and transforms to Earth-fixed meters with Orekit. OEM display samples align to available primary sample times, never extrapolate outside the file, and contain no implied measured/current state. `source` includes `creationDate`, segment `startTime`/`stopTime`, application `retrievedAt`, nullable HTTP `httpLastModified`, `sha256`, and stable current `sourceUrl`. HTTP Last-Modified is transport metadata, not an OEM publication time. The current URL is mutable; the hash identifies the exact bytes. NASA provides no per-vector accuracy or quality flag in this verified file.

`availability` is scoped to NASA OEM, separate from CelesTrak acquisition health and GP-derived state quality:

| Value | Meaning |
| --- | --- |
| `AVAILABLE` | Valid stored/fetched OEM covers the entire requested comparison revolution. |
| `DEGRADED` | A stored file is used after fetch failure, or OEM only covers part of the requested window. `reason` identifies which. |
| `UNAVAILABLE` | No valid OEM file, no usable source window, or frame conversion failed. `samples` is empty. |

An OEM outage returns HTTP 200 with a complete `primary` product when GP/TLE calculation succeeds. The frontend shows a primary-only globe and an OEM-unavailable status. An absent/invalid GP element set keeps the existing primary orbital 503/500 errors. This contract cannot be used as a substitute current-state endpoint. The two paths may differ; neither is designated truth.

## Source and scope

[NASA's ISS trajectory description](https://www.nasa.gov/general/spaceflight-nasa-gov-has-been-retired/) calls the OEM a predicted TOPO ephemeris. The current [NASA XML product](https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml) was rechecked on 2026-09-30: CCSDS OEM 2.0, ISS, Earth center, `EME2000`, UTC ordinal-year vector epochs, km positions and km/s velocities. The file's creation time and HTTP modification time differ. NASA describes approximately three updates per week, not a guaranteed SLA. A captured source excerpt in backend test resources is an offline fixture only.
