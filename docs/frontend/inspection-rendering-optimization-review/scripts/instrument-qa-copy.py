"""Add a public, temporary QA hook to a Git archive, never to a managed checkout."""
from pathlib import Path
import sys

checkout = Path(sys.argv[1]).resolve()
if (checkout / '.git').exists():
    raise SystemExit('Instrument a disposable Git archive, not a Git checkout.')
path = checkout / 'frontend/src/cesium/EarthView.tsx'
source = path.read_text()
if '__qa' in source:
    raise SystemExit('This copy is already instrumented.')
for symbol in ('CustomShader', 'LightingModel'):
    if f'  {symbol},' not in source:
        source = source.replace('import {\n', f'import {{\n  {symbol},', 1)
hook = """
    (globalThis as any).__qa = {
      viewer: instance,
      get model() { return model.current },
      get mode() { return viewMode.current },
      get source() { return selectedSourceRef.current },
      positionAt, velocityAt,
      helpers: { CustomShader, LightingModel, Cartesian3, Cartesian2, JulianDate,
        Matrix4, Ellipsoid, SceneTransforms, Color, CesiumMath, projectedModelFootprint }
    };
"""
assert source.count('viewer.current = instance;') == 1
path.write_text(source.replace('viewer.current = instance;', 'viewer.current = instance;' + hook))
print(path)
