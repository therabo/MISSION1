#!/usr/bin/env python3
"""Read FBX 7400 model hierarchy/transform metadata without importing geometry.

Usage: python research-inspect-igoal-fbx.py model.fbx
The output is research metadata, not a complete FBX world-transform evaluation.
"""

import json
import struct
import sys


def inspect(path):
    data = open(path, "rb").read()
    if not data.startswith(b"Kaydara FBX Binary"):
        raise ValueError("Expected binary FBX")
    version = struct.unpack_from("<I", data, 23)[0]
    if version != 7400:
        raise ValueError(f"Unsupported FBX version {version}")
    models, connections, settings = {}, [], {}

    def prop(offset):
        kind = chr(data[offset]); offset += 1
        formats = {"Y": "h", "C": "?", "I": "i", "F": "f", "D": "d", "L": "q"}
        if kind in formats:
            fmt = "<" + formats[kind]
            return struct.unpack_from(fmt, data, offset)[0], offset + struct.calcsize(fmt)
        if kind in "SR":
            count = struct.unpack_from("<I", data, offset)[0]; offset += 4
            value = data[offset:offset + count]
            return (value.decode("utf-8", "replace") if kind == "S" else f"RAW:{count}"), offset + count
        if kind in "fdilbc":
            count, encoding, size = struct.unpack_from("<III", data, offset)
            return f"ARRAY:{kind}:{count}:{encoding}", offset + 12 + size
        raise ValueError((kind, offset))

    def walk(offset, model=None, in_settings=False, in_connections=False):
        end, count, prop_len, name_len = struct.unpack_from("<IIIB", data, offset)
        if not end:
            return offset + 13
        name = data[offset + 13:offset + 13 + name_len].decode("utf-8", "replace")
        value_offset = offset + 13 + name_len
        values = []
        for _ in range(count):
            value, value_offset = prop(value_offset)
            values.append(value)
        if name == "Model":
            model = values[0]
            models[model] = {"name": values[1].split("\x00")[0], "kind": values[2], "properties": {}}
        if name == "GlobalSettings":
            in_settings = True
        if name == "Connections":
            in_connections = True
        if name == "P" and len(values) >= 5:
            if model is not None:
                models[model]["properties"][values[0]] = values[4:]
            elif in_settings:
                settings[values[0]] = values[4:]
        if name == "C" and in_connections and len(values) >= 3:
            connections.append(values)
        cursor = offset + 13 + name_len + prop_len
        while cursor < end - 13:
            next_cursor = walk(cursor, model, in_settings, in_connections)
            if next_cursor <= cursor:
                break
            cursor = next_cursor
        return end

    cursor = 27
    while cursor < len(data) - 13:
        if data[cursor:cursor + 13] == bytes(13):
            break
        next_cursor = walk(cursor)
        if next_cursor <= cursor:
            break
        cursor = next_cursor
    parents = {link[1]: link[2] for link in connections if link[0] == "OO" and link[1] in models and link[2] in models}
    selected = ("SSREF", "MLM", "RSNode", "IROSA_Deployed_", "Zarya_FGB", "Zvezda_SM", "Node1", "USLab", "Columbus")
    out = {"version": version, "settings": {k: settings.get(k) for k in
           ("UpAxis", "UpAxisSign", "FrontAxis", "FrontAxisSign", "CoordAxis", "CoordAxisSign", "UnitScaleFactor", "OriginalUnitScaleFactor")},
           "models": []}
    for key, model in models.items():
        if not any(x in model["name"] for x in selected):
            continue
        props = model["properties"]
        out["models"].append({"name": model["name"], "parent": models[parents[key]]["name"] if key in parents else None,
                              "translation": props.get("Lcl Translation", [0, 0, 0]),
                              "rotation": props.get("Lcl Rotation", [0, 0, 0]),
                              "scaling": props.get("Lcl Scaling", [1, 1, 1]),
                              "preRotation": props.get("PreRotation"),
                              "postRotation": props.get("PostRotation"),
                              "rotationOrder": props.get("RotationOrder")})
    return out


if __name__ == "__main__":
    print(json.dumps(inspect(sys.argv[1]), indent=2))
