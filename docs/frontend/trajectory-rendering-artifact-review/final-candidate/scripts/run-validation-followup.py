"""Native controls, origin and repeated stress after regressions/profiling."""
from pathlib import Path
import os,subprocess,json
root=Path(__file__).resolve().parents[5];base=root/'docs/frontend/trajectory-rendering-artifact-review/final-candidate'
env=os.environ.copy();env.update(MISSION1_REPO_ROOT=str(root),MISSION1_PLAYWRIGHT_MODULE='/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
node='/opt/homebrew/opt/node@24/bin/node'
for port,label in [(5190,'validated-dev-origin'),(4190,'validated-prod-origin')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'validated-origin')
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/browser-stress.cjs'),str(port),label,'origin'],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
for port,label in [(5190,'accepted-dev-raster'),(4190,'accepted-prod-raster')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'raster')
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/raster-final.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
for port,label in [(5190,'extra-dev'),(4190,'extra-prod')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'extra-raster')
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/raster-extra.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
 # Project the same genuine near-plane-clipped segments for raster analysis.
 with open('/tmp/mission1-'+label+'-clips.log','w') as log:
  subprocess.run([node,str(base/'scripts/refresh-raster-clips.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
for port,label in [(5190,'inactive-dev'),(4190,'inactive-prod')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'inactive-raster')
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/raster-inactive.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
for port,label in [(5190,'dev-boundary'),(4190,'prod-boundary')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'rectangle-boundaries')
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/raster-rectangle-boundaries.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
python='/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
for folder in ['raster','extra-raster','inactive-raster','rectangle-boundaries']:
 with open('/tmp/mission1-spatial-'+folder+'-analysis.log','w') as log:
  subprocess.run([python,str(base/'scripts/analyze-raster.py'),str(base/folder)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(folder,'native coverage analysis complete',flush=True)
for port,label in [(5190,'gpu-origin-dev'),(4190,'gpu-origin-prod')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']='/tmp/mission1-spatial-final-gpu-origin'
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/gpu-origin.cjs'),str(port),label],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
# The repeated near-camera-plane path exposed the rejected temporal mask handoff.
for port,label in [(5190,'memory-gpu-dev'),(4190,'memory-gpu-prod')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']='/tmp/mission1-spatial-final-memory-native'
 with open('/tmp/mission1-'+label+'-spatial.log','w') as log:
  subprocess.run([node,str(base/'scripts/gpu-origin.cjs'),str(port),label,'memory'],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
# Recheck the repeated extreme path after correcting the diagnostic camera-plane
# and initial-region predicates, including the native finite-projection guard.
for port,label,mode,folder in [(4190,'validated-memory','memory','validated-memory')]:
 runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/folder)
 with open('/tmp/mission1-'+label+'.log','w') as log:
  subprocess.run([node,str(base/'scripts/browser-stress.cjs'),str(port),label,mode],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(label,'PASS',flush=True)
runEnv=env.copy();runEnv['MISSION1_EVIDENCE_DIR']=str(base/'native')
with open('/tmp/mission1-final-native-smoke.log','w') as log:
 subprocess.run([node,str(root/'docs/frontend/camera-transition-perfecting-review/scripts/clean-live-smoke.cjs')],env=runEnv,stdout=log,stderr=subprocess.STDOUT,check=True)
print('native live-backend smoke PASS',flush=True)
for raw,folder in [('/tmp/mission1-spatial-final-gpu-origin','gpu-origin'),('/tmp/mission1-spatial-final-memory-native','gpu-memory')]:
 with open('/tmp/mission1-spatial-'+folder+'-analysis.log','w') as log:
  subprocess.run([python,str(base/'scripts/analyze-gpu-origin.py'),raw,str(base/folder)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 print(folder,'native continuity analysis complete',flush=True)
