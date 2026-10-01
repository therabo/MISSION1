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
const fs = require("fs"),
  dir = evidenceDir,
  port = +process.argv[2] || 4173,
  label = port === 5173 ? "development" : "production";
const root = repoRoot;
const nodes = JSON.parse(
    fs.readFileSync(
      repoRoot + "/docs/frontend/inspection-orientation-review/asset-axes.json",
    ),
  ).nodes,
  manifest = JSON.parse(
    fs.readFileSync(root + "/frontend/src/cesium/issModelManifest.json"),
  );
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
  let unavailable = false,
    delay = false;
  const report = { sources: [], loading: null, outage: null, errors: [] };
  await context.addInitScript(() => {
    const original = setTimeout;
    globalThis.__polls = [];
    globalThis.setTimeout = (f, ms, ...args) => {
      if (ms >= 119000) {
        globalThis.__polls.push(f);
        return original(f, 1000000000, ...args);
      }
      return original(f, ms, ...args);
    };
  });
  await context.route("**/api/iss/orbit/samples", (r) =>
    r.fulfill({
      json: JSON.parse(
        fs.readFileSync(
          repoRoot +
            "/docs/frontend/inspection-orientation-review/phase-0-samples.json",
        ),
      ),
    }),
  );
  await context.route("**/api/iss/orbit/comparison", (r) => {
    const j = JSON.parse(
      fs.readFileSync(
        repoRoot +
          "/docs/frontend/inspection-orientation-review/phase-0-comparison.json",
      ),
    );
    if (unavailable) {
      j.oem.availability = "UNAVAILABLE";
      j.oem.reason = "QA_OUTAGE";
      j.oem.samples = [];
    }
    return r.fulfill({ json: j });
  });
  await context.route("**/models/*.glb*", async (r) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 3500));
    return r.continue();
  });
  let page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(String(e)));
  async function load() {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => globalThis.__qa?.model?.ready, {
      timeout: 60000,
    });
    await page.evaluate(() => {
      const q = globalThis.__qa,
        H = q.helpers;
      q.viewer.clock.shouldAnimate = false;
      q.viewer.clock.currentTime = H.JulianDate.addSeconds(
        q.viewer.clock.currentTime,
        0.3,
        new H.JulianDate(),
      );
    });
  }
  async function enter(source) {
    await page
      .getByRole("button", {
        name: source === "NASA_OEM" ? "NASA OEM" : "MISSION1 GP/TLE",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Inspect ISS", exact: true })
      .click();
    for (let i = 0; i < 36; i++) {
      await page.evaluate(() => {
        const q = globalThis.__qa;
        q.viewer.clock.currentTime = q.helpers.JulianDate.addSeconds(
          q.viewer.clock.currentTime,
          0.3,
          new q.helpers.JulianDate(),
        );
      });
      await page.waitForTimeout(70);
      if (await page.evaluate(() => globalThis.__qa.mode === "ISS_INSPECTION"))
        break;
    }
    await page.waitForFunction(() => globalThis.__qa.mode === "ISS_INSPECTION");
  }
  async function back() {
    await page
      .getByRole("button", { name: "Back to Earth View", exact: true })
      .click();
    await page.waitForFunction(() => globalThis.__qa.mode === "EARTH_OVERVIEW");
  }
  try {
    await load();
    for (const source of ["PRIMARY_GP_TLE", "NASA_OEM"]) {
      await enter(source);
      const selected = { source, picks: [], pinch: null, refresh: null };
      const wanted = manifest.semanticMappings.map((m) => ({
        ...m,
        center: nodes.find((n) => n.index === m.nodeIndex).center,
      }));
      const seen = new Set();
      for (const off of [
        [-119, 0, 0],
        [119, 0, 0],
        [0, -150, 0],
        [0, 150, 0],
        [0, 0, -119],
        [0, 0, 119],
        [-100, -100, 70],
        [100, 100, -70],
      ]) {
        await page.evaluate((off) => {
          const q = globalThis.__qa,
            H = q.helpers;
          q.viewer.camera.lookAtTransform(
            q.viewer.camera.transform,
            new H.Cartesian3(...off),
          );
        }, off);
        await page.waitForTimeout(120);
        for (const node of wanted.filter((n) => !seen.has(n.featureId))) {
          const hit = await page.evaluate((node) => {
            const q = globalThis.__qa,
              H = q.helpers,
              p = H.Matrix4.multiplyByPoint(
                q.model.modelMatrix,
                new H.Cartesian3(
                  node.center[2],
                  node.center[0],
                  node.center[1],
                ),
                new H.Cartesian3(),
              );
            const screen = H.SceneTransforms.worldToWindowCoordinates(
              q.viewer.scene,
              p,
              new H.Cartesian2(),
            );
            if (!screen) return null;
            for (const d of [0, -3, 3])
              for (const dy of [0, -3, 3]) {
                const x = screen.x + d,
                  y = screen.y + dy;
                if (x < 300 || x > 1220 || y < 90 || y > 610) continue;
                const hit = q.viewer.scene.pick(new H.Cartesian2(x, y));
                if (
                  hit?.featureId === node.featureId &&
                  hit?.getProperty("moduleCode") === node.moduleCode
                )
                  return {
                    x,
                    y,
                    featureId: hit.featureId,
                    moduleCode: hit.getProperty("moduleCode"),
                  };
              }
            return null;
          }, node);
          if (hit) {
            await page.mouse.click(hit.x, hit.y);
            await page.waitForFunction(
              (name) =>
                document
                  .querySelector(".module-panel")
                  ?.textContent.includes(name),
              node.displayName,
              { timeout: 5000 },
            );
            const text = await page.locator(".module-panel").textContent();
            if (!text.includes(node.displayName))
              throw Error(
                "Wrong picked panel " + node.displayName + " " + text,
              );
            seen.add(node.featureId);
            selected.picks.push({ name: node.displayName, ...hit });
            await page
              .getByRole("button", { name: "Close module information" })
              .click();
            await page.waitForFunction(
              () => !document.querySelector(".module-panel"),
            );
          }
        }
        if (seen.size === 14) break;
      }
      if (seen.size < 14)
        throw Error(
          "Missing picks " +
            wanted
              .filter((n) => !seen.has(n.featureId))
              .map((n) => n.displayName)
              .join(","),
        );
      console.log(
        "picks",
        source,
        selected.picks.map((p) => p.name),
      );
      await page.mouse.click(900, 180);
      await page.evaluate(() => {
        const q = globalThis.__qa,
          H = q.helpers;
        q.viewer.camera.lookAtTransform(
          q.viewer.camera.transform,
          new H.Cartesian3(
            -90 * Math.cos((42.5 * Math.PI) / 180),
            0,
            90 * Math.sin((42.5 * Math.PI) / 180),
          ),
        );
      });
      const session = await context.newCDPSession(page);
      const range = () =>
        page.evaluate(() =>
          globalThis.__qa.helpers.Cartesian3.magnitude(
            globalThis.__qa.viewer.camera.position,
          ),
        );
      const before = await range();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: 720, y: 380, id: 1 },
          { x: 920, y: 380, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 680, y: 380, id: 1 },
          { x: 960, y: 380, id: 2 },
        ],
      });
      await page.waitForTimeout(250);
      const close = await range();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 720, y: 380, id: 1 },
          { x: 920, y: 380, id: 2 },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(250);
      selected.pinch = { before, spread: close, returned: await range() };
      if (close >= before) throw Error("Pinch did not zoom");
      await page.evaluate(() => {
        for (const f of globalThis.__polls) f();
      });
      await page.waitForTimeout(500);
      selected.refresh = await page.evaluate(() => ({
        mode: globalThis.__qa.mode,
        source: globalThis.__qa.source,
        ready: globalThis.__qa.model.ready,
      }));
      report.sources.push(selected);
      await back();
    }
    await enter("NASA_OEM");
    unavailable = true;
    await page.evaluate(() => {
      for (const f of globalThis.__polls) f();
    });
    await page.waitForFunction(() => globalThis.__qa.mode === "EARTH_OVERVIEW");
    report.outage = await page.evaluate(() => ({
      mode: globalThis.__qa.mode,
      source: globalThis.__qa.source,
      text: document.body.innerText,
    }));
    if (report.outage.source !== "PRIMARY_GP_TLE")
      throw Error("No OEM fallback");
    await page.screenshot({ path: `${dir}/${label}-oem-outage.png` });
    await page.close();
    delay = true;
    page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForTimeout(900);
    report.loading = await page.evaluate(() => ({
      ready: globalThis.__qa?.model?.ready ?? false,
      inspectDisabled: Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Inspect ISS",
      )?.disabled,
      locator: globalThis.__qa?.viewer.entities.values.some((e) =>
        e.point?.show.getValue(globalThis.__qa.viewer.clock.currentTime),
      ),
    }));
    await page.screenshot({ path: `${dir}/${label}-delayed-loading.png` });
    await page.waitForFunction(() => globalThis.__qa?.model?.ready, {
      timeout: 60000,
    });
    fs.writeFileSync(
      `${dir}/${label}-extra.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
