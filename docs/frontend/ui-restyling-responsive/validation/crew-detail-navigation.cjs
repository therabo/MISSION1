/* Presentation-only QA against real local API responses. Node 24 + existing
 * bundled Playwright; output defaults outside Git. No response substitution. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const [url = 'http://127.0.0.1:5175/', build = 'development'] = process.argv.slice(2);
const out = process.env.MISSION1_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'mission1-crew-navigation', build);
fs.mkdirSync(out, { recursive: true });
const sizes = [[1920,1080],[1440,900],[1280,720],[1024,768],[900,700],[834,1194],[820,1180],[768,1024],
  [430,932],[412,915],[390,844],[375,812],[360,800],[320,568],[932,430],[844,390]];
const report = { build, url, viewports: [], resize: [], container: [], errors: [], profileRequests: [] };

function geometry() {
  const box = n => { const r = n.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
  const visible = n => !!n && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().width > 0;
  const layout = document.querySelector('.crew-detail-layout'), roster = layout.querySelector('.crew-workspace');
  const detail = layout.querySelector('.crew-detail-surface'), heading = detail?.querySelector('header h2,header h3');
  const back = detail?.querySelector('[aria-label="Back to Crew"]'), close = detail?.querySelector('[aria-label="Close astronaut detail"]');
  const overflow = [...layout.querySelectorAll('.crew-panel-content,.crew-detail-surface,.astronaut-profile-body,.crew-historical-profile-body')]
    .filter(visible).filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.className);
  const collision = [...roster.querySelectorAll('.crew-roster-row')].filter(visible).flatMap(row => [...row.children]
    .filter(visible).filter(n => { const a=box(row),b=box(n);return b.x<a.x-1 || b.right>a.right+1 || b.y<a.y-1 || b.bottom>a.bottom+1; }).map(n=>n.className));
  return { container:box(document.querySelector('.crew-workspace-group')), roster:box(roster), rosterVisible:visible(roster),
    detail:detail && box(detail), heading:heading && box(heading), back:back && box(back), close:close && box(close), backVisible:visible(back),
    overflow, collision, documentOverflow:document.documentElement.scrollWidth > innerWidth,
    selector:!!detail?.querySelector('select'), selected:layout.dataset.selectedMemberId,
    controls:detail && [...detail.querySelectorAll('header button')].map(n=>({label:n.getAttribute('aria-label'),text:n.textContent,svgHidden:n.querySelector('svg')?.getAttribute('aria-hidden')})),
    boxes:Object.fromEntries(['.crew-workspace-host','.crew-workspace','.astronaut-dock','.context-dock-header','.astronaut-profile-body','.context-dock-footer']
      .map(s=>{const n=document.querySelector(s);return[s,n?Object.values(box(n)).slice(0,4):null];})) };
}
function validate(g, selected = true) {
  assert(!g.documentOverflow, 'Document horizontal overflow'); assert.deepEqual(g.overflow, [], 'Crew horizontal overflow');
  assert.deepEqual(g.collision, [], 'Roster cell collision');
  if (!selected) { assert(g.rosterVisible); return; }
  const mobile = g.container.width <= 716;
  assert.equal(g.rosterVisible, !mobile); assert.equal(g.backVisible, mobile); assert(!g.selector);
  assert(g.detail.x >= g.container.x - 1 && g.detail.right <= g.container.right + 1, JSON.stringify(g));
  assert(g.detail.y >= g.container.y - 1 && g.detail.bottom <= g.container.bottom + 1);
  if (mobile) {
    assert.equal(g.back.y,g.close.y); assert(g.back.bottom <= g.heading.y);
    assert(g.back.width >= 44 && g.back.height >= 44 && g.close.width >= 44 && g.close.height >= 44);
    assert.equal(g.controls.find(c=>c.label==='Back to Crew').text,'');
    assert.equal(g.controls.find(c=>c.label==='Back to Crew').svgHidden,'true');
  } else {
    assert(g.roster.right < g.detail.x, 'Roster and detail must be separate columns');
    assert(g.heading.right <= g.close.x, 'Astronaut title and Close must not collide');
  }
}
(async () => {
  const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>report.errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('request',r=>{if(/\/api\/iss\/crew\/[^/?]+$/.test(r.url()))report.profileRequests.push(r.url());});
    await page.goto(url); await page.getByRole('button',{name:'Crew',exact:true}).click();
    await page.locator('.crew-roster-row').first().waitFor(); await page.waitForTimeout(300);
    const resize = async (width,height) => {await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
    const detail = () => page.locator('.crew-detail-surface');
    const first = () => page.locator('.crew-roster-row').first();
    const select = async () => {await first().focus();await page.keyboard.press('Enter');await detail().waitFor();await detail().evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
    const clear = async () => {await detail().getByRole('button',{name:'Close astronaut detail',exact:true}).click();await detail().waitFor({state:'detached'});};
    for (const mode of ['current','historical']) {
      if (mode==='historical') {
        await page.getByRole('button',{name:'Historical',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
        await page.locator('.crew-historical .crew-roster-row').first().waitFor();
      }
      for (const [width,height] of sizes) {
        await resize(width,height);validate(await page.evaluate(geometry),false);await select();
        const g = await page.evaluate(geometry);validate(g);
        const id=g.selected;assert.equal(await detail().getAttribute('data-entity-id'),id);
        assert.equal(await page.evaluate(()=>document.activeElement?.textContent),await detail().locator('header h2,header h3').innerText());
        if (g.container.width<=716) {
          assert.equal(await page.getByRole('button',{name:'Back to Crew',exact:true}).count(),1);
          assert.equal(await page.getByRole('button',{name:/open profile/}).count(),0);
          await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Back to Crew');
          await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close astronaut detail');
          await detail().getByRole('button',{name:'Back to Crew',exact:true}).click();await detail().waitFor({state:'detached'});
          assert.equal(await page.evaluate(()=>document.activeElement.dataset.memberId),id);validate(await page.evaluate(geometry),false);
          await select();
        } else {
          assert.equal(await page.getByRole('button',{name:'Back to Crew',exact:true}).count(),0);
          await page.evaluate(()=>{window.__crewSurface=document.querySelector('.crew-detail-surface');});
          const second=page.locator('.crew-roster-row').nth(1), next=await second.getAttribute('data-member-id');await second.click();
          assert.equal(await detail().getAttribute('data-entity-id'),next);
          assert(await page.evaluate(()=>window.__crewSurface===document.querySelector('.crew-detail-surface')));
          // Return to the baseline astronaut for desktop geometry comparison.
          await page.locator('.crew-roster-row').last().focus();await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close astronaut detail');
          await first().click();await page.waitForTimeout(120);
        }
        // Scroll each profile with its actual scroll owner, keeping header/Close reachable.
        const scroll = await detail().evaluate(n=>{const b=n.querySelector('.astronaut-profile-body,.crew-historical-profile-body');
          const s=getComputedStyle(n).overflowY==='auto'?n:b;s.scrollTop=s.scrollHeight;return {scrollable:s.scrollHeight>s.clientHeight,atEnd:s.scrollTop+s.clientHeight>=s.scrollHeight-1};});
        assert(scroll.atEnd);await detail().evaluate(n=>{n.scrollTop=0;const b=n.querySelector('.astronaut-profile-body,.crew-historical-profile-body');b.scrollTop=0;});
        const capture = build==='development' && (mode==='current'&&width===1440 || mode==='historical'&&width===768)
          || build==='production' && (mode==='current'&&width===390 || mode==='historical'&&width===320);
        if(capture) await page.locator('.crew-workspace .crew-panel-content').evaluate(n=>n.scrollTop=0);
        if(capture) await page.screenshot({path:path.join(out,`${mode}-${width}x${height}.png`)});
        report.viewports.push({mode,width,height,geometry:g,scroll,result:'PASS'});
        await clear();assert.equal(await page.evaluate(()=>document.activeElement.dataset.memberId),id);validate(await page.evaluate(geometry),false);
        console.log(`${build} ${mode} ${width}x${height} PASS`);
      }
      await resize(390,844);await select();
      await page.evaluate(()=>{window.__crewRoster=document.querySelector('.crew-roster-rows');window.__crewSurface=document.querySelector('.crew-detail-surface');
        window.__crewProfile=document.querySelector('.astronaut-profile-body,.crew-profile');document.querySelector('.astronaut-profile-body,.crew-historical-profile-body').scrollTop=100;});
      await page.waitForTimeout(300);const requestCount=report.profileRequests.length, id=await detail().getAttribute('data-entity-id');
      for (const width of [768,820,1024,741,740,430,320,932,844,1440,390]) {
        await resize(width,900);const g=await page.evaluate(geometry);validate(g);assert.equal(g.selected,id);
        assert(await page.evaluate(()=>window.__crewRoster===document.querySelector('.crew-roster-rows')&&window.__crewSurface===document.querySelector('.crew-detail-surface')
          &&window.__crewProfile===document.querySelector('.astronaut-profile-body,.crew-profile')));
        const scrollTop=await detail().locator('.astronaut-profile-body,.crew-historical-profile-body').evaluate(n=>n.scrollTop);
        assert(scrollTop>0, 'Resize must not reset profile scroll; native anchoring may follow text reflow');
        report.resize.push({mode,width,container:g.container.width,rosterVisible:g.rosterVisible,sameDom:true,scrollTop,result:'PASS'});
      }
      assert.equal(report.profileRequests.length,requestCount, 'Resize must not refetch profile');
      // Container isolation: wide viewport, narrow host; native resize needs no JS state.
      await resize(1440,900);
      for(const width of [716,717,600,900]) {
        await page.locator('.crew-workspace-host').evaluate((n,w)=>{n.style.width=`${w}px`;},width);
        const g=await page.evaluate(geometry);validate(g);assert.equal(g.selected,id);report.container.push({mode,width,mobile:g.backVisible,result:'PASS'});
      }
      await page.locator('.crew-workspace-host').evaluate(n=>n.style.removeProperty('width'));await clear();
      assert.equal(report.profileRequests.length,requestCount);
    }
    await page.close();
    report.touch=[];
    const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
    touch.on('pageerror',e=>report.errors.push(e.message));touch.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await touch.goto(url);await touch.getByRole('button',{name:'Crew',exact:true}).tap();await touch.locator('.crew-roster-row').first().waitFor();
    for(const mode of ['current','historical']) {
      if(mode==='historical') {await touch.getByRole('button',{name:'Historical',exact:true}).tap();
        await touch.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');await touch.locator('.crew-roster-row').first().waitFor();}
      for(const [width,height] of [[390,844],[320,568],[768,1024]]) {
        await touch.setViewportSize({width,height});const row=touch.locator('.crew-roster-row').first(),id=await row.getAttribute('data-member-id');await row.tap();
        await touch.locator('.crew-detail-surface').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));validate(await touch.evaluate(geometry));
        const label=width<=740?'Back to Crew':'Close astronaut detail';await touch.getByRole('button',{name:label,exact:true}).tap();
        await touch.locator('.crew-detail-surface').waitFor({state:'detached'});assert.equal(await touch.evaluate(()=>document.activeElement.dataset.memberId),id);
        report.touch.push({mode,width,height,reducedMotion:true,result:'PASS'});
      }
    }
    await touch.close();assert.deepEqual(report.errors,[]);report.result='PASS';
    fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));
  } catch(e) {report.result='FAIL';report.failure=e.stack;fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));throw e;}
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
