"""Analyze captured camera frames; pose time and render completion remain separate."""
from pathlib import Path
import json, math, statistics, csv, os

ROOT = Path(os.environ.get('MISSION1_EVIDENCE_DIR', Path(__file__).resolve().parent.parent))

def quant(values, fraction):
    a = sorted(values)
    return a[min(len(a)-1, int(fraction*(len(a)-1)))]

def stats(values, target=None):
    mean = statistics.mean(values)
    target = target or mean
    deviations = [abs(v / target - 1) for v in values]
    return dict(n=len(values),mean=mean,median=statistics.median(values),min=min(values),max=max(values),
                standardDeviation=statistics.pstdev(values),coefficientOfVariation=statistics.pstdev(values)/mean,
                intended=target,p95FractionalDeviation=quant(deviations,.95),worstFractionalDeviation=max(deviations))

def angle(a,b):
    # atan2 avoids acos rounding small differences to zero.
    cross = (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    return math.degrees(math.atan2(math.sqrt(sum(v*v for v in cross)),sum(x*y for x,y in zip(a,b))))

def quaternion(direction, up):
    # Reconstruct the rendered camera rotation: columns right, orthogonal up, -direction.
    cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    unit=lambda a:[x/math.sqrt(sum(v*v for v in a)) for x in a]
    d=unit(direction);r=unit(cross(d,up));u=unit(cross(r,d));z=[-v for v in d]
    m=[[r[i],u[i],z[i]] for i in range(3)];trace=sum(m[i][i] for i in range(3))
    if trace>0:
        scale=math.sqrt(trace+1)*2
        q=[(m[2][1]-m[1][2])/scale,(m[0][2]-m[2][0])/scale,(m[1][0]-m[0][1])/scale,scale/4]
    else:
        i=max(range(3),key=lambda i:m[i][i]);j=(i+1)%3;k=(i+2)%3
        scale=math.sqrt(1+m[i][i]-m[j][j]-m[k][k])*2;q=[0,0,0,0]
        q[i]=scale/4;q[j]=(m[i][j]+m[j][i])/scale;q[k]=(m[i][k]+m[k][i])/scale;q[3]=(m[k][j]-m[j][k])/scale
    return unit(q)

def quaternion_angle(a,b):
    # Sign-equivalent quaternion rotations; stable small-angle norm identity.
    if sum(x*y for x,y in zip(a,b))<0:b=[-v for v in b]
    return math.degrees(4*math.atan2(math.dist(a,b),math.sqrt(sum((x+y)**2 for x,y in zip(a,b)))))

def visible(f):
    s=f['displayScreen']
    return s is not None and 0<=s[0]<=1280 and 0<=s[1]<=720

reports=[]
for name in ['baseline','strict-arc-candidate']:
    data=json.loads((ROOT/(name+'-trace.json')).read_text())
    rows=[]
    for row in data['rows']:
        for kind, mode in [('entry','ENTERING_INSPECTION'),('exit','EXITING_INSPECTION')]:
            frames=row[kind]['frames']
            prior=None
            for frame in frames:
                q=quaternion(frame['direction'],frame['up'])
                if prior and sum(x*y for x,y in zip(prior,q))<0:q=[-v for v in q]
                frame['cameraQuaternionDerivedFromBasis']=q;prior=q
            interior=[f for f in frames if f['mode']==mode]
            target = (row['path' if kind=='entry' else 'exitPath']['pathLength'] or
                      sum(math.dist(b['relative'],a['relative']) for a,b in zip(interior,interior[1:]))) / 5
            metrics={}
            for time in ['appliedMs','wall']:
                dt=[(b[time]-a[time])/1000 for a,b in zip(interior,interior[1:])]
                speeds=[math.dist(b['relative'],a['relative'])/t for a,b,t in zip(interior,interior[1:],dt)]
                world=[math.dist(b['position'],a['position'])/t for a,b,t in zip(interior,interior[1:],dt)]
                angular=[angle(a['direction'],b['direction'])/t for a,b,t in zip(interior,interior[1:],dt)]
                metrics[time]={'relativeSpeed':stats(speeds,target),'worldSpeed':stats(world),
                               'maxAngularVelocityDegreesPerSecond':max(angular)}
                worst=max(range(len(speeds)),key=lambda i: abs(speeds[i]/target-1))
                pair=interior[worst:worst+2]
                metrics[time]['worstSpeedPair']={
                    'frames':[f['frameIndex'] for f in pair], 'progress':[f['progress'] for f in pair],
                    'poseDeltaMs':pair[1]['appliedMs']-pair[0]['appliedMs'],
                    'renderDeltaMs':pair[1]['wall']-pair[0]['wall'],
                    'renderLatencyMs':[f['wall']-f['appliedMs'] for f in pair]}
            # Boundary changes are retained separately: do not hide finite last-frame
            # motion or apparent-size changes behind zero transform-handoff error.
            active_pairs=[(a,b) for a,b in zip(frames,frames[1:]) if a['mode']==mode or b['mode']==mode]
            boundary={'maxDirectionStepDegrees':max(angle(a['direction'],b['direction']) for a,b in active_pairs),
              'maxUpStepDegrees':max(angle(a['up'],b['up']) for a,b in active_pairs),
              'maxAngularVelocityDegreesPerSecond':max(angle(a['direction'],b['direction'])*1000/(b['wall']-a['wall']) for a,b in active_pairs)}
            boundary['maxQuaternionStepDegrees']=max(quaternion_angle(a['cameraQuaternionDerivedFromBasis'],b['cameraQuaternionDerivedFromBasis']) for a,b in active_pairs)
            boundary['maxQuaternionAngularVelocityDegreesPerSecond']=max(quaternion_angle(a['cameraQuaternionDerivedFromBasis'],b['cameraQuaternionDerivedFromBasis'])*1000/(b['wall']-a['wall']) for a,b in active_pairs)
            boundary['lastActive']={k:interior[-1][k] for k in ['frameIndex','progress','range','fov','footprint']}
            boundary['firstCompleted']={k:next(f for f in frames if f['frameIndex']>interior[-1]['frameIndex'])[k] for k in ['frameIndex','progress','range','fov','footprint']}
            directionChanges=[angle(a['direction'],b['direction']) for a,b in zip(interior,interior[1:])]
            upChanges=[angle(a['up'],b['up']) for a,b in zip(interior,interior[1:])]
            bad=[f for f in interior if not visible(f)]
            dt=[b['wall']-a['wall'] for a,b in zip(interior,interior[1:])]
            screen=[f['displayScreen'] for f in interior if f['displayScreen']]
            final=frames[-1]
            restoration=None
            if kind=='exit':
                saved=row['exit']['saved']
                array=lambda v:[v['x'],v['y'],v['z']]
                restoration={'positionErrorMeters':math.dist(final['position'],array(saved['position'])),
                    'directionErrorDegrees':angle(final['direction'],array(saved['direction'])),
                    'upErrorDegrees':angle(final['up'],array(saved['up'])),'fovErrorRadians':final['fov']-saved['fov']}
            result={'build':name,'source':row['source'],'kind':kind,'analyzedFrames':len(frames),'interiorFrames':len(interior),
                    'boundaryInclusive':boundary,'speed':metrics,'maxDirectionStepDegrees':max(directionChanges),'maxUpStepDegrees':max(upChanges),
                    'offscreenFrames':len(bad),'firstOffscreen':bad[0] if bad else None,
                    'screenBounds':{'minX':min(s[0] for s in screen),'maxX':max(s[0] for s in screen),
                                    'minY':min(s[1] for s in screen),'maxY':max(s[1] for s in screen)},
                    'restoration':restoration,'handoffs':row[kind]['handoffs'],
                    'performance':{'frames':len(interior),'medianFPS':1000/quant(dt,.5),'p50Ms':quant(dt,.5),
                         'p95Ms':quant(dt,.95),'p99Ms':quant(dt,.99),'worstMs':max(dt),
                         'over33_3Ms':sum(t>33.3 for t in dt),'over50Ms':sum(t>50 for t in dt),
                         'longTasks':[t for t in data['metadata']['longTasks'] if interior[0]['wall']<=t['start']<=interior[-1]['wall']]}}
            rows.append(result)
            with (ROOT/(name+'-'+row['source']+'-'+kind+'.csv')).open('w') as file:
                keys=['frameIndex','wall','appliedMs','progress','mode','utc','position','physical','display','direction','up','right','cameraQuaternionDerivedFromBasis','relative','range','earthRange','height','transform','fov','lift','silhouette','inputs','issScreen','displayScreen','earthScreen','targetScreen']
                writer=csv.DictWriter(file,fieldnames=keys)
                writer.writeheader();writer.writerows({k:f.get(k) for k in keys} for f in frames)
    reports.extend(rows)
(ROOT/'analysis.json').write_text(json.dumps(reports,indent=2))
for r in reports:
    print(r['build'],r['source'],r['kind'],'CV pose/render',r['speed']['appliedMs']['relativeSpeed']['coefficientOfVariation'],r['speed']['wall']['relativeSpeed']['coefficientOfVariation'],'offscreen',r['offscreenFrames'],'timing',r['performance'])

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(2,2,figsize=(12,7))
    for j,source in enumerate(['PRIMARY_GP_TLE','NASA_OEM']):
        for i,kind in enumerate(['entry','exit']):
            ax=axes[i,j]
            for label in ['baseline','strict-arc-candidate']:
                data=json.loads((ROOT/(label+'-trace.json')).read_text())
                row=next(r for r in data['rows'] if r['source']==source)
                frames=[f for f in row[kind]['frames'] if f['mode']==('ENTERING_INSPECTION' if kind=='entry' else 'EXITING_INSPECTION')]
                for time,style in [('appliedMs','-'),('wall',':')]:
                    v=[math.dist(b['relative'],a['relative'])*1000/(b[time]-a[time])/1e6 for a,b in zip(frames,frames[1:])]
                    ax.plot([f['progress'] for f in frames[1:]],v,style,label=label+' / '+time,linewidth=1)
            ax.set(title=source+' / '+kind,xlabel='Transition progress',ylabel='Relative speed (million m/s)');ax.grid(alpha=.2)
    axes[0,0].legend(fontsize=7)
    fig.tight_layout();fig.savefig(ROOT/'speed-comparison.png',dpi=150);plt.close(fig)
except ImportError:
    pass
