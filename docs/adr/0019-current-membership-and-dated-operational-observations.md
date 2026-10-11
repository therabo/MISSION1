# ADR-0019: Current membership and dated operational observations

Status: Accepted — 2026-10-11

## Context

ADR-0017 publishes V10 ACTIVE humans through V7 canonical identity. The operational
presence enum remains a separate reconciliation result. Four current people had
14-day completed-entry implications, while three had expired 72-hour named aboard
observations. Both used one article's publication time as a proxy. The UI's primary
green/amber distinction and identity-based explanation obscured this separation.

The completed external presence-automation investigation established that identity
alone does not confirm presence; editorial rosters, LL2 assignments, counts and
operational reports have different authority. Public sources do not provide
continuous individual physical-presence telemetry.

## Decision

Every production Current member receives the same primary **Current member** state,
derived from the V10 selection and V7 publication boundary. Dated named operational
evidence is secondary. Observations say **Operational presence recently observed**;
completed entries say **Operational entry confirmed**. Expired evidence says **No
recent operational confirmation** and retains its type/date. Missing evidence and
unavailable verification are explicit. Identity wording does not explain presence.

Current named `PERSON_CURRENTLY_ABOARD/OBSERVED` applicability becomes seven days,
inclusive at the boundary. `crew-freshness-v2` records `PT168H`; count applicability
stays 72 hours and completed entry/departure implications stay 14 days. Explicit
event time takes precedence over publication fallback in v2. Old v1 revisions are
immutable. Public Replay retains its accepted v1 applicability and effective-time
contract, with no V10 lifecycle activation.

NASA operational parser 1.2.0 adds bounded typed activity clauses in validated ISS
blog content. A named subject must perform a supported current/recent activity at
an explicit station location in that activity's scope. Source subjects, personal
URLs and excerpts are retained; no canonical human is emitted. Publication time
is a marked proxy unless a supported explicit activity clock is available. Captions,
quotes, future/planned/historical/biographical mentions, generic lists and foreign
subject clauses do not establish presence. Existing named transition semantics keep
their prior immutable evidence identities. Reinterpretation appends to existing
V1–V10 structures and preserves capture lineage and independent source health.

Current refetches the same-origin REST endpoint every 120 seconds after completion
while its UI is active and the page visible. Reads are serial, abortable and retain
last-good data on failure. Historical pauses Current polling. Selection is preserved
by UUID while present; a departing selection returns to the roster. Scene/camera
ownership does not change. GET never ingests, resolves, scores or materializes.

## Alternatives considered

- Operational-only primary status: partial reports and finite applicability obscure
  otherwise supported Current membership and visitors.
- LL2/editorial quorum: waits for both sources, loses visitors and unresolved
  cross-source identities, and still does not prove physical presence.
- Extending age rules only to make badges green: misrepresents the requested meaning.
- Promoting V9 generally or merging names: outside the accepted authority boundary.
- Provider calls or reconciliation from GET: violates read isolation and source budgets.

## Consequences

Current membership is understandable across all published humans while operational
dates, reason types and limitations remain visible. Qualified recurring activity can
advance a bound human's last observation without changing older facts. Typed source
links do not by themselves satisfy V9 personal corroboration: unresolved operational
subjects remain a real automation limit. Visitors require a retained provider-safe
anchor. Successful omissions end only their own support; qualified departures veto
lagging positives until strictly later operational reentry. Outage and observation
expiry do not fabricate departures.

The one-application/database architecture remains sufficient. Polling adds at most
30 regular Current reads/hour per continuously visible panel, plus visibility/manual
reads, with no source traffic. Backend eventual consistency and publisher lag remain;
this milestone does not add an age-only projection rejection rule.

See [validation and real source results](../crew/current-operational-presence-validation/README.md).
