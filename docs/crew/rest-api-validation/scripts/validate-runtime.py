"""Read-only local evidence; start the backend with the documented scheduler overrides."""
import datetime
import json
import statistics
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "docs/crew/rest-api-validation"
BASE_URL = "http://127.0.0.1:8080"


def database_read(sql):
    return subprocess.check_output(
        ["docker", "exec", "mission1-postgres-1", "psql", "-U", "mission1",
         "-d", "mission1", "-At", "-c", sql], text=True,
    ).strip()


def snapshot():
    tables = database_read(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename LIKE 'crew_%' ORDER BY tablename"
    ).splitlines()
    return {
        table: database_read(
            "SELECT count(*)::text || ':' || "
            "md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' "
            "ORDER BY to_jsonb(t)::text),'')) FROM " + table + " t"
        )
        for table in tables
    }


def get(path):
    try:
        response = urllib.request.urlopen(BASE_URL + path, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, dict(response.headers), json.loads(response.read())


def main():
    report = {
        "startedUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        # Operator precondition, not automatic detection of the backend environment.
        "schedulerOverrides": {"LL2": False, "NASA": False, "CelesTrak": False},
        "before": snapshot(), "http": [], "performance": [],
    }
    status, _, crew = get("/api/iss/crew")
    assert status == 200, (status, crew)
    known = next(m["id"] for m in crew["members"] if m["assignment"] is not None)
    examples = [
        ("crew", "/api/iss/crew"), ("expedition", "/api/iss/expedition/current"),
        ("person", "/api/iss/crew/" + known),
        ("unknown-person", "/api/iss/crew/" + str(uuid.uuid4())),
        ("malformed-person", "/api/iss/crew/not-a-uuid"),
    ]
    for name, path in examples:
        status, headers, data = get(path)
        report["http"].append({
            "path": path, "status": status,
            "contentType": headers.get("Content-Type"),
            "cacheControl": headers.get("Cache-Control"),
        })
        (OUTPUT / (name + "-response.json")).write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        )
        expected = {"unknown-person": 404, "malformed-person": 400}.get(name, 200)
        assert status == expected, (path, status)

    for path in ["/api/iss/crew", "/api/iss/expedition/current", "/api/iss/crew/" + known]:
        for _ in range(10):
            assert get(path)[0] == 200
        samples = []
        for _ in range(50):
            started = time.perf_counter()
            status, _, _ = get(path)
            samples.append((time.perf_counter() - started) * 1000)
            assert status == 200
        ordered = sorted(samples)
        report["performance"].append({
            "path": path, "warmup": 10, "samples": 50,
            "medianMs": statistics.median(samples), "p95Ms": ordered[47],
            "worstMs": max(samples), "rawMs": samples,
        })

    report["after"] = snapshot()
    report["crewTablesUnchanged"] = report["before"] == report["after"]
    assert report["crewTablesUnchanged"]
    report.update({
        "observedCounts": crew["counts"], "members": len(crew["members"]),
        "status": crew["reconciliation"]["status"],
        "evaluatedAt": crew["reconciliation"]["evaluatedAt"], "orbitalSmoke": [],
    })
    # Orbital comparison retains its independent existing behavior; Crew hashes precede these reads.
    for path in ["/api/iss/state", "/api/iss/orbit/samples", "/api/iss/orbit/comparison"]:
        status, _, data = get(path)
        assert status == 200, (path, status, data)
        report["orbitalSmoke"].append({
            "path": path, "status": status, "topLevelFields": list(data),
        })
    report["completedUtc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (OUTPUT / "runtime-smoke.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps({
        key: value for key, value in report.items() if key not in ["before", "after"]
    }, indent=2))


if __name__ == "__main__":
    main()
