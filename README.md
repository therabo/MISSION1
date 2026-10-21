<p align="center">
  <img src="frontend/public/branding/MISSION1-logo.png" alt="MISSION1" width="800">
</p>

# MISSION1

A self-hosted ISS mission-data application with a React/Cesium Earth View, one
Java/Spring backend and PostgreSQL. Public observations retain their provenance,
timestamps, units and quality. GP/TLE orbital state is computed with Orekit;
NASA OEM is source-provided predicted ephemeris. Neither is live onboard position telemetry.

## Quick Start

Install **Git** and **Docker with Compose 2.24.0 or later**, and start Docker.
Use Docker Desktop on macOS/Windows (Linux containers), or Docker Engine with the
Compose plugin on Linux. A modern browser with hardware-accelerated WebGL and
internet for the initial build/public sources are needed.

```sh
git clone --depth 1 https://github.com/therabo/MISSION1.git
cd MISSION1
docker compose up --build --wait
```

Open **[http://localhost:8080](http://localhost:8080)**.

Build tools and PostgreSQL run inside containers. No API key or `.env` setup is
required. The first build downloads dependencies; subsequent builds reuse caches.
The default port binds only to your own machine, not the LAN.

Healthy containers mean the platform is ready. Mission data arrives asynchronously;
a temporary public-provider failure does not mean installation failed. Crew has
initial acquisition gates of approximately 5–15 minutes and can take longer to
publish qualified data. Missing data remains unavailable. See [source behavior and
first-run details](backend/README.md).

## Stop, restart and update

| Action | Command |
| --- | --- |
| Stop, keeping database history | `docker compose down` |
| Restart | `docker compose up --wait` |
| Rebuild | `docker compose up --build --wait` |
| Status | `docker compose ps` |
| Logs | `docker compose logs --tail=100` |

Update without deleting the database volume:

```sh
git pull --ff-only
docker compose up --build --wait
```

**Reset deletes this installation's PostgreSQL data and historical observations.**
Use it only when deliberately discarding that data:

```sh
docker compose down -v
docker compose up --build --wait
```

Existing pre-publication databases with old Flyway histories require a new empty
database or deliberate reset; they are never repaired or erased automatically.
Future public schema changes add migrations and preserve the released V1 checksum.

## Optional configuration

Defaults work without creating `.env`. The optional [.env.example](.env.example)
documents `MISSION1_HTTP_PORT` (8080) and the local-only `MISSION1_DB_PASSWORD`
(`mission1_local`). PostgreSQL and backend HTTP have no host ports by default;
management health is internal and is not proxied by nginx.

For an occupied HTTP port, POSIX shells can use:

```sh
MISSION1_HTTP_PORT=18080 docker compose up --build --wait
```

In PowerShell, set `$env:MISSION1_HTTP_PORT='18080'`, then run the normal Compose
command. Changing the password variable on an existing volume does **not** rotate
the database role's password; use matching existing credentials or deliberately
manage that role. Never reset data automatically to resolve a password mismatch.

This is a single-host installation with `unless-stopped` restart policies, not HA
or automatic backup/replication. Unhealthy status alone does not restart containers.
Remote internet hosting requires an intentional access/security configuration.

## Develop MISSION1

For native hot reload, use Java 21, Maven 3.9.x and Node 24.15+ with npm
([frontend/.nvmrc](frontend/.nvmrc) records the tested native version).
Start only the developer database with the explicit override and a separate project:

```sh
docker compose -p mission1-dev -f compose.yaml -f compose.dev.yaml up -d --wait postgres
```

This publishes PostgreSQL on `127.0.0.1:5432`, using a separate named volume, and
starts no application containers. Stop another database using that port before
starting this development project. In `backend/`, run `mvn spring-boot:run`;
in `frontend/`, run `npm ci` then `npm run dev`. Open Vite's printed URL.
Stop the developer database with the same `-p`/`-f` options and `down`.

Backend tests: `mvn clean verify` with Java 21 and Docker/Testcontainers.
Frontend: `npm test`, `npm run typecheck`, `npm run build` with the supported Node.
Vite preview is a local build check; ordinary installation serves production static files.

## Architecture and contracts

- [Backend setup, acquisition and APIs](backend/README.md)
- [Earth View, Inspection and native frontend setup](frontend/README.md)
- [Current production architecture](docs/architecture/current-production.md)
- [Installation decision](docs/adr/0029-one-command-self-hosted-installation.md)
- [Architecture decisions](docs/adr/README.md)
- [Public database baseline](docs/architecture/database-publication-baseline.md)
- [Component telemetry, record dates and source limits](docs/telemetry/module-telemetry.md)
- [Production cleanup inventory and validation](docs/maintenance/production-code-cleanup.md)

The backend owns acquisition, normalization, persistence and read-only APIs.
Crew uses canonical identity, source-directed resource acquisition, shadow identity
research, qualified operational binding and one membership/lifecycle policy shared
by Current and installation-relative Historical. No operational source history is
bundled in a fresh database.
