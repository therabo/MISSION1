# ADR-0014: NASA WordPress Expedition editorial roster source and immutable shadow observations

Status: Accepted

Date: 2026-10-10

## Context

The completed source investigation verified NASA's canonical station research-news topic, its independent Expedition/count statistics, typed Active/ISS taxonomy, exact numeric mission discovery, 75 current representations of historical Expedition pages, dual current roster sections and three explicit personal topic/Biography paths. NASA also publishes contradictory role/agency metadata and a historical wrong-person link. V7 supplies reviewed identity knowledge; automatic entity resolution remains a future milestone.

## Decision

Keep the single Java/JDBC/PostgreSQL Crew module. Bootstrap from the configured canonical research-news URL and its advertised topic REST resource; validate origin, canonical URL and semantic page identity. Discover Active/ISS terms by type, slug and name. Select only one published mission matching topic-derived Expedition N, exact title/slug/canonical URL and validated taxonomy. Ambiguous, empty or incompatible discovery fails closed. A bounded broad probe records incomplete collection coverage without inventing completeness.

Reuse `crew_document_body` and `crew_source_document`; keep V6 NASA-blog identity separate. Add typed editorial resources, immutable resource/roster/member/fact/relation versions and complete acquisition lineage in V8. A→B→A reuses semantic A and selects it by its latest successful capture. Exact role, agency, caption, link and section disagreements remain attributed. Slots have no canonical UUID. Verify explicit personal topic→Biography→people paths independently against the named subject; a wrong link is retained as rejected. CMS resource IDs have separate namespaces and are not universal personnel IDs.

Use independent topic, Expedition and personal-resource acquisition/health, alongside unchanged operational-feed health. Count parser failure affects only count; profile failure affects only that resource. Failed capture retains last-good roster. Topic/mission poll about every two hours, bounded discovery six hours, taxonomy and personal resources seven days. Shared NASA pacing is project policy (one request/second, at most two simultaneous), with durable cooldown, bounded bodies/DOM/links/redirects and no synchronous retry. Event-window acceleration is deferred.

This source is shadow-only. LL2 remains primary for structured assignment, Expedition and station role. NASA operational evidence remains primary for physical presence and completed transfers/count. An editorial roster does not establish physical-presence truth; omission is not completed departure; website count is not onboard telemetry; WordPress publication/modification is not crew-event time. Public Current membership/counts/presence, UUIDs, V7 decisions and Replay remain unchanged. Every GET remains network-free and write-free.

The internal comparison uses existing canonical bindings where available and exposes unresolved slots and diagnostic unique-name candidates separately. It creates no human mappings. Persisted typed slots, about-resource relations and personally scoped flight captions are future V8 evidence inputs, without scoring or automatic decisions. Future Current activation needs its own contract/milestone. Future editorial Replay must select successful capture≤T; CMS modified, mission start and publication cannot backdate captured membership. Historical pages collected today are parser fixtures, not observations of past website state.

## Alternatives considered

Operational EXHAUSTIVE evidence or a fake LL2 snapshot would conflate editorial membership with occupancy/assignment. Reusing V6 article keys would erase resource types. Changing legacy sync runs would require every source-wide selector to change and endanger the frozen public path; a separate small acquisition table isolates the new streams without another service. A generic event/graph platform, crawler or probabilistic resolver exceeds this milestone.

## Consequences

Independent retained evidence becomes available without public behavioral changes. Storage and adapter maintenance increase; undocumented NASA markup and collection coverage can degrade. Raw captures and versioned parsing support diagnosis/reprocessing, while restrictive FKs and immutable triggers protect history. Profile caching avoids per-person routine refresh. Validation covers semantic fixtures, security, idempotency, PostgreSQL restart/constraints, independent health, shadow comparison, protected legacy fingerprints and unchanged GET/browser behavior.
