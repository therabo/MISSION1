"""Measure the visible raster limb. UI/viewport clipping is excluded from fitting.
This circle fit is a finite-precision composition check, not a geodetic claim.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'evidence'
rows = []
for path in sorted([*root.glob('*overview.png'), *root.glob('*altered-dashboard-width.png')]):
    if 'after-' in path.name and not ('development-' in path.name or 'production-' in path.name):
        continue
    im = np.asarray(Image.open(path).convert('RGB'), dtype=float)
    height, width = im.shape[:2]
    left = (460 if "altered-dashboard-width" in path.name else 380) if width > 720 else 0
    candidate = (width + left) / 2 if path.name.startswith('after-') else width / 2
    cy = height / 2
    radius = max(width, height) / (2 * math.tan(math.pi / 6)) * 6378 / math.sqrt(23370**2 - 6378**2)
    points = []
    for angle in np.linspace(0, 2*math.pi, 720, endpoint=False):
        # A radial scan around the expected limb; don't include any panel.
        radii = np.arange(radius*0.93, radius*1.07, .5)
        x = candidate + radii * math.cos(angle)
        y = cy + radii * math.sin(angle)
        if np.any(x < (left+3 if width > 720 else 3)) or np.any(x >= width-3) or np.any(y < 130) or np.any(y >= (height-180 if width <= 720 else height-100)):
            continue
        pixels = im[np.round(y).astype(int), np.round(x).astype(int)]
        gradients = np.linalg.norm(np.diff(pixels, axis=0), axis=1)
        index = int(np.argmax(gradients))
        if gradients[index] > 15:
            points.append([float(x[index]), float(y[index])])
    points = np.array(points)
    for _ in range(4):
        coefficients = np.linalg.lstsq(np.column_stack([2*points[:,0], 2*points[:,1], np.ones(len(points))]), (points**2).sum(axis=1), rcond=None)[0]
        center = coefficients[:2]
        fitted_radius = math.sqrt(coefficients[2] + (center**2).sum())
        residual = np.linalg.norm(points-center, axis=1)-fitted_radius
        points = points[np.abs(residual) < 2]
    expected = (width+left)/2 if path.name.startswith('after-') else width/2
    row = dict(file=path.name, width=width, height=height, expected=expected, observed=float(center[0]), difference=float(center[0]-expected), radius=fitted_radius, samples=len(points), method='radial limb gradients + circle least squares, residual trimmed to 2 CSS pixels')
    rows.append(row)
    print(json.dumps(row))
(root/'raster-measurements.json').write_text(json.dumps(rows, indent=2)+'\n')
