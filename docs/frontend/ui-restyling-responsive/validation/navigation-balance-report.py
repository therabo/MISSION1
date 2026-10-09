"""Assert viewport centering, whole-group spacing and frozen desktop geometry.

Usage: python navigation-balance-report.py BEFORE_MATRIX DEV_MATRIX PROD_MATRIX OUTPUT
Inputs are responsive-matrix.cjs output directories, not app data fixtures.
"""
import json
import sys
from pathlib import Path

before_path, dev_path, prod_path, output = map(Path, sys.argv[1:])
before = json.loads((before_path / 'matrix.json').read_text())
report = {'method': 'Visible date text-range union; calendar surface rectangle; equal gaps between semantic control groups. Desktop comparison uses native control rectangles and header styling.', 'builds': []}
for directory in (dev_path, prod_path):
    matrix = json.loads((directory / 'matrix.json').read_text())
    assert not matrix['summary']['failures'] and not matrix['summary']['continuityFailures']
    assert not matrix['errors'] and not matrix['console']
    rows, desktop = [], []
    for state in matrix['states']:
        for entry in state['entries']:
            navigation = entry['navigation']
            if entry['width'] <= 1243:
                assert navigation['dateDelta'] <= 2, (state['state'], entry['width'], navigation)
                # Five semantic groups on one row; on narrow phones, source /
                # temporal / Crew share the second row in native focus order.
                groups = navigation['groups'][2:] if entry['width'] <= 600 else navigation['groups']
                gaps = [right['x'] - left['x'] - left['width'] for left, right in zip(groups, groups[1:])]
                assert min(gaps) >= 8 and max(gaps) - min(gaps) <= .1, (state['state'], entry['width'], gaps)
                assert max(g['y'] + g['height'] / 2 for g in groups) - min(g['y'] + g['height'] / 2 for g in groups) <= .1
                if entry['calendarPosition'] and entry['calendarPosition']['mode'] == 'compact':
                    assert entry['calendarPosition']['delta'] <= 2
                rows.append({'state': state['state'], 'width': entry['width'], 'height': entry['height'],
                             'dateCenterX': navigation['dateCenterX'], 'viewportCenterX': navigation['viewportCenterX'],
                             'dateDelta': navigation['dateDelta'], 'groupGaps': gaps,
                             'headerHeight': entry['areas']['.top-context-bar']['height'], 'calendar': entry['calendarPosition']})
            else:
                old_state = next(s for s in before['states'] if s['state'] == state['state'])
                old = next(e for e in old_state['entries'] if e['width'] == entry['width'])
                assert old['areas']['.top-context-bar'] == entry['areas']['.top-context-bar']
                assert old['styles']['.top-context-bar'] == entry['styles']['.top-context-bar']
                names = ('Earth', 'ISS Inspection', 'Orbital source', 'Current', 'Historical', 'Crew')
                for name in names:
                    first = next(c for c in old['controls'] if c['name'] == name)
                    second = next(c for c in entry['controls'] if c['name'] == name)
                    assert all(abs(first[k] - second[k]) < .01 for k in ('x', 'y', 'width', 'height')), (state['state'], entry['width'], name)
                desktop.append({'state': state['state'], 'width': entry['width'], 'controls': len(names), 'result': 'PASS'})
    report['builds'].append({'build': matrix['build'], 'states': matrix['summary']['states'], 'captures': matrix['summary']['captures'],
                            'continuousObservations': sum(len(s['entries']) for s in matrix['continuity']),
                            'maxDateDelta': max(r['dateDelta'] for r in rows),
                            'maxCompactCalendarDelta': max(r['calendar']['delta'] for r in rows if r['calendar'] and r['calendar']['mode'] == 'compact'),
                            'desktop': desktop, 'compact': rows, 'result': 'PASS'})
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps([{k: b[k] for k in ('build', 'states', 'captures', 'continuousObservations', 'maxDateDelta', 'maxCompactCalendarDelta', 'result')} for b in report['builds']]))
