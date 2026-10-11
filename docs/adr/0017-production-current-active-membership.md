# ADR-0017: Production Current activation from active-membership projection

Status: Accepted

Date: 2026-10-11

## Context

V10 already retains transaction-sealed positive-support membership revisions. The
legacy public retained union includes former crew. Activation must change inclusion
without promoting V9 identity, replacing profiles, or changing historical selection.

## Decision

The existing Crew REST composition reads the latest committed compatible V10
projection through a separate SELECT-only repository. ACTIVE humans supply membership;
V7 production canonical knowledge and retained production person/provider records
supply public IDs and profiles. A source identity that cannot be represented through
that existing production path is not published. V9 UUIDs and automatic graph edges
never become production canonical decisions. Two active anchors mapping to one public
canonical ID yield one card and an explicit consistency diagnostic.

Default configuration is ACTIVE_PROJECTION. Explicit LEGACY_RETAINED_UNION rollback
restores the old selection only; no data rollback, SQL edit or automatic fallback is
allowed. A missing, incompatible, corrupt, incomplete or UNAVAILABLE latest projection
returns a scoped HTTP 503 ProblemDetail. A committed HEALTHY/DEGRADED result remains a
retained materialized classification, exposing its evaluation time, age and independent
source freshness. The existing worker owns expiry/new-source reconciliation; GET neither
recomputes membership nor creates a second API TTL. When that worker commits UNAVAILABLE,
Current fails closed rather than presenting an empty physical station. Publication is
never a claim that aged source evidence is fresh or that ACTIVE confirms physical presence.

Compatibility checks cover the exact configured policy key, V10 identity mode/schema
contract, original serialized SHA-256, relational input pins and normalized sealed
children. Reads use one repeatable-read transaction. No response membership cache hides
new revisions; existing HTTP no-store remains. No writer, resolver, acquisition or
network client is reachable through the production projection reader.

Existing LL2 assignment, field-authority profile and operational presence/count
composition remain independent. Current member order follows accepted structured
assignment/source order, then stable canonical UUID for visitors. Member cardinality
is the published canonical member-set size, never NASA website count, LL2 count or
operational count. Existing physical-presence counts retain their meanings.

An additive optional membership metadata object records mode/revision/policy/evaluation,
projection health and publication diagnostics. It is absent from unchanged Replay and
legacy rollback JSON. Historical unresolved operational slots no longer populate
Current unresolvedSubjects; detailed V10 source slots remain internal diagnostics,
with only their ACTIVE-scope cardinality in membership metadata. They never become
cards or human counts. Retained people remain directly addressable through existing
canonical/alias detail routes, biographies, career metadata and historical records.

Public detail, Expedition and Replay keep their existing selectors. Replay does not
consult latest V10 state. Operational parser 1.1.0 and immutable departures are unchanged.
V7 remains production identity authority; V9 remains SHADOW. V10 is now production
Current membership authority, superseding only ADR-0016's public activation restriction.

## Consequences and validation

No new migration, service or infrastructure is needed. Current availability now depends
on a compatible retained projection, explicitly scoped to Crew rather than orbital
readiness. Small bounded diagnostics/logs expose publication failures, collisions,
mode, revision, count, age and health without biographies or high-cardinality metrics.

PostgreSQL tests cover compatibility/integrity, rollback, non-publication of shadow-only
identities, canonical collisions, latest revision transitions/restart, visitors, omission,
retained detail and SELECT-only GET. Actual retained-data differential, stable aliases,
profile fingerprints, temporal Replay, query counts, network/write audits and five-size
development/production browser QA defend this activation.

## Subsequent Current presentation contract — ADR-0018

The activation acceptance numbers and captures above remain historical records. The
[Current semantic cleanup](../crew/current-ui-semantic-cleanup/README.md) removes the Reported aboard and unidentified-gap
headlines and their Current-only DTO fields; operational count evidence/history remains
preserved. Current still uses V10 ACTIVE + V7, while V9 stays shadow. Historical/Replay
retains the previous count/report contract. The normal trial instance refreshed source
cuts before that cleanup: projection7 still has seven humans and8/15 ACTIVE/retained slots;
the operational gap changed from11−0 to11−4. That gap is not an unidentified-human count.
