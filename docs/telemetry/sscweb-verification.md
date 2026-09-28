# NASA SSCWeb ISS orbit-source verification

Verified **2026-09-28 UTC**. Historical scope: the initially proposed first MISSION1 source adapter and one real-data path to normalized storage and REST. The result remains **READY_FOR_SECONDARY_REFERENCE_IMPLEMENTATION for queryable, NASA-maintained ISS orbit ephemeris**. [ADR-0004](../adr/0004-local-gp-propagation-for-current-orbit.md) subsequently selected [CelesTrak GP elements plus local propagation](orbital-elements-verification.md) as the **primary current-position path**. This record is **not** verification of real-time spacecraft telemetry, onboard measured position, a pointwise definitive/predictive flag, velocity, WGS84 geodetic altitude, or an ISSLive replacement with identical semantics.

## Source identity and access

NASA GSFC's Space Physics Data Facility (SPDF) operates [SSCWeb](https://sscweb.gsfc.nasa.gov/). NASA describes it as an ephemeris database serving spacecraft locations for planning and analysis through [REST web services](https://sscweb.gsfc.nasa.gov/WebServices/REST/) and a [user interface](https://sscweb.gsfc.nasa.gov/quickstartguide.html). The REST base is `https://sscweb.gsfc.nasa.gov/WS/sscr/2/`; `GET /observatories` identifies the ISS as **`iss`** and reported `Resolution=60`, `StartTime=1998-11-21T00:00:00.000Z`, `EndTime=2026-10-11T00:00:00.000Z` during this check. These availability dates are metadata at verification time, not a guaranteed future horizon or publication schedule.

The documented basic location request is `GET /locations/{observatories}/{timeRange}/{coordinateSystems}/` with an ISO 8601 UTC interval and a listed coordinate-system name. The verified initial request is:

```text
GET https://sscweb.gsfc.nasa.gov/WS/sscr/2/locations/iss/20260927T120000Z,20260927T120500Z/geo,geij2000/
Accept: application/xml
```

It returned HTTP 200, `Content-Type: application/xml`, `StatusCode=Success`, `Data/Id=iss`, and six `Time` values from `2026-09-27T12:00:00.000Z` to `12:05:00.000Z`. Each `Coordinates` set had six `X`, `Y`, `Z`, `Latitude`, and `Longitude` values. A future-range request for `2026-10-05T12:00:00Z` through `12:02:00Z` also returned three values. Both requests worked without credentials. This establishes present public service access, not an uptime or latency guarantee. The [service documentation](https://sscweb.gsfc.nasa.gov/WebServices/REST/) lists `429` and `503` with `Retry-After` among expected responses. Its [JSON notice](https://sscweb.gsfc.nasa.gov/WebServices/REST/json/) says XML is the stable, officially defined interface and JSON may change; use XML if a secondary adapter is implemented.

## Historically selected position contract (now secondary/reference)

The smallest coherent record is **one `GEO` Cartesian position at one SSCWeb `Time`**. In a response, select `Data` with `Id=iss`, then `Coordinates` with `CoordinateSystem=Geo`; pair `Time[i]` with `X[i]`, `Y[i]`, `Z[i]`. NASA's [official Python client example](https://sscweb.gsfc.nasa.gov/WebServices/REST/py/sscws/sscws.html) uses this index relationship. Check equal array lengths before ingestion; never silently zip truncated arrays. The [XML schema](https://sscweb.gsfc.nasa.gov/WebServices/REST/SSC.xsd) defines `Time` as `dateTime` associated with each data point and `X/Y/Z` as `double` Cartesian components. The observed XML response supplied UTC `Z` times and decimal component strings; one representative first record was:

```text
Time=2026-09-27T12:00:00.000Z
CoordinateSystem=Geo
X=6163.0228485490115
Y=-2075.4104188497236
Z=1981.7142188549042
```

The corresponding `output=listing` request produced a NASA text table headed **`GEO (km)`**, with **`Radius (km)`**, and its formatting summary used kilometers for distance. NASA's [ISS notebook example](https://sscweb.gsfc.nasa.gov/WebServices/REST/jupyter/SscWsExampleExport.html) also labels returned Cartesian axes `X/Y/Z (km)`. Thus `GEO X/Y/Z` source units are **km**, with no conversion required for a later adapter. `Geo` is NASA SSCWeb's [Earth-rotating geographic, geocentric Cartesian frame](https://sscweb.gsfc.nasa.gov/users_guide/Appendix_C.html): X crosses the Greenwich meridian in the equatorial plane, Z follows Earth's rotation axis, and Y completes the right-handed set. Do not equate this label to a specific ITRF realization or a WGS84 geodetic coordinate without a separate transformation decision.

The response also contained source-provided `GEO Latitude` and `Longitude`, in the schema's **spherical coordinate set**. The NASA listing displayed decimal degrees and longitudes in `0..360`; those are available for a later explicitly labeled SSCWeb view but are not WGS84 geodetic latitude/longitude. `RadialLength` is defined by the schema as distance from Earth's center and the listing labels it km; it is **not altitude**. The basic GET response did **not** contain velocity components, an attitude record, cabin/system telemetry, or per-point quality flags. Do not invent these or derive velocity from 60-second position differences as if NASA supplied it.

## Time, provenance, and limitations

`Data/Time[i]` is the **ephemeris point epoch in UTC**, not a spacecraft measurement time, source publication time, or MISSION1 reception time. Record the query/fetch UTC separately. The observed GET response had no `Last-Modified` header or per-record production timestamp. NASA's [SSCWeb provenance table](https://sscweb.gsfc.nasa.gov/sscweb_data_provenance.html) lists `iss` with **definitive and predictive** ephemeris, both marked **weekly**, and identifies **TLE** as the source basis. The service's [user guide](https://sscweb.gsfc.nasa.gov/users_guide/) describes periodically updated stored ephemeris. The `locations` response does **not** say whether an individual point belongs to the definitive or predictive portion, nor expose its TLE epoch, source file revision, or measurement basis. Therefore a future SSCWeb record is **NASA SSCWeb-provided, TLE-based orbit ephemeris; pointwise definitive/predictive status `UNKNOWN`**. Do not describe a recent point as actual, measured, live, or a verified current ISS position. The metadata's weekly update indication is not a per-point freshness guarantee or polling SLA.

No per-point source quality/status was observed. MISSION1 may validate response success, field presence, finite numbers, vector/time-array alignment and duplicate epochs, and may report fetch health and data age as **project-computed** states. These checks do not turn a TLE-derived ephemeris into onboard telemetry. Preserve `source=NASA_SSCWEB`, raw frame `Geo`, km, point epoch, fetch time, and `point_prediction_status=UNKNOWN`. If a query returns no rows, expose `NO_DATA` for that query without synthesizing a position. Re-fetches may revise an epoch's value; do not assume immutability or exactly-once delivery. Cache/rate-limit policy is an implementation choice subject to provider `429`/`Retry-After` and current service behavior.

## Gate and source strategy

**SSCWeb source gate: `PASSED_WITH_SEMANTIC_LIMITATIONS` for a query-to-REST ephemeris path.** This was the historical first-source gate before ADR-0004 changed the primary strategy. The exact endpoint, ISS identifier, response shape, epoch, `GEO` frame and km unit are supported by current NASA documentation and observed responses. The limitation is its TLE-derived ephemeris nature and missing per-point definitive/predictive and source-quality metadata. A later secondary adapter may ingest, normalize, persist and expose an epoch-indexed `GEO` position with those limits stated. It may not claim live ISS telemetry, physical onboard measurement, velocity, WGS84 altitude, or a real-time current location. A secondary Earth-view comparison must label SSCWeb points as ephemeris and distinguish sample epoch from fetch time; Orekit-derived WGS84 values require verified frame mapping and tests.

If implemented, this source uses a **request/response interval-query adapter**, with bounded queries, response validation, periodic refresh only as an explicit MISSION1 policy, and HTTP retry/backoff. It is not an ISSLive subscription. [ISSLive's verified blocked state](source-verification.md) remains recorded separately: it can later supply streamed subsystem telemetry through its own adapter if public item payloads resume. [NASA OEM](source-verification.md#source-b-nasa-iss-orbit-ephemeris-message) remains NASA TOPO's separately published **predicted trajectory** product for a later actual-versus-predicted feature. The three products are not interchangeable.
