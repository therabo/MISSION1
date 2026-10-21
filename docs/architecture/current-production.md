# Current production architecture

[ADR-0029](../adr/0029-one-command-self-hosted-installation.md) defines the official
single-host installation: `docker compose up --build --wait` builds and starts
PostgreSQL 16.10, the Java 21 backend and a static nginx frontend/reverse proxy.
Only `127.0.0.1:${MISSION1_HTTP_PORT:-8080}` is host-published. JDBC uses
`postgres:5432`; nginx resolves `backend:8080` through Docker DNS. A named volume
persists through stop/rebuild/update; only deliberate `down -v` deletes it.

Startup waits for PostgreSQL, backend readiness (Spring accepting traffic plus
database connectivity after Flyway), then frontend HTTP health. Liveness follows
Spring liveness only. Public-source failures do not control either probe; nginx
blocks Actuator and no management details are exposed. Runtime app users are
nonroot; `unless-stopped` policies do not restart merely unhealthy containers.
Native Maven/Vite development uses the explicit `compose.dev.yaml` override with
only PostgreSQL selected and a separate `mission1-dev` project. Domain ownership,
source scheduling, APIs and all scientific/visual assets remain unchanged.

Crew portraits are presentation enrichment under [ADR-0028](../adr/0028-dynamic-crew-portraits.md): exact provider HTTPS thumbnail/original, optional reviewed same-person fallback, initials. Source metadata is preserved and no longer gates display; no API/backend/schema changes or bundled portrait requirement. [Contract](../crew/portraits.md).

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

The shared Earth/Inspection Over value is a computed geographic classification
of the same accepted physical WGS84 snapshot as the coordinate readouts. Pinned
Natural Earth country 10m 5.1.1 geometry and individual SVG flags are frontend static assets.
Only country no-country falls through to a separate marine 10m 5.1.0 asset with
16 approved text-only macro names, all-match/priority resolution and independent
verified readiness. Both asset loads start in parallel after initial render;
there is no geography backend, database, runtime GIS or external geocoder.
Historical uses its coherent accepted state against the installed fixed catalogs.
[ADR-0027](../adr/0027-local-country-classification-and-squircle-marks.md) and the
[country/marine source and behavior record](../frontend/over-country.md) govern identity,
cartographic limits, local flags with native geometry and two-line names.

Earth-only camera interaction is bounded by the two supplied visual references;
existing distance/SSE refinement bounds useful Earth detail. Inspection, Reset,
scientific state and distant celestial visibility retain their existing owners.
[Camera-envelope derivation and resource audit](../frontend/earth-camera-envelope.md).

Optional Current cloud imagery is an independent bounded browser visual source,
hidden in Historical; it does not enter orbital/telemetry persistence or replay.
[ADR-0026](../adr/0026-current-only-optional-cloud-imagery.md) and the
[cloud/stellar source record](../frontend/clouds-and-milky-way.md) govern refresh,
rights, fallback and the reproducible NASA sky derivative.

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

Fresh PostgreSQL applies only canonical `V1__initial_schema.sql`, including telemetry
and retained-provider coordination, without operational or coordination rows. Normal
application initialization creates
its core mutable coordination registers; telemetry adds provider/catalog coordination
after readiness; the existing packaged reviewed manifest and
frozen model initialize their own reference knowledge. Source pipelines populate
all observations, resource work, identity decisions, memberships and orbital history.
Telemetry initializes definitions asynchronously after readiness and acquires actual
source records separately. Existing module cards show each record's date; telemetry
Historical uses recordTime <= T without an installation floor. See
[component telemetry](../telemetry/module-telemetry.md) and ADR-0024/0025.
The final clean-install baseline consolidates the previous V1/V2/V3 chain as well
as the earlier development history. Their checksums/history are not upgrade-compatible;
use a new empty database or deliberately recreate the development store. Run a clean
backend build after updating so removed migration resources cannot remain on the classpath.

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
