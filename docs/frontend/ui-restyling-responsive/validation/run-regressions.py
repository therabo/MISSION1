"""Run native regression suites serially to bound host WebGL resource usage."""
from pathlib import Path
import json, os, subprocess, time, tempfile

root = Path(__file__).resolve().parents[4]
base = Path(os.environ.get('MISSION1_QA_OUTPUT', Path(tempfile.gettempdir()) / 'mission1-responsive-regressions'))
base.mkdir(parents=True, exist_ok=True)
scripts = root / 'docs/frontend/ui-restyling/validation/scripts'
node = '/opt/homebrew/opt/node@24/bin/node'
jobs = [('development', 'inspection'), ('development', 'crew'),
        ('development', 'astronaut'), ('development', 'historical-crew'),
        ('production', 'crew'), ('production', 'astronaut'),
        ('production', 'historical-crew'), ('production', 'module-selection')]
results = []
for build, suite in jobs:
    folder = base / 'edge' / build / suite
    if suite == 'inspection':
        folder = base / 'interactions/development'
    folder.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, MISSION1_QA_OUTPUT=str(folder),
               MISSION1_PLAYWRIGHT_MODULE='/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
    if suite == 'inspection':
        env['MISSION1_INSPECTION_FLOWS_ONLY'] = '1'
    url = 'http://127.0.0.1:5175/' if build == 'development' else 'http://127.0.0.1:4175/'
    log = base / f'{suite}-{build}.log'
    print(f'Start {build} {suite}', flush=True)
    started = time.time()
    with log.open('w') as output:
        result = subprocess.run([node, str(scripts / f'browser-{suite}-qa.cjs'), url, build],
                                cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
    results.append({'build': build, 'suite': suite, 'exitCode': result.returncode,
                    'seconds': round(time.time()-started), 'log': str(log.relative_to(base))})
    (base/'regression-runs.json').write_text(json.dumps(results, indent=2)+'\n')
    print(f'End {build} {suite}: {result.returncode}', flush=True)
    if result.returncode:
        print(log.read_text()[-3000:], flush=True)
raise SystemExit(any(r['exitCode'] for r in results))
