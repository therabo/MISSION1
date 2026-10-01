"""Sampling evidence; categories are V8 labels, not invented wall/GPU costs."""
from collections import defaultdict
from pathlib import Path
import json, sys
root=Path(sys.argv[1]); report={}
for file in sorted(root.glob('*-cpu-cycle*.json')):
    data=json.loads(file.read_text()); nodes={n['id']:n for n in data['nodes']}
    totals=defaultdict(float); categories=defaultdict(float)
    for sample,delta in zip(data.get('samples',[]),data.get('timeDeltas',[])):
        frame=nodes[sample]['callFrame']; name=frame['functionName'] or '(anonymous)'
        totals[name]+=delta/1000
        category='idle' if name=='(idle)' else 'gc' if name=='(garbage collector)' else 'sampledActive'
        categories[category]+=delta/1000
    report[file.name]={'durationMs':(data['endTime']-data['startTime'])/1000,
      'samples':len(data.get('samples',[])),'categoriesMs':dict(categories),
      'topSelfSamplesMs':sorted(totals.items(),key=lambda x:x[1],reverse=True)[:20]}
(root/'cpu-analysis.json').write_text(json.dumps({'method':'CDP Profiler 1ms sampling; idle/GC native V8 labels, self samples; rendering preparation and React cannot be perfectly separated in minified profiles. Per-frame camera CPU is measured directly in raw traces.', 'profiles':report},indent=2))
print('CPU profiles:',len(report))
