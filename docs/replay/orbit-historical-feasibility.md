# Historical orbit feasibility — gate recorded before implementation

Audit: 2026-10-03T21:16:36Z, existing PostgreSQL 16.10 volume, accepted baseline 0d754997617c2c5bfb6aa7cf5921ea3cb41d6e7f. No historical provider requests or source writes were made.

**Verdict: FULL**, scoped to the currently supported Crew interval, 2026-10-02T02:01:55Z through the audit instant. Finite collection bounds and partial Crew roster completeness still apply.

## GP inventory

Six distinct raw TLE sets, eight retrieval observations. Epoch range 2026-09-28T03:24:39.835008Z to 2026-10-03T01:06:34.599456Z. Retrieval range 2026-09-28T13:58:32Z to 2026-10-03T15:28:18.954968Z. Raw 69-character lines, epoch, hash, provider, upstream origin and source URL retained.

Consecutive epoch gaps: minimum 16,725.460608 s, median 50,175.943776 s, interpolated p95 204,052.570330 s, maximum 234,158.526432 s (65 hours). Under a ±24-hour rule the GP union is September 27 03:24:39.835008–September 30 02:38:28.580928 and September 30 19:41:07.107360–October 4 01:06:34.599456 UTC. The 17-hour gap is genuine; current/latest elements cannot fill it.

The ±24-hour rule follows the bounded applicability discussion in [Orekit's TLEPropagator documentation](https://www.orekit.org/site-orekit-development/apidocs/org/orekit/propagation/analytical/tle/TLEPropagator.html). It does not adopt the documentation's indicative accuracy language as a guarantee. Replay reports UNKNOWN accuracy, signed offset and selection policy; nearest epoch may be later than T under effective-time semantics.

## OEM inventory

| SHA-256 | Creation UTC | Vector coverage UTC | Vectors | Last retained retrieval UTC |
|---|---|---|---:|---|
| 14f2dce1e0263fba4fee8e042a89173ec632768f8cd54190e7c0d99040ef2433 | Sep 28 17:13:16.701 | Sep 28 12:00–Oct 13 12:00 | 5404 | Sep 30 18:55:39.663659 |
| 504c2969e91bfadef7ef2551dc4d1c2c626f74814484e678d45042077d6e7f6b | Sep 30 16:44:45.057 | Sep 30 12:00–Oct 15 12:00 | 5403 | Oct 2 16:03:40.970597 |
| 78790d7a8c1b5ac9285b43cc889f8d3272385b2afda1289e95300049283acdad | Oct 2 16:36:47.957 | Oct 2 14:00–Oct 17 14:00 | 5403 | Oct 3 19:12:02.137891 |

All three bodies were extracted from existing BYTEA, hash-checked and parsed: ISS, EARTH/EME2000, UTC, source km and km/s converted to m and m/s. Maximum adjacent-vector span is 240 seconds; no unexplained gap under the existing 600-second interpolation limit. Their union is continuous September 28 12:00–October 17 14:00. Replay clips future coverage at server time and transformation coverage at packaged EOP bounds.

OEM bodies and creation times are retained by content hash. The existing table retains only last retrieval/HTTP Last-Modified per body and has no persisted source-URL column; the accepted adapter's pinned NASA URL supplies that lineage. This limits future knowledge-time analysis. No retention/deletion job removes these products or TLE sets today.

## Crew overlap and selection

The earliest applicable retained NASA person evidence is October 2 02:01:55 UTC (publication fallback; no parsed event timestamp). It was captured later, on October 3. LL2 structured coverage begins at its actual first capture, October 3 10:30:18.796289 UTC, not the Expedition start. The complete current Crew support interval lies within both GP and OEM support. FULL therefore describes synchronized computed position capability over that interval, not complete onboard telemetry or a complete Crew roster.

GP uses nearest epoch within the signed ±24-hour limit, prior epoch on equal distance, then hash. OEM uses latest covering creation at/before T, otherwise earliest later covering creation, then hash. No source mixing, historical source fetch or OEM extrapolation. GP remains COMPUTED_FROM_ORBITAL_ELEMENTS; OEM remains SOURCE_PROVIDED_PREDICTED_EPHEMERIS. Representative same-epoch separation measurements and executable boundary evidence are recorded in the validation dossier; they are source separation, not truth/error estimates. RTN analysis remains deferred.
