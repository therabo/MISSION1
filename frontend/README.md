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

`npm run build` typechecks and writes `dist/`. `npm run preview` serves that build and proxies `/api` for a local runtime check. The Cesium/Vite configuration uses `vite-plugin-static-copy` to serve Cesium's `Workers`, `Assets`, `Widgets`, and `ThirdParty` under `/cesiumStatic/` in development and copy them into the production build. `CESIUM_BASE_URL` points there. The WGS84 ellipsoid uses tiled NASA GIBS Blue Marble: Next Generation day imagery and fixed 2016 Black Marble night imagery. Bundled Natural Earth II and the 779,638-byte local Black Marble JPEG remain outage fallbacks. Credits remain visible; no Cesium ion imagery, terrain or token is required. The six local NASA Tycho skybox faces are served from `public/skybox/`. Their sources and hashes are in [the rendering record](../docs/frontend/rendering-quality.md).

The 32.7 MB semantically enriched NASA GLB uses deduplicated, lossless source PNG textures and is served at `/models/iss-vtad-source-png.glb` from `public/models/` in development and copied by Vite to `dist/models/` for production. It has no external texture requests. The model preloads at Viewer start with texture streaming disabled, stays hidden until geometry, textures and semantic nodes are ready, and persists across camera modes. A missing GLB leaves the orbital marker and path usable; model state is reported separately. The desktop quality policy uses device pixels, 4× MSAA where supported, and a small low-DPI resolution increase. See [renderer settings and hardware observations](../docs/frontend/rendering-quality.md).

## Time, provenance, and failure behavior

The browser validates the response frame (`ITRF_2020_IERS_2010`), meters, source identity, timestamps, time grid, positions, and quality/source-health fields before Cesium receives it. One response supplies one `SampledPositionProperty(ReferenceFrame.FIXED)` with degree-one linear interpolation and `ExtrapolationType.NONE`. A stable ISS entity owns the marker and `PathGraphics`. Past points reconstruct a path from the selected element set; future points are computed GP/TLE propagation, not NASA OEM prediction. There is no client SGP4, TLE parsing, inertial-frame conversion, or attitude.

The scene clock starts from backend `generatedAt`, adjusted by half the request duration, and advances at 1×. The status panel uses **backend WGS84** coordinates at the clearly displayed response generation time. The scene marker moves between the 10-second Cartesian samples; the coordinate readout updates with the next backend response. Requests are scheduled 120 seconds after the preceding request completes, so they never overlap. A failed refresh keeps an existing window and marks delivery degraded; the ISS remains visible only while scene time is inside that window. After `windowEnd`, the marker/path hide and the buffer reads `EXPIRED`. A new window replaces the old property as a unit, including on a TLE-hash change. Orbital quality and CelesTrak acquisition health remain independent.

The model's physical asset scale remains 1.0 for size validation, but Earth View uses `DISPLAY_ENHANCED_SCALE`: **the displayed ISS is NOT TO SCALE**. Cesium `minimumPixelSize: 72` enlarges it for map readability, bounded by `maximumScale: 20000`. An `ISS` label and point locator accompany the model beyond 2,000 km and disappear inside 1,500 km; loading or failure retains the point marker. A `Model` primitive reads the **same** `SampledPositionProperty` as the marker/path entity on each scene tick. A small display-only translation centers the asset's off-origin bounds on that sampled point. Sizing and centering do not alter orbital coordinates, altitude or trajectory. The asset uses local east-north-up with identity axis alignment: `DISPLAY_ONLY_LOCAL_ENU`, **not ISS attitude**. Attitude remains `UNAVAILABLE`. No solar-array articulation is driven or implied.

## Earth Overview and ISS Inspection

EARTH_OVERVIEW keeps the globe freely navigable, the computed recent/future arc visible, and the far ISS locator active. Click the visible ISS point, label or model, or use Inspect ISS, to enter ENTERING_INSPECTION when the model and orbital buffer are available. One five-second moving-target approach reads the current SampledPositionProperty at the same scene time as the rendered model on every tick. The camera follows an offset in the current ISS ENU frame from the captured Overview pose toward the 340 m inspection composition. The path is checked against Earth occlusion; an occulted or Earth-intersecting start first uses a safe radial acquisition. The model's minimum display footprint grows smoothly during entry. No fixed future flight target, second orbit model or new API is involved.

At arrival, Camera.lookAtTransform adopts the same current ENU frame and offset without a visible pose change. The user can drag around the moving ISS pivot immediately, wheel or pinch to zoom, and use Back to Earth View during entry or after arrival. Return restores the saved Overview world pose over 1.2 seconds. A missing or expired sample buffer, model failure or unmount safely stops entry. Sample-window refresh does not restart the approach. The same Viewer, model primitive and scene clock persist. Cesium's native Sun and the NASA Tycho skybox remain enabled; the Sun appears only when the geometry places it in view.

The globe uses Cesium solar lighting with the scene clock, Sun and atmosphere to show day, night and a moving terminator. NASA GIBS tiled Blue Marble imagery shows daytime geography; a second tiled layer on the same globe shows historical 2016 Black Marble with dayAlpha 0, nightAlpha 1 and twilight interpolation. Night lights are not live city electricity or population telemetry. Network failures leave local fallback imagery usable. See [source, alignment and visual limits](../docs/frontend/earth-visualization.md).

At inspectable camera distances (up to 1,000 m from the sampled ISS center), direct clicks can select 14 verified component identities: Destiny, Columbus, Harmony, Pirs, Poisk, Zvezda, Rassvet, Zarya, Kibo Exposed Facility, Kibo Pressurized Module, Quest, Cupola, Tranquility, and Unity. Pirs is explicitly marked as removed in 2021; its presence reflects the historical NASA VTAD model, not the current station. The panel separates asset identity from current configuration and says live module telemetry is unavailable. All other geometry remains unmapped; global-view clicks do not infer module identity. The [semantic map](../docs/frontend/iss-semantic-map.md) and [ISS model record](../docs/frontend/iss-model.md) document evidence, feature metadata, picking and hashes.

The inspection camera keeps the user's local ENU offset as the sampled ISS pivot moves. A long-drag excursion is bounded to 2,000 m. CAMERA TRACKING FRAME = ENU is separate from MODEL DISPLAY ORIENTATION = DISPLAY_ONLY_LOCAL_ENU and SPACECRAFT ATTITUDE = UNAVAILABLE. The initial composition uses heading 35°, pitch −10°, range 340 m and inspection zoom factor 0.01; Earth Overview restores factor 5. These are presentation settings, not physical ISS attitude or scale. See the [inspection interaction record](../docs/frontend/iss-inspection-mode.md) for root-cause measurements, approach geometry and interruption details.

## Coordinate boundary check

The deterministic test uses Orekit output at 2026-09-28 15:00:00 UTC from the verified ISS TLE fixture. Backend ITRF 2020 XYZ meters `(-243964.3795801904, 6767562.779805377, 552206.5345118039)` converted through Cesium `Cartesian3` and `Ellipsoid.WGS84.cartesianToCartographic` differs from backend WGS84 by **4.27×10⁻¹⁴° latitude**, **4.69×10⁻¹³° longitude**, and **8.74×10⁻¹⁰ m altitude** (rounded). Test tolerances are 0.0001° and 1 m. This checks coordinate-axis/unit compatibility for the integration; it is not an ISS positional-accuracy claim.
