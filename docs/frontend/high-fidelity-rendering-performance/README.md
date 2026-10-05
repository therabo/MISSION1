# High-fidelity mission rendering and measured performance

## Subsequent two-setting quality restoration — 2026-10-05

This is the preserved report for accepted commit `b190e8b7df435251d6db46bf6d6357d3fdf7e868`. A subsequent user-requested correction restores browser WebGL antialiasing **false→true** and Black Marble brightness **1.15→1.8** (gamma/contrast remain 1). All source-quality, star assets, loading, retry/fallback and other rendering/camera behavior from this milestone remain. [Current correction and matched evidence](../rendering-quality-restoration/README.md). Original measurements and evidence below are historical and are not rewritten as results for the restored settings.

The accepted `main` baseline was `6fbb52d7999cc189b9240a7cad5e6136c36f8164`, equal to `origin/main` and direct GitHub `refs/heads/main`, with a clean tree before implementation. The target checkout is `/Users/daniel/Desktop/MISSION1`. [Context actually reviewed](context-reviewed.md) distinguishes the separate instruction/skill directory from this repository.

The final change preserves the original NASA ISS geometry, full PNG/PBR textures, 14 semantic feature identities, scientific delivery, camera and trajectory rendering. It improves historical night-image resilience and restrained contrast, replaces JPEG-derived 2048² stars with TIFF-derived lossless 4096² faces, and removes redundant browser multisampling while retaining Cesium MSAA 4, Inspection FXAA, atmosphere, Sun, native device resolution and trajectories. High-resolution stars refine the visible bundled skybox after the ISS and its first-use shaders are ready.

**The 60 FPS target is not achieved on this reference Mac.** The measured result and hardware limitation are reported in [the generated numerical report](metrics.md), with every raw interval retained. This milestone uses the user's explicit hardware-blocked outcome; it does not claim a performance PASS, reduce source fidelity to manufacture one, or promise universal 60 FPS. Maximum quality is fixed, with no adaptive resolution/texture degradation.

## Reference environment and method

| Item | Reference |
| --- | --- |
| Computer | MacBook Air `MacBookAir10,1`, Apple M1, 8 CPU cores (4 performance / 4 efficiency), 7 GPU cores, 8 GB unified RAM |
| OS / display | macOS 26.6.2 (25G83), built-in 2560×1600 Retina panel |
| Browser | Playwright Chromium 151.0.7922.34, headed, ANGLE Metal Apple M1 |
| Primary viewport | 1440×900 CSS pixels; DPR 1 comparison, 1800×1125 drawing buffer; native DPR 2 separately, 2880×1800 |
| Browser cadence | Blank foreground RAF median 16.7 ms, about 59.88 Hz; environment can expose 60 Hz |
| Runtime | Cesium 1.145.0, React 19.3, TypeScript 7.0.2, Vite 8.3.1; Node 24; Java 21 Corretto |
| Local services | Persistent existing PostgreSQL, Spring API 8080, development 5175, production preview 4175; untouched baseline preview 4185 |

Primary measurements warm up at least 10 seconds and collect at least 30 seconds, with one foreground headed browser and no simultaneous builds, tests, image compression or other QA browser. FPS uses `scene.postRender` intervals and no DevTools recording. Real GP/OEM API responses are captured in [real-samples.json](evidence/real-samples.json) and [real-comparison.json](evidence/real-comparison.json); these are real products, not synthetic spacecraft samples. Matched comparisons freeze that real scene epoch and use the same saved world camera basis. An additional current-API LIVE run advances the actual scene clock. Replay queries genuine persisted history at `2026-10-02T23:00:00Z`.

The numerical report recomputes median/P95/P99, true 1% low (reciprocal mean of the slowest ceil(1%) intervals), counts over 20/33.3/50 ms and sustained low cadence from the raw arrays. Older baseline JSON's `onePercentLowFps` was a P99 reciprocal; it is explicitly recalculated for consistent tables. A rolling one-second cadence check, rather than a single good frame resetting a streak, evaluates the sustained-under-55 condition. Frozen and actual LIVE results are labelled separately. Secondary 1280×720 Overview/Inspection, 900×700 Overview and 390×844 reference measurements are included without claiming a physical phone benchmark.

Loading measurements use cold cache, warm cache and repeat navigation on normal networking. The first observed Earth post-render is an event proxy, not pixel proof that the finest NASA tiles are already visible. `modelResourcesReady` means public Model.ready with non-streaming native textures/features; `inspectionReady` includes the existing eight rendering preparation frames and celestial preparation. `starDecodedAt` is the first post-render after all faces decode and the new SkyBox is installed; it is not a per-image CPU decoder stopwatch. Tile queue idle and fully refined scene time are separate. Request sizes come from Playwright response/request instrumentation, since cross-origin Resource Timing may conceal NASA byte sizes.

## Verified sources and native limits

| Asset/product | Authoritative source | Meaning and native limit |
| --- | --- | --- |
| ISS VTAD | [NASA model resource](https://science.nasa.gov/resource/international-space-station-3d-model/), [original GLB](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/ISS_stationary.glb) | Static NASA visualization, not current attitude or proof of 2026 configuration; 132 nodes, 131 meshes, 343 primitives, 27 materials; 19 unique full-size PNGs |
| Earth day | [GIBS EPSG:3857 capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities), [GIBS visualization documentation](https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/) | `BlueMarble_NextGeneration`, historical August 2004, JPEG, `GoogleMapsCompatible_Level8`, 256² tiles, levels 0–8 |
| Earth night | Same verified capabilities; [NASA Black Marble](https://science.nasa.gov/earth/earth-at-night/) | `VIIRS_Black_Marble`, fixed `2016-01-01` historical annual/composite product, PNG, same level-8 grid; never live electricity or current onboard telemetry |
| Night fallback | [NASA 2016 0.1° JPEG](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg), matching [GeoTIFF](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg_geo.tif) | Unchanged native 3600×1800 geographic image, about 11 km/equatorial pixel, no runtime resampling of the stored file |
| Stars | [NASA SVS Tycho II, 3572](https://svs.gsfc.nasa.gov/3572/), [native 16K TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003572/TychoSkymapII.t5_16384x08192.tif) | January 2009 celestial catalogue visualization; 16384×8192 RGB uint8, RA/Dec plate carrée mapped into Cesium TEME-axis cube directions; not current precision astrometry |

The authoritative capabilities excerpt is [gibs-capabilities-excerpt.json](evidence/gibs-capabilities-excerpt.json), parsed from the actual WMTS/OWS identifiers. At level 8 the Web Mercator grid has 256×256 tiles and 65,536 pixels around the equator, about 611.50 m per tile pixel there; ground spacing changes with latitude. Source sampling/compositing limits physical detail. Maximum supported useful level remains 8; a zoom beyond that magnifies verified source pixels and does not reveal extra information. The EPSG:4326 “500m” grid was checked: its 2,3,5,10,…160 column counts are incompatible with Cesium's ordinary power-of-two GeographicTilingScheme. An unverified geographic adapter or nonexistent higher level was not introduced.

Day URL template: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.jpeg`.

Night URL template: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.png`.

Every product remains attributed in Cesium. [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) is followed with source credit and no endorsement claim; this is not a blanket claim that every NASA-hosted third-party image has unrestricted rights. Runtime source derivatives and provenance are pinned. Downloaded original TIFF/GLB and rejected duplicate PNG faces stay outside Git; no AI/generated/upscaled physical detail is used.

## ISS audit and practical fidelity

A fresh original NASA GLB download is 44,495,916 bytes, SHA-256 `26dba905b4b7555edbcb0c5f5a61b5c18659f5166076ab27dbb0e64025759fca`. Its 26 image entries contain 19 unique PNG payloads. All 19 are **byte-identical** to the existing runtime model, documented in [iss-source-verification.json](evidence/iss-source-verification.json). Filenames ending `.jpg` in the source are not taken as format evidence: the embedded signatures are PNG.

The runtime `frontend/public/models/iss-vtad-source-png.glb` remains 32,735,516 bytes, SHA-256 `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`. [Per-texture dimensions/format/size/hash/alpha](evidence/mission1-iss-audit.json) show 15×1024² and 4×512² RGBA images, all alpha bytes 255. Four materials have native normal maps; the original base color, metallic/roughness, normal and occlusion references are retained. Texture resolution is the source limit; renderer changes cannot recover absent solar-panel or insulation detail.

The GLB's sampler is LINEAR magnification, LINEAR_MIPMAP_LINEAR minification and REPEAT. No mip chain is embedded in the PNG/GLB; Cesium generates the runtime GPU mip chain. The GPU audit observes all 19 textures at original dimensions, with generated mips and matching filters. Base RGBA allocation is about 64 MiB; the full mip-chain estimate is 85.33 MiB. No hidden Model downsampling, lossy recompression, decimation, normal invention, new emissive lights or semantic retagging occurred.

The GPU supports anisotropy 16. Earth ImageryLayer uses Cesium's maximum-safe default, observed at 16. Native glTF Model textures are observed at anisotropy **1**: Cesium 1.145's public Model API does not expose a model-sampler anisotropy override. A private sampler/cache mutation or rebinding all original PBR channels was rejected because it is not a maintainable validated renderer contract. Oblique/native close views retain correct trilinear mip filtering, but increased model anisotropy is a remaining renderer limitation, not a claimed improvement. Physical scale, 80-pixel Overview minimum footprint, display lift, material shader, lighting, visibility and all 14 real feature picks remain unchanged.

## Earth night, stars and contrast

Local day/night loading and each day/night GIBS probe now start independently. A slow optional night probe no longer holds a good day layer behind `Promise.all`. Ordered local day → tiled day → local night → tiled night composition handles late arrivals. Two retries per failed tile are bounded by an explicit tile-key map; success on a different tile cannot reset the failed tile's budget despite Cesium's shared layer error counter. Generic provider errors do not trigger tile retry. The bookkeeping map is bounded to 1024 entries, listeners/wrapper are restored on teardown, and pending asynchronous work cannot insert into a destroyed Viewer.

A single tile failure preserves the finer layer and its successful neighboring tiles, while Cesium ancestors/local images remain underneath. Previously the first failure removed the whole tiled source for that Viewer. [Fixed one-tile outage comparison](evidence/fixed-comparison.json) injects exactly one labelled HTTP 503 for a real night tile, lets all other NASA requests pass normally, and compares the same real epoch/camera. This is a resilience diagnostic, not a normal-network loading result or fabricated imagery. The final view retains fine city clusters where the baseline falls back to the blurred 0.1° image.

Night brightness changes 1.8→1.15; gamma/contrast remain 1. This reduces bleaching in bright urban cores, with no glow, sharpening, new emission, artificial population mask or invented city lights. `dayAlpha=0`, `nightAlpha=1`, scene-time native Sun lighting and the accepted terminator blend remain. Fixed Europe, North America, India/Middle East and East Asia views cover bright regions, oceans and transition into daylight; high-level day/night zooms verify the level-8 ceiling.

Stars now derive from the native **lossless TIFF** of the same verified product rather than its JPEG rendition. Cube faces increase 2048²→4096² using the existing one-pass bilinear projection, without sharpening, AI, arbitrary random stars, color grading or repeated upsampling. The generator verifies the original TIFF hash/dimensions, all 12 shared cube edges and lossless RGB encode/decode equality. [Chromium decoded RGBA verification](evidence/decoded-sky.json) matches all six pinned pixel hashes. Source color and faint-point variation become clearer in [the fixed Earth-limb comparison](evidence/normal-network/after/stars-with-earth-limb.png), while the accepted Earth limb and Sun remain natural.

The NASA source already adjusts faint-star intensity and uses Gaussian point-spread functions/display gamma 1.8; this is catalogue visualization, not calibrated radiance.

All faces decode before replacement, and the old skybox is destroyed after a restored post-render. Maximum cube size is checked against 4096; unsupported hardware or decode failure keeps bundled Cesium stars. Refinement starts only after ISS texture/feature/shader readiness so the 34.45 MB star derivative does not compete for first-use ISS loading. This is an explicit initial loading fallback, not a dynamic FPS-based quality downgrade. A cube swap remains a finite refinement step; there is no promise of zero loading-frame GPU work.

4096 pixels per 90° cube face corresponds to the 16K map's equatorial quarter-width and already exceeds the display sampling of these accepted views. An 8192² cube would allocate about 1.5 GiB for its six RGBA8 faces alone, before decoded copies, Earth/model buffers and browser memory, on an 8 GB unified-memory host. It was not adopted or claimed as a validated visual trial. The chosen 4096² derivation is the maximum practical configuration actually validated here, rather than the GPU's absolute maximum cube dimension.

Space background `#040b14`, Earth base `#18394a`, atmosphere, neutral globe projection, Sun glow 0.6 and native Sun bloom are unchanged. HDR remains false. Removing JPEG background artifacts and retaining finer dark-side imagery improves Earth/space separation without crushing night detail or changing physical geometry. No full-scene bloom, oversaturated limb or extra star emission is added.

## Measured bottlenecks and rejected experiments

The baseline cost-isolation run is retained in [costs.json](evidence/diagnostics/costs.json). These short instrumented windows are diagnostics, not the primary 30-second acceptance benchmark. With all accepted content present, baseline Overview was about 29.2 ms, scene CPU about 8.5 ms. Temporarily removing the model reduced CPU to about 3.5 ms and interval to 23.7 ms: native model geometry/PBR is meaningful CPU and GPU work. Disabling scene MSAA cut interval to about 20 ms, still short of 60 FPS and visually inferior. Native DPR 2 more than doubled frame time, consistent with pixel/fill and multisample cost. Final asynchronous GPU timers and observable draw counts substantiate the limit; instrumented timer measurements include their own overhead and are not substituted for uninstrumented FPS.

| Experiment | Observation / decision |
| --- | --- |
| Disable browser drawing-buffer AA | Adopted through public Viewer `contextOptions.webgl.antialias=false`. Cesium still renders/resolves MSAA 4 before its full-frame retained FXAA/copy output. On/off/on intervals about 28.4/26.2/28.6 ms; 696,800 matched Overview ROI pixels had **RGB delta zero**. GPU audit confirms default samples 4→0 and scene target samples remain 4. |
| Disable retained FXAA/copy stage in Overview | About 2 ms saved, but every subsequent Inspection entry reallocates/recompiles and produces 72–75 ms first-mode stalls versus 41–45 ms after first entry when retained. Rejected; retained bypass stays enabled. [AA cycles](evidence/diagnostics/mission1-aa-cycle.json). |
| Remove scene MSAA / atmosphere / model / trajectories / stars / night | Diagnostic cost isolation only; rejected as quality/content reductions. Night/stars removal gave negligible steady benefit at this view. |
| “Vertex atmosphere” toggle | Unsupported Globe property in this pinned engine; **invalid experiment**, excluded from conclusions. |
| Enable HDR | About 36 ms, slower than 29.2 ms baseline; new exposure/tone mapping would need separate source-color validation. Rejected. |
| 4096² PNG faces | Pixel-valid but 59,810,100 bytes; unnecessary loading cost. Replaced by lossless WebP, 34,451,680 bytes, **42.4% smaller with identical derived pixels**. |
| Eager WebP refinement / start at Model.readyEvent | Competes with native textures or eight shader-preparation frames; loading evidence preserved under diagnostics. Rejected in favor of refinement after Inspection readiness. |
| Native model material batching | Grouping within each mesh by compatible material/attributes/extensions still gives 343→343 primitives. Cross-node rewrite risks original hierarchy and direct feature IDs; not adopted. |
| KTX2/Basis or further native texture conversion | No verified finer texture information and no measured safe benefit that justifies changing the source PNG/PBR path; not adopted. |
| NASA 2020 [Deep Star Maps](https://svs.gsfc.nasa.gov/4851/) | Authoritative newer Gaia-inclusive source considered, 16K half-float EXR ~422.9 MB / 64K ~3.8 GB, ICRF/J2000 linear data. Needs validated frame alignment and HDR-to-display transfer. Source research only; not falsely reported as a rendered/rejected visual trial. |
| Cesium code splitting / preloading everything | Cesium is required for the first useful Earth. Splitting the same immediately required renderer would defer first use, and preloading stars competes with ISS. No framework/bundler rewrite or speculative extra asset requests. |

The adopted rendering change is narrow: redundant browser AA removal plus source/loading work. There is no new per-frame React state, texture generation, tile polling or allocation loop. Existing sampled-property/trajectory updates and world-camera helpers are unchanged. One Viewer owns model, imagery, skybox and teardown; no additional globe, timebase, provider, microservice, Kafka, Kubernetes or worker architecture was added.

## Resolution, cache and memory

Quality configuration is fixed: native DPR is the floor, low-DPR `<1.5` gets existing 1.25 supersampling, DPR≥1.5 uses resolutionScale 1, Cesium MSAA 4 and Inspection FXAA are retained, HDR false. No adaptive thresholds/hysteresis exist. Source resolution never changes in response to a bad FPS sample.

The globe's public tile cache target remains 100 and maximumScreenSpaceError 2; tiles required by the current view can exceed that cache target. Cesium's ordinary demand/ancestor LOD and request scheduler remain. There is no worldwide high-zoom preload, arbitrary level beyond the verified matrix, custom NASA cache or repeated source polling. Each source makes its existing one connectivity/payload probe per Viewer; actual visible tiles refine afterward. A fallback intentionally costs one small local asset/layer per day/night source and protects genuine network loss.

Local Vite production-preview responses were inspected: hashed JS and public WebP return ETag and `Cache-Control: no-cache`, permitting revalidation, rather than an asserted immutable deployment policy. Warm loads are measured on that actual server. This task does not deploy or claim CDN headers; NASA cache semantics are respected. The production bundle retains the existing Cesium large-chunk warning; it is disclosed, not hidden by increasing its warning threshold.

The actual warm resource trace shows cached/revalidated smaller star faces, but the 32.74 MB GLB and the two largest WebP faces still return full bodies in this Chromium/preview environment. Warm loading is therefore not reported as zero-transfer. Source fidelity and a real cache observation take precedence over an invented cache improvement. No browser cache flags or deployment header assumptions are used to manufacture the comparison.

Loading first use improves: original cold observed Earth 615.8→485.0 ms, native ISS 1538.9→1255.6 ms, Inspection 2395.1→2067.1 ms; repeat Inspection 1815.2→1623.7 ms. Fully refined/tile-idle time increases from original 3.40–3.80 s to 4.07–4.25 s: **an explicit 0.27–0.80 s refinement cost**, despite better first use, for four times the cube texels, lossless source detail and the permanent night fallback. The contemporaneous untouched-build recheck is 3.04–3.65 s, exposing a 0.60–1.12 s difference and real run/network variation. This is not called an unchanged or improved settlement time. The loading decision accepts this finite refinement tradeoff after eliminating the ISS/readiness regression of eager loading; no scene or loading metric is hidden.

The 4096² GPU cube is observed as six RGBA8 faces, LINEAR/LINEAR and CLAMP_TO_EDGE without generated mips: **384 MiB** versus 96 MiB at 2048². Source RGB decoded storage is 288 MiB; GPU format is separately observed, not inferred from file size. Native ISS mip textures add about 85.33 MiB. The numerical report estimates remaining observable textures/renderbuffers from their dimensions/formats and records JS heap, current live-object counts and zero context loss. These are **allocation estimates**, not exact physical VRAM/residency; this M1 uses shared RAM and browser/driver copies are not observable. Deletion/live counts after mode return, settled tile queues and fixed native model/cube allocations show no observed thrashing during the audited cycle; this is not a universal long-duration leak guarantee.

## Fixed visual evidence

All paths below are inside this dossier; corresponding fixture JSON records real UTC, world pose/basis, native FOV/range, canvas and free-area centroid. Full-page captures include credits and accepted UI. Some LIVE status text naturally changes epoch; visual claims use fixed Replay/camera pairs and source hashes rather than declaring whole-page pixel equality.

| View | Before | Final |
| --- | --- | --- |
| ISS canonical | [before/iss-canonical.png](evidence/before/iss-canonical.png) | [after/iss-canonical.png](evidence/after/iss-canonical.png) |
| ISS close | [before/iss-close.png](evidence/before/iss-close.png) | [after/iss-close.png](evidence/after/iss-close.png) |
| ISS oblique | [before/iss-oblique.png](evidence/before/iss-oblique.png) | [after/iss-oblique.png](evidence/after/iss-oblique.png) |
| Earth daylight | [before/earth-day.png](evidence/before/earth-day.png) | [after/earth-day.png](evidence/after/earth-day.png) |
| Day source ceiling, normal network | [normal/before/day-max-level.png](evidence/normal-network/before/day-max-level.png) | [normal/after/day-max-level.png](evidence/normal-network/after/day-max-level.png) |
| Night globe | [before/earth-night.png](evidence/before/earth-night.png) | [after/earth-night.png](evidence/after/earth-night.png) |
| Europe cities | [before/earth-night-europe.png](evidence/before/earth-night-europe.png) | [after/earth-night-europe.png](evidence/after/earth-night-europe.png) |
| North America | [before/earth-night-north-america.png](evidence/before/earth-night-north-america.png) | [after/earth-night-north-america.png](evidence/after/earth-night-north-america.png) |
| India/Middle East | [before/earth-night-india-middle-east.png](evidence/before/earth-night-india-middle-east.png) | [after/earth-night-india-middle-east.png](evidence/after/earth-night-india-middle-east.png) |
| East Asia | [before/earth-night-east-asia.png](evidence/before/earth-night-east-asia.png) | [after/earth-night-east-asia.png](evidence/after/earth-night-east-asia.png) |
| Night source ceiling, normal network | [normal/before/night-max-level.png](evidence/normal-network/before/night-max-level.png) | [normal/after/night-max-level.png](evidence/normal-network/after/night-max-level.png) |
| Terminator | [before/earth-terminator.png](evidence/before/earth-terminator.png) | [after/earth-terminator.png](evidence/after/earth-terminator.png) |
| Stars + real Earth limb, normal network | [normal/before/stars-with-earth-limb.png](evidence/normal-network/before/stars-with-earth-limb.png) | [normal/after/stars-with-earth-limb.png](evidence/normal-network/after/stars-with-earth-limb.png) |
| One real night tile fails | [before/night-one-tile-outage.png](evidence/before/night-one-tile-outage.png) | [after/night-one-tile-outage.png](evidence/after/night-one-tile-outage.png) |
| Mobile Overview | [before/mobile-overview.png](evidence/before/mobile-overview.png) | [after/mobile-overview.png](evidence/after/mobile-overview.png) |
| Mobile Inspection | [before/mobile-inspection.png](evidence/before/mobile-inspection.png) | [after/mobile-inspection.png](evidence/after/mobile-inspection.png) |

The original `stars-limb.png` camera pointed away from the actual Earth; it remains in the complete original sequence but is not called proof of a limb. The supplemental `stars-with-earth-limb.png` pair uses the corrected fixed pitch −1.12, same world location/epoch and a visible lower Earth limb. The initial supplemental four-view sequence retains the deliberately injected night-tile outage across all four captures; `evidence/normal-network` repeats the three source-ceiling/limb pairs without that injection, so ordinary visual comparison is separate from resilience. Final desktop screenshots also live in `evidence/after/dpr1` and `evidence/regression`; the regression set covers the actual LIVE composition and dynamic panel dimensions.

## Regression, tests and change boundaries

The numerical report records final gate counts, build identity and browser results. Required coverage includes LIVE/Replay, Crew/Detail, Overview/Inspection, GP/OEM, Back, native Earth drag/wheel, ISS GPU picking, all 14 mapped module picks per build/desktop/mobile combination, Inspection orbit/zoom, responsive resize and dynamic dashboard width/height. Full-screen canvas, overlay ownership, free-area centroid and visible scene below the dashboard are explicit assertions; canonical Inspection remains 90 m / 42.5° / lateral zero / 100° with accepted portrait widening and adaptive entry/exit timing.

No dashboard restyling was performed. `App.tsx`, stylesheet/layout hook, camera/controls/lighting/projection/trajectory helpers, model binary, all backend and previous evidence are checked against the baseline in [frozen-files.json](evidence/frozen-files.json). Scene frame is a presentation/navigation frame, never measured ISS attitude. Backend Orekit/TLE/OEM, persistence, REST contracts, source provenance/timestamps/quality, Crew and Replay semantics are unchanged.

Frontend tests include a meaningful interleaved-tile regression proving a different successful tile cannot reset the exhausted retry budget. Existing camera/domain/rendering tests remain. Backend `mvn test` and `mvn verify` use Java 21 and each run 382 tests with zero failures/errors/skips. Frontend tests, typecheck, production build, dev/prod browser QA, visual review and `git diff --check` are recorded separately. Console/request failures from external NASA, if present, are distinguished from application JS errors and preserved rather than hidden.

**Native two-finger pinch remains unverified.** Playwright mouse/wheel is not a native touchpad test. No physical phone/mobile GPU, Safari/Firefox or all-hardware 60 FPS certification is claimed.

## Binary derivatives and reproducibility

[Asset inventory](assets.md) lists every new runtime binary with its path, authoritative source URL, provenance, dimensions, format, bytes and SHA-256; [skyboxManifest.json](../../../frontend/src/cesium/skyboxManifest.json) additionally pins decoded RGBA hashes. Six old 2048² PNGs are removed and six used 4096² lossless WebPs replace them. No unused TIFF, rejected PNG cube, duplicate GLB, build output, remote downloaded media workaround or generated ISS texture is committed.

The source generator is `frontend/scripts/generate-tycho-skybox.py`, with pinned native input, face-size validation and exact edge/pixel checks. Runtime reproducibility depends on that source hash plus Pillow/lossless WebP encoder; encoded hashes and decoded hashes identify the accepted artifact even if a different encoder version emits a different bitstream. Browser tools stay in this dossier and use the pinned Cesium/public scene APIs through QA-only browser references; no instrumentation enters runtime application code.

```sh
export MISSION1_PLAYWRIGHT_MODULE=/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
node docs/frontend/high-fidelity-rendering-performance/scripts/capture.cjs
node docs/frontend/high-fidelity-rendering-performance/scripts/performance.cjs
MISSION1_DPR=2 MISSION1_QUICK=1 node docs/frontend/high-fidelity-rendering-performance/scripts/performance.cjs
MISSION1_LIVE=1 node docs/frontend/high-fidelity-rendering-performance/scripts/performance.cjs
node docs/frontend/high-fidelity-rendering-performance/scripts/gpu-audit.cjs
node docs/frontend/high-fidelity-rendering-performance/scripts/browser-qa.cjs 5175 development
node docs/frontend/high-fidelity-rendering-performance/scripts/browser-qa.cjs 4175 production
```

Use `MISSION1_EVIDENCE` / `MISSION1_EVIDENCE_DIR` to put a new run elsewhere; run GPU/FPS/loading sessions sequentially. The diagnostics are labelled by experiment and were not all adopted. The PNG GPU run interrupted by unrelated CPU compression is preserved as `diagnostics/png-candidate/gpu-uncontrolled` and **excluded** from final timing. A loading run overlapping frontend tests is similarly excluded. The first completed GPU instrumentation could wrap inherited WebGL methods twice; its API-call counts/object counts are archived under `diagnostics/gpu-inherited-method-overcount` and are not final counts. The corrected audit wraps each actual prototype owner once and shares WeakMap records across overloads, then reruns the cycle. Original baseline assets/production build were copied before changes for the controlled comparison; no Git reset or historical evidence overwrite was used.

The additional actual-LIVE sequence completed four orbital modes, but its Crew click was not confirmed: the saved frame had no Crew panel and the subsequent close locator timed out. That fifth row is rejected under `diagnostics/live-crew-click-unconfirmed`. The four valid orbital rows remain, and Crew/Replay are measured on a fresh actual-API page with visible-summary readiness. Final LIVE evidence identifies the two source sessions; the harness now requires visible Crew before and after its window and waits for the returned layout to settle before clicking. No application's Crew code or behavior is changed to accommodate QA.

## Documentation, architecture and synchronization

Created this README, `context-reviewed.md`, `metrics.md`, `assets.md`, [validation.md](validation.md), reproducible scripts and JSON/PNG/log evidence under `docs/frontend/high-fidelity-rendering-performance/`. Updated `frontend/README.md`, `docs/frontend/earth-visualization.md`, `iss-inspection-mode.md`, `iss-model.md`, `rendering-quality.md`, and `docs/architecture/04-earth-view-orbital-delivery.md`. Earlier dated implementation notes remain historical.

ADR review found no new significant architectural decision: this is reversible source-derivative, public graphics configuration and local async-loading work within the accepted Viewer ownership/dependency boundaries. No new dependency, data/provider contract, deployment topology or infrastructure was selected; existing ADRs remain valid.

External `/Users/daniel/Desktop/mission1-project.md` receives the milestone, real performance failure, validation, limitations and final synchronization hash and remains **OUTSIDE Git**. One ordinary commit is created after the applicable quality/functional/loading/test gates and the explicit hardware-blocked performance result are documented. Parent is the accepted baseline above; message `perf: optimize high-fidelity mission rendering`. Final commit hash and `local main == origin/main == GitHub main`, SSH remote `git@github.com:therabo/MISSION1.git`, normal push and clean tree are verified after commit and recorded in the external context/final response without a second documentation commit.

Remaining limits: native model texture detail and glTF anisotropy API; verified Earth source/level ceiling and historic dates; historical star-map/renderer frame suitability rather than precise live astrometry; local M1 fill/MSAA/model cost; 384 MiB cube allocation; finite initial star refinement; external NASA latency; preview cache revalidation; browser/driver VRAM opacity; native touch hardware untested. Maximum validated practical fidelity is an explicit bounded engineering result, not a claim of an absolute optimum on every machine or catalogue.
