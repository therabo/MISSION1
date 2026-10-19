#!/usr/bin/env python3
"""Offline import/integrity gates. Set MISSION1_MARINE_SOURCES for full pinned reproduction."""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('marine_assets', Path(__file__).with_name('generate-marine-assets.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
FRONTEND = Path(__file__).resolve().parent.parent


class MarineImportTests(unittest.TestCase):
    def test_complete_approved_identity_mapping(self):
        policy, mapping = m.read_policy()
        self.assertEqual(len(mapping), 305)
        self.assertEqual(len(policy['regions']), 16)
        self.assertEqual({r['id'] for r in policy['regions'] if r['priority'] == 100}, m.BASINS)
        self.assertEqual(sum(r['macroRegionId'] is None for r in mapping.values()), 9)
        for r in policy['regions']:
            self.assertNotIn('North Atlantic', r['displayName'])
            self.assertNotIn('South Pacific', r['displayName'])
        for sid in [1159115057, 1159115149]: self.assertEqual(mapping[sid]['macroRegionId'], 'atlantic')
        for sid in [1159115079, 1159115099]: self.assertEqual(mapping[sid]['macroRegionId'], 'pacific')
        self.assertEqual(mapping[1159119095]['macroRegionId'], 'caspian-sea')
        with self.assertRaisesRegex(ValueError, 'Unmapped'):
            m.macro_for({'ne_id': 999, 'name': 'TEST unmapped future region'}, mapping)
        with self.assertRaisesRegex(ValueError, 'name changed'):
            m.macro_for({'ne_id': 1159115057, 'name': 'TEST changed name'}, mapping)

    def test_checksum_rejects_non_pinned_source(self):
        with tempfile.TemporaryDirectory() as t:
            (Path(t) / m.PINS['source']['file']).write_bytes(b'TEST corrupt source')
            with self.assertRaisesRegex(ValueError, 'checksum'): m.checked_source(Path(t))

    def test_synthetic_geometry_retains_hole_islands_and_both_dateline_parts(self):
        # Synthetic geographic TEST fixture, not ISS observations or invented production geometry.
        g = {'type': 'MultiPolygon', 'coordinates': [
            [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]],
            [[[179, 0], [180, 0], [180, 1], [179, 1], [179, 0]]],
            [[[-180, 0], [-179, 0], [-179, 1], [-180, 1], [-180, 0]]]]}
        _, parts = m.geometry_parts(g)
        self.assertEqual(len(parts), 3); self.assertEqual(len(parts[0][1]), 2)
        self.assertEqual(parts[1][0][2], 180 * m.Q); self.assertEqual(parts[2][0][0], -180 * m.Q)
        for _, rings in parts:
            for r in rings:
                self.assertEqual(sum(r[::2]), r[0]); self.assertEqual(sum(r[1::2]), r[1])
                self.assertTrue(all(isinstance(x, int) for x in r))
        with self.assertRaisesRegex(ValueError, 'Invalid'):
            m.geometry_parts({'type': 'Polygon', 'coordinates': [[[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]]})
        with self.assertRaisesRegex(ValueError, 'WGS84'):
            m.geometry_parts({'type': 'Polygon', 'coordinates': [[[180, 0], [181, 0], [181, 1], [180, 1], [180, 0]]]})

    def test_checked_in_asset_manifest_and_generated_registry_agree(self):
        descriptor = json.loads((FRONTEND / 'src/geo/marineAsset.json').read_text())
        manifest = json.loads((FRONTEND / 'public/geo/marine-provenance-ne10m-5.1.0.json').read_text())
        data = (FRONTEND / 'public/geo' / descriptor['file']).read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(), descriptor['sha256'])
        self.assertEqual(len(data), descriptor['bytes'])
        self.assertEqual(manifest['asset'], {k: v for k, v in descriptor.items() if k not in ['schema', 'policy', 'quantization']})
        self.assertEqual(manifest['source'], m.PINS['source'])
        self.assertEqual(manifest['policySha256'], m.digest((m.DATA / 'macro-rollup.json').read_bytes()))
        self.assertEqual(len(manifest['features']), 306)
        self.assertEqual(sum(f['macroRegionId'] is not None for f in manifest['features']), 297)
        decoded = json.loads(data)
        self.assertEqual(decoded['quantization'], 100000)
        self.assertEqual(decoded['identities'], m.read_policy()[0]['regions'])
        registry = json.loads((FRONTEND / 'src/geo/marineRegions.json').read_text())
        self.assertEqual(list(registry.values()), decoded['identities'])
        self.assertEqual(len(decoded['polygons']), 336)
        self.assertEqual(sum(len(r) * 4 for _, _, rs in decoded['polygons'] for r in rs), 465624)
        self.assertFalse(any('sourceIds' in r for r in decoded['identities']))

    @unittest.skipUnless(os.environ.get('MISSION1_MARINE_SOURCES'), 'Set MISSION1_MARINE_SOURCES for pinned-source gates')
    def test_source_version_crs_schema_and_full_byte_identical_reproduction(self):
        directory = Path(os.environ['MISSION1_MARINE_SOURCES'])
        data = m.checked_source(directory)
        rows = m.read_source(data)
        self.assertEqual(len(rows), 306)
        name = m.PINS['product']
        for member, replacement, reason in [('.VERSION.txt', b'99.0.0', 'version'), ('.prj', b'TEST non-WGS84', 'WGS84'),
                                             ('.dbf', None, 'schema')]:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                entries = {n: z.read(n) for n in z.namelist()}
            if replacement is None:
                dbf = bytearray(entries[name + member]); dbf[32:43] = b'wrongfield\0'; replacement = bytes(dbf)
            entries[name + member] = replacement
            mutated = io.BytesIO()
            with zipfile.ZipFile(mutated, 'w') as z:
                for n, body in entries.items(): z.writestr(n, body)
            with self.assertRaisesRegex(ValueError, reason): m.read_source(mutated.getvalue())
        with tempfile.TemporaryDirectory() as t:
            out = Path(t); result = m.generate(directory, out)
            self.assertEqual(result['asset']['vertexCount'], 58203)
            for p in out.rglob('*'):
                if p.is_file(): self.assertEqual(p.read_bytes(), (FRONTEND / p.relative_to(out)).read_bytes(), str(p))


if __name__ == '__main__': unittest.main()
