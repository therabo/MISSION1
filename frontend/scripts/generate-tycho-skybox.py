#!/usr/bin/env python3
"""Convert NASA SVS Tycho II plate-carree sky imagery into Cesium cube faces.

Usage: python3 generate-tycho-skybox.py NASA_TYCHO.tif OUTPUT_DIRECTORY [FACE_SIZE] [MANIFEST.json]
Requires Pillow and NumPy. The downloaded NASA source stays outside Git.
"""

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import PIL
from PIL import Image, ImageFilter

SOURCE_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003572/TychoSkymapII.t5_16384x08192.tif"
SOURCE_SHA256 = "2eb9baf5796c62bb04d8c87625b93356cd5ff4172bc56d6b731df554393de04f"
SOURCE_SIZE = (16384, 8192)
FACES = ("positiveX", "negativeX", "positiveY", "negativeY", "positiveZ", "negativeZ")
Image.MAX_IMAGE_PIXELS = SOURCE_SIZE[0] * SOURCE_SIZE[1]
PROCESSING = {
    "version": "milky-way-density-v1",
    "pointSpreadSourcePixels": 0.6,
    "pointShoulder": "255 * (1 - exp(-RGB / 220))",
    "densitySize": [2048, 1024],
    "densityGaussianSigmaPixels": 14,
    "densityBlackFloor": 1.5,
    "densityGain": 6.0,
    "composition": "screen(pointShoulder, densityAboveFloor); round only at final output",
    "meaning": "tonal visualization of the same catalogue star density; no added sky dataset or physical nebulosity",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def direction(face: str, u: np.ndarray, v: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    # v grows down the image. Cesium 1.145 CubeMap uploads DOM sources with
    # flipY=true; account for that here, not by changing the celestial matrix.
    if face == "positiveX": return np.ones_like(u), v, -u
    if face == "negativeX": return -np.ones_like(u), v, u
    if face == "positiveY": return u, np.ones_like(u), -v
    if face == "negativeY": return u, -np.ones_like(u), v
    if face == "positiveZ": return u, v, np.ones_like(u)
    if face == "negativeZ": return -u, v, -np.ones_like(u)
    raise ValueError(face)


def sample(source: np.ndarray, ra: np.ndarray, dec: np.ndarray, rows: int, size: int) -> np.ndarray:
    height, width, _ = source.shape
    sx = np.broadcast_to(((0.5 - ra / (2 * np.pi)) % 1.0) * width, (rows, size))
    sy = np.broadcast_to((0.5 - dec / np.pi) * (height - 1), (rows, size))
    x0 = np.floor(sx).astype(np.int32) % width
    x1 = (x0 + 1) % width
    y0 = np.floor(sy).astype(np.int32)
    y1 = np.minimum(y0 + 1, height - 1)
    fx = (sx - np.floor(sx))[..., None]
    fy = (sy - y0)[..., None]
    top = source[y0, x0] * (1 - fx) + source[y0, x1] * fx
    bottom = source[y1, x0] * (1 - fx) + source[y1, x1] * fx
    return top * (1 - fy) + bottom * fy


def density_field(image: Image.Image) -> np.ndarray:
    """Filter before cube projection, so every face shares one continuous field.

    Longitude wraps; latitude padding reflects across the pole with a half-turn
    in RA. This is a presentation density filter, not additional astronomy.
    Float filtering avoids quantizing the faint band into visible contour steps.
    """
    density = np.asarray(image.resize(tuple(PROCESSING["densitySize"]), Image.Resampling.BOX), dtype=np.float32)
    sigma = PROCESSING["densityGaussianSigmaPixels"]
    radius = 3 * sigma
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    density = sum(weight * np.roll(density, shift, axis=1) for shift, weight in zip(range(-radius, radius + 1), kernel))
    north = np.roll(density[1:radius + 1][::-1], density.shape[1] // 2, axis=1)
    south = np.roll(density[-radius - 1:-1][::-1], density.shape[1] // 2, axis=1)
    padded = np.concatenate([north, density, south])
    density = sum(weight * padded[radius + shift:radius + shift + density.shape[0]]
                  for shift, weight in zip(range(-radius, radius + 1), kernel))
    luminance = density.mean(axis=2, keepdims=True)
    return density * np.maximum(luminance - PROCESSING["densityBlackFloor"], 0) / np.maximum(luminance, 1e-6) * PROCESSING["densityGain"]


def render_face(source: np.ndarray, face: str, size: int, density: np.ndarray) -> Image.Image:
    output = np.empty((size, size, 3), dtype=np.uint8)
    # Edge pixels sample the same direction on adjoining cube faces. This
    # avoids a one-pixel seam caused by independently clamped face textures.
    unit = np.linspace(-1.0, 1.0, size, dtype=np.float64)
    u = unit[None, :]
    for row_start in range(0, size, 128):
        rows = min(128, size - row_start)
        v = unit[row_start:row_start + rows, None]
        dx, dy, dz = direction(face, u, v)
        ra = np.arctan2(dy, dx)
        dec = np.arctan2(dz, np.hypot(dx, dy))
        # The NASA plate-carree map has RA 0 at its center and RA increases
        # to the left. +X is RA 0, +Y is RA 90 deg, +Z is north celestial pole.
        points = 1 - np.exp(-sample(source, ra, dec, rows, size) / 220.0)
        band = sample(density, ra, dec, rows, size) / 255.0
        output[row_start:row_start + rows] = np.rint(255 * (points + band * (1 - points))).astype(np.uint8)
    return Image.fromarray(output, "RGB")


def verify_edges(images: dict[str, np.ndarray], size: int) -> None:
    """Every shared cube edge must sample identical pixels in either direction."""
    edges = []
    unit = np.linspace(-1, 1, size)
    for face in FACES:
        for side in ("top", "bottom", "left", "right"):
            if side == "top": u, v, pixels = unit, np.full(size, -1), images[face][0]
            elif side == "bottom": u, v, pixels = unit, np.full(size, 1), images[face][-1]
            elif side == "left": u, v, pixels = np.full(size, -1), unit, images[face][:, 0]
            else: u, v, pixels = np.full(size, 1), unit, images[face][:, -1]
            vectors = np.stack(direction(face, u, v), axis=1)
            endpoints = tuple(sorted(tuple(np.rint(point).astype(int)) for point in (vectors[0], vectors[-1])))
            edges.append((endpoints, vectors, pixels))
    pairs = 0
    for index, (endpoints, vectors, pixels) in enumerate(edges):
        for other_endpoints, other_vectors, other_pixels in edges[index + 1:]:
            if endpoints != other_endpoints:
                continue
            aligned = other_pixels if np.allclose(vectors[0], other_vectors[0]) else other_pixels[::-1]
            if not np.array_equal(pixels, aligned):
                raise ValueError("Cube face edge seam detected")
            pairs += 1
    if pairs != 12:
        raise ValueError(f"Expected 12 matched cube edges, found {pairs}")


def main(source_path: Path, destination: Path, size: int, manifest_path: Path) -> None:
    if size not in (2048, 4096):
        raise ValueError("Choose a 2048 or 4096 pixel cube face")
    if sha256(source_path) != SOURCE_SHA256:
        raise ValueError("NASA Tycho source SHA-256 does not match")
    image = Image.open(source_path)
    if image.size != SOURCE_SIZE:
        raise ValueError("Unexpected NASA Tycho dimensions")
    image = image.convert("RGB")
    density = density_field(image)
    source = np.asarray(image.filter(ImageFilter.GaussianBlur(PROCESSING["pointSpreadSourcePixels"])))
    image.close()
    destination.mkdir(parents=True, exist_ok=True)
    faces = {}
    rendered = {}
    for face in FACES:
        path = destination / f"tycho-{face}.webp"
        rendered[face] = np.asarray(render_face(source, face, size, density))
        pixels = Image.fromarray(rendered[face], "RGB")
        staging_path = path.with_name(f".{path.stem}.staging.webp")
        pixels.save(staging_path, lossless=True, quality=100, method=4)
        if not np.array_equal(np.asarray(Image.open(staging_path).convert("RGB")), rendered[face]):
            raise ValueError("Lossless WebP round trip changed source-derived pixels")
        staging_path.replace(path)
        faces[face] = {"url": f"/skybox/{path.name}", "sha256": sha256(path), "bytes": path.stat().st_size,
                       "rgbaSha256": hashlib.sha256(pixels.convert("RGBA").tobytes()).hexdigest()}
        print(face, faces[face])
    verify_edges(rendered, size)
    print("Cube edge verification: 12/12 identical shared edges")
    manifest = {
        "source": SOURCE_URL,
        "sourceSha256": SOURCE_SHA256,
        "sourceWidth": SOURCE_SIZE[0],
        "sourceHeight": SOURCE_SIZE[1],
        "sourceFormat": "TIFF RGB uint8",
        "sourceBytes": source_path.stat().st_size,
        "faceSize": size,
        "faceFormat": "WebP RGB uint8 lossless (VP8L)",
        "projection": "plate-carree celestial RA/Dec to TEME-axis cube directions",
        "uploadConvention": "Cesium 1.145 CubeMap DOM image flipY=true; image v grows down",
        "generatedDate": "2026-10-16",
        "credit": "NASA/Goddard Space Flight Center Scientific Visualization Studio",
        "reuseBasis": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "processing": PROCESSING,
        "generatorVersions": {"Pillow": PIL.__version__, "NumPy": np.__version__},
        "edgeVerification": "12/12 shared cube edges pixel-identical, including reversed orientation",
        "faces": faces,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4, 5):
        raise SystemExit("usage: generate-tycho-skybox.py SOURCE.tif OUTPUT_DIRECTORY [2048|4096] [MANIFEST.json]")
    output_dir = Path(sys.argv[2])
    manifest = Path(sys.argv[4]) if len(sys.argv) == 5 else output_dir / "skybox-manifest.json"
    main(Path(sys.argv[1]), output_dir, int(sys.argv[3]) if len(sys.argv) >= 4 else 4096, manifest)
