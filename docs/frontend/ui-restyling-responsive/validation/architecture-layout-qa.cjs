/* Layout stress only. DOM labels marked TEST ONLY never alter API or scene data.
 * Uses the existing real-backend browser/geometry helpers. No production hook.
 * node architecture-layout-qa.cjs URL BUILD OUTPUT
 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, viewer } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const { geometry } = require('./responsive-matrix.cjs');
const { scan } = require('../../inspection-module-hover/scripts/surface-scan.cjs');
const repo = path.resolve(__dirname,'../../../..');
const mappings = JSON.parse(fs.readFileSync(path.join(repo,'frontend/src/cesium/issModelManifest.json'))).semanticMappings;
const nodes = JSON.parse(fs.readFileSync(path.join(repo,'docs/frontend/inspection-orientation-review/asset-axes.json'))).nodes;
const [url = 'http://127.0.0.1:5175/', build = 'development', out = '/tmp/mission1-architecture-stress'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sizes = [[1440,900],[1024,600],[768,1024],[390,844],[320,568],[844,390]];
const report = { url, build, rootScaling: [], contentStress: [], containers: [], errors: [] };

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
  try {
    const p = await browser.newPage({ viewport: { width:1440, height:900 } });
    p.on('pageerror', e => report.errors.push(e.message));
    await p.goto(url); await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => !document.querySelector('[aria-label="ISS Inspection"]').disabled, null, { timeout:120000 });
    await p.evaluate(`window.__v=(${viewer.toString()})();window.__auditCanvas=__v.canvas;window.__model=Array.from({length:__v.scene.primitives.length},(_,i)=>__v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));window.__scan=false`);
    const action = name => p.getByRole('button', { name, exact:true });
    const ready = () => p.waitForFunction(() => document.querySelector('main').getAttribute('aria-busy') === 'false');
    async function resize(width, height) {
      await p.setViewportSize({ width, height }); await p.waitForTimeout(350);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    async function check(state) {
      for (const [width,height] of sizes) for (const scale of [1,1.25,1.5]) {
        await resize(width,height);
        await p.evaluate(s => document.documentElement.style.fontSize = `${16*s}px`, scale);
        const g = await p.evaluate(geometry);
        assert(await p.evaluate(() => __auditCanvas === document.querySelector('.earth-view canvas')));
        report.rootScaling.push({ state,width,height,scale,failures:g.failures });
      }
      await p.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await resize(1440,900);
    }
    async function stress(state, selector) {
      // Font growth is separate from root scaling: the frozen optical px type
      // otherwise would not grow. Record/restore each element before navigation.
      const original = await p.locator(selector).evaluateAll(es => es.map(e => ({text:e.textContent,style:e.getAttribute('style')})));
      for (const [width,height] of sizes) {
        await resize(width,height);
        await p.locator(selector).evaluateAll(es => es.forEach(e => {
          const c=getComputedStyle(e);e.style.fontSize=`${parseFloat(c.fontSize)*1.5}px`;
          if(c.lineHeight!=='normal')e.style.lineHeight=`${parseFloat(c.lineHeight)*1.5}px`;
          e.textContent='TEST ONLY long content / source identity / mission name '.repeat(2);
        }));
        const g = await p.evaluate(geometry);
        const close = await p.locator('.context-dock-header button,.crew-header-actions button').evaluateAll(es => es.filter(e => e.checkVisibility({visibilityProperty:true})).map(e => {
          const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {name:e.getAttribute('aria-label'),reachable:h===e||e.contains(h)};
        }));
        const textScroll = state==='module' ? await p.locator('.module-dock .context-dock-identity,.module-dock header h2,.module-dock .context-dock-identity p').evaluateAll(es => es.filter(e=>e.clientHeight>0 && e.scrollHeight>e.clientHeight+1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e=>{
          e.scrollTop=e.scrollHeight;
          const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let text,last;
          while((text=walker.nextNode()))if(text.textContent.trim())last=text;
          const range=document.createRange();range.selectNodeContents(last);const rects=[...range.getClientRects()],r=rects.at(-1),b=e.getBoundingClientRect();
          const reachable=e.scrollTop>0 && r.top>=b.top-1.5 && r.bottom<=b.bottom+1.5;
          e.scrollTop=0;return {selector:e.className||e.tagName,reachable};
        })) : [];
        report.contentStress.push({state,width,height,factor:1.5,failures:g.failures,close,textScroll});
        await p.screenshot({path:path.join(out,`${width}x${height}-${state}-stress.png`)});
        if(state==='module') {
          const footer=p.locator('.module-dock footer a').last();
          await footer.evaluate(e=>e.scrollIntoView({block:'end',inline:'nearest'}));
          const reachable=await footer.evaluate(e=>[...e.getClientRects()].some(r=>{const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===h||e.contains(h);}));
          report.contentStress.at(-1).footerReachable=reachable;
          await p.locator('.module-dock').evaluate(e=>e.scrollTop=0);
        }
        await p.locator(selector).evaluateAll((es,old) => es.forEach((e,i) => {
          e.textContent=old[i].text;if(old[i].style===null)e.removeAttribute('style');else e.setAttribute('style',old[i].style);
        }), original);
      }
      await resize(1440,900);
    }
    await check('current');
    await stress('summary','.summary-quality');
    await p.locator('.source-state-slot > summary').click();await check('provenance');
    await stress('provenance','.orbital-status-evidence .data-line dt,.orbital-status-evidence .data-line dd');
    await p.locator('.source-state-slot > summary').click();
    await action('Crew').click();await p.locator('.crew-roster-row').first().waitFor();await check('crew');
    await stress('crew','.crew-mission-context,.crew-roster-identity strong,.crew-roster-mission > span:last-child');
    await p.locator('.crew-roster-row').first().click();await p.locator('.astronaut-dock').waitFor();
    await p.locator('.astronaut-profile-body [role="status"]').waitFor({state:'detached'});await check('astronaut');
    await stress('astronaut','.astronaut-dock h2,.astronaut-dock .context-dock-identity p');
    await resize(1440,900);
    for (const width of [984,983,701,700]) {
      await p.locator('.crew-workspace').evaluate((e,w)=>{e.style.transition='none';e.style.width=`${w+48}px`;},width);
      const row=await p.locator('.crew-roster-row').first().evaluate(e=>getComputedStyle(e).gridTemplateAreas);
      report.containers.push({width,stacked:row.includes('portrait'),row});
      assert.equal(row.includes('portrait'),width<=700);
    }
    await p.locator('.crew-workspace').evaluate(e=>{e.style.removeProperty('width');e.style.removeProperty('transition');});
    await action('Close astronaut detail').click();await p.locator('.astronaut-dock').waitFor({state:'detached'});
    await action('Close crew panel').click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});
    await action('Historical').click();await ready();await check('historical');
    await action('Open Historical calendar').click();await p.locator('#historical-calendar').waitFor();await check('calendar');
    await p.keyboard.press('Escape');await p.locator('#historical-calendar').waitFor({state:'detached'});
    await action('Crew').click();await p.locator('.crew-roster-row').first().waitFor();await check('historical-crew');
    await action('Close crew panel').click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});
    await action('Current').click();await ready();await action('ISS Inspection').click();
    await p.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='ISS_INSPECTION');
    let picked=false;
    for(const mapping of mappings) {
      const hit=await p.evaluate(scan,{mapping,node:nodes.find(n=>n.index===mapping.nodeIndex)});
      if(hit){await p.mouse.click(hit.x,hit.y);picked=true;break;}
    }
    assert(picked,'No native module pick');await p.locator('.module-dock').waitFor();await check('module');
    await stress('module','.module-dock h2,.module-dock .context-dock-identity p,.module-dock .context-dock-footer p');
    const all=[...report.rootScaling,...report.contentStress];
    report.summary={rootObservations:report.rootScaling.length,stressObservations:report.contentStress.length,containerObservations:report.containers.length,
      failures:all.filter(e=>e.failures.length||e.close?.some(c=>!c.reachable)||e.textScroll?.some(t=>!t.reachable)||e.footerReachable===false)};
    console.log(JSON.stringify(report.summary));
    assert.deepEqual(report.summary.failures,[]);assert.deepEqual(report.errors,[]);report.result='PASS';
  } finally {
    fs.writeFileSync(path.join(out,'layout-stress.json'),JSON.stringify(report,null,2)+'\n');await browser.close();
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
