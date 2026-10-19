#!/usr/bin/env python3
"""Offline maintenance tests; optional full reproduction uses MISSION1_COUNTRY_SOURCES."""
import copy
import importlib.util
import io
import json
import os
import sys
from pathlib import Path
import tempfile
import unittest

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('country_assets', Path(__file__).with_name('generate-country-assets.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ImportPolicyTests(unittest.TestCase):
    def test_checked_iso_and_explicit_pseudo_codes(self):
        self.assertEqual(len(m.ISO), 249)
        self.assertEqual(m.iso_pair({'ISO_A2_EH': 'TW', 'ISO_A3_EH': 'TWN'}), ('TW', 'TWN'))
        for pair in [('-99', '-99'), ('XK', '-99'), ('XD', 'SYR')]:
            self.assertEqual(m.iso_pair(dict(zip(['ISO_A2_EH', 'ISO_A3_EH'], pair))), (None, None))
        for pair in [('ZZ', 'ZZZ'), ('IT', 'USA'), ('XK', 'XKX')]:
            with self.assertRaises(ValueError): m.iso_pair(dict(zip(['ISO_A2_EH', 'ISO_A3_EH'], pair)))

    def test_svg_rejects_active_external_content(self):
        for inner in ['<script/>', '<foreignObject/>', '<image href="https://example.org/a"/>',
                      '<use href="https://example.org/a#id"/>', '<path onclick="alert(1)"/>',
                      '<path style="fill:url(https://example.org/a)"/>', '<style>@import "https://example.org/a";</style>',
                      '<style>path{fill:u\\72l(https://example.org/a)}</style>', '<path fill="u\\72l(https://example.org/a)"/>']:
            svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2">' + inner + '</svg>').encode()
            with self.assertRaises(ValueError): m.validate_svg(svg)
        with self.assertRaises(ValueError):
            m.validate_svg(b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg/>')
        self.assertEqual(m.validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><defs><path id="a"/></defs><use href="#a"/><style>.x{fill:red}</style></svg>'), '0 0 3 2')

    def test_hash_and_source_schema_fail_closed(self):
        with tempfile.TemporaryDirectory() as t:
            (Path(t) / m.PINS['countries']['file']).write_bytes(b'not the pinned source')
            with self.assertRaisesRegex(ValueError, 'checksum'): m.checked_archive(Path(t), 'countries')
        with self.assertRaises(Exception): m.read_boundary(b'invalid zip', 'countries', 258)

    def test_synthetic_geometry_preserves_hole_island_and_delta_closure(self):
        # Synthetic geographic TEST fixture; not source geometry or ISS data.
        g = {'type': 'MultiPolygon', 'coordinates': [
            [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]],
            [[[179, 0], [180, 0], [180, 1], [179, 1], [179, 0]]]]}
        parts, repair = m.geometry_parts(g, 'TEST')
        self.assertIsNone(repair); self.assertEqual(len(parts), 2); self.assertEqual(len(parts[0][1]), 2)
        for _, rings in parts:
            for ring in rings:
                xs = ring[::2]; ys = ring[1::2]
                self.assertEqual(sum(xs), xs[0]); self.assertEqual(sum(ys), ys[0])

    @unittest.skipUnless(os.environ.get('MISSION1_COUNTRY_SOURCES'), 'Set MISSION1_COUNTRY_SOURCES for full pinned-source reproduction')
    def test_full_import_reproduces_all_checked_in_assets(self):
        frontend = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory() as t:
            out = Path(t)
            result = m.generate(Path(os.environ['MISSION1_COUNTRY_SOURCES']), out)
            self.assertEqual(result['asset']['identityCount'], 266)
            self.assertEqual(result['asset']['polygonCount'], 4292)
            self.assertEqual(result['asset']['vertexCount'], 552829)
            self.assertEqual(result['asset']['coordinateBufferBytes'], 4422632)
            self.assertEqual(len(result['flags']['files']), 248)
            self.assertEqual(result['repairs'][0]['unit'], 'EGY'); self.assertTrue(result['repairs'][0]['valid'])
            self.assertLess(abs(result['repairs'][0]['sourceAreaSquareDegrees'] - result['repairs'][0]['repairedAreaSquareDegrees']), 1e-10)
            for p in out.rglob('*'):
                if p.is_file(): self.assertEqual(p.read_bytes(), (frontend / p.relative_to(out)).read_bytes(), str(p.relative_to(out)))
            identities = json.loads((out / 'public/geo' / result['asset']['file']).read_text())['identities']
            names = {i['key']: i['displayName'] for i in identities}
            for iso, name in [('FR', 'France'), ('AU', 'Australia'), ('BR', 'Brazil'), ('KZ', 'Kazakhstan'), ('GB', 'United Kingdom'), ('BE', 'Belgium'), ('GF', 'French Guiana')]:
                self.assertEqual(names['ne:iso2:' + iso], name)


if __name__ == '__main__': unittest.main()
