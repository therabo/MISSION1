# MISSION1 Earth View

The Earth View is a React 19 / TypeScript 7 / Vite 8 / CesiumJS 1.145 client. It consumes the [bounded orbital samples contract](../docs/api/orbital-samples.md). It does not fetch orbital elements or propagate an orbit in the browser. The [NASA ISS model record](../docs/frontend/iss-model.md) documents the selected asset, provenance, scale, configuration limits, validation and reproducible optimization.

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

The 15.2 MB optimized NASA GLB is served at `/models/iss-vtad-webp.glb` from `public/models/` in development and copied by Vite to `dist/models/` for production. It has no external texture requests. A missing GLB leaves the orbital marker and path usable; model state is reported separately.

## Time, provenance, and failure behavior

The browser validates the response frame (`ITRF_2020_IERS_2010`), meters, source identity, timestamps, time grid, positions, and quality/source-health fields before Cesium receives it. One response supplies one `SampledPositionProperty(ReferenceFrame.FIXED)` with degree-one linear interpolation and `ExtrapolationType.NONE`. A stable ISS entity owns the marker and `PathGraphics`. Past points reconstruct a path from the selected element set; future points are computed GP/TLE propagation, not NASA OEM prediction. There is no client SGP4, TLE parsing, inertial-frame conversion, or attitude.

The scene clock starts from backend `generatedAt`, adjusted by half the request duration, and advances at 1×. The status panel uses **backend WGS84** coordinates at the clearly displayed response generation time. The scene marker moves between the 10-second Cartesian samples; the coordinate readout updates with the next backend response. Requests are scheduled 120 seconds after the preceding request completes, so they never overlap. A failed refresh keeps an existing window and marks delivery degraded; the ISS remains visible only while scene time is inside that window. After `windowEnd`, the marker/path hide and the buffer reads `EXPIRED`. A new window replaces the old property as a unit, including on a TLE-hash change. Orbital quality and CelesTrak acquisition health remain independent.

The model's physical asset scale remains 1.0 for size validation, but Earth View uses `DISPLAY_ENHANCED_SCALE`: **the displayed ISS is NOT TO SCALE**. Cesium `minimumPixelSize: 72` enlarges it for map readability, bounded by `maximumScale: 20000`. An `ISS` label accompanies the model beyond 2,000 km and disappears inside 1,500 km; loading or failure retains the point marker. A `Model` primitive reads the **same** `SampledPositionProperty` as the marker/path entity on each scene tick. The size controls do not alter orbital coordinates, altitude or trajectory. Its matrix places the asset in the local east-north-up frame with identity asset-axis alignment; this is `DISPLAY_ONLY_LOCAL_ENU`, **not ISS attitude**. Attitude remains `UNAVAILABLE`. The camera's Focus ISS control follows the position while allowing manual orbit, pan and zoom; its zoom factor is reduced to 0.0005 to avoid overshooting the close model. Earth overview restores Cesium's default 5. No solar-array articulation is driven or implied.

## Coordinate boundary check

The deterministic test uses Orekit output at 2026-09-28 15:00:00 UTC from the verified ISS TLE fixture. Backend ITRF 2020 XYZ meters `(-243964.3795801904, 6767562.779805377, 552206.5345118039)` converted through Cesium `Cartesian3` and `Ellipsoid.WGS84.cartesianToCartographic` differs from backend WGS84 by **4.27×10⁻¹⁴° latitude**, **4.69×10⁻¹³° longitude**, and **8.74×10⁻¹⁰ m altitude** (rounded). Test tolerances are 0.0001° and 1 m. This checks coordinate-axis/unit compatibility for the integration; it is not an ISS positional-accuracy claim.
