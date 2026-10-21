# ADR-0029: Source-built Compose for single-host installation

Status: Accepted

Date: 2026-10-21

## Context

Ordinary MISSION1 users should run a fresh clone with one application-start
command, without installing Java, Maven, Node/npm or PostgreSQL on the host.
The existing backend and frontend have independent builds; browser requests
already use relative `/api` paths. PostgreSQL and the modular backend boundaries
remain those accepted in ADR-0001/0002. Remote data may legitimately be unavailable.

## Decision

Use `docker compose up --build --wait` as the official self-hosted, single-host
installation. Exactly three services run: PostgreSQL 16.10, the Spring Boot backend
on Java 21, and the production static frontend served by unprivileged nginx.
Multi-stage builds contain Maven and Node/npm; runtime images contain only their
required artifacts. Pin base images to verified amd64/arm64 index digests.
The frontend's existing full typecheck imports two recorded Crew JSON fixtures
from `docs/`. A named build context supplies exactly those files at their existing
relative paths; neither fixtures nor test sources enter the static runtime image.

Publish only frontend HTTP on `127.0.0.1:${MISSION1_HTTP_PORT:-8080}`. Nginx serves
static assets and proxies `/api` to `backend:8080`, preserving paths and responses
and re-resolving Docker DNS after backend replacement. Backend JDBC uses
`postgres:5432`; neither backend nor PostgreSQL has a default host port.
PostgreSQL persists in a named volume. The backend's existing Flyway integration
applies canonical V1; no separate migration service, SQL import or seed is added.

Gate startup on PostgreSQL health, backend readiness, then frontend HTTP health.
Actuator exposes only health, without details: liveness is Spring liveness state;
readiness is Spring readiness state plus database connectivity. Nginx does not
expose management routes. Remote mission-data availability never controls platform
health. Source configuration, schedules, domain contracts and product code stay
unchanged. Restart policy is `unless-stopped`; unhealthy status alone does not
restart a container or conceal failures.

Keep native development through an explicit `compose.dev.yaml` override that
publishes PostgreSQL to loopback. Selecting only `postgres` starts no application
containers. Optional local password/HTTP-port overrides require no `.env` creation.
Default credentials and loopback HTTP are for this local installation, not a claim
of authenticated internet hosting, HA, replication or automatic backups.

## Alternatives considered

- Native installation or the previous hybrid setup requires host toolchains and
  manual process/version management; retain it for contributors.
- A mandatory wrapper adds shell/runtime and Windows maintenance without removing
  Compose; use its native lifecycle commands instead.
- Serving frontend through Spring reduces containers but couples the independent
  Maven/npm builds and static artifact lifecycle unnecessarily.
- GHCR images reduce cold-build time but add multiarch publishing, version and
  security-refresh ownership. Defer until a release pipeline is justified.

## Consequences

Users need Git, Docker with Compose and a browser; cold builds need internet.
Build/download costs are paid once and caches help subsequent builds. Manifest
compatibility is distinct from actual platform testing. `down` preserves data;
`down -v` deliberately deletes it. Updates retain the volume; future public schema
changes add V2/V3 migrations and preserve released V1 checksums. Older development
histories are not repaired or reset automatically.

Validate from a genuinely fresh clone and empty volume: health, schema, proxy
errors, assets/WebGL, persistence/reset, optional overrides, developer startup and
degraded provider access. Keep test evidence outside Git. Anonymous repository
access is a separate publication concern; this decision changes no visibility.
