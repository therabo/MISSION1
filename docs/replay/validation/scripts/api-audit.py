"""Read existing PostgreSQL and localhost API only; no provider fetches or DB writes."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import subprocess,json,time,statistics,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[4];OUT=ROOT/'docs/replay/validation';BASE='http://127.0.0.1:8080'
def sql(q):
 return subprocess.check_output(['docker','exec','mission1-postgres-1','psql','-U','mission1','-d','mission1','-At','-c',q],text=True).strip()
def get(path):
 with urllib.request.urlopen(BASE+path) as r:return json.load(r)
def stamp():return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def digest():
 result={}
 for table in sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines():
  n,d=sql(f"SELECT count(*),md5(COALESCE(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) FROM {table} t").split('|');result[table]={'rows':int(n),'digest':d}
 return result
coverage=get('/api/iss/replay/coverage');before=digest();now=stamp()
values={'earliest':'2026-10-02T02:01:55Z','middle':'2026-10-02T23:00:00Z','latest':(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat().replace('+00:00','Z'),'unsupported':'2026-01-01T00:00:00Z','element_epoch':'2026-10-03T01:06:34.599456Z','between_epochs':'2026-09-28T15:01:34.207968Z','gp_lower_boundary':'2026-09-27T03:24:39.835008Z','outside_orbit':'2026-09-27T03:24:38.835008Z','gp_gap_oem_only':'2026-09-30T10:00:00Z','structured_first_capture':'2026-10-03T10:30:18.796289Z'}
examples={}
for label,t in values.items():
 x=get('/api/iss/replay?at='+t);(OUT/(label+'-response.json')).write_text(json.dumps(x,indent=2)+'\n');examples[label]={'at':t,'crewAvailability':x['crew']['availability'],'counts':x['crew']['state']['counts'] if x['crew']['state'] else None,'orbitAvailability':x['orbit']['availability'],'primary':x['orbit']['primary'],'secondary':x['orbit']['secondary'],'sourceSeparationMeters':x['orbit']['sourceSeparationMeters']}
# Ignore execution timestamp and growing coverage end when checking repeat/restart deterministic operational facts.
def facts(x):return {'crew':x['crew']['state'],'profiles':x['crew']['profiles'],'primary':x['orbit']['primary'],'secondary':x['orbit']['secondary']}
a=get('/api/iss/replay?at='+values['middle']);get('/api/iss/replay?at='+values['earliest']);b=get('/api/iss/replay?at='+values['middle']);assert facts(a)==facts(b)
timings=[]
for i in range(35):
 start=time.perf_counter();get('/api/iss/replay?at='+values['middle']);elapsed=(time.perf_counter()-start)*1000
 if i>=5:timings.append(elapsed)
sorted_times=sorted(timings);after=digest();assert before==after,'Replay mutated stored state'
errors={}
for value in ['bad','2027-01-01T00:00:00Z']:
 try:get('/api/iss/replay?at='+value);raise AssertionError('Invalid time accepted')
 except urllib.error.HTTPError as e:errors[value]=e.code;assert e.code==400
report={'capturedAt':now,'coverage':coverage,'examples':examples,'databaseBefore':before,'databaseAfter':after,'zeroWrites':before==after,'errors':errors,'repeatedOperationalFactsEqual':True,'missionHttpPerformance':{'n':30,'medianMs':statistics.median(timings),'p95Ms':sorted_times[28],'worstMs':max(timings)},'nativePinch':'UNVERIFIED'}
(OUT/'api-audit.json').write_text(json.dumps(report,indent=2)+'\n');(OUT/'coverage-response.json').write_text(json.dumps(coverage,indent=2)+'\n')
print(json.dumps({'capturedAt':now,'coverage':coverage,'zeroWrites':True,'missionHttpPerformance':report['missionHttpPerformance']}))
