"""Recorded local-data acceptance check. Local HTTP and read-only SQL only; no provider calls."""
import argparse
import json
import subprocess
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]

def fingerprints():
    sql = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    def query(statement):
        result = subprocess.run(['docker', 'compose', 'exec', '-T', '-e',
            'PGOPTIONS=-c default_transaction_read_only=on', 'postgres', 'psql', '-X',
            '-U', 'mission1', '-d', 'mission1', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
            cwd=REPO, capture_output=True, text=True, check=True)
        return result.stdout.splitlines()
    tables = query(sql)
    commands = ["SELECT json_build_object('table','" + t + "','count',count(*),'digest',"
        "md5(coalesce(string_agg(row_to_json(x)::text,E'\\n' ORDER BY row_to_json(x)::text),''))) "
        'FROM "' + t + '" x' for t in tables]
    return [json.loads(x) for x in query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '
        + '; '.join(commands) + '; ROLLBACK;') if x.startswith('{')]

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--url', default='http://127.0.0.1:8080')
    args.add_argument('--output', required=True)
    options = args.parse_args()
    before = fingerprints()
    responses = {}
    def get(name, route):
        with urllib.request.urlopen(options.url + route) as response:
            assert response.status == 200
            value = json.load(response)
        responses[name] = value
        return value
    crew = get('current', '/api/iss/crew')
    assert len(crew['members']) == 10
    assert crew['counts']['structuredAssignments'] == 7
    assert [p['displayName'] for p in crew['unresolvedSubjects']] == ['Andrey Fedyaev']
    pairs = [('Luke', '09dea926-7480-4fc5-a340-01d44a6e5dae', '9cd14c46-8b34-41b7-9fec-5ea736fa974b'),
             ('Watkins', '6e700f29-14ab-415a-87e4-6567860c1796', 'b4932ff9-75e7-4eb4-b8c1-0362acb27356')]
    for name, root, alias in pairs:
        p = get(name + '-canonical', '/api/iss/crew/' + root)
        q = get(name + '-alias', '/api/iss/crew/' + alias)
        assert p['id'] == q['id'] == root
        assert q['canonicalProfile']['requestedId'] == alias
        for value in (p, q):
            assert value['profileAvailability'] == 'AVAILABLE' and value['biography']
            assert value['currentAssignment'] is not None
        # Request-evaluation time and requested alias are intentionally request-specific.
        a, b = json.loads(json.dumps(p)), json.loads(json.dumps(q))
        for value in (a, b):
            value.pop('reconciliation')
            value['canonicalProfile'].pop('requestedId')
        assert a == b
        assert len(p['canonicalProfile']['profileResources']) >= 3
    for member in crew['members']:
        if member['name'] in ('Jessica Meir', 'Jack Hathaway', 'Sophie Adenot'):
            assert member['assignment'] is None
            p = get(member['name'], '/api/iss/crew/' + member['id'])
            assert p['profileAvailability'] == 'AVAILABLE' and p['biography']
    replay = get('replay', '/api/iss/replay?at=2026-10-02T02%3A01%3A55Z')
    state = replay['crew']['state']
    assert len(state['members']) == 10 and len(state['unresolvedSubjects']) == 1
    assert state['expedition'] is None and state['counts']['structuredAssignments'] is None
    assert all(m['assignment'] is None for m in state['members'])
    after = fingerprints()
    assert before == after, 'GET altered retained data'
    path = Path(options.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'result': 'PASS', 'before': before, 'after': after,
        'responses': responses}, indent=2) + '\n')
    print('PASS: Current, aliases, independent metadata and Replay; all DB fingerprints unchanged')

if __name__ == '__main__':
    main()
