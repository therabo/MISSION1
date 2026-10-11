from pathlib import Path
import json,subprocess
R=Path('/Users/daniel/.codex/exports/mission1-s10-shadow')
# Exclude only verified response-clock fields; preserve all evidence/projection/profile timestamps.
def cleaned(response):
 out=json.loads(json.dumps(response));body=out['body']
 body.get('reconciliation',{}).pop('evaluatedAt',None)
 if 'membership' in body:
  body['membership'].pop('ageSeconds',None)
  body.get('freshness',{}).pop('evaluatedAt',None)
  body.get('reconciliation',{}).pop('evaluatedAt',None)
 if 'reconstructedAt' in body:
  clock=body.pop('reconstructedAt')
  for section in ['crew','orbit']:
   coverage=body.get(section,{}).get('coverage',{})
   if coverage.get('end')==clock:coverage['end']='<response clock>'
   for interval in coverage.get('intervals',[]):
    if interval.get('end')==clock:interval['end']='<response clock>'
 return out
ignored=['Current freshness.evaluatedAt','Current reconciliation.evaluatedAt','Current membership.ageSeconds','Replay reconstructedAt','Replay open coverage end equal to reconstructedAt']
b=json.loads((R/'before-http.json').read_text())['responses'];a=json.loads((R/'after-http.json').read_text())['responses']
changes=[]
for u in b:
 if cleaned(b[u])!=cleaned(a[u]):changes.append(u)
(R/'http-comparison.json').write_text(json.dumps({'requests':len(b),'changedSemanticResponses':changes,'excludedResponseClocks':sorted(ignored)},indent=2)+'\n')
print('semantic differences',changes)
assert not changes
before=json.loads((R/'baseline-tables.json').read_text());tables=[s.split('|')[0] for s in before if not s.startswith('flyway_schema_history|')]
queries=[f'''SELECT '{t}',count(*),md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) FROM "{t}" t''' for t in tables]
after=subprocess.check_output(['docker','exec','-e','PGOPTIONS=-c default_transaction_read_only=on','mission1-postgres-1','psql','-U','mission1','-d','mission1','-At','-c',' UNION ALL '.join(queries)],text=True).splitlines();old=[s for s in before if not s.startswith('flyway_schema_history|')]
changed=sorted(set(old)^set(after));(R/'production-freeze.json').write_text(json.dumps({'tables':len(tables),'changed':changed,'before':old,'after':sorted(after),'flywayExpectedAddition':'V11'},indent=2)+'\n');print('production tables',len(tables),'changes',changed);assert not changed
