// Real local dev/preview smoke using the installed bundled browser runtime.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { chromium } = require('/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../../..');
const output = path.join(root, 'docs/crew/rest-api-validation');

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  const report = { startedUtc: new Date().toISOString(), cases: [], console: [], pageErrors: [], requestsFailed: [] };
  try {
    for (const [port, label] of [[4175, 'production'], [5175, 'development']]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      page.on('pageerror', error => report.pageErrors.push({ label, message: String(error) }));
      page.on('console', message => {
        if (['warning', 'error'].includes(message.type())) {
          report.console.push({ label, type: message.type(), message: message.text() });
        }
      });
      page.on('requestfailed', request => report.requestsFailed.push({ label, url: request.url(), failure: request.failure()?.errorText }));
      await page.goto('http://127.0.0.1:' + port);
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Inspect ISS' && !button.disabled), null, { timeout: 60000 });
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'NASA OEM' && !button.disabled) && document.body.textContent.includes('FORWARD'), null, { timeout: 60000 });

      for (const source of ['PRIMARY_GP_TLE', 'NASA_OEM']) {
        const button = page.getByRole('button', { name: source === 'NASA_OEM' ? 'NASA OEM' : 'MISSION1 GP/TLE', exact: true });
        if (await button.isDisabled()) throw Error('Source unavailable: ' + source);
        await button.click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (label === 'production') {
          await page.screenshot({ path: path.join(output, label + '-' + source + '-earth.jpg'), type: 'jpeg', quality: 82 });
        }
        await page.getByRole('button', { name: 'Inspect ISS', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.top-brand em')?.textContent.trim() === '/ ISS INSPECTION', null, { timeout: 20000 });
        await page.screenshot({ path: path.join(output, label + '-' + source + '-inspection.jpg'), type: 'jpeg', quality: 82 });
        await page.getByRole('button', { name: 'Back to Earth View', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.top-brand em')?.textContent.trim() === '/ EARTH VIEW', null, { timeout: 20000 });
        report.cases.push({ label, source, trajectoryLoaded: true, modelReady: true, inspection: true, back: true });
      }
      if (label === 'production') {
        const url = await page.locator('script[type="module"]').getAttribute('src');
        const served = await (await page.request.get('http://127.0.0.1:' + port + url)).body();
        const local = fs.readFileSync(root + '/frontend/dist' + url);
        if (!served.equals(local)) throw Error('Bundle mismatch');
        report.bundle = { url, sha256: crypto.createHash('sha256').update(local).digest('hex'), servedEqualsBuild: true };
      }
      await context.close();
    }
    report.completedUtc = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'browser-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (report.pageErrors.length || report.console.length || report.requestsFailed.length) {
      throw Error('Browser diagnostics failed; see the recorded report');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
