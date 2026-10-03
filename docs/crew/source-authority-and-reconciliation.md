# Crew source authority and implemented reconciliation

LL2 and NASA observations stay independent. A provider's overall priority or a boolean verified flag cannot explain field, time, identity or completeness.

| Field | Authority | Boundary |
| --- | --- | --- |
| Source biography/career/agency/nationalities/media/role | LL2 structured profile/assignment | NASA interpretation never rewrites these observations. |
| Structured current expedition and assignments | LL2 active detailed expedition | Assignment is not physical presence. NASA expedition mentions remain contextual evidence. |
| Positive physical presence and completed named arrival/departure | Time-qualified official NASA assertion | Subject resolution, completed status and applicability are mandatory. |
| Official count | Separate official NASA count assertion | It can exceed resolved identities. No person is fabricated. Later completed transition invalidates an older count. |
| Derived current state | Versioned reconciliation | May be partial, unavailable, stale or ambiguous; original observations survive. |

CrewAssignment != StationPresence. LL2 in_space != currentlyAboardIss. Planned event != completed event. Partial omission != departure.

The authoritative [implemented design](nasa-verification-and-reconciliation.md) defines all eight exact status rules and precedence, identity hierarchy, source acquisition, temporal/freshness policy, immutable persistence and failure semantics. Live operational lists are PARTIAL, count assertions COUNT_ONLY and hatch assertions EVENT_ONLY. No live source is treated as an exhaustive roster. Exhaustive omission is available only to explicitly classified, fully resolved source evidence after a person's prior known presence.

The [2026-10-03 live validation](reconciliation-validation/README.md) produced PARTIAL_MATCH: six shared resolved identities, one LL2-only name, two NASA-only resolved UUIDs and three unresolved NASA subjects, with a separate official count of eleven. This is dated evidence. The narrower capture does not demonstrate a measured LL2 update delay and is not automatically NASA_AHEAD. The earlier source-validation divergence remains preserved as historical context.

Event time takes precedence within person-presence scope when explicit; publication is the fallback assertion context. Retrieval never rewinds event ordering. Planned/future claims are inert, equal-time conflicts ambiguous, unrelated partial articles cannot imply departure, and old historic events can remain true while their current implications become stale. No runtime search, LLM or fuzzy matching is used. [ADR-0007](../adr/0007-independent-crew-observations-and-field-authority.md), [ADR-0008](../adr/0008-immutable-crew-source-history-and-identity-anchors.md) and [ADR-0009](../adr/0009-field-aware-crew-reconciliation.md) remain consistent.
