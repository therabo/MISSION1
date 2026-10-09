# IGOAL-to-VTAD registration evidence gate

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](qa-artifact-policy.md) for archive recovery and current evidence.

Checked **2026-09-30**. This is a research-only extension of the [current geometry assessment](iss-current-geometry-assessment.md). NASA VTAD remains the MISSION1 production base model. No geometry was integrated, no temporary composite was made, and no runtime or semantic mapping changed. Numerical coordinates below are **model-derived estimates**, not NASA engineering attachment frames or live ISS telemetry.

## Source and reproduction boundary

The fit uses the NASA VTAD `ISS_stationary.glb` (SHA-256 `26dba905b4b7555edbcb0c5f5a61b5c18659f5166076ab27dbb0e64025759fca`) and the **named**, Draco-compressed NASA/JSC IGOAL GitHub `International Space Station (ISS).glb` (SHA-256 `57cecfaf332efb2127d07796c4b65ca570d95a11516c8e046feb5a12efee491d`). They are distinct asset families. NASA's [VTAD resource](https://science.nasa.gov/resource/international-space-station-3d-model/) and [IGOAL resource](https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/) identify their publishers. The newer IGOAL Science GLB is flattened into one mesh, so it cannot provide independently named registration anchors. Its 2026 source FBX was inspected for hierarchy, transforms and units, but its geometry was **not** used in this numerical fit. The earlier [candidate registry](iss-geometry-candidates.json) pins its hash and the source package hashes.

The repeatable tooling is `frontend/scripts/research-decode-igoal-draco.cjs`, `research-inspect-igoal-fbx.py`, and `research-iss-geometry-registration.py`. Install `draco3d` and NumPy in temporary research environments, decode the named IGOAL GLB to a temporary directory, and pass the source GLBs plus that decoded directory to the Python registration script. The exact example, with source files remaining outside Git, is:

```sh
npm install --prefix /tmp/mission1-geometry-research-2026-09-30/node draco3d
python3 -m venv /tmp/mission1-geometry-research-2026-09-30/venv
/tmp/mission1-geometry-research-2026-09-30/venv/bin/pip install numpy
node frontend/scripts/research-decode-igoal-draco.cjs /tmp/mission1-geometry-research-2026-09-30/igoal-github.glb /tmp/mission1-geometry-research-2026-09-30/decoded /tmp/mission1-geometry-research-2026-09-30/node/node_modules/draco3d
/tmp/mission1-geometry-research-2026-09-30/venv/bin/python frontend/scripts/research-iss-geometry-registration.py /tmp/mission1-geometry-research-2026-09-30/vtad-ISS_stationary.glb /tmp/mission1-geometry-research-2026-09-30/igoal-github.glb --igoal-decoded-dir /tmp/mission1-geometry-research-2026-09-30/decoded --fixed-scale 9.838543354421132
```

The script reads decoded vertex positions and full glTF node world matrices. For each component it uses its **direct named mesh only**, excluding separately named details and descendants. Its center is the midpoint of the exact vertex AABB; principal-axis extents come from the covariance eigenbasis. These are reproducible geometric features, but neither is guaranteed to equal a physical docking interface. The 2024 FBX and 2026 FBX transform-inspection outputs were kept in the temporary research directory, not Git.

## Correspondence gate

The NASA [assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/), the [NASA station element diagram](https://www.nasa.gov/wp-content/uploads/2023/12/iss-2024-calendar.pdf), and [JAXA's Kibo structure](https://humans-in-space.jaxa.jp/en/kibo/structure/) supply the component nomenclature. Exact asset node names are printed by the script. The identified nodes have directly owned geometry in both assets. `VERIFIED_SAME_COMPONENT` establishes **identity**, not identical mesh boundaries or engineering accuracy.

| Component | VTAD node/name | IGOAL node/name | Classification/use |
| --- | --- | --- | --- |
| Unity | 112 `02 Unity Node 1` | 304 `Node1` | `VERIFIED_SAME_COMPONENT`; fit |
| Destiny | 97 `09 Destiny Space Laboratory` | 551 `USLab` | `VERIFIED_SAME_COMPONENT`; fit |
| Harmony | 95 `26 Harmony Node 2` | 316 `Node2` | `VERIFIED_SAME_COMPONENT`; fit |
| Columbus | 84 `27 Columbus Space Laboratory` | 19 `Columbus` | `VERIFIED_SAME_COMPONENT`; fit |
| Zarya | 24 `01 Zarya - (FGB) Funtional Cargo Block` | 571 `Zarya_FGB` | `VERIFIED_SAME_COMPONENT`; fit |
| Zvezda | 22 `05 Zvezda (SM) Service Module` | 586 `Zvezda_SM` | `VERIFIED_SAME_COMPONENT`; fit, but direct extents include different attached geometry |
| Kibo Pressurized Module | 94 `30 Kibo Space Laboratory (PSM) Pressurized Module` | 240 `JEM_PM` | `VERIFIED_SAME_COMPONENT`; fit |
| Tranquility | 110 `37 Tranquility Node 3` | 319 `Node3` | `VERIFIED_SAME_COMPONENT`; holdout |
| Poisk | 1 `34 Poisk (MRM-2) Mini Research Module` | 272 `MRM2` | `VERIFIED_SAME_COMPONENT`; holdout |
| Rassvet | 23 `39 Rassvet (MRM-1) Mini Research Module` | 262 `MRM1` | `VERIFIED_SAME_COMPONENT`; holdout |
| Cupola | 109 `38 Cupola` | 28 `Cupola` | `VERIFIED_SAME_COMPONENT`; holdout |
| Quest versus `Airlock` | 99 `12 Quest Airlock` | 1 `Airlock` | `AMBIGUOUS`; excluded because IGOAL's generic name lacks an explicit Quest alias |
| Pirs, MLM, RSNode, all iROSA, Bishop, visiting craft, changing payloads | configuration-specific | configuration-specific | `REJECTED` as registration anchors; no common stable component |

The fit set spans the Russian segment, central US segment, port Columbus, and starboard Kibo. Four spatially distributed verified components were withheld completely from parameter estimation.

## Units and scale

The [glTF 2.0 specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc#34-coordinate-system-and-units) specifies metres, right-handed coordinates and +Y up. VTAD's root is identity and its major dimensions are broadly metre-sized, but the asset supplies no separate engineering unit certificate. Direct-mesh principal extents are 10.018 VTAD units for Destiny, 11.442 for Kibo PM, and 13.414 for Zarya; NASA/JAXA physical lengths are [Destiny 8.5 m or 9.2 m with CBM](https://www.nasa.gov/sites/default/files/atoms/files/np-2015-05-022-jsc-iss-guide-2015-update-111015-508c.pdf), [Kibo PM 11.2 m](https://iss.jaxa.jp/en/about/kibo/jpm/), and [Zarya 12.6 m](https://www.nasa.gov/wp-content/uploads/2023/04/sp-4012v7.pdf). Exterior appendages and mesh boundaries explain why these are checks, not calibration targets. **VTAD unit interpretation: approximately one metre per scene unit; not independently certified for exact attachment metrology.**

IGOAL's 2024 FBX reports `UnitScaleFactor=1`, +Z up, front -Y, coord +X, and a root scale of 100. The 2026 FBX reports `UnitScaleFactor=100` (the [Autodesk FBX scale factor is relative to centimetres](https://help.autodesk.com/cloudhelp/2018/ENU/FBX-Developer-Help/cpp_ref/class_fbx_system_unit.html)), the same axis metadata, an identity root, and 0.0254 local scale on principal component nodes. Several source component translations match the 2024 values under a 0.0254 factor and X-axis half-turn, but nested iROSA local translations are retained under scaled ancestors. FBX metadata alone therefore cannot be applied as a flat scale to all descendants. The named 2024 GLB has root scale `[-0.0025816829875]` on all three axes; its 7.463 × 3.113 × 10.093 scene bounds are plainly a presentation scale, despite glTF's metre convention. The flattened 2026 Science GLB has 73.422 × 30.626 × 108.293 scene bounds, but this whole-station span is only a secondary check because configurations and arrays differ.

The 0.0254 source-revision factor divided by the named GLB root magnitude yields an **independent candidate** `IGOAL-GLB-world → source-metre-like` scale of **9.838543**. At that factor IGOAL's direct principal extents become Destiny 9.285 m, [Columbus 6.898 m versus ESA's 6.871 m module](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/European_Columbus_laboratory), Kibo PM 11.771 m, and Zarya 12.755 m. This supports an approximately physical interpretation of the newer FBX, but does not certify every mesh or transform. In particular Columbus VTAD's 9.100-unit direct mesh includes a different exterior boundary, and IGOAL Zvezda's 30.763 m direct maximum includes wings versus VTAD's 14.730-unit mesh.

| Verified component | VTAD longest direct extent | IGOAL longest scene extent | VTAD/IGOAL ratio |
| --- | ---: | ---: | ---: |
| Unity | 6.143 | 0.5955 | 10.316 |
| Destiny | 10.018 | 0.9437 | 10.616 |
| Harmony | 7.277 | 0.7346 | 9.907 |
| Tranquility | 7.277 | 0.7412 | 9.817 |
| Columbus | 9.100 | 0.7011 | 12.980 |
| Kibo PM | 11.442 | 1.1964 | 9.564 |
| Zarya | 13.414 | 1.2964 | 10.347 |
| Zvezda | 14.730 | 3.1268 | 4.711 |
| Poisk | 4.876 | 0.4155 | 11.736 |
| Rassvet | 6.969 | 0.6188 | 11.262 |
| Cupola | 2.693 | 0.2640 | 10.202 |

All eleven ratios: mean **10.132**, median **10.316**, range **4.711–12.980**, spread **8.269**, maximum deviation from median **5.605**. This spread is too large to verify a uniform scale from component extents. The independent 9.838543 factor and the seven-anchor similarity fit (10.371281) differ by **5.4%** relative to the independent factor. **Scale decision: `UNIFORM_SCALE_APPROXIMATE`.** No anisotropic scale was justified or applied; varying mesh membership is a more credible immediate explanation for the extremes than proven nonuniform source scaling.

## Axis, handedness and root transforms

VTAD's relevant nodes inherit translations and an identity root; no root reflection is present. The 2024 IGOAL GLB's `SSREF_IGOAL` root has zero translation/rotation and equal **negative** scales of `-0.0025816829875`, so its root linear determinant is negative. Its common module nodes are direct children of that root with their own rotations and translations. iROSA nodes instead inherit legacy-array and beta-rotation ancestors. The 2026 FBX keeps `SSREF_IGOAL` at identity with physical-looking principal node transforms; the 2026 Science GLB has identity root but no named hierarchy. The FBX +Z to GLB +Y export rotation and the negative named-GLB root must be included in every effective world matrix. The negative root is a parity inversion, not evidence of negative physical length or an ISS body frame.

The numerical source-scene-to-VTAD fit with parity allowed has approximately `x_V ≈ -z_I`, `y_V ≈ y_I`, `z_V ≈ -x_I`. This is an **empirical asset-basis relation**, not an authoritative forward/up/body-frame contract. The fitted IGOAL-world rotation has determinant -1 because the IGOAL root already reflects; after removing that root, `-R` has determinant +1. The proper-rotation-only world fit produced 5.96 VTAD-unit holdout RMS, compared with 0.785 for the parity-aware fitted scale, which independently exposes the root-reflection issue. No visual axis tuning was used.

## Numerical registration and holdout

The script uses a named-center Umeyama least-squares similarity fit. It computes the covariance SVD and tests both determinant +1 and -1 mappings; translation is the mean-center offset. No ICP or visual clicking was used. The **diagnostic fitted-scale** parity-aware mapping is:

```text
VTAD ≈ 10.371281 × R × IGOAL_GLb_WORLD + T
R = [[ 0.00799246, 0.01209398,-0.99989492],
     [ 0.01680345, 0.99978405, 0.01222695],
     [-0.99982687, 0.01689941,-0.00778751]]   det(R) = -1
T = [-0.20596737, 5.38390558, 4.81724947]
```

For the independently inferred **9.838543** scale, the same covariance rotation and a re-estimated translation give `T = [-0.19111982, 5.13073092, 4.68420106]`. Relative to the IGOAL GLB's pre-root coordinates, the latter has a proper rotation `-R` and factor **0.0254**, but it remains an estimated cross-asset placement. These transforms are recorded to make the failed gate reproducible; they must not be put into production.

The independent-scale fit center residuals for the seven training components are Unity 0.468, Destiny 0.342, Harmony 0.809, Columbus 1.318, Zarya 0.926, Zvezda 1.440 and Kibo PM 0.797 VTAD units (RMS **0.948**, maximum **1.440**). The fitted scale improves training RMS to **0.511** but disagrees with the independent scale check. Holdout results below use the independent scale. Treat VTAD units as approximately metres, subject to the caveat above. AABB IoU compares bounding volumes of the transformed direct IGOAL mesh and VTAD direct mesh; it is not mesh-surface overlap. Principal-axis angles are omitted for near-symmetric geometry.

| Withheld verified component | Center residual, approx. m | Residual / VTAD major extent | AABB IoU | Major-axis difference |
| --- | ---: | ---: | ---: | ---: |
| Tranquility | 0.770 | 10.6% | 0.656 | 7.69° |
| Poisk | 1.307 | 26.8% | 0.249 | 13.39° |
| Rassvet | 0.962 | 13.8% | 0.516 | 2.72° |
| Cupola | 0.920 | 34.2% | 0.268 | ambiguous symmetry |

Holdout center RMS is **1.009 m approximately**, maximum **1.307 m**. With fitted scale it is 0.785 m approximately, maximum 1.088 m. The withheld geometry does broadly align, but those errors and the low Poisk/Cupola overlap are far above a justified exact docking-interface tolerance. Source meshes and static poses differ; no formal interface landmarks or measurement uncertainty were provided. **Transform gate: `IGOAL_VTAD_TRANSFORM_APPROXIMATE`.** This is insufficient for production attachment. Neither a production matrix nor a geometry composite is approved.

## Nauka and Prichal attachment evidence

IGOAL `MLM` node 251 directly owns mesh 242 with five named detail children. NASA's [assembly record](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) and [Prichal docking report](https://www.nasa.gov/blogs/stationreport/2021/11/26/iss-daily-summary-report-11-26-2021/) identify the real MLM/Nauka relationship. In the named 2024 GLB, `MLM`, `Zvezda_SM`, and `Russian_RSNode_DockingModule` are **siblings under `SSREF_IGOAL`**. Their complete source-space relative transforms can be computed without manual placement:

```text
inverse(world(Zvezda_SM)) × world(MLM), pre-root IGOAL units:
[[-1,  0,  0,   44.000],
 [ 0,  1,  0, -554.300],
 [ 0,  0, -1,   -0.000],
 [ 0,  0,  0,    1.000]]

inverse(world(MLM)) × world(Russian_RSNode_DockingModule):
[[ 0,  0, -1,   -0.325],
 [-1,  0,  0, -120.251],
 [ 0,  1,  0,   -0.330],
 [ 0,  0,  0,    1.000]]
```

Applying the independently inferred 0.0254 source-revision factor gives rough translation magnitudes of 14.08 m and 3.05 m respectively. These numbers are **model placement relationships**, not identified docking-plane origins or certified physical attachment offsets. The 2026 FBX retains the same named principal nodes, but its geometry and full world placement were not independently validated against VTAD. **`NAUKA_ATTACHMENT_TRANSFORM_DERIVABLE`** in IGOAL source space only; the VTAD attachment transform is not verified.

For identity, the two FBX revisions and named GLB use `Russian_RSNode_DockingModule` and nine owned child/detail nodes, including docking-port covers. None contains the literal `Prichal`. NASA explicitly calls Prichal the [Russian Node Module / 6R Node Module](https://www.nasa.gov/blogs/stationreport/2021/11/26/iss-daily-summary-report-11-26-2021/), and ESA calls it the [Russian Node Module known as Prichal](https://www.esa.int/ESA_Multimedia/Images/2021/11/Cosmic_pearl). The [NASA station diagram](https://www.nasa.gov/wp-content/uploads/2023/12/iss-2024-calendar.pdf) labels a Russian Node Module by the MLM. Asset nomenclature plus first-party alias and the five-port structural context strongly support the mapping **independently of location**, but no publisher metadata, source comment or repository history explicitly equates the *asset node string* with Prichal. NASA repository history for this directory contains model updates and renames, not an RSNode alias declaration. **`PRICHAL_IDENTITY_STRONGLY_SUPPORTED`**, not verified for automatic semantic mapping. The same-source `MLM → RSNode` matrix is algebraically **`PRICHAL_ATTACHMENT_TRANSFORM_DERIVABLE`**, conditional on identity and a verified global frame; its physical docking interface is not identified.

## Six iROSA source transforms

NASA [documents six installed channels and dates](https://www.nasa.gov/missions/station/new-solar-arrays-to-power-nasas-international-space-station-research/). The named IGOAL GLB and both FBX revisions contain all six **deployed** groups and their modification-kit/detail geometry. Each IGOAL node is a child of the matching legacy-array group, itself under a named beta-rotation node. The local TRS and entire ancestry are recoverable from the source; the asset has zero animations and provides no present operational joint angle. Its static array pose is not current telemetry. Parent and channel labels agree with NASA's [PVM/channel mapping](https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf), but source-local placement cannot cross into VTAD until global registration and legacy-array orientation are verified.

| IGOAL deployed node | Installed channel | IGOAL direct parent | Local translation, glTF scene-parent units | Local quaternion `xyzw` | Confidence |
| --- | --- | --- | --- | --- | --- |
| `IROSA_Deployed_P62B` | P6/2B | `P6_2B_Array` | `[-0.743, 85.330, -53.924]` | `[0, 1, 0, 0]` | identity corroborated; source-local transform explicit, VTAD unresolved |
| `IROSA_Deployed_P64B` | P6/4B | `P6_4B_Array` | `[-0.739, 85.412, -53.831]` | `[0, -0.7071, 0, 0.7071]` | identity corroborated; source-local transform explicit, VTAD unresolved |
| `IROSA_Deployed_P44A` | P4/4A | `P4_Array_4A` | `[-54.287, 85.342, 0.522]` | `[0, -0.7071, 0, 0.7071]` | identity corroborated; source-local transform explicit, VTAD unresolved |
| `IROSA_Deployed_S43A` | S4/3A | `S4_Array_3A` | `[-53.916, 85.442, 0.269]` | `[0, 0, 0, 1]` | identity corroborated; source-local transform explicit, VTAD unresolved |
| `IROSA_Deployed_S41A` | S4/1A | `S4_Array_1A` | `[-54.416, 85.049, -0.037]` | `[0, -0.7071, 0, 0.7071]` | identity corroborated; source-local transform explicit, VTAD unresolved |
| `IROSA_Deployed_S61B` | S6/1B | `S6_1B_Array` | `[-53.769, 85.442, 0.587]` | `[0, 0, 0, 1]` | identity corroborated; source-local transform explicit, VTAD unresolved |

**`IROSA_TRANSFORMS_PARTIALLY_VERIFIED`**: source hierarchy and channel identity are supported, while the global VTAD transform, matching legacy-array pose and precise attachment interfaces are not. Do not place six arrays by eye or transfer these static poses as real-time state.

## Pirs and future provenance

`PIRS_REMOVAL_DETERMINISTIC` still holds. VTAD source node 0 is a leaf under Zvezda node 22, owns mesh 0 exclusively, and its four POSITION accessors are not used by neighboring meshes. A future build could omit the node and prune now-unused mesh/accessor data while preserving Zvezda sibling geometry. Pirs remains in the production model during this research. No temporary composite was generated because the transform gate did not pass.

A future **build-time** configuration manifest should record a build ID, configuration reference date and evidence status; base VTAD URL/hash; ordered operations (including an explicit Pirs omission rule); each imported component's publisher, source URL/hash, source node identity, source frame/unit contract, full transform and derivation/validation evidence, semantic ID and configuration status; tool versions and commands; and output hash. Per-component provenance must distinguish NASA VTAD base geometry from NASA/JSC IGOAL source geometry and from project-computed transforms. The runtime has no dependency on this proposal.

## Decision

`CURRENT_VTAD_REMAINS_UNMODIFIED`. The fit is approximate, the latest FBX geometry was not numerically registered, docking interfaces remain unidentified, and RSNode identity is strongly supported but not publisher-explicit. `KEEP_CURRENT_VTAD` remains the production strategy. This research does not cross the project ADR threshold because it introduces no accepted structural dependency or production integration decision.

**Next single milestone:** obtain a NASA/JSC model-coordinate or attachment-interface contract, with explicit RSNode identity and checkable control points for the 2026 FBX; rerun independent-scale registration and holdout validation against those controls before any geometry build.

## Authoritative frame/interface search — 2026-09-30

The [reference-frame and interface evidence matrix](iss-geometry-reference-frames.md) records the NASA/JSC asset lineage, Blender/FBX/glTF/USDZ metadata, NASA ISS structural frames, physical control-point definitions, Russian-segment attachment topology and each of the six installed iROSA mast-canister parents. The 2024 FBX→named GLB child-axis conversion is a proper rotation; the named GLB's negative uniform root scale is a separate parity inversion. The original authoring scene and the purpose of that root transform remain unknown. The 2026 FBX declares metre units, but its principal component scales near 0.0254 and absent publisher frame contract leave an exact IGOAL→VTAD unit relation unresolved. VTAD's USDZ variant has a separate 2.6788483 root scale and no authored stage metrics; its GLB has no engineering origin declaration.

NASA's published structural controls include an S0 trunnion-derived analysis origin and Destiny aft CBM axis, and a publicly accessible ISS Program frame standard describes module interface frames. Neither NASA asset has a reproducibly identifiable, matched set of those interface centers. The frame standard's cover also restricts use outside ISS Program purposes; it is documented for discovery and cannot approve production placement. Operational LVLH/XPOP and the station analysis frame were not equated with a Blender scene frame. NASA operations reports independently corroborate MLM=Nauka, the real SM-nadir→Nauka→Prichal chain, and all six iROSA legacy-array parents; they do not supply asset-specific docking matrices. No explicit publisher mapping of `Russian_RSNode_DockingModule` to Prichal was found.

**Conditional Phase 2:** not run. The new evidence does not constrain a common, extractable control point, VTAD origin, exact cross-asset scale, or cross-asset axis map. Re-fitting old mesh centers would only produce another diagnostic matrix. The previous numerical values and four holdouts above remain the last registration result; no new transform or residual is claimed.

**Updated gate:** `UNIFORM_SCALE_APPROXIMATE`; `IGOAL_VTAD_TRANSFORM_APPROXIMATE`; `NAUKA_ATTACHMENT_TRANSFORM_DERIVABLE`; `PRICHAL_IDENTITY_STRONGLY_SUPPORTED`; `PRICHAL_ATTACHMENT_TRANSFORM_DERIVABLE`; `IROSA_TRANSFORMS_PARTIALLY_VERIFIED`; `CURRENT_VTAD_REMAINS_UNMODIFIED`. `KEEP_CURRENT_VTAD` remains the production strategy. No geometry build is authorized by this evidence.
