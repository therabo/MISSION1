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
  await c.route("**/api/iss/orbit/samples", (r) =>
    r.fulfill({
      json: JSON.parse(fs.readFileSync(root + "real-samples.json")),
    }),
  );
  await c.route("**/api/iss/orbit/comparison", (r) =>
    r.fulfill({
      json: JSON.parse(fs.readFileSync(root + "real-comparison.json")),
    }),
  );
  await c.route("https://gibs.earthdata.nasa.gov/**", (r) =>
    r.fulfill({ status: 503 }),
  );
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4174/");
  await p.waitForFunction(() => globalThis.__qa?.model?.ready);
  await p.evaluate(() => {
    const q = globalThis.__qa,
      H = q.helpers,
      v = q.viewer;
    v.clock.shouldAnimate = false;
    v.clock.currentTime = H.JulianDate.fromIso8601(
      "2026-09-30T15:45:59.975908Z",
    );
  });
  await p.getByRole("button", { name: "Inspect ISS", exact: true }).click();
  for (let i = 0; i < 35; i++) {
    await p.evaluate(() => {
      const q = globalThis.__qa;
      q.viewer.clock.currentTime = q.helpers.JulianDate.addSeconds(
        q.viewer.clock.currentTime,
        0.3,
        new q.helpers.JulianDate(),
      );
    });
    await p.waitForTimeout(90);
    if (await p.evaluate(() => globalThis.__qa.mode === "ISS_INSPECTION"))
      break;
  }
  await p.waitForTimeout(2000);
  const rows = [];
  for (const enabled of [true, false]) {
    await p.evaluate((enabled) => {
      const q = globalThis.__qa;
      q.model.environmentMapManager.enabled = enabled;
      q.resets = 0;
      const original = q.model.resetDrawCommands;
      q.model.resetDrawCommands = function () {
        q.resets++;
        return original.apply(this, arguments);
      };
    }, enabled);
    for (let i = 0; i < 24; i++) {
      await p.evaluate((i) => {
        const q = globalThis.__qa,
          H = q.helpers,
          v = q.viewer;
        v.clock.currentTime = H.JulianDate.fromIso8601("2026-09-30T15:46:20Z");
        H.JulianDate.addSeconds(
          v.clock.currentTime,
          i * 0.18,
          v.clock.currentTime,
        );
        v.camera.lookAtTransform(
          v.camera.transform,
          new H.Cartesian3(
            -90 * Math.cos((42.5 * Math.PI) / 180),
            0,
            90 * Math.sin((42.5 * Math.PI) / 180),
          ),
        );
      }, i);
      await p.waitForTimeout(70);
      await p.screenshot({
        path: `${evidenceDir}/flicker-${enabled ? "dynamic" : "stable"}-${i}.png`,
      });
    }
    rows.push(
      await p.evaluate(
        (enabled) => ({
          enabled,
          resets: globalThis.__qa.resets,
          environmentEpsilon:
            globalThis.__qa.model.environmentMapManager.maximumPositionEpsilon,
        }),
        enabled,
      ),
    );
  }
  fs.writeFileSync(
    evidenceDir + "/flicker-probe.json",
    JSON.stringify(rows, null, 2),
  );
  console.log(rows);
  await b.close();
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
