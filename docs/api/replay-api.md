# Replay REST API

## GET /api/iss/replay?at=2026-10-02T03:00:00Z

Required ISO-8601 instant `at` (normalized to UTC, year 1900 onwards), no later than server clock. Missing, malformed or future time returns 400; unsupported retained coverage returns 200 with explicit independent UNAVAILABLE subsystems. Successful responses use Cache-Control: no-store.

Top-level fields: semantics=EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION, requestedAt, reconstructedAt, crew and orbit. Both subsystem requestedAt/effectiveAt equal requestedAt exactly. reconstructedAt is query execution time; it is not an evidence time.

Crew fields: requestedAt, effectiveAt, availability (PARTIAL or UNAVAILABLE), quality, coverage, profilePolicy, state and profiles. `state` uses the accepted Crew station/Expedition/counts/members/unresolvedSubjects/reconciliation/freshness/provenance structure. It is null outside coverage. Profiles are latest retained canonical metadata for historical members only; their operational compatibility fields currentAssignment/currentPresence are at T. Historical source health fields express retained support, not provider reachability today; lastSuccessfulFetchAt preserves real retrieval and can be later than T. No current refresh failure is imported into historical operational state.

Orbit fields: requestedAt, effectiveAt, availability, reason, coverage, primary, secondary, sourceSeparationMeters and policy. Primary is GP where usable, otherwise covering OEM. Secondary is separate OEM where both cover T. `sourceSeparationMeters` is an Earth-fixed same-epoch distance, not an accuracy/error estimate. A state carries effectiveAt, quality=UNKNOWN, frame=ITRF_2020_IERS_2010, positionUnit=m, velocityUnit=m/s, position/velocity x/y/z, WGS84 latitudeDegrees/longitudeDegrees/altitudeMeters and source lineage. Source includes kind, classification, hash, URL, provider, GP epoch, OEM creation, retained retrieval/HTTP metadata, vector/support coverage, signed propagation offset and method. Negative GP offset means backward propagation from a later epoch. No source blending or current-source fallback.

Default GP absolute epoch offset is PT24H; `mission1.replay.gp-max-offset` accepts a positive Duration no greater than PT24H. Ties choose prior epoch then stable hash. OEM selects most recent covering creation at/before T, otherwise earliest covering creation after T, then hash; complete PV interpolation only inside actual vectors with adjacent span <=600 seconds. Packaged EOP bounds also constrain coverage.

## GET /api/iss/replay/coverage

Returns semantics, evaluatedAt, crew, orbit, joint and orbitGate (FULL/BOUNDED/INSUFFICIENT relative to Crew support). Every coverage has status, inclusive start/end, ordered inclusive intervals and limitations. Joint is an intersection; it does not imply a complete roster or measured position. Empty coverage uses null start/end and an empty intervals list. Future support is clipped to evaluatedAt. A span with multiple intervals can contain gaps; consumers must use intervals rather than assume continuity between outer endpoints.

Both GETs use read-only PostgreSQL REPEATABLE READ. They acquire no provider data, perform no identity resolution, create no runs/triggers/snapshots and persist no replay state. Current APIs remain current. Knowledge-time/as-known-then is not implemented.

Recorded real-history responses and supported/unsupported examples: [validation](../replay/validation/README.md).

## Compatible Crew source versions — 2026-10-10

Crew reconstruction and Crew coverage consume the same ADR-0012 compatible-version selection used by Current. Selection precedes effective-time evaluation and uses successful observations retained at query time, including observations after requested T. This preserves best-current reconstruction, without introducing knowledge-time replay or Current fallback. Unresolved counts describe selected source occurrences; separate events and claims remain distinct. The public DTO shape is unchanged, all alternative evidence versions remain internally auditable, and both GETs remain read-only and network-free. See [occurrence validation](../crew/source-occurrence-versioning-validation/README.md).


## Canonical identity — ADR-0013

Crew members/profiles include the same additive `canonicalProfile` metadata as Current. Identity decisions and retained profile metadata use `knownAt`; operational state remains at requested T. Reviewed aliases collapse before reconciliation, with no future assignment backfill or name deduplication. [Rules](../crew/canonical-identity.md), [validation](../crew/canonical-identity-validation/README.md).
