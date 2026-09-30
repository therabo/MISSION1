# MISSION1 Earth View

The Earth View is a React 19 / TypeScript 7 / Vite 8 / CesiumJS 1.145 client. It consumes the [bounded orbital samples contract](../docs/api/orbital-samples.md) for the ISS model and the separate [trajectory comparison contract](../docs/api/orbital-comparison.md) for the two globe lines. It does not fetch orbital elements or propagate an orbit in the browser. The [NASA ISS model record](../docs/frontend/iss-model.md) documents the selected asset, provenance, scale, configuration limits, validation and reproducible optimization.

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

Open the URL printed by Vite. The `/api` development proxy points to Spring on `127.0.0.1:8080`. The frontend uses relative `/api/iss/orbit/samples` and `/api/iss/orbit/comparison` requests. No backend CORS setting or frontend API secret is needed. The backend intentionally makes no CelesTrak request at startup; a fresh database yields HTTP 503 and the Earth View shows an empty orbital state until the existing provider-respecting acquisition workflow stores a valid set. For the browser verification of this milestone, PostgreSQL already contained the verified CelesTrak ISS TLE observation from 2026-09-28 13:58:32 UTC. The UI labeled its source and element epoch; it was not a production fallback.

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

The browser validates frame (`ITRF_2020_IERS_2010`), meters, timestamps, uniform grids, bounded positions and source lineage. The primary short buffer uses linear degree-one `SampledPositionProperty(FIXED)` with no extrapolation. Optional OEM has its own bounded property from backend source-vector Hermite/ITRF samples. `selectedPositionAt` is the single physical source for model, loading locator, approach and moving Inspection pivot. Selection is immediate with no cross-source interpolation.

The backend-aligned 1× scene clock starts at `generatedAt` plus half request duration. The position panel now shows Cesium WGS84 conversion of the same selected physical scene point, labeled with scene time and source; backend geographic/orbital state is unchanged. Requests refresh separately every 120 seconds after completion. Primary failure retains a labeled bounded buffer; expiry hides the pose and exits Inspection. Comparison failure hides the lines and explicitly returns selected OEM to primary. A normal slightly-ahead refreshed comparison waits on its preceding still-valid moving buffer until covered, preventing a false OEM loss at a clock seam. True unavailability is adopted immediately.

Overview's accessible **Position / trajectory source** selector defaults to **MISSION1 GP/TLE**, with **NASA OEM** available only within source and sample coverage and the 300 s response display limit. Covered `DEGRADED` OEM is allowed with its status visible. Source controls lock during entry, Inspection and return. Selection is not persisted across sessions. OEM remains **NASA predicted ephemeris**; primary remains computed from orbital elements. GP quality, CelesTrak acquisition and OEM availability remain independent.

The GLB remains **NOT TO SCALE**, with `minimumPixelSize: 92` (previously 96), `maximumScale: 20000` and physical asset scale 1. A browser decision gate compared smaller-only, +5 km display-only lift and a 1 px white silhouette at alpha 0.30. Smaller-only was sufficient: `DISPLAY_ONLY_EARTH_VIEW_OFFSET=0`, no silhouette. Only asset-centering translation remains. The ready model alone is clickable; point/label are loading/error fallbacks with valid selected positions. Orientation is `DISPLAY_ONLY_LOCAL_ENU`, attitude `UNAVAILABLE`, and textures/features must be ready before reveal.

## Earth Overview and ISS Inspection

EARTH_OVERVIEW keeps the globe freely navigable, the two continuous forward trails visible when available, and the display-enhanced ISS model visible. Click the ready ISS model, or use Inspect ISS, to enter ENTERING_INSPECTION when the model and orbital buffer are available. One five-second moving-target approach reads the current SampledPositionProperty at the same scene time as the rendered model on every tick. The camera follows an offset in the current ISS ENU frame from the captured Overview pose toward the 340 m inspection composition. The path is checked against Earth occlusion; an occulted or Earth-intersecting start first uses a safe radial acquisition. The model's minimum display footprint grows smoothly during entry. No fixed future flight target, second orbit model or new API is involved.

At arrival, Camera.lookAtTransform adopts the same current ENU frame and offset without a visible pose change. The user can drag around the moving ISS pivot immediately, wheel or pinch to zoom, and use Back to Earth View during entry or after arrival. Return restores the saved Overview world pose over 1.2 seconds. A missing or expired sample buffer, model failure or unmount safely stops entry. Sample-window refresh does not restart the approach. The same Viewer, model primitive and scene clock persist. Cesium's native Sun and the NASA Tycho skybox remain enabled; the Sun appears only when the geometry places it in view.

The globe uses Cesium solar lighting with the scene clock, Sun and atmosphere to show day, night and a moving terminator. NASA GIBS tiled Blue Marble imagery shows daytime geography; a second tiled layer on the same globe shows historical 2016 Black Marble with dayAlpha 0, nightAlpha 1 and twilight interpolation. Night lights are not live city electricity or population telemetry. Network failures leave local fallback imagery usable. See [source, alignment and visual limits](../docs/frontend/earth-visualization.md).

At inspectable camera distances (up to 1,000 m from the sampled ISS center), direct clicks can select 14 verified component identities: Destiny, Columbus, Harmony, Pirs, Poisk, Zvezda, Rassvet, Zarya, Kibo Exposed Facility, Kibo Pressurized Module, Quest, Cupola, Tranquility, and Unity. Pirs is explicitly marked as removed in 2021; its presence reflects the historical NASA VTAD model, not the current station. The panel separates asset identity from current configuration and says live module telemetry is unavailable. All other geometry remains unmapped; global-view clicks do not infer module identity. The [semantic map](../docs/frontend/iss-semantic-map.md) and [ISS model record](../docs/frontend/iss-model.md) document evidence, feature metadata, picking and hashes.

The inspection camera keeps the user's local ENU offset as the sampled ISS pivot moves. A long-drag excursion is bounded to 2,000 m. CAMERA TRACKING FRAME = ENU is separate from MODEL DISPLAY ORIENTATION = DISPLAY_ONLY_LOCAL_ENU and SPACECRAFT ATTITUDE = UNAVAILABLE. The initial composition uses heading 35°, pitch −10°, range 340 m and inspection zoom factor 0.01; Earth Overview restores factor 5. These are presentation settings, not physical ISS attitude or scale. See the [inspection interaction record](../docs/frontend/iss-inspection-mode.md) for root-cause measurements, approach geometry and interruption details.

## Coordinate boundary check

The deterministic test uses Orekit output at 2026-09-28 15:00:00 UTC from the verified ISS TLE fixture. Backend ITRF 2020 XYZ meters `(-243964.3795801904, 6767562.779805377, 552206.5345118039)` converted through Cesium `Cartesian3` and `Ellipsoid.WGS84.cartesianToCartographic` differs from backend WGS84 by **4.27×10⁻¹⁴° latitude**, **4.69×10⁻¹³° longitude**, and **8.74×10⁻¹⁰ m altitude** (rounded). Test tolerances are 0.0001° and 1 m. This checks coordinate-axis/unit compatibility for the integration; it is not an ISS positional-accuracy claim.

## Forward-only comparison styling

The backend primary delivers 181 actual propagations from response time through one current TLE mean-motion period. This buffer supplies refresh headroom; the scene renders only **future direction**, from **scene time +40 seconds** through **scene time +0.85T**. No past trail, appended first point, closing segment or extrapolated OEM geometry appears. OEM uniformly samples its real coverage intersection, includes exact boundaries and shortens honestly when coverage ends earlier.

Both products use identical continuous halo/body primitives (20/8 px; halo multiplier 0.26; glow powers 0.35/0.22). Active color is `#53d9cd`, body maximum alpha 0.85; inactive color `#71939c`, maximum alpha 0.12. Inactive primitives precede active ones; exact positions do not change on selection. No dash material remains.

Normalized future phase `u=(sampleTime-start)/(end-start)` fades by `1-u²(3-2u)`, with zero alpha before the gap and at/after the real endpoint. Public Fabric composes this temporal mask with built-in `PolylineGlow` soft edges. Scene ticks change uniforms, not geometry; complete hidden replacement groups become visible only after all layers are ready. Both trails hide in Inspection. See the [visual review and performance evidence](../docs/frontend/orbital-trajectory-rendering.md) and [ADR-0006](../docs/adr/0006-selectable-forward-trajectory-visualization.md).
