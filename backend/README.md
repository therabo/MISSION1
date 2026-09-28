# MISSION1 orbital core

This is one Java 21 / Spring Boot 3.5.6 application, built with Maven. Run `mvn test` or `mvn verify` from this directory. Startup applies the PostgreSQL migration but makes **no external ISS request**. The sole acquisition operation is an explicit `OrbitalElementsSource.fetch()` call; there is no scheduler or UI in this milestone.

## Data path and meaning

`CelesTrakOrbitalElementsSource` requests the [verified ISS GP TLE URL](https://celestrak.org/NORAD/documentation/gp-data-formats.php) with `CATNR=25544&FORMAT=TLE`. It expects one three-line response, rejects a malformed or checksum-invalid TLE through Orekit `TLE.isFormatOK`, checks catalog identity through Orekit parsing, and records MISSION1 receipt time. HTTP status failures are surfaced without retry. In particular, a 403 is visible to the caller. A later acquisition policy must obey [CelesTrak's usage policy](https://celestrak.org/usage-policy.php); this application does not fetch on startup or automatically.

`OrbitalElementSet` carries the explicit `TLE` format, two original element lines, SHA-256 identity, catalog 25544, source provider `CELESTRAK_GP`, upstream lineage `USSF_GP_VIA_CELESTRAK`, source URI, element epoch, and retrieval time. Provider publication time is unknown (`null`). Its classification is `SOURCE_PROVIDED_ORBITAL_ELEMENTS`.

`OrekitOrbitalPropagator.propagate(elements, Instant)` creates a fresh `TLEPropagator` for each call. Orekit selects SGP4/SDP4 and returns TEME position and velocity at the requested time. Orekit then transforms the same state to **ITRF 2020 with IERS 2010 conventions and full EOP corrections** (`simpleEOP=false`), and `OneAxisEllipsoid` with Orekit WGS84 constants computes geodetic latitude, longitude and ellipsoidal altitude. `OrbitalState` is `COMPUTED_FROM_ORBITAL_ELEMENTS` and links to the source set through its hash, epoch, provider, upstream lineage, URI and retrieval time. Its signed `propagationOffset` is `propagationTime − elementEpoch`; current freshness instead uses `evaluationTime − elementEpoch`, and retrieval age uses `evaluationTime − retrievedAt`. A request near “now” is still a calculation from older elements, not onboard telemetry.

Canonical units are meters for Cartesian position and WGS84 altitude, meters/second for Cartesian velocity, radians for angles, and `Instant`/`Duration` for times and age. Both Cartesian states name their frames. Only the API converts geodetic angles to degrees. The low-level propagator returns `UNKNOWN`; it throws on invalid input or computation failure. The `OrbitalQualityEvaluator` takes a retained set (or `null`), explicit evaluation and propagation times, and separate source acquisition health. It returns a coordinate-bearing `GOOD`, `STALE`, or `UNKNOWN` state, or a coordinate-free `NO_DATA`/`INVALID` result with a stable reason. The [versioned current-state policy](../docs/telemetry/orbital-quality-policy.md) defines the MISSION1 24-hour epoch-age boundary and its limits; neither successful computation nor `GOOD` certifies positional accuracy.

## PostgreSQL element history

The `OrbitalElementSetRepository` port and Spring JDBC adapter accept an already obtained, validated set through `storeIfNew`. The adapter revalidates the TLE and its epoch/hash/catalog metadata, then atomically stores a unique source set and its retrieval observation. Flyway owns the schema. `findById`, bounded `recent(limit)`, and `latestUsable(asOf)` reconstruct domain objects. See [element-history semantics](../docs/telemetry/orbital-element-history.md) for identity, ordering, and timestamp rules. No fetched set is silently inserted on startup, and no quality result or computed orbital state is stored.

For local development, run `docker compose up -d --wait postgres` from the repository root, then `mvn spring-boot:run` from `backend/`. Flyway applies the migration and the HTTP server starts on port 8080. The root Compose file contains only PostgreSQL. Defaults are `jdbc:postgresql://localhost:5432/mission1`, user `mission1`, and password `mission1_local`: these are **local-only development values**. Override `MISSION1_DB_URL`, `MISSION1_DB_USER`, and `MISSION1_DB_PASSWORD` outside a local machine. `docker compose down` stops the database while retaining the named volume; `docker compose down -v` deliberately removes local database history.

`mvn test` and `mvn verify` run the existing offline orbital tests plus PostgreSQL integration tests using Testcontainers. Docker must be available for the latter. Those tests use the frozen real TLE fixture and a clearly marked test-only altered revision, never CelesTrak network calls or H2.

## Current orbital state API

`GET /api/iss/state` reads only the persisted element history. It captures one UTC instant, selects `latestUsable(now)` (epoch and retrieval time both no later than now), propagates that set with the existing Orekit path, and applies `orbital-current-v1` at the same instant. The endpoint never fetches CelesTrak; an empty database is expected to return 503 until a separate acquisition process stores a set. This is a **current-time computation from previously retrieved elements**, never live onboard ISS position telemetry. No current CelesTrak health is reported because acquisition health is not yet monitored or stored. Historical data availability does not prove provider availability.

This HTTP 200 example was recorded during the local check on 2026-09-28. It uses the frozen, previously retrieved real TLE fixture and a request-time Orekit computation; it is not a live onboard measurement or a production fallback:

```json
{
  "satellite": { "noradCatalogNumber": 25544 },
  "propagationTime": "2026-09-28T15:42:33.884625Z",
  "state": {
    "frame": "TEME",
    "positionMeters": { "x": -4576163.0332699055, "y": 4654362.09928317, "z": -1924575.7290375482 },
    "velocityMetersPerSecond": { "x": -4686.502871824431, "y": -2294.8556528583485, "z": 5597.579576609157 }
  },
  "geodetic": { "datum": "WGS84", "latitudeDegrees": -16.526524907495478,
                "longitudeDegrees": -108.5573298380022, "altitudeMeters": 428604.3645357017 },
  "source": {
    "provider": "CELESTRAK_GP", "upstreamOrigin": "USSF_GP_VIA_CELESTRAK",
    "elementEpoch": "2026-09-28T03:24:39.835008Z",
    "retrievedAt": "2026-09-28T13:58:32Z", "publishedAt": null,
    "elementSha256": "151bdb4cf2b7128ac815aa975736ffec0c28211751963e8be7263aad7b7abc71",
    "classification": "SOURCE_PROVIDED_ORBITAL_ELEMENTS"
  },
  "classification": "COMPUTED_FROM_ORBITAL_ELEMENTS",
  "quality": {
    "status": "GOOD", "reason": "NONE", "policy": "orbital-current-v1",
    "elementAgeSeconds": 44274.049617, "retrievalAgeSeconds": 6241.884625,
    "propagationOffsetSeconds": 44274.049617
  }
}
```

The response uses SI Cartesian units, WGS84 ellipsoidal altitude in meters, and geodetic angles converted from canonical radians to degrees at the API boundary. Longitude follows Orekit's `[-180°, +180°]` convention. `elementEpoch` is the TLE solution epoch, `retrievedAt` is MISSION1 observation time, and nullable `publishedAt` is provider publication time when verified; none is substituted for another. `elementSha256` identifies the source content without exposing raw TLE lines or a database key. Ages are signed decimal seconds; `propagationOffsetSeconds` is propagation time minus element epoch. `GOOD` and `STALE` are MISSION1 recency judgments, not accuracy guarantees or stored properties of the TLE. A computed `STALE` state remains HTTP 200 with coordinates and an explicit stale reason.

Errors use `application/problem+json` with a stable `type` URN, status, title and safe detail. `503` with `urn:mission1:problem:no-orbital-elements` means no set was both observed and eligible at evaluation time. Invalid stored metadata yields `500` with `orbital-data-integrity-error`; an invalid selected TLE yields `invalid-orbital-elements`; Orekit/EOP/transform failures yield `orbital-calculation-failed`. Unexpected server errors yield `orbital-internal-error`. Failures return no fake coordinates. A successful response does not assert that CelesTrak is currently healthy.

## Reproducible Orekit data

Only `tai-utc.dat` and `Earth-Orientation-Parameters/IAU-2000/finals2000A.all` were copied from the [Orekit data repository](https://gitlab.orekit.org/orekit/orekit-data/) at commit `3e376b326373467647b1e246ebb083cd9e57cd68` into `src/main/resources/orekit-data/`. The SHA-256 values are:

| File | SHA-256 |
| --- | --- |
| `tai-utc.dat` | `3524e1ae34d67e858873a89e59983bbc5bd100221da898e796c1b36036a310c3` |
| `finals2000A.all` | `e3905ff7a74b791744704aa3e900a2161e96db97a30095d8fc442b04e4cfe058` |

A private Orekit `LazyLoadedDataContext` loads those classpath files. UTC, TEME and ITRF all use that context; no global Orekit directory or machine configuration is consulted. The code requires nonempty EOP and refuses propagation outside its tabulated coverage. The EOP file contains forecast rows as well as observations; use of a forecast row does not turn a computed state into an observed state. Updating the bundle later requires pinning a new revision, rechecking provenance and reference outputs, and running the offline tests.

## Frozen, independent reference

`src/test/resources/iss-2026-09-28.tle` is the real, checksum-valid response recorded in the [project's CelesTrak verification](../docs/telemetry/orbital-elements-verification.md) at **2026-09-28 13:58:32 UTC**. Its TLE epoch is **2026-09-28 03:24:39.835008 UTC**. It is an offline historical test fixture, never a production fallback or current position.

The expected TEME values were generated with [python-sgp4 2.25](https://github.com/brandon-rhodes/python-sgp4), which wraps Vallado's SGP4 code, independently of Orekit. Earth-fixed and WGS84 values were generated with [Skyfield 1.53](https://rhodesmill.org/skyfield/earth-satellites.html) using its built-in time scale and ITRS/WGS84 routines. The fixed UTC test times are the TLE epoch and one hour later. `reference/generate_reference.py` reproduces these numbers without provider access; its separate Python dependencies are pinned in `reference/requirements.txt` and are **not** used by Maven or the production backend.

At the one-hour time the independent reference yields TEME position `(5245553.221649, 875882.115212, -4235873.375230) m`, TEME velocity `(-3859.158777, 5515.945720, -3646.518240) m/s`, ITRS position `(2360181.378210, -4765767.718096, -4235873.375230) m`, and WGS84 `(-38.7127913707°, -63.6537145463°, 429129.640797 m)`. Tests allow **0.01 m per TEME position component** and **0.0001 m/s per velocity component** to catch propagation changes while allowing rounding. For the Earth-fixed/geodetic cross-check they allow **150 m per Cartesian component, 0.002° per angle and 100 m altitude** because Skyfield's ITRS/time-orientation path differs from the pinned Orekit ITRF/EOP path; the observed one-hour Cartesian difference is tens of meters. These are software cross-check tolerances, not ISS orbit accuracy estimates.
