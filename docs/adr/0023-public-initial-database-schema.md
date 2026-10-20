# ADR-0023: One schema-only initial database migration before publication

Status: Accepted
Date: 2026-10-14

**Schema placement clarification — 2026-10-21:** the final clean-install
[baseline consolidation](../architecture/database-publication-baseline.md#final-clean-install-consolidation--2026-10-21)
incorporates all former V1/V2/V3 schema effects into canonical V1. Previous development
Flyway histories require deliberate recreation. Migration labels below retain their
dated meaning; schema, data authority and acquisition decisions are unchanged.

## Context

MISSION1 is preparing its first public installation. The development schema grew
through thirteen migrations while Crew identity, resource acquisition, research,
operational binding and membership were validated. That chain contains development
terminology and initializes mutable coordination registers. No public database
upgrade commitment exists. The owner explicitly discards development databases
and requests one clean initial public schema.

## Decision

Replace the active development chain with `V1__initial_schema.sql`. It contains
DDL only, organized by domain, and directly creates the final PostgreSQL schema.
Tables, columns, indexes, constraints, sequences, views, functions and triggers
use domain terminology. Application persistence speaks these names directly,
without aliases or an upgrade migration. Git retains the old migration history.
Future public changes begin with V2 and preserve public migration checksums.

Flyway leaves every domain table empty. Application initialization separately
creates six mutable coordination registers, idempotently and transactionally.
The existing packaged reviewed identity manifest and frozen research resources
remain explicit application reference inputs. Normal acquisition and workers
create source observations, resources, decisions, memberships and orbital history.

Remove pre-publication rollback selectors, the startup occurrence backfill and
readability of old resolver audits. Current always publishes compatible sealed
membership; Historical always evaluates the same lifecycle at effective T.
Retain fail-closed gates, independent typed provider identities, reviewed canonical
equivalence, explicit canonical fallback when no operational head exists, truthful
unassociated evidence, immutable history and the research SHADOW authority boundary.
Frozen model/parser/release identifiers retain their provenance meaning.

This supersedes only development migration/rollback compatibility clauses in
earlier ADRs, particularly ADR-0021. Their identity, source, lifecycle, scheduling,
provenance and rendering semantics remain accepted.

## Alternatives considered

- V14 renames plus the old migration chain would preserve upgrade compatibility
  that the owner explicitly rejects and expose development history in new installs.
- A raw schema dump would retain incidental ordering/environment details and make
  ownership and invariants harder to review. Catalogs and a schema-only dump are
  comparison evidence; the migration is ordered, reviewed DDL.
- SQL bootstrap rows would obscure the separation between structure and runtime
  state. Explicit application initialization can preserve cooldowns and progress
  across restart while leaving Flyway itself entirely empty.

## Consequences

PostgreSQL trigger execution order remains unchanged within each timing/event/
row-or-statement class. Explicit `a_`/`b_`/`c_` prefixes on seven notification
triggers preserve the existing notification and lock sequence after domain renaming.

New installations create the final schema directly. Development databases cannot
be upgraded, repaired or baselined into this public chain; use an empty database
or deliberately discard the local development volume. Historical coverage depends
on evidence acquired by the installation; no database restore or backdated capture
is required. Deployment scheduler namespaces and Historical's development-era
wire mode are normalized together with code, tests and current documentation.

The public schema retains the accepted ownership, uniqueness, time/hash, append-only
and atomic-proof invariants. Fresh-schema, zero-data, restart, offline domain,
numerical, live bootstrap and browser validation are publication gates.

[Publication dossier](../architecture/database-publication-baseline.md) ·
[Schema inventory](../architecture/database-publication-schema.md).
