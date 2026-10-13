#!/usr/bin/env python3
"""Read-only metadata collector. No row export, import or SQL mutation path."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, urllib.request, urllib.error
# Evidence (including local disposable credentials) must remain outside the checkout.
ROOT = pathlib.Path(os.environ['MISSION1_CLEANROOM_EVIDENCE']).expanduser().resolve()
REPOSITORY = pathlib.Path(__file__).resolve().parents[4]
if ROOT.is_relative_to(REPOSITORY):
    raise ValueError('Evidence directory must be outside the repository')
ROOT.mkdir(parents=True, exist_ok=True)
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def command(args): return subprocess.check_output(args, text=True)
def sql(container, database, query):
    return subprocess.check_output(['docker','exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','mission1','-d',database], input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n', text=True)
def fingerprint(container, database):
    tables=sql(container,database,"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;").splitlines()
    queries=[]
    for table in tables:
        assert table.replace('_','').isalnum()
        queries.append("SELECT json_build_object('table','"+table+"','count',count(*),'bytes',pg_total_relation_size('public.\""+table+"\"'),'hashes',coalesce(json_agg(h ORDER BY h),'[]'::json)) FROM (SELECT md5(row_to_json(t)::text) h FROM public.\""+table+"\" t) r;")
    result={'at':now(),'container':container,'database':database,'tables':[json.loads(s) for s in sql(container,database,'\n'.join(queries)).splitlines()]}
    if 'flyway_schema_history' in tables:
        result['flyway']=json.loads(sql(container,database,"SELECT coalesce(json_agg(row_to_json(t) ORDER BY installed_rank),'[]'::json) FROM flyway_schema_history t;"))
    result['connections']=json.loads(sql(container,database,"SELECT coalesce(json_agg(row_to_json(t)),'[]'::json) FROM (SELECT datname,usename,application_name,client_addr,state FROM pg_stat_activity WHERE datname=current_database()) t;"))
    return result
def get(port,path):
    t=now()
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}'+path,timeout=45) as r: return {'at':t,'status':r.status,'body':json.load(r)}
    except urllib.error.HTTPError as e: return {'at':t,'status':e.code,'body':json.load(e)}
    except Exception as e: return {'at':t,'error':str(e)}
def apis(port):
    result={p:get(port,p) for p in ['/api/iss/crew','/api/iss/expedition/current','/api/iss/state','/api/iss/replay/coverage','/api/iss/replay?at=2026-10-02T02:01:55Z','/api/iss/replay?at=2026-10-07T12:05:00Z','/api/iss/replay?at=2026-10-10T12:00:00Z']}
    body=result['/api/iss/crew'].get('body',{})
    members=body.get('members',[])
    if members:
        person=members[0].get('person', members[0]); identifier=person.get('id') or person.get('mission1Id') or members[0].get('id')
        if identifier: result['detail']=get(port,'/api/iss/crew/'+identifier)
    return result
def write(name,data):
    (ROOT/name).write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__':
    label,container,database,port=sys.argv[1:]
    write(label+'-fingerprint.json',fingerprint(container,database))
    write(label+'-api.json',apis(int(port)))
    print(label, 'metadata and API evidence captured')
