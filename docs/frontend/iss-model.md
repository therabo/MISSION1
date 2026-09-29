# ISS model asset and presentation record

Selection gate: **`MODEL_READY_FOR_INTEGRATION`**. This record covers the first detailed station geometry in the Cesium Earth View. It does not establish a current ISS configuration, onboard position measurement, station attitude, or moving hardware state.

## Authoritative candidates inspected

All candidates came from official NASA Science resource pages and were inspected as GLB files, including their glTF JSON, hierarchy and accessor extents. Sizes below are original downloads. NASA resource pages for A, B and IGOAL do not establish a precise station configuration date; no current-configuration claim is made for them.

| Candidate and NASA source | Original GLB, SHA-256 | Structure and measured bounds | Assessment |
| --- | --- | --- | --- |
| [ISS (A), NASA Ames](https://science.nasa.gov/3d-resources/international-space-station-iss-a/) | 39,708 B; `70d0619a69312a45cbf740ba9a491fad854e10226dc5936c213fb1f93f063678` | 1 node / 1 mesh; 7,565 vertices; 6,642 triangles; 25.6 × 16.0 × 15.4 model units; Draco | Small, but flat geometry and unusable module hierarchy. Units/scale not evidenced by its bounds. |
| [ISS (B), NASA / Michael D. Carbajal](https://science.nasa.gov/3d-resources/international-space-station-iss-b/) | 476,992 B; `2ba4427413b0dd89a33d2acaf962dea8a96a3b1d8dceda05cc7aad547ffd3d16` | 11 generic nodes / 10 meshes; 103,071 vertices; 174,440 triangles; 14.4 × 45.4 × 45.5 model units; 11 animations | Light runtime, but generic names and ambiguous physical scale prevent trustworthy module mapping. The animation channels are not evidence of real articulation telemetry. |
| [ISS (D) (IGOAL), NASA/JSC Integrated Graphics, Operations, and Analysis Laboratory](https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/) | 64,846,620 B; `3b03742fb55f2a495c4a72aaa2cb175aaeff5ee38f4f42b95f92083e30a464ef` | 1 node / 1 mesh (`IGOAL_SSREF`); 6,415,155 vertices; 2,975,912 triangles; 73.4 × 30.6 × 108.3 model units; 114 embedded images; Draco | Strong NASA/JSC origin and high visual detail, but a 64.8 MB source, nearly 3 million triangles and flattened hierarchy are costly and block direct semantic mapping. |
| [International Space Station 3D Model, NASA VTAD](https://science.nasa.gov/resource/international-space-station-3d-model/) | 44,495,916 B; `26dba905b4b7555edbcb0c5f5a61b5c18659f5166076ab27dbb0e64025759fca` | 132 named nodes / 131 meshes; max hierarchy depth 20; 325,374 vertices; 247,547 triangles; 111.988 × 68.852 × 58.736 model units; 26 embedded images | Selected: named modules, manageable geometry and near-physical measured size. Optimize textures before adding to Git. |

The selected [NASA VTAD resource](https://science.nasa.gov/resource/international-space-station-3d-model/) is dated **22 April 2019**; NASA lists the downloadable model update as **9 September 2023**. That download date does not demonstrate a new station configuration. The GLB visibly contains a node named `13 Pirs Docking Compartment (DC) and Airlock`. [Pirs undocked in July 2021](https://www.nasa.gov/blogs/spacestation/2021/07/26/progress-77-and-pirs-undocked-from-station/) and [Nauka docked later that month](https://www.nasa.gov/blogs/spacestation/2021/07/29/new-module-successfully-docks-to-space-station/). Nauka and later [roll-out solar arrays](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) are not identifiable in this asset. Visiting vehicles and other later changes also cannot be assumed. The asset is a documented historical visual reference, **not an exact 2026 ISS configuration**. No hardware was invented or added.

## Runtime derivative and validation

The original VTAD GLB is available from the NASA resource page at [NASA's direct `ISS_stationary.glb` URL](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/ISS_stationary.glb). The runtime file is [`frontend/public/models/iss-vtad-webp.glb`](../../frontend/public/models/iss-vtad-webp.glb), **15,175,080 B**, SHA-256 `e5ad5beb2f1ea4364c964f316a072775d8f9d4c4bfed126932aa07a85f438360`. Its source hash is recorded above and in [`issModelManifest.json`](../../frontend/src/cesium/issModelManifest.json). The original 44.5 MB file is intentionally outside the repository. No Git LFS or runtime NASA request is needed.

Reproduce the derivative with glTF Transform CLI **4.5.1**, using its normal CLI installation from npm and the direct GLB download exposed on the NASA page:

```sh
gltf-transform dedup ISS_stationary.glb iss-dedup.glb
gltf-transform webp iss-dedup.glb iss-vtad-webp.glb --quality 90
shasum -a 256 ISS_stationary.glb iss-vtad-webp.glb
```

The intermediate deduplicated GLB was 32,197,496 B. The runtime file retains **132 nodes, 131 meshes, 343 primitives, 325,374 vertices, 247,547 triangles and the original bounds**, with 19 embedded images after deduplication. It uses `EXT_texture_webp`, which [CesiumJS supports](https://cesium.com/learn/cesiumjs/ref-doc/Model.html). The runtime GLB binary buffer is about 14.9 MB; that is a file payload figure, **not measured GPU memory**. Browser texture decompression and draw resources add memory. The WebP conversion reduced the on-disk transfer by about 65.9% from the original.

Both original and derivative passed Khronos **glTF Validator 2.0.0-dev.3.10** with **0 errors, 17 warnings and 37 informational messages**. The warnings concern generated tangent space; the informational messages include two degenerate triangles. They were present in the original and do not prevent the tested Cesium render. No geometry was rebuilt. Production build must contain the GLB at `dist/models/iss-vtad-webp.glb` with the manifest hash.

## Scale, axes and presentation semantics

[NASA describes the ISS as about 109 m across its solar arrays](https://www.nasa.gov/reference/international-space-station/). The asset's longest measured bounding dimension is **111.988 model units**, 2.99 m or **2.74%** above that approximate NASA span. [glTF 2.0 defines linear distances in meters](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc); the bounds are consistent with a meter-authored station. `PHYSICAL_ASSET_SCALE = 1.0` preserves that dimensional validation. The difference can include bounding-box orientation and model extent; it is not treated as an orbital or hardware measurement.

Earth View uses `DISPLAY_ENHANCED_SCALE`: **the rendered ISS is NOT TO SCALE**. Cesium `Model.minimumPixelSize = 72` aims to keep the silhouette legible as the camera retreats, while `Model.maximumScale = 20000` bounds enlargement to at most 20,000 times the 1.0 physical asset scale. These are presentation parameters, not physical dimensions. At close distance, the minimum pixel rule ceases to enlarge the model. At medium distance it increases apparent size toward 72 pixels; at global distance the upper scale bound may prevent reaching 72 pixels. The model's center, sampled WGS84 position, altitude, and orbital path do not change. [Cesium documents both sizing controls and their relationship](https://cesium.com/learn/cesiumjs/ref-doc/Model.html).

Cesium converts the asset's glTF axes for rendering, then places its origin at the backend-sampled ITRF position using `Transforms.eastNorthUpToFixedFrame`. The explicit static `MODEL_ASSET_ALIGNMENT` is **identity**. The resulting pose is **`DISPLAY_ONLY_LOCAL_ENU`**. `ATTITUDE = UNAVAILABLE`: no verified station attitude source or frame convention is present. The model is not aligned to orbital velocity, LVLH or the Sun. Solar-array nodes keep the source asset pose and are not animated.

The marker/path Entity and the model primitive use one `SampledPositionProperty(ReferenceFrame.FIXED)` from the same accepted REST window. Each tick reads that property; no second propagation, orbit or attitude path exists. The model remains visible at valid camera distances once ready. An unobtrusive `ISS` label accompanies it beyond 2,000 km and disappears inside 1,500 km, with hysteresis to avoid flicker. The point marker appears only while loading or after model failure. Model loading, readiness and failure are independent of orbital delivery; an expired sample window hides both. Focus ISS offers a close inspectable view while leaving camera controls available. Focus mode reduces Cesium's public `ScreenSpaceCameraController.zoomFactor` from its default 5 to **0.0005**, because its Earth-relative zoom rate otherwise jumps through the station at close range; Earth overview restores 5.

Browser checks at 843 × 885 on 2026-09-29 compared `maximumScale` values 5,000, 15,000 and 20,000, and `minimumPixelSize` values 48 and 72. With the final 72/20,000 setting, the global model remained a distinct roughly 50-pixel ISS silhouette on a roughly 410-pixel Earth disk, without obscuring a broad region. In a regional/orbital view it remained identifiable at roughly 50–60 pixels; the `ISS` label appears only at far range. At Focus ISS distance (600 m from the sampled center), the station occupied roughly 140 pixels and detailed modules were inspectable. Repeated wheel zoom moved closer gradually after the focus zoom-rate adjustment, and Focus ISS restored a useful framing. A 390 × 844 mobile check kept the close model above the status panel. These are visual checks, not physical measurements or a pixel-accuracy contract.

## Hierarchy and semantic mapping

The full machine-readable [`iss-model-inventory.json`](iss-model-inventory.json) records each node index, exact source name, parent, mesh name and materials. The runtime GLB itself is the geometry source. The manifest pins the runtime hash so mapped indices cannot silently point into a different file.

Only these exact NASA asset node labels are mapped at this milestone:

| Node index | Exact asset label | MISSION1 component ID | Status and evidence |
| ---: | --- | --- | --- |
| 97 | `09 Destiny Space Laboratory` | `DESTINY` | `VERIFIED`: explicit NASA model node name |
| 84 | `27 Columbus Space Laboratory` | `COLUMBUS` | `VERIFIED`: explicit NASA model node name |
| 95 | `26 Harmony Node 2` | `HARMONY` | `VERIFIED`: explicit NASA model node name |

There are **no `PARTIALLY_VERIFIED` mappings**. All remaining node indices are **`UNMAPPED`** in the application, including generic geometry and historical parts. `VERIFIED` here certifies only that the named model geometry corresponds to the named component in this NASA asset; it does not certify 2026 configuration, telemetry or pose. Runtime tests assert every mapped index/name and the full inventory hierarchy against the shipped GLB.

The hierarchy makes future semantic mapping feasible, but picking needs its own verified path. Cesium exposes model nodes by name; ordinary `Scene.pick` on this GLB is not guaranteed to return an individual named node because it has no `EXT_mesh_features` or per-node feature IDs. A future milestone should test picking at node granularity and, if needed, derive feature metadata or controlled pick IDs while preserving original node provenance. Until then, no production module selection or module telemetry panel is claimed.

## NASA use and credit

The UI shows **“ISS 3D model: NASA VTAD”** and links to the NASA resource page; Cesium also displays the model credit. This is factual attribution, following [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). MISSION1 does not claim NASA, ESA or ALTEC endorsement, partnership or review. NASA marks in source geometry are not used as MISSION1 branding.

## Local performance observations

In a local browser smoke test on 2026-09-29, the UI measured approximately **0.2 s** from `Model.fromGltfAsync` start to Cesium `readyEvent` in development and **0.4 s** in Vite's served production build. These are warm local browser observations, not network or GPU benchmarks. The 15,175,080 B model returned HTTP 200 from the production preview, and its served file hash matched the source tree. The model contains roughly 247,547 triangles at close range. Loading is asynchronous and does not block the orbital marker, path or status panel. Temporarily withholding the development GLB produced `3D model: FAILED` while the near ISS marker and orbital path stayed visible; the original hash was restored afterward.
