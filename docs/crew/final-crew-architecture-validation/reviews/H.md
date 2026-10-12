# H — Future empty-database bootstrap risks

Review scope: the NEXT milestone only. Read-only inspection of canonical
`/Users/daniel/Desktop/MISSION1`, starting HEAD
`91664c4111c2c9208ed71609390f6907e484fa64`, with the developing ADR-0021/S10 production
and unified Replay working-tree changes visible. No canonical edits, database writes,
source acquisition, empty-database startup, or fixture imports were performed by H.

**Review disposition: PASS for the requested risk-recording scope.** No bootstrap
success is claimed. These are acceptance questions and risks for the next milestone,
not blockers added to the present retained-data activation/migration milestone.
Primary-agent final acceptance of this milestone remains separate.

## Boundaries that must remain explicit

Fresh Flyway application, V11→V12 upgrade and disposable PostgreSQL integration
tests can prove schema execution, constraints and behavior for supplied test inputs.
They do not prove an automatic product bootstrap from completely empty PostgreSQL
through real acquisition, V7, S10, V10 and correct Current/Historical without copied
production rows, manual identity mappings or research-fixture seeding. No such test
was attempted by H.

The current code introduces no runtime dependency on a local research directory,
the user’s exports, a filesystem fixture loader, a model server or a separate
service in the new S10 production consumer and unified Replay path. A search of
those runtime packages found no `Files`, `Paths`, `FileInputStream`, `/Users`,
`.codex`, exports or fixture-reading path. Runtime consumes retained PostgreSQL
facts and packaged versioned artifacts. This observation does not prove that the
retained facts can all be reacquired from a new installation.

## Risk register for the next milestone

| ID | Dependency or limitation | Evidence and consequence | Next-milestone acceptance question |
| --- | --- | --- | --- |
| H1 | Existing human-reviewed V7 manifest | `CrewCanonicalIdentityConfiguration` defaults `mission1.crew.identity.review-mode` to `APPLY`. `ReviewedCrewIdentities` loads the packaged `reviewed-identities-v1.json`, containing precisely the approved Luke Delaney/Watkins NASA↔LL2 pairs, named targets and prior capture proofs. Successful source writes also synchronize that manifest. Missing identities remain PENDING and do not create people. | A clean-room claim that excludes manual mappings must state how this packaged historical mapping is treated. Merely setting startup review mode OFF does not establish that successful source-write synchronization is disabled. Demonstrate the agreed policy in the complete automatic startup path without borrowing accepted mappings from today’s database. |
| H2 | Mature retained LL2 human population | S10 provider-detail discovery and publication targets derive from successful retained LL2 person observations. `RetainedMembershipInputs` also builds V10’s human universe from retained successful LL2 observations. The normal LL2 acquisition requests active expeditions only (`is_active=true`, `limit=10`), while the present retained installation includes outgoing people. S10 deliberately does not create V7 people. | Show how an empty installation learns every required human, including a departing human absent from the currently active structured roster. Missing historical candidates must fail closed; a test cannot silently preload the present eleven-human cohort. |
| H3 | Real qualification cache was populated from prior research acquisition | The accepted Phase-1 dossier states that 36 original official/provider captures were imported through S10 parsing/persistence and three compatible V8 captures reused. Its explicit `S10Validation.java` initial mode reads an external investigation manifest/body archive and imports the source bytes; repeat mode reuses that cache. This runner is not startup code. | Prove that normal background discovery and HTTP acquisition independently reach all required resources, parse them, and qualify bindings without running the archive-import validation runner. Keep the current retained-data result and future autonomous bootstrap result distinct. |
| H4 | Finite upstream observation window, no general history reconstruction intake | Normal NASA operational HTTP obtains the one current ISS RSS feed. Its parser accepts at most ten items and ignores publication dates older than fourteen days relative to acquisition. It does not paginate an archive or fetch former article bodies. `NasaOperationalReprocessingService` reparses already retained bodies; it cannot recover bytes never retained. LL2’s normal current-expedition query also does not collect prior snapshot captures. | Define achievable Replay coverage from a genuinely new installation. Old Crew-12/13 events or pre-capture structured rosters cannot be assumed recoverable just because today’s database retains them. Missing upstream history should yield honest unavailable/partial coverage, rather than imported rows or backdated current captures. |
| H5 | Resource discovery has finite allowlists and mission-era seeds | Default S10 seeds name a GCTC directory, CSA Kutryk biography, ESA Adenot biography and NASA Crew-12/Crew-13 mission pages. These are verified resource URLs, not human mappings. Runtime also discovers retained source anchors, provider-detail URLs and parsed outgoing links, but only accepted host/path/resource classes enter acquisition and proof. | Measure whether source-driven discovery reaches the right mission and agency resources for the cohort present on the day of clean-room validation. Old static mission URLs cannot alone establish coverage for future cohorts, unsupported resource classes or an incoming human with no already retained provider observation. |
| H6 | Asynchronous cold convergence and bounded request budget | Normal LL2 initial delay is five minutes, NASA verification ten minutes, V8/S10/V10 fifteen minutes. S10 processes at most one resource acquisition per tick (normally five minutes), caps its own LL2 calls at three per hour and honors a combined guard/cooldown. Its complete-candidate gate requires every discovered retained provider to have an available detail capture. Failure retries are bounded and cached proof validity is thirty days after successful validation. | Observe normal wall-clock convergence, request reservations, restarts and unavailable-resource behavior from zero cache. Do not infer a real completion SLA from an accelerated test clock, and do not bypass completeness or budgets to make the empty installation appear ready. |
| H7 | Modern reads intentionally cannot repair missing state | Current defaults to the committed ACTIVE projection and fails closed when no compatible projection exists. The production S10 release is installed by the worker. Historical evaluates retained facts with evidence known today; it cannot acquire, score, enqueue or persist timestamp projections during a GET. An empty database has neither qualified subjects nor historical captures. | Demonstrate startup’s durable notifications, release installation and ordinary workers progressing to a committed modern projection. Check honest UI/API behavior during the cold interval and for Historical dates before the installation’s retained evidence, without user GETs secretly repairing state. |
| H8 | Finite cohort bounds and monotonically retained knowledge | S10 limits a subject batch to 256; retained subject/resource/provider reads use explicit 10,000 bounds and incomplete inputs defer. A newly installed small cohort is plausible within those bounds, but accumulating observations, old providers and resources changes completeness/repair work over time. V10’s human scope also has a 10,000 bound. | Record the actual discovered cohort, resource count and queue size, prove bounded work and restart convergence, and identify when paging/retention would be needed. Do not interpret a small mature local cohort as proof of arbitrary-history startup or growth. |

## What the new milestone changes for bootstrap

The new default S10 production mode increases the importance of qualified resource
intake: old shadow decisions cannot silently become production decisions, and a
matching old name/URL cannot bypass the sealed release and proof checks. This is
appropriate fail-closed behavior, but it means today’s loaded cache cannot be used
as evidence of future autonomous acquisition.

Unified Historical now uses the same V10 lifecycle at effective UTC T with V7/S10
knowledge known today. A binding learned later may interpret a retained old event;
that does not create an old event, recover an absent capture, or permit a current
editorial/structured capture to establish membership before its capture. The
future bootstrap milestone must distinguish operational event coverage from
structured/editorial capture coverage and from latest canonical biography.

Modern editorial membership uses explicit existing V7 resource correspondence.
The reviewed manifesto’s limited scope therefore matters separately from S10’s
operational-subject authority. General V9 research matches must remain shadow and
cannot be used as a shortcut to populate production identities for a clean start.

## Suggested evidence for the next milestone, without implementation here

Use an independent empty PostgreSQL database and preserve proof that no existing
tables/rows, dump, manually constructed provider bindings, validation archive or
test fixture was imported. Record normal startup flags, provider requests and
budgets, successful captures, parser/release hashes, V7 creation lineage, S10
qualification and V10 revisions. Observe one complete normal acquisition cycle,
then restart without manual repair. Record supported and unsupported Replay
dates, honest cold/no-data behavior and source failure handling.

Agree explicitly whether the packaged human-reviewed V7 manifest is prohibited by
the clean-room acceptance requirement. The default startup and ingestion behavior
must be audited together; reviewing only the startup flag would miss source-write
synchronization. Existing packaged frozen scorer/lexical artifacts are versioned
runtime policy, not historical source-row imports, and should be classified as
such when documenting the clean-room boundary.

## Reviewed evidence

All paths below refer to the canonical checkout, inspected read-only:

- `docs/adr/0021-production-operational-binding-and-unified-crew-replay.md`
- `backend/src/main/java/org/mission1/CrewCanonicalIdentityConfiguration.java`
- `backend/src/main/java/org/mission1/crew/application/ReviewedCrewIdentities.java`
- `backend/src/main/resources/crew/reviewed-identities-v1.json`
- `backend/src/main/java/org/mission1/crew/persistence/JdbcCrewIdentityRepository.java`
- `backend/src/main/java/org/mission1/crew/persistence/JdbcCrewRepository.java`
- `backend/src/main/java/org/mission1/crew/persistence/JdbcCrewVerificationRepository.java`
- `backend/src/main/java/org/mission1/CrewOperationalBindingConfiguration.java`
- `backend/src/main/java/org/mission1/crew/operational/OperationalBindingWorker.java`
- `backend/src/main/java/org/mission1/crew/operational/OperationalBindingStore.java`
- `backend/src/main/java/org/mission1/crew/operational/RetainedOperationalInputs.java`
- `backend/src/main/java/org/mission1/crew/operational/OperationalProductionBindings.java`
- `backend/src/main/java/org/mission1/crew/membership/RetainedMembershipInputs.java`
- `backend/src/main/java/org/mission1/replay/UnifiedCrewReplay.java`
- `backend/src/main/resources/db/migration/V12__production_operational_binding_unified_replay.sql`
- `backend/src/main/java/org/mission1/source/crew/ll2/LaunchLibrary2CrewSource.java`
- `backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalFeedHttpSource.java`
- `backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalFeedParser.java`
- `backend/src/main/java/org/mission1/crew/application/NasaOperationalReprocessingService.java`
- `docs/crew/operational-subject-binding-shadow-validation/README.md`
- `docs/crew/operational-subject-binding-shadow-validation/scripts/S10Validation.java`
- `docs/crew/canonical-identity.md`
- `docs/crew/canonical-identity-validation/README.md`
- `backend/src/main/resources/application.properties`, `compose.yaml`, `backend/README.md`

Source availability was not checked live. Statements about absent historical intake
describe the implemented acquisition paths, not a claim that an upstream provider
has deleted a specific resource. Future clean-room source verification remains
required. H’s review uses the project `devops-local-platform` skill to evaluate
reproducibility; it does not broaden current acceptance into full bootstrap.
