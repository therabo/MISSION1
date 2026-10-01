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
  port = +process.argv[2] || 5173,
  label = port === 5173 ? "development" : "production";
let phase = 0;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=metal"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await context.route("**/api/iss/orbit/samples", (r) =>
    r.fulfill({
      json: JSON.parse(
        fs.readFileSync(
          `${repoRoot}/docs/frontend/inspection-orientation-review/phase-${phase}-samples.json`,
        ),
      ),
    }),
  );
  await context.route("**/api/iss/orbit/comparison", (r) =>
    r.fulfill({
      json: JSON.parse(
        fs.readFileSync(
          `${repoRoot}/docs/frontend/inspection-orientation-review/phase-${phase}-comparison.json`,
        ),
      ),
    }),
  );
  await context.route("https://gibs.earthdata.nasa.gov/**", (r) =>
    r.fulfill({ status: 503 }),
  );
  const page = await context.newPage(),
    report = {
      epochs: [],
      candidates: [],
      controls: [],
      partial: [],
      surfaces: [],
      errors: [],
      consoleErrors: [],
    };
  page.on("pageerror", (e) => {
    report.errors.push(String(e));
    console.log("PAGEERROR", String(e));
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/gibs|Failed to load resource/.test(m.text()))
      report.consoleErrors.push(m.text());
  });
  const snapshot = () =>
    page.evaluate(() => {
      const q = globalThis.__qa,
        H = q.helpers,
        v = q.viewer,
        c = v.camera,
        p = q.positionAt(v.clock.currentTime, new H.Cartesian3()),
        vel = q.velocityAt(v.clock.currentTime, new H.Cartesian3()),
        forward = H.Matrix4.multiplyByPointAsVector(
          q.model.modelMatrix,
          H.Cartesian3.UNIT_X,
          new H.Cartesian3(),
        );
      return {
        source: q.source,
        mode: q.mode,
        utc: H.JulianDate.toIso8601(v.clock.currentTime),
        position: [c.positionWC.x, c.positionWC.y, c.positionWC.z],
        direction: [c.directionWC.x, c.directionWC.y, c.directionWC.z],
        up: [c.upWC.x, c.upWC.y, c.upWC.z],
        local: [c.position.x, c.position.y, c.position.z],
        range: H.Cartesian3.distance(c.positionWC, p),
        rearAngle: H.CesiumMath.toDegrees(
          H.Cartesian3.angleBetween(c.directionWC, vel),
        ),
        alignment: H.CesiumMath.toDegrees(
          H.Cartesian3.angleBetween(forward, vel),
        ),
        centerError: H.Cartesian3.distance(q.model.boundingSphere.center, p),
        hull: H.projectedModelFootprint(v.scene, q.model),
        fov: c.frustum.fov,
        near: c.frustum.near,
        far: c.frustum.far,
        handOffs: q.handoffs,
        inputs: v.scene.screenSpaceCameraController.enableInputs,
        zoom: v.scene.screenSpaceCameraController.enableZoom,
        scale: q.model.scale,
        minimumPixel: q.model.minimumPixelSize,
        outline: [q.model.silhouetteSize, q.model.silhouetteColor.alpha],
      };
    });
  async function load() {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => globalThis.__qa?.model?.ready, null, {
      timeout: 60000,
    });
    await page.evaluate(() => {
      const q = globalThis.__qa,
        H = q.helpers,
        v = q.viewer;
      v.clock.shouldAnimate = false;
      v.clock.currentTime = H.JulianDate.addSeconds(
        v.clock.currentTime,
        0.3,
        new H.JulianDate(),
      );
      const p = q.positionAt(v.clock.currentTime, new H.Cartesian3()),
        n = H.Ellipsoid.WGS84.geodeticSurfaceNormal(p, new H.Cartesian3());
      v.camera.setView({
        destination: H.Cartesian3.add(
          p,
          H.Cartesian3.multiplyByScalar(n, 17000000, new H.Cartesian3()),
          new H.Cartesian3(),
        ),
        orientation: {
          direction: H.Cartesian3.negate(n, new H.Cartesian3()),
          up: H.Cartesian3.UNIT_Z,
        },
      });
      v.scene.renderError.addEventListener((s, e) =>
        console.log("RENDERERROR", String(e)),
      );
      q.handoffs = [];
      const original = v.camera.lookAtTransform;
      v.camera.lookAtTransform = function (...args) {
        const before = {
          p: H.Cartesian3.clone(this.positionWC),
          d: H.Cartesian3.clone(this.directionWC),
          u: H.Cartesian3.clone(this.upWC),
        };
        const result = original.apply(this, args);
        if (q.mode === "ENTERING_INSPECTION")
          q.handoffs.push({
            position: H.Cartesian3.distance(before.p, this.positionWC),
            direction: H.CesiumMath.toDegrees(
              H.Cartesian3.angleBetween(before.d, this.directionWC),
            ),
            up: H.CesiumMath.toDegrees(
              H.Cartesian3.angleBetween(before.u, this.upWC),
            ),
          });
        return result;
      };
    });
    await page.waitForTimeout(500);
  }
  async function enter(source) {
    await page
      .getByRole("button", {
        name: source === "NASA_OEM" ? "NASA OEM" : "MISSION1 GP/TLE",
        exact: true,
      })
      .click();
    const before = await snapshot();
    await page
      .getByRole("button", { name: "Inspect ISS", exact: true })
      .click();
    await page.waitForFunction(() => globalThis.__qa.mode === "ISS_INSPECTION");
    const after = await snapshot();
    if (
      Math.abs(after.range - 90) > 0.001 ||
      Math.abs(after.rearAngle - 42.5) > 0.001 ||
      after.alignment > 1e-5
    )
      throw Error("Geometry " + JSON.stringify(after));
    return { before, after };
  }
  async function back(before) {
    await page
      .getByRole("button", { name: "Back to Earth View", exact: true })
      .click();
    await page.waitForFunction(() => globalThis.__qa.mode === "EARTH_OVERVIEW");
    const after = await snapshot();
    const error = Math.hypot(
      ...after.position.map((x, i) => x - before.position[i]),
    );
    if (
      error > 0.00001 ||
      !after.zoom ||
      !after.inputs ||
      Math.abs(after.fov - before.fov) > 1e-10
    )
      throw Error("Restore " + error);
    return { error, after };
  }
  try {
    for (phase = 0; phase < 3; phase++) {
      await load();
      for (const source of ["PRIMARY_GP_TLE", "NASA_OEM"]) {
        const { before, after } = await enter(source);
        report.epochs.push({ phase, after });
        await page.screenshot({
          path: `${dir}/${label}-${phase}-${source}-rear.png`,
        });
        if (phase === 0) {
          for (const range of [95, 90, 85])
            for (const degrees of [40, 42.5, 45]) {
              await page.evaluate(
                ({ range, degrees }) => {
                  const q = globalThis.__qa,
                    H = q.helpers,
                    t = (degrees * Math.PI) / 180;
                  q.viewer.camera.lookAtTransform(
                    q.viewer.camera.transform,
                    new H.Cartesian3(
                      -range * Math.cos(t),
                      0,
                      range * Math.sin(t),
                    ),
                  );
                },
                { range, degrees },
              );
              await page.waitForTimeout(150);
              report.candidates.push({
                range,
                degrees,
                pose: await snapshot(),
              });
              if (degrees === 42.5)
                await page.screenshot({
                  path: `${dir}/${label}-${source}-${range}m.png`,
                });
            }
          await page.evaluate(() => {
            const q = globalThis.__qa,
              H = q.helpers,
              t = (42.5 * Math.PI) / 180;
            q.viewer.camera.lookAtTransform(
              q.viewer.camera.transform,
              new H.Cartesian3(-90 * Math.cos(t), 0, 90 * Math.sin(t)),
            );
          });
          for (const slow of [true, false]) {
            await page.mouse.move(800, 400);
            await page.mouse.down();
            await page.mouse.move(slow ? 940 : 1090, slow ? 450 : 520, {
              steps: slow ? 36 : 4,
            });
            await page.mouse.up();
            await page.waitForTimeout(700);
            report.controls.push({ source, slow, pose: await snapshot() });
          }
          for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, -100);
            await page.waitForTimeout(150);
          }
          report.controls.push({ source, close: await snapshot() });
          for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(150);
          }
          report.controls.push({ source, out: await snapshot() });
          await page.getByText("ISS orbital details", { exact: true }).click();
          if (
            !(
              (await page.locator(".orbital-details").getAttribute("open")) !==
              null
            )
          )
            throw Error("Details inaccessible");
          await page.getByText("ISS orbital details", { exact: true }).click();
        }
        report.surfaces.push({ source, restore: await back(before) });
        console.log(label, "epoch", phase, source);
      }
    }
    phase = 0;
    await load();
    for (const fraction of [0.2, 0.5, 0.8]) {
      const before = await snapshot();
      await page
        .getByRole("button", { name: "Inspect ISS", exact: true })
        .click();
      await page.waitForTimeout(fraction * 5000);
      const partial = await snapshot();
      const restore = await back(before);
      report.partial.push({ fraction, partial, restore });
      console.log(label, "partial", fraction);
    }
    for (const size of [
      { width: 900, height: 700 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      const before = await snapshot();
      await page
        .getByRole("button", { name: "Inspect ISS", exact: true })
        .click();
      await page.waitForFunction(
        () => globalThis.__qa.mode === "ISS_INSPECTION",
      );
      const after = await snapshot();
      report.surfaces.push({
        viewport: size,
        after,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      await page.screenshot({ path: `${dir}/${label}-${size.width}-rear.png` });
      await back(before);
    }
    fs.writeFileSync(
      `${dir}/${label}-full.json`,
      JSON.stringify(report, null, 2),
    );
    console.log({
      epochs: report.epochs.length,
      partial: report.partial.length,
      errors: report.errors,
      consoleErrors: report.consoleErrors,
    });
  } finally {
    if (report.errors.length || report.consoleErrors.length)
      console.log(
        "FINALDIAGNOSTICS",
        JSON.stringify({
          report,
          state: await page
            .evaluate(() => ({
              mode: globalThis.__qa?.mode,
              error: document.querySelector(".cesium-widget-errorPanel")
                ?.textContent,
            }))
            .catch(() => null),
        }),
      );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
