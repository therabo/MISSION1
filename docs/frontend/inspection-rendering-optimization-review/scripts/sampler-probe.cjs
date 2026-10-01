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
  await c.addInitScript(() => {
    globalThis.__textures = [];
    for (const proto of [
      WebGLRenderingContext.prototype,
      WebGL2RenderingContext.prototype,
    ]) {
      const records = new WeakMap();
      function record(g) {
        const t = g.getParameter(g.TEXTURE_BINDING_2D);
        if (!t) return null;
        if (!records.has(t)) {
          const r = {
            id: globalThis.__textures.length,
            parameters: {},
            mips: false,
          };
          globalThis.__textures.push(r);
          records.set(t, r);
        }
        return records.get(t);
      }
      const image = proto.texImage2D,
        parameter = proto.texParameteri,
        mipmap = proto.generateMipmap;
      proto.texImage2D = function (...args) {
        const r = args[0] === this.TEXTURE_2D ? record(this) : null;
        if (r && args[1] === 0) {
          const source = args.at(-1);
          r.width = args.length === 6 ? source?.width : args[3];
          r.height = args.length === 6 ? source?.height : args[4];
          r.internalFormat = args[2];
        }
        return image.apply(this, args);
      };
      proto.texParameteri = function (target, name, value) {
        const r = target === this.TEXTURE_2D ? record(this) : null;
        if (r) r.parameters[name] = value;
        return parameter.call(this, target, name, value);
      };
      proto.generateMipmap = function (target) {
        const r = target === this.TEXTURE_2D ? record(this) : null;
        if (r) r.mips = true;
        return mipmap.call(this, target);
      };
    }
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
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto("http://127.0.0.1:4173");
  await p.waitForFunction(() => globalThis.__qa?.model?.ready);
  await p.waitForTimeout(4000);
  const result = await p.evaluate(() => {
    const q = globalThis.__qa,
      g = q.viewer.scene.canvas.getContext("webgl2"),
      e = g.getExtension("EXT_texture_filter_anisotropic");
    return {
      sourceCandidates: globalThis.__textures.filter(
        (t) =>
          [512, 1024].includes(t.width) &&
          t.height === t.width &&
          t.parameters[10242] === 10497 &&
          t.parameters[10243] === 10497,
      ),
      maximumAnisotropy: e && g.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT),
      maximumMsaa: g.getParameter(g.MAX_SAMPLES),
      resolution: [q.viewer.scene.canvas.width, q.viewer.scene.canvas.height],
      nativeFxaa: q.viewer.scene.postProcessStages.fxaa.enabled,
      retainedFxaaEnabled: Array.from(
        { length: q.viewer.scene.postProcessStages.length },
        (_, i) => q.viewer.scene.postProcessStages.get(i),
      ).find((s) => s.name === "mission1_inspection_antialiasing").enabled,
      requestedFxaa:
        !q.viewer.scene.msaaSupported || q.mode !== "EARTH_OVERVIEW",
      stageInventory: Array.from(
        { length: q.viewer.scene.postProcessStages.length },
        (_, i) => {
          const s = q.viewer.scene.postProcessStages.get(i);
          return {
            name: s.name,
            enabled: s.enabled,
            ready: s.ready,
            hasUniformBypass: s.fragmentShader?.includes("u_inspectionFxaa"),
          };
        },
      ),
      msaa: q.viewer.scene.msaaSamples,
      logarithmicDepthBuffer: q.viewer.scene.logarithmicDepthBuffer,
    };
  });
  fs.writeFileSync(
    evidenceDir + "/sampler-runtime.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(result);
  await b.close();
})().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await activeBrowser?.close();
});
