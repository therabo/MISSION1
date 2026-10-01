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
const fs = require("fs"),
  dir = evidenceDir;
(async () => {
  const b = (activeBrowser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  }));
  try {
    const c = await b.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    let phase = 0;
    for (const api of ["samples", "comparison"])
      await c.route("**/api/iss/orbit/" + api, (r) =>
        r.fulfill({
          json: JSON.parse(
            fs.readFileSync(
              `${repoRoot}/docs/frontend/inspection-orientation-review/phase-${phase}-${api}.json`,
            ),
          ),
        }),
      );
    await c.route("https://gibs.earthdata.nasa.gov/**", (r) =>
      r.fulfill({ status: 503 }),
    );
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
        errors.push(m.text());
    });
    const reports = [];
    for (phase = 0; phase < 2; phase++) {
      await p.goto("http://127.0.0.1:4173/");
      await p.waitForFunction(() => globalThis.__qa?.model?.ready);
      await p.waitForTimeout(5000);
      await p.evaluate(() => {
        const q = globalThis.__qa,
          H = q.helpers;
        q.viewer.clock.shouldAnimate = false;
        q.viewer.clock.currentTime = H.JulianDate.addSeconds(
          q.viewer.clock.currentTime,
          0.3,
          new H.JulianDate(),
        );
      });
      for (const source of ["PRIMARY_GP_TLE", "NASA_OEM"]) {
        await p
          .getByRole("button", {
            name: source === "NASA_OEM" ? "NASA OEM" : "MISSION1 GP/TLE",
            exact: true,
          })
          .click();
        await p
          .getByRole("button", { name: "Inspect ISS", exact: true })
          .click();
        await p.waitForFunction(
          () => globalThis.__qa.mode === "ISS_INSPECTION",
        );
        await p.waitForTimeout(2500);
        const pose = await p.evaluate(() => {
          const q = globalThis.__qa,
            H = q.helpers;
          return {
            source: q.source,
            utc: H.JulianDate.toIso8601(q.viewer.clock.currentTime),
            fxaa: !q.viewer.scene.msaaSupported || q.mode !== "EARTH_OVERVIEW",
            culling: q.model.backFaceCulling,
          };
        });
        reports.push({ phase, ...pose });
        if (phase === 0 && source === "PRIMARY_GP_TLE")
          for (const range of [95, 90, 85]) {
            await p.evaluate((range) => {
              const q = globalThis.__qa,
                H = q.helpers,
                t = (42.5 * Math.PI) / 180;
              q.viewer.camera.lookAtTransform(
                q.viewer.camera.transform,
                new H.Cartesian3(-range * Math.cos(t), 0, range * Math.sin(t)),
              );
            }, range);
            await p.waitForTimeout(500);
            await p.screenshot({ path: `${dir}/occupancy-${range}-model.png` });
            await p.evaluate(() => {
              const q = globalThis.__qa;
              q.hide = q.viewer.clock.onTick.addEventListener(
                () => (q.model.show = false),
              );
            });
            await p.waitForTimeout(400);
            await p.screenshot({
              path: `${dir}/occupancy-${range}-background.png`,
            });
            await p.evaluate(() => globalThis.__qa.hide());
            await p.waitForTimeout(400);
          }
        await p.evaluate(() => {
          const q = globalThis.__qa,
            H = q.helpers,
            t = (42.5 * Math.PI) / 180;
          q.viewer.camera.lookAtTransform(
            q.viewer.camera.transform,
            new H.Cartesian3(-90 * Math.cos(t), 0, 90 * Math.sin(t)),
          );
        });
        await p.waitForTimeout(500);
        for (let i = 0; i < 2; i++)
          await p.screenshot({
            path: `${dir}/static-${phase}-${source}-${i}.png`,
          });
        for (const enabled of [false, true]) {
          await p.evaluate((enabled) => {
            const q = globalThis.__qa;
            if (q.outlineOverride) q.outlineOverride();
            q.outlineOverride = q.viewer.clock.onTick.addEventListener(() => {
              q.model.silhouetteSize = enabled ? 0.5 : 1e-6;
              q.model.silhouetteColor.alpha = enabled ? 0.12 : 1e-12;
              q.model.backFaceCulling = true;
            });
          }, enabled);
          for (let i = 0; i < 16; i++) {
            await p.evaluate((i) => {
              const q = globalThis.__qa,
                H = q.helpers,
                t = ((42.5 + i * 0.015) * Math.PI) / 180;
              q.viewer.camera.lookAtTransform(
                q.viewer.camera.transform,
                new H.Cartesian3(-90 * Math.cos(t), 0, 90 * Math.sin(t)),
              );
            }, i);
            await p.waitForTimeout(70);
            await p.screenshot({
              path: `${dir}/outline-${phase}-${source}-${enabled ? "on" : "off"}-${i}.png`,
            });
          }
          await p.evaluate(() => globalThis.__qa.outlineOverride());
        }
        await p
          .getByRole("button", { name: "Back to Earth View", exact: true })
          .click();
        await p.waitForFunction(
          () => globalThis.__qa.mode === "EARTH_OVERVIEW",
        );
      }
    }
    fs.writeFileSync(
      `${dir}/occupancy-silhouette.json`,
      JSON.stringify({ reports, errors }, null, 2),
    );
    console.log({ reports, errors });
    if (errors.length) throw Error("Browser errors");
  } finally {
    await b.close();
  }
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
