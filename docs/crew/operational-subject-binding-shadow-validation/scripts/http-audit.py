from pathlib import Path
import json,subprocess,urllib.request,datetime,sys
R=Path('/Users/daniel/.codex/exports/mission1-s10-shadow');mode=sys.argv[1]
def sql(q):return subprocess.check_output(['docker','exec','-e','PGOPTIONS=-c default_transaction_read_only=on','mission1-postgres-1','psql','-U','mission1','-d','mission1','-At','-c',q],text=True)
def fp():
 tables=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
 return sorted(sql(' UNION ALL '.join([f'''SELECT '{t}',count(*),md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) FROM "{t}" t''' for t in tables])).splitlines())
current=json.loads((R/'baseline-current.json').read_text()); ids=[m['id'] for m in current['members']]
ids+=['4cb06b5a-b94c-4ea8-9d66-8f54cd6a0bf2','2425a25d-fc4c-40ab-b1b3-1b88cd3ce3ed','e0ead20d-bbb0-4a6e-8da8-bf6b857a68b5','9735513f-4ad9-44ba-863d-4f05978fca61','9cd14c46-8b34-41b7-9fec-5ea736fa974b','b4932ff9-75e7-4eb4-b8c1-0362acb27356']
urls=['/api/iss/crew']+['/api/iss/crew/'+i for i in ids]+['/api/iss/replay?at='+t.replace(':','%3A') for t in ['2026-10-01T12:00:00Z','2026-10-03T12:04:00Z','2026-10-10T12:00:00Z']]
before=fp();responses={}
for u in urls:
 with urllib.request.urlopen('http://127.0.0.1:8080'+u,timeout=30) as response:responses[u]={'status':response.status,'body':json.load(response)}
after=fp();assert before==after,'GET wrote tables'
(R/(mode+'-http.json')).write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tables':len(before),'before':before,'after':after,'responses':responses,'writes':0},indent=2)+'\n')
print(mode,'GETS',len(responses),'tables',len(before),'writes',0)
