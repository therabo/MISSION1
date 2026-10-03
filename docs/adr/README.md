# Architecture decision records

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-single-backend-and-in-process-pipeline.md) | Single backend and in-process pipeline | Accepted |
| [0002](0002-postgresql-for-initial-history.md) | PostgreSQL for initial history | Accepted |
| [0003](0003-verified-source-mapping-and-value-semantics.md) | Verified source mappings and explicit value semantics | Accepted |
| [0004](0004-local-gp-propagation-for-current-orbit.md) | Local GP/TLE propagation for current ISS orbital state | Accepted |
| [0005](0005-separate-nasa-oem-comparison-trajectory.md) | Separate NASA OEM comparison trajectory | Superseded by 0006; source pipeline retained |
| [0006](0006-selectable-forward-trajectory-visualization.md) | Selectable position source and forward-only trails | Accepted |
| [0007](0007-independent-crew-observations-and-field-authority.md) | Independent Crew observations and field-aware source authority | Accepted |
| [0008](0008-immutable-crew-source-history-and-identity-anchors.md) | Immutable Crew source history and stable identity anchors | Accepted |

These decisions govern the V1 design baseline. Material changes get a new ADR; accepted history is not silently rewritten. The 2026-09-28 [SSCWeb verification](../telemetry/sscweb-verification.md) selected an earlier first-source route within ADR-0003's evidence rule. [ADR-0004](0004-local-gp-propagation-for-current-orbit.md) now selects verified GP elements plus local Orekit propagation for the first current-position path. SSCWeb remains secondary/reference. The [ISSLive diagnostic](../telemetry/source-verification.md) records its current public item-delivery block. ADRs 0001–0003 have dated application notes for the new first record and in-process orbital module; no earlier deployment, persistence or mapping decision was superseded. ADR-0002's “latest-by-event-time” for any SSCWeb history means latest **stored ephemeris epoch**, never measured current ISS position; for GP elements, source epoch, retrieval time and propagation time remain distinct.

ADR-0006 now records the 2026-09-30 visual-frame/rear-camera clarification and additive ITRF velocity delivery; source separation and unavailable onboard attitude remain. No new ADR or RTN implementation is introduced.

Its 2026-10-01 perceptual pacing clarification rejects strict constant Cartesian speed, retains cubic/display-target geometry, and documents the camera metric and temporary presentation continuity on OEM loss. Source classifications and physical delivery remain unchanged.
