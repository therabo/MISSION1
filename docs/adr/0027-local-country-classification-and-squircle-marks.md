# ADR-0027: Local geographic classification and country flag artwork

- Status: Accepted
- Date: 2026-10-19
- Scope: shared Earth/Inspection Over field; frontend geographic classification only

## Context

The shared Latitude / Longitude / Altitude / Over bar already consumes one accepted physical WGS84 state in Current and Historical. Over needs deterministic country/territory classification with preserved source/time availability and no second orbital pipeline. The completed external analysis measured Natural Earth scales, lookup strategies and flag systems. The initial 2026-10-19 instruction superseded its hexagonal visual recommendation with a squircle shell. The accepted 2026-10-20 visual refinement removes that shell entirely in favor of native flag geometry. Country names remain limited to two visible lines.

## Decision

Use pinned Natural Earth **Admin 0 Map Units, 1:10 million, product 5.1.1**, default de-facto geometry. Use paired Countries 5.1.1 only for the documented English naming join: prefer the ADM0_A3=ISO_A3_EH country row, otherwise require a unique ISO row. Preserve Map Units’ accented Réunion NAME_EN as an explicit source-field spelling exception. Offline maintenance verifies archive hashes/schema/WGS84, repairs the known Egypt self-intersection with Shapely make_valid/linework, validates quantized geometry, preserves all parts/holes/dateline splits, and generates flat integer-delta JSON. A checked ISO2/ISO3 allowlist validates `_EH` pairs; shared valid ISO map units roll up to one identity. Territories with their own ISO remain distinct. Missing `-99`, user-assigned XK and source pseudo-code XD are explicit exceptions with nullable real ISO fields. Retain GU/NE/admin/sovereignty/breakaway evidence in the provenance manifest; sovereignty is not a display fallback.

Load/decode the static geometry once after initial render, outside the main JS bundle. Apply per-disconnected-polygon bounding boxes and exterior/hole point-in-polygon; collect all matches and collapse the same normalized identity. Multiple distinct matches are ambiguous, never resolved by array order. No nearest-country snapping. No runtime GIS package, external geocoder, backend route, worker, grid/R-tree, country polling timer or render-frame lookup.

Derive the country result from the same accepted physical snapshot and availability/time/source contract as the coordinates: approximately 1 Hz Current, immediately on accepted Historical/source/availability changes. Pending Historical seeks keep only the previous coherently presented context. No country debounce, grace period or sticky cache. Camera position, model display lift and source-display retargeting are excluded.

Use individual local unmodified SVGs from **hampusborgos/country-flags c09927e63705529bbf59ca6684cd9b23225dddad**. Validate passive content at import. Preserve per-file origin registry/checksums and its incomplete-origin caveats; the publisher's public-domain claim is not a universal ruling on national-symbol use. The 2026-10-20 visual refinement displays the original SVG directly as one decorative image, 24 CSS px high with automatic intrinsic width and object-fit:contain. Remove both squircle wrappers, clipping/masks, fixed-width box, cover fitting, portrait inset and image-load ratio state. No border, outline, background, padding, rounding or frame is added. Rectangles retain native proportions; Switzerland and Vatican remain square; Nepal keeps its transparent double pennon. The whole flag remains visible without cropping or stretching. Source artwork bytes and the local SVG strategy remain unchanged; no country-specific exception, recoloring, emoji or remote CDN. Text is primary, decorative mark aria-hidden, no new interaction. Names use at most two visible lines with ellipsis and retain the full canonical text/title semantically.

Country-only V1 displays — for no match, ambiguity or unavailable input/catalog, with distinct internal diagnostic variants. A valid identity with missing artwork retains its text. Antarctica remains a generic source identity without an invented national flag. Historical position uses the installed fixed geography/name/artwork release, not historical political cartography.

## Alternatives considered

110m/50m lose material microstate/coast/island detail; 10m improves those cases within modest measured runtime cost. Higher-resolution and other boundary products change provenance, licensing and political/overlap policy; no substitution is needed for this bounded V1. Runtime reverse APIs add network latency, quotas, mutable semantics and privacy exposure; a self-hosted geocoder adds unjustified services. Grid/R-tree/current-country caches save insignificant CPU at the existing cadence. The earlier shared hexagonal/squircle shapes and full-bleed cover fitting are superseded by the 2026-10-20 native-geometry decision: they crop source artwork or impose a common shape. A single fixed height with intrinsic width preserves complete flags and removes obsolete presentation logic.

## Consequences

The local encoded asset costs about 5.8 MB raw / 2.35 MB gzip and exactly 4,422,632 bytes of typed coordinate buffers plus ordinary catalog object overhead. Ordinary lookup is sub-millisecond; initialization and physical mobile performance must be measured separately. Cartographic scale is not positional accuracy: some border/coast/islet and gazetteer points remain mismatched. This is a **computed geographic classification** of accepted physical ISS state, not measured telemetry, legal airspace, territorial waters or survey-grade geography. Successful lookup never upgrades orbital quality/provenance. Pinned catalogs require explicit import review to change.

Source/hash/repair/identity/flag evidence, reproducible maintenance instructions and failure/QA contracts are in [the country asset record](../frontend/over-country.md). Existing backend, orbital/source/time, Cesium/camera, asset and data boundaries remain unchanged.


## Accepted marine extension — 2026-10-19

The approved marine analysis extends this same geographic-classification owner;
no separate ADR, service or position pipeline is needed. Preserve the entire
accepted country implementation. Only its successful **no-country** result can
enter a second, independent local Natural Earth Physical Labels **Geography
marine polygons 5.1.0 / 10m** catalog. Country identity and all country diagnostics
return unchanged before marine state/geometry is inspected.

Keep the asset separate: measured merged compression provides no useful saving
and would couple readiness, integrity, provenance and release/cache identity.
Start both verified cached promises in parallel after initial render; marine
readiness never blocks a country, and failure remains cached independently.
The offline importer pins the approved archive SHA-256, validates version/schema/
WGS84/all IDs and topology, preserves holes/parts/dateline geometry and emits
10⁻⁵-degree ring deltas plus a complete separate source/rollup manifest.

Use exactly the approved 16 stable macro IDs and explicit 305-source-ID mapping,
including nine exclusions. Atlantic/Pacific remain unsplit North/South. Lookup
collects every bbox/PIP/hole match, collapses same-macro duplicates, then applies
regional priority 200 over basin priority 100. Distinct highest-priority ties are
ambiguous-marine; feature order never chooses a winner. No nearest-region snap,
hysteresis, retained prior label or gap-filling is allowed. No-region/ambiguity/
marine loading/unavailability display — with distinct internal diagnostics.

The application-level derivation consumes the unchanged country hook and same
accepted physical snapshot as coordinates: existing approximately 1 Hz Current
and coherent accepted Historical state. No new clock, timer, frame callback,
camera dependency or source selection. Historical uses the fixed installed
country/marine release; names/boundaries are not reconstructed for historical UTC.
Marine values are canonical text only, Inter 14/18 px, maximum two lines with
full text/title; no icon, flag, squircle, interaction or live announcement.
Country marks/names remain unchanged.

The second asset adds 681,127 raw bytes (about 272 kB gzip), 336 parts/58,203
vertices and exactly 465,624 coordinate-buffer bytes. Desktop measurements keep
marine lookup at hundredths of a millisecond and combined classification well
below 1 ms on average; no index/worker/runtime GIS is justified. Public-domain
publisher terms and voluntary Natural Earth attribution are retained. Generalized
physical-region boundaries include finite precision, coastal gaps and possible
boundary ambiguity; no legal maritime, territorial-water, navigation or
hydrographic authority is implied. No-region does not mean international waters.

The [extended Over record](../frontend/over-country.md) owns the full vocabulary,
source/hash, exclusions, maintenance, failure contract and evidence locations.
Backend, database, orbital computation and protected rendering owners are unchanged.
