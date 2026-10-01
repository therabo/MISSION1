"""Separate render cadence, actual camera progression and fixed-pose raster QA.

Trace capture uses recorded real backend products in disposable instrumented
frontends. No values here are operational ISS telemetry or physical accuracy.
"""
from pathlib import Path
import csv, json, math, statistics, sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(sys.argv[1])
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)

def angle(a, b):
    a, b = np.array(a), np.array(b)
    return math.atan2(np.linalg.norm(np.cross(a, b)), np.dot(a, b))

def stats(values):
    if not len(values): return None
    a = np.array(values)
    return dict(mean=float(np.mean(a)), median=float(np.median(a)),
                standardDeviation=float(np.std(a)), cv=float(np.std(a)/abs(np.mean(a))) if np.mean(a) else 0,
                minimum=float(np.min(a)), maximum=float(np.max(a)))

def active(frames, kind):
    mode = 'ENTERING_INSPECTION' if kind == 'entry' else 'EXITING_INSPECTION'
    indices = [i for i, f in enumerate(frames) if f['mode'] == mode]
    if not indices: raise ValueError('Missing transition frames')
    last = indices[-1]
    if last + 1 < len(frames): indices.append(last + 1)
    return [frames[i] for i in indices]

report = {'method': 'Actual lens+route metric at pose time; FPS at postRender time; raster at fixed progress.', 'runs': {}, 'raster': {}}
datasets = {}
for label in ['baseline-matched', 'perceptual-final', 'perceptual-development', 'perceptual-narrow', 'perceptual-mobile',
              'baseline-mobile-matched', 'perceptual-mobile-repeat', 'perceptual-repeat',
              'perceptual-final-ui', 'perceptual-development-ui', 'perceptual-warmed',
              'perceptual-development-warmed', 'perceptual-mobile-warmed', 'perceptual-narrow-warmed']:
    file = root/(label+'-trace.json')
    if not file.exists(): continue
    data = json.loads(file.read_text()); datasets[label] = data
    run = {'viewport': data['viewport'], 'errors': data['errors'], 'renderer': data['metadata']['renderer'], 'routes': []}
    for row in data['rows']:
        for kind in ['entry', 'exit']:
            frames = active(row[kind]['frames'], kind)
            meta = row['path' if kind == 'entry' else 'exitPath']
            first, last = frames[0], frames[-1]
            dt = np.diff([f['wall'] for f in frames])/1000
            pose_dt = np.diff([f['appliedMs'] for f in frames])/1000
            if np.any(pose_dt <= 0): raise ValueError('Repeated pose sample in '+label)
            lens = np.array([f['displayRange']*math.tan(f['fov']/2) for f in frames])
            start_lens = meta.get('startLens') or lens[0]
            end_lens = meta.get('endLens') or lens[-1]
            start_offset = meta.get('startOffset')
            end_offset = meta.get('endOffset')
            if isinstance(start_offset, dict): start_offset = [start_offset[k] for k in ['x','y','z']]
            if isinstance(end_offset, dict): end_offset = [end_offset[k] for k in ['x','y','z']]
            start_offset = start_offset or first['localOffset']
            end_offset = end_offset or last['localOffset']
            denominator = angle(start_offset, end_offset)
            log_part = np.log(lens/start_lens)/math.log(end_lens/start_lens)
            scale_part = (1/lens-1/start_lens)/(1/end_lens-1/start_lens)
            direction_part = np.array([angle(start_offset,f['localOffset'])/denominator for f in frames]) if denominator > 1e-6 else .25*log_part+.75*scale_part
            metric = .2*log_part+.6*scale_part+.2*direction_part
            rate = np.diff(metric)/pose_dt
            progress = np.array([f['progress'] for f in frames])
            central = (progress[:-1] >= .1) & (progress[1:] <= .9)
            programmed = np.array([f.get('perceptualProgress') if f.get('perceptualProgress') is not None else np.nan for f in frames])
            if kind == 'entry': programmed[-1] = 1
            else: programmed[-1] = 1
            intended_rate = np.diff(programmed)/pose_dt
            world_velocity = np.diff([f['position'] for f in frames],axis=0)/pose_dt[:,None]
            relative_velocity = np.diff([f['localOffset'] for f in frames],axis=0)/pose_dt[:,None]
            direction_step = np.degrees([angle(a['direction'],b['direction']) for a,b in zip(frames,frames[1:])])
            up_step = np.degrees([angle(a['up'],b['up']) for a,b in zip(frames,frames[1:])])
            rotation_step = np.degrees([math.acos(max(-1,min(1,(sum(np.dot(a[k],b[k]) for k in ['direction','up','right'])-1)/2))) for a,b in zip(frames,frames[1:])])
            screen = [f['displayScreen'] for f in frames]
            offscreen = [i for i,p in enumerate(screen) if not p or not(0 <= p[0] <= data['viewport'][0] and 0 <= p[1] <= data['viewport'][1])]
            center_rate = [math.dist(a,b)/d for a,b,d in zip(screen,screen[1:],pose_dt) if a and b]
            margins = [min(p[0], p[1], data['viewport'][0]-p[0], data['viewport'][1]-p[1]) for p in screen if p]
            acceleration = np.diff(world_velocity,axis=0)/((pose_dt[:-1]+pose_dt[1:])/2)[:,None]
            widths, heights = [], []
            for f in frames:
                hull=f['footprint']
                widths.append(max(p['x'] for p in hull)-min(p['x'] for p in hull) if hull else 0)
                heights.append(max(p['y'] for p in hull)-min(p['y'] for p in hull) if hull else 0)
            milliseconds = dt*1000
            tasks = [t for t in data['metadata']['longTasks'] if t['start'] < last['wall'] and t['start']+t['duration'] > first['wall']]
            route = {'source':row['source'],'kind':kind,'frames':len(frames),'durationSeconds':meta['duration'],
                     'pathLengthMeters':meta.get('pathLength'),'offscreenFrames':len(offscreen),'offscreenIndices':offscreen,
                     'actualMetricRate':stats(rate),'centralActualMetricRate':stats(rate[central]),
                     'centralProgrammedMetricRate':stats(intended_rate[central]) if np.any(np.isfinite(intended_rate[central])) else None,
                     'actualMetricMaxMedianRatio':float(max(rate)/statistics.median(rate)),
                     'mappingCostMs':stats([f.get('mappingMs',0) for f in frames[1:]]),
                     'worldSpeedMetersPerSecond':stats(np.linalg.norm(world_velocity,axis=1)),
                     'relativeSpeedMetersPerSecond':stats(np.linalg.norm(relative_velocity,axis=1)),
                     'worldAccelerationMetersPerSecondSquared':stats(np.linalg.norm(acceleration,axis=1)),
                     'logRangeRatePerSecond':stats(np.diff(np.log([f['displayRange'] for f in frames]))/pose_dt),
                     'hullWidthRatePixelsPerSecond':stats(np.diff(widths)/pose_dt),
                     'hullHeightRatePixelsPerSecond':stats(np.diff(heights)/pose_dt),
                     'minimumViewportCenterMarginPixels':min(margins) if margins else None,
                     'maxDirectionDegreesPerSecond':float(max(direction_step/pose_dt)),
                     'maxRotationDegreesPerSecond':float(max(rotation_step/pose_dt)),
                     'maxDirectionStepDegrees':float(max(direction_step)),'maxUpStepDegrees':float(max(up_step)),
                     'maxCenterPixelsPerSecond':max(center_rate) if center_rate else None,
                     'maxFovDegreesPerSecond':float(max(abs(np.degrees(np.diff([f['fov'] for f in frames]))/pose_dt))),
                     'finalPairHeightChangePixels':heights[-1]-heights[-2],
                     'handoffs':row[kind]['handoffs'],
                     'performance':{'fps':1000/float(np.median(milliseconds)),'p50':float(np.percentile(milliseconds,50)),
                        'p95':float(np.percentile(milliseconds,95)),'p99':float(np.percentile(milliseconds,99)),
                        'worst':float(max(milliseconds)),'over33_3':int(sum(milliseconds>33.3)),
                        'over50':int(sum(milliseconds>50)),'longTasks':len(tasks)}}
            if kind == 'exit':
                saved=row[kind]['saved']; xyz=lambda obj:[obj[k] for k in ['x','y','z']]
                route['restore']={'positionMeters':math.dist(last['position'],xyz(saved['position'])),
                    'directionRadians':angle(last['direction'],xyz(saved['direction'])),
                    'upRadians':angle(last['up'],xyz(saved['up'])),'fovRadians':last['fov']-saved['fov']}
            run['routes'].append(route)
            filename=out/f'{label}-{row["source"]}-{kind}.csv'
            with filename.open('w') as stream:
                writer=csv.writer(stream)
                writer.writerow(['frame','wallMs','appliedMs','dtRenderMs','dtPoseMs','progress','pathParameter','perceptualProgress','utc',
                  'cameraX','cameraY','cameraZ','physicalX','physicalY','physicalZ','displayX','displayY','displayZ',
                  'directionX','directionY','directionZ','upX','upY','upZ','displayRangeM','physicalRangeM','fovRad',
                  'screenX','screenY','hullWidthCss','hullHeightCss','hullBoundingAreaCss','occupancyWidth','occupancyHeight',
                  'liftM','silhouetteSize','silhouetteAlpha','actualMetric','actualMetricRate','directionRateDegSec','referenceTransform'])
                for i,f in enumerate(frames):
                    writer.writerow([f['frameIndex'],f['wall'],f['appliedMs'],dt[i-1]*1000 if i else '',pose_dt[i-1]*1000 if i else '',
                      f['progress'],f['pathParameter'],f['perceptualProgress'],f['utc'],*f['position'],*f['physical'],*f['display'],
                      *f['direction'],*f['up'],f['displayRange'],f['range'],f['fov'],*(f['displayScreen'] or ['','']),
                      widths[i],heights[i],widths[i]*heights[i],widths[i]/data['viewport'][0],heights[i]/data['viewport'][1],
                      f['lift'],f['silhouette'],f['silhouetteAlpha'],metric[i],rate[i-1] if i else '',direction_step[i-1]/pose_dt[i-1] if i else '',json.dumps(f['transform'])])
    report['runs'][label]=run

for label in ['baseline','strict','development','production','narrow','mobile']:
    file=out/(label+'-projected-samples.json')
    if not file.exists(): continue
    data=json.loads(file.read_text()); report['raster'][label]=[]
    for source in ['PRIMARY_GP_TLE','NASA_OEM']:
        for kind in ['entry','exit']:
            rows=[r for r in data['samples'] if r['source']==source and r['kind']==kind]
            height=lambda r:r['raster']['heightCss']
            change=height(rows[-1])-height(rows[0])
            duration = (5 if label in ['baseline', 'strict'] else 6) if kind == 'entry' else 5
            raster_height_rate = [(height(b)-height(a))/((b['percent']-a['percent'])*duration/100) for a,b in zip(rows,rows[1:])]
            raster_width_rate = [(b['raster']['widthCss']-a['raster']['widthCss'])/((b['percent']-a['percent'])*duration/100) for a,b in zip(rows,rows[1:])]
            report['raster'][label].append({'source':source,'kind':kind,'heightChangeCss':change,
                'sampledHeightRatePixelsPerSecond':stats(raster_height_rate),
                'sampledWidthRatePixelsPerSecond':stats(raster_width_rate),
                'finalGrowthPercent':{str(p):100*(height(rows[-1])-height(next(r for r in rows if r['percent']==100-p)))/change for p in [20,10,5]} if change else None,
                'sizes':[{k:r[k] for k in ['percent','displayRange','range','fov','raster']} for r in rows]})

for source in ['PRIMARY_GP_TLE','NASA_OEM']:
    for kind in ['entry','exit']:
        fig,axes=plt.subplots(2,3,figsize=(14,8),constrained_layout=True)
        final_label='perceptual-warmed' if 'perceptual-warmed' in datasets else 'perceptual-final-ui' if 'perceptual-final-ui' in datasets else 'perceptual-final'
        for label,color in [('baseline-matched','#929292'),(final_label,'#1687ba')]:
            if label not in datasets: continue
            data=datasets[label]; row=next(r for r in data['rows'] if r['source']==source); frames=active(row[kind]['frames'],kind)
            t=np.array([f['progress'] for f in frames])*100
            axes[0,2].plot(t,[math.log10(f['displayRange']) for f in frames],label=label,color=color)
            axes[1,0].plot(t,np.degrees([f['fov'] for f in frames]),label=label,color=color)
            dt=np.diff([f['appliedMs'] for f in frames])/1000
            axes[1,2].plot(t[1:],np.degrees([angle(a['direction'],b['direction']) for a,b in zip(frames,frames[1:])])/dt,label=label,color=color)
            csv_data=np.genfromtxt(out/f'{label}-{source}-{kind}.csv',delimiter=',',names=True,usecols=['progress','actualMetricRate'])
            axes[1,1].plot(csv_data['progress']*100,csv_data['actualMetricRate'],label=label,color=color)
        for label,color in [('baseline','#929292'),('strict','#cc534b'),('production','#1687ba')]:
            if label not in report['raster']: continue
            rows=next(r['sizes'] for r in report['raster'][label] if r['source']==source and r['kind']==kind)
            for axis,key in [(axes[0,0],'heightCss'),(axes[0,1],'widthCss')]: axis.plot([r['percent'] for r in rows],[r['raster'][key] for r in rows],'-o',label=label,color=color,markersize=3)
        for axis,title,ylabel in zip(axes.flat,['Actual model raster height','Actual model raster width','Displayed-target range','Perspective lens','Observed hybrid metric rate','Camera direction rate'],['CSS px','CSS px','log10 metres','degrees','normalized units / s','degrees / s']):
            axis.set(title=title,xlabel='Transition duration %',ylabel=ylabel);axis.grid(alpha=.25);axis.legend(fontsize=8)
        fig.suptitle(f'{source} {kind}: render cadence is reported separately')
        fig.savefig(out/f'{source}-{kind}-progression.png',dpi=145);plt.close(fig)

(out/'perceptual-analysis.json').write_text(json.dumps(report,indent=2,allow_nan=False))
print(json.dumps({k:[{'source':r['source'],'kind':r['kind'],'frames':r['frames'],'offscreen':r['offscreenFrames'],
 'centralCV':r['centralActualMetricRate']['cv'],'maxAngular':r['maxDirectionDegreesPerSecond'],'fps':r['performance']['fps']} for r in v['routes']] for k,v in report['runs'].items()},indent=2))
