# ISS VTAD semantic map

Reviewed 2026-09-29. The [132-node review matrix](iss-semantic-review.json) is the complete per-node audit: exact asset name, node index, mesh index, investigation class, mapping outcome, evidence links and date, configuration status, and reason for leaving a node unmapped. The [runtime manifest](../../frontend/src/cesium/issModelManifest.json) is the application source of verified identities; this document does not drive runtime behavior.

## Evidence rules

- `VERIFIED` requires an explicit name or unambiguous designation in the pinned NASA GLB and an authoritative NASA, ESA, or JAXA reference for the real component. The node name is the asset-to-geometry evidence; the external source establishes the real-world identity. Visual resemblance and proximity are never used.
- `PARTIALLY_VERIFIED` is reserved for a useful but incomplete identity. None was promoted. All other geometry remains `UNMAPPED`.
- Configuration is independent: `CURRENT_CONFIRMED` requires dated contemporary evidence, `REMOVED_FROM_CURRENT_STATION` requires an explicit removal record, and `CURRENT_STATUS_UNVERIFIED` avoids claims that an assembly-history page cannot support. The NASA Station Overview has a [19 September 2026 configuration image](https://www.nasa.gov/international-space-station/space-station-overview/), but its page text identifies visiting craft rather than every module. The [assembly inventory](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) still includes Pirs and therefore is not a current attached-configuration list.
- `identityVerifiedOn` is the review date. `configurationEvidenceDate` is the date of the event or current report, except JAXA’s active Kibo structure page, for which it is the 2026-09-29 access date. Where no individual current report is available, use `CURRENT_STATUS_UNVERIFIED`.

## Inventory disposition

The asset has **132 named nodes**: **44 clear candidates**, **48 ambiguous names**, **38 generic geometry nodes**, and **2 technical nodes**. These are investigation classes, not evidence grades. **14 verified** nodes are in the runtime manifest (3 retained, 11 added); **118 remain unmapped**. No partially verified feature is selectable.

## Verified components

| Semantic ID | Asset node (index) | Feature / code | Type | Configuration | Identity and configuration evidence |
| --- | --- | --- | --- | --- | --- |
| `DESTINY` | `09 Destiny Space Laboratory` (97) | 0 / 1 | Laboratory module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/24/advanced-health-tech-research-continues-to-protect-astronaut-health/) (2026-09-24) |
| `COLUMBUS` | `27 Columbus Space Laboratory` (84) | 1 / 2 | Laboratory module | `CURRENT_CONFIRMED` | [identity](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Columbus_laboratory); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/16/cargo-mission-and-crew-13-updates-station-research-maintenance-continue/) (2026-09-16) |
| `HARMONY` | `26 Harmony Node 2` (95) | 2 / 3 | Node module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/harmony-module/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/01/esa-nasa-astronauts-suit-up-for-navigation-science-maintenance-spacewalk/) (2026-09-01) |
| `PIRS` | `13 Pirs Docking Compartment (DC) and Airlock` (0) | 3 / 4 | Docking compartment | `REMOVED_FROM_CURRENT_STATION` | [identity](https://www.nasa.gov/international-space-station/pirs-docking-compartment/); [configuration](https://www.nasa.gov/blogs/spacestation/2021/07/26/progress-77-and-pirs-undocked-from-station/) (2021-07-26) |
| `POISK` | `34 Poisk (MRM-2) Mini Research Module` (1) | 4 / 5 | Mini research module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/19/progress-96-cargo-spacecraft-docks-to-station-to-resupply-crew/) (2026-09-19) |
| `ZVEZDA` | `05 Zvezda (SM) Service Module` (22) | 5 / 6 | Service module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/24/advanced-health-tech-research-continues-to-protect-astronaut-health/) (2026-09-24) |
| `RASSVET` | `39 Rassvet (MRM-1) Mini Research Module` (23) | 6 / 7 | Mini research module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/16/cargo-mission-and-crew-13-updates-station-research-maintenance-continue/) (2026-09-16) |
| `ZARYA` | `01 Zarya - (FGB) Funtional Cargo Block` (24) | 7 / 8 | Functional cargo block | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/05/18/crew-unloads-dragon-and-begins-new-space-experiments/) (2026-05-18) |
| `KIBO_EXPOSED_FACILITY` | `33 Kibo Space Laboratory Exposed Platform` (92) | 8 / 9 | External experiment facility | `CURRENT_CONFIRMED` | [identity](https://humans-in-space.jaxa.jp/en/kibo/structure/); [configuration](https://humans-in-space.jaxa.jp/en/kibo/structure/) (2026-09-29) |
| `KIBO_PRESSURIZED_MODULE` | `30 Kibo Space Laboratory (PSM) Pressurized Module` (94) | 9 / 10 | Laboratory module | `CURRENT_CONFIRMED` | [identity](https://humans-in-space.jaxa.jp/en/kibo/structure/); [configuration](https://humans-in-space.jaxa.jp/en/kibo/structure/) (2026-09-29) |
| `QUEST` | `12 Quest Airlock` (99) | 10 / 11 | Airlock | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/01/esa-nasa-astronauts-suit-up-for-navigation-science-maintenance-spacewalk/) (2026-09-01) |
| `CUPOLA` | `38 Cupola` (109) | 11 / 12 | Observation module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/04/06/crew-kicks-off-week-prepping-for-cygnus-cargo-mission/) (2026-04-06) |
| `TRANQUILITY` | `37 Tranquility Node 3` (110) | 12 / 13 | Node module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/08/astronaut-health-lunar-and-earth-photography-fill-crews-research-schedule/) (2026-09-08) |
| `UNITY` | `02 Unity Node 1` (112) | 13 / 14 | Node module | `CURRENT_CONFIRMED` | [identity](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/); [configuration](https://www.nasa.gov/blogs/spacestation/2026/09/25/nasa-northrop-grumman-complete-cygnus-xl-space-station-reboost-2/) (2026-09-25) |

The Kibo Pressurized Module and Exposed Facility are separate children of the wider Kibo/JEM facility. Neither is flattened into an all-of-Kibo identity. The asset names `Kibo Space Laboratory Exposed Platform` and `Kibo Space Laboratory (PSM) Pressurized Module` are used only at their explicit element level. Pirs remains selectable as geometry in the historical source asset, while its panel states its 2021 removal. No module-specific live telemetry or attitude is inferred.

## Deliberately unmapped high-value nodes

- Node 85, `Kibo Space Laboratory (PSM) Pressurized Stowage Module`: the model designation conflicts with JAXA’s `Experiment Logistics Module-Pressurized Section (ELM-PS)` terminology. It is a strong candidate, but its exact identity is not silently substituted.
- Node 111, `Leonardo_Raffaello Perm Multi-Purpose Logistics Module (PMM)`: the label combines Leonardo and Raffaello names. Its PMM identity is left unresolved rather than choosing one.
- Canadarm2, Dextre, truss and array assembly nodes: several named fragments represent each larger system; direct ownership does not by itself establish complete component coverage. Numbered child nodes and generic solar panels remain untagged.
- PMA, ESP, ELC, AMS and other explicit structures: identifiable candidates remain documented in the complete matrix. Their selection is deferred until element-specific external references and representative browser picks are reviewed.
- RapidScat, CATS, OCO-3 and ECOSTRESS are payloads outside this fixed-station-element milestone. Their names do not create a current station-module claim.
- The source model has no identifiable Nauka, Prichal, or iROSA nodes. No replacement geometry was created.

## Temporal and presentation boundary

The orbital position is a current request-time **computed propagation** from the backend’s latest accepted elements. The station geometry is the older **NASA VTAD source-model configuration**; its original page is dated 2019 and its download listing was updated in 2023. Configuration status is a separately evidenced component assessment. Live module telemetry and spacecraft attitude are **unavailable**. The Earth-view size enhancement is **not to scale**.

## Reproduction and limitations

The manifest’s stable semantic IDs do not depend on node or feature numbers. Its `nodeIndex`, `nodeName`, `featureId`, and `moduleCode` are asset-specific. The [enrichment script](../../frontend/scripts/add-verified-module-features.py) reads verified entries in manifest order, pins the WebP base hash, verifies exclusive mesh ownership, and tags only directly owned primitives. The first three feature IDs remain 0/1/2. Unknown and unmapped hits never resolve via a nearest-node fallback. The [model record](iss-model.md) holds the byte hashes, validation and browser acceptance record.
