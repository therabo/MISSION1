# ADR-0027: Local country classification and squircle marks

- Status: Accepted
- Date: 2026-10-19
- Scope: shared Earth/Inspection Over field; frontend geographic classification only

## Context

The shared Latitude / Longitude / Altitude / Over bar already consumes one accepted physical WGS84 state in Current and Historical. Over needs deterministic country/territory classification with preserved source/time availability and no second orbital pipeline. The completed external analysis measured Natural Earth scales, lookup strategies and flag systems. The implementation instruction explicitly supersedes its hexagonal visual recommendation with a **squircle shell**, and limits country names to two visible lines.

## Decision

Use pinned Natural Earth **Admin 0 Map Units, 1:10 million, product 5.1.1**, default de-facto geometry. Use paired Countries 5.1.1 only for the documented English naming join: prefer the ADM0_A3=ISO_A3_EH country row, otherwise require a unique ISO row. Preserve Map Units’ accented Réunion NAME_EN as an explicit source-field spelling exception. Offline maintenance verifies archive hashes/schema/WGS84, repairs the known Egypt self-intersection with Shapely make_valid/linework, validates quantized geometry, preserves all parts/holes/dateline splits, and generates flat integer-delta JSON. A checked ISO2/ISO3 allowlist validates `_EH` pairs; shared valid ISO map units roll up to one identity. Territories with their own ISO remain distinct. Missing `-99`, user-assigned XK and source pseudo-code XD are explicit exceptions with nullable real ISO fields. Retain GU/NE/admin/sovereignty/breakaway evidence in the provenance manifest; sovereignty is not a display fallback.

Load/decode the static geometry once after initial render, outside the main JS bundle. Apply per-disconnected-polygon bounding boxes and exterior/hole point-in-polygon; collect all matches and collapse the same normalized identity. Multiple distinct matches are ambiguous, never resolved by array order. No nearest-country snapping. No runtime GIS package, external geocoder, backend route, worker, grid/R-tree, country polling timer or render-frame lookup.

Derive the country result from the same accepted physical snapshot and availability/time/source contract as the coordinates: approximately 1 Hz Current, immediately on accepted Historical/source/availability changes. Pending Historical seeks keep only the previous coherently presented context. No country debounce, grace period or sticky cache. Camera position, model display lift and source-display retargeting are excluded.

Use individual local unmodified SVGs from **hampusborgos/country-flags c09927e63705529bbf59ca6684cd9b23225dddad**. Validate passive content at import. Preserve per-file origin registry/checksums and its incomplete-origin caveats; the publisher's public-domain claim is not a universal ruling on national-symbol use. Source artwork bytes remain unmodified in a neutral **MISSION1 squircle** shell. The 2026-10-19 flag-fill clarification replaces the padded 20×16 px box: rectangular artwork proportionally covers the full 28×24 px box clipped to the squircle; intrinsic square/portrait artwork is contained with a 1 px safety inset. This generic image-ratio rule keeps Switzerland square and Nepal a transparent double pennon. Peripheral rectangular artwork can be cropped; no stretching, recoloring, emoji or remote CDN. Text is primary, decorative mark aria-hidden, no new interaction. Names use at most two visible lines with ellipsis and retain the full canonical text/title semantically.

Country-only V1 displays — for no match, ambiguity or unavailable input/catalog, with distinct internal diagnostic variants. A valid identity with missing artwork retains its text. Antarctica remains a generic source identity without an invented national flag. Historical position uses the installed fixed geography/name/artwork release, not historical political cartography.

## Alternatives considered

110m/50m lose material microstate/coast/island detail; 10m improves those cases within modest measured runtime cost. Higher-resolution and other boundary products change provenance, licensing and political/overlap policy; no substitution is needed for this bounded V1. Runtime reverse APIs add network latency, quotas, mutable semantics and privacy exposure; a self-hosted geocoder adds unjustified services. Grid/R-tree/current-country caches save insignificant CPU at the existing cadence. Full-bleed rectangular fitting trades peripheral flag detail for a filled compact mark; intrinsic square/portrait artwork retains its natural outline. The hexagonal analysis concept is intentionally superseded by the user's squircle decision.

## Consequences

The local encoded asset costs about 5.8 MB raw / 2.35 MB gzip and exactly 4,422,632 bytes of typed coordinate buffers plus ordinary catalog object overhead. Ordinary lookup is sub-millisecond; initialization and physical mobile performance must be measured separately. Cartographic scale is not positional accuracy: some border/coast/islet and gazetteer points remain mismatched. This is a **computed geographic classification** of accepted physical ISS state, not measured telemetry, legal airspace, territorial waters or survey-grade geography. Successful lookup never upgrades orbital quality/provenance. Pinned catalogs require explicit import review to change.

Source/hash/repair/identity/flag evidence, reproducible maintenance instructions and failure/QA contracts are in [the country asset record](../frontend/over-country.md). Existing backend, orbital/source/time, Cesium/camera, asset and data boundaries remain unchanged.
