// Diagnostic-only: run against an instrumented temporary checkout, never a production build.
const repoRoot =
  process.env.MISSION1_REPO_ROOT ||
  require("path").resolve(__dirname, "../../../..");
const evidenceDir =
  process.env.MISSION1_EVIDENCE_DIR || "/tmp/mission1-rendering-evidence";
require("fs").mkdirSync(evidenceDir, { recursive: true });
let activeBrowser;
const { chromium } = require(
  process.env.MISSION1_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("fs");
(async () => {
  const b = (activeBrowser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  }));
  const c = await b.newContext({
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
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4173");
  await p.waitForFunction(() => globalThis.__qa?.model?.ready);
  await p.evaluate(() => {
    const q = globalThis.__qa,
      H = q.helpers;
    q.viewer.clock.shouldAnimate = false;
    q.viewer.clock.currentTime = H.JulianDate.fromIso8601(
      "2026-09-30T15:45:59.975908Z",
    );
    q.shader = q.model.customShader;
  });
  await p.getByRole("button", { name: "Inspect ISS", exact: true }).click();
  await p.waitForFunction(() => globalThis.__qa.mode === "ISS_INSPECTION");
  await p.waitForTimeout(2000);
  const results = [];
  for (const [shader, fxaa] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    await p.evaluate(
      ({ shader, fxaa }) => {
        const q = globalThis.__qa;
        q.model.customShader = shader ? q.shader : undefined;
        Array.from(
          { length: q.viewer.scene.postProcessStages.length },
          (_, i) => q.viewer.scene.postProcessStages.get(i),
        ).find((s) => s.name === "mission1_inspection_antialiasing").enabled =
          fxaa;
      },
      { shader, fxaa },
    );
    await p.waitForTimeout(2000);
    await p.evaluate(() => {
      const q = globalThis.__qa;
      q.frames = [];
      q.capture = true;
      if (!q.removeCapture)
        q.removeCapture = q.viewer.scene.postRender.addEventListener(() => {
          if (q.capture) q.frames.push(performance.now());
        });
    });
    await p.waitForTimeout(4000);
    const times = await p.evaluate(() => {
      const q = globalThis.__qa;
      q.capture = false;
      return q.frames;
    });
    const intervals = times
      .slice(1)
      .map((x, i) => x - times[i])
      .sort((a, b) => a - b);
    results.push({
      shader,
      fxaa,
      frames: times.length,
      p50: intervals[Math.floor(intervals.length * 0.5)],
      p95: intervals[Math.floor(intervals.length * 0.95)],
      worst: intervals.at(-1),
    });
    if (shader && fxaa)
      for (let i = 0; i < 16; i++) {
        await p.evaluate((i) => {
          const q = globalThis.__qa,
            H = q.helpers;
          const theta = ((42.5 + i * 0.015) * Math.PI) / 180;
          q.viewer.camera.lookAtTransform(
            q.viewer.camera.transform,
            new H.Cartesian3(-90 * Math.cos(theta), 0, 90 * Math.sin(theta)),
          );
        }, i);
        await p.waitForTimeout(70);
        await p.screenshot({ path: `${evidenceDir}/material-final-${i}.png` });
      }
  }
  fs.writeFileSync(
    evidenceDir + "/quality-cost.json",
    JSON.stringify(results, null, 2),
  );
  console.log(results);
  await b.close();
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
