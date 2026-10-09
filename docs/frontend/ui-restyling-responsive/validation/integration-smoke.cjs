/* Final integration smoke: real backend, native Cesium, external QA output.
 * Node 24. Run: node integration-smoke.cjs URL BUILD OUTPUT_DIRECTORY
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const os = require('node:os');
const { chromium, viewer } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const { scan } = require('../../inspection-module-hover/scripts/surface-scan.cjs');
const { geometry } = require('./responsive-matrix.cjs');
const root = path.resolve(__dirname, '../../../..');
const mappings = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/cesium/issModelManifest.json'))).semanticMappings;
const nodes = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/inspection-orientation-review/asset-axes.json'))).nodes;
const [url = 'http://127.0.0.1:4175/', build = 'production', output = path.join(os.tmpdir(), 'mission1-integration-smoke')] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { url, build, realBackend: true, viewports: [], pageErrors: [], consoleErrors: [] };

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    p.setDefaultTimeout(90000);
    p.on('pageerror', e => report.pageErrors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    const action = name => p.getByRole('button', { name, exact: true });
    const ready = async () => {
      await p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
      await p.waitForTimeout(350);
    };
    const mode = async target => {
      await p.waitForFunction(target => document.querySelector('main').dataset.viewMode === target, target);
      await p.waitForTimeout(450);
    };
    await p.goto(url);
    await p.waitForFunction(() => !document.querySelector('[aria-label="ISS Inspection"]').disabled);
    await p.evaluate(`window.__v=(${viewer.toString()})();window.__originalCanvas=__v.canvas;window.__model=Array.from({length:__v.scene.primitives.length},(_,i)=>__v.scene.primitives.get(i)).find(m=>typeof m.id==='string'&&m.id.includes('iss'));`);
    const source = p.getByLabel('Orbital source', { exact: true });
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
      await p.setViewportSize({ width, height });
      await p.waitForTimeout(350);
      const result = { width, height, states: [], cesiumInput: false, historicalDisclosure: width <= 740 ? 'compact' : 'persistent' };
      async function capture(state) {
        const g = await p.evaluate(geometry);
        assert.deepEqual(g.failures, [], `${width} ${state}: ${g.failures.join(', ')}`);
        assert(await p.evaluate(() => __originalCanvas === document.querySelector('.earth-view canvas') && document.querySelectorAll('.cesium-viewer').length === 1));
        const screenshot = `${width}x${height}-${state}.png`;
        await p.screenshot({ path: path.join(output, screenshot) });
        result.states.push({ state, screenshot, calendar: g.calendarPosition, result: 'PASS' });
      }
      await source.selectOption('PRIMARY_GP_TLE');
      await capture('current-earth-gp');
      // Native wheel changes the actual camera; Reset restores the overview.
      const exposed = await p.evaluate(() => {
        for (let y = innerHeight * .4; y < innerHeight * .7; y += 10)
          for (let x = innerWidth * .3; x < innerWidth * .7; x += 10)
            if (document.elementFromPoint(x, y) === __v.canvas) return { x, y };
      });
      assert(exposed, 'No exposed Cesium input area');
      const before = await p.evaluate(() => [__v.camera.positionWC.x, __v.camera.positionWC.y, __v.camera.positionWC.z]);
      await p.mouse.move(exposed.x, exposed.y); await p.mouse.wheel(0, -150); await p.waitForTimeout(600);
      const after = await p.evaluate(() => [__v.camera.positionWC.x, __v.camera.positionWC.y, __v.camera.positionWC.z]);
      assert(Math.hypot(...after.map((n, i) => n - before[i])) > 1, 'Cesium wheel ignored');
      result.cesiumInput = true;
      await action('Reset view').click(); await p.waitForTimeout(700);
      await action('Crew').click();
      await p.waitForFunction(() => document.querySelectorAll('.crew-roster-row').length > 0);
      await p.waitForTimeout(350);
      assert.equal(await p.locator('.crew-header-actions').getByRole('button', { name: /^Refresh/ }).count(), 0);
      await capture('current-crew');
      await action('Close crew panel').click(); await p.locator('.crew-workspace-host').waitFor({ state: 'detached' });
      assert.equal(await source.locator('option[value="NASA_OEM"]').isDisabled(), false, 'Real NASA OEM unavailable');
      await source.selectOption('NASA_OEM'); await p.waitForTimeout(350); await capture('current-earth-oem');
      await action('ISS Inspection').click(); await mode('ISS_INSPECTION'); await capture('inspection-oem');
      let picked;
      for (const mapping of mappings) {
        const hit = await p.evaluate(scan, { mapping, node: nodes.find(n => n.index === mapping.nodeIndex) });
        if (hit) { await p.mouse.click(hit.x, hit.y); picked = mapping.componentId; break; }
      }
      assert(picked, 'No native semantic module hit');
      await p.locator('.module-dock').waitFor(); await p.waitForTimeout(350); await capture('module-detail');
      result.module = picked;
      await action('Close module information').click(); await p.locator('.module-dock').waitFor({ state: 'detached' });
      await action('Earth').click(); await mode('EARTH_OVERVIEW');
      await source.selectOption('PRIMARY_GP_TLE');
      await action('Historical').click(); await ready();
      if (width <= 740) {
        await action('Open Historical controls').click();
        await p.waitForTimeout(150);
      }
      await action('Open Historical calendar').click();
      await action('2026-10-03 UTC').click();
      await p.getByLabel('UTC hour', { exact: true }).selectOption('12');
      await p.getByLabel('UTC minute', { exact: true }).selectOption('04');
      await p.getByLabel('UTC second', { exact: true }).selectOption('00');
      await action('Apply').click(); await ready();
      if (width <= 740) {
        await action('Open Historical controls').waitFor(); await capture('historical-collapsed');
        await action('Open Historical controls').click(); await p.waitForTimeout(150);
      }
      await capture('historical-expanded');
      const target = await p.locator('.historical-date time').getAttribute('datetime');
      assert.equal(Date.parse(target), Date.parse('2026-10-03T12:04:00Z'));
      await action('Open Historical calendar').click(); await p.waitForTimeout(200); await capture('historical-calendar');
      await p.getByLabel('UTC minute', { exact: true }).selectOption('05');
      assert.equal(await p.locator('.historical-date time').getAttribute('datetime'), target);
      await action('Cancel').click(); await p.locator('#historical-calendar').waitFor({ state: 'detached' });
      await action('Crew').click();
      await p.waitForFunction(() => document.querySelectorAll('.crew-roster-row').length > 0);
      await p.waitForTimeout(350); await capture('historical-crew');
      await action('Close crew panel').click(); await p.locator('.crew-workspace-host').waitFor({ state: 'detached' });
      await action('Current').click(); await ready();
      result.result = 'PASS'; report.viewports.push(result);
      fs.writeFileSync(path.join(output, 'smoke.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(`${width}x${height}: ${result.states.length} states / Cesium input / native module ${picked} PASS`);
    }
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
    report.result = 'PASS';
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'smoke.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
