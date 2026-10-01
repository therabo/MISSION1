"""Precommit acceptance audit of actual browser output and preserved quality."""
from pathlib import Path
import gzip, json, math, sys
root=Path(sys.argv[1]); report={'builds':{},'checkpoints':[],'frameAudit':{}}
def read(name):
    path=root/name
    return json.loads(path.read_text()) if path.exists() else json.loads(gzip.decompress((root/(name+'.gz')).read_bytes()))
def same_pose(a,b):
    return {'position':math.dist(a['position'],b['position']),'direction':math.dist(a['direction'],b['direction']),
            'up':math.dist(a['up'],b['up']),'fov':abs(a['fov']-b['fov']),'near':a['near']-b['near'],
            'far':a['far']-b['far'],'transform':max(abs(x-y) for x,y in zip(a['transform'],b['transform'])),
            'controller':a['controller']==b['controller']}
def assert_restore(e):
    assert e['position']<1e-6 and e['direction']<1e-9 and e['up']<1e-9 and e['fov']<1e-10,e
    assert e['near']==0 and e['far']==0 and e['transform']==0 and e['controller'],e
quality=read('quality-preservation.json');assert all(f['unchanged'] for f in quality['renderAndGeometrySources'])
assert quality['model']['sha256']=='ce23515c6bf4a77d3bac6b7c2554e3c92e137c11c8db3ee1ffc1f3ef2030a16f'
analysis=read('focus-analysis.json')
all_reversals=[]
for build in ['development','production']:
    arbitrary=read('final-'+build+'-arbitrary.json');assert not arbitrary['errors'] and not arbitrary['consoleErrors']
    assert len(arbitrary['entries'])==12 and len(arbitrary['exits'])==20
    restores=[]
    for r in arbitrary['entries']+arbitrary['exits']:
        assert r['minHeight']>1000 and r['minFocusRadius']>1
        for f in r['frames']:
            s=f['issScreen'];assert s and 0<=s[0]<=1280 and 0<=s[1]<=720,(build,r['name'],f)
            if f['focus']:
                ray=[a-b for a,b in zip(f['focus'],f['position'])]
                cross=[ray[1]*f['direction'][2]-ray[2]*f['direction'][1],ray[2]*f['direction'][0]-ray[0]*f['direction'][2],ray[0]*f['direction'][1]-ray[1]*f['direction'][0]]
                assert math.hypot(*cross)/math.hypot(*ray)<1e-8
    for r in arbitrary['exits']+arbitrary['cycles']:
        e=same_pose(r['saved'],r['after']);assert_restore(e);restores.append(e)
    for r in arbitrary['resources']:
        assert r['modelSame'] and r['globeSame'] and r['atmosphereSame'] and r['providersSame'] and r['postSame']
        assert r['primitives']==6 and r['layers']==2 and r['resolutionScale']==1 and r['canvas']==[2560,1440] and r['msaa']==4
        if r['stage']=='after':assert r['retainedTransitions']==0
    assert not arbitrary.get('linkedPrograms'),arbitrary.get('linkedPrograms')
    assert not [c for c in arbitrary.get('slowGl',[]) if c['name'] in ['linkProgram','getProgramParameter'] and c['mode'] in ['ENTERING_INSPECTION','EXITING_INSPECTION']]
    full=read(build+'-full.json');extra=read(build+'-extra.json');reversals=read(build+'-reversals.json')
    assert not full['errors'] and not full['consoleErrors'] and not extra['errors'] and not reversals['errors']
    assert len(full['epochs'])==6 and len(reversals['cases'])==14
    for row in full['epochs']:
        a=row['after'];assert abs(a['range']-90)<1e-6 and abs(a['rearAngle']-42.5)<1e-6 and a['alignment']<1e-5
        assert a['minimumPixel']==80 and a['scale']==1
    for row in full['surfaces']:
        if 'restore' in row:assert_restore(row['restore']['restoreErrors'])
        if 'viewport' in row:assert not row['overflow']
    for row in extra['sources']:assert len(row['picks'])==14 and row['refresh']['ready'] and row['refresh']['mode']=='ISS_INSPECTION'
    assert not extra['loading']['ready'] and extra['loading']['inspectDisabled'] and extra['loading']['locator']
    for row in extra['transitionOutages']:
        assert row['source']=='PRIMARY_GP_TLE' and row['retargetError']['focus']<1e-5
        assert all(s and 0<=s[0]<=1280 and 0<=s[1]<=720 for s in row['screens'])
    for row in reversals['cases']:
        assert row['focusError']<1e-5 and row['focusVelocityError']/max(1,math.hypot(*row['preFocusVelocity']))<.01
        assert row['positionError']<1e-6 and row['directionError']<1e-7 and row['upError']<1e-7 and abs(row['fovError'])<1e-10
        assert row['velocityAngleDegrees']<1 and abs(row['velocityMagnitudeFraction'])<.01 and row['angularVelocityError']<.0001
        all_reversals.append({'build':build,**row})
    cycles=read('final-'+build+'-ten-cycles-trace.json');assert len(cycles['rows'])==20 and not cycles['errors'] and cycles['retainedTransitions']==0
    assert cycles['heapAfter']['usedSize']<cycles['heapBefore']['usedSize']+10*1024*1024
    for source in ['PRIMARY_GP_TLE','NASA_OEM']:assert len([r for r in cycles['rows'] if r['source']==source])==10
    for row in cycles['rows']:
        r=row['resources'];assert r['modelSame'] and r['globeSame'] and r['atmosphereSame'] and r['providersSame'] and not r['activeTransition']
        assert r['restorePosition']<1e-6 and r['restoreDirection']<1e-9 and r['restoreUp']<1e-9 and abs(r['restoreFov'])<1e-10
    lint=read(build+'-visual-lint.json');assert not lint['errors'] and len(lint['cases'])==6
    assert not any(c['overflow'] or c['unnamedControls'] or c['imagesWithoutName'] or c['clippedControls'] for c in lint['cases'])
    resources=read(build+'-resources-arbitrary.json');assert not resources['errors'] and not resources['consoleErrors'] and not resources.get('linkedPrograms')
    startup=read(build+'-startup-race.json');assert not startup['errors'] and startup['beforeSky']['inspectDisabled'] and not startup['beforeSky']['skyReady']
    assert startup['enabled']['normalWarmFrames']>=7 and startup['enabled']['skyReady'] and not startup['enabled']['warming']
    assert not [c for c in resources.get('slowGl',[]) if c['name'] in ['linkProgram','getProgramParameter'] and c['mode'] in ['ENTERING_INSPECTION','EXITING_INSPECTION']]
    report['builds'][build]={'arbitraryEarthPosesPerSource':6,'arbitraryInspectionPosesPerSource':5,'numericalClearanceSamplesPerPath':2001,'renderedPoseSamplesPerPath':101,'minimumHeightMeters':min(r['minHeight'] for r in arbitrary['entries']+arbitrary['exits']),'maximumRestorePositionMeters':max(r['position'] for r in restores),'partialBackPerSource':7,'semanticPicksPerSource':14,'lightingEpochsPerSource':3,'realTimeCyclesPerSource':10,'acceleratedGeometryCyclesPerSource':10,'heapBefore':cycles['heapBefore'],'heapAfter':cycles['heapAfter'],'retainedTransitions':0,'unexpectedErrors':0,'resourceIdentitiesPreserved':True}
for label,run in analysis['runs'].items():
    if not label.startswith('final-'):continue
    assert not run['errors'] and run['retainedTransitions']==0
    readiness=run['metadata']['readiness'];assert readiness['skyReadyWhenEnabled'] and not readiness['warmingWhenEnabled']
    sky=run['metadata']['skyWarmup'];assert sky['moonSame'] and sky['sunSame']
    assert math.dist(sky['before']['position'],sky['after']['position'])<1e-6
    assert math.dist(sky['before']['direction'],sky['after']['direction'])<1e-12
    assert sky['before']['far']==sky['after']['far'] and sky['before']['transform']==sky['after']['transform']
    for row in run['routes']:
        assert not row['offscreenFrames'] and row['focus']['maximumRayErrorRadians']<1e-8
        assert row['maximumRequestedDirectionErrorDegrees']<1e-6 and row['mappingMs']['worst']<1
    report['frameAudit'][label]={'frames':sum(r['frames'] for r in run['routes']),'offscreen':0,'maximumRayErrorRadians':max(r['focus']['maximumRayErrorRadians'] for r in run['routes']),'maximumMappingMs':max(r['mappingMs']['worst'] for r in run['routes'])}
for p in [.1,.2,.35,.5,.65,.8,.95]:
    rows=[r for r in all_reversals if r['fraction']==p]
    report['checkpoints'].append({'fraction':p,'cases':len(rows),'maxFocusErrorMeters':max(r['focusError'] for r in rows),'maxFocusVelocityRelativeError':max(r['focusVelocityError']/max(1,math.hypot(*r['preFocusVelocity'])) for r in rows),'maxPositionErrorMeters':max(r['positionError'] for r in rows),'maxAngularVelocityErrorRadiansPerSecond':max(r['angularVelocityError'] for r in rows)})
for label in ['production','narrow','mobile']:
    data=read(label+'-projected-samples.json');assert len(data['samples'])==60 and not data['errors']
    for source in ['PRIMARY_GP_TLE','NASA_OEM']:
        rows=[r for r in data['samples'] if r['source']==source and r['kind']=='entry'];h=lambda r:r['raster']['heightCss'];change=h(rows[-1])-h(rows[0]);last5=(h(rows[-1])-h(next(r for r in rows if r['percent']==95)))/change
        assert last5<.1,(label,source,last5)
live=read('clean-live-smoke.json');assert len(live)==2 and all(r['noQa'] and not r['errors'] for r in live)
assert all(j['code']==0 for file in ['qa-run.json','qa-evidence-run.json'] for j in read(file)['jobs'])
(root/'focus-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
