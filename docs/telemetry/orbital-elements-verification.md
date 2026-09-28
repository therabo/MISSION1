# ISS orbital elements: source and propagation gate

Verified **2026-09-28 UTC** for ISS/NORAD catalog **25544**. This record establishes a usable source of **orbital elements**, not onboard ISS position telemetry or a guaranteed precise current orbit. See [the architecture decision](../adr/0004-local-gp-propagation-for-current-orbit.md) for the resulting design. `VERIFIED` applies only to the fact named in each row; availability can change.

## Selected primary source: CelesTrak GP

**Final source-selection check (2026-09-28):** [ISS-E SupGP was compared with this source](iss-supgp-source-selection.md) at the same UTC instant using the working Orekit core. Standard GP remains `PRIMARY`; ISS-E SupGP is `DEFERRED` because CelesTrak's exact six-hour segment boundary/selection semantics remain unverified. The 10.923366 km difference between the computed states is not a truth-error measurement. The standard response was retrieved again at 14:26:25 UTC in the orbital-core task (same epoch), and that recorded response was reused within CelesTrak's download guidance for the comparison at 14:45:37 UTC.

| Fact | Evidence and classification |
| --- | --- |
| Endpoint | **VERIFIED:** unauthenticated `GET https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE`. [CelesTrak's current GP format documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) explicitly gives this ISS query. A single direct request returned HTTP 200, `text/plain`, and a three-line ISS TLE at **2026-09-28 13:58:32 UTC** (HTTP response `Date`). |
| Identity and raw representation | **VERIFIED:** name line `ISS (ZARYA)` and both 69-character element lines carry catalog number `25544`; line checksums passed. The observed line-1 epoch token was `26271.14212772`, corresponding under the [documented TLE year/day and checksum convention](https://celestrak.org/NORAD/documentation/tle-fmt.php) to **2026-09-28 03:24:39.835008 UTC**. This is the **element epoch**, not retrieval or publication time. Preserve both original element lines and a hash/version identity; do not embed this time-varying sample as production data. |
| Provenance | **VERIFIED at service-description level:** CelesTrak distributes GP data received through US Space-Track/USSF space-surveillance channels; [CelesTrak's GP documentation](https://celestrak.org/NORAD/documentation/gp-data-formats.php) describes GP production and its Space-Track relationship. Source provider is **CelesTrak**, upstream origin **USSF GP via Space-Track**. Neither source is NASA onboard telemetry. The exact observation set, individual fit/revision, and current positional accuracy are **UNVERIFIED**. |
| Formats | **VERIFIED:** explicit `FORMAT=TLE`/`3LE`, `2LE`, `XML` (CCSDS OMM), `KVN` (CCSDS OMM), `JSON`, and `CSV`; JSON/CSV use OMM keywords. As of 2026-05-09, the default is CSV, so always specify `FORMAT`. CelesTrak recommends OMM XML for future compatibility and warns that TLE cannot represent catalog numbers above 99999. ISS `25544` fits TLE. |
| Publication/update metadata | **PARTIALLY_VERIFIED:** response `Date` records HTTP response time. The tested TLE response did not expose a `Last-Modified` header or a source creation/publication instant. The element epoch is not a publication time. Record MISSION1 `retrievedAtUtc` independently; keep `publishedAtUtc: null` unless later evidence supports it. |
| Refresh behavior | **VERIFIED as provider guidance, not an SLA:** [CelesTrak's usage policy](https://celestrak.org/usage-policy.php) asks clients to fetch only needed data and no more often than its roughly two-hour GP update cycle; repeated excessive or erroneous requests can be blocked. Use a cached last valid element set and a bounded scheduled refresh in a later slice. The current policy tells machine clients to **stop querying immediately on any non-200 response and report it for investigation**; do not implement blind automatic retries after 301/403/404/5xx. Never fetch for each rendered position. No exact ISS publication cadence or guaranteed freshness is claimed. |
| Access/reuse | **VERIFIED:** endpoint worked without credentials. Provider usage restrictions apply to requests. An explicit license permitting redistribution of raw GP responses was **not verified**; this project's open-source code should fetch at runtime and avoid bundling current raw elements or asserting unrestricted redistribution rights. |

At the observed HTTP response time the returned element epoch was approximately **10 h 34 min earlier**. This is a concrete example of why CelesTrak's general two-hour update cycle cannot be treated as a two-hour ISS element-age guarantee. The endpoint supplied the latest available response during this check, but no orbit accuracy or `GOOD` freshness classification follows from the HTTP 200. The application must expose age and apply its own documented policy.

### Format decision

**MVP1 selects explicit TLE.** It is currently available for `25544`, is small and checksum-verifiable, and maps directly to Orekit's supported `TLE`/`TLEPropagator` API. CelesTrak and Space-Track's OMM preference is acknowledged: OMM carries richer metadata and works beyond TLE's five-digit catalog limit. An OMM migration should be a separate verified change, not an ad hoc conversion of OMM mean elements into generic Keplerian elements. The source port returns a validated domain **orbital element set**; it does not expose CelesTrak HTTP DTOs to propagation, persistence, or API layers.

## Space-Track GP: possible future direct source

[Space-Track's current API documentation](https://www.space-track.org/documentation) documents GP access, e.g. `/basicspacedata/query/class/gp/norad_cat_id/25544/format/tle`, and TLE plus OMM-style XML/KVN/JSON/CSV output. It requires account authentication; no authenticated response was tested. Its published API guidance limits automated usage (under 30 requests/minute and 300/hour; GP commonly updates about hourly). The [account agreement](https://www.space-track.org/auth/createAccount) includes a restriction on transferring received data or analyses to another entity without prior express approval. These terms need a project-specific review before an open-source public service or redistribution feature uses direct Space-Track access. **Implementation readiness: BLOCKED for MVP1** by account/terms and no direct payload verification; no automatic fallback is designed. This does not weaken Space-Track's upstream role in CelesTrak GP provenance.

## Verified Orekit route and output semantics

The [Orekit stable release page](https://www.orekit.org/download.html) listed **13.1.8** on verification; its [13.1.8 TLEPropagator API](https://www.orekit.org/site-orekit-13.1.8/apidocs/org/orekit/propagation/analytical/tle/TLEPropagator.html) documents `selectExtrapolator(TLE)` and selection of SGP4/SDP4. The [TLE API](https://www.orekit.org/site-orekit-13.1.8/apidocs/org/orekit/propagation/analytical/tle/TLE.html) accepts the two element lines and exposes their date. The propagator's native output frame is **TEME**, not J2000. Do not manually implement SGP4, use a generic Keplerian propagator, or treat TLE mean elements as osculating state components.

The intended verified conceptual chain is:

```text
CelesTrak GP TLE for NORAD 25544
  → validate identity, line structure/checksums and parse with Orekit TLE
  → TLEPropagator.selectExtrapolator(TLE) [SGP4 or SDP4 selected by Orekit]
  → propagate(requested UTC instant) → Cartesian position + velocity in TEME
  → Orekit TEME-to-ITRF transformation at that instant
  → WGS84 OneAxisEllipsoid geodetic latitude, longitude and altitude
  → source-linked computed OrbitalState
```

[FramesFactory](https://www.orekit.org/site-orekit-13.1.8/apidocs/org/orekit/frames/FramesFactory.html) supplies `getTEME()` and `getITRF(IERSConventions.IERS_2010, ...)`; [OneAxisEllipsoid](https://www.orekit.org/site-orekit-13.1.8/apidocs/org/orekit/bodies/OneAxisEllipsoid.html) supports transforming a frame-tagged position to a geodetic point using WGS84 Earth parameters. Orekit Cartesian position/velocity are **m** and **m/s**; geodetic latitude/longitude are **rad**, altitude **m** internally. API presentation may convert angles to degrees and lengths to km, with units explicit. A speed magnitude must name its frame (`TEME` or `ITRF`), since they differ. The Earth-orientation/auxiliary data used for ITRF transformation must be pinned, reproducible, and validated. Missing data or failed transformation is an error, never a silent identity transform. Orekit propagators are not documented as thread-safe; do not share one mutable propagator across concurrent requests without safe confinement.

The output is **`COMPUTED_FROM_ORBITAL_ELEMENTS`**. The state time is the requested propagation instant, distinct from the element epoch, HTTP response time and MISSION1 retrieval time. A new state at `Instant.now()` is a **real-time computation** from an older element set, not a newly measured ISS position. Position and velocity are model estimates; later ground-track points share the same element lineage. Future points are `COMPUTED_PREDICTION_FROM_ORBITAL_ELEMENTS`, distinct from NASA OEM's independently produced predicted ephemeris. No accuracy or conjunction-use guarantee is implied.

## Minimum data, quality and testing contract

- Persist each accepted TLE as a coherent source element set: provider, upstream origin, NORAD identity, two raw lines, derived element epoch, retrieval time, content hash, source format and validation outcome. Unknown provider publication time stays `null`. A retained older set may serve a degraded current estimate during provider outage; the outage is separately visible.
- A computed state carries propagation time, TEME Cartesian position and velocity with units, WGS84 geodetic point, element-set identity/epoch/age, method/version and provenance. `elementAge = propagationTime − elementEpoch` is signed; do not confuse it with `now − retrievedAt` or a display's update cadence.
- Define an **orbital-element-specific application policy** for accepted propagation window and `GOOD`/`STALE`/`NO_DATA`/`INVALID`/`UNKNOWN`. `GOOD` can mean mathematically valid and within the project's documented age window; it is not provider-certified positional accuracy. A threshold needs a documented project rationale and tests before production behavior. No provider quality/status flag for this TLE response was observed.
- Deterministic tests freeze a valid real element set and propagation instant, validate malformed/checksum/satellite mismatch, age boundaries, TEME PV, frame conversion and WGS84 values against an **independent reference** with stated tolerances. Ordinary CI is offline. [CelesTrak's SGP4 verification material](https://celestrak.org/software/tutorials/sgp4-verification.php) is a candidate primary reference; fixture values and tolerances must be checked when tests are written. A separate optional live source smoke test checks availability only.

**Gate: `READY_FOR_IMPLEMENTATION` for the element-acquisition and propagation design.** The exact runtime EOP bundle, application age threshold, API schema and independent numerical fixtures are implementation decisions/tests still required before declaring a production orbital result accurate. The no-auth current TLE, identity/epoch representation, supported Orekit propagation, and frame/geodetic API are verified sufficiently to begin that bounded slice.

## Other source roles

- [NASA SSCWeb](sscweb-verification.md) remains a **secondary/reference ephemeris query source**, valuable for independent comparison and historical intervals. Its verified `Geo` X/Y/Z are TLE-derived and per-point definitive/predictive status is unknown; it is not the primary current-position path and not a guaranteed ground-truth validator.
- [ISSLive / Lightstreamer](source-verification.md) remains a future **onboard/subsystem streaming** candidate. Public connection/subscription succeeded but no item payload arrived in bounded 2026-09-28 tests: `BLOCKED_BY_PUBLIC_SOURCE`, not proven permanent withdrawal.
- [NASA OEM](source-verification.md#source-b-nasa-iss-orbit-ephemeris-message) remains a separate **NASA predicted ephemeris** for later comparison, never a source of onboard live telemetry.
