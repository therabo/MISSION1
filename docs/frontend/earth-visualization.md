# Earth illumination and night-lights imagery

The existing Cesium Viewer, globe, `Sun`, skybox, atmosphere and 1× scene clock render both Earth Overview and ISS Inspection. `Globe.enableLighting` shades the Natural Earth II daytime imagery with the scene's `SunLight`. `dynamicAtmosphereLighting` and `dynamicAtmosphereLightingFromSun` retain the atmospheric limb. The default Cesium lighting fade would turn shading off near the ISS; MISSION1 sets the fade interval to 6,370–6,600 km from Earth's center, so the station camera at roughly 400 km altitude still sees the time-correct terminator. These distances are **rendering configuration**, not orbital geometry. No second globe or Sun is created.

## Night imagery provenance

| Item | Value |
| --- | --- |
| Product | NASA Earth at Night / Black Marble, **2016 Color**, global 0.1° map |
| Provider | NASA Earth Observatory; VIIRS night-light composite |
| Official product page | <https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/> |
| Exact JPEG source | <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg> |
| Acquisition/product period | Observations from **2016**, processed as a cloud-free monthly composite; published in the 2017 Earth-at-Night collection |
| Original/repository format | JPEG / JPEG; no pixel transformation or resampling |
| Geographic grid | EPSG:4326, global longitude −180° to +180°, latitude +90° to −90°, 0.1° per pixel |
| Resolution | 3,600 × 1,800 pixels |
| Checked-in asset | `frontend/public/imagery/black-marble-2016-color.jpg` |
| Asset size | **779,638 bytes** (0.744 MiB); one 3,600 × 1,800 RGB image is about 19.4 MB before GPU mipmaps |
| SHA-256 | `d87de751a264e4f8ff69c68de5dab9606daee87a6f15ae743c93200743bd7ec1` |

The [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) say NASA material generally is not subject to US copyright and may be used for educational/informational work when NASA is acknowledged; they prohibit implying endorsement and warn that individually marked third-party material can have separate rights. The project credits NASA in the Cesium layer, UI and this record. The JPEG on the official product page has no indicated third-party copyright. NASA imagery is not a real-time telemetry source.

The matching [NASA GeoTIFF](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg_geo.tif) was inspected to verify geographic alignment: width 3,600, height 1,800, tie point `(-180, +90)`, scale `(0.1°, 0.1°)`, and geodetic key `EPSG:4326 / WGS84`. `SingleTileImageryProvider` consumes the unchanged JPEG as a global geographic image. Pixel lookup `x = (longitude + 180) × 10`, `y = (90 − latitude) × 10` places Western Europe, the US East Coast, Nile Delta and Japan in their expected clusters; empty central Pacific and sparse Sahara areas are useful negative checks. Browser inspection confirmed East Asian lights align with Japan and eastern China, with no mirror, inversion or dateline correction. The map is coarse at station inspection distance and the 2016 composite may not reflect later changes in lighting or station hardware.

## Scene-time blending

The base Natural Earth II imagery stays on the globe. A second **imagery layer on that same globe**, loaded above the base layer, supplies the Black Marble night map. With `Globe.enableLighting = true`, Cesium's documented `ImageryLayer.dayAlpha = 0` and `nightAlpha = 1` use the scene solar direction. Cesium interpolates their alpha across the terminator; full daylight suppresses the night map, twilight gradually blends it in/out, and full night shows the dark map with city/population lights. Layer brightness is 1.8 for legibility at globe scale. The source image remains unchanged. Globe lighting also shades the final mixed surface, so lights are a visualized raster rather than physically emitted 3D light sources.

The **same Cesium clock** advances the Sun, globe illumination, and existing sampled ISS position. No static longitude mask, second timebase, client orbital propagation, replay control, second Earth sphere or custom shader is used. When the viewport sees a daytime pass, Natural Earth dominates; when it sees a night pass, the Black Marble layer is visible. Atmosphere and skybox stay enabled. The Sun is never moved to compose a shot.

The layer is **historical Earth-at-night imagery**, not live city-power, population, weather, or measured ISS telemetry. The 2016 cloud-free composite combines observations over time; a bright pixel does not assert current power consumption or a continuously illuminated facility. Black Marble includes natural and non-city light sources where present in the product. The source has no live update cadence. The single 0.1° JPEG minimizes network/build cost but limits detail during low-altitude inspection. If the asset fails to load, the day imagery and orbital view remain available and a scene issue is reported.
