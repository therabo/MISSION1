"""Serial final workflow regressions; dedicated output, no older evidence touched."""
from pathlib import Path
import os,subprocess,json
root=Path(os.environ.get('MISSION1_REPO_ROOT',Path(__file__).resolve().parents[5])).resolve()
base=root/'docs/frontend/trajectory-rendering-artifact-review/final-candidate'
out=Path(os.environ.get('MISSION1_EVIDENCE_DIR',Path(__file__).resolve().parent.parent/'runs/workflows'))
out.mkdir(parents=True,exist_ok=True)
env=os.environ.copy();env['MISSION1_REPO_ROOT']=str(root)
node=os.environ.get('MISSION1_NODE_BIN','node');jobs=[]
for port,label in [(int(os.environ.get('MISSION1_QA_DEV_PORT','5191')),'development'),(int(os.environ.get('MISSION1_QA_PROD_PORT','4174')),'production')]:
 jobs.append((root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/browser-matrix.cjs',port,label+'-matrix',{},'workflow'))
 for width,height,size in [(1280,720,'desktop'),(900,700,'narrow'),(390,844,'mobile')]:
  options={'MISSION1_QA_WIDTH':str(width),'MISSION1_QA_HEIGHT':str(height)}
  jobs.append((root/'docs/frontend/trajectory-rendering-artifact-review/scripts/browser-regressions-responsive.cjs',port,label+'-'+size,options,'workflow'))
  jobs.append((base/'scripts/clearance-audit-final.cjs',port,label+'-clearance-'+size,{**options,**({'MISSION1_QA_CANONICAL_ONLY':'1'} if size!='desktop' else {})},'clearance'))
 jobs.append((base/'scripts/clearance-audit-final.cjs',port,label+'-partial',{'MISSION1_QA_PARTIAL_ONLY':'1'},'clearance'))
 jobs.append((root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/visual-lint.cjs',port,label+'-lint',{},'workflow'))
ledger=out/'ledger.json';report=json.loads(ledger.read_text())if ledger.exists()else[]
passed={r['label']for r in report if r['exitCode']==0};report=[r for r in report if r['exitCode']==0]
for script,port,label,options,folder in jobs:
 if label in passed:continue
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(out/folder);runEnv.update(options)
 args=[node,str(script),str(port),label]
 with open(out/(label+'.log'),'w')as log:result=subprocess.run(args,cwd=root,env=runEnv,stdout=log,stderr=subprocess.STDOUT)
 report.append(dict(label=label,port=port,command=args,environment=options,exitCode=result.returncode));ledger.write_text(json.dumps(report,indent=2))
 print(label,'PASS'if result.returncode==0 else'FAIL',flush=True)
 if result.returncode:raise SystemExit(result.returncode)
