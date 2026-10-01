// Diagnostic-only: run against an instrumented temporary checkout, never a production build.
const repoRoot =
  process.env.MISSION1_REPO_ROOT ||
  require("path").resolve(__dirname, "../../../..");
const evidenceDir =
  process.env.MISSION1_EVIDENCE_DIR || "/tmp/mission1-rendering-evidence";
require("fs").mkdirSync(evidenceDir, { recursive: true });
const { chromium } = require(
  process.env.MISSION1_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  });
  try {
    const c = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    const root = repoRoot + "/docs/frontend/inspection-orientation-review/";
    for (const [api, file] of [
      ["samples", "real-samples.json"],
      ["comparison", "real-comparison.json"],
    ])
      await c.route("**/api/iss/orbit/" + api, (r) =>
        r.fulfill({ json: JSON.parse(fs.readFileSync(root + file)) }),
      );
    await c.route("https://gibs.earthdata.nasa.gov/**", (r) =>
      r.fulfill({ status: 503 }),
    );
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto("http://127.0.0.1:4173");
    await p.waitForFunction(() => globalThis.__qa?.model?.ready);
    await p.waitForTimeout(5000);
    await p.evaluate(() => {
      const q = globalThis.__qa,
        H = q.helpers;
      q.viewer.clock.shouldAnimate = false;
      q.viewer.clock.currentTime = H.JulianDate.fromIso8601(
        "2026-09-30T15:45:59.975908Z",
      );
      q.aa = Array.from(
        { length: q.viewer.scene.postProcessStages.length },
        (_, i) => q.viewer.scene.postProcessStages.get(i),
      ).find((s) => s.name === "mission1_inspection_antialiasing");
      if (!q.aa) throw Error("Missing AA stage");
      q.frames = [];
      q.capture = false;
      q.viewer.scene.postRender.addEventListener(() => {
        if (q.capture) q.frames.push(performance.now());
      });
    });
    const rows = [];
    for (const mode of ["EARTH_OVERVIEW", "ISS_INSPECTION"]) {
      if (mode === "ISS_INSPECTION") {
        await p
          .getByRole("button", { name: "Inspect ISS", exact: true })
          .click();
        await p.waitForFunction(
          () => globalThis.__qa.mode === "ISS_INSPECTION",
        );
      }
      for (const enabled of [true, false, false, true, true, false]) {
        await p.evaluate(
          (enabled) => (globalThis.__qa.aa.enabled = enabled),
          enabled,
        );
        await p.waitForTimeout(1500);
        await p.evaluate(() => {
          const q = globalThis.__qa;
          q.frames = [];
          q.capture = true;
        });
        await p.waitForTimeout(3500);
        const frames = await p.evaluate(() => {
          const q = globalThis.__qa;
          q.capture = false;
          return q.frames;
        });
        const intervals = frames
          .slice(1)
          .map((x, i) => x - frames[i])
          .sort((a, b) => a - b);
        rows.push({
          mode,
          enabled,
          frames: frames.length,
          p50: intervals[Math.floor((intervals.length - 1) * 0.5)],
          p95: intervals[Math.floor((intervals.length - 1) * 0.95)],
          worst: intervals.at(-1),
        });
      }
    }
    fs.writeFileSync(
      evidenceDir + "/aa-stage-cost.json",
      JSON.stringify({ rows, errors }, null, 2),
    );
    console.log({ rows, errors });
    if (errors.length) throw Error("Browser errors");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
