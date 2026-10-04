const fs = require('fs'), assert = require('assert/strict'), path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const repo = process.env.MISSION1_REPO_ROOT || path.resolve(__dirname, '../../../..');
const evidence = process.env.MISSION1_EVIDENCE_DIR || path.join(repo, 'docs/frontend/dynamic-workspace-centering/evidence');
// Reuse the diagnostic-only geometry probe without loading/running its QA driver.
const qa = fs.readFileSync(path.join(__dirname, 'browser-qa.cjs'), 'utf8');
const observe = eval(`(${qa.slice(qa.indexOf('function observe()'), qa.indexOf('\n(async()=>'))})`);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  const rows = [];
  try {
    for (const port of [5175, 4175]) for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`http://127.0.0.1:${port}`);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false, null, { timeout: 90000 });
      async function record(state, inspection) {
        await page.waitForTimeout(800);
        const geometry = await page.evaluate(observe);
        assert(Math.abs(geometry.canvas.left - geometry.dashboardRight) < 1);
        const center = inspection ? geometry.observedModel : geometry.observedEarth;
        assert(center && Math.abs(center.x - geometry.expectedCenter) < 2);
        if (inspection) {
          assert(Math.abs(geometry.inspection.range - 90 * Math.max(1, 1.2 / (width / height))) < 0.01);
          assert(Math.abs(geometry.inspection.elevation - 42.5) < 0.001);
          assert(Math.abs(geometry.inspection.lateral) < 0.001);
          assert(Math.abs(geometry.canonicalFovDegrees - 100) < 0.001);
        }
        rows.push({ port, width, height, state, ...geometry, errors: [...errors] });
        fs.writeFileSync(path.join(evidence, 'panel-states.json'), JSON.stringify(rows, null, 2));
        return geometry;
      }
      async function crewStates(prefix, inspection) {
        const before = await record(`${prefix}-closed`, inspection);
        await page.locator('#crew-launcher').click();
        await page.locator('.crew-summary').waitFor();
        const open = await record(`${prefix}-open`, inspection);
        await page.locator('.crew-member').first().click();
        await page.locator('.crew-profile').waitFor();
        const detail = await record(`${prefix}-detail`, inspection);
        assert.equal(open.dashboardRight, detail.dashboardRight);
        assert.deepEqual(open.position, before.position);
        assert.deepEqual(detail.position, before.position);
        await page.getByRole('button', { name: 'Close crew panel', exact: true }).click();
        const closed = await record(`${prefix}-reclosed`, inspection);
        assert.equal(before.dashboardRight, closed.dashboardRight);
      }
      await page.getByRole('button', { name: 'Inspect ISS', exact: true }).click();
      await page.getByText('Drag to orbit the ISS · Scroll to zoom', { exact: true }).waitFor({ timeout: 30000 });
      // Pause the existing Cesium clock only in this disposable QA page so Crew
      // comparisons distinguish layout from physical station epoch advancement.
      await page.evaluate(() => {
        const el = document.querySelector('.earth-view');
        let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
        for (; f; f = f.return) for (let h = f.memoizedState; h; h = h.next) {
          const v = h.memoizedState?.current;
          if (v?.scene?.camera && v?.clock) { v.clock.shouldAnimate = false; return; }
        }
      });
      await crewStates('inspection-crew', true);
      await page.getByRole('button', { name: 'Back to Earth View', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Inspect ISS')?.disabled === false, null, { timeout: 30000 });
      await page.getByRole('button', { name: 'Replay history', exact: true }).click();
      await page.getByLabel('Replay UTC instant', { exact: true }).fill('2026-10-02T23:00');
      await page.waitForFunction(() => document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00') && !document.body.textContent.includes('Loading historical state'));
      await crewStates('replay-crew', false);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.earth-view').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ port, width, states: 8, passed: true }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
