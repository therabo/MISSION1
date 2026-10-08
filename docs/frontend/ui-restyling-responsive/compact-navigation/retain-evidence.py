"""Retain summaries and ten lossless screenshots, not the scratch capture matrix.

Run with the bundled Python/Pillow after both browser runs complete:
  python retain-evidence.py /tmp/mission1-compact-before /tmp/mission1-compact-final-dev /tmp/mission1-compact-final-prod
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops

before, development, production = map(Path, sys.argv[1:4])
output = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda p: json.loads(p.read_text())
reports = {"before": read(before / "matrix.json"), "development": read(development / "matrix.json"), "production": read(production / "matrix.json")}

for build in ["development", "production"]:
    raw = reports[build]
    assert not raw["summary"]["failures"] and not raw["summary"]["continuityFailures"] and not raw["errors"]
    rows = []
    for state in raw["states"]:
        for e in state["entries"]:
            rows.append({"state": state["state"], "viewport": [e["width"], e["height"]], "result": e["result"],
                         "topHeight": e["areas"][".top-context-bar"]["height"],
                         "historicalBar": e["areas"].get(".historical-time-bar"), "failures": e["failures"]})
    summary = {"url": raw["url"], "states": len(raw["states"]), "captures": len(rows), "result": "PASS",
               "continuousResize": [{"state": s["state"], "widths": len(s["entries"]), "failures": []} for s in raw["continuity"]],
               "pageErrors": raw["errors"], "console": raw["console"], "externalRequestFailures": len(raw["externalFailures"]), "rows": rows}
    (output / f"{build}-matrix.json").write_text(json.dumps(summary, indent=2) + "\n")

def desktop_controls(entry):
    names = {"Earth", "ISS Inspection", "Orbital source", "Current", "Historical", "Crew", "Open Historical calendar", "Historical back 10 minutes", "Historical forward 10 minutes"}
    found = []
    for control in entry["controls"]:
        name = control["name"]
        if name.startswith("Historical UTC date"):
            name = "Historical UTC date"
        if name in names or name == "Historical UTC date":
            found.append({**control, "name": name})
    return found

fidelity = []
for build in ["development", "production"]:
    for state in reports["before"]["states"]:
        after_state = next(s for s in reports[build]["states"] if s["state"] == state["state"])
        for b in [e for e in state["entries"] if e["width"] >= 1244]:
            a = next(e for e in after_state["entries"] if e["width"] == b["width"] and e["height"] == b["height"])
            assert desktop_controls(a) == desktop_controls(b), (build, state["state"], b["width"], "controls")
            for selector in [".top-context-bar", ".historical-time-bar", "#historical-calendar"]:
                assert a["areas"].get(selector) == b["areas"].get(selector), (build, state["state"], b["width"], selector)
                assert a["styles"].get(selector) == b["styles"].get(selector)
            fidelity.append({"build": build, "state": state["state"], "viewport": [b["width"], b["height"]], "geometryAndStyles": "IDENTICAL"})

# Historical Inspection fixes the real scene at the same retained UTC. This
# comparison caught an inline label split's desktop shaping difference.
pixels = []
for build, folder in [("development", development), ("production", production)]:
    for width, height in [[1920,1080], [1600,900], [1440,900], [1280,720]]:
        name = f"{width}x{height}-historical-inspection.png"
        b = Image.open(before / name).convert("RGB").crop((0,0,width,64))
        a = Image.open(folder / name).convert("RGB").crop((0,0,width,64))
        difference = ImageChops.difference(b, a)
        values = list(difference.get_flattened_data())
        maximum = max(max(p) for p in values)
        # Production GPU compositing rounds the unchanged translucent surfaces
        # by at most one 8-bit channel value; it does not alter glyph geometry.
        assert maximum <= 1, (build, width, "desktop header pixels", maximum)
        pixels.append({"build": build, "viewport": [width,height], "state": "historical-inspection",
                       "changedHeaderPixels": sum(p != (0,0,0) for p in values), "maxChannelDelta": maximum})
(output / "desktop-fidelity.json").write_text(json.dumps({"geometryAndStyles": fidelity, "pixelChecks": pixels,
    "currentSceneNote": "Current UTC and translucent scene pixels naturally advance; whole live screenshots are not asserted byte-identical."}, indent=2) + "\n")

images = [(before, "1440x900-earth-gp.png", "before-desktop-current"), (before, "1440x900-historical.png", "before-desktop-historical"),
          (before, "320x568-historical.png", "before-mobile-historical"),
          (development, "1440x900-earth-gp.png", "after-desktop-current"), (development, "1440x900-historical.png", "after-desktop-historical"),
          (development, "320x568-historical.png", "after-mobile-historical"), (development, "320x568-historical-calendar.png", "after-mobile-calendar"),
          (development, "430x932-earth-gp.png", "after-mobile-current"), (development, "1024x768-historical.png", "after-tablet-historical"),
          (development, "844x390-historical.png", "after-landscape-historical")]
manifest = []
for folder, source, stem in images:
    original = folder / source
    destination = output / f"{stem}.webp"
    image = Image.open(original).convert("RGBA")
    image.save(destination, "WEBP", lossless=True, method=6)
    decoded = Image.open(destination).convert("RGBA")
    assert image.tobytes() == decoded.tobytes()
    manifest.append({"file": destination.name, "dimensions": image.size, "sourcePngSha256": sha(original.read_bytes()),
                     "webpSha256": sha(destination.read_bytes()), "decodedRgbaSha256": sha(image.tobytes()), "lossless": True})
(output / "screenshots.json").write_text(json.dumps(manifest, indent=2) + "\n")
# One observation per line keeps machine-readable matrices reviewable without
# thousands of lines of repeated JSON indentation.
for file in output.glob("*.json"):
    data = read(file)
    if isinstance(data, list):
        content = "[\n" + ",\n".join("  " + json.dumps(row) for row in data) + "\n]\n"
    else:
        fields = []
        for key, value in data.items():
            if isinstance(value, list):
                encoded = "[\n" + ",\n".join("    " + json.dumps(row) for row in value) + "\n  ]" if value else "[]"
            else:
                encoded = json.dumps(value)
            fields.append("  " + json.dumps(key) + ": " + encoded)
        content = "{\n" + ",\n".join(fields) + "\n}\n"
    assert json.loads(content) == data
    file.write_text(content)
print(f"Retained {len(images)} lossless screenshots; {len(fidelity)} desktop geometry/style comparisons and {len(pixels)} header pixel checks passed (maximum channel delta 1).")
