"""Photometric browser QA estimate, not an automated screenshot assertion.
Requires Pillow and NumPy. Run in this directory. Crops retain native DPR-2 pixels.
Model/trail frames are independently isolated against the same frozen background.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).parent
rows = []
for source in ['PRIMARY_GP_TLE', 'NASA_OEM']:
    for case in ['far', 'medium', 'close']:
        prefix = f'production-{source}-{case}'
        background = np.asarray(Image.open(root / f'{prefix}-background.png').convert('RGB'), dtype=float)
        diffs = [np.max(np.abs(np.asarray(Image.open(root / f'{prefix}-{layer}.png').convert('RGB'), dtype=float) - background), axis=2) for layer in ['model', 'trail']]
        thresholds = {}
        for threshold in [4, 8, 16]:
            model, trail = [np.argwhere(d > threshold) for d in diffs]
            best = float('inf')
            for block in np.array_split(trail, max(1, len(trail) // 100)):
                if len(block):
                    best = min(best, ((block[:, None, :] - model[None, :, :]) ** 2).sum(axis=2).min())
            thresholds[str(threshold)] = float(np.sqrt(best) / 2)
        rows.append({'source': source, 'range': case, 'cssPixelsByRgbThreshold': thresholds})
print(json.dumps({'method': 'minimum isolated raster distance / DPR 2; RGB max difference thresholds', 'rows': rows}, indent=2))
