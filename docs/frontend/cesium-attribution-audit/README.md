# MISSION1 header and Cesium attribution audit

Verified on **2026-10-04 (Europe/Rome)** against clean synchronized baseline
`7fa39af0733b83a04336ab2b151edb2105edd004`. Only the adjacent header label and
unnecessary ion branding change. Previous branding evidence remains intact.

## Verdict and applicable terms

**`ION_ATTRIBUTION_NOT_REQUIRED`** for the current MISSION1 configuration.
Source configuration and development/production network observations establish
that MISSION1 uses the CesiumJS client without ion licensed services or content.
No imagery/terrain migration was needed.

Installed `cesium/package.json` and the lockfile resolve **CesiumJS 1.145.0**.
Its [Apache 2.0 license and bundled third-party notices](https://github.com/CesiumGS/cesium/blob/1.145/LICENSE.md)
are distinct from the [ion Terms of Service](https://cesium.com/legal/terms-of-service/)
(major update August 20, 2025; minor update August 27, 2025). Section 2.2.3 requires
the ion logo when using the Licensed Services. The
[official attribution guide](https://cesium.com/learn/ion/content-usage-and-attribution-guide/)
requires ion branding for software/content created with ion and provider credits
for Asset Depot content. Apache 2.0 does not require a graphical runtime logo;
its license, copyright and notice obligations still apply. This cleanup does not
remove or alter dependency license/notice files.

The verdict is an inference from those terms, the actual providers below and
the observed requests, rather than from the logo's appearance. Cesium maintainers
also distinguish [Apache-licensed CesiumJS and local Natural Earth imagery from
ion services](https://community.cesium.com/t/cesium-ion-licensing/8633).
Re-audit attribution before enabling ion, geocoding or another content provider.

## Source configuration and content inventory

Reviewed the complete Viewer/provider initialization in
[`EarthView.tsx`](../../../frontend/src/cesium/EarthView.tsx),
[`earthImagery.ts`](../../../frontend/src/cesium/earthImagery.ts),
[`earthLighting.ts`](../../../frontend/src/cesium/earthLighting.ts),
[`modelPresentation.ts`](../../../frontend/src/cesium/modelPresentation.ts),
the model manifest, entry point, Vite static-copy configuration, package/lockfile,
and installed public `CreditDisplay` implementation/types/license.

Source/configuration searches covered `Ion.defaultAccessToken`, token variables,
`IonResource`, `IonImageryProvider`, ion terrain/asset IDs, World Terrain, OSM
buildings, Cesium endpoint URLs, Bing, Google/Photorealistic 3D Tiles, geocoder
and Asset Depot. No such provider or application token is configured. The stock
default token shipped inside Cesium exists, but these providers never use it.
`baseLayer: false` prevents default ion imagery; `baseLayerPicker: false` and
`geocoder: false` disable those default service entry points.

| Content/service | Actual provider and source | Through ion? | Attribution assessment |
| --- | --- | --- | --- |
| Day Earth imagery | `WebMapTileServiceImageryProvider`, direct NASA GIBS `BlueMarble_NextGeneration`, August 2004 historical mosaic; `GoogleMapsCompatible_Level8`, JPEG, maximum level 8 | No | NASA source acknowledgment requested; retained |
| Night Earth imagery | Same provider, direct GIBS `VIIRS_Black_Marble`, fixed `2016-01-01`, historical composite; same grid/level, PNG | No | NASA/GIBS acknowledgment requested; retained |
| Day fallback | `TileMapServiceImageryProvider`, bundled `/cesiumStatic/Assets/Textures/NaturalEarthII` | No | [Natural Earth public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/) explicitly do not require credit |
| Night fallback | `SingleTileImageryProvider`, local `/imagery/black-marble-2016-color.jpg` | No | NASA acknowledgment retained by existing conditional fallback credit |
| Terrain | `new EllipsoidTerrainProvider()`, WGS84 ellipsoid with no streamed terrain dataset | No | No dataset/provider attribution |
| ISS model | Locally served `/models/iss-vtad-source-png.glb`, acquired directly from [NASA VTAD](https://science.nasa.gov/resource/international-space-station-3d-model/) | No | NASA acknowledgment retained on-screen |
| Star map | Six local `/skybox/tycho-*.png` faces, [NASA GSFC SVS Tycho II](https://svs.gsfc.nasa.gov/3572/) | No | NASA acknowledgment retained in the popup |
| Native celestial/startup resources | Local Cesium `moonSmall.jpg`, initial Tycho JPEG faces, IAU time tables and `approximateTerrainHeights.json`; Sun uses native rendering | No | Existing bundled licenses/notices remain untouched; no separate visible runtime credit observed |
| 3D Tiles / OSM buildings / Asset Depot | None; the local ISS GLB is a model, not a 3D Tiles or ion asset | No | No applicable provider credit |
| Geocoder / other ion data services | Disabled / none | No | No applicable service branding |
| Bing / Google / OpenStreetMap maps | None | No | No applicable map-provider credit |

`GoogleMapsCompatible_Level8` names the GIBS tile matrix, not Google map content.
The direct endpoint is `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`.
Both imagery products remain historical visualization assets, not live ISS
telemetry or current city-light measurements. The configured fallback providers
and their credits were inspected without forcing a provider migration or outage.

The installed bundled license records James Hastings-Trew's copyright and its
Planetary Pixel Emporium reference for planetary textures. That external terms
page was unavailable during this audit. No bundled texture, notice or credit was
removed; this does not affect whether ion services/content are used. This audit
does not claim that every bundled third-party resource is public domain.

## Every observed bottom credit

The inventory was measured before editing, in LIVE Overview, Inspection and
paused REPLAY, on development and production. The popup was opened in Overview
and Inspection to inspect its actual list. The same NASA items remain after.
There was one combined **Cesium ion** image, not separate Cesium and ion logos.
No Bing, Google, OSM, terrain copyright or other map-provider item was displayed.

For this table, **OPTIONAL** means the exact graphical credit/string is not
mandated by a copyright license or ion agreement for this configuration. NASA
requests source acknowledgment; those acknowledgments are deliberately retained,
not treated as disposable branding. No observed item is classified REQUIRED by
the applicable graphical-attribution terms.

| Previously visible item | Location / source | Classification and reason | Final behavior |
| --- | --- | --- | --- |
| Cesium ion logo, title `Cesium ion`, link `https://cesium.com/` | Main line; local `Assets/Images/ion-credit.png`, 138×28 CSS px; Cesium's default `CreditDisplay` logo credit | **OPTIONAL**: no ion licensed service/content dependency; Apache client licensing does not require this logo | Removed |
| `ISS 3D model: NASA VTAD` | Main line; explicit model credit, `showCreditsOnScreen: true` | **OPTIONAL** exact UI placement/string; NASA's media guidance requests source acknowledgment and the model record names NASA VTAD | Retained visibly |
| `Data attribution` | Main line; Cesium-generated popup access link | **OPTIONAL** UI affordance, not itself a copyright/ion provider notice; still provides access to source acknowledgments | Retained and functional |
| `Star map: NASA GSFC SVS Tycho II` | Popup; explicit static credit linked to NASA SVS 3572 | **OPTIONAL** exact runtime string; NASA source acknowledgment requested | Retained |
| `Earth day imagery: NASA Blue Marble: Next Generation (August 2004)` | Popup; GIBS day provider credit | **OPTIONAL** exact runtime string; NASA/GIBS acknowledgment requested | Retained |
| `Earth night imagery: NASA Black Marble 2016 historical composite` | Popup; GIBS night provider credit | **OPTIONAL** exact runtime string; NASA/GIBS acknowledgment requested | Retained |

[NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
permits informational use of NASA material generally without US copyright and
asks that NASA be acknowledged; third-party copyrighted material is a separate
case. [GIBS guidance](https://nasa-gibs.github.io/gibs-api-docs/)
also requests acknowledgment. MISSION1 acknowledges NASA GIBS, part of NASA
ESDIS, for the supplied visualization imagery. No mandatory credit was hidden.
Retaining these source acknowledgments is consistent with project provenance
requirements, even though they do not make the ion logo necessary.

Conditional, not observed as an active main credit in these captures:
`Earth night-lights fallback: NASA Black Marble, 2016`, from the existing local
night fallback. It remains unchanged. Natural Earth fallback has no visible
provider credit and does not require one under its public-domain terms.

## Runtime network evidence

Headless Chromium with native Metal/WebGL rendering, DPR 1, real backend on
8080, development on **5175** and built production preview on **4175**.
Before captures used the accepted baseline build; after captures used the
changed source and rebuilt production artifact. No network interception, fake
orbital state, clock injection or service substitution was used.

All four request logs are preserved with state/credit measurements:
[before development](evidence/before-development.json),
[before production](evidence/before-production.json),
[after development](evidence/after-development.json),
[after production](evidence/after-production.json).
Token/key query fields are redacted by the harness. No application token exists.

| Run | 1440×900 request hosts (counts) | 390×844 request hosts (counts) | Cesium/ion service requests |
| --- | --- | --- | --- |
| Before development | Local 160; NASA GIBS 343 | Local 127; NASA GIBS 26 | 0 |
| Before production | Local 96; NASA GIBS 349 | Local 63; NASA GIBS 26 | 0 |
| After development | Local 173; NASA GIBS 399 | Local 126; NASA GIBS 26 | 0 |
| After production | Local 81; NASA GIBS 313 | Local 62; NASA GIBS 26 | 0 |

Desktop recordings include Overview, credits popup, Inspection and historical
REPLAY; mobile recordings include Overview. All five after viewports were
recorded in both builds. Every recorded request host is either loopback or
`gibs.earthdata.nasa.gov`. No requests go to `api.cesium.com`, `assets.cesium.com`,
`ion.cesium.com`, any other `*.cesium.com` or `*.cesiumassets.com` host.
The ion image before was loaded from the local static directory: displaying it
did not itself imply ion service use. Afterward that image is not requested.
NASA tiles, local fallbacks, model, skybox and Cesium workers/time data remain.
The audit covers the exercised current configuration; future provider changes
need a fresh audit rather than treating this verdict as universal.

## Implementation

In [`App.tsx`](../../../frontend/src/App.tsx), `.top-brand` previously contained
the approved image followed by an `em aria-hidden="true"` whose text came from
`viewMode` via `approaching`, `returning` and `inspecting`: `/ EARTH VIEW`,
`/ ISS INSPECTION`, `/ APPROACHING ISS` or `/ RETURNING TO EARTH`.
Only that presentation node is deleted. These variables, state transitions and
their other uses remain. The final brand contains just the same image.

In [`main.tsx`](../../../frontend/src/main.tsx), before React creates the Viewer:

```ts
import { Credit, CreditDisplay } from 'cesium';

CreditDisplay.cesiumCredit = new Credit('');
```

[`CreditDisplay.cesiumCredit`](https://cesium.com/learn/cesiumjs/ref-doc/CreditDisplay.html)
is a documented public static setter. Its installed 1.145.0 implementation and
types were checked. The empty credit removes only the default logo, leaving
the supported provider/static credit collection and popup intact. There is no
CSS hiding, overlay, clipping, private field, runtime DOM deletion or credit
container removal. The remaining main credit area measures about 200.48×12px
instead of 338.48×12px; logo width is zero, with no reserved logo gap.

## Visual and functional validation

Before/after screenshots were captured before editing and after rebuilding,
then visually inspected. Scene time/orbital motion/imagery loading differ
between captures; no pixel equality of the physical scene is claimed.

| State | Development before → after | Production before → after |
| --- | --- | --- |
| 1440×900 Overview | [Before](before/development/1440x900-overview.png) → [After](after/development/1440x900-overview.png) | [Before](before/production/1440x900-overview.png) → [After](after/production/1440x900-overview.png) |
| 1440×900 Inspection | [Before](before/development/1440x900-inspection.png) → [After](after/development/1440x900-inspection.png) | [Before](before/production/1440x900-inspection.png) → [After](after/production/1440x900-inspection.png) |
| 390×844 Overview | [Before](before/development/390x844-overview.png) → [After](after/development/390x844-overview.png) | [Before](before/production/390x844-overview.png) → [After](after/production/390x844-overview.png) |
| Attribution popup, 1440×900 | Actual lists recorded in JSON | [Before](before/production/1440x900-credits-open.png) → [After](after/production/1440x900-credits-open.png) |

The original mobile stylesheet already hid the adjacent label; the node is now
absent at every viewport. No image alignment correction or CSS edit was needed.
All five viewports were checked in both builds, with no horizontal overflow,
wordmark overlap/cropping, retained label gap or bottom credit layout artifact.
Measured image rectangles match the accepted ownership milestone exactly:

| Viewport | Unchanged image rectangle, CSS px | Production after screenshot |
| --- | --- | --- |
| 1440×900 | x26/y8, 180×60 | [Overview](after/production/1440x900-overview.png) |
| 1280×720 | x26/y8, 180×60 | [Overview](after/production/1280x720-overview.png) |
| 900×700 | x26/y8, 144×48 | [Overview](after/production/900x700-overview.png) |
| 768×1024 | x26/y8, 144×48 | [Overview](after/production/768x1024-overview.png) |
| 390×844 | x12/y7, 132.59375×44.1875 | [Overview](after/production/390x844-overview.png) |

The image remains transparent RGBA, 2172×724, 3:1, SHA-256
`6a1bd669b7e47918725699caba05c9ac90c39f4ea4ccd290056decc3326a4fcb`.
The frontend copy, root copy and production-emitted PNG have identical bytes;
alt `MISSION1`, responsive fit and pointer-through behavior are unchanged.

[Development](evidence/functional-development.json) and
[production](evidence/functional-production.json) regression records cover 12
states each at desktop/mobile: LIVE, Crew/detail, paused historical REPLAY,
historical Crew/detail, GP and OEM approach/Inspection/return. One retained
Viewer, unchanged Earth camera across Replay, restored LIVE animation and one
wordmark request per page are verified; page/console errors are zero.
One production desktop Replay request was aborted during seek replacement
(`net::ERR_ABORTED`), consistent with the existing cancellable request path;
the historical response and all checks completed successfully.

[Camera/input smoke](evidence/input-smoke.json) passes in all four build/size
combinations: Earth drag, wheel zoom through the logo, Inspection orbit and zoom,
Crew detail in Inspection, focus restoration and Back. Inspection checks use
camera position in its local frame to avoid confusing orbital motion with user
input. An initial concurrent input run timed out waiting for readiness; its
standalone rerun passed. No product change was made for that timeout.
**Native two-finger pinch remains unverified.**

Shared visual-runtime capture reports four GPU `ReadPixels` warnings and zero
failed requests. Lint at 1440/390 has 19/18 findings: existing small text, the
intentionally scrolling status panel and GPU warnings; no branding findings.
The existing large Cesium bundle warning remains. No broader UI correction was
started for those retained findings.

Final gates: **382 backend tests**, zero failures/errors/skips in both `mvn test`
and `mvn verify` (Java 21); **284 frontend tests / 34 files**, typecheck and
production build pass (Node 24.21.0). The existing wordmark test gains only a
no-adjacent-text assertion. `git diff --check` passes.

[Verification summary](evidence/verification.json) records measurements,
request totals, screenshot hashes, regression results, tests and the freeze
comparison. Of 5,174 baseline tracked files, 5,169 are byte-identical. The five
existing edits are App presentation, app bootstrap credit configuration, the
existing test and the two requested READMEs. All 210 backend files, 51 Cesium
scene/source files, CSS, assets, root README/logo and all 58 previous branding
evidence files are unchanged. New files are confined to this audit dossier.
No architectural change or new ADR; external project context remains outside Git.

## Context reviewed

Actual project AGENTS.md; searched for additional repository/frontend/Codex
instructions (none found); external `mission1-project.md`; actual
frontend-design-codex, iss-3d-earth-view, software-architect,
devops-local-platform and iss-public-data-sources skills and their applicable
reference contracts. Root/frontend READMEs and branding dossier; Earth
visualization, Inspection, model, rendering-quality, architecture baseline,
repository and Earth View delivery documents/related ADR context. App, styles,
AppReplay test, main entry point, source/provider files, manifest,
package/lockfile, Vite/TypeScript configuration and installed Cesium credit API.

No other dashboard restyling was started.
