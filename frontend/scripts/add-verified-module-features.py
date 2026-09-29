#!/usr/bin/env python3
"""Add per-vertex feature IDs to verified NASA VTAD node meshes.

Run against the pinned lossless, deduplicated NASA GLB. All original buffer
ranges and glTF accessors are preserved; only metadata and a sampler policy
are added.
"""

import hashlib
import json
import struct
import sys
from pathlib import Path

BASE_SHA256 = "ce2548b56741ee764de7e1d593f1c50785a54150ebc500ed5424a4f5bdf8f657"
MANIFEST = Path(__file__).resolve().parents[1] / "src/cesium/issModelManifest.json"


def verified_modules() -> tuple[tuple[int, str, int, int], ...]:
    mappings = json.loads(MANIFEST.read_text())["semanticMappings"]
    modules = tuple(
        (item["nodeIndex"], item["nodeName"], item["featureId"], item["moduleCode"])
        for item in mappings if item["status"] == "VERIFIED"
    )
    if [item[2] for item in modules] != list(range(len(modules))):
        raise ValueError("Verified feature IDs must be contiguous and manifest-ordered")
    if [item[3] for item in modules] != list(range(1, len(modules) + 1)):
        raise ValueError("Verified module codes must be contiguous and manifest-ordered")
    return modules


def pad(data: bytes, alignment: int, fill: bytes) -> bytes:
    return data + fill * ((-len(data)) % alignment)


def transform(source: Path, destination: Path) -> None:
    modules = verified_modules()
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA256:
        raise ValueError("Input is not the pinned deduplicated NASA GLB")
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError("Expected glTF 2.0 GLB")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Missing JSON chunk")
    document = json.loads(raw[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_offset)
    if binary_type != 0x004E4942:
        raise ValueError("Missing BIN chunk")
    binary = bytearray(raw[binary_offset + 8:binary_offset + 8 + binary_length])
    if len(binary) != binary_length or len(raw) != binary_offset + 8 + binary_length:
        raise ValueError("Unexpected GLB chunk layout")
    if len(document["buffers"]) != 1:
        raise ValueError("Expected one embedded buffer")

    mesh_users: dict[int, list[int]] = {}
    for index, node in enumerate(document["nodes"]):
        if "mesh" in node:
            mesh_users.setdefault(node["mesh"], []).append(index)

    for node_index, expected_name, feature_id, _ in modules:
        node = document["nodes"][node_index]
        if node["name"] != expected_name or mesh_users[node["mesh"]] != [node_index]:
            raise ValueError(f"Ambiguous mesh ownership for node {node_index}")
        mesh = document["meshes"][node["mesh"]]
        for primitive in mesh["primitives"]:
            if "EXT_mesh_features" in primitive.get("extensions", {}):
                raise ValueError("Feature metadata already exists")
            count = document["accessors"][primitive["attributes"]["POSITION"]]["count"]
            binary.extend(b"\0" * ((-len(binary)) % 8))
            offset = len(binary)
            binary.extend(bytes((feature_id, 0, 0, 0)) * count)
            view_index = len(document["bufferViews"])
            document["bufferViews"].append({
                "buffer": 0, "byteOffset": offset, "byteLength": 4 * count,
                "byteStride": 4, "target": 34962,
            })
            accessor_index = len(document["accessors"])
            document["accessors"].append({
                "bufferView": view_index, "componentType": 5121, "count": count,
                "type": "SCALAR", "min": [feature_id], "max": [feature_id],
            })
            primitive["attributes"]["_FEATURE_ID_0"] = accessor_index
            primitive.setdefault("extensions", {})["EXT_mesh_features"] = {
                "featureIds": [{"featureCount": len(modules), "attribute": 0,
                                "propertyTable": 0, "label": "missionModule"}]
            }

    binary.extend(b"\0" * ((-len(binary)) % 8))
    codes_offset = len(binary)
    binary.extend(bytes(module[3] for module in modules))
    codes_view = len(document["bufferViews"])
    document["bufferViews"].append({
        "buffer": 0, "byteOffset": codes_offset, "byteLength": len(modules)
    })
    # Source images are power-of-two PNGs. Explicit trilinear minification
    # requires Cesium/WebGL to generate mipmaps for stable distant detail.
    # Linear magnification retains full 1024px/512px source detail up close.
    document["samplers"] = [{"magFilter": 9729, "minFilter": 9987,
                              "wrapS": 10497, "wrapT": 10497}]
    for texture in document["textures"]:
        texture["sampler"] = 0
    document.setdefault("extensionsUsed", []).extend(("EXT_mesh_features", "EXT_structural_metadata"))
    document.setdefault("extensions", {})["EXT_structural_metadata"] = {
        "schema": {
            "id": "mission1VerifiedIssModules",
            "classes": {"missionModule": {"properties": {
                "moduleCode": {"type": "SCALAR", "componentType": "UINT8", "required": True}
            }}},
        },
        "propertyTables": [{
            "class": "missionModule", "count": len(modules),
            "properties": {"moduleCode": {"values": codes_view}},
        }],
    }
    document["buffers"][0]["byteLength"] = len(binary)
    json_chunk = pad(json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode(), 4, b" ")
    binary_chunk = pad(bytes(binary), 4, b"\0")
    output = (struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_chunk) + 8 + len(binary_chunk))
              + struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
              + struct.pack("<I4s", len(binary_chunk), b"BIN\0") + binary_chunk)
    destination.write_bytes(output)
    print(f"{destination}: {len(output)} bytes SHA-256 {hashlib.sha256(output).hexdigest()}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: add-verified-module-features.py BASE.glb OUTPUT.glb")
    transform(Path(sys.argv[1]), Path(sys.argv[2]))
