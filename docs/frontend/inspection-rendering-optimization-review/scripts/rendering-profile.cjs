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
const dir = evidenceDir,
  root = repoRoot,
  port = +process.argv[2] || 4174,
  label =
    port === 4174 ? "baseline" : port === 5173 ? "development" : "candidate";
const samples = JSON.parse(
    fs.readFileSync(
      root + "/docs/frontend/inspection-orientation-review/real-samples.json",
    ),
  ),
  comparison = JSON.parse(
    fs.readFileSync(
      root +
        "/docs/frontend/inspection-orientation-review/real-comparison.json",
    ),
  );
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    await context.route("**/api/iss/orbit/samples", (r) =>
      r.fulfill({ json: samples }),
    );
    await context.route("**/api/iss/orbit/comparison", (r) =>
      r.fulfill({ json: comparison }),
    );
    await context.route("https://gibs.earthdata.nasa.gov/**", (r) =>
      r.fulfill({ status: 503, body: "Controlled common imagery outage" }),
    );
    const page = await context.newPage(),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (/models|skybox/.test(r.url())) requests.push(r.url());
    });
    await page.goto(`http://127.0.0.1:${port}/?approachDiagnostics`);
    await page.waitForFunction(() => globalThis.__qa?.model?.ready, null, {
      timeout: 60000,
    });
    await page.evaluate(() => {
      const q = globalThis.__qa,
        H = q.helpers,
        v = q.viewer;
      v.clock.shouldAnimate = false;
      v.clock.currentTime = H.JulianDate.fromIso8601(
        "2026-09-30T15:45:59.975908Z",
      );
      q.longTasks = [];
      new PerformanceObserver((list) =>
        q.longTasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: "longtask", buffered: true });
      q.record = [];
      q.capture = false;
      v.scene.postRender.addEventListener(() => {
        if (!q.capture) return;
        const c = v.camera,
          H = q.helpers,
          p = q.positionAt(v.clock.currentTime, new H.Cartesian3());
        q.record.push({
          wall: performance.now(),
          mode: q.mode,
          utc: H.JulianDate.toIso8601(v.clock.currentTime),
          position: [c.positionWC.x, c.positionWC.y, c.positionWC.z],
          direction: [c.directionWC.x, c.directionWC.y, c.directionWC.z],
          up: [c.upWC.x, c.upWC.y, c.upWC.z],
          range: H.Cartesian3.distance(c.positionWC, p),
          fov: c.frustum.fov,
          near: c.frustum.near,
          far: c.frustum.far,
          lift: H.Cartesian3.distance(q.model.boundingSphere.center, p),
          silhouette: q.model.silhouetteSize,
          primitives: v.scene.primitives.length,
        });
      });
    });
    async function start(moving = false) {
      await page.evaluate((moving) => {
        const q = globalThis.__qa;
        q.record = [];
        q.capture = true;
        q.viewer.clock.shouldAnimate = moving;
      }, moving);
    }
    async function stop() {
      return page.evaluate(() => {
        const q = globalThis.__qa;
        q.capture = false;
        q.viewer.clock.shouldAnimate = false;
        return q.record;
      });
    }
    async function initial() {
      await page.evaluate(() => {
        const q = globalThis.__qa,
          H = q.helpers,
          v = q.viewer;
        v.clock.currentTime = H.JulianDate.fromIso8601(
          "2026-09-30T15:45:59.975908Z",
        );
        v.camera.setView({
          destination: new H.Cartesian3(
            -9412786.358621413,
            -21163227.169227634,
            -3167995.3206285993,
          ),
          orientation: {
            direction: new H.Cartesian3(
              0.40258878698283174,
              0.9051600270198104,
              0.13640965538109276,
            ),
            up: new H.Cartesian3(
              -0.055435177167269443,
              -0.12463761556457154,
              0.9906525152235831,
            ),
          },
        });
      });
      await page.waitForTimeout(2000);
    }
    const rows = [];
    await page.waitForTimeout(7000);
    for (const source of ["PRIMARY_GP_TLE", "NASA_OEM"]) {
      await page
        .getByRole("button", {
          name: source === "NASA_OEM" ? "NASA OEM" : "MISSION1 GP/TLE",
          exact: true,
        })
        .click();
      await initial();
      await start();
      await page.waitForTimeout(5000);
      const overview = await stop();
      await start(true);
      const entryStart = Date.now();
      await page
        .getByRole("button", { name: "Inspect ISS", exact: true })
        .click();
      await page.waitForFunction(
        () => globalThis.__qa.mode === "ISS_INSPECTION",
        null,
        { timeout: 20000 },
      );
      const entryMs = Date.now() - entryStart,
        entry = await stop();
      await page.screenshot({
        path: `${dir}/${label}-${source}-inspection.png`,
      });
      await page.waitForTimeout(2000);
      await start();
      await page.waitForTimeout(5000);
      const inspection = await stop();
      await start();
      await page.mouse.move(800, 400);
      await page.mouse.down();
      await page.mouse.move(970, 440, { steps: 20 });
      await page.mouse.up();
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, i < 3 ? -100 : 100);
        await page.waitForTimeout(350);
      }
      await page.waitForTimeout(2500);
      const controls = await stop();
      await start(true);
      const exitStart = Date.now();
      await page
        .getByRole("button", { name: "Back to Earth View", exact: true })
        .click();
      await page.waitForFunction(
        () => globalThis.__qa.mode === "EARTH_OVERVIEW",
        null,
        { timeout: 20000 },
      );
      const exitMs = Date.now() - exitStart,
        exit = await stop();
      rows.push({
        source,
        overview,
        entry,
        entryMs,
        inspection,
        controls,
        exit,
        exitMs,
      });
    }
    const metadata = await page.evaluate(() => {
      const q = globalThis.__qa,
        v = q.viewer,
        g = v.scene.canvas.getContext("webgl2"),
        e = g.getExtension("WEBGL_debug_renderer_info"),
        a = g.getExtension("EXT_texture_filter_anisotropic");
      return {
        renderer: e && g.getParameter(e.UNMASKED_RENDERER_WEBGL),
        anisotropyMaximum:
          a && g.getParameter(a.MAX_TEXTURE_MAX_ANISOTROPY_EXT),
        canvas: [v.scene.canvas.width, v.scene.canvas.height],
        longTasks: q.longTasks,
      };
    });
    const quant = (a, p) =>
      a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))];
    const summary = rows.map((r) =>
      Object.fromEntries(
        ["source", "entryMs", "exitMs"]
          .map((k) => [k, r[k]])
          .concat(
            ["overview", "entry", "inspection", "controls", "exit"].map((k) => {
              const intervals = r[k]
                  .slice(1)
                  .map((x, i) => x.wall - r[k][i].wall),
                s = [...intervals].sort((a, b) => a - b);
              return [
                k,
                {
                  frames: r[k].length,
                  medianFps: 1000 / quant(s, 0.5),
                  p50: quant(s, 0.5),
                  p95: quant(s, 0.95),
                  p99: quant(s, 0.99),
                  worst: s.at(-1),
                  over33: intervals.filter((t) => t > 33.3).length,
                  over50: intervals.filter((t) => t > 50).length,
                },
              ];
            }),
          ),
      ),
    );
    fs.writeFileSync(
      `${dir}/${label}-profile.json`,
      JSON.stringify({ rows, summary, metadata, requests, errors }, null, 2),
    );
    console.log(JSON.stringify({ summary, metadata, errors }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
