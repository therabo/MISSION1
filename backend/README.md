# MISSION1 orbital core

This is one Java 21 / Spring Boot 3.5.6 application, built with Maven. Run `mvn test` or `mvn verify` from this directory. Startup creates the orbital components but makes **no external request**. The sole acquisition operation is an explicit `OrbitalElementsSource.fetch()` call; there is no scheduler, API, persistence, or UI in this milestone.

## Data path and meaning

`CelesTrakOrbitalElementsSource` requests the [verified ISS GP TLE URL](https://celestrak.org/NORAD/documentation/gp-data-formats.php) with `CATNR=25544&FORMAT=TLE`. It expects one three-line response, rejects a malformed or checksum-invalid TLE through Orekit `TLE.isFormatOK`, checks catalog identity through Orekit parsing, and records MISSION1 receipt time. HTTP status failures are surfaced without retry. In particular, a 403 is visible to the caller. A later acquisition policy must obey [CelesTrak's usage policy](https://celestrak.org/usage-policy.php); this application does not fetch on startup or automatically.

`OrbitalElementSet` carries the explicit `TLE` format, two original element lines, SHA-256 identity, catalog 25544, source provider `CELESTRAK_GP`, upstream lineage `USSF_GP_VIA_CELESTRAK`, source URI, element epoch, and retrieval time. Provider publication time is unknown (`null`). Its classification is `SOURCE_PROVIDED_ORBITAL_ELEMENTS`.

`OrekitOrbitalPropagator.propagate(elements, Instant)` creates a fresh `TLEPropagator` for each call. Orekit selects SGP4/SDP4 and returns TEME position and velocity at the requested time. Orekit then transforms the same state to **ITRF 2020 with IERS 2010 conventions and full EOP corrections** (`simpleEOP=false`), and `OneAxisEllipsoid` with Orekit WGS84 constants computes geodetic latitude, longitude and ellipsoidal altitude. `OrbitalState` is `COMPUTED_FROM_ORBITAL_ELEMENTS` and links to the source set through its hash, epoch, provider, upstream lineage, URI and retrieval time. Its signed `propagationOffset` is `propagationTime − elementEpoch`; current freshness instead uses `evaluationTime − elementEpoch`, and retrieval age uses `evaluationTime − retrievedAt`. A request near “now” is still a calculation from older elements, not onboard telemetry.

Canonical units are meters for Cartesian position and WGS84 altitude, meters/second for Cartesian velocity, radians for angles, and `Instant`/`Duration` for times and age. Both Cartesian states name their frames. No presentation conversions are performed. The low-level propagator returns `UNKNOWN`; it throws on invalid input or computation failure. The `OrbitalQualityEvaluator` takes a retained set (or `null`), explicit evaluation and propagation times, and separate source acquisition health. It returns a coordinate-bearing `GOOD`, `STALE`, or `UNKNOWN` state, or a coordinate-free `NO_DATA`/`INVALID` result with a stable reason. The [versioned current-state policy](../docs/telemetry/orbital-quality-policy.md) defines the MISSION1 24-hour epoch-age boundary and its limits; neither successful computation nor `GOOD` certifies positional accuracy.

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
