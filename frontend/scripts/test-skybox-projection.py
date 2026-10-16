#!/usr/bin/env python3
"""Offline regression for GPU face registration; no downloaded source needed.

Run: python frontend/scripts/test-skybox-projection.py
Requires the generator's Pillow/NumPy environment.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

import numpy as np

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("skybox", Path(__file__).with_name("generate-tycho-skybox.py"))
skybox = importlib.util.module_from_spec(spec)
spec.loader.exec_module(skybox)


class SkyboxProjectionTest(unittest.TestCase):
    def test_file_directions_match_gpu_lookup_after_cesium_dom_upload_flip(self):
        # Independent forward lookup from Khronos cube-map selection rules:
        # https://registry.khronos.org/OpenGL/specs/gl/glspec21.pdf §3.8.6
        # Cesium CubeMap's documented DOM flipY=true reverses the file v axis.
        for face in skybox.FACES:
            for u in (-0.85, -0.2, 0.3, 0.9):
                for v in (-0.95, -0.4, 0.15, 0.8):
                    x, y, z = skybox.direction(face, np.array(u), np.array(v))
                    if abs(x) > max(abs(y), abs(z)):
                        target = "positiveX" if x > 0 else "negativeX"
                        sc, tc, ma = (-z if x > 0 else z), -y, abs(x)
                    elif abs(y) > abs(z):
                        target = "positiveY" if y > 0 else "negativeY"
                        sc, tc, ma = x, (z if y > 0 else -z), abs(y)
                    else:
                        target = "positiveZ" if z > 0 else "negativeZ"
                        sc, tc, ma = (x if z > 0 else -x), -y, abs(z)
                    self.assertEqual(target, face)
                    self.assertAlmostEqual(float(sc / ma), u)
                    self.assertAlmostEqual(float(-tc / ma), v)

    def test_shared_edges_and_black_space_survive_the_tonal_projection(self):
        source = np.zeros((16, 32, 3), dtype=np.uint8)
        density = np.zeros_like(source, dtype=np.float64)
        faces = {face: np.asarray(skybox.render_face(source, face, 32, density)) for face in skybox.FACES}
        skybox.verify_edges(faces, 32)
        for face in faces.values():
            self.assertFalse(np.any(face))


if __name__ == "__main__":
    unittest.main()
