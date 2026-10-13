# Mission Replay architecture

Current production uses the same pure Crew Membership/Lifecycle policy in Current
and Historical, with Canonical Identity and qualified Operational Subject Binding
known today. Source captures must qualify at effective UTC T; profiles remain latest
canonical metadata. Coverage is installation-relative. See the
[current production architecture](current-production.md) and
[ADR-0021](../adr/0021-production-operational-binding-and-unified-crew-replay.md).
The original integration record below describes the earlier accepted boundary.


Accepted in [ADR-0011](../adr/0011-effective-time-mission-replay.md). The composition module depends on Crew and Orbit read ports and pure application logic; neither domain depends on the other. JDBC adapters implement history inventory and retained-body reads. The API establishes a coherent read-only repeatable-read snapshot and delegates one UTC Instant to both queries. No infrastructure, source endpoint or storage schema is added.

Crew selects captured structured observations, reads all currently persisted NASA evidence/resolutions and evaluates the accepted reconciliation engine in explicit effective-time mode. Latest canonical profiles enrich historical identities without supplying operational membership. Orbit reuses the accepted Orekit propagator/frame context and a shared extraction of the existing OEM Hermite position/velocity polynomial. A bounded eight-body hash cache holds immutable parsed OEM vectors only; it does not cache replay answers or invent history.

Coverage unions preserve gaps and constrain source applicability, EOP availability and future time. The empirical orbital gate is FULL over the currently supportable Crew interval, not an unlimited archive. No accuracy truth or onboard telemetry claim is made. Historical paths are omitted; the frontend pauses Cesium at T, suppresses current paths, aborts live polling and uses latest-request-wins historical reads. Viewer/shader/camera lifetime remains unchanged.

No new index is justified by the retained small inventories and measured plans. Future history growth may justify selective metadata queries or indexes; materialized per-second replay is not justified. Knowledge-time replay and RTN remain separate future work. Next milestone is ISS REPLAY EVENT TIMELINE.
