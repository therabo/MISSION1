"""Summarize the matched browser traces; no application/runtime instrumentation."""
import gzip
import json
import math
import statistics
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:3])
target.mkdir(parents=True, exist_ok=True)


def stats(values):
    ordered = sorted(values)
    return {
        'n': len(values), 'mean': statistics.mean(values),
        'median': statistics.median(values),
        'p95': ordered[math.ceil(.95 * len(ordered)) - 1],
    }


result = {'units': 'milliseconds', 'runs': []}
for p in sorted(source.glob('*-trace.json')):
    data = json.loads(p.read_text())
    cases = []
    for row in data['rows']:
        for direction in ['entry', 'exit']:
            frames = row[direction]['frames']
            moving = [f for f in frames if f['mode'] in ['ENTERING_INSPECTION', 'EXITING_INSPECTION']]
            intervals = [b['wall'] - a['wall'] for a, b in zip(frames, frames[1:])
                         if a['mode'] in ['ENTERING_INSPECTION', 'EXITING_INSPECTION'] and b['mode'] == a['mode']]
            cases.append({'source': row['source'], 'cycle': row['cycle'], 'direction': direction,
                          'trajectoryCpu': stats([f['trajectoryCpu'] for f in moving]),
                          'cameraCpu': stats([f['mappingMs'] for f in moving]),
                          'frameInterval': stats(intervals)})
    moving = [f for row in data['rows'] for direction in ['entry', 'exit']
              for f in row[direction]['frames'] if f['mode'] in ['ENTERING_INSPECTION', 'EXITING_INSPECTION']]
    intervals = [b['wall'] - a['wall'] for row in data['rows'] for direction in ['entry', 'exit']
                 for a, b in zip(row[direction]['frames'], row[direction]['frames'][1:])
                 if a['mode'] in ['ENTERING_INSPECTION', 'EXITING_INSPECTION'] and b['mode'] == a['mode']]
    result['runs'].append({'label': data['label'], 'cases': cases,
                           'trajectoryCpu': stats([f['trajectoryCpu'] for f in moving]),
                           'cameraCpu': stats([f['mappingMs'] for f in moving]),
                           'frameInterval': stats(intervals), 'errors': data['errors'],
                           'retainedTransitions': data['retainedTransitions'],
                           'metadata': {k: data['metadata'][k] for k in ['renderer', 'canvas', 'readiness']},
                           'startupLongTasks': len(data['metadata']['longTasks']),
                           'heapBefore': data['heapBefore'], 'heapAfter': data['heapAfter']})
    # Keep every frame, compressed; retain the original disposable file for audit.
    with gzip.GzipFile(filename=str(target / (p.name + '.gz')), mode='wb', mtime=0) as f:
        f.write(p.read_bytes())
(target / 'performance.json').write_text(json.dumps(result, indent=2) + '\n')
for r in result['runs']:
    print(r['label'], 'trajectory mean', round(r['trajectoryCpu']['mean'], 4),
          'frame median/p95', round(r['frameInterval']['median'], 2), round(r['frameInterval']['p95'], 2))
