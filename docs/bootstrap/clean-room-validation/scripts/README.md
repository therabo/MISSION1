# Isolated clean-room runner

These opt-in Python standard-library helpers support the actual MISSION1 stack:
one packaged backend and PostgreSQL 16.10. They never import application rows,
run a repair endpoint, or invoke ingestion/scoring/materialization directly.
Inventory the release first; extend isolation if a future release adds another
real state store. A successful start is not full bootstrap acceptance.

Prerequisites: Java 21, Maven, Docker Compose, Python 3, `lsof`, and free loopback
ports. All output, disposable credentials and generated builds must stay outside
the checkout. Use a new evidence directory per validation. The password file is
created with mode 0600 and must never be committed.

```sh
export MISSION1_CLEANROOM_EVIDENCE=/absolute/private/mission1-validation
mkdir -p "$MISSION1_CLEANROOM_EVIDENCE/build"
python3 docs/bootstrap/clean-room-validation/scripts/run.py protect \
  mission1-postgres-1 mission1 5432 8080 4175 5175
git archive HEAD backend | tar -x -C "$MISSION1_CLEANROOM_EVIDENCE/build"
JAVA_HOME=/path/to/java21 mvn -f "$MISSION1_CLEANROOM_EVIDENCE/build/backend/pom.xml" \
  -DskipTests package
export PATH=/path/to/java21/bin:"$PATH"
python3 docs/bootstrap/clean-room-validation/scripts/run.py provision \
  first 55432 18080 14175 build
python3 docs/bootstrap/clean-room-validation/scripts/run.py monitor first
```

`protect` reads Docker metadata, all public-table row hashes/counts, Flyway history
and selected canonical GETs. It refuses to replace the protection manifest.
Hashes are integrity evidence, never inputs to bootstrap. It does not export
table contents or database backups. Record all other canonical processes/stores
in the validation dossier as well.

`provision` requires free ports, creates a unique Compose project, database,
credentials, container, network and named volume, and proves there are no public
tables before starting the backend. The runtime image matches the repository's
normal PostgreSQL image. All MISSION1/Spring overrides and JVM option injection
variables are removed from the subprocess environment. Only the isolated
datasource and HTTP bind/port are supplied. Scheduler and authority defaults are
preserved. The runner copies the packaged jar once to an immutable file, so a
later Maven build cannot replace a running archive.

The guard checks published database port, database name, exact container ID,
volume ownership, project ownership, network membership and application ports
against the canonical manifest. Loopback host is shared intentionally; the
resolved persistence endpoint `(host, port, database)` must differ. Source
metadata cannot override the datasource. No canonical connection string is
passed to the test backend.

`monitor` performs only SELECT transactions and Current/state GETs every 30s;
it never accelerates a scheduler. It records initial post-migration/startup
counts and appends HTTP observations. It does not certify semantic correctness,
source budgets, or source availability. Current/Historical/orbital and browser
validation must still be performed and classified explicitly.
It records the first observed HTTP 200 milestone for Current and Orbit. The
original post-migration snapshot is preserved across monitor restarts. In another
terminal, `run.py check first` saves/prints a compact guarded status and returns
2 until both endpoints serve HTTP 200. This endpoint check is a readiness signal;
DEGRADED identity/lifecycle/history still requires semantic review.

For the frontend, build/run a separate code-only copy with a temporary Vite
configuration whose `/api` proxy targets the isolated backend. The repository's
default proxy targets 8080; do not use that default for clean-room QA. Use fresh
browser contexts and capture both requests and actual returned clean-room UUIDs.
Do not copy an existing browser profile or service cache.

Set `cacheDir` explicitly to a brand-new external directory and launch Vite with
`--configLoader runner`. A symlink to existing `node_modules` otherwise lets Vite
write dependency/configuration compilation caches into the canonical checkout.
Prefer installing dependencies in the external copy; shared dependencies must be
read-only, and shared dependency directories are never application-data inputs.
For background processes, record the monitor PID in `LABEL-monitor.pid` and the
owned Vite PID in `LABEL-frontend.pid` in the evidence directory so shutdown can
verify their commands and stop them.

Collect a final read-only snapshot before shutdown:

```sh
python3 docs/bootstrap/clean-room-validation/scripts/observe.py \
  first-final UNIQUE_CONTAINER UNIQUE_DATABASE 18080
python3 docs/bootstrap/clean-room-validation/scripts/run.py stop first destroy
```

`stop` verifies the application command and port before signalling the owned
process. Destruction validates the exact project/container/volume/network again,
requires the network to contain only the owned database, prints the deletion
list, and addresses each resource individually by verified ID/name. There is no
global prune, wildcard volume removal, database cleanup SQL or `down -v` path.
If ownership differs, it aborts. Preserve evidence before destruction. Repeat
with a new label and ports; a reused populated database is not a second empty run.
Run with ordinary Python: optimized `-O` execution is explicitly rejected because
the ownership and endpoint guards use assertions.
