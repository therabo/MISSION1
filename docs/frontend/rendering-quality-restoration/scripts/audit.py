"""QA-only matched-pose and unmodified screenshot audit; use bundled Python."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

evidence = Path(__file__).resolve().parents[1] / "evidence"
reports = []
rois = {
    "gp-canonical": (900, 420, 1250, 505),
    "oem-canonical": (900, 420, 1250, 505),
    "gp-oblique": (560, 395, 820, 520),
    "oem-oblique": (560, 395, 820, 520),
    "iss-thin-geometry": (550, 260, 1110, 650),
    "iss-oblique": (550, 250, 1110, 660),
    "night-cities": (500, 130, 1200, 650),
    "terminator": (500, 130, 1200, 650),
}


def delta(a, b):
    return max(abs(x - y) for x, y in zip(a, b))


def url(value):
    return value.split("/", 3)[3] if value.startswith("http://127.0.0.1:") else value


datasets = [(f"before-dpr{dpr}", f"after-dpr{dpr}", dpr)
            for dpr in ([int(value) for value in sys.argv[1:]] or (1, 2))]
if not sys.argv[1:] and (evidence / "after-dpr1-twilight/comparison.json").exists():
    datasets.append(("before-dpr1-twilight", "after-dpr1-twilight", 1))

for before_folder, after_folder, dpr in datasets:
    before = json.loads((evidence / before_folder / "comparison.json").read_text())
    after = json.loads((evidence / after_folder / "comparison.json").read_text())
    assert before["recordedRealFixture"] and after["recordedRealFixture"]
    assert before["browser"] == after["browser"]
    for data in (before, after):
        assert not data["errors"]
        assert not data["consoleErrors"]
        assert not data["requestFailures"]
    assert [r["name"] for r in before["rows"]] == [r["name"] for r in after["rows"]]
    for a, b in zip(before["rows"], after["rows"]):
        name, ga, gb = a["name"], a["geometry"], b["geometry"]
        assert ga["time"] == gb["time"], name
        errors = {}
        for key in ("position", "local", "direction", "up", "right"):
            errors[key] = delta(ga[key], gb[key])
            assert errors[key] < (.001 if key in ("position", "local") else 1e-8), (name, key, errors[key])
        errors["transformTranslation"] = delta(ga["transform"][12:15], gb["transform"][12:15])
        errors["transformBasis"] = delta(ga["transform"][:12], gb["transform"][:12])
        assert errors["transformTranslation"] < .001 and errors["transformBasis"] < 1e-8, name
        for key in ("nativeFovDegrees", "xOffset", "yOffset", "minimumPixelSize", "range", "near", "far"):
            assert abs(ga[key] - gb[key]) < (.001 if key == "range" else 1e-8), (name, key)
        for key in ("viewport", "canvas", "centroid", "layout"):
            assert ga[key] == gb[key], (name, key)
        assert ga["error"] < 2 and gb["error"] < 2
        aa, ab = a["graphics"], b["graphics"]
        for key in ("sceneMsaa", "fxaaEnabled", "hdr", "dpr", "canvasPixels", "resolutionScale"):
            assert aa[key] == ab[key], (name, key)
        assert aa["antialias"] is False and ab["antialias"] is True
        assert aa["defaultSamples"] == 0 and ab["defaultSamples"] == 4
        assert aa["controllerInputs"] is ab["controllerInputs"] is False
        assert aa["retainedFxaa"] == ab["retainedFxaa"] == {"enabled": True}
        assert aa["tileQueueSettled"] and ab["tileQueueSettled"]
        assert len(aa["layers"]) == len(ab["layers"]) == 4
        for i, (la, lb) in enumerate(zip(aa["layers"], ab["layers"])):
            la, lb = dict(la), dict(lb)
            la["url"], lb["url"] = url(la.get("url", "")), url(lb.get("url", ""))
            if i in (2, 3):
                assert la["brightness"] == 1.15 and lb["brightness"] == 1.8
                la["brightness"] = lb["brightness"]
                assert la["gamma"] == lb["gamma"] == la["contrast"] == lb["contrast"] == 1
            assert la == lb, (name, i)
        report = {"name": name, "dpr": dpr, "beforeFolder": before_folder, "afterFolder": after_folder,
                  "epoch": ga["time"], "poseMaxComponentDelta": errors}
        if a.get("timing") and b.get("timing"):
            report["performance"] = {"before": {k: a["timing"][k] for k in ("count", "medianMs", "p95Ms", "p99Ms", "medianFps", "onePercentLowFps")},
                                     "after": {k: b["timing"][k] for k in ("count", "medianMs", "p95Ms", "p99Ms", "medianFps", "onePercentLowFps")}}
            report["performance"]["medianDeltaMs"] = b["timing"]["medianMs"] - a["timing"]["medianMs"]
            report["performance"]["medianDeltaPercent"] = (b["timing"]["medianMs"] / a["timing"]["medianMs"] - 1) * 100
        if name in rois:
            box = tuple(n * dpr for n in rois[name])
            images = [np.asarray(Image.open(evidence / folder / f"{name}.png").convert("RGB").crop(box)).astype(np.int16)
                      for folder in (before_folder, after_folder)]
            diff = np.abs(images[0] - images[1])
            report["unmodifiedScreenshotRoi"] = {"cssBox": rois[name], "pixels": int(diff.shape[0] * diff.shape[1]),
                                               "changedPixels": int(np.count_nonzero(np.any(diff, axis=2))),
                                               "maxChannelDelta": int(diff.max()), "meanChannelDelta": float(diff.mean())}
            if name in ("gp-oblique", "oem-oblique"):
                # Color-selected diagnostic includes the unchanged line and halo
                # against space. This is a pixel heuristic, not an object-ID mask.
                def trajectory_mask(rgb):
                    red, green, blue = (rgb[:, :, i] for i in range(3))
                    if name.startswith("gp"):
                        return (green > 5) & (green > red * 1.5) & (blue > red * 1.5)
                    return (red > 5) & (red > green * 1.1) & (green > blue * 1.4)
                mask = trajectory_mask(images[0]) | trajectory_mask(images[1])
                selected = diff[mask]
                report["trajectoryColorMask"] = {"heuristic": "cyan/gold including low-intensity halo, union of both source screenshots",
                                                  "pixels": int(mask.sum()), "changedPixels": int(np.count_nonzero(np.any(selected, axis=1))),
                                                  "maxChannelDelta": int(selected.max()), "meanChannelDelta": float(selected.mean())}
        reports.append(report)

result = {"method": "Exact source screenshots, no alignment/resampling/retouching; pose gate 1mm and basis gate 1e-8. Pixel differences include the intentional night brightness change and tile-loading variation.", "pairs": reports}
(evidence / "matched-audit.json").write_text(json.dumps(result, indent=2) + "\n")
for row in reports:
    if "performance" in row:
        p = row["performance"]
        print(row["name"], "DPR", row["dpr"], f'{p["before"]["medianMs"]:.2f} -> {p["after"]["medianMs"]:.2f} ms', f'{p["before"]["medianFps"]:.2f} -> {p["after"]["medianFps"]:.2f} FPS', f'{p["medianDeltaPercent"]:+.1f}%')
print("Matched pose/source/quality gates PASS:", len(reports), "pairs")
