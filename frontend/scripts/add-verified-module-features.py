#!/usr/bin/env python3
"""Add per-vertex feature IDs to three uniquely named NASA VTAD node meshes.

Run against the phase-0 WebP GLB, not the 44 MB NASA source. All original
buffer ranges and glTF accessors are preserved; only metadata is appended.
"""

import hashlib
import json
import struct
import sys
from pathlib import Path

BASE_SHA256 = "e5ad5beb2f1ea4364c964f316a072775d8f9d4c4bfed126932aa07a85f438360"
MODULES = (
    (97, "09 Destiny Space Laboratory", 0, 1),
    (84, "27 Columbus Space Laboratory", 1, 2),
    (95, "26 Harmony Node 2", 2, 3),
)


def pad(data: bytes, alignment: int, fill: bytes) -> bytes:
    return data + fill * ((-len(data)) % alignment)


def transform(source: Path, destination: Path) -> None:
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA256:
        raise ValueError("Input is not the pinned phase-0 WebP GLB")
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

    for node_index, expected_name, feature_id, _ in MODULES:
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
                "featureIds": [{"featureCount": 3, "attribute": 0,
                                "propertyTable": 0, "label": "missionModule"}]
            }

    binary.extend(b"\0" * ((-len(binary)) % 8))
    codes_offset = len(binary)
    binary.extend(bytes(module[3] for module in MODULES))
    codes_view = len(document["bufferViews"])
    document["bufferViews"].append({
        "buffer": 0, "byteOffset": codes_offset, "byteLength": len(MODULES)
    })
    document["extensionsUsed"].extend(("EXT_mesh_features", "EXT_structural_metadata"))
    document.setdefault("extensions", {})["EXT_structural_metadata"] = {
        "schema": {
            "id": "mission1VerifiedIssModules",
            "classes": {"missionModule": {"properties": {
                "moduleCode": {"type": "SCALAR", "componentType": "UINT8", "required": True}
            }}},
        },
        "propertyTables": [{
            "class": "missionModule", "count": len(MODULES),
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
