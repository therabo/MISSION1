<p align="center">
  <img src="MISSION1-logo.png#gh-dark-mode-only" alt="MISSION1" width="800">
  <img src="MISSION1-logo-black.png?v=73f4fd8#gh-light-mode-only" alt="MISSION1" width="800">
</p>

---

### Overview

MISSION1 is a full-stack web application for exploring the International Space Station as a continuously updated and historical system. It combines an interactive 3D experience with a backend that continuously acquires, validates, reconciles and persists orbital, telemetry and crew data from multiple public sources.

MISSION1 goes beyond simply tracking the ISS position. It maintains a source-aware representation of the station over time. Scheduled ingestion and reconciliation pipelines keep the system up to date as orbital data changes and new expeditions, missions and crew information become available, without requiring manual dataset updates.

Users can follow the ISS orbit, move between current and historical states, inspect the station module by module, explore available telemetry and discover the crew associated with the selected time.

<p align="center">
  <img src="assets/readme/mission1-demo.gif" alt="MISSION1 interactive ISS exploration demo" width="100%">
</p>

---

### ISS Tracking & Historical position

MISSION1 renders the ISS orbit in 3D from CelesTrak GP/TLE data propagated locally with Orekit. A secondary NASA OEM source provides source-supplied predicted ephemeris when coverage is available, while remaining distinct from the locally computed orbital state.

Historical mode reconstructs the station position at a selected UTC time from retained orbital data, allowing the same interface to move seamlessly between present and past.

<p align="center">
  <img src="assets/readme/earth-historical.gif" alt="MISSION1 Earth historical exploration demo" width="100%">
</p>

---

### ISS Telemetry

Selecting an ISS module exposes the telemetry available for its supported components. The backend ingests, normalizes and stores readings from multiple public ISS telemetry sources, preserving timestamps and provenance to provide both current and historical measurements.

Unavailable data is represented explicitly rather than being synthesized or silently replaced.

<p align="center">
  <img src="assets/readme/iss-telemetry.gif" alt="MISSION1 ISS telemetry demo" width="100%">
</p>

---

### Crew

MISSION1 provides a current and historical view of the crew present aboard the ISS. Structured expedition and mission data is reconciled with presence evidence and canonical astronaut identities, allowing membership to evolve over time without relying on a single provider.

Astronaut profiles enrich that operational data with agencies, biographies and career information while preserving the provenance of the underlying sources.

<p align="center">
  <img src="assets/readme/crew.gif" alt="MISSION1 crew exploration demo" width="100%">
</p>

---

### Install

MISSION1 runs as a containerized three-service stack composed of a React frontend, Spring Boot backend and PostgreSQL database.

With Docker Engine and Docker Compose v2 installed, start the complete application from the repository root:

```bash
docker compose up --build --wait
```

Then open `http://localhost:8080`.
