# Computed Over country and marine classification

Over classifies the accepted physical WGS84 PositionSnapshot against fixed local country and marine cartographic catalogs. Earth and ISS Inspection share one result and one persistent PositionStatusBar. It is a **computed geographic classification**, never onboard telemetry or an improvement to orbital quality. Latitude/longitude use full precision, independent of their three-decimal presentation, camera pose and Overview's 75 km model lift.

## Ownership and lifecycle

App passes one position context to PositionReadouts and useOverLocation, which retains the unchanged useOverCountry as its authoritative first stage. The tiny acceptedPhysicalPosition helper preserves the existing active-buffer, source, accepted-time and finite-coordinate checks; geography also rejects latitude outside ±90° or longitude outside ±180°. Current follows the existing approximately 1 Hz physical callback. Historical follows only coherentHistoricalState at the presented UTC, including during pending/rapid seeks. Source selection and OEM→GP fallback remain owned by existing orbital code. View/camera changes are not lookup dependencies.

After initial render, independent module-level promises start both same-origin version/hash-named assets in parallel. Each checks byte length and SHA-256, validates its schema/inventory and decodes rings to Int32Array. Success and failure are cached independently for the application lifecycle. Marine readiness never blocks a valid country. No geography timer, retry loop, async point request, scene-frame hook, worker, backend endpoint, database or GIS runtime dependency is added. The installed release is used for Historical; historical borders, names and flags are not reconstructed.

## Geometry and identity

Natural Earth Admin 0 **Map Units 5.1.1, 1:10 million**, geographic WGS84, longitude/latitude degrees, default de-facto geometry is the authority. Paired Countries 5.1.1 supplies canonical English names. The ISO country row where ADM0_A3=ISO_A3_EH wins; otherwise an unambiguous single ISO row is required. This prevents dependencies reusing an ISO code from renaming France, Brazil, Australia or Kazakhstan. Réunion retains Map Units' accented NAME_EN spelling instead of Countries' unaccented spelling, an explicit source-field exception.

Policy `ne10m-5.1.1-iso-rollup-v1` validates ISO2/ISO3 pairs against the checked 249-pair allowlist: UN Statistics M49's 248 pairs plus TW/TWN documented through ISO/W3C first-party references. This registry validates codes, not names, political policy or geometry. Shared valid ISO units roll up, including UK constituents and Belgian units. Greenland, Puerto Rico, French Guiana, Guam, Hong Kong, Réunion and Mayotte retain their own ISO identities. Sovereignty metadata remains provenance, not a display fallback. `-99`, XK and XD exceptions use GU keys and nullable ISO fields; Kosovo may use the source xk artwork without claiming XK is ISO. Antarctica remains in the geometry/catalog with text and no national flag.

The asset preserves every exterior, hole, disconnected island and dateline split. The sole invalid source geometry, Egypt, receives Shapely make_valid/linework before quantization. Original/repaired WKB hashes, validity and equal-area evidence are retained in the manifest. This is topology repair only. Coordinates are quantized at 10⁻⁵ degrees and encoded as per-ring integer XY deltas; no thematic properties or generic GIS object graph enter runtime.

For each disconnected part: bbox rejection, exterior even-odd PIP, hole exclusion, collect all matching identities. Same-identity parts collapse; distinct matches produce ambiguous-boundary with sorted diagnostic candidates. Both equivalent ±180° meridians are inspected. A numerical segment epsilon (~0.1 mm at the equator) handles floating arithmetic; it is not hysteresis. No nearest-country snapping, debounce or sticky country is used.

This cartographic product has bounded coastal, border, microstate and tiny-island detail. A no-match can be omitted land, inland water or a gap, not necessarily ocean. It does not classify legal airspace, territorial waters or survey boundaries. Known source misses remain misses in tests.

## Display and failure contract

| Internal outcome | Over value |
| --- | --- |
| country with available artwork | decorative squircle + canonical name |
| country without artwork / image load error | canonical name alone |
| no-country | enter the marine stage below |
| ambiguous-boundary | —; candidates retained internally |
| invalid-position | — |
| dataset-loading | — |
| dataset-unavailable | —; one console diagnostic, no automatic refetch |

Catalog or flag failure does not block the coordinates or scene. Neither no-country nor no-region means “International waters”. A successful country lookup never changes orbital quality/freshness/provenance.

The mark remains **28×24 CSS px** with the existing squircle clipping path. The container is transparent: there is no background panel or decorative outline. Square and rectangular flags use proportional object-fit:cover across the full mark box with no padding or letterboxing; peripheral artwork may be cropped, without stretching or recoloring. Only intrinsic portrait artwork uses object-fit:contain with a 1 px safety inset, preserving Nepal’s natural transparent double pennon. The rule reads loaded image dimensions (width < height), without country-specific styling, new requests or timers. Source SVG bytes are unchanged. No filter, shadow or animation is added. This supersedes both the original reduced artwork box and the subsequent square/portrait containment rule.

The fixed mark and flexible name share a centered flex row (8 px gap, 6 px on mobile). Text uses Inter 14/18 px, -webkit-line-clamp:2 / line-clamp:2, hidden overflow and max-height:36px. The browser ellipsizes after the second line; overflow-wrap:anywhere bounds unbroken words. Full canonical text stays in the DOM and title, including when visually clamped. The mark is aria-hidden, img alt is empty, and the field adds no button, link, tab stop or live region. The existing four desktop columns / 2×2 mobile arrangement remains.

## Reproducible offline maintenance

Normal npm install/build/runtime never contacts Natural Earth or the flag publisher. Keep downloaded archives and the Python environment **outside Git**. From frontend:

```sh
python3 -m venv /absolute/external/country-maintenance-venv
/absolute/external/country-maintenance-venv/bin/pip install -r scripts/country-data/requirements.txt
# Explicitly acquire the three URLs to their exact filenames in an external source directory.
# URLs, retrieval metadata and mandatory SHA-256 values: scripts/country-data/source-pins.json
/absolute/external/country-maintenance-venv/bin/python scripts/generate-country-assets.py /absolute/external/country-sources
MISSION1_COUNTRY_SOURCES=/absolute/external/country-sources /absolute/external/country-maintenance-venv/bin/python scripts/test-country-assets.py
```

The importer checks hashes before use, version, expected schema/counts, WGS84 degrees, explicit ISO exceptions, all geometry validity/rings/ranges and the selected flag set. Unknown schema, topology, identity or SVG changes fail import. Dependencies are maintenance-only pyshp 3.1.6 / Shapely 2.2.0. The provenance manifest records GEOS version too. Review generated diffs, tests and source terms before accepting a new release; do not hand-edit geometry or SVGs.

Output: public/geo/countries-ne10m-5.1.1-a9501af4086c.delta.json, public/geo/country-provenance-ne10m-5.1.1.json, public/flags/*.svg plus SOURCE.md, and the small src/geo/countryAsset.json descriptor. Source hashes and per-identity source fields are in the manifest; the descriptor alone enters the JS bundle.

## Sources, integrity and rights

| Input | SHA-256 |
| --- | --- |
| [Map Units archive](https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_map_units.zip), retrieved 2026-10-19 | 45bebe2aaf8bf42b9daf4428594925bcb11eabd32fe9dc6e0acf681438053eb5 |
| [Countries archive](https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip), retrieved 2026-10-19 | ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6 |
| [Pinned flag archive](https://codeload.github.com/hampusborgos/country-flags/tar.gz/c09927e63705529bbf59ca6684cd9b23225dddad), retrieved 2026-10-19 | a0e028783137dba7e667b44366723e19dae50dbdfc0def2df653cf2e153cee9c |
| Production geometry | a9501af4086c294e726ac0f0dcb15bda0bff0ca40d7034f8699026f3cb9fadca |

Voluntary attribution: Made with Natural Earth. Publisher [terms](https://www.naturalearthdata.com/about/terms-of-use/) declare public-domain data. Flags are 248 unmodified individually served SVGs from [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags/tree/c09927e63705529bbf59ca6684cd9b23225dddad), commit c09927e63705529bbf59ca6684cd9b23225dddad, package 1.2.10 / PD. SOURCE.md retains the upstream README. Full per-file origin registry, unresolved TODOs, byte size, viewBox and checksum are in the manifest. The registry does not establish independently verified official provenance for every flag; national-symbol restrictions are separate from copyright.

The importer validates passive XML/SVG: no script, events, foreignObject, DOCTYPE/entities, stylesheet processing instructions, external href/src/resources or active/external CSS. Safe internal fragments and local fill/stroke styles are permitted. Bytes are copied unchanged; the whole collection is never inlined into JavaScript.

## Validation and measured cost

Production: 266 identities, 4,292 polygon parts, 552,829 vertices. Geometry is 5,762,275 bytes raw, 2,361,614 gzip9, 2,271,803 Brotli9; exact typed coordinate buffers 4,422,632 bytes plus ordinary catalog object overhead. All 248 flags total 3,470,493 bytes raw, 1,188,531 summed individual gzip9; only a needed flag loads.

Reference Apple M1 / Node 24: ten parse/decode runs mean 26.80 ms, median 25.20 ms, max 52.06 ms. 721 recorded Current-like 1 Hz samples: mean 0.074 ms, median 0.041 ms, p95 0.139 ms, max 0.413 ms. 3,000 synthetic rapid geographic seeks: mean 0.068 ms, median 0.021 ms, p95 0.276 ms, max 0.530 ms. These are desktop measurements, not physical mobile-device claims.

Dedicated import, actual-asset lookup, catalog integrity/failure, shared App Current/Historical/source/fallback/race and mark tests accompany the existing suite. External implementation QA, native Cesium captures at all five widths, network/integrity audits and recorded-track evidence live under /Users/daniel/.codex/exports/mission1-over-country-implementation-2026-10-19/. See [ADR-0027](../adr/0027-local-country-classification-and-squircle-marks.md).


## Marine fallback — accepted 2026-10-19

Only a successful country **no-country** result enters marine lookup. A country,
ambiguous-boundary, invalid-position, country dataset-loading or country
dataset-unavailable returns unchanged without inspecting marine readiness or
polygons. Country/territory/island geometry always wins, including overlapping
marine polygons. Country geometry, ISO policy, naming, flags and squircle remain
unchanged. `data-country-state` keeps the country-stage result independently of
`data-over-state`; marine loading/unavailability additionally carries
`data-geography-dataset="marine"`.

The second asset uses Natural Earth Physical Labels **Geography marine polygons**,
`ne_10m_geography_marine_polys` **5.1.0**, **1:10 million**, geographic WGS84 in
longitude/latitude degree order. Policy `ne10m-5.1.0-macro-v1` explicitly maps all
**305 distinct ne_id values / 306 source records** to a macro or exclusion. The
two Great Barrier Reef records share one source ID and both map to Pacific.
No source-name matching occurs at runtime. The checked policy is
`frontend/scripts/marine-data/macro-rollup.json`; full source fields, mapping,
source/quantized geometry hashes and exclusions stay in the separate provenance
manifest, outside the minimal runtime asset.

| Stable ID | Canonical display name | Priority |
| --- | --- | --- |
| arctic | Arctic Ocean | 100 |
| southern | Southern Ocean | 100 |
| atlantic | Atlantic Ocean | 100 |
| pacific | Pacific Ocean | 100 |
| indian | Indian Ocean | 100 |
| mediterranean | Mediterranean Sea | 200 |
| caribbean | Caribbean Sea | 200 |
| gulf-of-mexico | Gulf of Mexico | 200 |
| arabian | Arabian Sea | 200 |
| red-sea | Red Sea | 200 |
| black-sea | Black Sea | 200 |
| bay-of-bengal | Bay of Bengal | 200 |
| south-china-sea | South China Sea | 200 |
| sea-of-japan | Sea of Japan | 200 |
| persian-gulf | Persian Gulf | 200 |
| caspian-sea | Caspian Sea | 200 |

Atlantic and Pacific intentionally merge the source's northern/southern features,
avoiding an artificial equatorial label transition. Other source features roll
up by the complete approved source-ID mapping: e.g. Adriatic → Mediterranean,
North Sea → Atlantic, Coral Sea → Pacific, Andaman Sea → Indian, Gulf of Oman →
Arabian, and Taiwan Strait → South China Sea. Raw feature names never reach Over.

The nine explicit exclusions are Saint Lawrence River, Lago de Maracaibo, Lake
Pontchartrain, Lagoa dos Patos, Amazon River, Bras d'Or Lake, Ozero Mogotoyevo,
Yangtze River and Columbia River. They receive no automatic ocean fallback.
All source polygons are validated; selected geometry retains every hole,
disconnected part and dateline split, quantized at 10⁻⁵ degrees without repair,
simplification or coastline edits.

Marine lookup uses per-part bbox rejection, exterior/hole PIP and **all matches**.
Same-macro matches collapse. Regional waters (200) win over basin matches (100).
Distinct macros tied at the highest priority yield **ambiguous-marine**; source
order, area, scalerank and lexical order never select a winner. Candidate sorting
only stabilizes diagnostics. Both equivalent ±180° meridians are inspected.
No nearest-region/country snap, retained previous label, hysteresis, debounce or
manual coastline fill hides the known one-second coastal gaps.

| Marine-stage outcome | Over value |
| --- | --- |
| marine-region | canonical text only |
| no-region | — |
| ambiguous-marine | —; tied candidates retained internally |
| dataset-loading (marine) | — |
| dataset-unavailable (marine) | —; cached failure, one console diagnostic |

Marine text shares Inter **14/18 px**, maximum two visible lines, full DOM text
and title with country names. There is no marine flag, squircle, icon, hidden
duplicate name, button, link, tab stop or live region. The existing responsive
four-column / 2×2 bar and all country rendering remain unchanged.

Current follows the existing accepted approximately 1 Hz physical snapshot;
Historical uses only the coherently accepted state at the presented UTC against
the installed fixed names/geometry. Pending/stale requests cannot install a
classification for an unaccepted target. Returning to Current uses Current's
accepted state. No independent position subscription, clock, timer, camera/lift
dependency, per-frame lookup or point request exists. View/source/temporal changes
do not reload either geographic catalog.

### Marine maintenance and provenance

Use the same external maintenance environment and pinned requirements as country
geography. Download the exact URL in `scripts/marine-data/source-pins.json`
explicitly to an external directory; normal install/build/runtime does not fetch
source geography. From `frontend`:

```sh
/absolute/external/country-maintenance-venv/bin/python scripts/generate-marine-assets.py /absolute/external/marine-sources
MISSION1_MARINE_SOURCES=/absolute/external/marine-sources /absolute/external/country-maintenance-venv/bin/python scripts/test-marine-assets.py
```

The importer validates archive hash/length, version, complete DBF schema, WGS84
CRS/order/ranges, approved policy checksum, every source ID/name, intentional
duplicate, geometry validity, quantized topology and exact inventories. Unknown
future IDs or changed source/schema fail import. It emits the runtime asset,
`public/geo/marine-provenance-ne10m-5.1.0.json`, `src/geo/marineAsset.json` and the
16-entry `src/geo/marineRegions.json` registry. No ZIP/shapefile, maintenance
Python environment, research output or browser QA is committed.

| Marine input/output | SHA-256 |
| --- | --- |
| [Source archive](https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_marine_polys.zip), retrieved 2026-10-19T16:36:42.491265Z | a2d3395904c41e718e02c3ec5bc988712164c524c236fad32d95d282ca303b2a |
| `marine-ne10m-5.1.0-d47dce464acf.delta.json` | d47dce464acf345710ef9d0ab3aab753e2beddf6cc62f97c3624de1184766645 |

Made with Natural Earth. The publisher's [public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/)
apply; attribution is voluntary and retained consistently with country geography.
The 10m distribution includes generalized physical-region boundaries with roughly
1:50m source precision. Finite accuracy, coastal gaps and exact-boundary ambiguity
are preserved. This product implies no hydrographic, navigational, legal maritime
zone or territorial-water authority. **No-region does not mean international
waters.** Historical does not reconstruct changes to sea names or boundaries.
Arctic/Southern remain valid catalog identities even though ordinary ISS ground
tracks do not reach them.

Production marine geometry has **16 identities, 297 selected source features,
336 polygon parts, 58,203 vertices**, **681,127 raw bytes**, **272,107 gzip9 bytes**
(Python zlib 1.2.12; Node zlib produces 270,228), **265,461 Brotli9 bytes** and exactly
**465,624 typed coordinate-buffer bytes**, plus ordinary catalog objects. Geometry
is byte-equivalent to the approved prototype; the 4,085-byte raw reduction removes
unused source-ID metadata from runtime. Compression sizes depend on encoder.

On the development Apple M1 / Node 24, 40 runs measured mean parse/decode about
3.12 ms; 14,756 recorded lookups averaged 0.023 ms marine-only and 0.132 ms
country plus gated marine. See external `performance.json` for median/p95/max,
separate parse/decode and synthetic-point costs. These are desktop CPU timings,
not physical mobile measurements. No worker/index/GIS package is warranted.

Importer, lookup/all-16/priority/order/exclusion, country-first, independent-load/
failure, actual-App Current/Historical/race/source and text-only UI tests accompany
the existing country suite. Final production lookup reproduces all **14,756**
approved recorded results with original UTC/provenance, including unchanged
country transitions and known one-second no-region gaps. Seven retained track
evaluations include correlated full/short windows; they are not seven independent
observations. GP state is computed; OEM state is source-provided predicted
state, never live onboard telemetry.

Implementation evidence, actual Cesium Earth/Inspection responsive captures and
network/scope/git audits stay outside Git under
`/Users/daniel/.codex/exports/mission1-over-marine-implementation-2026-10-19/`.
