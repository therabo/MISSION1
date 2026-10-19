# Shared physical position status bar — 2026-10-19

Earth View and ISS Inspection use the same `PositionStatusBar`, kept mounted
through entry and return. Its only visible fields are, in exact order:

**Latitude | Longitude | Altitude | Over**

Desktop uses four balanced columns. At 740px and below, both modes use the same
2×2 arrangement: Latitude/Longitude above Altitude/Over. Surface, padding, label
and value fonts, spacing and alignment are shared. Fields use ordinary dt/dd;
there is no button, link, disclosure, status column or mode identity in the bar.
The existing presentation dissolve targets this shared surface; camera motion
remains independently owned by the renderer.

The visible ISS / WGS84 and ISS / Inspection / Spatial investigation blocks,
General Perturbations quality status and its dedicated graphical evidence
panel/native disclosure/tooltip are removed. `OperationalSummary`,
`InspectionStrip`, `OrbitalStatus` and `HistoricalOrbitalSummary` are retired,
with their exclusive status labels, time/age/card formatters, helpers, CSS,
ARIA wiring, native disclosure owner and obsolete graphical tests. The removed
card's model-load duration state is no longer retained by App; the existing
ready/failed gate and renderer diagnostics are unchanged.

`PositionReadouts` is reused without modification: same physical source/instant
and active-buffer checks, finite-value guard, three decimal degrees with N/S/E/W,
and altitude in km to one decimal. Missing, expired or mismatched samples stay
Unavailable. Current still uses EarthView's existing physical sample and scene
UTC. Historical still uses coherentHistoricalState at accepted Historical UTC
and its effective GP/TLE or OEM source. Earth and Inspection cannot derive
coordinates independently. Camera/model display position and the 75 km Overview
lift are excluded. No computation pipeline, request, timer or polling is added.

**WGS84 scientific semantics remain. GP/TLE scientific quality/state remains.**
The existing API responses, qualityAtGeneratedAt, sourceHealth, replay quality,
validation, classifications, source lineage, acquisition, diagnostics and
backend/domain tests are retained. Removing their dedicated presentation does
not change those values or promote a stale/unknown product to Good. The source
selector and trajectory legend retain computed GP/TLE versus predicted OEM
meaning. Project/native attribution and the accepted NASA VTAD asset remain.

Real delivery, scene, buffer-expiry, OEM-fallback and Historical loading/error
notices remain outside the four-field bar through OrbitalNotice and
HistoricalOrbitNotice. Inspection's screen-reader interaction guidance and
transition announcements remain outside the bar with a valid relationship.

**Over / — is static in every mode.** It has no geographic classification,
reverse geocoding, external service, location state or scheduled work. All
protected science, cameras, model, modules, clouds/sky, Crew, telemetry and
backend retain their owners. This local presentation consolidation needs no ADR.

QA, before/after captures and audits remain outside Git under
`/Users/daniel/.codex/exports/mission1-unified-bottom-bar-2026-10-19/`.
