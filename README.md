<p align="center">
  <img src="frontend/public/branding/MISSION1-logo.png" alt="MISSION1" width="800">
</p>

# MISSION1

One Java/Spring application, PostgreSQL and a React/Cesium Earth View. Public ISS
source observations retain their provenance, timestamps, units and quality.
GP/TLE orbital state is computed with Orekit; NASA OEM is source-provided predicted
ephemeris. Neither is live onboard ISS position telemetry.

The backend owns acquisition, normalization, persistence and read-only APIs. Crew
uses Canonical Identity, Crew Resource Acquisition, Identity Research (**SHADOW**),
Operational Subject Binding and one Crew Membership/Lifecycle policy shared by
Current and installation-relative Historical. Dynamic Mission/Resource Discovery
follows qualified source relations.

- [Backend setup and contracts](backend/README.md)
- [Earth View, Inspection and frontend setup](frontend/README.md)
- [Current production architecture](docs/architecture/current-production.md)
- [Architecture decisions](docs/adr/README.md)
- [Public database baseline](docs/architecture/database-publication-baseline.md)
- [Production cleanup inventory and validation](docs/maintenance/production-code-cleanup.md)
- [Component telemetry, record dates and source limits](docs/telemetry/module-telemetry.md)

From the repository root, start PostgreSQL with `docker compose up -d --wait postgres`,
then run `mvn spring-boot:run` in `backend/` and `npm run dev` in `frontend/`.
Java21 and Node24 are required.

Fresh installations apply only `V1__initial_schema.sql`, including telemetry and
retained-provider coordination. The final consolidation replaces the previous
V1/V2/V3 chain; databases carrying that history require deliberate recreation or a
new empty database. No upgrade/repair compatibility is provided. After pulling this
change, run `mvn clean verify` in `backend/` to remove stale compiled migrations.
Flyway creates structure only; runtime sources rebuild operational history.
