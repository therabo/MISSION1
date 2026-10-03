# Standard-GP current orbital quality policy

Status: **MISSION1_DEFINED**, version `orbital-current-v1`, 2026-09-28. Applies only to the current-state display computed from CelesTrak standard GP for ISS/NORAD 25544. It is an operational recency rule, **not a positional error estimate or NASA, USSF, or CelesTrak certification**. The primary source remains standard GP; ISS-E SupGP remains deferred.

## Verified provider and propagation facts

- [CelesTrak's GP format guide](https://celestrak.org/NORAD/documentation/gp-data-formats.php) gives the exact `CATNR=25544&FORMAT=TLE` request. Its [usage policy](https://celestrak.org/usage-policy.php) says GP is checked/updated on a two-hour cycle for client download purposes, requests should be no more frequent than once per update, and automated clients should stop after non-200 responses. It does **not** guarantee that the ISS element epoch is within two hours of retrieval, nor provide a per-set freshness or position-accuracy flag. CelesTrak's guide recommends retaining the last downloaded data during temporary Internet trouble.
- [Orekit 13.1.8's TLEPropagator documentation](https://test.orekit.org/site-orekit-latest/apidocs/org/orekit/propagation/analytical/tle/TLEPropagator.html) describes SGP4/SDP4 propagation from TLE mean elements and discusses a 24-hour neighborhood on either side of the epoch, while also saying accuracy is not directly measurable or predictable there. MISSION1 uses the neighborhood only to motivate a conservative **application display rule**. It does not adopt the documentation's approximate kilometer language as an ISS error bound. [CelesTrak's SGP4 validation abstract](https://celestrak.org/publications/AAS/07-127/) says TLEs contain no accuracy information. Maneuvers, drag and source revisions can defeat any age-only inference.
- The [verified ISS response](orbital-elements-verification.md) had an epoch about 10 h 34 min before retrieval; the later [standard-GP versus SupGP investigation](iss-supgp-source-selection.md) recorded a set about 11 h 02 min old at retrieval. Dated CelesTrak [space-station table snapshots on Sep 12](https://celestrak.org/NORAD/Elements/table.php?FORMAT=tle&GROUP=stations), [Sep 15](https://celestrak.org/norad/elements/table.php?FORMAT=csv&GROUP=stations), and [Sep 16](https://celestrak.org/NORAD/elements/table.php?FORMAT=XML&GROUP=STATIONS) showed rounded ISS GP ages of `0.68`, `0.48`, and `0.44` days (about 16 h 19 min, 11 h 31 min, and 10 h 34 min). These are a few dated observations, **not a representative historical distribution**. No outlier frequency or accuracy distribution follows. They show that a two-hour stale boundary would reject ordinary observed sets and that 24 hours can distinguish at least these observations from an unusually old set. No repeated raw GP polling was performed for this study.

## Independent dimensions and time definitions

`SourceAcquisitionHealth` has `UNKNOWN`, `HEALTHY`, or `DEGRADED`, last attempt, last successful fetch, last failure, consecutive count and sanitized failure category. It describes the provider acquisition path and is supplied to the evaluator. The later [refresh implementation](celestrak-refresh-policy.md) reconstructs last success from durable observations and tracks current failures in memory; it does not alter this quality policy. A failed fetch must not erase a previously validated set. A healthy fetch likewise cannot make an old-epoch set `GOOD`.

For explicit `evaluationTime` and `propagationTime`, the evaluator records:

| Quantity | Definition | Meaning |
| --- | --- | --- |
| `retrievalAge` | `evaluationTime − retrievedAt` | Time since MISSION1 retrieved this set. It can be negative in a historical evaluation. |
| `elementEpochAge` | `evaluationTime − elementEpoch` | Signed age of the orbital solution at assessment time; governs **current** freshness. |
| `propagationOffset` | `propagationTime − elementEpoch` | Signed SGP4/SDP4 offset, including back-propagation. It is not retrieval age. |

`OrbitalState` contains coordinates only after successful propagation, TEME → ITRF 2020 / IERS 2010 transformation, and WGS84 conversion. It keeps the element hash, epoch, provider/upstream, source URI, retrieval time, propagation time and `COMPUTED_FROM_ORBITAL_ELEMENTS` classification. `OrbitalEvaluation` adds the as-of time, ages, source health, quality reason and policy ID. No full TLE is duplicated in the quality result. Provider publication time remains unknown. The implemented REST DTO exposes the relevant fields without serializing this domain record directly.

## MISSION1-defined decision order

1. No retained usable element set → `NO_DATA / NO_ORBITAL_ELEMENTS`, no coordinates. A first fetch failure falls here.
2. Bad TLE format/checksum, wrong ISS catalog identity, inconsistent epoch/hash, propagation failure, absent/out-of-coverage EOP, or failed frame/geodetic transformation → `INVALID` with a specific reason, no coordinates. This precedes every freshness decision. An invalid new response does not invalidate a separately retained older valid set.
3. Valid computation for `propagationTime != evaluationTime` → `UNKNOWN / NOT_CURRENT_EVALUATION`. Current-display freshness is not a policy for history, replay, ground track or future planning. The signed offset is retained. The [bounded Earth View visual window](../architecture/04-earth-view-orbital-delivery.md) uses such computed samples for presentation, while assessing quality only for the exact `generatedAt` sample. Its 20-minute maximum is a request/display bound, not a general orbital-validity or `OUT_OF_RANGE` rule; EOP coverage remains a hard computational requirement.
4. Current computation from an element whose epoch is **after** evaluation time → `UNKNOWN / ELEMENT_EPOCH_IN_FUTURE`. Back-propagation may compute, but this policy does not call a future-epoch set fresh for a current display.
5. Current computation with nonnegative `elementEpochAge > 24 h` → `STALE / ELEMENT_TOO_OLD`. Coordinates can be offered as a visibly stale, computed estimate with exact age and source health.
6. Current computation with `0 ≤ elementEpochAge ≤ 24 h` → `GOOD / NONE`. The boundary is inclusive. `GOOD` means structurally valid, computationally successful, and within **MISSION1's** current-display recency window. It does not mean measured, maneuver-aware, or positionally accurate to any stated distance.

The 24-hour value lives in the immutable `OrbitalFreshnessPolicy` configuration, not in the source adapter or propagator. Changing it requires a new policy ID and review of displayed history. Source health never overrides this state-quality order: `DEGRADED + 3 h` can be `GOOD`, while `HEALTHY + 30 h` is `STALE`. `OUT_OF_RANGE` remains in the canonical vocabulary but is unused for this path. This policy does not define a supported trajectory-planning or replay window.

## Operational limits and review trigger

This threshold is deliberately broad enough to admit the few observed normal ISS GP ages and close enough to the Orekit-discussed epoch neighborhood to flag substantially older sets. It is **not** calibrated against independent ISS truth data. A maneuver can make a younger set poor, and a stale result can still look plausible. Future evaluation should gather a controlled, provider-respectful history of ISS element epochs and independent position references before tightening the policy or claiming accuracy. The approved short Earth View future arc is a labeled **visual GP/TLE extrapolation**, not an accuracy-certified forecast. Replay, full-orbit prediction, or conjunction analysis still needs its own validity decision. No consumer should render `STALE` as live or collapse provider health into state quality.


## Replay integration — 2026-10-03

Replay uses a separately reviewed absolute ±24-hour GP limit (configurable downwards), reports signed offsets and UNKNOWN accuracy, and rejects source/EOP gaps. Current orbital-current-v1 semantics remain unchanged. [Replay feasibility](../replay/orbit-historical-feasibility.md).
