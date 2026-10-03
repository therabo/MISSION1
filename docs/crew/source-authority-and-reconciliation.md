# Crew source authority and future reconciliation

LL2 and NASA produce source observations. Source order never decides universal truth. `verifiedAgainst: "NASA"` and a boolean `verified=true` cannot explain which field, document, time or event was checked.

| Field/claim | Preferred source | What it cannot establish alone |
| --- | --- | --- |
| Profile, biography, career statistics | LL2 structured profile; official agency material may corroborate | ISS physical presence or provider accuracy guarantees. |
| Structured Expedition membership and role | LL2 detailed expedition; NASA mission roster may corroborate/contradict | Everyone physically aboard during handover/visits. |
| Current station presence | Relevant, time-qualified NASA official operational evidence | Indefinite present occupancy after later departures; complete canonical identity resolution. |
| Observed arrival/departure/hatch/undocking | NASA official operational post; LL2 docking records provide structured corroboration | Docking does not itself prove a named person entered; announced future departure is not completed departure. Landing time is not station departure time. |
| Media display/reuse | Source-provided rights metadata and the relevant rights holder's terms | A URL, NASA agency affiliation or `singleUse=false` alone is not unlimited reuse permission. |

## NASA source categories

`NASA_EXPEDITION_PAGE`, `NASA_ISS_OPERATIONAL_POST`, `NASA_VISITING_VEHICLES` and `NASA_STATION_OVERVIEW` remain distinct. Each observation carries its specific URL, retrieval time and hash. Evidence additionally carries the publication/event timestamps only when supported, assertion type, subjects/count, supporting text and method. Page metadata/HTML structure supplies no stable official Crew API; an official website can contain stale sections.

## Reconciliation contract — future, not implemented

Input: structured source result(s), independent verification evidence result(s), reviewed identity mappings, evaluation instant and explicit policy version. Output: canonical presence/as-of state and count, current expedition reference, retained assignment/profile observations, per-field provenance, unresolved identities and conflicts, plus structured reconciliation status. Count must derive from reconciled physical presence, **never permanent `LL2 crew.length` logic**. Inputs must remain inspectable and immutable; canonical output must not rewrite them.

| Status | Intended meaning, after temporal/identity comparison |
| --- | --- |
| `MATCH` | Comparable, resolved observations agree. |
| `NASA_AHEAD` | Time-qualified operational evidence precedes structured source coverage. |
| `LL2_AHEAD` | Structured source describes a change before comparable NASA evidence exists. |
| `PARTIAL_MATCH` | Some comparable fields/people agree, with missing/unresolved coverage. |
| `PRIMARY_UNAVAILABLE` | Structured source unavailable; official evidence may still exist. |
| `VERIFICATION_UNAVAILABLE` | Structured observations exist without usable official evidence. |
| `STALE` | Relevant evidence fails a documented future freshness policy. |
| `AMBIGUOUS` | Multiple expedition candidates, unresolved identities/times or contradictory comparable evidence prevent an answer. |

These statuses are vocabulary, not today's inferred winners. The current seven-versus-eleven capture supports a handover semantic difference, but does not establish a measured LL2 update delay or justify emitting `NASA_AHEAD` automatically. Preserve the difference neutrally.

No fuzzy matching, universal NASA override, runtime LLM extraction, canonical reconciliation service or reconciled-state persistence exists. Next work must specify evidence completeness, negative evidence, interval boundaries, identity review, subsequent departures and as-of knowledge before asserting canonical current presence.
