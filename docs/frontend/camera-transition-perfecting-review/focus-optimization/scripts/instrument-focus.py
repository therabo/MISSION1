"""Only disposable archives: existing QA hook plus focal and capture-cost diagnostics."""
from pathlib import Path
import runpy, sys
checkout=Path(sys.argv[1]).resolve()
root=Path(__file__).resolve().parents[5]
runpy.run_path(str(root/'docs/frontend/camera-transition-perfecting-review/scripts/instrument-qa-copy.py'),run_name='__main__')
p=checkout/'frontend/src/cesium/EarthView.tsx';s=p.read_text()
if 'const focusVelocity' in s:
 s=s.replace('fov: fovRate, lift: liftRate','focus: focusVelocity, fov: fovRate, lift: liftRate')
 s=s.replace('      get tick()', '      get focus() { return focusPoint },\n      get skyReady() { return skyGraphicsReady },\n      get warming() { return modelGraphicsWarming },\n      get tick()')
s=s.replace("      entry.current = new InspectionTransition('entry'", "      const preparationBegin = performance.now();\n      entry.current = new InspectionTransition('entry'")
s=s.replace('      entry.current.startMs = performance.now();','      (globalThis as any).__qa.prepareMs = performance.now() - preparationBegin;\n      entry.current.startMs = performance.now();')
s=s.replace("      const flight = new InspectionTransition('exit'", "      const preparationBegin = performance.now();\n      const flight = new InspectionTransition('exit'")
s=s.replace('      flight.startMs = performance.now();','      (globalThis as any).__qa.prepareMs = performance.now() - preparationBegin;\n      flight.startMs = performance.now();')
p.write_text(s)

sky=checkout/'frontend/src/cesium/skyRenderingWarmup.ts'
if sky.exists():
 code=sky.read_text()
 code=code.replace('  const rotation = new Matrix3()', "  const qa=(globalThis as any).__qa, vec=(a: Cartesian3)=>[a.x,a.y,a.z];\n  const originalMoon=scene.moon, originalSun=scene.sun;\n  const pose=()=>({position:vec(camera.positionWC),direction:vec(camera.directionWC),up:vec(camera.upWC),transform:Array.from(camera.transform),far:camera.frustum.far,inputs:scene.screenSpaceCameraController.enableInputs,loop:viewer.useDefaultRenderLoop});\n  qa.skyWarmup={startMs:performance.now(),before:pose()};\n  const rotation = new Matrix3()")
 code=code.replace('      viewer.useDefaultRenderLoop = saved.loop;', '      viewer.useDefaultRenderLoop = saved.loop;\n      qa.skyWarmup.after=pose();qa.skyWarmup.endMs=performance.now();qa.skyWarmup.moonSame=scene.moon===originalMoon;qa.skyWarmup.sunSame=scene.sun===originalSun;')
 sky.write_text(code)
