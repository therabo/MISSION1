"""Protected V1–V9 and actual HTTP acceptance; all SQL fingerprint reads use read-only transactions."""
import argparse
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', required=True)
    parser.add_argument('--after', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--http-before')
    args = parser.parse_args()
    before = json.loads(Path(args.before).read_text())
    after = json.loads(Path(args.after).read_text())
    original = {r['table']: r for r in before['before']}
    final = {r['table']: r for r in after['before']}
    changed = [t for t in original if t not in ('flyway_schema_history', 'nasa_oem_ephemerides', 'orbital_element_observations') and original[t] != final[t]]
    assert changed == [], changed
    sql = "SELECT json_build_object('table','flyway_schema_history','count',count(*),'digest',md5(coalesce(string_agg(row_to_json(x)::text,E'\\n' ORDER BY row_to_json(x)::text),''))) FROM (SELECT * FROM flyway_schema_history WHERE version::int<=9) x"
    result = subprocess.run(['docker', 'compose', 'exec', '-T', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', 'postgres', 'psql', '-X', '-U', 'mission1', '-d', 'mission1', '-At', '-c', sql], cwd=REPO, capture_output=True, text=True, check=True)
    assert json.loads(result.stdout) == original['flyway_schema_history']
    count = original['orbital_element_observations']['count']
    subset_sql = "SELECT json_build_object('table','orbital_element_observations','count',count(*),'digest',md5(coalesce(string_agg(row_to_json(x)::text,E'\\n' ORDER BY row_to_json(x)::text),''))) FROM (SELECT * FROM orbital_element_observations ORDER BY retrieved_at,element_set_id LIMIT " + str(count) + ") x"
    subset = subprocess.run(['docker','compose','exec','-T','-e','PGOPTIONS=-c default_transaction_read_only=on','postgres','psql','-X','-U','mission1','-d','mission1','-At','-c',subset_sql],cwd=REPO,capture_output=True,text=True,check=True)
    assert json.loads(subset.stdout) == original['orbital_element_observations']
    ignored, numeric = [], []

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
            if path.startswith('responses/replay/orbit/') and isinstance(a, float) and isinstance(b, float):
                limit = 1e-10 if any(k in path.lower() for k in ('latitude', 'longitude')) else 1e-7
                assert abs(a-b) <= limit, (path, a, b)
                numeric.append({'path': path, 'delta': abs(a-b), 'tolerance': limit})
            else:
                clock = path.endswith('/evaluatedAt') or path.endswith('/reconstructedAt')
                coverage = '/coverage/' in path and path.endswith('/end') and a == reconstructed
                assert clock or coverage, (path, a, b)
                ignored.append(path)

    http_before = json.loads(Path(args.http_before).read_text()) if args.http_before else before
    compare(http_before['responses'], after['responses'], 'responses')
    frozen = ['frontend', 'backend/src/main/java/org/mission1/replay', 'backend/src/main/java/org/mission1/api',
              'backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalFeedParser.java',
              'backend/src/main/java/org/mission1/source/crew/nasa/NasaOperationalPostParser.java']
    for number in range(1, 10):
        frozen.extend(str(p.relative_to(REPO)) for p in (REPO / 'backend/src/main/resources/db/migration').glob(f'V{number}__*'))
    assert subprocess.check_output(['git', 'diff', '--name-only', 'c1478014e72484485cbe5abcef1648f1a7f50946', '--', *frozen], cwd=REPO, text=True).strip() == ''
    assert after['before'] == after['after']
    oem_sql = "SELECT count(*)=5 AND bool_and(sha256=encode(sha256(xml),'hex')) FROM nasa_oem_ephemerides"
    oem = subprocess.run(['docker','compose','exec','-T','-e','PGOPTIONS=-c default_transaction_read_only=on','postgres','psql','-X','-U','mission1','-d','mission1','-At','-c',oem_sql],cwd=REPO,capture_output=True,text=True,check=True)
    assert oem.stdout.strip() == 't'
    oem_note = 'Existing orbital QA revalidated mutable OEM retrieval metadata; five retained XML payloads verify against their SHA keys.' if original['nasa_oem_ephemerides'] != final['nasa_oem_ephemerides'] else 'Unchanged'
    Path(args.output).write_text(json.dumps({'result': 'PASS', 'protectedTables': len(original)-1, 'getTables': len(final),
        'newTables': sorted(set(final)-set(original)), 'backgroundChanges': changed, 'requestClockPaths': ignored,
        'orbitalNumericDeltas': numeric, 'orbitalBackgroundMetadata': oem_note,
        'normalOrbitalObservationAppends': final['orbital_element_observations']['count']-count, 'frozenPaths': frozen}, indent=2)+'\n')
    print('PASS protected V1–V9 rows, frozen paths, Current/detail/Replay and all-table GET audit')


if __name__ == '__main__':
    main()
