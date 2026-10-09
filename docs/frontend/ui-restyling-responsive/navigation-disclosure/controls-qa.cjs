/* Native UI QA with real local API responses; no ISS data fixtures.
 * Node 24: node controls-qa.cjs URL development|production OUTPUT_DIRECTORY
 * Screenshots remain in OUTPUT_DIRECTORY; retain only representative evidence.
 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, viewer } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const { geometry } = require('../validation/responsive-matrix.cjs');
const [url = 'http://127.0.0.1:5175/', build = 'development', output = '/tmp/mission1-disclosure-qa'] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const matrix = [[1920,1080],[1600,900],[1440,900],[1280,720],[1024,768],[900,700],[834,1194],[768,1024],
  [430,932],[412,915],[390,844],[375,812],[360,800],[320,568],[844,390],[932,430]];
const names = ['Earth', 'ISS Inspection', 'Current', 'Historical', 'Crew'];
const resumeResize = process.env.MISSION1_QA_RESUME === 'resize';
const report = resumeResize ? JSON.parse(fs.readFileSync(path.join(output,'controls.json'))) :
  { url, build, variants: [], mobile: [], keyboard: [], resize: [], reduced: [], errors: [], console: [] };
if(resumeResize) {
  assert.equal(report.url,url); assert.equal(report.build,build); assert.equal(report.variants.length,16); assert.equal(report.mobile.length,6);
  delete report.result;
  report.revalidation = 'Resize/reduced-motion segment: wait one native animation frame for calendar resize delivery when CALENDAR_OPEN remains unchanged; immediate CSS checks retained; application source unchanged.';
}
const save = () => fs.writeFileSync(path.join(output, 'controls.json'), JSON.stringify(report, null, 2) + '\n');
function snapshot() {
  const visible = e => !!e && e.checkVisibility({visibilityProperty:true}) && !e.closest('[inert]');
  const rect = e => e.getBoundingClientRect().toJSON();
  const bar = document.querySelector('.historical-time-bar');
  return { width:innerWidth, height:innerHeight, state:bar?.dataset.disclosure, barVisible:visible(bar),
    dateVisible:visible(document.querySelector('.historical-date')), calendarVisible:visible(document.querySelector('#historical-calendar')),
    requested:document.querySelector('.historical-date time')?.dateTime, focus:document.activeElement?.getAttribute('aria-label'),
    bar:bar ? rect(bar) : null,
    actions:[...document.querySelectorAll('.top-context-bar button')].map(e => ({name:e.getAttribute('aria-label'),
      icon:visible(e.querySelector('.context-action-icon')), text:visible(e.querySelector('.context-action-label')),
      ...rect(e), selected:e.getAttribute('aria-pressed'), disabled:e.disabled,
      gap:getComputedStyle(e).gap, padding:getComputedStyle(e).padding,
      iconSize:e.querySelector('svg').getBoundingClientRect().toJSON(), decorative:e.querySelector('svg').getAttribute('aria-hidden')})),
    geometry:geometry() };
}
async function run() {
  const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
  try {
    const p = await browser.newPage({viewport:{width:1440,height:900},hasTouch:true}); p.setDefaultTimeout(90000);
    p.on('pageerror', e => report.errors.push(e.message));
    p.on('console', m => { if(m.type()==='error'||/ResizeObserver/.test(m.text())) report.console.push(m.text()); });
    await p.goto(url); await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => !document.querySelector('[aria-label="ISS Inspection"]').disabled, null, {timeout:120000});
    await p.evaluate(`window.geometry=(${geometry.toString()});window.__v=(${viewer.toString()})();window.__originalCanvas=__v.canvas;`);
    const action = name => p.getByRole('button',{name,exact:true});
    const bar = p.locator('.historical-time-bar'), date = p.locator('.historical-date');
    const ready = async () => p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy')==='false');
    const phase = async state => {
      await p.waitForFunction(s => {
        const b=document.querySelector('.historical-time-bar');
        return b?.dataset.disclosure===s && b.dataset.mobile===String(innerWidth<=740);
      }, state);
      const s = await p.evaluate(snapshot);
      assert.deepEqual(s.geometry.failures, []);
      assert.equal(s.barVisible, state !== 'CALENDAR_OPEN' || s.width > 740);
      assert.equal(s.dateVisible, state !== 'COLLAPSED' && (state !== 'CALENDAR_OPEN' || s.width > 740));
      if(state==='CALENDAR_OPEN') {
        assert.equal(s.calendarVisible,true); assert.equal(await p.locator('[role="columnheader"]').count(),7);
        assert.equal(await p.locator('#historical-calendar').getAttribute('aria-modal'),'false');
      }
      return s;
    };
    const capture = async name => { await p.waitForTimeout(200); await p.screenshot({path:path.join(output,name+'.png')}); };
    const idle = async () => { await p.waitForTimeout(4200); return phase('COLLAPSED'); };
    const expand = async () => { await action('Open Historical controls').click(); return phase('EXPANDED'); };
    const calendar = async () => { await date.click(); return phase('CALENDAR_OPEN'); };
    const anotherDate = async () => {
      const label = await p.locator('.calendar-day').evaluateAll(days => days.find(d => d.getAttribute('aria-disabled')==='false' && d.parentElement.getAttribute('aria-selected')!=='true').getAttribute('aria-label'));
      await action(label).click(); return label;
    };
    if(!resumeResize) {
    for(const [width,height] of matrix) {
      await p.setViewportSize({width,height}); await p.waitForTimeout(150);
      await action('Current').click(); await ready(); await bar.waitFor({state:'detached'});
      const s = await p.evaluate(snapshot); assert.deepEqual(s.geometry.failures,[]);
      for(const c of s.actions) {
        assert.equal(c.icon, width > 1243 || width <= 740); assert.equal(c.text,width > 740);
        assert.equal(c.decorative,'true');
        if(width <= 1243) assert(c.width >= 44 && c.height >= 44);
        if(width <= 740) { assert.equal(c.width,44); assert.equal(c.iconSize.width,22); }
        if(width > 740 && width <= 1243) { assert.equal(c.gap,'0px'); assert.equal(c.padding,'0px'); }
      }
      for(const name of names) assert.equal(await action(name).count(),1);
      assert(['GP/TLE','NASA OEM'].includes(await p.locator('.context-source-value').textContent()));
      await p.keyboard.press('Tab'); await action('Earth').focus();
      const focusOrder = await p.locator('.top-context-bar button,.top-context-bar select').evaluateAll(es => es.filter(e=>!e.disabled).map(e=>e.getAttribute('aria-label')));
      const actual = [];
      for(let i=0;i<focusOrder.length;i++) {
        actual.push(await p.evaluate(() => document.activeElement.getAttribute('aria-label')));
        assert.equal(await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle),'solid');
        if(i+1<focusOrder.length) await p.keyboard.press('Tab');
      }
      assert.deepEqual(actual,focusOrder);
      const captureCurrent = {1440:'1440-current',1024:'1024-current',390:'390-current'};
      if(captureCurrent[width]) await capture(captureCurrent[width]);
      report.variants.push({width,height,actions:s.actions,focusOrder,accessibleTree:await p.locator('.top-context-bar').ariaSnapshot()});
      await action('Historical').click(); await ready();
      if(width <= 740) {
        const sequence = [await phase('COLLAPSED')];
        assert.equal(await action('Open Historical controls').getAttribute('aria-expanded'),'false');
        assert.equal(await bar.getByRole('button').count(),1);
        if(width===390) await capture('390-collapsed');
        sequence.push(await expand()); if(width===390) await capture('390-expanded');
        sequence.push(await idle()); sequence.push(await expand());
        const before = await date.locator('time').getAttribute('datetime');
        await p.waitForTimeout(2100); await action('Historical back 10 minutes').click();
        assert.equal(Date.parse(await date.locator('time').getAttribute('datetime')),Date.parse(before)-600000);
        await p.waitForTimeout(2100); sequence.push(await phase('EXPANDED'));
        await action('Historical forward 10 minutes').click();
        assert.equal(Date.parse(await date.locator('time').getAttribute('datetime')),Date.parse(before));
        await p.waitForTimeout(2100); sequence.push(await phase('EXPANDED'));
        sequence.push(await calendar());
        if(width===390||width===320) await capture(width+'-calendar');
        await action('Cancel').click(); sequence.push(await phase('EXPANDED'));
        assert.equal(await p.evaluate(() => document.activeElement.className),'historical-date');
        assert.equal(await date.locator('time').getAttribute('datetime'),before);
        sequence.push(await idle()); sequence.push(await expand()); sequence.push(await calendar());
        const choice = await anotherDate(); await action('Apply').click(); sequence.push(await phase('COLLAPSED'));
        assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')),'Open Historical controls');
        assert.notEqual(await date.locator('time').getAttribute('datetime'),before);
        await p.locator('#historical-calendar').waitFor({state:'detached'});
        report.mobile.push({width,height,choice,states:sequence.map(s=>s.state),barHiddenDuringCalendar:true,
          exactSteps:true,cancelFocus:'historical-date',applyFocus:'Open Historical controls',result:'PASS'});
      } else {
        await phase('EXPANDED'); await action('Open Historical calendar').click(); await phase('CALENDAR_OPEN');
        if(width===844) await capture('844-calendar');
        await action('Close Historical calendar').click(); await phase('EXPANDED');
      }
      save(); console.log(`${width}x${height}: navigation / Historical / focus / geometry PASS`);
    }
    // Keyboard: focused controls stay available; date/calendar keep native roving focus.
    await p.setViewportSize({width:390,height:844}); await action('Current').click(); await ready(); await bar.waitFor({state:'detached'});
    await action('Historical').focus(); await p.keyboard.press('Enter'); await phase('COLLAPSED');
    await action('Open Historical controls').focus(); await p.keyboard.press('Enter'); await phase('EXPANDED');
    await p.waitForTimeout(4200); await phase('EXPANDED');
    await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => document.activeElement.className),'historical-date');
    await p.keyboard.press('Enter'); await phase('CALENDAR_OPEN');
    const originalDay = await p.locator('.calendar-day[tabindex="0"]').getAttribute('aria-label');
    await p.keyboard.press('ArrowRight'); assert.notEqual(await p.locator('.calendar-day[tabindex="0"]').getAttribute('aria-label'),originalDay);
    await p.keyboard.press('Escape'); await phase('EXPANDED');
    assert.equal(await p.evaluate(() => document.activeElement.className),'historical-date');
    await p.waitForTimeout(4200); await phase('EXPANDED');
    await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await phase('EXPANDED');
    await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await phase('EXPANDED');
    await p.mouse.click(10,300); await idle();
    await action('Open Historical controls').focus(); await p.keyboard.press('Enter'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
    await phase('CALENDAR_OPEN'); await anotherDate(); await action('Apply').focus(); await p.keyboard.press('Enter'); await phase('COLLAPSED');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')),'Open Historical controls');
    report.keyboard.push({keyboardHold:true,rovingDate:true,EscapeFocus:true,exactSteps:true,ApplyFocus:true,result:'PASS'});
    } else { await action('Historical').click(); await ready(); }
    // Immediate and next-frame checks across every existing width boundary.
    report.resize=[]; report.reduced=[];
    await p.setViewportSize({width:1440,height:900}); await phase('EXPANDED');
    const identity = await date.locator('time').getAttribute('datetime');
    const widths = [...new Set([...Array.from({length:101},(_,i)=>320+i*16),378,379,380,599,600,601,739,740,741,1242,1243,1244,1398,1399,1400,1920])].sort((a,b)=>a-b);
    for(const width of [...widths,...widths.toReversed()]) {
      await p.setViewportSize({width,height:800});
      for(const moment of ['immediate','next-frame']) {
        if(moment==='next-frame') await p.evaluate(() => new Promise(r=>requestAnimationFrame(r)));
        const s = await p.evaluate(snapshot); assert.deepEqual(s.geometry.failures,[]);
        for(const c of s.actions) { assert.equal(c.icon,width > 1243 || width <= 740); assert.equal(c.text,width > 740); }
        assert.equal(s.requested,identity);
        // setViewportSize can resolve before the browser delivers matchMedia's
        // change event. CSS is checked immediately; React normalization must
        // finish before the next rendered frame.
        if(moment==='next-frame') assert.equal(s.state,width <= 740 ? 'COLLAPSED':'EXPANDED');
        assert(await p.evaluate(() => __originalCanvas===document.querySelector('.earth-view canvas')));
        report.resize.push({width,moment,state:s.state,result:'PASS'});
      }
    }
    // A legitimately open calendar persists across mobile/tablet/desktop resizing.
    await p.setViewportSize({width:390,height:844}); await expand(); await calendar();
    for(const [width,height] of [[741,800],[1243,800],[1244,800],[320,568],[740,800]]) {
      await p.setViewportSize({width,height});
      // The portal recalculates its anchor in the native resize event. The
      // disclosure state can remain CALENDAR_OPEN across this boundary, so it
      // cannot serve as a signal that resize delivery has completed.
      await p.evaluate(() => new Promise(r=>requestAnimationFrame(r)));
      await phase('CALENDAR_OPEN');
      report.resize.push({width,height,calendarPreserved:true,barVisible:width > 740,result:'PASS'});
    }
    await action('Cancel').click(); await phase('EXPANDED');
    await p.setViewportSize({width:1244,height:800}); await p.waitForTimeout(4200); await phase('EXPANDED');
    await p.setViewportSize({width:390,height:844}); await phase('COLLAPSED');
    // Reduced motion uses the existing short opacity language; semantic idle delay stays four seconds.
    await p.emulateMedia({reducedMotion:'reduce'}); await expand();
    const motion = await date.evaluate(e=>({animation:getComputedStyle(e).animationName,duration:getComputedStyle(e).animationDuration}));
    assert.equal(motion.animation,'historical-disclosure-enter'); assert(parseFloat(motion.duration)<=.12);
    await idle(); await expand(); await calendar(); await action('Close Historical calendar').click(); await phase('EXPANDED'); await idle();
    report.reduced.push({motion,idleMs:4000,closeReturnsExpanded:true,result:'PASS'});
    // Real Crew and both textual source choices remain usable.
    await action('Current').click(); await ready(); await bar.waitFor({state:'detached'});
    await action('Crew').click(); await p.locator('.crew-roster-row').first().waitFor();
    assert.deepEqual((await p.evaluate(geometry)).failures,[]);
    await action('Close crew panel').click(); await p.locator('.crew-workspace-host').waitFor({state:'detached'});
    await p.getByLabel('Orbital source',{exact:true}).selectOption('PRIMARY_GP_TLE');
    assert.equal(await p.locator('.context-source-value').textContent(),'GP/TLE');
    if(!await p.locator('option[value="NASA_OEM"]').isDisabled()) {
      await p.getByLabel('Orbital source',{exact:true}).selectOption('NASA_OEM'); assert.equal(await p.locator('.context-source-value').textContent(),'NASA OEM');
    }
    report.regressions={Crew:true,GP:true,OEM:!await p.locator('option[value="NASA_OEM"]').isDisabled(),domainInstantPreserved:true,ViewerRetained:true};
    assert.deepEqual(report.errors,[]); assert.deepEqual(report.console,[]); report.result='PASS'; save();
  } finally { save(); await browser.close(); }
}
run().catch(e=>{ console.error(e); process.exitCode=1; });
