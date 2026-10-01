"""Remove only this task's raw pairs after their pixel metrics were archived."""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()
if root.parent != Path('/tmp/mission1-focus').resolve() or not root.name.startswith('raster-'):
    raise SystemExit('Not a task-owned raster directory')
for file in root.glob('*.png'):
    if file.name.endswith(('-model.png','-background.png')): file.unlink()
