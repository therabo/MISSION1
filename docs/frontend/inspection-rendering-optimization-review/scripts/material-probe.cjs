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
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto("http://127.0.0.1:" + (process.argv[2] || 4173) + "/");
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
  await p.waitForFunction(() => globalThis.__qa.mode === "ISS_INSPECTION");
  await p.waitForTimeout(2000);
  const cases = [];
  for (const variant of [
    "original",
    "flat-normal",
    "rough",
    "specular-aa",
    "fxaa",
    "final",
  ]) {
    await p.evaluate((variant) => {
      const q = globalThis.__qa,
        H = q.helpers;
      Array.from({ length: q.viewer.scene.postProcessStages.length }, (_, i) =>
        q.viewer.scene.postProcessStages.get(i),
      ).find((s) => s.name === "mission1_inspection_antialiasing").enabled =
        variant === "fxaa" || variant === "final";
      q.model.customShader =
        variant === "original" || variant === "fxaa"
          ? undefined
          : new H.CustomShader({
              fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { ${variant === "flat-normal" ? "material.normalEC = normalize(fsInput.attributes.normalEC);" : variant === "rough" ? "material.roughness = 1.0;" : `vec3 dx = dFdx(material.normalEC); vec3 dy = dFdy(material.normalEC); float variance = 0.15 * (dot(dx, dx) + dot(dy, dy)); float kernel = min(2.0 * variance, 0.18); float r2 = material.roughness * material.roughness; material.roughness = sqrt(sqrt(min(1.0, r2 * r2 + kernel)));`} }`,
            });
    }, variant);
    await p.waitForTimeout(1500);
    cases.push(
      await p.evaluate((variant) => {
        const q = globalThis.__qa,
          v = q.viewer,
          pos = q.model.environmentMapManager.position;
        return {
          variant,
          source: q.source,
          utc: q.helpers.JulianDate.toIso8601(v.clock.currentTime),
          environmentPosition: pos && [pos.x, pos.y, pos.z],
          stageEnabled: Array.from(
            { length: v.scene.postProcessStages.length },
            (_, i) => v.scene.postProcessStages.get(i),
          ).find((s) => s.name === "mission1_inspection_antialiasing").enabled,
          customShader: !!q.model.customShader,
          msaa: v.scene.msaaSamples,
          canvas: [v.scene.canvas.width, v.scene.canvas.height],
        };
      }, variant),
    );
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
      await p.screenshot({
        path: `${evidenceDir}/material-${variant}-${i}.png`,
      });
    }
  }
  fs.writeFileSync(
    evidenceDir + "/material-probe.json",
    JSON.stringify({ cases, errors }, null, 2),
  );
  console.log({ errors });
  await b.close();
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
