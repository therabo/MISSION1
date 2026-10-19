#!/usr/bin/env python3
"""Explicit offline country-asset maintenance; never invoked by app/build.

python generate-country-assets.py SOURCE_DIRECTORY [--output FRONTEND_DIRECTORY]
SOURCE_DIRECTORY holds the three hash-pinned archives in country-data/source-pins.json.
Install country-data/requirements.txt in an external maintenance environment.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
import tarfile
import xml.etree.ElementTree as ET
import zipfile

import shapefile
import shapely
from shapely.geometry import Polygon, MultiPolygon, shape
from shapely.validation import explain_validity

HERE = Path(__file__).resolve().parent
POLICY = 'ne10m-5.1.1-iso-rollup-v1'
Q = 100_000
PINS = json.loads((HERE / 'country-data/source-pins.json').read_text())
ISO_DOCUMENT = json.loads((HERE / 'country-data/iso3166-allowlist.json').read_text())
ISO = ISO_DOCUMENT['codes']
FIELDS = ('NE_ID', 'GU_A3', 'ADM0_A3', 'ADMIN', 'GEOUNIT', 'SOVEREIGNT', 'NAME_EN',
          'ISO_A2', 'ISO_A3', 'ISO_A2_EH', 'ISO_A3_EH', 'TYPE', 'BRK_A3', 'BRK_NAME', 'BRK_DIFF')


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def checked_archive(directory: Path, key: str) -> bytes:
    pin = PINS[key]
    data = (directory / pin['file']).read_bytes()
    if digest(data) != pin['sha256']:
        raise ValueError(f'{key}: pinned source checksum mismatch')
    return data


def read_boundary(data: bytes, product: str, expected_count: int):
    name = 'ne_10m_admin_0_' + product
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.read(name + '.VERSION.txt').decode().strip() != '5.1.1':
            raise ValueError('Unexpected Natural Earth version')
        prj = archive.read(name + '.prj').decode()
        if 'GCS_WGS_1984' not in prj or 'Degree' not in prj:
            raise ValueError('Expected geographic WGS84 degrees')
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(name + '.shp')),
                                  shx=io.BytesIO(archive.read(name + '.shx')),
                                  dbf=io.BytesIO(archive.read(name + '.dbf')), encoding='utf-8')
        names = [f[0] for f in reader.fields[1:]]
        if not set(FIELDS).issubset(names) or reader.shapeType != shapefile.POLYGON or len(reader) != expected_count:
            raise ValueError('Unexpected Natural Earth schema/feature count')
        rows = list(reader.iterShapeRecords())
        return rows, {'crs': prj, 'coordinateOrder': 'longitude,latitude', 'angleUnit': 'degree',
                      'featureCount': len(rows), 'attributeSchemaSha256': digest(encode(names))}


def iso_pair(properties: dict):
    a2, a3 = properties['ISO_A2_EH'], properties['ISO_A3_EH']
    if a2 in ISO:
        if ISO[a2] != a3:
            raise ValueError(f'ISO pair mismatch: {a2}/{a3}')
        return a2, a3
    if (a2, a3) not in {('-99', '-99'), ('XK', '-99'), ('XD', '-99'), ('XD', 'SYR')}:
        raise ValueError(f'Unreviewed source ISO exception: {a2}/{a3}')
    return None, None


def identity_key(properties: dict) -> str:
    iso2, _ = iso_pair(properties)
    return 'ne:iso2:' + iso2 if iso2 else 'ne:gu:' + properties['GU_A3']


def flag_key(properties: dict):
    iso2, _ = iso_pair(properties)
    return None if iso2 == 'AQ' else iso2.lower() if iso2 else 'xk' if properties['ISO_A2_EH'] == 'XK' else None


def validate_svg(data: bytes):
    """Allow passive SVG with internal fragment references; never sanitize silently."""
    text = data.decode('utf-8')
    if re.search(r'<!DOCTYPE|<!ENTITY|<\?xml-stylesheet', text, re.I):
        raise ValueError('SVG external entity/stylesheet declaration')
    root = ET.fromstring(text)
    allowed = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
               'defs', 'clipPath', 'mask', 'use', 'symbol', 'linearGradient', 'radialGradient',
               'stop', 'style', 'text', 'tspan', 'title', 'desc', 'metadata', 'RDF', 'Work', 'format', 'type', 'Image',
               'namedview', 'perspective'}
    if root.tag != '{http://www.w3.org/2000/svg}svg' or not root.get('viewBox'):
        raise ValueError('Expected SVG root and intrinsic viewBox')
    for element in root.iter():
        tag = element.tag.split('}')[-1]
        if tag == 'style' and re.search(r'@|\\|url\s*\(|javascript:|expression\s*\(', element.text or '', re.I):
            raise ValueError('External/active SVG stylesheet')
        if tag not in allowed:
            raise ValueError('Unsupported/active SVG element: ' + tag)
        for key, value in element.attrib.items():
            attr = key.split('}')[-1].lower()
            if attr.startswith('on') or attr in {'base', 'src'}:
                raise ValueError('Active SVG attribute')
            if attr == 'href' and not re.fullmatch(r'#[A-Za-z_][\w:.-]*', value):
                raise ValueError('External SVG reference')
            if re.search(r'@import|javascript:|expression\s*\(', value, re.I) or '\\' in value:
                raise ValueError('Active SVG style')
            for resource in re.findall(r'url\s*\((.*?)\)', value, re.I):
                if not re.fullmatch(r'''["']?#[A-Za-z_][\w:.-]*["']?''', resource.strip()):
                    raise ValueError('External CSS resource')
    vb = [float(n) for n in root.get('viewBox').replace(',', ' ').split()]
    if len(vb) != 4 or not all(math.isfinite(v) for v in vb) or min(vb[2:]) <= 0:
        raise ValueError('Invalid intrinsic SVG dimensions')
    return root.get('viewBox')


def normalize_identities(unit_properties, country_properties):
    names, naming_candidates = {}, {}
    for p in country_properties:
        a2, _ = iso_pair(p)
        if a2:
            naming_candidates.setdefault(a2, []).append(p)
    for a2, candidates in naming_candidates.items():
        # The ISO country feature, not another dependency reusing its _EH code.
        canonical = [p for p in candidates if p['ADM0_A3'] == ISO[a2]]
        if len(canonical) == 1:
            names[a2] = canonical[0]['NAME_EN']
        elif len(candidates) == 1:
            names[a2] = candidates[0]['NAME_EN']
        else:
            raise ValueError('Ambiguous Countries naming join: ' + a2)
    groups, indices, provenance = [], {}, []
    for p in unit_properties:
        key = identity_key(p)
        a2, a3 = iso_pair(p)
        # Preserve the source's accented territory spelling requested by the product contract.
        name = p['NAME_EN'] if a2 == 'RE' else names.get(a2) or p['GEOUNIT']
        if key not in indices:
            indices[key] = len(groups)
            groups.append({'key': key, 'iso2': a2, 'iso3': a3, 'displayName': name, 'flagKey': flag_key(p)})
            provenance.append({'key': key, 'displayNameField': 'map_units.NAME_EN (RE spelling)' if a2 == 'RE' else 'countries.NAME_EN (canonical ADM0_A3=ISO_A3_EH, else unique ISO row)' if a2 in names else 'map_units.GEOUNIT', 'units': []})
        idx = indices[key]
        if groups[idx]['displayName'] != name or groups[idx]['flagKey'] != flag_key(p):
            raise ValueError('Unreviewed multi-unit identity/name/flag conflict')
        provenance[idx]['units'].append({f: p[f] for f in FIELDS})
    return groups, indices, provenance


def geometry_parts(source_geometry, gu: str):
    geometry = shape(source_geometry)
    repair = None
    if not geometry.is_valid:
        if gu != 'EGY' or not explain_validity(geometry).startswith('Ring Self-intersection[35.621087106'):
            raise ValueError(f'Unreviewed invalid source geometry: {gu} {explain_validity(geometry)}')
        old = geometry
        geometry = shapely.make_valid(geometry, method='linework')
        if not geometry.is_valid or geometry.geom_type != 'MultiPolygon' or abs(old.area - geometry.area) > 1e-10:
            raise ValueError('Egypt repair changed topology unexpectedly')
        repair = {'unit': gu, 'sourceGeometryWkbSha256': digest(old.wkb), 'sourceValidity': explain_validity(old),
                  'method': 'Shapely make_valid / linework', 'repairedGeometryWkbSha256': digest(geometry.wkb),
                  'valid': geometry.is_valid, 'sourceAreaSquareDegrees': old.area, 'repairedAreaSquareDegrees': geometry.area,
                  'meaning': 'Topology-validity repair only; no geographic accuracy improvement'}
    polygons = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    result, quantized = [], []
    for polygon in polygons:
        rings = []
        for ring in [polygon.exterior, *polygon.interiors]:
            points = [(round(x * Q), round(y * Q)) for x, y in ring.coords]
            if len(points) < 4 or points[0] != points[-1] or len(set(points)) < 3:
                raise ValueError('Quantization collapsed an island/hole/ring')
            if any(not (-180*Q <= x <= 180*Q and -90*Q <= y <= 90*Q) for x, y in points):
                raise ValueError('Coordinate outside geographic bounds')
            rings.append(points)
        quantized.append(Polygon(rings[0], rings[1:]))
        bbox = [min(x for x, y in rings[0]), min(y for x, y in rings[0]),
                max(x for x, y in rings[0]), max(y for x, y in rings[0])]
        delta = []
        for ring in rings:
            coords, x, y = [], 0, 0
            for nx, ny in ring:
                coords.extend([nx - x, ny - y]); x, y = nx, ny
            delta.append(coords)
        result.append([bbox, delta])
    if not MultiPolygon(quantized).is_valid:
        raise ValueError('Quantization introduced invalid topology: ' + gu)
    return result, repair


def generate(directory: Path, output: Path):
    units, unit_meta = read_boundary(checked_archive(directory, 'map_units'), 'map_units', 298)
    countries, country_meta = read_boundary(checked_archive(directory, 'countries'), 'countries', 258)
    props = [s.record.as_dict() for s in units]
    identities, by_key, provenance = normalize_identities(props, [s.record.as_dict() for s in countries])
    polygons, repairs = [], []
    for sr, p in zip(units, props):
        parts, repair = geometry_parts(sr.shape.__geo_interface__, p['GU_A3'])
        polygons.extend([by_key[identity_key(p)], b, r] for b, r in parts)
        if repair: repairs.append(repair)
    if len(identities) != 266 or len(polygons) != 4292 or len(repairs) != 1:
        raise ValueError('Catalog inventory changed; source policy review required')
    selected = sorted({i['flagKey'] for i in identities if i['flagKey']})
    flag_files, flag_meta = {}, []
    with tarfile.open(fileobj=io.BytesIO(checked_archive(directory, 'flags'))) as archive:
        # Read only named members; never extract untrusted paths.
        roots = {m.name.split('/')[0] for m in archive.getmembers()}
        if len(roots) != 1: raise ValueError('Unexpected flag archive roots')
        prefix = next(iter(roots)) + '/'
        read = lambda name: archive.extractfile(prefix + name).read()
        registry = json.loads(read('scripts/flags.json'))
        flag_readme = read('README.md').decode()
        package = json.loads(read('package.json'))
        if package['version'] != '1.2.10' or package['license'] != 'PD':
            raise ValueError('Unexpected flag package metadata')
        for key in selected:
            data = read('svg/' + key + '.svg')
            vb = validate_svg(data)
            flag_files[key] = data
            record = registry[key]
            flag_meta.append({'key': key, 'sha256': digest(data), 'bytes': len(data), 'viewBox': vb,
                              'sourceRegistry': record, 'originUnresolved': 'TODO' in str(record),
                              'reuseStatement': 'Publisher asserts public domain; national-symbol use restrictions are separate'})
    if len(selected) != 248: raise ValueError('Flag allowlist changed')
    asset = {'schema': 1, 'policy': POLICY, 'quantization': Q, 'identities': identities, 'polygons': polygons}
    data = encode(asset)
    filename = 'countries-ne10m-5.1.1-' + digest(data)[:12] + '.delta.json'
    manifest = {'schema': 1, 'policy': POLICY, 'publisher': 'Natural Earth', 'product': 'Admin 0 — Map Units',
                'version': '5.1.1', 'scale': '1:10,000,000', 'viewpoint': 'default de-facto',
                'terms': 'https://www.naturalearthdata.com/about/terms-of-use/', 'reuse': 'Publisher public-domain data; voluntary attribution retained',
                'inputs': PINS, 'geometryMetadata': unit_meta, 'namingMetadata': country_meta,
                'isoAllowlist': ISO_DOCUMENT, 'repairs': repairs, 'identities': provenance,
                'asset': {'file': filename, 'sha256': digest(data), 'bytes': len(data), 'gzip9Bytes': len(gzip.compress(data, 9, mtime=0)),
                          'identityCount': len(identities), 'polygonCount': len(polygons),
                          'vertexCount': sum(len(r)//2 for p in polygons for r in p[2]),
                          'coordinateBufferBytes': sum(len(r)*4 for p in polygons for r in p[2])},
                'generator': {'pyshp': shapefile.__version__, 'shapely': shapely.__version__, 'geos': shapely.geos_version_string,
                              'encoding': 'flat integer XY ring deltas, quantization 100000; no simplification/ring removal'},
                'flags': {'source': PINS['flags'], 'package': package, 'files': flag_meta,
                          'rawBytes': sum(len(b) for b in flag_files.values()),
                          'note': 'Individual unmodified local SVGs; missing origins remain explicit. Antarctica artwork excluded.'}}
    geo = output / 'public/geo'; flags = output / 'public/flags'
    geo.mkdir(parents=True, exist_ok=True); flags.mkdir(parents=True, exist_ok=True)
    (geo / filename).write_bytes(data)
    for previous in geo.glob('countries-ne10m-5.1.1-*.delta.json'):
        if previous.name != filename: previous.unlink()
    (geo / 'country-provenance-ne10m-5.1.1.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    for key, data in flag_files.items(): (flags / (key + '.svg')).write_bytes(data)
    (flags / 'SOURCE.md').write_text('# Local national/territory flag artwork\n\n'+
        'Pinned hampusborgos/country-flags commit '+PINS['flags']['commit']+'.\n\n'+
        '248 allowlisted unmodified SVGs. Full per-file source registry/checksums and unresolved origins are retained in ../geo/country-provenance-ne10m-5.1.1.json. National-symbol use restrictions are independent of copyright. No Antarctica national flag is asserted.\n\n'+flag_readme)
    descriptor = {'schema': 1, 'policy': POLICY, 'quantization': Q, **manifest['asset']}
    (output / 'src/geo').mkdir(parents=True, exist_ok=True)
    (output / 'src/geo/countryAsset.json').write_text(json.dumps(descriptor, indent=2)+'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_directory', type=Path)
    parser.add_argument('--output', type=Path, default=HERE.parent)
    args = parser.parse_args()
    result = generate(args.source_directory, args.output)
    print(json.dumps(result['asset'], indent=2))
