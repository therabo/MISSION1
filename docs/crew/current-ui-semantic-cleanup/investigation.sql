BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT id,document_id,evidence_type,completeness,crew_count,assertion_url,source_published_at
FROM crew_verification_evidence WHERE crew_count IS NOT NULL ORDER BY id;
SELECT s.*,e.document_id,e.evidence_type,e.assertion,e.assertion_url
FROM crew_evidence_subject s JOIN crew_verification_evidence e ON e.id=s.evidence_id
ORDER BY evidence_id,subject_index;
SELECT * FROM crew_active_projection_slot
WHERE projection_id=(SELECT max(id) FROM crew_active_projection_revision) ORDER BY state,slot_key;
SELECT id,reconciliation_as_of,official_crew_count,unidentified_count
FROM crew_reconciliation_snapshot ORDER BY id;
ROLLBACK;
