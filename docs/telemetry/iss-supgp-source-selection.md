# ISS standard GP versus ISS-E SupGP: source-selection gate

Verified 2026-09-28 UTC for ISS/NORAD **25544**. This is source verification, not a positional accuracy test or an implementation of SupGP ingestion. **Decision:** standard CelesTrak GP remains `PRIMARY`; CelesTrak `ISS-E` SupGP is `DEFERRED` for current tracking because the provider's exact segment-selection/boundary semantics are not established. The existing TLE/Orekit core remains valid. No freshness or `GOOD` threshold is set here.

## Authoritative source semantics

| Topic | Standard GP | ISS-E SupGP |
| --- | --- | --- |
| Query | [`gp.php?CATNR=25544&FORMAT=TLE`](https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE) | [`sup-gp.php?SOURCE=ISS-E&FORMAT=TLE`](https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?SOURCE=ISS-E&FORMAT=TLE); CelesTrak also documents `CATNR=25544&FORMAT=TLE`. `SOURCE=ISS-E` excludes the distinct legacy `ISS-TLE` source. |
| Origin | USSF/Space-Track GP catalog, fitted from past Space Surveillance Network observations. Specific observations/revision are not exposed. | NASA ISS OEM ephemeris → CelesTrak's SGP4 fit → GP-compatible elements. It is CelesTrak's transformed product, not NASA telemetry or the OEM itself. |
| Available formats | TLE/3LE, 2LE, OMM XML/KVN, JSON/CSV (OMM keywords). | TLE/3LE, 2LE, OMM XML/KVN, JSON/JSON-PRETTY/CSV. The query default is CSV; request a format explicitly. |
| Epoch meaning | GP mean-element epoch, usually behind the observation/retrieval time; it is not retrieval/publication time. | Start of a forward fit per CelesTrak's query guide. Future epochs are intentional for its predicted ephemeris segments; they are not future measurements. |
| Update / use | CelesTrak's approximately two-hour GP download guidance concerns client requests, not the age/accuracy of ISS elements. | CelesTrak says it checks public orbital data sources daily. NASA describes its predicted OEM as updated approximately three times weekly, not an SLA. The two-hour SupGP download guidance is likewise a request limit, not an orbit-quality threshold. |
| Maneuvers and drag | A fit to past observations can become less representative after drag evolution or a maneuver until a new fit reflects it. No maneuver prediction is encoded by this standard GP response. | CelesTrak explicitly splits the two-week ISS ephemeris into six-hour segments to better represent drag and ISS maneuvers. A single SGP4 fit approximates its source interval; it must not be propagated arbitrarily across segments or through an unverified maneuver boundary. |
| Public use | Both worked without credentials. [CelesTrak's usage policy](https://celestrak.org/usage-policy.php) asks for needed data only, once per update, and for automated querying to stop on non-200 responses. Unrestricted redistribution of raw CelesTrak responses was not verified. |

Sources: [standard GP formats and origin](https://celestrak.org/NORAD/documentation/gp-data-formats.php), [SupGP query semantics](https://celestrak.org/NORAD/documentation/sup-gp-queries.php), [SupGP origin, fitting and maneuver discussion](https://celestrak.org/NORAD/elements/supplemental/), [NASA OEM description](https://www.nasa.gov/spot-the-station/), [usage policy](https://celestrak.org/usage-policy.php). CelesTrak says it fits the source orbital data as observations with SGP4 in STK and publishes fit RMS. This compression replaces many time-indexed OEM vectors and event detail with one model-compatible mean-element set per segment. The [CelesTrak-authored 2025 paper](https://celestrak.org/publications/IAC/2025/IAC-25,A6,7,1,x99453,Paper.pdf) cautions that large maneuvers can worsen the fit. No source here warrants treating a SupGP TLE as raw NASA position data or its fit RMS as absolute orbital truth error.

## Timestamped observations and reproducibility

The standard 3LE response was fetched at **2026-09-28T14:26:25Z** in the preceding orbital-core verification, from the endpoint above. It contained `ISS (ZARYA)`, valid catalog `25544` lines and epoch token `26271.14212772` = **2026-09-28T03:24:39.835008Z**. At retrieval, signed `retrieval − epoch` was **+11 h 01 min 45.164992 s**. The response did not expose publication time or a per-set quality flag. This task reused those exact recorded lines instead of re-downloading inside CelesTrak's two-hour guidance. The standard TLE is the real frozen test fixture at `backend/src/test/resources/iss-2026-09-28.tle` (SHA-256 of 3LE file: `b432c6f8feb2d024c2611a037662613af96d646518a3b52bbb109fcb7c7b33c6`).

The ISS-E query returned HTTP 200 at **2026-09-28T14:45:37Z**, `text/plain`, and **60** three-line ISS segment records; all 60 passed the existing Orekit TLE parser's format/checksum and catalog-25544 checks. Raw response SHA-256: `ef8bc105c1a5836039d1727f23a8528c9aebaef5d2114f538916023f746389b6`. Its first epoch was **2026-09-25T16:57:11.696832Z**, matching the independently observed NASA OEM first-vector time `2026-09-25T16:57:11.697Z` within TLE epoch precision. Its final epoch was **2026-10-10T10:59:59.999712Z**. The observed NASA OEM spans approximately 15 days and identifies a creation date `2026-09-25T21:34:03.088Z`; the SupGP HTTP response did not identify a per-set publication instant. CelesTrak's [ISS fit-RMS file](https://celestrak.org/NORAD/elements/supplemental/iss.rms.txt) returned 60 RMS entries; Segment 12 was **0.138 km RMS relative to fitted source data**. That RMS file had HTTP `Last-Modified: Fri, 25 Sep 2026 21:35:24 GMT`. The text entries did not include iteration counts or fit start/stop times, and no explicit response-to-RMS revision link was verified. These metadata cannot establish real-time onboard measurement or pointwise accuracy.

| ISS-E segment | Element epoch UTC | `epoch − 2026-09-28T14:45:37Z` | Next observed epoch |
| --- | --- | --- | --- |
| 11 | 2026-09-28T04:57:11.696832Z | −9 h 48 min 25.303168 s | 10:57:11.696832Z |
| 12 | 2026-09-28T10:57:11.696832Z | −3 h 48 min 25.303168 s | 16:57:11.696832Z |
| 13 | 2026-09-28T16:57:11.696832Z | +2 h 11 min 34.696832 s | 22:57:59.999616Z |
| 14 | 2026-09-28T22:57:59.999616Z | +8 h 12 min 22.999616 s | 2026-09-29T04:57:59.999616Z |

Most adjacent epochs are exactly six hours apart, but **13→14 is 6 h 48.302784 s**; later observed gaps include **6 h 6.000480 s** and **6 h 1 min 53.999616 s**. The response labels and epochs alone do not say whether these are covered by an extended fit, an uncovered interval, rounded OEM event boundaries, or another rule. Do not silently infer coverage from the next epoch. An epoch in the future is an element for an upcoming predicted segment, not freshly measured telemetry.

## Segment selection: verified scope and blocker

**No exact production selection rule is verified.** CelesTrak says multiple epochs may be returned, the appropriate one matters, ISS data is divided into six-hour segments, and SupGP fits **forward** from an element epoch. Those statements favor a segment whose forward fit covers requested `t`; they do **not** explicitly define its end boundary, overlap/gap handling, or whether `latest epoch ≤ t`, `nearest epoch`, or a separately supplied fit interval is authoritative. `Nearest epoch` can select a future segment and propagate it backward, which is not established as the right rule for ISS-E. `Latest epoch ≤ t` can carry a segment beyond six hours where observed epochs are farther apart. The exact provider rule therefore remains a blocker to making SupGP primary or fallback.

For the fixed diagnostic time **2026-09-28T14:45:37Z**, Segment **12** is the unambiguous *candidate*: `t` is after its epoch and before both its epoch + six hours and Segment 13's epoch. This local agreement permits a comparison, not an endorsed general algorithm. Before promotion, obtain an authoritative CelesTrak statement or published fit interval metadata defining inclusive/exclusive boundaries, gaps/overlaps, maneuver transitions, first/last-segment behavior and how a new OEM revision replaces the set. If no segment covers `t`, report unavailable rather than extending a different segment without evidence.

## Same-time Orekit comparison

Both real TLEs were parsed by the existing `TleElementParser` and propagated at the fixed **2026-09-28T14:45:37Z** with the same existing `OrekitOrbitalPropagator` (TEME → ITRF 2020/IERS 2010 → WGS84, bundled EOP). Segment 12 was chosen only for this diagnostic as above. Units below are km, km/s and degrees; no second propagator or accuracy baseline was used.

| Output at fixed UTC | Standard GP | ISS-E Segment 12 |
| --- | ---: | ---: |
| TEME position (x, y, z), km | (773.143036, −4850.763258, 4690.722385) | (763.326787, −4848.460365, 4694.924511) |
| TEME velocity (vx, vy, vz), km/s | (6.923794052, −1.644420058, −2.842280154) | (6.925127987, −1.653148306, −2.833523597) |
| WGS84 latitude, ° | 43.860285279 | 43.908128463 |
| WGS84 longitude, ° | 50.259956589 | 50.151025771 |
| WGS84 ellipsoidal altitude, km | 424.033532 | 424.200149 |

SupGP minus standard GP: **TEME Cartesian position distance 10.923366 km**, latitude **+0.047843184°**, longitude **−0.108930818°**, altitude **+0.166617 km**. At this time standard `propagation − element epoch` was **+11 h 20 min 57.164992 s**; Segment 12's was **+3 h 48 min 25.303168 s**. These are two different model/source estimates. Their separation is **not** either source's error against truth; the 0.138 km SupGP fit RMS is a different quantity.

## Decision, model and next quality-policy inputs

| Source for current ISS tracking | Classification | Reason |
| --- | --- | --- |
| CelesTrak standard GP/NORAD 25544 | **PRIMARY** | Verified single-set selection, valid TLE input, working deterministic Orekit core. Its age and maneuver limits remain visible; no accuracy certification. |
| CelesTrak `ISS-E` SupGP | **DEFERRED** | NASA OEM lineage, future-aware segmentation and fit RMS are promising, but exact segment validity/selection is unresolved and the current source port returns only one set. |
| NASA OEM direct trajectory | **REFERENCE_ONLY** for this current-element decision | Distinct predicted ephemeris product; direct ingestion is outside this milestone. |

Current standard source behavior remains `OrbitalElementsSource → OrbitalElementSet → Orekit propagation → OrbitalState`. `OrbitalElementsSource.fetch()` currently returns **one** set and the standard adapter parses one 3LE; it cannot represent a 60-set ISS-E response or prove a segment selection. If SupGP is later promoted, keep each TLE as a source-provided `OrbitalElementSet`, add a source/application layer concept for a coherent element *collection* plus verified interval selection, and pass the selected set to the unchanged Orekit core. The domain need not learn `ISS-E` names, but lineage must distinguish `NASA_OEM → CELESTRAK_SUPGP_ISS_E → MISSION1_OREKIT_COMPUTED`. No production source switch or code change follows this gate.

The next orbital quality policy must treat these variables separately: **retrieval time `retrievedAt`**, **evaluation time `now`**, **element epoch `epoch`**, and **requested propagation time `t`**; calculate `now − retrievedAt` (source retrieval age), `retrievedAt − epoch` (signed element age on receipt), and `t − epoch` (signed propagation offset) without conflating them. Also use source availability/fetch status, source format/identity/checksum validity, and propagation/EOP success. If SupGP is later selected, add **source collection identity/OEM revision if exposed, selected segment identity, verified interval start/end, interval membership, fit RMS metadata and gap/overlap status**. Neither absolute element age for a future epoch nor CelesTrak's two-hour *download* guidance can serve blindly as a data-quality threshold. Do not label any at-now computed position as live onboard ISS telemetry.
