// QA only. Uses the accepted recorded real GP/OEM responses; never changes app source.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || '/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { viewer, observe } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const prior = path.resolve(__dirname, '../../high-fidelity-rendering-performance/evidence');
const root = path.resolve(__dirname, '../evidence');
const build = process.env.RESTORE_BUILD || 'before';
const port = Number(process.env.RESTORE_PORT || 4185);
const dpr = Number(process.env.RESTORE_DPR || 1);
const benchmark = process.env.RESTORE_BENCHMARK !== '0';
const repeat = process.env.RESTORE_REPEAT === '1';
const twilight = process.env.RESTORE_TWILIGHT === '1';
const out = path.join(root, `${build}-dpr${dpr}${repeat ? '-repeat' : twilight ? '-twilight' : ''}`);
fs.mkdirSync(out, { recursive: true });
let browser;
const startedAtUtc = new Date().toISOString();

function statistics(values) {
  const a = values.slice().sort((x, y) => x - y);
  const q = p => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const slow = a.slice(-Math.max(1, Math.ceil(a.length * .01)));
  return { count: a.length, medianMs: q(.5), p95Ms: q(.95), p99Ms: q(.99),
    medianFps: 1000 / q(.5), onePercentLowFps: 1000 / (slow.reduce((x, y) => x + y, 0) / slow.length),
    over20: a.filter(v => v > 20).length, over33: a.filter(v => v > 33.3).length, over50: a.filter(v => v > 50).length };
}

(async () => {
  browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  for (const [endpoint, file] of [['samples', 'real-samples.json'], ['comparison', 'real-comparison.json']]) {
    await context.route(`**/api/iss/orbit/${endpoint}`, r => r.fulfill({ json: JSON.parse(fs.readFileSync(path.join(prior, file))) }));
  }
  const page = await context.newPage();
  const errors = [], consoleErrors = [], requestFailures = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => requestFailures.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('request', r => requests.push(r.url()));
  await page.bringToFront();
  const cadence = await page.evaluate(async () => {
    const a = []; await new Promise(resolve => { function tick(t) { a.push(t); a.length < 121 ? requestAnimationFrame(tick) : resolve(); } requestAnimationFrame(tick); });
    return a.slice(1).map((t, i) => t - a[i]);
  });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false, null, { timeout: 120000 });
  await page.evaluate(`window.__v=(${viewer.toString()})();window.__v.clock.shouldAnimate=false;`);
  // Fixed-pose QA: prevent native input/inertia from moving the comparison.
  // Application controls and camera implementation remain unchanged.
  await page.evaluate(() => { __v.camera.cancelFlight(); __v.scene.screenSpaceCameraController.enableInputs = false; });
  const reference = JSON.parse(fs.readFileSync(path.join(prior, 'after/dpr1/initial-fixture.json')));
  async function canonical() {
    await page.evaluate(ref => {
      const v = __v, c = v.camera, C = c.position.constructor;
      c.cancelFlight();
      v.clock.shouldAnimate = false;
      v.clock.currentTime = v.clock.currentTime.constructor.fromIso8601(ref.time);
      c.lookAtTransform(c.transform.constructor.IDENTITY);
      c.setView({ destination: new C(...ref.position), orientation: { direction: new C(...ref.direction), up: new C(...ref.up) } });
      c.frustum.fov = ref.nativeFovDegrees * Math.PI / 180;
    }, reference);
  }
  async function settled() {
    await page.waitForFunction(() => __v.scene.globe.tilesLoaded && __v.scene.skyBox?.sources?.positiveX?.src?.includes('tycho'), null, { timeout: 45000 });
    await page.waitForTimeout(850);
  }
  async function capture(name, measure = false) {
    if (twilight && name !== 'terminator') return;
    await page.bringToFront();
    // Mode transitions restore native controls, so reapply the QA input lock.
    await page.evaluate(() => { __v.scene.screenSpaceCameraController.enableInputs = false; __v.camera.cancelFlight(); });
    await settled();
    const fixedStart = await page.evaluate(observe);
    if (name.startsWith('gp-') || name.startsWith('oem-')) {
      assert(await page.getByRole('button', { name: 'Inspect ISS', exact: true }).isVisible(), `${name} must remain Overview`);
    }
    if (name.endsWith('canonical')) {
      assert(Math.hypot(...fixedStart.position.map((v, i) => v - reference.position[i])) < .001, `${name} must use the saved world camera`);
    }
    let timing;
    if (benchmark && measure) {
      await page.waitForTimeout(10000);
      timing = await page.evaluate(async () => {
        const times = [], longTasks = [];
        const observer = new PerformanceObserver(l => longTasks.push(...l.getEntries().map(x => ({ start: x.startTime, duration: x.duration }))));
        observer.observe({ type: 'longtask', buffered: false });
        const remove = __v.scene.postRender.addEventListener(() => times.push(performance.now()));
        const start = performance.now(); await new Promise(r => setTimeout(r, 30000));
        remove(); observer.disconnect();
        return { intervals: times.slice(1).map((t, i) => t - times[i]), durationMs: performance.now() - start, longTasks,
          visibility: document.visibilityState, focus: document.hasFocus() };
      });
      timing = { ...timing, ...statistics(timing.intervals) };
      assert.equal(timing.visibility, 'visible'); assert.equal(timing.focus, true);
      assert(timing.count > 200, 'Sufficient rendered frames for the timing window');
    }
    const geometry = await page.evaluate(observe);
    const driftMeters = Math.hypot(...geometry.position.map((v, i) => v - fixedStart.position[i]));
    if (driftMeters >= .001) fs.writeFileSync(path.join(out, `${name}-rejected-drift.json`), JSON.stringify({ name, driftMeters, fixedStart, geometry, timing }, null, 2) + '\n');
    assert(driftMeters < .001, `${name} camera moved ${driftMeters}m during the fixed window`);
    assert.equal(geometry.time, fixedStart.time);
    const graphics = await page.evaluate(() => {
      const v = __v, gl = v.canvas.getContext('webgl2'), bound = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); const defaultSamples = gl.getParameter(gl.SAMPLES); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, bound);
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const retained = v.scene.postProcessStages.getStageByName('mission1_inspection_antialiasing');
      return { antialias: gl.getContextAttributes().antialias, defaultSamples, sceneMsaa: v.scene.msaaSamples,
        fxaaEnabled: v.scene.postProcessStages.fxaa.enabled,
        retainedFxaa: retained && { enabled: retained.enabled }, hdr: v.scene.highDynamicRange, dpr: devicePixelRatio,
        canvasPixels: [v.canvas.width, v.canvas.height], resolutionScale: v.resolutionScale,
        gpu: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), tileQueueSettled: v.scene.globe.tilesLoaded,
        starsReady: v.scene.skyBox.sources.positiveX.src.includes('tycho'),
        controllerInputs: v.scene.screenSpaceCameraController.enableInputs,
        layers: Array.from({ length: v.imageryLayers.length }, (_, i) => { const l = v.imageryLayers.get(i); return {
          url: l.imageryProvider.url, brightness: l.brightness, gamma: l.gamma, contrast: l.contrast,
          dayAlpha: l.dayAlpha, nightAlpha: l.nightAlpha, maximumLevel: l.imageryProvider.maximumLevel }; }),
        servedJavaScript: performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js') && r.name.includes('/assets/index-')).map(r => r.name),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        unnamedVisibleButtons: [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0 && !(b.textContent.trim() || b.getAttribute('aria-label'))).length };
    });
    assert.equal(graphics.sceneMsaa, 4); assert.equal(graphics.hdr, false);
    assert.equal(graphics.fxaaEnabled, false); assert.equal(graphics.retainedFxaa?.enabled, true);
    for (const layer of graphics.layers.slice(2)) {
      assert.equal(layer.brightness, build === 'before' ? 1.15 : 1.8);
      assert.equal(layer.gamma, 1); assert.equal(layer.contrast, 1);
    }
    assert.equal(graphics.antialias, build !== 'before');
    assert.equal(graphics.resolutionScale, dpr < 1.5 ? 1.25 : 1);
    assert.equal(graphics.horizontalOverflow, false); assert.equal(graphics.unnamedVisibleButtons, 0);
    assert(geometry.error < 2); assert.equal(geometry.canvas.left, 0); assert.equal(geometry.canvas.top, 0);
    assert.equal(geometry.canvas.width, geometry.viewport.width); assert.equal(geometry.canvas.height, geometry.viewport.height);
    const row = { name, geometry, graphics, timing };
    rows.push(row); await page.screenshot({ path: path.join(out, `${name}.png`) });
    save(); console.log(JSON.stringify({ build, dpr, name, antialias: graphics.antialias, defaultSamples: graphics.defaultSamples, timing: timing && { medianMs: timing.medianMs, p95Ms: timing.p95Ms, medianFps: timing.medianFps } }));
  }
  const rows = [];
  function save() { fs.writeFileSync(path.join(out, 'comparison.json'), JSON.stringify({ build, port, startedAtUtc, recordedAtUtc: new Date().toISOString(), node: process.version, browser: browser.version(), dpr, cadence: { ...statistics(cadence), intervals: cadence },
    recordedRealFixture: true, referenceEpoch: reference.time, benchmarkWarmupMs: 10000, benchmarkWindowMs: 30000,
    rows, errors, consoleErrors, requestFailures, requests }, null, 2) + '\n'); }
  // Invoke the real UI handler without pointer events reaching the fixed canvas.
  async function source(name) { await page.getByRole('button', { name, exact: true }).evaluate(b => b.click()); await page.waitForTimeout(400); }
  async function oblique() {
    await page.evaluate(() => {
      const v = __v, c = v.camera;
      const model = Array.from({ length: v.scene.primitives.length }, (_, i) => v.scene.primitives.get(i)).find(p => p.id?.includes?.('iss'));
      // Diagnostic camera only, anchored to the unchanged real model transform.
      const theta = Math.PI / 6, phi = Math.PI / 5, range = 6000000;
      c.lookAtTransform(model.modelMatrix, new c.position.constructor(-range * Math.cos(theta), range * Math.sin(theta) * Math.cos(phi), range * Math.sin(theta) * Math.sin(phi)));
    });
  }
  await canonical(); await capture('gp-canonical', true);
  if (repeat) { assert.deepEqual(errors, []); await browser.close(); return; }
  await source('NASA OEM'); await canonical(); await capture('oem-canonical', dpr === 1);
  await source('MISSION1 GP/TLE'); await oblique(); await capture('gp-oblique', dpr === 1);
  await source('NASA OEM'); await oblique(); await capture('oem-oblique');
  await source('MISSION1 GP/TLE'); await canonical();
  await page.getByRole('button', { name: 'Inspect ISS', exact: true }).evaluate(b => b.click());
  await page.getByText('Drag to orbit the ISS · Scroll to zoom', { exact: true }).waitFor({ timeout: 30000 });
  await capture('iss-thin-geometry', dpr === 1);
  await page.evaluate(() => __v.camera.lookAtTransform(__v.camera.transform, new __v.camera.position.constructor(-100, 25, 80)));
  await capture('iss-oblique');
  await page.getByRole('button', { name: 'Back to Earth View', exact: true }).evaluate(b => b.click());
  await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false);
  if (dpr === 2) { assert.deepEqual(errors, []); await browser.close(); return; }
  await page.getByRole('button', { name: 'Replay history', exact: true }).evaluate(b => b.click());
  async function replayTime(t) {
    await page.getByLabel('Replay UTC instant', { exact: true }).fill(t);
    await page.waitForFunction(t => document.querySelector('.replay-orbit .eyebrow')?.textContent.includes(t + ':00') && !document.body.textContent.includes('Loading historical state'), t);
  }
  async function earth() { await page.evaluate(() => __v.camera.setView({ destination: __v.camera.position.constructor.fromDegrees(12, 45, 1300000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } })); }
  await replayTime('2026-10-02T23:00'); await earth(); await capture('night-cities');
  await replayTime(twilight ? '2026-10-02T17:00' : '2026-10-02T18:00'); await earth(); await capture('terminator');
  if (twilight) { assert.deepEqual(errors, []); await browser.close(); return; }
  await page.setViewportSize({ width: 390, height: 844 }); await capture('mobile-overview');
  await page.getByRole('button', { name: 'Inspect ISS', exact: true }).evaluate(b => b.click());
  await page.getByText('Drag to orbit the ISS · Scroll to zoom', { exact: true }).waitFor({ timeout: 30000 });
  await capture('mobile-inspection');
  assert.deepEqual(errors, []); await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
