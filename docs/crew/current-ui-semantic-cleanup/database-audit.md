# Schema and reference audit

Actual PostgreSQL schema:70 public tables, Flyway version10. Complete column inventory,
all-table row fingerprints and evidence export preceded implementation and are retained
outside Git. All V1–V10 migration hashes are protected. No DROP/DELETE/UPDATE is used.

| Table.column / derived container | Writer | Valid reader | Source meaning / historical provenance | Replay | Diagnostics / API | Safe removal? |
| --- | --- | --- | --- | --- | --- | --- |
| `crew_verification_evidence.crew_count` | `JdbcCrewVerificationRepository` via NASA ingestion/parser | public/as-of evidence queries; reconciliation engine; active input assembler | Raw typed NASA operational COUNT_ONLY observation, one assertion11; immutable | effective-time count reconstruction | reconciliation/count findings; supporting provenance | No: raw fact |
| `crew_reconciliation_snapshot.official_crew_count` | `JdbcCrewReconciliationRepository.store` / reconciliation worker | `JdbcCrewReconciliationRepository.latest/find` | immutable derived interpretation of operational count at stored assessment UTC | Replay re-evaluates raw evidence; history remains diagnostic | retained reconciliation history, stored domain object | No: independent immutable interpretation/history |
| `crew_reconciliation_snapshot.unidentified_count` | same writer, reconciliation engine | same repository reader reconstructs `CrewReconciliationSnapshot` | historical count-minus-confirmed-presence gap; not unidentified humans | Replay computes its own existing gap, not latest stored scalar | persisted reconciliation diagnostics/state key; removed only from Current REST projection | No: historical derived evidence with valid reader/writer |
| `crew_reconciled_person.presence`, `last_known_presence`, `assertion_as_of` | reconciliation writer | reconciliation latest/find + person/evidence queries | independently dated physical-presence interpretation | source/history selectors remain intact | detail/member presence, reconciliation diagnostics | No |
| `crew_evidence_subject`, `crew_identity_resolution` | verified ingestion / production resolver | evidence/as-of queries; compatible occurrence selectors | named subject and production identity resolution history, including unresolved Andrey | preserves unresolved source reports | current presence/identity provenance, diagnostics | No |
| `crew_editorial_topic_fact.value`, `fact_kind`, `unit` | `JdbcCrewEditorialRepository.retain` from typed editorial parser | editorial latest acquisition / `RetainedMembershipInputs` / V10 | NASA_WEBSITE_EDITORIAL_REPORTED_ABOARD_COUNT7 and expedition number75 are independent source observations | not a Current/Replay aboard substitute | internal field/count conflict findings | No: source facts |
| `crew_editorial_fact_capture` lineage | editorial ingestion writer | editorial/acquisition and V10 cut pin validation | immutable association of observation to source capture | retained for reconstruction, not Replay public count | source-health / provenance | No |
| `crew_editorial_roster_member` | editorial roster writer | automatic evidence graph, retained membership assembler | source slots7; roster cardinality distinct from people | no new Replay consumer | V9 decisions, V10 supports/unresolved slots | No |
| `crew_active_projection_revision.result` / `serialized_result` counts | `ActiveMembershipStore.materialize` | `JdbcActiveMembershipReader`, latest internal projection | immutable V10 typed counts: humans, assignments, editorial slots, website, operational, ACTIVE/RETAINED slots | Replay deliberately does not use latest V10 | pins/hashes/consistency and membership diagnostics | No: sealed complete result |
| `crew_active_projection_revision.topic_count_fact_id` | same materializer | sealed-reader cut/pin validation | exact source count lineage | no latest V10 Replay dependency | count provenance integrity | No |
| `crew_active_projection_slot.state` and payload | V10 materializer | sealed read / lifecycle diagnostics | typed ACTIVE source slot vs RETAINED source/operational evidence | retained immutable history | only ACTIVE count exposed in Current membership diagnostic | No |
| `crew_auto_decision_revision`, graph and observations | V9 background shadow worker | V10 qualified slot/support graph inputs | model decision/occurrence history, no production matching activation | retained decisions/identity cut | automatic graph diagnostics | No |
| `crew_person_observation.flights_count`, `spacewalks_count` | LL2 source adapter/repository | batched profile reads | independent career totals, unrelated to aboard presentation | latest-retained profile metadata | seven and retained detail API | No: unrelated profile facts |

There is no persisted `reportedAboard`, `officialAboard` UI column or unidentified-person
collection. Public camelCase fields were REST projections. `Counts` remains only for
Replay; `CurrentCounts` cannot expose the legacy scalar/count history. The engine's gap
calculation remains because it still writes reconciliation history and supplies Replay;
its source/applicability semantics are unchanged.

The REST-only applicability check used to project Current `officialAboard` and the
Current unresolved-subject DTO mapping were deleted. Internal `policy.applicable`,
`healthy`, count facts, counts mismatch findings and historical mappers still have valid
consumers; deleting them would violate this milestone's freeze. No migration is warranted.
