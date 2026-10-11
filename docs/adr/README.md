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
| [0009](0009-field-aware-crew-reconciliation.md) | Field-aware NASA Crew evidence and immutable temporal reconciliation | Accepted |
| [0010](0010-crew-event-aware-refresh.md) | Bounded event-aware Crew scheduling | Accepted |

These decisions govern the V1 design baseline. Material changes get a new ADR; accepted history is not silently rewritten. The 2026-09-28 [SSCWeb verification](../telemetry/sscweb-verification.md) selected an earlier first-source route within ADR-0003's evidence rule. [ADR-0004](0004-local-gp-propagation-for-current-orbit.md) now selects verified GP elements plus local Orekit propagation for the first current-position path. SSCWeb remains secondary/reference. The [ISSLive diagnostic](../telemetry/source-verification.md) records its current public item-delivery block. ADRs 0001–0003 have dated application notes for the new first record and in-process orbital module; no earlier deployment, persistence or mapping decision was superseded. ADR-0002's “latest-by-event-time” for any SSCWeb history means latest **stored ephemeris epoch**, never measured current ISS position; for GP elements, source epoch, retrieval time and propagation time remain distinct.

ADR-0006 now records the 2026-09-30 visual-frame/rear-camera clarification and additive ITRF velocity delivery; source separation and unavailable onboard attitude remain. No new ADR or RTN implementation is introduced.

Its 2026-10-01 perceptual pacing clarification rejects strict constant Cartesian speed, retains cubic/display-target geometry, and documents the camera metric and temporary presentation continuity on OEM loss. Source classifications and physical delivery remain unchanged.

- [ADR-0011: Query-time effective-time Mission Replay](0011-effective-time-mission-replay.md) — Accepted.

- [ADR-0012: Versioned Crew source occurrences and compatible-version selection](0012-versioned-crew-source-occurrences.md) — Accepted.

- [ADR-0013: Canonical Crew identity and field-level profile projection](0013-canonical-crew-identity-and-profile-projection.md) — Accepted; reviewed reversible bindings, preserved UUID aliases and shared Current/Replay projection.

- [ADR-0014: NASA WordPress Expedition editorial roster source and immutable shadow observations](0014-nasa-editorial-roster-shadow-observations.md) — Accepted; generic source-directed discovery, immutable typed observations and independent health; Current/Replay unchanged.

- [ADR-0015: Automatic Crew identity shadow decisions and correction](0015-automatic-crew-identity-shadow.md) — Accepted for shadow only; frozen calibrated model, scoped evidence, durable retries and reversible independent graph.

- [ADR-0016: Shadow active Crew membership and source-supported lifecycle](0016-shadow-active-crew-membership.md) — Accepted for shadow only; positive support, temporal departure veto, retained humans and explicit unresolved slots; public Current/Replay frozen.

ADR-0009 has a dated 2026-10-11 clarification for completed named operational departures, minute-qualified time and append-only retained reinterpretation. V1–V10 remain unchanged; new evidence is consumed by shadow V10, with public Current/Replay activation deferred.

- [ADR-0017: Production Current active membership](0017-production-current-active-membership.md) — Accepted; V10 inclusion with V7 publication, default activation, scoped fail-closed availability and explicit legacy rollback. V9 identity and Replay activation remain deferred.

- [ADR-0018: Purpose-specific Current Crew summary semantics](0018-current-crew-summary-semantics.md) — Accepted; remove obsolete Current count/report projections, retain Historical/source evidence, distinguish membership from operational presence.
