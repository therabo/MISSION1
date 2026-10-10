# Canonical Crew identity and retained profile projection

ADR-0013 adds a reviewed overlay to V3–V6. It preserves permanent UUID anchors, original provider mappings, source observations, occurrences, resolutions and reconciled history. Provider identities, UUID equivalence and operational subject resolution remain separate concepts.

## Reviewed scope

The tracked `backend/src/main/resources/crew/reviewed-identities-v1.json` declares exactly two approved pairs:

| Human | LL2 PERSON | NASA PERSON_PROFILE_RESOURCE | Supporting NASA resources |
|---|---|---|---|
| Luke Delaney | 710 | profile:nasa-astronaut-luke-delaney | people:129838, topic:619970 |
| Jessica Watkins | 582 | profile:jessica-watkins | people:88101, topic:255064 |

WordPress people/topic IDs identify website resources. They are typed separately and are not global personnel identifiers. The manifest retains exact capture hashes, URLs, timestamps, locators and bounded evidence summaries from the completed investigation, including an optional FK to an already retained operational assertion. Secondary references support review; they do not authorize matching. Jessica Meir is distinct. Andrey/Andrei Fedyaev has no approval and stays unresolved.

## Storage and maintenance

Flyway V7 creates `crew_identity_binding_version`, `crew_person_equivalence_decision` and `crew_identity_decision_evidence`. Decisions and proofs are append-only. Deferred constraints require proof to commit with every binding/equivalence decision; evidence has one owner and valid lineage FKs. Typed keys and ordered UUID pairs have one root; each next decision must explicitly name its latest predecessor. Latest-version selection happens before status filtering, so revocation cannot reveal an older active row.

The earliest anchor by `created_at`, then UUID lexical order, is representative. Equivalence is a reviewed direct star. Cycles, self/reverse pairs, incompatible representatives and implicit chains fail closed. Knowledge reads use two set queries at a supplied knowledge time; person reads expand aliases in a batch. They never resolve or write identities.

`JdbcCrewIdentityRepository.preview` validates the whole manifest without writes. `apply` runs in one transaction under the same advisory lock as LL2/NASA identity allocation. Missing source identities create pending declarations, never people. Successful ingestion/resolution and startup synchronize approved declarations outside GET; process restart and concurrent writers do not duplicate decisions. Source arrival order affects which UUID was created first, while approved provider identities converge on one canonical class once both are available.

`revoke` appends reversals to both equivalence and all related bindings, including pending bindings. Automatic synchronization cannot undo a revocation. `supersedeBinding` requires an explicit reviewed target, bounded proof, correction reason and expected latest predecessor; stale reviewers fail. Database FKs prevent fabricated targets. Future reviewed Fedyaev work requires a separate approved binding/subject-resolution decision with reproducible evidence; no transliteration or name rule is needed or authorized by this milestone.

For local review, start the ordinary backend with `--mission1.crew.identity.review-mode=DRY_RUN`, inspect its bounded report, then restart with `APPLY` only after expected representatives and no conflicts are confirmed. `OFF` disables startup synchronization for tests/inspection. Default is `APPLY`; accepted manifests synchronize during source writes too. Disable source schedules during an isolated maintenance comparison using the existing source flags. These modes do not add HTTP write routes or external requests.

## Resolution and field authority

Approved typed bindings take priority; original mappings/audits remain available. Existing accepted v1 decisions keep their audit method. New unique names are review candidates: they cannot automatically join humans. A validated unknown official NASA profile can create its own anchor. A spelling, agency, biography or mission similarity cannot establish equivalence. Candidate metadata follows successful run capture order, including A→B→A; a changed decision appends a new resolution even when an older value recurs.

Assignments and resolved subjects are canonicalized before the temporal reconciliation engine. Collection/detail metadata uses the newest successfully retained LL2 profile independently of current assignment membership. The latest same-provider profile replaces nullable fields whole: removal stays null, career durations are not summed, and the existing portrait-rights gate is unchanged. LL2 owns structured profile/assignment/expedition fields; NASA owns retained operational assertions. An available profile with no current assignment is valid.

The additive `canonicalProfile` object contains canonical/requested UUIDs, retained aliases, policy markers, profile availability/fetch/observation lineage, typed NASA profile resources, and field authority/observations. Existing fields and routes retain their meaning. Alias detail URLs return HTTP 200, canonical `id` and `requestedId` indicating the requested alias; there is no redirect. Reconciliation request timestamps can differ across separate requests.

Replay uses canonical identity and latest retained metadata at `knownAt`, with operational assignment/presence at T. `EFFECTIVE_TIME_BEST_CURRENT_RECONSTRUCTION` and `LATEST_AVAILABLE_CANONICAL_METADATA` remain unchanged. New review knowledge may improve identity in old T without importing a future assignment. The engine marker is `crew-reconciliation-v3/crew-canonical-identity-v1`; stored older interpretations are preserved.

See [validation](canonical-identity-validation/README.md) for retained-data and browser evidence.
