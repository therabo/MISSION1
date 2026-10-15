# Current production architecture

Accepted semantics are governed by ADR-0021 and ADR-0022; ADR-0023 establishes the
first public database baseline and removes pre-publication compatibility. One
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
| Component Telemetry | 131-definition registry, native ISSLIVE, bounded SenseData/ISS.live bootstrap plus durable periodic reconciliation and immutable local current/as-of record queries |
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

Fresh PostgreSQL applies `V1__initial_schema.sql` and schema-only telemetry V2 and retained-coordination V3, defining the final schema
without operational or coordination rows. Normal application initialization creates
its core mutable coordination registers; telemetry adds provider/catalog coordination
after readiness; the existing packaged reviewed manifest and
frozen model initialize their own reference knowledge. Source pipelines populate
all observations, resource work, identity decisions, memberships and orbital history.
Telemetry initializes definitions asynchronously after readiness and acquires actual
source records separately. Existing module cards show each record's date; telemetry
Historical uses recordTime <= T without an installation floor. See
[component telemetry](../telemetry/module-telemetry.md) and ADR-0024/0025.
The development V1–V13 chain has been squashed before first public release. Upgrade
from its databases is deliberately unsupported; those stores must be discarded.

Production operational binding and unified Historical are the only production paths.
Current retains its `ACTIVE_PROJECTION` wire label; Historical uses `UNIFIED_HISTORICAL`.
Research execution uses `IDENTITY_RESEARCH_SHADOW`; production lineage uses
`OPERATIONAL_SUBJECT_BINDING`. Research cannot authorize production identity or
membership. Missing/corrupt/expired projections and incompatible binding heads still
fail closed. Explicit canonical correspondence remains a safety fallback only when
no operational binding head exists. Scheduler namespaces are `identity-research`,
`membership` and `operational-binding`; no rollback selector is supported.

Diagnostic resource/research comparisons live in test scope and are absent from
the production jar. The explicit retained-document reinterpretation command and
the documented `StationPresence` evidence contract remain preserved; ordinary
production acquisition uses its established source services.

Frozen parser/model/policy and source API versions retain their provenance meaning.
Historical dossiers and ADRs describe their original revisions; reproducing dated
scripts requires the corresponding Git checkout, not the public schema.

[Publication schema and validation](database-publication-baseline.md) ·
[Previous code cleanup](../maintenance/production-code-cleanup.md) ·
[Dynamic discovery](../crew/dynamic-resource-discovery.md) · [ADR index](../adr/README.md).
