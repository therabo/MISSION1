# MISSION1 Earth View

The first Earth View is a React 19 / TypeScript 7 / Vite 8 / CesiumJS 1.145 client. It consumes the [bounded orbital samples contract](../docs/api/orbital-samples.md). It does not fetch orbital elements or propagate an orbit in the browser.

## Local run

Use Node.js **24 LTS** (`.nvmrc` pins the tested 24.21.0 release) and npm 11. From the repository root:

```sh
docker compose up -d --wait postgres
```

In a second terminal, from `backend/`:

```sh
mvn spring-boot:run
```

In a third terminal, from `frontend/`:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The `/api` development proxy points to Spring on `127.0.0.1:8080`. The frontend uses relative `/api/iss/orbit/samples` requests. No backend CORS setting or frontend API secret is needed. The backend intentionally makes no CelesTrak request at startup; a fresh database yields HTTP 503 and the Earth View shows an empty orbital state until the existing provider-respecting acquisition workflow stores a valid set. For the browser verification of this milestone, PostgreSQL already contained the verified CelesTrak ISS TLE observation from 2026-09-28 13:58:32 UTC. The UI labeled its source and element epoch; it was not a production fallback.

## Build and test

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` typechecks and writes `dist/`. `npm run preview` serves that build and proxies `/api` for a local runtime check. The Cesium/Vite configuration uses `vite-plugin-static-copy` to serve Cesium's `Workers`, `Assets`, `Widgets`, and `ThirdParty` under `/cesiumStatic/` in development and copy them into the production build. `CESIUM_BASE_URL` points there. The viewer uses bundled low-resolution Natural Earth II imagery over a WGS84 ellipsoid, with credits visible. [Natural Earth raster data are public domain](https://www.naturalearthdata.com/about/terms-of-use/); the UI still names the imagery source. It does not request Cesium ion imagery/terrain or require an ion token.

## Time, provenance, and failure behavior

The browser validates the response frame (`ITRF_2020_IERS_2010`), meters, source identity, timestamps, time grid, positions, and quality/source-health fields before Cesium receives it. One response supplies one `SampledPositionProperty(ReferenceFrame.FIXED)` with degree-one linear interpolation and `ExtrapolationType.NONE`. A stable ISS entity owns the marker and `PathGraphics`. Past points reconstruct a path from the selected element set; future points are computed GP/TLE propagation, not NASA OEM prediction. There is no client SGP4, TLE parsing, inertial-frame conversion, or attitude.

The scene clock starts from backend `generatedAt`, adjusted by half the request duration, and advances at 1×. The status panel uses **backend WGS84** coordinates at the clearly displayed response generation time. The scene marker moves between the 10-second Cartesian samples; the coordinate readout updates with the next backend response. Requests are scheduled 120 seconds after the preceding request completes, so they never overlap. A failed refresh keeps an existing window and marks delivery degraded; the ISS remains visible only while scene time is inside that window. After `windowEnd`, the marker/path hide and the buffer reads `EXPIRED`. A new window replaces the old property as a unit, including on a TLE-hash change. Orbital quality and CelesTrak acquisition health remain independent.

## Coordinate boundary check

The deterministic test uses Orekit output at 2026-09-28 15:00:00 UTC from the verified ISS TLE fixture. Backend ITRF 2020 XYZ meters `(-243964.3795801904, 6767562.779805377, 552206.5345118039)` converted through Cesium `Cartesian3` and `Ellipsoid.WGS84.cartesianToCartographic` differs from backend WGS84 by **4.27×10⁻¹⁴° latitude**, **4.69×10⁻¹³° longitude**, and **8.74×10⁻¹⁰ m altitude** (rounded). Test tolerances are 0.0001° and 1 m. This checks coordinate-axis/unit compatibility for the integration; it is not an ISS positional-accuracy claim.
