# Computed Over country classification

Over classifies the accepted physical WGS84 PositionSnapshot against a fixed local cartographic catalog. Earth and ISS Inspection share one result and one persistent PositionStatusBar. It is a **computed geographic classification**, never onboard telemetry or an improvement to orbital quality. Latitude/longitude use full precision, independent of their three-decimal presentation, camera pose and Overview's 75 km model lift.

## Ownership and lifecycle

App passes one position context to PositionReadouts and useOverCountry. The tiny acceptedPhysicalPosition helper preserves the existing active-buffer, source, accepted-time and finite-coordinate checks; geography also rejects latitude outside ±90° or longitude outside ±180°. Current follows the existing approximately 1 Hz physical callback. Historical follows only coherentHistoricalState at the presented UTC, including during pending/rapid seeks. Source selection and OEM→GP fallback remain owned by existing orbital code. View/camera changes are not lookup dependencies.

After initial render, one module-level promise fetches the same-origin version/hash-named JSON, checks byte length and SHA-256, validates its schema/inventory and decodes rings to Int32Array. Success and failure are cached for the application lifecycle. No geography timer, retry loop, async point request, scene-frame hook, worker, backend endpoint, database or GIS runtime dependency is added. The installed release is used for Historical; historical borders, names and flags are not reconstructed.

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
| no-country | — |
| ambiguous-boundary | —; candidates retained internally |
| invalid-position | — |
| dataset-loading | — |
| dataset-unavailable | —; one console diagnostic, no automatic refetch |

Catalog or flag failure does not block the coordinates or scene. No-country does not become “International waters”. A successful country lookup never changes orbital quality/freshness/provenance.

The neutral SVG squircle shell remains **28×24 CSS px**, using the existing graphite control surface and a restrained #728498 border at 65% opacity, 0.8 px. Artwork now occupies the full mark box and is clipped by the same squircle path, with the outline drawn above it. Rectangular flags use proportional object-fit:cover: peripheral artwork may be cropped to fill the badge, without stretching or recoloring. Intrinsic square/portrait artwork automatically uses object-fit:contain with a 1 px safety inset; Switzerland remains square and Nepal keeps its transparent double pennon at a larger size. This fitting rule reads loaded image dimensions, without country-specific styling, new requests or timers. Source SVG bytes are unchanged. No filter, shadow or animation is added. This supersedes the original 20×16 px contained artwork box with 4 px inset.

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
