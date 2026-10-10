"""Read-only real DB/HTTP acceptance. Compare with the captured pre-edit/pre-acquisition audit."""
import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
SMOKE = REPO / 'docs/crew/canonical-identity-validation/scripts/readonly-smoke.py'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--url', default='http://127.0.0.1:8081')
    args = parser.parse_args()
    before = json.loads(Path(args.before).read_text())
    output = Path(args.output)
    get_path = output.with_name('final-get.json')
    subprocess.run([sys.executable, str(SMOKE), '--url', args.url, '--output', str(get_path)], check=True)
    after = json.loads(get_path.read_text())
    original = {row['table']: row for row in before['before']}
    final = {row['table']: row for row in after['before']}
    statements = []
    sources = {
        'crew_source_document': "SELECT * FROM crew_source_document WHERE source_type NOT IN ('NASA_EDITORIAL_TOPIC','NASA_EDITORIAL_EXPEDITION','NASA_PERSON_RESOURCE')",
        'crew_document_body': "SELECT * FROM crew_document_body WHERE content_hash IN (SELECT content_hash FROM crew_source_document WHERE source_type NOT IN ('NASA_EDITORIAL_TOPIC','NASA_EDITORIAL_EXPEDITION','NASA_PERSON_RESOURCE'))",
        'flyway_schema_history': "SELECT * FROM flyway_schema_history WHERE version::int<=7",
    }
    for table, source in sources.items():
        statements.append("SELECT json_build_object('table','" + table + "','count',count(*),'digest',md5(coalesce(string_agg(row_to_json(x)::text,E'\\n' ORDER BY row_to_json(x)::text),''))) FROM (" + source + ') x')
    sql = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ' + '; '.join(statements) + '; ROLLBACK;'
    result = subprocess.run(['docker', 'compose', 'exec', '-T', '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
                             'postgres', 'psql', '-X', '-U', 'mission1', '-d', 'mission1', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                            cwd=REPO, capture_output=True, text=True, check=True)
    protected = [json.loads(row) for row in result.stdout.splitlines() if row.startswith('{')]
    assert all(original[row['table']] == row for row in protected)
    assert all(value == final[table] for table, value in original.items() if table not in sources)
    ignored = []
    numeric_deltas = []

    def compare(a, b, path, reconstructed=None):
        if isinstance(a, dict):
            assert a.keys() == b.keys(), path
            reconstructed = a.get('reconstructedAt', reconstructed)
            for key in a:
                compare(a[key], b[key], path + '/' + key, reconstructed)
        elif isinstance(a, list):
            assert len(a) == len(b), path
            for index, (x, y) in enumerate(zip(a, b)):
                compare(x, y, path + '/' + str(index), reconstructed)
        elif a != b:
            if path.startswith('responses/replay/orbit/') and isinstance(a,float) and isinstance(b,float):
                delta=abs(a-b)
                limit=1e-10 if any(k in path.lower() for k in ('latitude','longitude')) else 1e-7
                assert delta<=limit,(path,a,b,delta)
                numeric_deltas.append({'path':path,'absoluteDelta':delta,'absoluteTolerance':limit})
                return
            clock = path.endswith('/evaluatedAt') or path.endswith('/reconstructedAt')
            coverage = '/coverage/' in path and path.endswith('/end') and a == reconstructed
            assert clock or coverage, (path, a, b)
            ignored.append(path)

    compare(before['responses'], after['responses'], 'responses')
    frozen = ['frontend', 'backend/src/main/java/org/mission1/replay',
              'backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalFeedParser.java',
              'backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalPostParser.java']
    for number in range(1, 8):
        frozen.extend(str(p.relative_to(REPO)) for p in (REPO / 'backend/src/main/resources/db/migration').glob(f'V{number}__*'))
    assert subprocess.check_output(['git', 'diff', '--name-only', 'b0b7eb4d95fb8151c5dfefb6fbb76cead1c20c67', '--', *frozen], cwd=REPO, text=True).strip() == ''
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'result': 'PASS', 'protectedLegacyTables': len(original),
        'allTablesUnchangedAcrossGet': len(final), 'originalSharedRows': protected,
        'ignoredDocumentedRequestClockPaths': ignored, 'newTables': sorted(set(final) - set(original)),
        'crossJvmOrbitalFloatingPointDeltas':numeric_deltas,
        'frozenSourcePaths': frozen}, indent=2) + '\n')
    print('PASS: protected legacy content, frozen source paths and unchanged read-only Current/detail/Replay')


if __name__ == '__main__':
    main()
