# Public database schema inventory

Generated from PostgreSQL 16.10 after canonical V1 (including telemetry and retained coordination),
before application reference/coordination initialization. Flyway metadata is excluded.

89 tables · 726 table columns · 184 indexes (including constraint-backed indexes) ·
592 constraints (including five deferred constraint triggers) · 29 identity sequences ·
2 views · 26 guard/notification functions · 124 application triggers · no custom enum/domain types.
PostgreSQL's 91 implicit composite row types and 91 array types are also inventoried
and pass the complete object-name audit.

All domain rows: **0**. Full column/type/nullability/default, constraint, index,
sequence, view, function and trigger definitions are in [V1](../../backend/src/main/resources/db/migration/V1__initial_schema.sql).
The machine-readable catalog comparison and complete live inventory are retained in
the external validation evidence, not loaded by the application.

| Table | Columns | Indexes | Constraints | Triggers |
| --- | ---: | ---: | ---: | ---: |
| `celestrak_request_state` | 3 | 1 | 2 | 0 |
| `crew_assertion_observation` | 5 | 2 | 6 | 1 |
| `crew_assertion_occurrence` | 6 | 3 | 8 | 1 |
| `crew_assertion_version` | 2 | 3 | 4 | 1 |
| `crew_assignment_observation` | 9 | 2 | 6 | 1 |
| `crew_document_body` | 2 | 1 | 3 | 1 |
| `crew_document_evidence` | 2 | 1 | 3 | 1 |
| `crew_event_catalog_observation` | 2 | 1 | 3 | 1 |
| `crew_event_catalog_run` | 19 | 2 | 5 | 1 |
| `crew_evidence_subject` | 5 | 1 | 5 | 2 |
| `crew_expedition` | 2 | 1 | 1 | 0 |
| `crew_expedition_external_id` | 3 | 2 | 4 | 1 |
| `crew_expedition_observation` | 9 | 1 | 8 | 1 |
| `crew_identity_binding_version` | 14 | 5 | 14 | 5 |
| `crew_identity_decision_evidence` | 12 | 4 | 11 | 1 |
| `crew_identity_research_candidate` | 5 | 3 | 8 | 1 |
| `crew_identity_research_decision_evidence` | 2 | 1 | 3 | 1 |
| `crew_identity_research_decision_revision` | 21 | 5 | 19 | 2 |
| `crew_identity_research_feature_snapshot` | 5 | 1 | 6 | 1 |
| `crew_identity_research_graph_application` | 2 | 1 | 3 | 2 |
| `crew_identity_research_graph_revision` | 5 | 2 | 5 | 2 |
| `crew_identity_research_identity` | 4 | 2 | 6 | 1 |
| `crew_identity_research_input_head` | 2 | 1 | 3 | 0 |
| `crew_identity_research_job` | 13 | 2 | 9 | 0 |
| `crew_identity_research_observation` | 6 | 3 | 6 | 1 |
| `crew_identity_research_release` | 8 | 2 | 7 | 1 |
| `crew_identity_research_sweep_lease` | 2 | 1 | 2 | 0 |
| `crew_identity_resolution` | 10 | 3 | 6 | 1 |
| `crew_membership_projection_binding` | 8 | 1 | 7 | 3 |
| `crew_membership_projection_evidence` | 3 | 1 | 4 | 3 |
| `crew_membership_projection_finding` | 5 | 1 | 3 | 2 |
| `crew_membership_projection_input_capture` | 6 | 1 | 6 | 3 |
| `crew_membership_projection_member` | 7 | 3 | 9 | 3 |
| `crew_membership_projection_revision` | 22 | 5 | 27 | 4 |
| `crew_membership_projection_slot` | 11 | 1 | 10 | 3 |
| `crew_membership_projection_support` | 22 | 1 | 14 | 4 |
| `crew_membership_projection_work` | 6 | 1 | 5 | 0 |
| `crew_nasa_request_budget` | 3 | 1 | 2 | 0 |
| `crew_operational_event_observation` | 7 | 2 | 5 | 1 |
| `crew_operational_request_permit` | 3 | 2 | 1 | 1 |
| `crew_operational_resource_attempt` | 9 | 3 | 5 | 2 |
| `crew_operational_resource_version` | 11 | 2 | 8 | 3 |
| `crew_operational_resource_work` | 6 | 1 | 2 | 0 |
| `crew_operational_subject_binding_candidate` | 4 | 2 | 4 | 2 |
| `crew_operational_subject_binding_proof` | 10 | 2 | 6 | 2 |
| `crew_operational_subject_binding_release` | 6 | 1 | 4 | 3 |
| `crew_operational_subject_binding_revision` | 33 | 5 | 30 | 4 |
| `crew_operational_subject_binding_work` | 8 | 1 | 5 | 0 |
| `crew_person` | 2 | 1 | 1 | 0 |
| `crew_person_equivalence_decision` | 13 | 5 | 13 | 5 |
| `crew_person_external_id` | 3 | 2 | 4 | 1 |
| `crew_person_observation` | 19 | 1 | 12 | 3 |
| `crew_reconciled_person` | 6 | 1 | 4 | 1 |
| `crew_reconciled_person_evidence` | 3 | 1 | 3 | 1 |
| `crew_reconciliation_evidence` | 2 | 1 | 3 | 1 |
| `crew_reconciliation_resolution` | 2 | 1 | 3 | 1 |
| `crew_reconciliation_run` | 7 | 2 | 6 | 0 |
| `crew_reconciliation_snapshot` | 12 | 2 | 9 | 1 |
| `crew_refresh_follow_up` | 7 | 3 | 7 | 1 |
| `crew_refresh_trigger` | 11 | 5 | 18 | 1 |
| `crew_resource` | 3 | 3 | 5 | 1 |
| `crew_resource_acquisition` | 18 | 4 | 16 | 5 |
| `crew_resource_fact_capture` | 2 | 1 | 3 | 3 |
| `crew_resource_refresh_lease` | 2 | 1 | 2 | 0 |
| `crew_resource_relation` | 11 | 3 | 8 | 4 |
| `crew_resource_roster_member` | 9 | 2 | 9 | 1 |
| `crew_resource_roster_version` | 9 | 3 | 11 | 1 |
| `crew_resource_topic_fact` | 11 | 3 | 12 | 1 |
| `crew_source_article` | 2 | 1 | 3 | 1 |
| `crew_source_article_observation` | 7 | 2 | 7 | 1 |
| `crew_source_document` | 14 | 3 | 5 | 1 |
| `crew_source_snapshot` | 15 | 4 | 9 | 1 |
| `crew_source_sync_run` | 23 | 6 | 13 | 2 |
| `crew_subject_metadata_version` | 6 | 3 | 8 | 1 |
| `crew_subject_occurrence` | 3 | 3 | 5 | 1 |
| `crew_subject_version_link` | 5 | 2 | 6 | 2 |
| `crew_verification_evidence` | 16 | 3 | 11 | 1 |
| `nasa_oem_ephemerides` | 7 | 2 | 3 | 0 |
| `orbital_element_observations` | 2 | 1 | 2 | 0 |
| `orbital_element_sets` | 12 | 3 | 11 | 0 |
| `telemetry_acquisition` | 8 | 1 | 3 | 1 |
| `telemetry_admission` | 4 | 1 | 4 | 1 |
| `telemetry_bootstrap_state` | 4 | 1 | 3 | 0 |
| `telemetry_catalog` | 3 | 1 | 1 | 1 |
| `telemetry_parameter` | 11 | 3 | 7 | 1 |
| `telemetry_provider_state` | 20 | 1 | 4 | 0 |
| `telemetry_record` | 21 | 2 | 8 | 1 |
| `telemetry_record_evidence` | 8 | 1 | 3 | 1 |
| `telemetry_time_rejection` | 13 | 1 | 4 | 1 |

The views are `crew_current_person_equivalence` and `crew_current_identity_binding`.
Every identity sequence is owned by its table/column and retains start 1, increment 1,
bigint bounds, cache 1 and no cycle. Trigger ordering, deferred atomic proof checks,
immutable history guards and every cross-domain foreign key are retained.

The automated name audit covers tables, columns, indexes, constraints, sequences,
views, types, functions and triggers. Matches for development terms
`v7`, `v8`, `v9`, `v10`, `s10`, `legacy`, `phase`, `experimental`, `temporary`,
`automatic`, `crew_auto_`, `crew_editorial_`, `crew_active_`: **0**.
The release value `s10-scoped-production-v1` in a guard is frozen policy provenance,
not an object name or an architectural layer.

[Decision and validation](database-publication-baseline.md).
