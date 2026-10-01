"""Keep full frame diagnostics compressed and a small reviewable CSV beside them."""
import csv
import gzip
import json
import sys
from pathlib import Path

folder = Path(sys.argv[1])
fields = ['build', 'source', 'direction', 'fraction', 'mode', 'displayRangeMeters',
          'visibility', 'activeHaloAlpha', 'activeBodyAlpha', 'inactiveHaloAlpha',
          'inactiveBodyAlpha', 'activeShown', 'inactiveShown', 'rasterWidthCss', 'rasterHeightCss']
with (folder / 'frame-samples.csv').open('w', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    for p in sorted(folder.glob('*-samples.json')):
        data = json.loads(p.read_text())
        for row in data['samples']:
            active = next(t for t in row['trails'] if t['source'] == row['source'])
            inactive = next(t for t in row['trails'] if t['source'] != row['source'])
            raster = row.get('raster', {})
            writer.writerow(dict(zip(fields, [data['label'], row['source'], row['kind'],
                row['fraction'], row['mode'], row['range'], row['visibility'],
                active['layers'][0]['alpha'], active['layers'][1]['alpha'],
                inactive['layers'][0]['alpha'], inactive['layers'][1]['alpha'],
                active['layers'][1]['show'], inactive['layers'][1]['show'],
                raster.get('widthCss'), raster.get('heightCss')])))
        with gzip.GzipFile(filename=str(p) + '.gz', mode='wb', mtime=0) as archive:
            archive.write(p.read_bytes())
        # These are generated review files; the full content is preserved above.
        p.unlink()
