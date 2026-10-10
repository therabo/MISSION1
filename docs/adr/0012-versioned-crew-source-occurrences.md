# ADR-0012: Versioned Crew source occurrences and compatible-version selection

- Status: Accepted
- Date: 2026-10-10
- Scope: NASA Crew ingestion, immutable history, Current and effective-time Replay

## Context

The completed source investigation found evidence 4 and 12 are compatible versions of the same unchanged aboard paragraph. A Jessica Meir profile-link edit changes the paragraph-wide evidence hash and duplicates an unchanged unresolved Fedyaev subject. NASA RSS supplies a stable article GUID/WordPress resource identity, but no paragraph or person-mention ID. Routes can change without changing the article. Names, subject indices and website resource IDs are not canonical human identities.

The source specification and complete retained-data simulation remain outside Git at `/Users/daniel/.codex/exports/mission1-crew-source-investigation/`: five evidence versions, four assertion candidates, eleven subject occurrences and twelve subject payload versions. No authoritative NASA Andrey/LL2 Andrei mapping was found.

## Decision

Add immutable source article observations, logical assertion occurrences, logical subject occurrences, subject metadata versions and links to existing evidence/subject rows. Article identity uses the verified NASA RSS WordPress GUID; preserve literal GUID/link and observed URL. An assertion occurrence is a source-scoped typed claim across compatible revisions; a subject occurrence is a mention under that claim. Existing evidence is an immutable interpretation version. Canonical persons retain independent UUIDs and audited identity mappings.

Start with the investigation's exact NFC/whitespace-normalized paragraph-scope candidate, article/station/type/classification and event-or-publication temporal role. Require unique raw scope, compatible ordered targets/count/completeness/source category and identical parser/method semantics. Conflicting strong subject keys prevent association. No prose similarity, namesake grouping, index-based continuity or speculative article identity fallback. Unsupported or ambiguous legacy versions remain independent. Associations are deterministic, append-only and idempotent; backfill has a read-only dry run before supported writes.

A pure shared selector supplies one latest successfully observed compatible interpretation before both Current reconciliation and Replay effective-time evaluation. Order by actual successful acquisition lineage, including repeated 200/304 observations of reused bodies. Equal-time conflicting payloads remain separate; IDs and parser versions do not decide source meaning. Select the newer representation even when its metadata is null. Identity enrichment is separate and deferred.

Keep all raw documents, evidence hashes/IDs, subjects, associations and resolution audits unchanged. Alternative versions remain internally queryable. Reads perform no backfill, identity writes or network requests. A startup/ingestion write boundary maintains associations; read-time selection only consumes durable inputs. Replay remains best-current reconstruction effective at T, not knowledge-as-of-T; distinct event/claim scopes survive and no acquisition-before-T rule is added.

## Alternatives considered

- Name grouping or public DTO `.distinct()`: conflates humans/claims or merely hides duplicates after counts and reconciliation; cannot express version choice.
- Canonicalized evidence hashing: erases metadata revisions and cannot repair existing immutable history or establish paragraph continuity.
- Latest whole-feed/article filtering: bounded-feed eviction and edited prose can remove independent effective events.
- Separate Current/Replay grouping: duplicates policy and risks conflicting temporal/provenance behavior.
- Destructive evidence rewriting: violates immutable history and obscures source/parser revisions.

## Consequences

Current/Replay count interpreted occurrences, while raw version counts remain audit quantities. Fedyaev appears once as an unresolved source occurrence without a new person mapping. The additive model needs constraints, indexes and conservative backfill. Exact-scope continuity intentionally under-merges edited/reordered prose; future parser compatibility and editorial correction rules require explicit decisions. Application downgrade can ignore the new tables without reversing Flyway or deleting history. No frontend grouping, profile crawler, provider request, infrastructure or dependency is introduced.

See [validation and implementation details](../crew/source-occurrence-versioning-validation/README.md). ADR-0007–0011 retain their authority, identity, freshness and effective-time contracts.
