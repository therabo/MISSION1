"""Serial regression matrix. Run only when stress/profiling browsers have exited."""
from pathlib import Path
import os,subprocess,json
root=Path(__file__).resolve().parents[5];base=root/'docs/frontend/trajectory-rendering-artifact-review/final-candidate'
env=os.environ.copy();env.update(MISSION1_REPO_ROOT=str(root),MISSION1_PLAYWRIGHT_MODULE='/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
node='/opt/homebrew/opt/node@24/bin/node';jobs=[]
for port,label in [(5190,'development'),(4190,'production')]:
 jobs.append((root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/browser-matrix.cjs',port,label+'-matrix',{},'regressions'))
 for width,height,size in [(1280,720,'desktop'),(900,700,'narrow'),(390,844,'mobile')]:
  options={'MISSION1_QA_WIDTH':str(width),'MISSION1_QA_HEIGHT':str(height)}
  jobs.append((root/'docs/frontend/trajectory-rendering-artifact-review/scripts/browser-regressions-responsive.cjs',port,label+'-'+size,options,'regressions'))
  jobs.append((base/'scripts/clearance-audit-final.cjs',port,label+'-clearance-'+size,{**options,**({'MISSION1_QA_CANONICAL_ONLY':'1'} if size!='desktop' else {})},'clearance'))
 jobs.append((base/'scripts/clearance-audit-final.cjs',port,label+'-partial',{'MISSION1_QA_PARTIAL_ONLY':'1'},'clearance'))
 jobs.append((root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/visual-lint.cjs',port,label+'-lint',{},'regressions'))
# Matching baseline origin and native raster captures with the current QA definitions.
jobs.extend([(base/'scripts/browser-stress.cjs',5188,'accepted-baseline-dev-origin',{'QA_EXTRA_MODE':'origin'},'baseline'),(base/'scripts/browser-stress.cjs',4188,'accepted-baseline-prod-origin',{'QA_EXTRA_MODE':'origin'},'baseline'),(base/'scripts/raster-final.cjs',4188,'accepted-baseline-raster',{},'raster')])
ledger=base/'regression-run.json'
report=json.loads(ledger.read_text()) if ledger.exists() else []
passed={r['label'] for r in report if r['exitCode']==0}
report=[r for r in report if r['exitCode']==0]
for script,port,label,options,folder in jobs:
 if label in passed:continue
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/folder);runEnv.update({k:v for k,v in options.items() if k!='QA_EXTRA_MODE'})
 args=[node,str(script),str(port),label]+([options['QA_EXTRA_MODE']] if 'QA_EXTRA_MODE' in options else [])
 with open('/tmp/mission1-'+label+'.log','w') as log:
  result=subprocess.run(args,cwd=root,env=runEnv,stdout=log,stderr=subprocess.STDOUT)
 report.append(dict(label=label,port=port,command=args,environment=options,exitCode=result.returncode))
 (base/'regression-run.json').write_text(json.dumps(report,indent=2))
 print(label,'PASS' if result.returncode==0 else 'FAIL',flush=True)
 if result.returncode:raise SystemExit(result.returncode)
runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'native')
with open('/tmp/mission1-final-native-smoke.log','w') as log:
 subprocess.run([node,str(root/'docs/frontend/camera-transition-perfecting-review/scripts/clean-live-smoke.cjs')],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
print('native live-backend smoke PASS',flush=True)
