# Current production architecture

Accepted semantics are governed by ADR-0021 and ADR-0022. This naming cleanup changes
no architecture, schema, source authority, threshold, API or rendering policy. One
Java21/Spring application and PostgreSQL remain the complete backend deployment.

| Responsibility | Current implementation |
| --- | --- |
| Canonical Identity | `CrewCanonicalIdentity`, `CrewCanonicalPersonResolver`, reviewed identities, provider bindings and equivalence |
| Crew Resource Acquisition | `NasaEditorialSource`, `NasaEditorialParser`, `CrewEditorialRepository`, `CrewEditorialConfiguration` |
| Identity Research (SHADOW) | `crew.research`, `IdentityResearchWorker`, `IdentityResearchStore`, frozen model and `IdentityResearchGraph` |
| Operational Subject Binding | `OperationalBindingWorker`, `OperationalPolicy`, `OperationalProductionBindings` |
| Crew Membership/Lifecycle | `ActiveMembershipPolicy`, `RetainedMembershipInputs`, `ActiveMembershipStore` |
| Current Crew | `ProductionCurrentMembership`, compatible sealed membership and canonical publication |
| Historical Crew | `UnifiedCrewReplay`, the same pure lifecycle at effective T with present binding knowledge |
| Dynamic Mission/Resource Discovery | `OperationalResourceDiscovery`, source-advertised qualified relations and bounded acquisition |
| Orbit | CelesTrak GP/TLE acquisition, durable eligibility scheduler, Orekit propagation, NASA OEM |
| Earth and Inspection | One Cesium Viewer with backend-derived physical samples, Earth Reset and Inspection transitions |

General identity research cannot authorize canonical identity or production
membership. Operational binding targets only existing publishable canonical humans;
all frozen thresholds, margins, witnesses, contradictions and temporal gates remain.
Completed departure vetoes persist until strictly later qualified reentry. Current
materializes outside GET; Historical evaluates at T without backdating captures or
using Current as fallback. Latest profile metadata remains independently attributed.
Historical coverage begins with observations acquired by the installation.

GP starts with one normal eligibility check after readiness; the default interval
is 2h10m and one timer follows `nextEligibleAt`. State is computed from retained
elements, never live onboard telemetry. OEM remains a separately sourced prediction.
No provider/source selection, propagation, camera timing or frame convention changed.

Deployment/wire compatibility keeps `S10_SCOPED_BINDING`, `UNIFIED_V10_S10`,
`HISTORICAL_V10_S10`, `V9_AUTOMATIC_SHADOW`, existing schedule keys and serialized
releases. Explicit `LEGACY_RETAINED_UNION`, `LEGACY_OPERATIONAL_BINDING` and Replay
`LEGACY` remain supported emergency fallback modes. No automatic fallback is added.

Diagnostic resource/research comparisons live in test scope and are absent from
the production jar. The explicit retained-document reinterpretation command and
the documented `StationPresence` evidence contract remain preserved; ordinary
production acquisition uses its established source services.

## Historical vocabulary compatibility

| Historical label | Domain responsibility |
| --- | --- |
| V7 | Canonical Identity |
| V8 | Crew Resource Acquisition |
| V9 | Identity Research (SHADOW) |
| S10 | Operational Subject Binding |
| V10 | Crew Membership/Lifecycle |

Migration files/checksums, persisted SQL/JSON identities, release/model/parser
versions and historical validation dossiers remain unchanged. Historical scripts
refer to the checkout at which they were recorded; reproducing that dated evidence
requires that revision. They are not production entrypoints of the cleaned jar.

[Cleanup audit](../maintenance/production-code-cleanup.md) ·
[Dynamic discovery](../crew/dynamic-resource-discovery.md) ·
[ADR index](../adr/README.md).
