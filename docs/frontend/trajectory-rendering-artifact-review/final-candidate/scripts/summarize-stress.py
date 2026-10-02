"""Summarize recorded traces; never instruments the product renderer."""
from pathlib import Path
import gzip
import json
import sys

base = Path(__file__).resolve().parents[1]
zero_keys = ['utcChanges', 'firstPhysicalEpochChanges', 'lastPhysicalEpochChanges',
             'hashChanges', 'epochHashChanges', 'endpointChanges', 'pathLengthChanges',
             'primitiveChanges', 'geometryChanges', 'geometryBuildCountChanges',
             'unexpectedHiddenFrames', 'lostFarSafeSamples',
             'correctionGapJumpSeconds', 'correctionOriginJumpCssPx']
measures = {
    'minimumAnalyticalVisibleFraction': ('minVisibleFraction', min),
    'minimumPhysicalShaderFraction': ('minPhysicalShaderFraction', min),
    'minimumLocalProtectionFraction': ('minLocalProtectionFraction', min),
    'maximumAnalyticalEpochJumpSeconds': ('maxEpochJumpSeconds', max),
    'maximumGapOnlyScreenMotionCssPixels': ('maxOriginMotionCssPx', max),
    'maximumLocalProtectionSeconds': ('maxLocalProtectionSeconds', max),
    'maximumLocalProtectionPathMetres': ('maxLocalProtectionPathMetres', max),
    'maximumAnalyticalGapSeconds': ('maxGapSeconds', max),
    'maximumAnalyticalGapPathMetres': ('maxGapPathMetres', max),
    'maximumAnalyticalGapScreenCssPixels': ('maxGapScreenCssPixels', max),
}

def summarize(folder, labels):
    runs = []
    for label in labels:
        report = json.loads((base / folder / (label + '-summary.json')).read_text())
        assert not report['errors'], (label, report['errors'])
        runs.extend(dict(build=label, **row) for row in report['runs'])
    result = dict(frames=sum(row['frames'] for row in runs),
                  zeroGateTotals={key: sum(row[key] for row in runs) for key in zero_keys},
                  **{name: operation(row[key] for row in runs)
                     for name, (key, operation) in measures.items()}, runs=runs)
    trace_max = 0
    for label in labels:
        for path in (base / folder).glob(label + '-*.json.gz'):
            trace = json.loads(gzip.decompress(path.read_bytes()))
            trace_max = max(trace_max, *(row.get('localProtectionScreenCssPixels') or 0
                                        for row in trace['frames']))
    result['maximumLocalProtectionScreenCssPixels'] = trace_max
    (base / folder / 'aggregate.json').write_text(json.dumps(result, indent=2))
    print(folder, json.dumps({key: value for key, value in result.items() if key != 'runs'}))
    return result

summarize('validated-stress', ['validated-dev', 'validated-prod'])
# Run again after these serial follow-up jobs finish to include their latest data.
stress_only = '--stress-only' in sys.argv
if not stress_only:
    summarize('validated-origin', ['validated-dev-origin', 'validated-prod-origin'])
    summarize('validated-memory', ['validated-memory'])

proof = []
keys = ['sampleHash', 'epochHash', 'physicalEndpoint', 'physicalPathLength',
        'sampleCount', 'firstPhysicalEpoch', 'lastPhysicalEpoch']
folders = [('validated-stress', 'validated-')]
if not stress_only:
    folders.append(('validated-memory', 'validated-memory-'))
for folder, prefix in folders:
    for path in sorted((base / folder).glob(prefix + '*.json.gz')):
        trace = json.loads(gzip.decompress(path.read_bytes()))
        frames = trace['frames']
        reference = {key: frames[0][key] for key in keys}
        changes = sum(any(row[key] != reference[key] for key in keys) for row in frames)
        builder_changes = sum(row['geometryBuildCount'] != frames[0]['geometryBuildCount']
                              for row in frames)
        assert changes == builder_changes == 0, path
        proof.append(dict(run=folder + '/' + path.name, frames=len(frames), **reference,
                          physicalStateChanges=changes, builderChanges=builder_changes))
(base / 'physical-invariance.json').write_text(json.dumps(dict(
    encoding='Native Float64Array xyz positions / source sample-millisecond epochs, SHA-256.',
    runtimeSourceHashes=json.loads((base / 'runtime-source-hashes.json').read_text()),
    runs=proof), indent=2))
