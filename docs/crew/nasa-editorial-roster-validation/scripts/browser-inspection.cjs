const { chromium } = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.MISSION1_QA_OUTPUT;
const backend = process.env.MISSION1_QA_BACKEND || 'http://127.0.0.1:8081';
const sizes = [[1440,900],[1024,768],[768,1024],[390,844],[320,568]];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  const result = { viewports: [], errors: [], backend };
  try {
    for (const port of [5175,4175]) for (const [width,height] of sizes) {
      const page = await browser.newPage({ viewport: { width,height } });
      page.on('pageerror', e => result.errors.push(e.message));
      page.on('console', m => { if(m.type() === 'error') result.errors.push(m.text()); });
      await page.route('**/api/iss/**', async route => {
        const url = new URL(route.request().url());
        await route.fulfill({ response: await route.fetch({ url: backend + url.pathname + url.search }) });
      });
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'ISS Inspection')?.disabled === false, null, { timeout: 45000 });
      const sources = [];
      for (const source of ['PRIMARY_GP_TLE','NASA_OEM']) {
        const select = page.getByLabel('Orbital source', { exact: true });
        if (await select.locator(`option[value="${source}"]`).getAttribute('disabled') !== null) { sources.push({ source, availability: 'UNAVAILABLE_FROM_REAL_API' }); continue; }
        await select.selectOption(source);
        await page.getByRole('button', { name: 'ISS Inspection', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('main').dataset.viewMode === 'ISS_INSPECTION', null, { timeout: 20000 });
        await page.screenshot({ path: path.join(output, `inspection-${port}-${width}-${source === 'NASA_OEM' ? 'oem' : 'gp'}.png`) });
        await page.getByRole('button', { name: 'Earth', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('main').dataset.viewMode === 'EARTH_OVERVIEW', null, { timeout: 20000 });
        sources.push({ source, enter: 'PASS', back: 'PASS' });
      }
      assert(sources.some(s => s.enter === 'PASS'));
      result.viewports.push({ port,width,height,sources });
      await page.close();
    }
    assert.deepEqual(result.errors, []); result.result = 'PASS';
  } finally {
    fs.writeFileSync(path.join(output,'qa.json'),JSON.stringify(result,null,2)+'\n');
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
