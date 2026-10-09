# Current ISS geometry assessment

> Historical QA record: generated captures, raw reports and intermediate snapshots were removed during final repository hygiene. See the [artifact policy](qa-artifact-policy.md) for archive recovery and current evidence.

Research checked **2026-09-30**. This record assesses authoritative ways to update the established NASA VTAD production model. It changes no station asset, runtime mapping, model URI, or frontend/backend source. [Candidate metadata](iss-geometry-candidates.json) is research data and is not loaded by the application.

## Decision and evidence boundary

**Strategy: `KEEP_CURRENT_VTAD`.** NASA VTAD remains the MISSION1 production base model. A NASA/JSC IGOAL source family contains post-2021 structural groups, including MLM and six deployed iROSA groups, but is a different asset family, not a demonstrated revision of VTAD. Its coordinate and scale relationship to VTAD, component attachment interfaces, and exact configuration date are unverified. A composited `VTAD_CURRENT_CONFIGURATION_DERIVATIVE` is therefore not approved. This is a decision to retain the current production asset and its temporal disclosure, not a claim that authoritative modern geometry is absent.

The current runtime file is `frontend/public/models/iss-vtad-source-png.glb` (32,735,516 bytes; SHA-256 `ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f`). Its NASA VTAD source GLB is SHA-256 `26dba905b4b7555edbcb0c5f5a61b5c18659f5166076ab27dbb0e64025759fca`. The [model record](iss-model.md), [semantic map](iss-semantic-map.md), and runtime manifest pin the texture-preserving derivative, zero-flash preload, physical asset scale 1, display-only ENU presentation, direct picking, and 14 `VERIFIED` identities. The source page is dated 2019, while its download label is 2023; neither alone dates every represented component. The named Pirs mesh and missing named Nauka, Prichal, and iROSA groups provide stronger configuration markers.

Separate clocks remain separate: **orbital state time ≠ station geometry configuration time ≠ semantic evidence date ≠ Earth night-imagery acquisition time**. The currently displayed orbital state is computed from elements, not live onboard telemetry. The VTAD model is a historical visual reference; component status is separately evidenced. The NASA Black Marble layer is historical 2016 imagery.

## Current structural reference, excluding visiting vehicles

The [NASA assembly elements](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) page supplies component identity and installation history; it is **not** a current attached-hardware list because it also lists removed Pirs. [NASA facts and figures](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) names Prichal as the latest installed module and describes Bishop and the original/iROSA arrays. Individual 2026 status evidence for the 14 selected modules remains in the [semantic map](iss-semantic-map.md). “Installed/listed” below is narrower than a claim of independently audited 2026 pose or payload fit. Source dates in this table are event/report dates where stated; pages were checked 2026-09-30.

| Permanent or semi-permanent element | Agency | Current-status evidence and source date | Geometry relevance |
| --- | --- | --- | --- |
| Unity | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-25 | VTAD verified named mesh. |
| Destiny | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-24 | VTAD verified named mesh. |
| Harmony | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-01 | VTAD verified named mesh. |
| Tranquility | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-08 | VTAD verified named mesh. |
| Cupola | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-04-06 | VTAD verified named mesh. |
| Quest | NASA | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-01 | VTAD verified named mesh. |
| Columbus | ESA | `CURRENT_CONFIRMED`; [ESA identity](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Columbus_laboratory), [semantic status evidence](iss-semantic-map.md) 2026-09-16 | VTAD verified; external platform detail can vary. |
| Kibo Pressurized Module | JAXA | `CURRENT_CONFIRMED`; [JAXA structure](https://humans-in-space.jaxa.jp/en/kibo/structure/), checked 2026-09-29 | VTAD verified separately from EF. |
| Kibo Exposed Facility | JAXA | `CURRENT_CONFIRMED`; [JAXA structure](https://humans-in-space.jaxa.jp/en/kibo/structure/), checked 2026-09-29 | VTAD verified; exposed payloads vary. |
| Permanent Multipurpose Module / Leonardo | NASA | Listed installed in [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/), checked 2026-09-30; exact present pose not independently audited | VTAD node `Leonardo_Raffaello...PMM` is ambiguous and unverified semantically. |
| Bishop Airlock | Nanoracks / NASA station integration | [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) records installation 2020-12-19; [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) lists it, checked 2026-09-30 | Missing as an identified VTAD node; named IGOAL group. |
| Zarya | Roscosmos/NASA partnership | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-05-18 | VTAD verified named mesh. |
| Zvezda | Roscosmos | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-24 | VTAD verified named mesh. |
| Poisk | Roscosmos | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-19 | VTAD verified named mesh. |
| Rassvet | Roscosmos | `CURRENT_CONFIRMED`; [semantic evidence](iss-semantic-map.md) 2026-09-16 | VTAD verified named mesh. |
| Nauka / Multipurpose Laboratory Module | Roscosmos | [NASA installation](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) 2021-07-29; listed in current NASA facts/assembly references checked 2026-09-30 | Missing in VTAD; named `MLM` in IGOAL. |
| Prichal docking module | Roscosmos | [NASA installation](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) 2021-11-26; [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) calls it latest installed module, checked 2026-09-30 | Missing in VTAD; IGOAL `Russian_RSNode_DockingModule` identity is ambiguous. |
| Z1, P6, S0, S1, P1, P3/P4, P5, S3/S4, S5, S6 truss structure | NASA | [Assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) and [truss description](https://www.nasa.gov/international-space-station/integrated-truss-structure/), checked 2026-09-30; individual historical installation dates vary | VTAD has named sections; full fragment coverage needs audit. |
| Eight original solar-array wings | NASA | [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) and [upgrade description](https://www.nasa.gov/missions/station/new-solar-arrays-to-power-nasas-international-space-station-research/), checked 2026-09-30 | VTAD has panel/truss geometry, exact wing identities ambiguous. |
| iROSA 2B and 4B | NASA/Boeing | [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) records installation 2021-06-16 and 2021-06-25 | Missing in VTAD; IGOAL has deployed groups. |
| iROSA 3A and 4A | NASA/Boeing | [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) records installation 2022-12-03 and 2022-12-22 | Missing in VTAD; IGOAL has deployed groups. |
| iROSA 1A and 1B | NASA/Boeing | [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) records installation 2023-06-09 and 2023-06-15 | Missing in VTAD; IGOAL has deployed groups. |
| Radiators | NASA | [Truss description](https://www.nasa.gov/international-space-station/integrated-truss-structure/), checked 2026-09-30; exact operational pose not audited | VTAD fragments unverified; IGOAL named groups are static. |
| Canadarm2 | CSA/NASA | [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) and [assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/), checked 2026-09-30 | VTAD fragments unverified; IGOAL SSRMS group pose is static. |
| Dextre | CSA/NASA | [NASA assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/), checked 2026-09-30 | VTAD coverage not determined; IGOAL SPDM group pose is static. |

Crew Dragon, Cargo Dragon, Soyuz, Progress, and Cygnus are **visiting vehicles** and are excluded from the fixed base. Their operational attachment varies. The examined IGOAL model names contain no named visiting vehicle, but this alone does not prove that every unnamed mesh has been classified.

Pirs is a historical diagnostic, not current structure: [NASA recorded its departure on 2021-07-26](https://www.nasa.gov/blogs/spacestation/2021/07/26/progress-77-and-pirs-undocked-from-station/). The assembly page retaining a Pirs entry is an example of why historical lists cannot be read as current snapshots.

## Official asset search and actual inventories

The search first checked the same VTAD page and its glTF/USDZ formats, then NASA/JSC IGOAL revisions and source packages, then missing-component geometry at NASA, ESA, JAXA and Roscosmos. NASA [3D Resources](https://science.nasa.gov/3d-resources/) and the [NASA-owned repository](https://github.com/nasa/NASA-3D-Resources) identify IGOAL as NASA/JSC/Integrated Graphics, Operations, and Analysis Laboratory. NASA VTAD and NASA/JSC IGOAL are **distinct authoring families**. No newer VTAD GLB or USDZ revision was identified in the official pages/repository searched; this is a bounded search result, not proof that no unpublished revision exists. NASA ISS (A), (B), and the 2011 (C) model were already assessed in the [model record](iss-model.md); none is a newer VTAD revision.

All serious downloadable files below were retrieved to `/tmp/mission1-geometry-research-2026-09-30/`, outside `frontend/public/models` and Git. Exact URLs, hashes and archive-member metadata are in the JSON record. Bounds are measured from glTF accessor bounds after node transforms; they are **asset units**, not certified engineering dimensions. Native FBX was inventoried without conversion. No temporary conversion is production approved.

| Official candidate / asset date evidence | Bytes; SHA-256 | Inspected structure and configuration markers |
| --- | --- | --- |
| NASA VTAD `ISS_stationary.glb`; NASA page 2019-04-22, download label 2023-09-09 | 44,495,916; `26dba905b4b7555edbcb0c5f5a61b5c18659f5166076ab27dbb0e64025759fca` | 132 nodes, 131 meshes, 343 primitives, 247,547 triangles; 111.988 × 68.852 × 58.736. Pirs named; no named Nauka, Prichal or iROSA. 26 PNG images, 512²/1024². |
| Same VTAD page, `ISS_stationary.usdz`; download label 2023-09-09; USDC archive member dated 2019-04-15 | 16,741,735; `6f19bec514127dab2a3d7412cc32609beab684b5a2cac78c4bb79eb2044e631d` | USDZ contains one USDC and 26 JPEG texture entries. Binary USDC has a Pirs name token; no evidence of a newer configuration. USDC topology was not decoded, so a GLB-equivalent mesh count is **not determined**. |
| NASA GitHub IGOAL source multipart 7z; FBX member dated 2024-09-11; repository file commit 2025-03-20 | 144,487,381 archive; `a2b9074cdb7930ee0be4c8e566f6e063a59f893709ed1df4223e69b110b9b023`; FBX 159,534,524; `93945391aa0cb809abde8c2cec49faf22c2c792251aea4e01b10558f20453069` | One FBX, 588 `Model` objects, 555 `Geometry`, 128 `Texture`, 121 `Video`, 53 `Material`, zero animation stacks; raw FBX `UnitScaleFactor=1`. Named MLM, Russian docking node, Bishop and six iROSA groups; no named Pirs. Not a VTAD derivative. |
| Same NASA GitHub IGOAL directory, `International Space Station (ISS).glb`; file commit 2025-03-20 | 95,875,648; `57cecfaf332efb2127d07796c4b65ca570d95a11516c8e046feb5a12efee491d` | 588 nodes, 555 meshes, 839 primitives, 2,707,621 triangles, 49 materials, 220 embedded PNG/WebP image entries (110 of each), 512²–4096², zero animations. Bounds 7.463 × 3.113 × 10.093 with root scale `[-0.002581683,...]`: its scene size is not credible as a meter-scale ISS without a separately verified scale correction. Named post-2021 groups match the source FBX. |
| NASA Science IGOAL GLB; page 2025-04-07, HTTP last-modified 2026-05-20 | 64,846,620; `3b03742fb55f2a495c4a72aaa2cb175aaeff5ee38f4f42b95f92083e30a464ef` | Flattened `IGOAL_SSREF`: 1 node, 1 mesh, 45 primitives, 2,975,912 triangles; 73.422 × 30.626 × 108.293. 44 materials; 111 JPEG + 3 PNG images, 512²–2048²; zero animations. No component-level node identity remains. |
| NASA Science IGOAL FBX ZIP; download/member date 2026-05-20 | ZIP 165,633,264; `c76a8c0790431bb03bde8222c23e8407bbbd02b5b322a2d141c57ef9f8bff638`; member FBX 172,389,772; `c3c43b9c48dd12ee9e7bcfed848a1df32730a633399627a532405c23b892e43d` | ZIP contains exactly one FBX, no README or separate license/texture directory. Binary FBX 7400: 702 `Model`, 657 `Geometry`, 116 `Texture`, 111 `Video`, 47 `Material`, zero animation stacks; raw `UnitScaleFactor=100`, up axis index 2. Named MLM, Russian docking node, Bishop and six iROSAs remain. |

The GitHub FBX/GLB have the same 588 model/node names. Against that 2024 FBX, the 2026 FBX has **133 added and 19 removed names**. Added names include detailed berthing fixtures, MLM exterior detail, and payload entries such as CLARREO and CODEX; removed names include some payload and cover variants. The MLM, Russian docking node, Bishop and six iROSA names already occur in the 2024 source. The 2026 file is an actual model revision with more geometry/detail, but its core post-2021 markers are not new to 2026. Neither the 2026 ZIP date nor NASA’s GLB re-export date certifies a 2026 operational configuration. The Science GLB’s 2026 export has more triangles than the GitHub GLB but discards the component hierarchy. The different bounds and root scales prevent treating the two GLBs as interchangeable unit/frame references.

The NASA Science page labels the 2026 FBX ZIP as **93.76 MB**, while the retrieved file is **165,633,264 bytes**; the measured byte count and hash, not the page label, identify the analyzed package.

The 2024 FBX and 2026 FBX are not byte-identical. The 2026 ZIP contains no standalone texture folder; FBX `Video`/`Texture` records were observed, but embedded-media completeness has not been checked in a renderer. No arbitrary FBX/OBJ-to-GLB conversion was needed or performed. The temporary analysis scripts parse GLB/FBX headers and archive entries; they do not modify files or execute bundled content.

Native FBX world bounds and triangulated polygon counts are `NOT_DETERMINED` in this research: the raw FBX unit factors differ, and those values should not be inferred from a separately exported GLB. USDZ USDC node/mesh counts are likewise `NOT_DETERMINED`. The identified model-object counts, named component differences, GLB triangle counts and measured GLB world bounds are direct inspections.

## Component coverage matrix

`PRESENT_VERIFIED` means an explicit asset identity supported by an official component reference and inspectable owned geometry. `ABSENT_VERIFIED` applies to an explicitly missing identifiable group in an old dated source. `PRESENT_BUT_AMBIGUOUS` records a plausible but not uniquely identified group. `NOT_DETERMINED` means the available structure cannot prove coverage. These labels assess **geometry identity**, not current operational status. “IGOAL source” refers to both named FBX revisions and the named GitHub GLB; the flattened Science GLB is separate.

| Component | VTAD | Named IGOAL source | Flattened IGOAL GLB |
| --- | --- | --- | --- |
| Pirs | `PRESENT_VERIFIED` | `NOT_DETERMINED` (no Pirs name; physical absence not proven) | `NOT_DETERMINED` |
| Nauka / MLM | `ABSENT_VERIFIED` | `PRESENT_VERIFIED` (`MLM`) | `NOT_DETERMINED` |
| Prichal | `ABSENT_VERIFIED` | `PRESENT_BUT_AMBIGUOUS` (`Russian_RSNode_DockingModule`) | `NOT_DETERMINED` |
| Eight original array wings | `PRESENT_BUT_AMBIGUOUS` | `PRESENT_VERIFIED` (named per-wing groups) | `NOT_DETERMINED` |
| Six iROSAs | `ABSENT_VERIFIED` | `PRESENT_VERIFIED` (six `IROSA_Deployed_*` groups) | `NOT_DETERMINED` |
| Unity | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Node1`) | `NOT_DETERMINED` |
| Destiny | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`USLab`) | `NOT_DETERMINED` |
| Harmony | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Node2`) | `NOT_DETERMINED` |
| Tranquility | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Node3`) | `NOT_DETERMINED` |
| Cupola | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` | `NOT_DETERMINED` |
| Quest | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Airlock`) | `NOT_DETERMINED` |
| Columbus | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` | `NOT_DETERMINED` |
| Kibo Pressurized Module | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`JEM_PM`) | `NOT_DETERMINED` |
| Kibo Exposed Facility | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`JEM_EF`) | `NOT_DETERMINED` |
| PMM / Leonardo | `PRESENT_BUT_AMBIGUOUS` | `PRESENT_VERIFIED` (`PMM`) | `NOT_DETERMINED` |
| Bishop Airlock | `ABSENT_VERIFIED` | `PRESENT_VERIFIED` | `NOT_DETERMINED` |
| Zarya | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Zarya_FGB`) | `NOT_DETERMINED` |
| Zvezda | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`Zvezda_SM`) | `NOT_DETERMINED` |
| Poisk | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`MRM2`) | `NOT_DETERMINED` |
| Rassvet | `PRESENT_VERIFIED` | `PRESENT_VERIFIED` (`MRM1`) | `NOT_DETERMINED` |
| Major truss | `PRESENT_BUT_AMBIGUOUS` | `PRESENT_VERIFIED` (named segments) | `NOT_DETERMINED` |
| Radiators | `PRESENT_BUT_AMBIGUOUS` | `PRESENT_VERIFIED` (named groups) | `NOT_DETERMINED` |
| Canadarm2 | `PRESENT_BUT_AMBIGUOUS` | `PRESENT_VERIFIED` (`SSRMS` groups) | `NOT_DETERMINED` |
| Dextre | `NOT_DETERMINED` | `PRESENT_VERIFIED` (`SPDM` groups) | `NOT_DETERMINED` |

IGOAL’s named groups and the structural comparison answer a limited question: **yes, NASA/JSC IGOAL includes substantially more post-2021 geometry than VTAD; no, it is not demonstrated to be a newer VTAD revision or a fully current station snapshot.** The science GLB’s flattening prevents reliable per-component extraction from that GLB alone. Community Sketchfab, marketplaces, games and hobby files were not promoted to candidates.

## Missing-component and removal feasibility

### Pirs — `PIRS_REMOVAL_DETERMINISTIC`

VTAD node **0**, `13 Pirs Docking Compartment (DC) and Airlock`, is a leaf under node **22**, `05 Zvezda (SM) Service Module`. It owns mesh **0** exclusively: four direct primitives, 4,872 vertices and 4,467 triangles, with no accessor reused by another mesh. Its transformed direct bounds are 4.227 × 4.804 × 3.913 asset units. A future build can omit that node and its exclusively owned geometry without deleting a verified sibling mesh. This establishes deterministic **Pirs-node removal**, not a verified contemporary docking interface or a complete current Russian segment. Removing Pirs alone while leaving Nauka/Prichal absent is not recommended. The runtime Pirs semantic entry remains intact during this research.

### Nauka and Prichal

Nauka: `AUTHORITATIVE_3D_FOUND` inside NASA/JSC IGOAL as an `MLM` mesh group. NASA calls Nauka the multipurpose laboratory module and records its 2021 installation; ESA also explicitly identifies [Nauka as the MLM](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/European_Robotic_Arm). The GitHub GLB `MLM` node (251) owns mesh 242 and five named detail children. The 2026 FBX adds more MLM detail. This is a source component, not a separately published standalone download.

Prichal: `AUTHORITATIVE_REFERENCE_ONLY` for its specific 3D identity at this gate; the authoritative IGOAL asset contains a **plausible** Russian docking-node geometry group with identity `PRESENT_BUT_AMBIGUOUS`. NASA states Prichal attaches to Nauka; the asset names `Russian_RSNode_DockingModule` plus docking-port cover nodes, but never spells “Prichal.” The GitHub GLB node 405 owns mesh 385 and nine children. [Roscosmos reports an operating passage from Nauka to Prichal](https://www.roscosmos.ru/39868/). A formal asset-to-Prichal identity mapping should be obtained before a new `PRICHAL` semantic ID or production derivative is approved.

Both groups have unique mesh ownership in the named GitHub GLB, but the model’s 7.463 × 3.113 × 10.093 overall units and negative root scale are incompatible with treating its coordinates as already aligned to VTAD. Their per-node translations are in a different, undocumented authoring space. **Nauka: `TRANSFORM_NOT_VERIFIED`; Prichal: `TRANSFORM_NOT_VERIFIED`.**

### iROSA

`AUTHORITATIVE_3D_FOUND` inside NASA/JSC IGOAL, not as an independently published official iROSA file in the searched catalogs. The named source has six deployed groups: `IROSA_Deployed_P62B`, `P64B`, `P44A`, `S43A`, `S41A`, `S61B`, each with details/modification-kit geometry and distinct mesh ownership in the GitHub GLB. NASA’s [assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) verifies six installations and the six electrical channels; the [NASA upgrade explanation](https://www.nasa.gov/missions/station/new-solar-arrays-to-power-nasas-international-space-station-research/) describes the arrays in front of legacy wings. The IGOAL groups are explicitly **deployed** and have zero glTF animations. Exact legacy-wing hinges, joint state, cross-asset placement and solar-array pose over time are not verified. **Each of the six iROSA additions: `TRANSFORM_NOT_VERIFIED`.** Do not build approximate roll-out surfaces from dimensions or photographs.

The bounded official standalone-asset search has a separate outcome from the integrated IGOAL groups:

| Desired component | Integrated authoritative 3D | Separately downloadable official 3D in searched catalogs |
| --- | --- | --- |
| Nauka | `AUTHORITATIVE_3D_FOUND` as IGOAL `MLM` | `SEARCH_INCONCLUSIVE` |
| Prichal | `AUTHORITATIVE_REFERENCE_ONLY` for exact identity; IGOAL `RSNode` is ambiguous | `SEARCH_INCONCLUSIVE` |
| Six iROSAs | `AUTHORITATIVE_3D_FOUND` as six IGOAL deployed groups | `SEARCH_INCONCLUSIVE` |
| Bishop Airlock | `AUTHORITATIVE_3D_FOUND` as an IGOAL named group | `SEARCH_INCONCLUSIVE` |
| Original arrays, radiators, Canadarm2 and Dextre | `AUTHORITATIVE_3D_FOUND` as IGOAL named groups; some also occur in VTAD | `SEARCH_INCONCLUSIVE` |

### Other authoritative searches

| Source and result | Classification / production consequence |
| --- | --- |
| NASA/JSC IGOAL Bishop, PMM, SSRMS, SPDM, truss, radiator and array groups | `AUTHORITATIVE_3D_FOUND` within the integrated source. No VTAD-relative transform was established; `TRANSFORM_NOT_VERIFIED` for each proposed extension. |
| [ESA accessible ISS/Columbus model](https://www.esa.int/ESA_Multimedia/Images/2022/08/Accessibility_3D_model_of_ISS_and_the_Columbus_labororatory) and [exhibition catalog](https://www.esa.int/About_Us/Exhibitions/Ready-to-use_material/Outreach_Material/Exhibition_material_catalogue_-_Cite_de_l_espace_for_ESA) | `AUTHORITATIVE_3D_FOUND`, but a tactile/museum representation with exhibit scale and Cité de l’espace credit, not an engineering exterior source or a missing-component transform. Not promoted as a production candidate. ESA [ERA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/International_Space_Station/European_Robotic_Arm) and Columbus pages provided `AUTHORITATIVE_REFERENCE_ONLY` for this search; no separate production-ready downloadable ERA/Nauka geometry was verified. |
| [JAXA Kibo structure](https://humans-in-space.jaxa.jp/en/kibo/structure/) and [Exposed Facility reference](https://iss.jaxa.jp/en/kibo/about/kibo/jef/) | `AUTHORITATIVE_REFERENCE_ONLY`/`AUTHORITATIVE_2D_ONLY` for geometry; no separately downloadable Kibo/JEM exterior mesh was verified in the searched official pages. The EF reference gives dimensions and interface descriptions, not a VTAD coordinate transform. |
| [Roscosmos operations report](https://www.roscosmos.ru/39868/), [Nauka radiator report](https://www.roscosmos.ru/39807/) and official Russian-segment material | `AUTHORITATIVE_REFERENCE_ONLY` for current structure. Official Roscosmos domain searches in Russian/English found no publicly downloadable Nauka or Prichal mesh. Result is `SEARCH_INCONCLUSIVE` for Roscosmos standalone geometry, **not** “does not exist.” |

## Cross-asset composition gate

The IGOAL FBX hierarchy has useful component ownership, but a production transformation must establish all eight requirements below for **each** imported group. None is satisfied simply by seeing the module in a NASA model.

| Requirement | Current evidence and gap |
| --- | --- |
| Physical scale | VTAD bounds are near physical size; GitHub IGOAL GLB has a negative `-0.002581683` root scale and 7.46-unit span, while Science IGOAL GLB has a 108.29-unit span; FBX revisions report different raw unit factors (1 and 100). No cross-export unit contract was found. |
| Component coordinate frame | IGOAL names `SSREF_IGOAL`; VTAD has no documented equivalent frame/origin/axis contract. The shared acronym is insufficient. |
| Attachment interface | NASA/JAXA/ESA describe structural relationships, but no machine-readable matching interface frame for VTAD and IGOAL was found. |
| Translation and orientation | IGOAL node transforms are relative to its own root. No validated rigid mapping to VTAD was derived. Visual fitting is disallowed. |
| Attachment location | Nauka-to-Zvezda, Prichal-to-Nauka and iROSA-to-channel relationships are evidenced, but exact model-space coordinates in VTAD are not. |
| Geometry identity | MLM and iROSA labels are strong; RSNode-to-Prichal remains ambiguous. Detail/fixture ownership must be audited before extraction. |
| Source provenance | NASA/JSC IGOAL is authoritative as an asset source; file hash, page and organization are recorded. This does not certify physical/current configuration. |
| Current configuration | Pirs absence by name, modern groups and 2026 file dates do not certify every payload, radiator, arm pose or visiting craft at a single UTC time. |

For **Nauka, Prichal, six iROSAs, Bishop, external payloads, and any other IGOAL-to-VTAD extension**, the result is `TRANSFORM_NOT_VERIFIED`. There is no `TRANSFORM_VERIFIED` candidate. A model-space registration computed from imagery or hand tuning would be reproducible but **not authoritative**. A defensible route would need an official common station reference frame or documented interface coordinates, verified source units, and independent validation against multiple fixed shared anchors; a fitted alignment alone is insufficient.

## Usage and future build boundary

NASA’s [media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) explicitly address texture maps and polygon data used in 3D models, permit factual educational/informational use with acknowledgment, forbid implied endorsement, reserve NASA marks, and warn that credited third-party content may require separate rights. The [NASA 3D Resources hub](https://science.nasa.gov/3d-resources/) directs users to those guidelines. A future IGOAL-derived component should carry its own source credit, hash and any third-party logo review. Do not assume ESA or JAXA assets share NASA’s terms: [ESA site terms](https://www.esa.int/Services/Terms_and_conditions) restrict derivative/redistribution without authorization; the tactile model identifies Cité de l’espace and ESA Standard Licence. [JAXA site policy](https://global.jaxa.jp/policy.html) requires source credit and restricts modification/commercial use. No Roscosmos geometry is approved for redistribution by this assessment.

The [NASA/JSC interior model family](https://science.nasa.gov/3d-resources/international-space-station-iss-e-internal/) is a `FUTURE_INTERIOR_MODEL_CANDIDATE`. Its eight-part archive is separate from the exterior update; its 2025 listing and large package do not date a current interior. No interior binary was integrated or used to choose the exterior strategy.

If later evidence clears the transform gate, the **future, separate** build milestone should: freeze official source URLs/bytes/hashes and usage review; specify geometry configuration evidence time; normalize source units/axis only from documented references; validate at least two independent fixed attachment anchors; extract only owned component meshes (including detail/texture dependencies); omit obsolete Pirs only with an audited interface; build a deterministic source-quality composite GLB; generate asset-specific feature metadata while retaining stable application IDs (`DESTINY`, etc.) and introducing `NAUKA`, `PRICHAL`, `IROSA_*` only after identity review; pin output hash; verify textures, bounds, picking, zero-flash preload, Cesium performance, and all frontend/backend regressions; update the semantic and model records. No part of that build is performed here.

A future research/build provenance file such as `issGeometryConfiguration` could carry base source/hash, each component source/hash, verified attachment transform and frame, configuration evidence date, current/historical status, semantic ID-to-feature mapping, converter/version/command, and output hash. It should be a build artifact/manifest only after its fields are evidence-backed; runtime has no dependency on this speculative concept now. The current `KEEP_CURRENT_VTAD` decision does not meet the project ADR threshold because it preserves the accepted asset and introduces no architectural dependency.

**Next single milestone:** obtain an authoritative common-frame or interface-coordinate mapping between NASA/JSC IGOAL and the VTAD source, including a resolved RSNode/Prichal identity and independently checkable scale. Stop that milestone at a documented transform gate; do not compose production geometry until it passes.

## Registration follow-up — 2026-09-30

The dedicated [registration evidence gate](iss-geometry-registration.md) decoded the named 2024 IGOAL GLB, inspected both source FBX transform hierarchies, fitted seven verified common components and withheld four verified components. Its independent source-scale check and component extents support only `UNIFORM_SCALE_APPROXIMATE`. The required parity-aware fit leaves approximately 1.009 m holdout-center RMS at the independent scale, with no matched docking-interface frame; its classification is `IGOAL_VTAD_TRANSFORM_APPROXIMATE`. A production geometry composition is still not approved. NASA's Russian Node Module/Prichal alias raises the RSNode asset hypothesis to `PRICHAL_IDENTITY_STRONGLY_SUPPORTED`, short of an explicit asset-node declaration. Source-local Nauka and Prichal placement is derivable, and six iROSA source-local groups are traceable, but VTAD attachment remains unverified. `KEEP_CURRENT_VTAD` and the production VTAD base are unchanged. The current extension gate is `CURRENT_VTAD_REMAINS_UNMODIFIED`.

The subsequent [NASA frame/interface search](iss-geometry-reference-frames.md) found physical station, CBM, Russian-module and mast-canister frame definitions and verified all six iROSA parent locations from NASA operations records. It found no author-declared IGOAL↔VTAD frame contract or matching control points reproducible in both assets. The 2024 IGOAL GLB negative root is separate from the proper FBX→glTF axis conversion; its authoring cause remains unknown. No registration rerun was justified, and the above classifications and current VTAD decision remain in force.
