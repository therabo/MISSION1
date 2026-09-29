#!/usr/bin/env python3
"""Research-only, deterministic named-mesh registration of NASA VTAD and IGOAL GLBs.

Usage: python research-iss-geometry-registration.py VTAD.glb IGOAL.glb
Requires NumPy (install in an isolated research venv). Does not alter either asset.
The named 2024 NASA/JSC IGOAL GLB is required; the flattened Science GLB
cannot supply independently identifiable component meshes.
"""

import argparse
import hashlib
import json
import struct
from pathlib import Path

import numpy as np


# Explicit NASA asset names, checked against both GLB node tables. A direct mesh
# excludes model-configuration-dependent children and separately named details.
PAIRS = {
    "Unity": ("02 Unity Node 1", "Node1"),
    "Destiny": ("09 Destiny Space Laboratory", "USLab"),
    "Harmony": ("26 Harmony Node 2", "Node2"),
    "Tranquility": ("37 Tranquility Node 3", "Node3"),
    "Columbus": ("27 Columbus Space Laboratory", "Columbus"),
    "Kibo PM": ("30 Kibo Space Laboratory (PSM) Pressurized Module", "JEM_PM"),
    "Zarya": ("01 Zarya - (FGB) Funtional Cargo Block", "Zarya_FGB"),
    "Zvezda": ("05 Zvezda (SM) Service Module", "Zvezda_SM"),
    "Poisk": ("34 Poisk (MRM-2) Mini Research Module", "MRM2"),
    "Rassvet": ("39 Rassvet (MRM-1) Mini Research Module", "MRM1"),
    "Cupola": ("38 Cupola", "Cupola"),
}

FIT = ("Unity", "Destiny", "Harmony", "Columbus", "Zarya", "Zvezda", "Kibo PM")
HOLDOUT = tuple(name for name in PAIRS if name not in FIT)


class Glb:
    def __init__(self, path, decoded_dir=None):
        self.path = Path(path)
        self.decoded_dir = Path(decoded_dir) if decoded_dir else None
        data = self.path.read_bytes()
        if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
            raise ValueError(f"Not glTF 2 GLB: {path}")
        if struct.unpack_from("<I", data, 8)[0] != len(data):
            raise ValueError(f"GLB length mismatch: {path}")
        offset = 12
        chunks = {}
        while offset < len(data):
            size, kind = struct.unpack_from("<II", data, offset)
            offset += 8
            chunks[kind] = memoryview(data)[offset : offset + size]
            offset += size
        self.doc = json.loads(chunks[0x4E4F534A].tobytes())
        self.binary = chunks[0x004E4942]
        self.sha256 = hashlib.sha256(data).hexdigest()
        self.nodes = self.doc["nodes"]
        self.by_name = {n.get("name"): i for i, n in enumerate(self.nodes)}
        if len(self.by_name) != len(self.nodes):
            raise ValueError("Node names must be unique for this research")
        self.parent = {c: i for i, n in enumerate(self.nodes) for c in n.get("children", [])}
        self.world = {}
        scene = self.doc["scenes"][self.doc.get("scene", 0)]
        for root in scene["nodes"]:
            self._walk(root, np.eye(4))

    def _walk(self, index, parent):
        n = self.nodes[index]
        if "matrix" in n:
            local = np.asarray(n["matrix"], dtype=float).reshape((4, 4), order="F")
        else:
            local = np.eye(4)
            qx, qy, qz, qw = n.get("rotation", (0, 0, 0, 1))
            local[:3, :3] = np.array(
                [
                    [1 - 2 * (qy*qy + qz*qz), 2 * (qx*qy - qz*qw), 2 * (qx*qz + qy*qw)],
                    [2 * (qx*qy + qz*qw), 1 - 2 * (qx*qx + qz*qz), 2 * (qy*qz - qx*qw)],
                    [2 * (qx*qz - qy*qw), 2 * (qy*qz + qx*qw), 1 - 2 * (qx*qx + qy*qy)],
                ]
            ) @ np.diag(n.get("scale", (1, 1, 1)))
            local[:3, 3] = n.get("translation", (0, 0, 0))
        self.world[index] = parent @ local
        for child in n.get("children", []):
            self._walk(child, self.world[index])

    def accessor(self, index):
        a = self.doc["accessors"][index]
        if a["componentType"] != 5126 or a["type"] != "VEC3" or a.get("sparse"):
            raise ValueError(f"Unsupported POSITION accessor {index}: {a}")
        view = self.doc["bufferViews"][a["bufferView"]]
        start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = view.get("byteStride", 12)
        return np.ndarray((a["count"], 3), dtype="<f4", buffer=self.binary,
                          offset=start, strides=(stride, 4)).astype(float)

    def direct_mesh_points(self, name):
        i = self.by_name[name]
        n = self.nodes[i]
        decoded = self.decoded_dir / f"{i}.bin" if self.decoded_dir else None
        if decoded and decoded.exists():
            xyz = np.fromfile(decoded, dtype="<f4").reshape((-1, 3)).astype(float)
            return xyz @ self.world[i][:3, :3].T + self.world[i][:3, 3]
        points = []
        for primitive in self.doc["meshes"][n["mesh"]]["primitives"]:
            xyz = self.accessor(primitive["attributes"]["POSITION"])
            points.append(xyz @ self.world[i][:3, :3].T + self.world[i][:3, 3])
        return np.concatenate(points)


def metrics(points):
    bounds = np.array([points.min(axis=0), points.max(axis=0)])
    center = bounds.mean(axis=0)
    centered = points - points.mean(axis=0)
    _, vectors = np.linalg.eigh(centered.T @ centered / len(points))
    projected = points @ vectors
    extents = np.sort(projected.max(axis=0) - projected.min(axis=0))[::-1]
    return center, extents, bounds


def similarity(source, target, allow_reflection=False):
    """Least-squares Umeyama fit: target ~= scale * source @ R.T + t."""
    a = source - source.mean(axis=0)
    b = target - target.mean(axis=0)
    u, singular, vt = np.linalg.svd(b.T @ a / len(a))
    parity = np.ones(3)
    if not allow_reflection and np.linalg.det(u @ vt) < 0:
        parity[-1] = -1
    rotation = u @ np.diag(parity) @ vt
    scale = np.sum(singular * parity) / np.mean(np.sum(a*a, axis=1))
    translation = target.mean(axis=0) - scale * (rotation @ source.mean(axis=0))
    return scale, rotation, translation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vtad")
    parser.add_argument("igoal")
    parser.add_argument("--igoal-decoded-dir", required=True)
    parser.add_argument("--fixed-scale", type=float, help="Independent IGOAL-world to VTAD scale to test without fitting it")
    args = parser.parse_args()
    vtad, igoal = Glb(args.vtad), Glb(args.igoal, args.igoal_decoded_dir)
    rows = {}
    for name, (vname, iname) in PAIRS.items():
        vp, ip = vtad.direct_mesh_points(vname), igoal.direct_mesh_points(iname)
        vc, ve, vb = metrics(vp)
        ic, ie, ib = metrics(ip)
        rows[name] = {"vtad_node": vtad.by_name[vname], "igoal_node": igoal.by_name[iname],
                      "vtad_center": vc, "igoal_center": ic, "vtad_extents": ve,
                      "igoal_extents": ie, "axis_ratios": ve / ie,
                      "vtad_bounds": vb, "igoal_bounds": ib,
                      "vtad_vertices": len(vp), "igoal_vertices": len(ip),
                      "vtad_points": vp, "igoal_points": ip}
    print("SOURCES", json.dumps({"vtad_sha256": vtad.sha256, "igoal_sha256": igoal.sha256}))
    for name, row in rows.items():
        print("COMPONENT", name, "nodes", row["vtad_node"], row["igoal_node"],
              "centers", np.round(row["vtad_center"], 4), np.round(row["igoal_center"], 4),
              "extents", np.round(row["vtad_extents"], 4), np.round(row["igoal_extents"], 4),
              "ratios", np.round(row["axis_ratios"], 4),
              "vertices", row["vtad_vertices"], row["igoal_vertices"])
    lengths = np.array([rows[n]["axis_ratios"][0] for n in PAIRS])
    print("LONGEST_AXIS_SCALE", "mean", lengths.mean(), "median", np.median(lengths),
          "spread", lengths.max()-lengths.min(), "max_dev_median", np.max(abs(lengths-np.median(lengths))))
    src = np.array([rows[n]["igoal_center"] for n in FIT])
    dst = np.array([rows[n]["vtad_center"] for n in FIT])
    for allow_reflection in (False, True):
        fitted_scale, rotation, _ = similarity(src, dst, allow_reflection)
        scales = (("estimated", fitted_scale),)
        if args.fixed_scale is not None:
            scales += (("independent", args.fixed_scale),)
        for scale_type, scale in scales:
            translation = dst.mean(axis=0) - scale * (rotation @ src.mean(axis=0))
            print("FIT", scale_type, "allow_reflection", allow_reflection, "scale", scale,
                  "det_R", np.linalg.det(rotation), "R", np.round(rotation, 8).tolist(),
                  "T", np.round(translation, 8).tolist())
            for cohort in (FIT, HOLDOUT):
                errs = []
                for name in cohort:
                    row = rows[name]
                    error = np.linalg.norm(scale * rotation @ row["igoal_center"] + translation - row["vtad_center"])
                    errs.append(error)
                    print("RESIDUAL", scale_type, "fit" if cohort is FIT else "holdout", name, round(error, 5),
                          "normalized", round(error / row["vtad_extents"][0], 5))
                    if cohort is HOLDOUT:
                        transformed = scale * row["igoal_points"] @ rotation.T + translation
                        a = row["vtad_bounds"]
                        b = np.array([transformed.min(axis=0), transformed.max(axis=0)])
                        overlap = np.maximum(0, np.minimum(a[1], b[1]) - np.maximum(a[0], b[0]))
                        intersection = np.prod(overlap)
                        union = np.prod(a[1]-a[0]) + np.prod(b[1]-b[0]) - intersection
                        iou = intersection / union if union else 0
                        def major_axis(points):
                            centered = points - points.mean(axis=0)
                            values, vectors = np.linalg.eigh(centered.T @ centered / len(points))
                            return vectors[:, -1], values[-1] / values[-2]
                        va, vc = major_axis(row["vtad_points"])
                        ia, ic = major_axis(transformed)
                        angle = np.degrees(np.arccos(np.clip(abs(va @ ia), -1, 1))) if min(vc, ic) > 1.5 else None
                        print("HOLDOUT_VOLUME", scale_type, name, "aabb_iou", round(iou, 5),
                              "major_axis_degrees", round(angle, 3) if angle is not None else "AMBIGUOUS_SYMMETRY")
                print("SUMMARY", scale_type, "fit" if cohort is FIT else "holdout", "rms", round(np.sqrt(np.mean(np.square(errs))), 5),
                      "max", round(max(errs), 5))


if __name__ == "__main__":
    main()
