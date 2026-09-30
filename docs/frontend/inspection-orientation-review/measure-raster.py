"""Reproduce visible raster bounds from the retained fixed-UTC PNG pairs.

Requires Pillow and NumPy. Screenshots use DPR 2; the model/background
capture differs only in model visibility and is restricted to the recorded
conservative model bounds to exclude unrelated scene pixels.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
DPR = 2
THRESHOLD = 20


def measure(label):
    model = np.asarray(Image.open(ROOT / f'{label}-fixed-model.png').convert('RGB')).astype(int)
    background = np.asarray(Image.open(ROOT / f'{label}-fixed-background.png').convert('RGB')).astype(int)
    difference = np.max(np.abs(model - background), axis=2)
    pose = json.loads((ROOT / f'{label}-fixed-pose.json').read_text())
    hull = pose['hull']
    x0 = max(0, int(min(p['x'] for p in hull) * DPR))
    x1 = min(model.shape[1], int(max(p['x'] for p in hull) * DPR) + 1)
    y0 = max(0, int(min(p['y'] for p in hull) * DPR))
    y1 = min(model.shape[0], int(max(p['y'] for p in hull) * DPR) + 1)
    mask = np.zeros(difference.shape, dtype=bool)
    mask[y0:y1, x0:x1] = difference[y0:y1, x0:x1] > THRESHOLD
    y, x = np.where(mask)
    return {
        'range': pose['range'],
        'utc': pose['utc'],
        'physicalPosition': pose['physicalPosition'],
        'visibleBoundsPixels': [int(x.min()), int(y.min()), int(x.max()), int(y.max())],
        'visibleWidthCss': (int(x.max()) - int(x.min()) + 1) / DPR,
        'visibleHeightCss': (int(y.max()) - int(y.min()) + 1) / DPR,
        'changedPixels': len(x),
    }


if __name__ == '__main__':
    output = json.dumps({label: measure(label) for label in ['baseline', 'production']}, indent=2)
    print(output)
    (ROOT / 'raster-footprint.json').write_text(output)
