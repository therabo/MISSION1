# Earth clouds and Milky Way presentation

Implemented 2026-10-16 in the existing single Cesium Viewer. See
[ADR-0026](../adr/0026-current-only-optional-cloud-imagery.md). Backend, orbital
products, trajectories, camera/Reset, physical/display positions, the 75 km lift,
NASA VTAD model, picking and native atmosphere remain unchanged. No browser-AA,
MSAA, OIT, framebuffer, DPR, postprocess or LOD optimization is included.

## Cloud rendering

One public `Primitive` / `EllipsoidGeometry` / `MaterialAppearance` overlays the
Globe. Its semi-axes are WGS84 semi-axes plus 15,000 m: **DISPLAY CLOUD SHELL
ALTITUDE**, a visual choice rather than cloud-height data. This remains an
ellipsoid, with back-face culling, depth testing, no depth writes and
`allowPicking: false`. The original Globe owns Earth locations and terrain.

The 8192×4096 JPEG supplies red-channel coverage, with the original alpha curve.
Cloud-only Fabric shading uses native `czm_sunDirectionEC` at scene UTC: light in
daylight, with a subdued cool ambient floor in full shadow. There is no second
astronomy model, cloud rotation,
Globe shader patch, new Earth terminator, weather-height model or volume rendering.
Existing city lights remain beneath the clouds.

The provider imagery runs -180° to +180° west-to-east and north-to-south.
`EllipsoidGeometry` starts its s coordinate at Greenwich; a half-turn UV offset
and native image-upload vertical flip register coverage to Earth. Source polar
fill is mirrored content, not measured polar weather.

## Verified source and reuse

Checked 2026-10-16 Europe/Rome; HTTP evidence starts 2026-10-15 UTC.

| Evidence | Finding |
| --- | --- |
| Publisher | [live-cloud-maps](https://github.com/matteason/live-cloud-maps/tree/530c011db936adc166e89605e1de2a208fe9752c), current main `530c011db936adc166e89605e1de2a208fe9752c` at verification |
| Runtime | [8192×4096 JPEG](https://clouds.matteason.co.uk/images/8192x4096/clouds.jpg), 5,162,494 bytes in the restored 8K production verification |
| Publisher terms | [README](https://github.com/matteason/live-cloud-maps/blob/530c011db936adc166e89605e1de2a208fe9752c/README.md), [CC0 licence](https://github.com/matteason/live-cloud-maps/blob/530c011db936adc166e89605e1de2a208fe9752c/LICENSE.md); value-added images released under CC0, with EUMETSAT attribution required |
| Underlying processing | Publisher `index.js` combines EUMETView `mumi:worldcloudmap_ir108`, `mumi:wideareacoverage_rgb_dust` and `mumi:wideareacoverage_rgb_natural`, thresholds and mirrored polar fill |
| Authoritative metadata | [EUMETView WMS capabilities](https://view.eumetsat.int/geoserver/ows?service=WMS&request=GetCapabilities&version=1.3.0) identify those multimission layers, geographic bounds and EPSG:4326/CRS:84; service fees/access constraints advertise `none` |
| Source-provider policy | [EUMETSAT Data Policy, amended 1 January 2025](https://www-cdn.eumetsat.int/files/2025-02/45173%20-%20Data_Policy%281442019%20V1%29.pdf), Articles 6–7: attribution and rights in value-added images; redistribution of original numerical Recommended Data remains restricted |
| Initial 2K HTTP observations | HTTP 200, CORS `*`, `Cache-Control: public, max-age=7200, must-revalidate`, ETag `"3d99f78d3a90fadec80674f6878b5ed6"`; explicit conditional GET returned 304 |
| Browser smoke | Actual CORS fetch/decode succeeds; ETag is not CORS-exposed, Last-Modified absent; SHA-256 identity works independently |
| Initial 2K SHA-256 | `e0ccbd63589e28a4760874f03e3a49b7cf69469626ea831cc2654b445079dafb`; downloaded sample stays outside Git |
| Selected 8K SHA-256 | `ecb423129abceca6a002f2ca76044a50c68a144d01bb2c493982d919b8f0b380`; original provider pixels, no upscaling |

The initial milestone's final 2K browser smoke at 2026-10-16 08:54:21 UTC fetched
and decoded the
actual public endpoint: HTTP 200, 427,597 bytes, 2048×1024, SHA-256
`33e6676f87b8d79803b28cfaf444d08944219492b4732bed428284aac4c7a235`.
The distinct content proves that the published representation changed between
acquisitions. It establishes neither pixel observation time nor a measured
production 30-minute refresh cycle. Browser-visible validators remain null.

The reuse conclusion is an inference from the publisher's licence for its
value-added image and EUMETSAT's recognition of those rights, with attribution
retained. It does not relicense underlying EUMETSAT/multimission data as CC0.
A public URL alone grants no reuse rights. No raw numerical data or tracker
assets are redistributed. Cesium's credit popup links publisher and policy and
includes **Contains modified EUMETSAT data** and observation-time uncertainty.

Publisher statements about three-hour/eight-per-day updates are not independent
freshness evidence. WMS time metadata does not establish the pixel observation
time of a particular processed JPEG. Gaps, degradation and mirrored poles remain
source limitations. Product wording is **latest available processed global cloud
imagery**, with observation/publication time unknown; no live/onboard-time weather
or guaranteed three-hour freshness is claimed.

## Refresh, failure and Historical

`cloudSource.ts` owns acquisition/decode/identity, `cloudRefresh.ts` owns one serial
schedule, and `cloudRendering.ts` owns Cesium resources.

- Current starts acquisition, then checks **30 minutes after successful completion**.
  This is an application revalidation schedule, not meteorological observation time.
- Browser `fetch(cache: 'no-cache')` owns conditional HTTP/cache behavior. No
  timestamp query strings or forced cross-origin conditional headers are added.
  SHA-256 avoids decode/upload for identical bodies even when validators are hidden.
- Acquisition omits credentials/referrer, expires after 15 seconds, accepts JPEG
  only, caps streamed bodies at 8 MiB and requires exactly 8192×4096 decoded pixels.
  Object URLs are revoked on success, error and cancellation.
- Failure retains the last good coverage; without one, normal Earth remains visible.
  Retry grows 5, 10, 20, 40, then 60 minutes, capped there. Success resumes the
  normal check schedule. Requests never overlap.
- Historical intent hides the shell immediately, including pending orbital handoffs;
  scheduler and acquisition stop. UTC seeks do not reach the cloud source. There
  is no archive query, weather reconstruction, approximate historical cloud fallback
  or Current image displayed against a Historical UTC.
- Returning to Current restores retained coverage immediately. An overdue check
  runs once; otherwise its previous deadline remains. Repeated renders/mode changes
  cannot multiply schedulers or recreate the geometry/Viewer.

Only fully decoded images reach the public Fabric sampler. Pinned Cesium 1.145
`Material` uploads a new texture before destroying its old texture. An initial
alpha gate waits for geometry and sampler preparation; updates never blank an
existing layer. Teardown removes primitive/material/listener, cancels timers,
aborts fetch/decode and releases image references. One active cloud texture plus
one possible staging texture costs 128/256 MiB RGBA8 base storage, with no generated
mipmaps. These are format estimates, not measured physical GPU residency.

Session-local `lastGood` preserves SHA-256, acquisition time, nullable exposed
HTTP validators and `observationTime: null`; `checkedAt` is independent. This is
optional visual-source metadata, not persisted spacecraft telemetry.

## Production 8K restored — 2026-10-16

Production again uses the previously validated **8192×4096 JPEG**, exact decoded
size, **8 MiB** streamed body cap and the existing `MAX_TEXTURE_SIZE` guard.
Hardware below 8192 keeps optional clouds absent, with no unsupported upload or
dynamic 4K fallback. The real production browser fetch returns HTTP 200,
image/jpeg, CORS `*`, 5,162,494 bytes and successful 8192×4096 decode/rendering.
Observation/publication time remains unknown.

Night shader, coverage/alpha, native Sun, 15 km WGS84 shell, UVs, LINEAR filtering,
no mipmaps, anisotropy 1 and the complete refresh/swap/last-good lifecycle are
unchanged. Current day/night rendering, Historical hide/suspend with no weather
request, and retained Current restore pass focused browser checks. The accepted
8K resource estimates return: 128 MiB RGBA8 base per texture, up to 256 MiB during
replacement, plus CPU/encoded memory; not measured physical GPU residency. No
quality comparison, broad performance investigation or new architecture is needed.

Evidence: `/Users/daniel/.codex/exports/mission1-orbital-close-cloud-8k-2026-10-16/`.

## Previous production 4K refinement — 2026-10-16

This records the superseded 4K choice; current production is the 8K product above.

At that checkpoint, production used **4096×2048** as the preferred quality/resource compromise.
The accepted comparison already shows substantially better detail than the
original 2K image. The 8K investigation below remains historical evidence; no
broad comparison, responsive matrix or performance investigation is repeated.
RGBA8 base allocation estimates decrease from 128 to **32 MiB** per texture,
or 256 to **64 MiB** during old/new overlap, plus CPU images and encoded bodies.
These are format estimates, not measured physical GPU residency.

The verified 4K JPEG is 1,496,872 bytes. A **2 MiB** streamed cap provides about
40% headroom for this sample, without retaining the 8K-specific 8 MiB allowance.
Oversize or wrong dimensions retain last-good coverage. The existing capability
guard automatically follows the selected 4096 width. Night RGB/alpha, native Sun,
LINEAR filtering, no mipmaps, anisotropy 1, UVs, 15 km WGS84 shell and all scheduler,
swap, retry and Current/Historical behavior are unchanged. Observation time is
still unknown. No unrelated rendering, orbital or backend subsystem changes.

Focused validation passes 30 cloud tests, all 898 frontend tests / 76 files,
typecheck and production build. An unmocked production-browser acquisition returns
HTTP 200, image/jpeg, 1,496,872 bytes and exact 4096×2048. Current day/night,
Historical hide/suspend and retained Current restore pass with one cloud request,
no Historical weather request, no Viewer/primitive recreation or page error.
Backend source is unchanged; unrelated backend validation is not repeated.

## Initial night visibility and 8K quality refinement — 2026-10-16

The following records the accepted `1414a72` milestone. The production resolution
and size bound were superseded by the 4K refinement, then restored as recorded above.

The initial shader already kept coverage independent from sunlight:
`alpha = 0.82 * pow(smoothstep(0.08, 0.95, coverage), 1.15) * ready`.
The defect was its near-black shadow RGB `(0.018, 0.026, 0.045)`. For sunlight
≤ -0.10, the existing smoothstep selects this colour entirely. The flat native
MaterialAppearance writes diffuse plus emission directly; HDR is off. At maximum
coverage over black, the old RGB contribution is only about 4/5/9 eight-bit counts.
Clouds therefore had too little useful contrast against night land/ocean imagery;
coverage was neither removed nor multiplied by zero solar illumination.

The public Fabric uniforms now set night RGB to `(0.16, 0.18, 0.22)` and retain
exactly the original day tint `(0.76, 0.81, 0.86)`, day factor `0.70 + 0.30*max(μ,0)`
and smooth transition `smoothstep(-0.10, 0.22, μ)`, where μ is the native scene-Sun
normal dot product. This is a restrained visual ambient approximation, not measured
moonlight or cloud emission. Shadow structure remains visible and substantially
darker than daylight. Coverage, readiness alpha, UVs, height, geometry, depth and
city-light imagery are unchanged; covered lights are still softened by the same
texture-derived alpha. There is no new Globe terminator or atmosphere treatment.

The current publisher revision remains `530c011db936adc166e89605e1de2a208fe9752c`.
Its README explicitly links four JPEG resolutions; all four were independently
fetched and decoded at 2026-10-16 10:14 UTC:

| Representation | Encoded bytes | RGBA8 base estimate | Full mip-chain estimate, if used |
| --- | ---: | ---: | ---: |
| 1024×512 | 120,477 | 2 MiB | 2.67 MiB |
| 2048×1024 | 427,597 | 8 MiB | 10.67 MiB |
| 4096×2048 | 1,496,872 | 32 MiB | 42.67 MiB |
| **8192×4096 — selected at 1414a72** | **5,162,494** | **128 MiB** | **170.67 MiB** |

Each actual URL is the README-linked `/images/<dimensions>/clouds.jpg`, not an
inferred filename. Each returned HTTP 200, image/jpeg, CORS `*`, public
max-age=7200/must-revalidate and its own ETag. There is no Last-Modified or reliable
pixel observation/publication time. The near-simultaneous variants have >0.9984
correlation when reduced to 2K and maximum registration correlation at zero shift;
the matched weather pattern supports detail comparisons, not a timestamp claim.

Ungraded native-pixel crops show 4K's improvement over 2K and further meaningful
8K detail in small cells and thin fronts, including normal Overview at desktop
DPR 2 and closer Overview. Mobile and limb/pole views were also inspected. The
128×256 shell geometry is already visually smooth and stays unchanged. Both
poles retain the stretched/radial appearance of source fill. Mirrored polar fill,
provider gaps, IR cold-ground confusion and JPEG/source processing limitations
remain; more pixels do not turn those regions into measured weather.
No sharpening, AI upscaling or fabricated weather detail is used.

The 8K choice deliberately accepts 16× the initial texture's base pixel allocation
and 4× the 4K allocation. One texture is 128 MiB; a replacement can briefly require
256 MiB of GPU-format base storage plus decoded CPU images and encoded bodies.
These are derived allocation estimates, not measured physical GPU residency.
Real 8K bodies from two acquisitions are 5,162,494–5,338,586 bytes; an 8 MiB stream
cap gives about 57% headroom above the larger measured sample while remaining
bounded. It is not a guarantee about every future provider image. Oversize,
unexpected dimensions or decode failures retain the last good image.

The already-created Viewer canvas context is queried through standard WebGL
`MAX_TEXTURE_SIZE`, without changing attributes. Devices unable to accept 8192
pixels keep this optional cloud layer absent and make no cloud HTTP request;
the existing bounded retry owner remains. There is one selected quality strategy,
no user setting, alternate weather source or approximate size acceptance.

Sampling is explicitly **LINEAR minification / LINEAR magnification**, with native
CLAMP_TO_EDGE, DOM flipY=true, browser-default unpack colour conversion, RGBA8
rather than an sRGB internal format, **no mipmaps**, and anisotropy **1**. Native
WebGL upload instrumentation verifies these settings. The local extension supports
16×, but Material's public decoded-image path exposes neither anisotropy nor a
mipmap-generation/ownership hook. Renderer Texture/Sampler and Scene.context are
private engine APIs; merely selecting a mip filter would make this non-mipmapped
texture incomplete. A moderate/maximum anisotropy comparison is skipped because
the safe public-path condition is not met. No engine patch or new texture owner
is justified here. [Material API](https://cesium.com/learn/cesiumjs/ref-doc/Material.html).

Quality screening uses three interleaved fresh-browser windows per resolution,
1440×900 DPR 2, the same corrected lighting, pose, UTC and equivalent provider
content: pooled 2K/4K/8K FPS 15.56/15.81/15.69 and p95 82.5/67.6/67.7 ms. Individual
windows vary; these differences do not establish a performance advantage. The 8K
candidate has no extreme pacing regression in this smoke. Repeated final 8K
replacement records 43 requests, 18 uploads, at most one request, peak two textures,
498 observed frames with no blank frame or primitive growth, and all resources
released. Production still checks at 30 minutes; acceleration exists only outside
Git.

Final unmocked browser acquisition at 2026-10-16 11:03:09 UTC returns HTTP 200,
image/jpeg, 5,162,494 bytes and exact 8192×4096, CORS `*`, SHA-256
`ecb423129abceca6a002f2ca76044a50c68a144d01bb2c493982d919b8f0b380`.
The application hash matches the actual body; browser-visible validators and
observation time remain null. A separate named-verifier conditional request
returns 304; an earlier Python-default-UA probe returned 403 and is retained in
evidence. No guaranteed CDN availability or observation freshness is inferred.

The actual-GLSL GPU probe passes positive/negative Sun-normal inputs, constant
coverage alpha, readiness alpha zero and continuous transition boundaries.
Full shadow is RGB 41/46/56 versus direct-day 194/207/219 in a non-HDR RGBA8
functional probe, with identical maximum alpha 209. Ten final fixed-UTC views
include full shadow, city lights, night limb and both poles. A 56-state matrix
across 1440×900, 1024×768, 768×1024, 390×844 and 320×568 passes Current GP/OEM,
Historical GP/OEM, Inspection/picking, return and Reset, with no page errors,
overflow, Viewer/sky recreation or Historical weather request. Eight additional
responsive terminator/limb states pass. Simulated MAX_TEXTURE_SIZE 4096 skips
cloud HTTP/upload while the ISS scene remains ready. These Chromium/Metal checks
do not certify native Safari or physical phones.

Final actual-production accepted 2K versus final 8K smoke uses six interleaved
fresh Chromium/Metal processes, three 12-second windows per version, at the same
1440×900 DPR 2, UTC, camera and equivalent provider pattern. Pooled FPS is
14.09 → 13.67, mean interval 70.96 → 73.14 ms and p95 84.3 → 85.0 ms. Individual
p95 is 84.1/85.2/83.2 ms versus 84.9/85.2/84.8 ms. The roughly 3% FPS cost is
accepted for the visible detail gain; no performance improvement is claimed.
Absolute baseline pacing on this host is already low. Native browser AA true,
MSAA 4, OIT true, resolutionScale 1, HDR false and one postprocess stage are
identical, with no GL wrapper/readPixels in pacing windows. No deferred
performance optimization is included.

Full frontend validation is 898 tests / 76 files; typecheck and production build
pass. Java 21 `mvn test` and `mvn verify` each pass 1,517 tests with zero failures,
errors or skips. Backend production changes remain zero. All refinement evidence
is outside the repository:

`/Users/daniel/.codex/exports/mission1-cloud-quality-night-refinement-2026-10-16/`

## NASA stellar derivative

The source remains [NASA GSFC SVS Tycho II, item 3572](https://svs.gsfc.nasa.gov/3572/),
a 2009 Tycho/Hipparcos catalogue visualization. NASA documents its faint-star
adjustment for the Milky Way. The [16K TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003572/TychoSkymapII.t5_16384x08192.tif)
is 16384×8192 RGB, 402,653,312 bytes, SHA-256
`2eb9baf5796c62bb04d8c87625b93356cd5ff4172bc56d6b731df554393de04f`.
[NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
supports the existing reuse, with NASA/Goddard Space Flight Center Scientific
Visualization Studio credit and no endorsement. No second panorama is overlaid.

`frontend/scripts/generate-tycho-skybox.py` reproducibly:

1. Softens fine points by a 0.6-source-pixel Gaussian and applies a highlight shoulder.
2. Derives the low-frequency density of the same image at 2048×1024, filtering in
   floats with wrapped RA and pole reflection plus 180° RA shift.
3. Removes a low black floor, raises the remaining band, retains RGB variation
   and screen-composes points/band. This is catalogue-density presentation, not
   additional observed interstellar dust or a synthetic nebula.
4. Projects bilinearly into six 4096² lossless WebP faces, rounding once; verifies
   decoded round trips and all **12 shared cube edges**, including reversals.

The [manifest](../../frontend/src/cesium/skyboxManifest.json) records every output's
bytes, file/decoded-RGBA hashes, processing parameters, generation date and versions.
The source stays outside Git. Reproduce with Python, Pillow 12.3.0, NumPy 2.3.5:

```sh
python frontend/scripts/generate-tycho-skybox.py /outside/repository/Tycho.tif frontend/public/skybox 4096 frontend/src/cesium/skyboxManifest.json
```

Face directions for image coordinates `u,v ∈ [-1,1]` (v increases down) are:

| Face | Direction (x,y,z) |
| --- | --- |
| +X | (1,v,-u) |
| -X | (-1,v,u) |
| +Y | (u,1,-v) |
| -Y | (u,-1,v) |
| +Z | (u,v,1) |
| -Z | (-u,v,-1) |

These compensate Cesium 1.145 `CubeMap`'s DOM `flipY=true`. The previous generator
matched its mathematical edges but omitted this upload convention; the brighter
band exposed hard GPU seams. Only asset registration is corrected. The unchanged
celestial rotation/clock now receives a continuous NASA map. An independent
Khronos cube-selection round-trip regression catches the previous inversion;
`python frontend/scripts/test-skybox-projection.py` also checks black-space
preservation and the twelve shared edges without a source download. Browser QA
looks through all twelve actual cube boundaries, including the Milky Way band.

+X is RA 0°, +Y RA 90°, +Z celestial north. NASA RA increases leftward from
map center. Unchanged `CubeMapPanorama`/`Scene.skyBox` and
`computeTemeToPseudoFixedMatrix(scene UTC)` retain Current/Historical orientation.
This remains a historical visualization, not current precision astrometry.

Resolution and GPU format footprint remain six 4096² RGBA8 base faces / 384 MiB.
Encoded transfer rises from 34,451,680 to 48,045,222 bytes: the smoother band has a
lossless compression cost. Refinement still waits for ISS readiness. Bundled
Cesium stars remain visible during six-face loading and on load/capability failure.
Camera transitions do not reload the sky.

## Initial milestone validation evidence — 2026-10-16

Normal frontend tests mock HTTP; they do not require the public provider. Tests
cover source/decode failures, last-good state, same/new images, cancellation,
100 scheduler cycles, Historical hide/restore and teardown. Browser captures,
source snapshots, TEST ONLY CLOUD_A/CLOUD_B, native texture upload/delete events,
responsive QA and matched frame pacing stay outside Git:

`/Users/daniel/.codex/exports/mission1-clouds-milkyway-2026-10-16/`

The accelerated scheduler exists only in that external QA build's Vite transform.
Production retains 30 minutes. Chromium/Metal viewport QA does not certify physical
iOS/Android devices or native Safari. Earlier graphics dossiers retain their dated
asset records; this document and the runtime manifest describe the current sky.

Full frontend validation passes 892 tests in 76 files, typecheck and production
build. Java 21 `mvn test` and `mvn verify` each pass 1,517 tests with no failures,
errors or skips; backend production changes are zero. The offline projection
regression passes both tests. Build retains the existing large-chunk warning.

The final responsive matrix covers 45 states across 1440×900, 1024×768, 768×1024,
390×844 and 320×568: Current GP/OEM, Historical, UTC seek, Inspection, native
module picking, repeated entry/return, Reset and Current restoration. There are
no page errors or geometry/overflow failures. Fixed-pose before/after captures
include day, night, terminator, limb, Milky Way, desktop/mobile Overview,
Inspection and Historical. All twelve GPU cube boundaries were inspected.
Six additional desktop/mobile Inspection states explicitly check Current GP,
Historical GP and Historical OEM UTCs, with no Historical weather requests.

Controlled TEST ONLY CLOUD_A→CLOUD_B evidence records the replacement upload
before the old texture deletion. The accelerated run completes 41 requests and
23 uploads, with at most one request in flight, one active cloud primitive and
two temporarily allocated textures; all cloud textures release at teardown.
The separate unit soak covers 100 revalidation cycles with one timer. Failure
and capability tests retain a valid bundled sky and a usable ISS scene.

The accepted performance smoke uses the production build at 1440×900, DPR 2,
2880×1800 canvas, a fixed terminator pose/UTC and three interleaved 12-second
windows per version. Each sample has a fresh Chromium/Metal process and verifies
all six 4096² sky faces loaded (plus the ready cloud shell for the new version).
Pooled frame intervals give baseline 20.55 FPS / p95 50.9 ms and enhanced
19.96 FPS / p95 52.0 ms: about 3% FPS cost. Individual p95 values are
50.8/50.7/51.4 ms and 50.9/50.9/66.6 ms respectively; the last enhanced window
has more jitter. This is a local smoke, not a general device performance claim.
Earlier mixed-load and disk-exhausted samples are excluded. No deferred
performance setting was changed.
