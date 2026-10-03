"""Fresh disposable frontend archive; never instruments a Git checkout.
Usage: python3 prepare-qa.py /tmp/qa-name [824f3e67|working-tree]
Dependencies/public assets are symlinked to the repository; npm build runs only
inside the disposable frontend. Start Vite/preview there on unused ports.
"""
from pathlib import Path
import io,runpy,shutil,subprocess,sys,tarfile
root=Path(__file__).resolve().parents[5]
output=Path(sys.argv[1]).resolve();ref=sys.argv[2]if len(sys.argv)>2 else 'working-tree'
if output.exists()or output==root or root in output.parents:
 raise SystemExit('Choose a new disposable directory outside the repository.')
output.mkdir(parents=True)
if ref=='working-tree':
 names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','--','frontend'],cwd=root,text=True).splitlines()
 for name in names:
  source=root/name
  if not source.is_file()or name.startswith('frontend/public/'):continue
  target=output/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
else:
 archive=subprocess.check_output(['git','archive',ref,'frontend'],cwd=root)
 with tarfile.open(fileobj=io.BytesIO(archive))as tar:
  for member in tar:
   if member.isfile()and not member.name.startswith('frontend/public/'):
    target=output/member.name
    if output not in target.resolve().parents:raise SystemExit('Unexpected archive path')
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(member).read())
for name in ['node_modules','public']:
 (output/'frontend'/name).symlink_to(root/'frontend'/name,target_is_directory=True)
runpy.run_path(str(root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/instrument-focus.py'),run_name='__main__')
p=output/'frontend/src/cesium/EarthView.tsx';s=p.read_text()
s=s.replace('import {\n','import {\n  DirectionalLight,',1)
s=s.replace('      viewer: instance,','      viewer: instance,\n      get trails() { return primaryLine.current },\n      get pendingTrails() { return pendingPrimaryLine.current },\n      get visibility() { return trajectoryTransitionVisibility },')
s=s.replace('helpers: { CustomShader','helpers: { DirectionalLight, earthOccludes, CustomShader')
needle='      updateTrajectory.current?.(JulianDate.toDate(instance.clock.currentTime).getTime());'
assert s.count(needle)==1
s=s.replace(needle,'      const trajectoryBegin = performance.now();\n'+needle+'\n      (globalThis as any).__qa.trajectoryCpu = performance.now() - trajectoryBegin;')
needle='        const next = createTrajectoryTrails(product);';assert s.count(needle)==1
s=s.replace(needle,needle+'\n        (globalThis as any).__qa.geometryBuildCount = ((globalThis as any).__qa.geometryBuildCount ?? 0) + 1;')
p.write_text(s)
print(output/'frontend')
