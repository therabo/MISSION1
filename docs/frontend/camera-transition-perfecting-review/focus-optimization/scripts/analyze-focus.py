"""Actual rendered pose/focus derivatives; cadence is measured independently.

Finite acceleration differences are diagnostics, not proof of global C2.
Baseline has no explicit focus; never invent a baseline focal trajectory.
"""
from pathlib import Path
import csv, gzip, json, math, sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(sys.argv[1])
def angle(a, b):
    return math.atan2(np.linalg.norm(np.cross(a,b)), np.dot(a,b))
def stat(a):
    a = np.asarray(a)
    return {k:float(v) for k,v in dict(p50=np.percentile(a,50),p95=np.percentile(a,95),p99=np.percentile(a,99),worst=max(a)).items()} if len(a) else None
def active(raw, kind):
    mode = 'ENTERING_INSPECTION' if kind == 'entry' else 'EXITING_INSPECTION'
    ids = [i for i,f in enumerate(raw) if f['mode'] == mode]
    if not ids: raise ValueError('No active poses')
    if ids[-1]+1 < len(raw): ids.append(ids[-1]+1)
    return [raw[i] for i in ids]
def norm(a): return np.linalg.norm(a,axis=1)
def screens(frames,key,viewport):
    raw,visible = [],[]
    for a,b in zip(frames,frames[1:]):
        x,y = a[key],b[key]
        if x is None or y is None: continue
        step=math.dist(x,y); raw.append(step)
        if all(0<=p[0]<=viewport[0] and 0<=p[1]<=viewport[1] for p in [x,y]): visible.append(step)
    return {'maximumFiniteStepCss':max(raw) if raw else None,'maximumVisiblePairStepCss':max(visible) if visible else None}

report={'method':'postRender cadence, appliedMs pose derivatives, archived real backend products, same native DPR2; raw focus finite chords independent of coherent retained Back derivative','runs':{}}
plots={}
files={p.name.removesuffix('.gz'):p for p in root.glob('*-trace.json.gz')}
files.update({p.name:p for p in root.glob('*-trace.json')}) # fresh reruns take precedence
for file in sorted(files.values()):
    if not file.name.startswith(('baseline-','final-')): continue
    data=json.loads(gzip.decompress(file.read_bytes()) if file.suffix=='.gz' else file.read_text()); label=data['label']
    metadata=dict(data['metadata']); gpu=metadata.get('gpu')
    if gpu: metadata['gpu']={k:gpu[k] for k in ['supported','disjoint']}; metadata['gpu']['measuredFrames']=len(gpu['frames'])
    run={'viewport':data['viewport'],'dpr':data['dpr'],'metadata':metadata,'errors':data['errors'],'heapBefore':data.get('heapBefore'),'heapAfter':data.get('heapAfter'),'retainedTransitions':data.get('retainedTransitions'),'routes':[]}
    for row in data['rows']:
        for kind in ['entry','exit']:
            frames=active(row[kind]['frames'],kind); meta=row['path' if kind=='entry' else 'exitPath']
            t=np.array([f['appliedMs'] for f in frames])/1000
            dt=np.diff(t)
            if np.any(dt<=0): raise ValueError('Repeated pose '+label)
            cadence=np.diff([f['wall'] for f in frames])
            progress=np.array([f['progress'] for f in frames]); dirs=np.array([f['direction'] for f in frames]); ups=np.array([f['up'] for f in frames])
            steps=np.array([angle(a,b) for a,b in zip(dirs,dirs[1:])]); rates=np.degrees(steps/dt)
            up_rates=np.degrees([angle(a,b) for a,b in zip(ups,ups[1:])])/dt
            axes=np.cross(dirs[:-1],dirs[1:]); lengths=norm(axes); axes=axes/np.maximum(lengths[:,None],1e-30)
            omega=axes*(steps/dt)[:,None]
            focus=None; velocity=None; acceleration=None
            if all(f.get('focus') is not None for f in frames):
                focal=np.array([f['focus'] for f in frames]); velocity=np.diff(focal,axis=0)/dt[:,None]
                acceleration=np.diff(velocity,axis=0)/((dt[:-1]+dt[1:])/2)[:,None]
                focus={'maxVelocityMetersPerSecond':float(max(norm(velocity))),'maxVelocityChangeMetersPerSecond':float(max(norm(np.diff(velocity,axis=0)))),'maxAccelerationMetersPerSecondSquared':float(max(norm(acceleration))),'maxAdjacentAccelerationChangeMetersPerSecondSquared':float(max(norm(np.diff(acceleration,axis=0)))),'minimumRadiusMeters':min(math.dist(f['focus'],f['position']) for f in frames),'maximumRayErrorRadians':max(f.get('focusRayError') or 0 for f in frames)}
            tasks=[task for task in data['metadata']['longTasks'] if task['start']<frames[-1]['wall'] and task['start']+task['duration']>frames[0]['wall']]
            peak=int(np.argmax(rates))+1; jump=int(np.argmax(abs(np.diff(rates))))+2
            off=[f['frameIndex'] for f in frames if not f['displayScreen'] or not(0<=f['displayScreen'][0]<=data['viewport'][0] and 0<=f['displayScreen'][1]<=data['viewport'][1])]
            direction_errors=[f.get('requestedDirectionError') or 0 for f in frames]
            bad=[{'frameIndex':f['frameIndex'],'progress':f['progress'],'requestedDirectionErrorDegrees':math.degrees(f.get('requestedDirectionError') or 0),'requestedUpErrorDegrees':math.degrees(f.get('requestedUpError') or 0),'dtMs':float(cadence[i-1]) if i else None} for i,f in enumerate(frames) if (f.get('requestedDirectionError') or 0)>1e-6 or (f.get('requestedUpError') or 0)>1e-6]
            route={'cycle':row['cycle'],'source':row['source'],'kind':kind,'frames':len(frames),'duration':meta['duration'],'prepareMs':meta.get('prepareMs'),'performance':{**stat(cadence),'medianFPS':1000/float(np.median(cadence)),'over33_3':int(sum(cadence>33.3)),'over50':int(sum(cadence>50)),'longTasks':len(tasks)},'gpuMs':stat([g['milliseconds'] for g in data['metadata'].get('gpu',{}).get('frames',[]) if g['capture'] and frames[0]['wall']<=g['wall']<=frames[-1]['wall']]),'mappingMs':stat([f['mappingMs'] for f in frames]),'focusMs':stat([f.get('focusMs',0) for f in frames]),'maxDirectionDegreesPerSecond':float(max(rates)),'maxUpDegreesPerSecond':float(max(up_rates)),'maxAngularVelocityJumpDegreesPerSecond':float(max(abs(np.diff(rates)))),'maxAngularVectorJumpDegreesPerSecond':float(max(norm(np.diff(omega,axis=0))))*180/math.pi,'maxDirectionStepDegrees':float(max(steps))*180/math.pi,'peakDirection':{'frameIndex':frames[peak]['frameIndex'],'progress':frames[peak]['progress'],'rate':float(rates[peak-1]),'dtMs':float(cadence[peak-1])},'peakRateJump':{'frameIndex':frames[jump]['frameIndex'],'progress':frames[jump]['progress'],'beforeRate':float(rates[jump-2]),'afterRate':float(rates[jump-1]),'dtMs':float(cadence[jump-1])},'maximumRequestedDirectionErrorDegrees':math.degrees(max(direction_errors)),'changedAppliedBasisFrames':bad,'focus':focus,'issScreenSteps':screens(frames,'displayScreen',data['viewport']),'earthScreenSteps':screens(frames,'earthScreen',data['viewport']),'offscreenFrames':off,'resources':row.get('resources'),'firstEntryIntervals':[],'exitFocusInterval':None}
            for limit in [.05,.1,.2,.3] if kind=='entry' else []:
                indices=[i for i in range(1,len(frames)) if progress[i]<=limit]
                route['firstEntryIntervals'].append({'throughPercent':limit*100,'frames':len(indices),'maxDirectionDegreesPerSecond':max(float(rates[i-1]) for i in indices) if indices else None,'maxRenderDtMs':max(float(cadence[i-1]) for i in indices) if indices else None,'maxMappingMs':max(frames[i]['mappingMs'] for i in indices) if indices else None,'lastFocus':frames[indices[-1]]['focus'] if indices else None,'lastFocusBlend':frames[indices[-1]].get('focusBlend') if indices else None})
                part=route['firstEntryIntervals'][-1]
                part['maxFocusVelocityMetersPerSecond']=max(float(norm(velocity)[i-1]) for i in indices) if velocity is not None and indices else None
                part['maxFocusVelocityChangeMetersPerSecond']=max(float(np.linalg.norm(velocity[i-1]-velocity[i-2])) for i in indices if i>1) if velocity is not None and len(indices)>1 else None
                part['issScreenSteps']=screens(frames[:indices[-1]+1],'displayScreen',data['viewport']) if indices else None
                part['earthScreenSteps']=screens(frames[:indices[-1]+1],'earthScreen',data['viewport']) if indices else None
            if kind=='exit':
                focus_indices=[i for i,f in enumerate(frames) if f.get('focusBlend') is not None and 0<f['focusBlend']<1]
                if focus_indices:
                    route['exitFocusInterval']={'firstFrame':frames[focus_indices[0]]['frameIndex'],'lastFrame':frames[focus_indices[-1]]['frameIndex'],'startProgress':frames[focus_indices[0]]['progress'],'endProgress':frames[focus_indices[-1]]['progress'],'maxRenderDtMs':max(float(cadence[max(0,i-1)]) for i in focus_indices),'maxMappingMs':max(frames[i]['mappingMs'] for i in focus_indices)}
            run['routes'].append(route)
            if row['cycle']==0 and label.endswith('prod-gp') or row['cycle']==0 and label.endswith('prod-oem'): plots[(label,row['source'],kind)]=(frames,dt,rates)
            # Entire per-frame state is retained in JSON. Flat CSV makes focus/pace review easy.
            with (root/f"{label}-{row['source']}-cycle{row['cycle']}-{kind}.csv").open('w',newline='') as stream:
                writer=csv.writer(stream,lineterminator='\n');writer.writerow(['frame','progress','wallMs','appliedMs','dtRenderMs','directionRateDegSec','focusX','focusY','focusZ','focusVelocityMps','focusAccelerationMps2','focusBlend','focusRayErrorRad','requestedDirectionErrorRad','mappingMs','focusMs','fovRad','liftM','silhouette','issX','issY','earthX','earthY'])
                for i,f in enumerate(frames):writer.writerow([f['frameIndex'],f['progress'],f['wall'],f['appliedMs'],cadence[i-1] if i else '',rates[i-1] if i else '',*(f.get('focus') or ['']*3),float(np.linalg.norm(velocity[i-1])) if velocity is not None and i else '',float(np.linalg.norm(acceleration[i-2])) if acceleration is not None and i>1 else '',f.get('focusBlend'),f.get('focusRayError'),f.get('requestedDirectionError'),f['mappingMs'],f.get('focusMs',0),f['fov'],f['lift'],f['silhouette'],*(f['displayScreen'] or ['']*2),*(f['earthScreen'] or ['']*2)])
    report['runs'][label]=run
(root/'focus-analysis.json').write_text(json.dumps(report,indent=2,allow_nan=False))
for source,suffix in [('PRIMARY_GP_TLE','gp'),('NASA_OEM','oem')]:
    for kind in ['entry','exit']:
        fig,axes=plt.subplots(2,3,figsize=(14,8),constrained_layout=True)
        for version,color in [('baseline','#9c5150'),('final','#1383b3')]:
            key=(version+'-prod-'+suffix,source,kind)
            if key not in plots: continue
            frames,dt,rates=plots[key];p=np.array([f['progress'] for f in frames])*100
            axes[0,0].plot(p[1:],rates,label=version,color=color)
            axes[0,1].plot(p,np.degrees([angle(f['direction'],np.subtract(f['display'],f['position'])) for f in frames]),label=version,color=color)
            axes[0,2].plot(p,np.degrees([angle(f['direction'],np.negative(f['position'])) for f in frames]),label=version,color=color)
            axes[1,0].plot(p[1:],np.diff([f['wall'] for f in frames]),label=version,color=color)
            if version=='final':axes[1,1].plot(p,[f.get('focusBlend') if f.get('focusBlend') is not None else 1 for f in frames],label=version,color=color)
            axes[1,2].plot(p,[f['mappingMs'] for f in frames],label=version,color=color)
        for axis,title in zip(axes.flat,['Camera direction °/s','Ray error to displayed ISS °','Ray error to Earth centre °','Post-render interval ms','Explicit focus blend','Transition/mapping CPU ms']):
            axis.set(title=title,xlabel='Transition %');axis.grid(alpha=.2);axis.legend(fontsize=8)
        fig.suptitle(source+' '+kind+' / native DPR2 / first run')
        fig.savefig(root/(source+'-'+kind+'-focus.png'),dpi=120);plt.close(fig)
print(json.dumps({k:[{'source':r['source'],'cycle':r['cycle'],'kind':r['kind'],'angular':r['maxDirectionDegreesPerSecond'],'basisError':r['maximumRequestedDirectionErrorDegrees'],'fps':r['performance']['medianFPS'],'offscreen':len(r['offscreenFrames'])} for r in v['routes']] for k,v in report['runs'].items()},indent=2))
