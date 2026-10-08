/* Native product controls and real local API only. Node 24 + existing Playwright.
 * node controls-qa.cjs URL BUILD OUTPUT_DIRECTORY
 * Companion to ../validation/responsive-matrix.cjs; keeps compact JSON evidence.
 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, viewer } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const [url = 'http://127.0.0.1:5175/', build = 'development', output = '/tmp/mission1-compact-controls'] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const names = ['Earth', 'ISS Inspection', 'Current', 'Historical', 'Crew'];
const report = { url, build, variants: [], keyboard: [], steps: [], firstFrames: [], errors: [] };

function controls() {
  const visible = e => e.checkVisibility({ visibilityProperty: true }) && !e.closest('[inert]');
  const box = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
  const top = document.querySelector('.top-context-bar');
  const actions = [...top.querySelectorAll('button')].map(e => ({ name: e.getAttribute('aria-label'), ...box(e),
    textVisible: visible(e.querySelector('.context-action-label')), iconVisible: visible(e.querySelector('svg')),
    selected: e.getAttribute('aria-pressed'), disabled: e.disabled, title: e.title,
    fill: getComputedStyle(e).backgroundColor, border: getComputedStyle(e).borderColor }));
  const time = document.querySelector('.historical-date time');
  const date = time ? [...time.querySelectorAll('span')].filter(e => !e.children.length && visible(e)).map(e => e.textContent) : [];
  const focusables = [...top.querySelectorAll('button,select')].filter(e => visible(e) && !e.disabled);
  return { width: innerWidth, height: innerHeight, top: box(top), actions, date,
    source: document.querySelector('.context-source-value').textContent,
    contextDate: box(document.querySelector('.context-date')),
    historicalBar: time ? box(document.querySelector('.historical-time-bar')) : null,
    dateButton: time ? box(time.closest('button')) : null,
    focusOrder: focusables.map(e => e.getAttribute('aria-label')),
    focusPositions: focusables.map(box),
    historicalControls: [...document.querySelectorAll('.historical-time-bar > button,.historical-steps button')].map(e => ({ name: e.getAttribute('aria-label'), ...box(e) })) };
}
function firstFrame() {
  const visible = e => e.checkVisibility({ visibilityProperty: true });
  const groups = [...document.querySelectorAll('.context-identity,.context-spatial,.context-source,.context-temporal,.context-crew,.context-date')].filter(visible).map(e => e.getBoundingClientRect());
  const failures = [];
  for (const b of groups) if (b.left < 0 || b.right > innerWidth + 1) failures.push('Group outside viewport');
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    const a = groups[i], b = groups[j];
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) failures.push('Group overlap');
  }
  if (document.documentElement.scrollWidth > innerWidth) failures.push('Page overflow');
  return { width: innerWidth, failures };
}
async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    // Real local orbital reconstruction can be slow under concurrent GPU QA.
    p.setDefaultTimeout(90000);
    p.on('pageerror', e => report.errors.push(e.message));
    await p.goto(url); await p.evaluate(() => document.fonts.ready);
    await p.getByRole('button', { name: 'ISS Inspection', exact: true }).waitFor();
    await p.waitForFunction(() => !document.querySelector('[aria-label="ISS Inspection"]').disabled, null, { timeout: 120000 });
    await p.evaluate(`window.__v=(${viewer.toString()})();window.__originalCanvas=__v.canvas;`);
    await p.getByLabel('Orbital source', { exact: true }).selectOption('PRIMARY_GP_TLE');
    for (const [width, height] of [[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[320,568],[844,390]]) {
      await p.setViewportSize({ width, height }); await p.waitForTimeout(200);
      const current = await p.evaluate(controls);
      for (const name of names) assert.equal(await p.getByRole('button', { name, exact: true }).count(), 1);
      for (const c of current.actions) {
        assert.equal(c.iconVisible, width <= 1243); assert.equal(c.textVisible, width > 740);
        if (width <= 1243) assert(c.width >= 44 && c.height >= 44);
      }
      await p.keyboard.press('Tab');
      await p.getByRole('button', { name: 'Earth', exact: true }).focus();
      const order = [];
      for (let i = 0; i < current.focusOrder.length; i++) {
        order.push(await p.evaluate(() => document.activeElement.getAttribute('aria-label')));
        assert.equal(await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
        if (i + 1 < current.focusOrder.length) await p.keyboard.press('Tab');
      }
      assert.deepEqual(order, current.focusOrder);
      // Interactive order follows screen rows left to right; UTC is non-interactive.
      for (let i = 1; i < current.focusPositions.length; i++) {
        const a = current.focusPositions[i-1], b = current.focusPositions[i];
        assert(b.y >= a.y - 1 && (b.y > a.y + 1 || b.x >= a.x));
      }
      report.keyboard.push({ width, height, order, focusVisible: true });
      await p.getByRole('button', { name: 'Historical', exact: true }).click();
      await p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
      await p.waitForTimeout(250);
      const historical = await p.evaluate(controls);
      assert(historical.date.length > 0);
      if (width <= 740) assert.deepEqual(historical.date, [await p.locator('.historical-date time').getAttribute('datetime').then(s => s.slice(0,10)),
        await p.locator('.historical-date time').getAttribute('datetime').then(s => s.slice(11,19) + ' UTC')]);
      for (const c of historical.historicalControls) if (width <= 1243) assert(c.width >= 44 && c.height >= 44);
      report.variants.push({ width, height, current, historical, accessibleTree: await p.locator('.top-context-bar').ariaSnapshot(),
        temporalTree: await p.locator('.historical-time-bar').ariaSnapshot() });
      await p.getByRole('button', { name: 'Current', exact: true }).click();
      await p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
    }
    await p.setViewportSize({ width: 320, height: 568 });
    await p.getByRole('button', { name: 'Historical', exact: true }).click();
    const target = () => p.locator('.historical-date time').getAttribute('datetime');
    await p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
    const original = await target();
    for (const [name, delta] of [['Historical back 10 minutes', -600000], ['Historical forward 10 minutes', 600000]]) {
      const before = await target(); await p.getByRole('button', { name, exact: true }).click();
      await p.waitForFunction(before => document.querySelector('.historical-date time').dateTime !== before, before);
      await p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
      const after = await target(); assert.equal(Date.parse(after) - Date.parse(before), delta);
      report.steps.push({ name, before, after, delta });
    }
    assert.equal(Date.parse(await target()), Date.parse(original));
    // Both original calendar openers retain semantics and restore keyboard focus.
    for (const selector of ['.historical-calendar-trigger', '.historical-date']) {
      await p.locator(selector).click(); await p.locator('#historical-calendar[data-state="open"]').waitFor();
      assert.equal(await p.locator('.calendar-week').first().evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 7);
      assert.equal(await target(), original);
      await p.keyboard.press('Escape'); await p.locator('#historical-calendar').waitFor({ state: 'detached' });
      assert(await p.locator(selector).evaluate(e => document.activeElement === e));
    }
    // Inspect the first two animation frames after resize, including breakpoint edges.
    const widths = [...new Set([...Array.from({ length: 141 }, (_, i) => 320 + i*8), 379,380,599,600,601,739,740,741,1243,1244,1399,1400])].sort((a,b) => a-b);
    for (const width of widths) {
      await p.setViewportSize({ width, height: 800 });
      const first = await p.evaluate(firstFrame);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
      const second = await p.evaluate(firstFrame);
      assert.deepEqual(first.failures, []); assert.deepEqual(second.failures, []);
      report.firstFrames.push({ width, frames: 2, result: 'PASS' });
    }
    assert(await p.evaluate(() => __originalCanvas === document.querySelector('.earth-view canvas')));
    assert.deepEqual(report.errors, []);
    report.result = 'PASS'; console.log(`${build}: names / focus / variants / UTC steps / calendar / ${widths.length} first-frame widths PASS`);
  } finally {
    fs.writeFileSync(path.join(output, 'controls.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close();
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
