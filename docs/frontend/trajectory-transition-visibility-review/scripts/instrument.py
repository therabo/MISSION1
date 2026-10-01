"""Diagnostics only in disposable archives; production has no QA globals."""
from pathlib import Path
import runpy, sys
root = Path(__file__).resolve().parents[4]
runpy.run_path(str(root/'docs/frontend/camera-transition-perfecting-review/focus-optimization/scripts/instrument-focus.py'), run_name='__main__')
p=Path(sys.argv[1])/'frontend/src/cesium/EarthView.tsx'
s=p.read_text().replace('      get model()', '      get trails() { return primaryLine.current },\n      get pendingTrails() { return pendingPrimaryLine.current },\n      get visibility() { return typeof trajectoryTransitionVisibility === "undefined" ? null : trajectoryTransitionVisibility },\n      get model()')
# Baseline has no visibility scalar. Avoid introducing an unresolved TS identifier.
if 'let trajectoryTransitionVisibility' not in s:
 s=s.replace('typeof trajectoryTransitionVisibility === "undefined" ? null : trajectoryTransitionVisibility', 'null')
s=s.replace("      updateTrajectory.current?.(sceneMs);", "      const trajectoryBegin = performance.now();\n      updateTrajectory.current?.(sceneMs);\n      (globalThis as any).__qa.trajectoryCpu = performance.now() - trajectoryBegin;")
p.write_text(s)
