#!/usr/bin/env python3
"""Explicit offline marine maintenance. No application/build/network side effects.

python generate-marine-assets.py SOURCE_DIRECTORY [--output FRONTEND_DIRECTORY]
Use the existing external country-data maintenance requirements/environment.
"""
from __future__ import annotations
import argparse
from collections import Counter
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile

import shapefile
import shapely
from shapely.geometry import Polygon, shape

HERE = Path(__file__).resolve().parent
DATA = HERE / 'marine-data'
PINS = json.loads((DATA / 'source-pins.json').read_text())
POLICY = 'ne10m-5.1.0-macro-v1'
Q = 100_000
BASINS = {'arctic', 'southern', 'atlantic', 'pacific', 'indian'}


def encode(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_policy():
    data = (DATA / 'macro-rollup.json').read_bytes()
    if digest(data) != PINS['policySha256']:
        raise ValueError('Approved marine policy checksum mismatch')
    policy = json.loads(data)
    if policy['schema'] != 1 or policy['policy'] != POLICY or policy['quantization'] != Q:
        raise ValueError('Unexpected marine policy/schema/quantization')
    regions = policy['regions']
    ids = {r['id'] for r in regions}
    if len(regions) != 16 or len(ids) != 16 or not BASINS.issubset(ids):
        raise ValueError('Expected exactly 16 approved marine identities')
    for r in regions:
        if r['priority'] != (100 if r['id'] in BASINS else 200) or not r['displayName'].strip():
            raise ValueError('Unexpected marine name/priority')
    mapping = {r['ne_id']: r for r in policy['mapping']}
    if len(mapping) != PINS['uniqueIdCount'] or len(mapping) != len(policy['mapping']):
        raise ValueError('Unexpected marine source-ID mapping')
    if any(r['macroRegionId'] is not None and r['macroRegionId'] not in ids for r in mapping.values()):
        raise ValueError('Unknown marine macro identity')
    return policy, mapping


def checked_source(directory: Path) -> bytes:
    data = (directory / PINS['source']['file']).read_bytes()
    if len(data) != PINS['source']['bytes'] or digest(data) != PINS['source']['sha256']:
        raise ValueError('Marine source checksum/length mismatch')
    return data


def read_source(data: bytes):
    name = PINS['product']
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.read(name + '.VERSION.txt').decode().strip() != PINS['version']:
            raise ValueError('Unexpected marine source version')
        prj = archive.read(name + '.prj').decode()
        if prj != PINS['crs'] or 'GCS_WGS_1984' not in prj or 'Degree' not in prj:
            raise ValueError('Expected geographic WGS84 longitude/latitude degrees')
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(name + '.shp')),
                                  shx=io.BytesIO(archive.read(name + '.shx')),
                                  dbf=io.BytesIO(archive.read(name + '.dbf')), encoding='utf-8')
        schema = [[f.name, str(f.field_type), f.size, f.decimal] for f in reader.fields[1:]]
        if schema != PINS['schema'] or reader.shapeType != shapefile.POLYGON or len(reader) != PINS['featureCount']:
            raise ValueError('Unexpected marine source schema/type/count')
        return list(reader.iterShapeRecords())


def macro_for(properties: dict, mapping: dict):
    sid = properties['ne_id']
    if sid not in mapping:
        raise ValueError(f'Unmapped marine source ID: {sid}')
    entry = mapping[sid]
    if properties['name'] != entry['expectedName']:
        raise ValueError(f'Marine source name changed for ID: {sid}')
    return entry['macroRegionId']


def geometry_parts(geometry):
    """Preserve every polygon/hole/dateline part. Invalid source/quantization fails; no repair/simplification."""
    g = shape(geometry)
    if g.geom_type not in {'Polygon', 'MultiPolygon'} or not g.is_valid or g.is_empty:
        raise ValueError('Invalid marine polygon geometry')
    result = []
    for polygon in (list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]):
        absolute, encoded = [], []
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = []
            for x, y in ring.coords:
                if not math.isfinite(x) or not math.isfinite(y) or abs(x) > 180 or abs(y) > 90:
                    raise ValueError('Invalid WGS84 marine coordinate')
                coords.append((round(x * Q), round(y * Q)))
            if len(coords) < 4 or coords[0] != coords[-1]:
                raise ValueError('Invalid marine ring closure')
            deltas, previous = [], (0, 0)
            for xy in coords:
                deltas.extend([xy[0] - previous[0], xy[1] - previous[1]])
                previous = xy
            absolute.append(coords)
            encoded.append(deltas)
        quantized = Polygon(absolute[0], absolute[1:])
        if not quantized.is_valid or quantized.is_empty or quantized.area <= 0:
            raise ValueError('Invalid quantized marine geometry')
        xs, ys = zip(*absolute[0])
        result.append(([min(xs), min(ys), max(xs), max(ys)], encoded))
    return g, result


def generate(directory: Path, output: Path):
    policy, mapping = read_policy()
    rows = read_source(checked_source(directory))
    regions = policy['regions']
    indices = {r['id']: i for i, r in enumerate(regions)}
    polygons, features, seen = [], [], Counter()
    source_parts = source_vertices = selected_features = 0
    for row in rows:
        properties = row.record.as_dict()
        macro = macro_for(properties, mapping)
        seen[properties['ne_id']] += 1
        geometry, parts = geometry_parts(row.shape.__geo_interface__)
        source_parts += len(parts)
        source_vertices += sum(len(r) // 2 for _, rings in parts for r in rings)
        if macro is not None:
            selected_features += 1
            polygons.extend([[indices[macro], bbox, rings] for bbox, rings in parts])
        features.append({k: properties[k] for k in ['ne_id', 'name', 'name_en', 'featurecla', 'scalerank', 'wikidataid']} |
                        {'macroRegionId': macro, 'geometryType': geometry.geom_type, 'bbox': list(geometry.bounds),
                         'sourceWkbSha256': digest(geometry.wkb), 'quantizedPartsSha256': digest(encode(parts)),
                         'polygonParts': len(parts), 'vertices': sum(len(r) // 2 for _, rings in parts for r in rings)})
    if set(seen) != set(mapping) or len(seen) != PINS['uniqueIdCount']:
        raise ValueError('Missing/unmapped source IDs')
    # The pinned source intentionally has two different Great Barrier Reef records with one ID.
    if {sid: n for sid, n in seen.items() if n > 1} != {1159117285: 2}:
        raise ValueError('Unexpected shared source identity')
    counts = {'sourcePartCount': source_parts, 'sourceVertexCount': source_vertices,
              'selectedFeatureCount': selected_features, 'polygonCount': len(polygons),
              'vertexCount': sum(len(r) // 2 for _, _, rings in polygons for r in rings),
              'coordinateBufferBytes': sum(len(r) * 4 for _, _, rings in polygons for r in rings)}
    if any(value != PINS[key] for key, value in counts.items()):
        raise ValueError('Marine geometry inventory changed')
    data = encode({'schema': 1, 'policy': POLICY, 'quantization': Q, 'identities': regions, 'polygons': polygons})
    filename = 'marine-ne10m-5.1.0-' + digest(data)[:12] + '.delta.json'
    asset = {'file': filename, 'sha256': digest(data), 'bytes': len(data),
             'gzip9Bytes': len(gzip.compress(data, 9, mtime=0)), 'identityCount': len(regions),
             **{k: counts[k] for k in ['selectedFeatureCount', 'polygonCount', 'vertexCount', 'coordinateBufferBytes']}}
    manifest = {'schema': 1, 'policy': POLICY, 'publisher': 'Natural Earth',
                'product': 'Physical Labels — Geography marine polygons', 'sourceProduct': PINS['product'],
                'version': PINS['version'], 'scale': PINS['scale'], 'source': PINS['source'],
                'terms': 'https://www.naturalearthdata.com/about/terms-of-use/',
                'reuse': 'Publisher public-domain data; voluntary attribution: Made with Natural Earth',
                'geometryMetadata': {'crs': PINS['crs'], 'coordinateOrder': PINS['coordinateOrder'],
                                     'angleUnit': 'degree', 'sourceSchema': PINS['schema'],
                                     'featureCount': len(rows), 'uniqueIdCount': len(seen), **counts},
                'rollup': policy, 'policySha256': PINS['policySha256'], 'approval': PINS['approval'],
                'features': features, 'asset': asset,
                'generator': {'pyshp': shapefile.__version__, 'shapely': shapely.__version__, 'geos': shapely.geos_version_string,
                              'encoding': 'flat integer XY ring deltas, quantization 100000; no simplification/repair/ring removal'},
                'limitations': 'Generalized cartographic region boundaries, roughly 1:50m source precision; coastal gaps and exact-boundary ambiguity remain. No snapping, jurisdiction, territorial-water, navigation or hydrographic authority. Historical uses the installed fixed catalog.'}
    geo = output / 'public/geo'
    code = output / 'src/geo'
    geo.mkdir(parents=True, exist_ok=True)
    code.mkdir(parents=True, exist_ok=True)
    (geo / filename).write_bytes(data)
    for previous in geo.glob('marine-ne10m-5.1.0-*.delta.json'):
        if previous.name != filename:
            previous.unlink()
    (geo / 'marine-provenance-ne10m-5.1.0.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    (code / 'marineAsset.json').write_text(json.dumps({'schema': 1, 'policy': POLICY, 'quantization': Q, **asset}, indent=2) + '\n')
    (code / 'marineRegions.json').write_text(json.dumps({r['id']: r for r in regions}, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_directory', type=Path)
    parser.add_argument('--output', type=Path, default=HERE.parent)
    args = parser.parse_args()
    print(json.dumps(generate(args.source_directory, args.output)['asset'], indent=2))
