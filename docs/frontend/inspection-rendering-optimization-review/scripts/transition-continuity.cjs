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
    q.records = [];
    q.capture = false;
    q.viewer.scene.postRender.addEventListener(() => {
      if (q.capture) {
        const v = q.viewer,
          c = v.camera;
        q.records.push({
          wall: performance.now(),
          mode: q.mode,
          position: [c.positionWC.x, c.positionWC.y, c.positionWC.z],
          direction: [c.directionWC.x, c.directionWC.y, c.directionWC.z],
          up: [c.upWC.x, c.upWC.y, c.upWC.z],
          fov: c.frustum.fov,
          height: H.Ellipsoid.WGS84.cartesianToCartographic(c.positionWC)
            .height,
          lift: H.Cartesian3.distance(
            q.model.boundingSphere.center,
            q.positionAt(v.clock.currentTime, new H.Cartesian3()),
          ),
          outline: q.model.silhouetteSize,
        });
      }
    });
    q.changes = [];
    const original = q.viewer.camera.lookAtTransform;
    q.viewer.camera.lookAtTransform = function (...args) {
      const before = H.Cartesian3.clone(this.positionWC);
      const r = original.apply(this, args);
      if (q.mode !== "ISS_INSPECTION")
        q.changes.push({
          mode: q.mode,
          positionError: H.Cartesian3.distance(before, this.positionWC),
        });
      return r;
    };
  });
  const rows = [];
  for (const source of ["PRIMARY_GP_TLE", "NASA_OEM"]) {
    await p
      .getByRole("button", {
        name: source === "NASA_OEM" ? "NASA OEM" : "MISSION1 GP/TLE",
        exact: true,
      })
      .click();
    for (const fraction of [0.2, 0.5, 0.8, 1]) {
      await p.evaluate(() => {
        const q = globalThis.__qa,
          H = q.helpers,
          v = q.viewer;
        v.clock.shouldAnimate = false;
        v.clock.currentTime = H.JulianDate.fromIso8601(
          "2026-09-30T15:45:59.975908Z",
        );
        const position = q.positionAt(v.clock.currentTime, new H.Cartesian3()),
          n = H.Ellipsoid.WGS84.geodeticSurfaceNormal(
            position,
            new H.Cartesian3(),
          );
        v.camera.setView({
          destination: H.Cartesian3.add(
            position,
            H.Cartesian3.multiplyByScalar(n, 17000000, new H.Cartesian3()),
            new H.Cartesian3(),
          ),
          orientation: {
            direction: H.Cartesian3.negate(n, new H.Cartesian3()),
            up: H.Cartesian3.UNIT_Z,
          },
        });
        q.records = [];
        q.changes = [];
        q.capture = true;
        v.clock.shouldAnimate = true;
      });
      await p.getByRole("button", { name: "Inspect ISS", exact: true }).click();
      if (fraction < 1) await p.waitForTimeout(fraction * 5000);
      else
        await p.waitForFunction(
          () => globalThis.__qa.mode === "ISS_INSPECTION",
        );
      await p
        .getByRole("button", { name: "Back to Earth View", exact: true })
        .click();
      await p.waitForFunction(() => globalThis.__qa.mode === "EARTH_OVERVIEW");
      const record = await p.evaluate(() => {
        const q = globalThis.__qa;
        q.capture = false;
        q.viewer.clock.shouldAnimate = false;
        return { frames: q.records, changes: q.changes };
      });
      const height = Math.min(...record.frames.map((r) => r.height));
      if (height < 1000) throw Error("Earth intersection " + height);
      rows.push({ source, fraction, ...record });
      console.log(source, fraction, height);
    }
  }
  fs.writeFileSync(
    evidenceDir + "/transition-continuity.json",
    JSON.stringify(rows, null, 2),
  );
  await b.close();
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
