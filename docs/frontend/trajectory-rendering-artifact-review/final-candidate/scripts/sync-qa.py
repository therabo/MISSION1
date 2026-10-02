"""Update a disposable candidate copy and add diagnostics; never ship QA hooks."""
from pathlib import Path
import runpy, shutil, sys

root = Path(__file__).resolve().parents[5]
copy = Path(sys.argv[1]).resolve()
if (copy / '.git').exists() or copy == root:
    raise SystemExit('A disposable external copy is required.')
for name in ('EarthView.tsx', 'trajectoryClearance.ts', 'trajectoryRendering.ts',
             'trajectoryAppearance.ts', 'trajectoryClearance.test.ts', 'trajectoryRendering.test.ts', 'displayIsolation.test.ts', 'skyRenderingWarmup.ts', 'inspectionRenderingWarmup.ts'):
    shutil.copyfile(root / 'frontend/src/cesium' / name, copy / 'frontend/src/cesium' / name)
runpy.run_path(str(root / 'docs/frontend/trajectory-transition-visibility-review/scripts/instrument.py'), run_name='__main__')
p = copy / 'frontend/src/cesium/EarthView.tsx'
s = p.read_text()
needle = '      updateTrajectory.current?.(JulianDate.toDate(instance.clock.currentTime).getTime());'
assert needle in s
s = s.replace(needle, '      const trajectoryBegin = performance.now();\n' + needle + '\n      (globalThis as any).__qa.trajectoryCpu = performance.now() - trajectoryBegin;')
s = s.replace('        const next = createTrajectoryTrails(product);', '        const next = createTrajectoryTrails(product);\n        (globalThis as any).__qa.geometryBuildCount = ((globalThis as any).__qa.geometryBuildCount ?? 0) + 1;')
s = s.replace('helpers: { CustomShader', 'helpers: { earthOccludes, CustomShader')
p.write_text(s)
