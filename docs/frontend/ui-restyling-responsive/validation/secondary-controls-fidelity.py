"""Compare desktop control geometry/ink while reporting translucent scene variance.

Usage: python secondary-controls-fidelity.py BEFORE_DIRECTORY AFTER_DIRECTORY OUTPUT
Requires Pillow. Matrix captures/JSON come from responsive-matrix.cjs.
"""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

before, after, output = map(Path, sys.argv[1:])
old = json.loads((before / 'matrix.json').read_text())
new = json.loads((after / 'matrix.json').read_text())
results = []
for state in old['states']:
    updated = next(s for s in new['states'] if s['state'] == state['state'])
    for entry in state['entries']:
        if entry['width'] < 1244:
            continue
        current = next(e for e in updated['entries'] if e['width'] == entry['width'])
        controls = [(c['name'], c) for c in entry['controls']
                    if c['name'] in ('Zoom out', 'Zoom in', 'Reset view') or c['name'].startswith('Close ')]
        controls += [(name, entry['areas'][name]) for name in ('.trajectory-legend', '#historical-calendar') if name in entry['areas']]
        original_image = Image.open(before / entry['screenshot']).convert('RGB')
        updated_image = Image.open(after / current['screenshot']).convert('RGB')
        for name, bounds in controls:
            current_bounds = current['areas'].get(name) if name.startswith(('.', '#')) else next(c for c in current['controls'] if c['name'] == name)
            same_geometry = all(abs(bounds[k] - current_bounds[k]) < .01 for k in ('x', 'y', 'width', 'height'))
            assert same_geometry, (state['state'], entry['width'], name)
            padding = 8 if name == '.trajectory-legend' else 0
            crop = (math.floor(bounds['x'] - padding), math.floor(bounds['y']),
                    math.ceil(bounds['x'] + bounds['width'] + padding), math.ceil(bounds['y'] + bounds['height']))
            first, second = original_image.crop(crop), updated_image.crop(crop)
            delta = ImageChops.difference(first, second)
            # Text/control ink is bright over the accepted graphite surfaces.
            # Keep full-pixel differences in the report rather than claiming
            # RGBA equality for independent captures of a changing scene.
            ink = lambda image: image.convert('L').point(lambda v: 255 if v > 150 else 0)
            mask_delta = ImageChops.difference(ink(first), ink(second))
            changed = sum(value != 0 for value in mask_delta.tobytes())
            results.append({'state': state['state'], 'width': entry['width'], 'region': name,
                            'geometryEqual': same_geometry, 'foregroundMaskChangedPixels': changed,
                            'maximumRGBDifference': max(high for _, high in delta.getextrema()),
                            'meanRGBDifference': sum(ImageStat.Stat(delta).mean) / 3})
output.write_text(json.dumps({'method': 'Exact rectangles; luma >150 foreground masks; independent scene RGBA differences reported separately.',
                              'regions': results}, indent=2) + '\n')
print(len(results), 'regions;', sum(r['foregroundMaskChangedPixels'] == 0 for r in results), 'identical foreground masks')
