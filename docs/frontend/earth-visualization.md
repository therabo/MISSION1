# Earth illumination and imagery

## High-fidelity historical imagery and sky — 2026-10-04

NASA GIBS BlueMarble_NextGeneration (August 2004) and VIIRS_Black_Marble (2016-01-01) retain the verified Web Mercator GoogleMapsCompatible_Level8 matrix, 256² tiles and maximum useful level 8. Local Natural Earth II and the unchanged 3600×1800 Black Marble JPEG now load immediately beneath network refinement. Day and night probes are independent; one tile failure no longer discards the complete provider. Two retries per failed tile are tracked independently of Cesium's shared error counter, with bounded outage bookkeeping. No extra provider polling/cache or invented finer level is added.

Historical city imagery remains night-only and follows the existing scene-time solar blend. Brightness is now **1.15**, with gamma/contrast 1, reducing bright-core bleaching. The star field uses verified NASA SVS Tycho II 2009 TIFF at 16384×8192, resampled once into six seam-checked lossless 4096² WebP cube faces. This is a historical catalogue visualization in Cesium TEME axes; it is not a current astrometric/attitude product. Full-screen projection, Sun, atmosphere, HDR=false and background colours stay unchanged. [Sources, exact assets, regional comparisons, performance and limitations](high-fidelity-rendering-performance/README.md).


## Full-screen occlusion-aware framing — 2026-10-04

The Cesium container/canvas fill the complete app shell, beneath the DOM dashboard.
App measures `aside.status-panel` in LIVE/Inspection or `aside.replay-orbit` in
REPLAY. CSS retains sole ownership of its side versus bottom/hidden role.
Only the actual rectangle intersecting the viewport is subtracted, including
neither margins nor a full-height left strip. The remaining area's two-dimensional
centroid defines the projected principal/focal point. Changing dashboard height,
width or position recomposes automatically through observers/layout events.
Desktop Crew/detail remain separate overlays; the existing 768px live drawer
hides the dashboard and restores normal centering. Bottom/mobile layouts retain
full-viewport composition, with no stale left offset.

Public `PerspectiveFrustum.xOffset/yOffset` shift screen composition with the
full-size canonical lens, preserving physical camera pose, FOV and pixel scale.
The Cesium 1.145 compatibility adapter aligns native rays/GPU feature picking and
pixel-size calculations with this off-center lens. A neutral public Fabric
material corrects the far ground-atmosphere projection ray in this pinned
version; imagery colour, lighting parameters and native scattering are retained.
Geometry is cached; a bounded
650ms C2 interpolation changes only projection, immediately settling for reduced
motion and viewport resizing. There are no per-frame DOM measurements or React
layout updates. Scientific/orbital and imagery semantics remain unchanged.
[Derivation, implementation, picking and measured evidence](occlusion-aware-workspace-centering/README.md).

The same Cesium Viewer, globe, native Sun, atmosphere, skybox and 1× scene clock render Earth Overview and ISS Inspection. `Globe.enableLighting` shades historical imagery using the scene's Sun direction. `dynamicAtmosphereLighting` and `dynamicAtmosphereLightingFromSun` retain the atmospheric limb. The default Cesium fade would turn shading off near the ISS; MISSION1 sets the fade interval to 6,370–6,600 km from Earth's center so the station camera at roughly 400 km altitude still sees the moving terminator. These values are rendering configuration, not orbital geometry. No second globe or Sun exists.

## Production imagery

The selected strategy is **`NASA_GIBS_TILED`**. NASA's [WMTS access documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) and the verified [EPSG:3857 capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml) identify the two exact layers below. Both use `GoogleMapsCompatible_Level8` and stop at tile level 8. Tiled delivery chooses resolution by zoom and avoids a single enormous GPU image. A real level-2 tile probe returned HTTP 200 and `Access-Control-Allow-Origin: *` during integration. The client probes image payloads before exposing each network layer, and visible layer errors fall back to local imagery.

| Purpose | NASA GIBS layer | Time, format and semantics | Local fallback |
| --- | --- | --- | --- |
| Day geography | `BlueMarble_NextGeneration` | Static JPEG, historical [Blue Marble: Next Generation](https://svs.gsfc.nasa.gov/3539) August 2004 visual mosaic; not live clouds or terrain | Cesium bundled Natural Earth II tiled texture |
| Night geography | `VIIRS_Black_Marble` | PNG at fixed `2016-01-01`; historical NASA [Black Marble / Earth at Night](https://earthobservatory.nasa.gov/features/NightLights) visual composite; not live electricity | Local 2016 Color Black Marble 0.1° JPEG |

The level-8 Web Mercator grid has 65,536 pixels around the equator, nominally about 600 m per tile pixel there, with latitude-dependent ground spacing. That is materially finer than the previous 3,600 × 1,800 night image's 0.1° (about 11 km at the equator). Source detail, reprojection and cloud-free compositing limit what those pixel figures imply. At orbital scale the new tiles reveal regional light clusters and coastline detail that the former single image blurred together. Both layers credit NASA in Cesium. The original local day and night assets remain included in development and production builds for loss of network access; no Cesium ion token is required.

An integration check fetched level-8 Black Marble PNGs around Western Europe, eastern North America, the Nile Delta, Japan/Korea and the Indian subcontinent. All five returned HTTP 200 and decoded as 256 × 256 tiles with nontrivial color variation; this verifies the intended regional high-resolution source coverage. Browser rotation showed no visible tile or Pacific dateline seam and showed the night-only blend at the terminator. A camera-by-camera close-range visual comparison for all five named regions was not performed, so their fine-detail appearance remains a manual QA limit.

The older local night fallback is [`black-marble-2016-color.jpg`](../../frontend/public/imagery/black-marble-2016-color.jpg), 3,600 × 1,800 pixels, **779,638 bytes**, SHA-256 `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1`. It is the unchanged [NASA Earth-at-Night JPEG](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg). The matching [NASA GeoTIFF](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg_geo.tif) established EPSG:4326 geographic bounds −180° to +180° longitude and +90° to −90° latitude. The fallback is the source's JPEG without pixel resampling. [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) is followed with attribution and no endorsement claim.

In the final served-production outage regression, a temporary test-only query flag forced both GIBS availability checks to fail without changing the production URLs. The Overview globe retained usable Natural Earth II day imagery; rotating into darkness showed the local Black Marble city-light image with a continuous terminator. Approach, Inspection and direct module picking remained usable. After removing the flag, both real GIBS probes succeeded and the tiled imagery loaded again. No blank, permanently black or repeatedly flashing globe was observed. The override was removed from the final source and build.

## Scene-time blend and limits

The GIBS night imagery is an `ImageryLayer` above the day layer with `dayAlpha = 0`, `nightAlpha = 1` and brightness 1.15. When GIBS is unavailable, the local night fallback uses the same alpha policy. With `Globe.enableLighting`, Cesium interpolates layer alpha around the moving terminator: the night composite is absent in full daylight, blends through twilight and appears on the night side. These are image pixels lit by a rendering model, not physically emitted 3D city lights. Cesium's default maximum-safe anisotropy is used on the imagery layers; nearest-neighbor sampling is not selected.

The same scene clock advances the Sun and the sampled ISS position. No static longitude mask, second timebase, client orbital propagation, replay control, custom Sun position or invented station lights are used. The Black Marble image is a historical composite. A bright pixel does not assert present-day power, population or a continuously illuminated facility. Source imagery is separate from computed orbital state and from measured onboard telemetry. The [rendering-quality record](rendering-quality.md) explains the network/local tradeoff, skybox, Sun and GPU settings.


## Replay integration — 2026-10-03

Historical position/velocity uses the separate [Mission Replay contract](../api/replay-api.md) at the exact requested UTC epoch. Current delivery remains current; Replay hides current paths and pauses the scene. The accepted model, shader, visual-frame and camera/Inspection machinery is retained. [Validation](../replay/validation/README.md).
