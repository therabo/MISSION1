"""Add a public, temporary QA hook to a Git archive, never to a managed checkout."""
from pathlib import Path
import sys, re

checkout = Path(sys.argv[1]).resolve()
if (checkout / '.git').exists():
    raise SystemExit('Instrument a disposable Git archive, not a Git checkout.')
path = checkout / 'frontend/src/cesium/EarthView.tsx'
source = path.read_text()
if '__qa' in source:
    raise SystemExit('This copy is already instrumented.')
for symbol in ('CustomShader', 'LightingModel', 'Matrix3', 'Quaternion'):
    if f'  {symbol},' not in source:
        source = source.replace('import {\n', f'import {{\n  {symbol},', 1)
hook = """
    (globalThis as any).__qa = {
      viewer: instance,
      get model() { return model.current },
      get mode() { return viewMode.current },
      get source() { return selectedSourceRef.current },
      get flight() { return entry.current },
      get frame() { return trackingFrame },
      get saved() { return cameraSnapshot.current },
      progress: 0, appliedMs: 0,
      get derivatives() { return { velocity: cameraVelocity, quaternion: quaternionRate, orientation: currentQuaternion, fov: fovRate, lift: liftRate } },
      get tick() { return tick },
      back: () => exitInspection.current?.(),
      positionAt, velocityAt,
      helpers: { CustomShader, LightingModel, Cartesian3, Cartesian2, JulianDate,
        Matrix4, Matrix3, Quaternion, Ellipsoid, SceneTransforms, Color, CesiumMath, projectedModelFootprint, TrajectoryVisualFrame }
    };
"""
if 'const cameraVelocity' not in source:
    hook = hook.replace('      get derivatives() { return { velocity: cameraVelocity, quaternion: quaternionRate, orientation: currentQuaternion, fov: fovRate, lift: liftRate } },\n', '')
assert source.count('viewer.current = instance;') == 1
source = source.replace('viewer.current = instance;', 'viewer.current = instance;' + hook)
needle = 'const pose = flight.evaluate('
assert source.count(needle) == 1
source = source.replace('const progress = flight ?', 'const progress = (globalThis as any).__qa.override ?? (flight ?').replace(' / (flight.duration * 1000))) : null;', ' / (flight.duration * 1000))) : null);')
source = re.sub(r'(const pose = flight.evaluate\([^\n]+\);)', r'\1\n        (globalThis as any).__qa.appliedMs = performance.now();\n        (globalThis as any).__qa.progress = progress;', source)
path.write_text(source)
print(path)
