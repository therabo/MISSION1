# ADR-0026: Optional Current cloud imagery in the Earth renderer

- Status: Accepted
- Date: 2026-10-16
- Scope: Optional visual imagery; no orbital or meteorological data contract

## Context

Earth already uses public imagery in its single Cesium Viewer. The requested
cloud enrichment needs a changing public image and an explicit Historical rule.
It must not become a prerequisite for Earth, ISS, picking or orbital delivery.
Adopting a persistent external runtime dependency warrants this record.

## Decision

Acquire the processed cloud JPEG directly from the public
`clouds.matteason.co.uk` service, independently of all orbital/telemetry APIs.
Use browser HTTP revalidation every 30 minutes while Current is presented,
bounded requests and SHA-256 content identity. Keep the last decoded good image
on failure; initially omit clouds. Own one scheduler, one abortable acquisition,
one stable primitive/material and at most one replacement image.

Map coverage onto a non-pickable WGS84-based translucent ellipsoid shell with
15,000 m **DISPLAY CLOUD SHELL ALTITUDE**, without depth writes. This is a 2D
visual shell, not cloud-height measurement or volumetric weather. Its own public
Fabric material uses Cesium's scene Sun. Globe, atmosphere and camera stay intact.

Historical hides clouds immediately and suspends acquisition. Returning to Current
restores the retained image and resumes the same bounded schedule. No historical
cloud lookup or weather/time matching exists. Download time, check time and content
identity are retained separately; pixel observation/publication times are unknown.

The publisher releases its value-added images under CC0 and requires “Contains
modified EUMETSAT data”. EUMETSAT Data Policy (1 January 2025), Articles 6–7,
requires attribution and recognizes rights in value-added images. This does not
relicense underlying source data as CC0. Keep links and attribution in Cesium
credits and the [source record](../frontend/clouds-and-milky-way.md).

## Alternatives considered

- A same-origin backend cache would centralize acquisition but adds backend
  deployment/persistence work for optional imagery with working public CORS.
- A bundled snapshot cannot satisfy automatic updates and ages silently.
- Globe imagery lacks shell separation and independently controlled cloud light.
- Historical archives add an unrequested reconstruction contract.

## Consequences and validation

The visitor contacts the external service/CDN; requests omit credentials and
referrer. No availability/freshness SLA is assumed. HTTP cache validators are
browser-owned; SHA-256 also works when CORS hides ETag. No raw EUMETSAT numerical
data is redistributed. The source has mirrored polar fill and occasional holes.

Offline acquisition/scheduler tests cover failures, same/new bodies, cancellation,
mode transitions and repeated cycles. Browser evidence must verify texture swap
and destruction, picking, scene UTC, fallback, all five viewports and frame pacing.
The NASA sky remains independently bundled and time-oriented; its offline tonal
derivative introduces no new runtime provider.

## 2026-10-16 initial 8K quality refinement

The initial 2048×1024 representation is refined to verified 8192×4096 after matched
2K/4K/8K crops show a meaningful gain in small cells/fronts and the bounded
replacement/pacing checks pass. The same provider, rights, visual-only boundary,
public Fabric owner and Current/Historical rule remain. Stream cap is 8 MiB,
exact dimension validation remains, base RGBA8 estimates are 128 MiB active /
256 MiB during replacement, without mipmaps. Public WebGL capability reads avoid
acquiring an unsupported image; optional clouds remain absent on limited devices.
A subdued night RGB floor preserves shadow structure with unchanged texture alpha.
This refines the accepted visual layer and creates no new architectural boundary.
See the source record for evidence, filtering constraints and costs.

## 2026-10-16 production 4K refinement

Production uses verified 4096×2048 as the preferred quality/resource compromise,
superseding the initial 8K selection. The accepted comparison already establishes
its detail gain over 2K. The bounded stream cap is 2 MiB for the verified 1.50 MB
sample; RGBA8 base estimates are 32 MiB active / 64 MiB during replacement.
Exact dimension validation and the existing capability guard follow 4096×2048.
Night lighting, alpha, sampling, lifecycle and Current/Historical ownership remain
unchanged. This is a representation choice within the same accepted architecture.
