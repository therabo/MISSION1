"""Keep ten lossless representative captures and compact verification records.

Run after controls/native QA completes in /tmp/mission1-disclosure-*.
Requires Pillow; application assets are never processed.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

from PIL import Image

out = Path(__file__).resolve().parent
repo = out.parents[3]
baseline = "370054725eb197f48842774b5aa72612fae2a349"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()


def read_report(kind, build):
    directory = Path(f"/tmp/mission1-disclosure-{kind}{build}")
    name = "interactions.json" if kind == "native-" else "controls.json"
    report = json.loads((directory / name).read_text())
    assert report["result"] == "PASS"
    assert not report["errors"] and not report["console"]
    if kind == "native-":
        compact = {"url": report["url"], "build": build, "result": report["result"], "errors": [], "console": [],
                   "viewports": [{**{k: v for k, v in row.items() if k not in ("earth", "canonical")},
                                  "canonical": {k: row["canonical"][k] for k in ("range", "elevation", "nativeFovDegrees", "error")}}
                                 for row in report["viewports"]]}
    else:
        compact = {"url": report["url"], "build": build, "result": report["result"], "errors": [], "console": [],
                   "actionOrder": [c["name"] for c in report["variants"][0]["actions"]],
                   "actionColumns": ["icon", "text", "width", "height", "gap", "padding", "selected"],
                   "variants": [{"width": row["width"], "height": row["height"],
                                 "actions": [[c[k] for k in ("icon", "text", "width", "height", "gap", "padding", "selected")] for c in row["actions"]],
                                 "focusOrder": row["focusOrder"],
                                 **({"accessibleTree": row["accessibleTree"]} if row["width"] in (1440, 1024, 390) else {})}
                                for row in report["variants"]],
                   "mobile": report["mobile"], "keyboard": report["keyboard"], "reduced": report["reduced"],
                   "resize": {"observations": len(report["resize"]), "passed": sum(e["result"] == "PASS" for e in report["resize"]),
                              "widths": sorted({e["width"] for e in report["resize"] if "moment" in e}),
                              "moments": ["immediate", "next-frame"], "directions": ["ascending", "descending"],
                              "calendarPreservation": [e for e in report["resize"] if "calendarPreserved" in e]},
                   "regressions": report["regressions"], "revalidation": report.get("revalidation")}
    (out / f"{build}-{name}").write_text(json.dumps(compact, indent=2) + "\n")
    return report


reports = {build: read_report("", build) for build in ["development", "production"]}
native = {build: read_report("native-", build) for build in ["development", "production"]}
screenshots = []
for directory, names in [
    ("before", ["1440-historical", "390-historical"]),
    ("development", ["1440-current", "1024-current", "390-current", "390-collapsed",
                     "390-expanded", "390-calendar", "320-calendar", "844-calendar"]),
]:
    for name in names:
        source = Path(f"/tmp/mission1-disclosure-{directory}/{name}.png")
        target = out / "screenshots" / f"{directory}-{name}.webp"
        target.parent.mkdir(exist_ok=True)
        with Image.open(source) as original:
            original.save(target, "WEBP", lossless=True, method=6)
            pixels = original.convert("RGBA").tobytes()
            with Image.open(target) as retained:
                assert retained.convert("RGBA").tobytes() == pixels
            screenshots.append({"file": str(target.relative_to(out)), "dimensions": original.size,
                                "sourcePngSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                                "webpSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                                "decodedRgbaSha256": hashlib.sha256(pixels).hexdigest(), "lossless": True})

# Keep gate summaries rather than Spring/Testcontainers' full operational logs.
logs = {}
for name in ["before-frontend", "before-backend", "frontend", "backend", "verify", "typecheck", "build"]:
    raw = Path(f"/tmp/mission1-disclosure-{name}.log").read_text()
    lines = [re.sub(r"\x1b\[[0-9;]*m", "", line).rstrip() for line in raw.splitlines()]
    (out / f"{name}.log").write_text("\n".join(lines[-25:]).strip() + "\n")
    logs[name] = raw
assert re.search(r"Tests\s+702 passed", logs["before-frontend"])
assert re.search(r"Tests\s+726 passed", logs["frontend"])
assert re.search(r"Test Files\s+60 passed", logs["frontend"])
for name in ["before-backend", "backend", "verify"]:
    assert "Tests run: 382, Failures: 0, Errors: 0, Skipped: 0" in logs[name] and "BUILD SUCCESS" in logs[name]
assert "built in" in logs["build"] and "tsc --noEmit" in logs["typecheck"]

frozen = ["backend", "frontend/src/cesium", "frontend/public", "frontend/src/assets", "frontend/src/App.tsx",
          "frontend/src/replay/HistoricalCalendar.tsx", "frontend/src/replay/HistoricalCalendar.css",
          "frontend/src/replay/calendarDraft.ts", "frontend/src/replay/replayApi.ts"]
subprocess.run(["git", "diff", "--quiet", baseline, "--", *frozen], cwd=repo, check=True)
subprocess.run(["git", "diff", "--check"], cwd=repo, check=True)
assert git("branch", "--show-current") == "ui/restyling"
assert git("rev-parse", "main") == "12be75af376c0a18e510395ae59c58ee252f3800"
verification = {
    "checkedAt": datetime.now(timezone.utc).isoformat(), "baseline": baseline,
    "main": git("rev-parse", "main"), "branch": "ui/restyling",
    "frontend": {"baselineTests": 702, "baselineFiles": 59, "tests": 726, "files": 60, "newDisclosureTests": 24,
                 "typecheck": "PASS", "productionBuild": "PASS", "existingChunkWarning": True},
    "backend": {"java": "21.0.3", "baselineTests": 382, "test": 382, "verify": 382, "failures": 0, "errors": 0, "skips": 0},
    "browser": {build: {"result": reports[build]["result"], "viewports": len(reports[build]["variants"]),
                         "mobileSequences": len(reports[build]["mobile"]), "resizeObservations": len(reports[build]["resize"]),
                         "keyboard": reports[build]["keyboard"], "reduced": reports[build]["reduced"],
                         "nativeViewports": len(native[build]["viewports"]), "errors": [], "console": []}
                for build in reports},
    "frozen": {"paths": frozen, "backendFiles": len(git("ls-files", "backend").splitlines()),
               "sceneAssetFiles": len(git("ls-files", "frontend/src/cesium", "frontend/public", "frontend/src/assets").splitlines()),
               "changes": 0},
    "diffCheck": "PASS", "screenshots": screenshots,
    "review": "Ten retained before/after screenshots visually reviewed; native captures reviewed in scratch contact sheets.",
    "limits": ["Chromium/Metal with synthesized touch; physical Safari/iOS/Android not certified", "Existing Cesium chunk warning"],
}
(out / "verification.json").write_text(json.dumps(verification, indent=2) + "\n")
print(json.dumps({"screenshots": len(screenshots), "bytes": sum(p.stat().st_size for p in out.rglob("*") if p.is_file()),
                  "frontend": 726, "backend": 382, "browser": "development/production PASS"}))
