# S10 Phase 1 — OperationalSubjectBinding shadow validation

Validated 2026-10-11 against canonical `/Users/daniel/Desktop/MISSION1`, directly on
`main`, starting at `38cbf5945ea2e911344c8d44902687b5d299e26a`.
The implementation is accepted for isolated shadow evaluation. Production activation
requires a separate decision. See [ADR-0020](../../adr/0020-shadow-operational-subject-binding.md).

## Baseline

The initial workspace was clean. Java 21 baseline `mvn test` and `mvn verify`: 1,008
passing tests, no failures/errors/skips. Node 24 baseline: 786 tests in 65 files,
typecheck and production build pass. The retained operational investigation remains
unchanged outside Git at
`/Users/daniel/.codex/exports/mission1-operational-subject-resolution-investigation/`.
Its facts, authority matrix, score formulation, calibrated coefficients, negatives,
link faults, current labels and candidate analysis were inspected before implementation.
Labels enter evaluation assertions only. Runtime never loads fixtures, gold labels,
public Current state or the approved V7 manifest as candidate features.

## Architecture

One Java application and PostgreSQL. The pure resolver consumes retained source
subjects and qualified resource facts. Separate durable background acquisition and
evaluation use bounded leases, notifications and repair. Default shadow ON follows
15-minute startup delay, evaluation every 1 minute, acquisition every 5 minutes.
Each acquisition tick handles at most one resource. S10 permits at most 3 LL2
requests/hour while respecting the existing cooldown and a combined 15/hour guard;
NASA uses its existing shared request gate. Other allowlisted hosts permit 12/hour.
Refresh is 7 days, successful proof validity 30 days; failures retry after at least
1 hour and respect bounded Retry-After. Stale or absent qualified proof defers. Production consumer
is nonexistent. There is no public S10 endpoint, new frontend flow or V9 graph.
S10 targets existing V7 humans only after scoring. Detached pure V10-policy
counterfactuals never call its store or materializer.

## Schema and audit

V6 already supplies compatible source occurrence/version links; V7 supplies publication
routing; V8 supplies typed NASA resources/captures; V9 supplies frozen artifacts;
V10 supplies the existing production membership revision. V11 is additive and
V1–V10 files/checksums are unchanged. Fresh PostgreSQL 16.10 and V10→V11 upgrade pass.
The nine new tables are:

| Table suffix (`crew_operational_`) | Purpose |
| --- | --- |
| binding_release | Immutable serialized policy, policy/model SHA |
| resource_version | Immutable bounded raw bytes, URL/redirect/capture/parser/facts/hash |
| resource_attempt | Immutable success/failure/revalidation or reused V8 capture lineage |
| resource_work | Mutable acquisition lease, retry and next eligibility |
| request_permit | Append-only own-host reservations |
| binding_work | Mutable coalesced generation, completion, lease/failure state |
| binding_revision | Immutable exact subject/version, target, cut, result and predecessor |
| binding_candidate | Sealed ranked vectors, scores, signals and candidate diagnostics |
| binding_proof | Sealed authority/relation/family/hash/time/required lineage |

Checks enforce serialized hashes, exact source mention/document/evidence/version,
existing provider publication anchor, policy qualification and complete atomic children.
Proof hashes must have a retained official S10 or V8 capture. Late child insert,
UPDATE and DELETE fail. Source supersession records its replacement binding/revision.
Cuts also pin parsed-fact digests and resource-parser version, so a changed interpretation
cannot hide behind unchanged remote bytes. Latest-cut idempotency permits an A→B→A
correction while preserving every historical result.

## Policy

`s10-scoped-shadow-v1`; scorer `crew-auto-identity-v1-shadow`; feature schema
`s10-research13-qualified-signals-v1`; normalization
`s10-nfkc-casefold-icu78.3-v1`; authority matrix
`s10-research-authority-matrix-v1`; resource parser `s10-official-resources-v1`.
The model SHA is `469c31402cdd89ae1bc956cdcabdc57e00088b967806d322bdfbfca8d9896792`.
The lexical artifact retains its existing SHA, although the operational vector's
lexical and typed-bridge inputs are zero. Runtime has no fitting path.

## Evidence sources

All real-source rows come from original retained NASA bodies and untouched official/
provider captures from the investigation. 36 bounded captures were imported through
normal S10 parsing/persistence; three identical compatible V8 captures were reused
in place. This is intake of already acquired source bytes, not new live requests or
human mapping. A subsequent actual ESA HTTPS 200 acquisition was parsed/retained by
the new transport and independently notified the worker: 25 MATCH again.

The qualified paths use typed NASA people/topic resources, named NASA mission rosters,
CSA own-person facts, GCTC native directory rows and detailed LL2 person/flight/landing
relations. [NASA Crew-12](https://www.nasa.gov/wp-json/wp/v2/mission/939897) and
[Crew-13](https://www.nasa.gov/wp-json/wp/v2/mission/992288) expose the exact bounded
named roster. The unrelated Crew-11 page blurb does not become Crew-12 authority.
[CSA Joshua Kutryk](https://www.asc-csa.gc.ca/eng/astronauts/canadian/active/bio-joshua-kutryk.asp)
provides the precise DOB/mission path. [ESA Sophie Adenot](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Astronauts/Sophie_Adenot)
is retained, but an imprecise birth year is not a precise-DOB witness.
[GCTC directory](https://www.gctc.ru/main.php?id=154) uses Windows-1251, native name,
DOB and selection; row numbers are resource locators, never human IDs.
[LL2 astronaut details](https://ll.thespacedevs.com/2.3.0/astronauts/732/)
provide stable provider identity and person-specific successful flights and landing
intervals. These are provider metadata, not continuous ISS physical-presence telemetry.
The allowlisted JAXA adapter is supported but no JAXA person is in this retained cohort.

No Wikidata, DBpedia or community KB supplies runtime authority. NASA captures share
one editorial family; repeated articles/copies do not multiply confidence. Agency
ownership and LL2 identity/flight evidence keep distinct roles and provenance.

## Personal-resource validation

The source span must be the exact asserted person inside the exact retained article/
paragraph. Authors, credits and navigation are excluded. SafeLinks are decoded locally,
then the HTTPS host/path class is checked. Each captured redirect is retained and
same-host checked; no person slug is rewritten. HTML/topic nodes are intermediaries,
not personnel IDs. The chain ends at a validated typed single-person resource with
compatible primary subject. Multi-person, generic/index, mission-as-person, offsite,
missing and mismatched resources fail closed.

The real Sophie→Hathaway anchor is rejected as a person-name mismatch at both raw
source-span and typed-resource stages. Sophie can qualify independently through the
named Crew-12 roster and her own provider flight. The observed Watkins legacy URL
uses its captured two-hop redirect to the typed people resource; a missing intermediate
capture in the first fixture draft was repaired using the original archive.

## Candidate generation

Union of retained compatible name/scoped short form, agency, person-flight mission
and source-time flight cohort. Retained outgoing humans stay eligible; Current's
seven are never a whitelist. All 25 expected targets survive blocking. The actual
batch scores 273 candidates,9–11 per subject; the separate complete research matrix
checks all 275 pairs. Max 256 candidates,10,000 retained providers, 256 subjects per batch.
Truncation/incomplete detail coverage defers; exceeding the subject batch bound
records worker failure and retries, requiring future paging before larger history.
No missing last pair is forcibly assigned. Provider and post-scoring V7 collisions
between distinct same-assertion subjects become conflicts.

## Scoring and gates

The existing six name features plus same agency, precise DOB agreement/conflict,
selection and mission features reproduce the research operational formulation.
Qualified authority is a hard gate, not a new learned coefficient. Compatible source
agency and source-time successful flight are mandatory. Own-agency shortened names
require precise DOB and scoped mission agreement. Native-directory matching requires
DOB, surname/given compatibility and selection. Named mission membership requires a
person-specific flight at event time. January 1 provider placeholders are not precise
DOBs. Raw URL, name, biography word overlap, mission tokens, role or score alone do
not establish a binding. Missing/unpublished V7 target creates no canonical person.

All275 raw/enriched vectors and witness gates match research; maximum score delta
`8.673617379884035e-19`. The unchanged existing model test checks 14,382 frozen
vectors independently. Source resource/version/hash and parsed-fact digests pin every
accepted decision and its reasons.

## Thresholds

Observation/arrival `p>=0.991`; completed departure `p>=0.999`; runner-up margin `>=0.20`.
Tests cover exact and next-representable boundaries, intermediate scores, absent proof,
missing target, unknown time and incomplete candidates. A 0.995 observation can pass
with all gates; a 0.995 departure cannot. These are initial shadow risk thresholds,
not calibrated operational posterior accuracy claims. 25/25 and 0/256 do not certify
precision, guarantee reliability or establish 99.9% accuracy.

## Real retained subjects

25 MATCH, 0 DEFER, 0 CONFLICT over 11 existing humans. Legacy comparison: 11 agreements,
14 newly associated in shadow from legacy-unresolved subjects. Gates pass for each
winner. Full exact version/document/evidence hashes, target UUIDs, runners, thresholds,
lineage and consequences are in [subject results](real-subject-results.csv), and all
actual blocked candidate vectors in [candidate results](real-candidate-results.csv).

| Evidence | Index | Exact source subject | LL2 person | Probability | Margin | Legacy comparison |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 0 | Jessica Watkins | 582 | 0.9999991493581715 | 0.9975597397432784 | AGREES_WITH_PRODUCTION |
| 2 | 1 | Luke Delaney | 710 | 0.9999974322352994 | 0.9995464375981143 | AGREES_WITH_PRODUCTION |
| 2 | 2 | Joshua Kutryk | 642 | 0.9999999900715674 | 0.9994080103982058 | AGREES_WITH_PRODUCTION |
| 2 | 3 | Sergey Teteryatnikov | 915 | 0.9999974322352994 | 0.9997526182134774 | AGREES_WITH_PRODUCTION |
| 12 | 0 | Jessica Meir | 573 | 0.9999974322352994 | 0.9980197697738331 | AGREES_WITH_PRODUCTION |
| 12 | 1 | Jack Hathaway | 712 | 0.9999974322352994 | 0.9999665120416151 | AGREES_WITH_PRODUCTION |
| 12 | 2 | Anil Menon | 713 | 0.9999974322352994 | 0.9999762332779282 | AGREES_WITH_PRODUCTION |
| 12 | 3 | Sophie Adenot | 747 | 0.9999974322352994 | 0.9999637005041919 | AGREES_WITH_PRODUCTION |
| 12 | 4 | Pyotr Dubrov | 650 | 0.9999998754927155 | 0.9997062168171339 | AGREES_WITH_PRODUCTION |
| 12 | 5 | Anna Kikina | 649 | 0.9999998754927155 | 0.9997062168171339 | AGREES_WITH_PRODUCTION |
| 12 | 6 | Andrey Fedyaev | 732 | 0.9998494798543411 | 0.9921803930561501 | MATCHES_PRODUCTION_UNRESOLVED |
| 21 | 0 | Jessica Meir | 573 | 0.9999974322352994 | 0.9980197697738331 | MATCHES_PRODUCTION_UNRESOLVED |
| 21 | 1 | Jack Hathaway | 712 | 0.9999974322352994 | 0.9996344900718833 | MATCHES_PRODUCTION_UNRESOLVED |
| 21 | 2 | Sophie Adenot | 747 | 0.9999974322352994 | 0.9999077755287803 | MATCHES_PRODUCTION_UNRESOLVED |
| 21 | 3 | Andrey Fedyaev | 732 | 0.9998494798543411 | 0.9994657820954612 | MATCHES_PRODUCTION_UNRESOLVED |
| 27 | 0 | Jessica Meir | 573 | 0.9999974322352994 | 0.9980197697738331 | MATCHES_PRODUCTION_UNRESOLVED |
| 27 | 1 | Jack Hathaway | 712 | 0.9999974322352994 | 0.9996344900718833 | MATCHES_PRODUCTION_UNRESOLVED |
| 27 | 2 | Sophie Adenot | 747 | 0.9999974322352994 | 0.9999077755287803 | MATCHES_PRODUCTION_UNRESOLVED |
| 27 | 3 | Andrey Fedyaev | 732 | 0.9998494798543411 | 0.9994657820954612 | MATCHES_PRODUCTION_UNRESOLVED |
| 58 | 0 | Anil Menon | 713 | 0.9999974322352994 | 0.9999762332779282 | MATCHES_PRODUCTION_UNRESOLVED |
| 59 | 0 | Jessica Watkins | 582 | 0.9999991493581715 | 0.9975597397432784 | MATCHES_PRODUCTION_UNRESOLVED |
| 59 | 1 | Luke Delaney | 710 | 0.9999974322352994 | 0.9995464375981143 | MATCHES_PRODUCTION_UNRESOLVED |
| 59 | 2 | Josh Kutryk | 642 | 0.9999999900715674 | 0.9994616289541339 | MATCHES_PRODUCTION_UNRESOLVED |
| 59 | 3 | Sergey Teteryatnikov | 915 | 0.9999974322352994 | 0.9997526182134774 | MATCHES_PRODUCTION_UNRESOLVED |
| 64 | 0 | Luke Delaney | 710 | 0.9999974322352994 | 0.9999706799407361 | AGREES_WITH_PRODUCTION |

## Current parser-1.2 subjects

All six MATCH: Oct 5 Watkins, Delaney, source **Josh Kutryk**, Teteryatnikov
(`2026-10-05T17:18:04Z`); Oct 6 Anil Menon (`2026-10-06T17:57:55Z`);
Oct 9 Delaney (`2026-10-09T16:35:40Z`). These dates retain publication-proxy semantics.
The first five compare legacy-unresolved; Oct 9 Delaney agrees with the accepted
production binding. Production observation dates remain unchanged.

## Fedyaev

Both retained completed departures MATCH existing V7 human
`e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5` through generic provider/native-source name
compatibility, source Roscosmos context, the official named Crew-12 roster, and the
person-specific successful LL2 flight interval. Probability `0.9998494798543411`,
runner `0.0003836977588799266`, margin `0.9994657820954612`: the 0.999 departure gate
passes with all other gates. The earlier aboard subject has the same winner/score
and margin `0.9921803930561501`. No Andrey→Andrei constant or global alias is added.
The GCTC Any-Latin surname is not forced to equal the provider surname for this case.

## Kutryk

Source Josh at Oct 5 obtains a source-scoped variant from CSA's Joshua profile,
precise DOB `1982-03-21`, same surname/CSA and Crew-13 membership plus provider flight.
Probability `0.9999999900715674`, runner `0.0005383611174333843`,
margin `0.9994616289541339`; target `345d3c45-c57a-4bcf-b3d6-ea811ba55416`.
No global nickname dictionary, persisted Josh alias or V7 change exists.

## Menon

Anil's Oct 6 source-specific NASA people 40775 path plus agency/selection/flight
context yields `0.9999974322352994`; runner `0.000021198957371196208`,
margin `0.9999762332779282`; target `0aa26f8e-38e0-495d-b9a2-ced538c9e726`.
His Jan1 provider DOB stays imprecise. Anna remains a distinct wrong-human control;
surname, shared NASA context and family relation cannot qualify identity. In a future
accepted consumer this dated observation could advance Anil's old Oct 2 observation
and be recent within seven days. Phase1 does not advance production annotations.

## Crew-12 departures

All eight exact subjects in retained evidences 21 and 27 MATCH: Meir, Hathaway,
Adenot and Fedyaev, twice, at explicit minute-qualified `2026-10-07T12:05:00Z`.
Both original immutable assertions survive; no deduplication invents or removes events.
All eight report `WOULD_APPLY_V10_DEPARTURE_VETO_CANDIDATE`. The detached cohort
calculation supplies vetoes for the four outgoing humans; no S10 decision is installed
in production V10, and Current's seven remain the same.

## Hard negatives and fault scope

0 AUTO_MATCH among 256 known wrong-human comparisons, including same given/surname,
agency, mission, role/cohort, Russian near spellings, family/twins, former crewmates
and the erroneous NASA personal link. 25 explicit constructed gate faults and 16
constructed link faults pass. The two positive gate controls preserve cached-good
qualification and alternate official named-roster qualification. For the latter,
Java tests use Watkins's actual qualified roster path; removing all Anil-specific
proof does not fabricate an alternate roster. Link-only acceptance never creates a
provider/canonical human. The artificial ambiguity case does not demonstrate that
unobserved indistinguishable homonyms can be eliminated in the wild.

## Corrections, supersession and restart

Disposable PostgreSQL tests preserve DEFER→MATCH→CONFLICT→MATCH and newer-source
SUPERSEDED history; the contradiction attributes are explicitly constructed faults,
not claims about an astronaut. Each revision seals its children in one transaction.
Source supersession appends for the old source version and evaluates the new exact
version separately. Latest-source, target and proof lineage checks reject invalid
writes. Lost leases can be reclaimed; stale owners cannot finish them. New source
notifications coalesce beyond the generation being evaluated. Cached body revalidation
appends an attempt while preserving original capture bytes/time; 503 does not erase it.
On the real cache, repeat evaluation after process restart inserts 0 decisions.

## Production freeze and counterfactual limits

The 69 preexisting public tables excluding Flyway match their full sorted-row
fingerprints before/after all S10 work, including V7, V8, V9, V10, reconciliation,
source histories and Orbit. Flyway adds V11 only. Current remains the same seven
canonical humans; all 13 current/retained/alias profiles and three Replay dates match
semantically. Only independently verified response-clock fields (evaluation clock,
age seconds and open Replay coverage ending at that clock) are excluded from the
comparison. Source/event/projection/profile timestamps remain compared.

Persisted legacy comparison is per exact subject. Detached before/after V10-policy
hashes and episode effects describe the **whole accepted cohort**, not causal isolation
of each row; a later observation may change the cohort episode attached to an earlier
arrival. Departure effect labels are candidate consequences. They do not prove a
production veto installation or consumer readiness. All computed effects stay in S10.

## GET audit

17 actual HTTP requests: Current, 7 current profiles, 4 retained profiles, 2 existing
Luke/Watkins aliases and Replay at Oct 1 12:00, Oct 3 12:04, Oct 10 12:00 UTC.
20 additional Current service reads were traced. JDBC reports read-only SELECTs;
GET writes 0. Test-only ByteBuddy advice traces frozen scoring, S10 evaluation,
V10 materialization, source acquisition entrypoints and external requests through
JDK HttpClient: all 0 during reads. It is not a runtime dependency or API feature.
Full-table fingerprints also remain stable across GET. The baseline artifact and final
implementation both use 48 prepared SELECTs per real Current read.

## Performance, SQL and growth

Local Java 21/PostgreSQL 16.10, instrumented collector, finite cached cohort; no SLA.
Initial and final samples are distinguished in the JSON. The final cache sample has
151.6 ms median fact load, 35.1 ms pure batch and 271.3 ms unchanged durable batch;
the first post-digest changed-cut batch takes 1,952.8 ms under concurrent test load.
Cold fact load 489.6 ms, first enriched fact load 201.7 ms; warm median 126.2 ms with 7
set SELECTs. Cold 25-subject durable run 738.1 ms; first enriched run 702.6 ms including
writes. Pure warm 25-subject batch median 31.0 ms (range 26.3–42.8). Candidate generation
median 0.616 ms/subject; feature extraction 0.215 ms/candidate; logistic scoring 0.00283 ms/
candidate; enriched evaluation 3.056 ms/subject. Exact distributions are in the JSON.
Cold SQL 89 statements, enriched 476 including 273 candidate and 110 proof inserts;
no candidate/resource SELECT loop. Notifications/claims have constant queue overhead;
observed queue latency 116.8 s cold after an earlier validation failure and 7 ms after
cache intake. The repair run is idempotent.

Final Current median 44.4 ms (p95 68.8 ms) versus baseline 45.6 ms in separate 20-read samples, with the
same 48 SELECTs. This is local variation, not an attributed speedup. The latest-binding
EXPLAIN over 100 rows uses a small sequential scan/sort (0.444 ms), appropriate at this
size; the `(binding_key,id DESC)` index supports growth/single-key reads. Resource
attempt URL/time and version/time indexes support last-good/revalidation lookup;
host/time supports quotas. No decorative index or extra database engine is added.

The initial real installation had 50 decisions (25 cold DEFER, 25 MATCH), 273 candidate
rows, 110 proof rows. Live reacquisition adds 25 immutable factual cuts, 273 candidates
and 110 proofs; unchanged repeats add 0. Resource versions deduplicate bytes; attempts
append. The final parsed-fact-digest cut appended one additional 25-decision revision,
then both unchanged-cut repeats inserted zero. Final totals are 100 revisions,
819 candidate rows, 330 proof rows, 34 resource versions, 37 attempts and one own
request permit. A comparable qualifying cohort adds about 25 revisions, 273 candidates and
110 proofs per changed cut. First MATCH serialized result averages 16.8 kB and cut 22.2 kB;
raw resources are bounded 2 MiB. Initial S10 relations total about 3.6 MiB. Conservative
36 resource refreshes/week could trigger 900 decisions/week (46,800/year), with about
511,000 candidate/206,000 proof rows/year if the cohort stayed comparable. This is an
upper illustrative full-cut refresh estimate, not measured annual growth. Monitor
history size before increasing cadence/cohort; retention policy is deferred.

## Dependencies

The only new runtime dependency is `com.ibm.icu:icu4j:78.3` (about 14 MiB JAR), checked
against the [official ICU 78.3 release](https://unicode-org.github.io/icu/download/). Existing Java/Jackson/jsoup/JDBC/Flyway/model
artifacts are reused. No runtime AI, external Python, semantic/neural model, vector DB,
graph DB, Kafka/broker, model server or distributed service is added. ByteBuddy is
already a test dependency through Mockito and used only by the explicit audit runner.
The runtime dependency tree is preserved in the external dossier.

## Tests

Java 21 final `mvn test` and `mvn verify` both pass 1,095 tests, zero failures, errors
or skips (baseline 1,008; 87 added). Node 24 retains 786 passing tests in 65 files,
typecheck and production build pass. The existing large-chunk warning persists.
Additional acceptance covers PostgreSQL fresh/upgrade/correction/restart/seal/cache/budget tests, real 25,
275 operational vectors, 14,382 frozen-model vectors, 256 wrong humans, 25 gate faults,
16 link faults, HTTP safety tests, scheduler dispatch tests, actual cache/source/
HTTP/SQL/fingerprint audit and diff check. Final exact gate results
are recorded in [validation-summary.json](validation-summary.json). Existing migration
expectations were updated from 10 to 11 (Crew table count 68→77); old behavior assertions
are unchanged. No frontend source or lockfile change was needed.

## Documentation and reproduction

ADR-0020 and the ADR index, Crew architecture, canonical identity, source authority,
presence, V9, V10, Crew index and backend runtime docs are updated. External project
context `/Users/daniel/Desktop/mission1-project.md` records delivery.
The [summary JSON](validation-summary.json), two result CSVs, frozen backend fixtures
and [scripts](scripts/) distinguish real captures from constructed faults.
Full reports/logs/raw source provenance stay in
`/Users/daniel/.codex/exports/mission1-s10-shadow/` and the unchanged investigation.

`S10Validation.java` is an explicit local runner, never startup code. Its initial mode
imports original official bytes, validates hashes, writes only V11 state and evaluates
the notified work. `repeat` mode reuses cache. It requires the canonical retained
installation and external investigation archive; portable unit/PG tests use the frozen
fixture instead. The HTTP probe makes one bounded ESA request. Disable other source/
identity/membership schedulers for freeze audits, as the scripts do. Use the Maven
classpath with Java 21; the ByteBuddy audit needs `-Djdk.attach.allowAttachSelf=true`.
Neither script consumes expected labels as resolver input or installs a V7 mapping.

## Git

One ordinary milestone commit on `main`, normal SSH push, fetch/ls-remote equality and
clean working tree are required for delivery. The parent is the baseline SHA above;
final SHA and checks are recorded after commit in the external `git-final.json` and
user-facing delivery report, avoiding a self-referential commit identifier here.
