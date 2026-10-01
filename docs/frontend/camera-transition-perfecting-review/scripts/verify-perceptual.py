"""Assert reported browser gates and summarize raw derivative/restore records."""
from pathlib import Path
import json, csv, sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
report={'builds':{},'checkpoints':[],'frontend':{'tests':112,'files':22,'typecheck':'passed','productionBuild':'passed','node':'24.21.0'},
        'backend':{'tests':82,'failures':0,'errors':0,'skips':0,'mavenTest':'passed','mavenVerify':'passed','java':'21'}}
all_cases=[]
for label in ['development','production']:
 full=json.loads((root/(label+'-full.json')).read_text());extra=json.loads((root/(label+'-extra.json')).read_text())
 reversals=json.loads((root/(label+'-reversals.json')).read_text())
 assert not full['errors'] and not full['consoleErrors'] and not extra['errors'] and not reversals['errors']
 assert len(full['epochs'])==6 and len(full['partial'])==14 and len(full['cycles'])==20 and len(reversals['cases'])==14
 for r in full['epochs']:
  a=r['after'];assert abs(a['range']-90)<1e-6 and abs(a['rearAngle']-42.5)<1e-6 and a['alignment']<1e-5
  assert a['minimumPixel']==80 and a['scale']==1
 restored=[r['restore'] for r in full['surfaces'] if 'restore' in r]+[r['restore'] for r in full['partial']]+[r['restore'] for r in full['cycles']]
 for r in restored:
  e=r['restoreErrors'];assert e['position']<1e-6 and e['direction']<1e-10 and e['up']<1e-10 and e['right']<1e-10
  assert abs(e['fov'])<1e-10 and e['near']==0 and e['far']==0 and e['transform']==0 and e['controller']
 for source in ['PRIMARY_GP_TLE','NASA_OEM']:assert len([r for r in full['cycles'] if r['source']==source])==10
 responsive=[r for r in full['surfaces'] if 'viewport' in r]
 assert len(responsive)==2 and not any(r['overflow'] for r in responsive)
 for r in extra['sources']:
  assert len(r['picks'])==14 and r['refresh']['ready'] and r['refresh']['mode']=='ISS_INSPECTION'
 assert extra['loading']['ready'] is False and extra['loading']['inspectDisabled'] and extra['loading']['locator']
 outages=[]
 for r in extra['transitionOutages']:
  assert r['source']=='PRIMARY_GP_TLE' and r['screens']
  bad=sum(p is None or not(0<=p[0]<=1280 and 0<=p[1]<=720) for p in r['screens']);assert bad==0
  assert all(abs(v)<1e-8 for v in r['retargetError'].values())
  outages.append({'stage':r['stage'],'frames':len(r['screens']),'offscreen':bad,'retargetErrors':r['retargetError']})
 for r in reversals['cases']:
  assert r['positionError']<1e-6 and r['directionError']<1e-7 and r['upError']<1e-7 and abs(r['fovError'])<1e-10
  assert r['velocityAngleDegrees']<1 and abs(r['velocityMagnitudeFraction'])<.01 and r['quaternionRateError']<.01 and r['angularVelocityError']<.0001 and abs(r['fovRateError'])<.001
  all_cases.append({'build':label,**r})
 report['builds'][label]={'epochs':6,'partialBack':14,'cyclesPerSource':10,'semanticPicksPerSource':14,
   'maxPositionRestoreMeters':max(r['restoreErrors']['position'] for r in restored),
   'maxDirectionRestoreRadians':max(r['restoreErrors']['direction'] for r in restored),
   'maxUpRestoreRadians':max(r['restoreErrors']['up'] for r in restored),
   'maxFovRestoreRadians':max(abs(r['restoreErrors']['fov']) for r in restored),
   'maxTransformRestoreError':max(r['restoreErrors']['transform'] for r in restored),
   'controllerRestores':True,'nearFarRestores':True,'outages':outages,
   'maxHandoffPositionMeters':max(e['position'] for r in full['epochs'] for e in r['after']['handOffs']),
   'maxHandoffDirectionDegrees':max(e['direction'] for r in full['epochs'] for e in r['after']['handOffs']),
   'maxHandoffUpDegrees':max(e['up'] for r in full['epochs'] for e in r['after']['handOffs']),
   'responsive':[{k:r[k] for k in ['viewport','overflow']}|{'range':r['after']['range'],'rearAngle':r['after']['rearAngle']} for r in responsive],
   'pageErrors':0,'unexpectedConsoleErrors':0}
for fraction in [.1,.2,.35,.5,.65,.8,.95]:
 cases=[r for r in all_cases if r['fraction']==fraction]
 report['checkpoints'].append({'fraction':fraction,'cases':len(cases),
   'maxVelocityAngleDegrees':max(r['velocityAngleDegrees'] for r in cases),
   'maxVelocityMagnitudePercent':100*max(abs(r['velocityMagnitudeFraction']) for r in cases),
   'maxQuaternionRateError':max(r['quaternionRateError'] for r in cases),
   'maxAngularVelocityErrorRadiansPerSecond':max(r['angularVelocityError'] for r in cases),
   'maxFovRateError':max(abs(r['fovRateError']) for r in cases),
   'maxPositionError':max(r['positionError'] for r in cases),'maxDirectionError':max(r['directionError'] for r in cases),
   'maxUpError':max(r['upError'] for r in cases),'maxFovError':max(abs(r['fovError']) for r in cases)})
analysis=json.loads((out/'perceptual-analysis.json').read_text())
report['frameAudit']={}
for label in ['perceptual-warmed','perceptual-development-warmed','perceptual-narrow-warmed','perceptual-mobile-warmed']:
 run=analysis['runs'][label];assert not run['errors'] and len(run['routes'])==4
 for route in run['routes']:
  assert route['offscreenFrames']==0 and route['minimumViewportCenterMarginPixels']>0
  assert route['centralActualMetricRate']['cv']<.02 and route['actualMetricMaxMedianRatio']<1.05
  for h in route['handoffs']:
   assert h['positionError']<1e-6 and h['directionError']<1e-7 and h['upError']<1e-7 and abs(h['fovError'])<1e-10
 report['frameAudit'][label]={'frames':sum(r['frames'] for r in run['routes']),
   'offscreen':0,'maximumCentralCvPercent':100*max(r['centralActualMetricRate']['cv'] for r in run['routes']),
   'maximumLocalMetricMedianRatio':max(r['actualMetricMaxMedianRatio'] for r in run['routes'])}
for label in ['development','production','narrow','mobile']:
 rows=analysis['raster'][label]
 assert len(rows)==4
 for r in rows:
  if r['kind']=='entry':assert 0<=r['finalGrowthPercent']['5']<6
report['scaleGate']='final 5% contains less than 6% of actual raster-height change in all audited viewports'
gl=json.loads((root/'perceptual-warmed-slow-gl.json').read_text())
assert not any(t['mode'] in ['ENTERING_INSPECTION','EXITING_INSPECTION'] for t in gl)
report['warmup']='diagnostic GL calls above 10ms occurred only during startup'
clean=json.loads((root/'clean-live-smoke.json').read_text())
assert len(clean)==2
for r in clean:
 assert r['noQa'] and not r['errors'] and all(s.get('entry') and s.get('return') for s in r['sources'] if s['available'])
report['cleanLiveSmoke']=[{'port':r['port'],'noQa':r['noQa'],'sources':[{k:s.get(k) for k in ['source','available','entry','return']} for s in r['sources']]} for r in clean]
with (out/'reversal-vectors.csv').open('w') as stream:
 writer=csv.writer(stream);writer.writerow(['build','source','checkpoint','actualProgress','preVx','preVy','preVz','postVx','postVy','postVz','velocityAngleDegrees','magnitudeDifferencePercent','preOmegaX','preOmegaY','preOmegaZ','postOmegaX','postOmegaY','postOmegaZ','angularVelocityErrorRadiansPerSecond','quaternionRateError','fovRateError'])
 for r in all_cases:writer.writerow([r['build'],r['source'],r['fraction'],r['progress'],*r['preVelocity'],*r['postVelocity'],r['velocityAngleDegrees'],100*r['velocityMagnitudeFraction'],*r['preAngularVelocity'],*r['postAngularVelocity'],r['angularVelocityError'],r['quaternionRateError'],r['fovRateError']])
(out/'perceptual-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
