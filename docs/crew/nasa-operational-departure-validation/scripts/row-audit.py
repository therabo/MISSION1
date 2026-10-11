"""Read-only immutable-row audit; retained row digests must survive permitted additive writes."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess

REPO = Path(__file__).resolve().parents[4]
MUTABLE = {'crew_auto_job', 'crew_active_projection_work', 'crew_nasa_request_budget'}
ADDITIVE = {'crew_source_document', 'crew_document_evidence', 'crew_verification_evidence',
    'crew_evidence_subject', 'crew_source_article', 'crew_source_article_observation',
    'crew_assertion_occurrence', 'crew_assertion_version', 'crew_assertion_observation',
    'crew_subject_occurrence', 'crew_subject_metadata_version', 'crew_subject_version_link',
    'crew_source_sync_run'}
def snapshot():
    def query(sql):
        return subprocess.run(['docker','compose','exec','-T','-e',
            'PGOPTIONS=-c default_transaction_read_only=on','postgres','psql','-X','-U',
            'mission1','-d','mission1','-At','-v','ON_ERROR_STOP=1','-c',sql], cwd=REPO,
            capture_output=True,text=True,check=True).stdout.splitlines()
    tables=query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    statements=["SELECT json_build_object('table','"+t+"','rows',coalesce(json_agg(h ORDER BY h),'[]'::json)) FROM "
        + '(SELECT md5(row_to_json(x)::text) h FROM "'+t+'" x) q' for t in tables]
    rows=[json.loads(x) for x in query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '
        + '; '.join(statements)+'; ROLLBACK;') if x.startswith('{')]
    migrations={str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (REPO/'backend/src/main/resources/db/migration').glob('V*.sql')}
    oem=[json.loads(x) for x in query("SELECT json_build_object('sha256',sha256,"
        "'payloadValid',sha256=encode(sha256(xml),'hex'),'bytes',octet_length(xml),"
        "'retrievedAt',last_retrieved_at) FROM nasa_oem_ephemerides ORDER BY sha256")]
    return {'tables':rows,'migrations':migrations,'oemPayloads':oem}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--before')
    parser.add_argument('--allow-orbital-qa-refresh',action='store_true',
        help='Explicitly report one existing OEM retrieval-metadata refresh during orbital browser QA')
    args=parser.parse_args();current=snapshot()
    if args.before:
        before=json.loads(Path(args.before).read_text());assert before['migrations']==current['migrations']
        latest={t['table']:Counter(t['rows']) for t in current['tables']};changes=[]
        for table in before['tables']:
            name=table['table'];old=Counter(table['rows']);new=latest[name]
            orbital_refresh=name=='nasa_oem_ephemerides' and old!=new and args.allow_orbital_qa_refresh
            if orbital_refresh:
                assert sum(old.values())==sum(new.values())==5
                assert sum((old-new).values())==sum((new-old).values())==1
                assert all(p['payloadValid'] for p in current['oemPayloads'])
                assert subprocess.check_output(['git','diff','c32d99086bb04cf3f06074fd7ca8b64972343e88',
                    '--','backend/src/main/java/org/mission1/orbital'],cwd=REPO,text=True)==''
                current['orbitalQaRefresh']='One OEM row refreshed by existing orbital first-use acquisition; five SHA-keyed XML payloads verify. Separate from Crew GET/reprocessing.'
            elif name not in MUTABLE:
                assert not old-new, 'Retained rows changed: '+name
                if name not in ADDITIVE and not name.startswith('crew_active_projection_'):
                    assert old==new, 'Protected table changed: '+name
            if old!=new:changes.append({'table':name,'before':sum(old.values()),'after':sum(new.values()),
                'added':sum((new-old).values()),'removed':sum((old-new).values()),'mutable':name in MUTABLE})
        current['changes']=changes;current['result']='PASS'
    Path(args.output).write_text(json.dumps(current,indent=2)+'\n')
    print('Row audit:',current.get('result','CAPTURED'),len(current['tables']),'tables')
if __name__=='__main__':main()
