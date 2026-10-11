// Actual HTTP transport to an isolated production backend; response bodies remain untouched.
const transport = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs').chromium;
const launchOriginal = transport.launch.bind(transport);
transport.launch = async options => {
  const browser = await launchOriginal(options), create = browser.newPage.bind(browser);
  browser.newPage = async options => {
    const page = await create(options);
    await page.route('**/api/iss/**', async route => {
      const u = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: (process.env.MISSION1_QA_BACKEND || 'http://127.0.0.1:8081') + u.pathname + u.search }) });
    });
    return page;
  };
  return browser;
};
/* Presentation-only QA against real local API responses. Node 24 + existing
 * bundled Playwright; output defaults outside Git. No response substitution. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const [url = 'http://127.0.0.1:5175/', build = 'development'] = process.argv.slice(2);
const out = process.env.MISSION1_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'mission1-crew-navigation', build);
fs.mkdirSync(out, { recursive: true });
const sizes = [[1440,900],[1024,768],[768,1024],[390,844],[320,568]];
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
        await resize(1440,900);
        await page.getByRole('button',{name:'Close crew panel',exact:true}).click();
        await page.locator('.crew-workspace-host').waitFor({state:'detached'});
        await page.getByRole('button',{name:'Open Historical calendar',exact:true}).click();
        await page.getByRole('button',{name:'2026-10-02 UTC',exact:true}).click();
        await page.getByLabel('UTC hour',{exact:true}).selectOption('02');
        await page.getByLabel('UTC minute',{exact:true}).selectOption('01');
        await page.getByLabel('UTC second',{exact:true}).selectOption('55');
        await page.getByRole('button',{name:'Apply',exact:true}).click();
        await page.getByRole('button',{name:'Crew',exact:true}).click();
        await page.locator('.crew-historical .crew-roster-row').first().waitFor();
        await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');

      }
      assert.equal(await page.locator('.crew-roster-row').count(),mode === 'current' ? 7 : 10);
      for(const name of (mode === 'current' ? ['Luke Delaney','Jessica Watkins'] : ['Luke Delaney','Jessica Watkins','Jessica Meir']))assert.equal(await page.locator('.crew-roster-row').filter({hasText:name}).count(),1);
      for(const name of (mode === 'current' ? ['Anna Kikina','Anil Menon','Pyotr Dubrov','Jessica Watkins','Luke Delaney','Joshua Kutryk','Sergey Teteryatnikov'] : ['Luke Delaney','Jessica Watkins'])){
        await page.locator('.crew-roster-row').filter({hasText:name}).click();await detail().waitFor();
        await page.waitForFunction(()=>document.querySelector('.astronaut-profile-body,.crew-historical-profile-body')?.textContent?.includes('Biography'));
        assert(!(await detail().innerText()).includes('Structured profile unavailable'));
        await clear();
      }
      if(mode==='current') for(const name of ['Jessica Meir','Jack Hathaway','Sophie Adenot','Andrei Fedyaev']) assert.equal(await page.locator('.crew-roster-row').filter({hasText:name}).count(),0);
      for (const [width,height] of sizes) {
        if (mode === 'current') {
          const header = page.locator('.crew-roster-summary');
          assert.deepEqual(await header.locator('dt').allTextContents(), ['Current members']);
          assert.equal((await header.locator('dd').innerText()).trim(), '7');
          const text = await page.locator('.crew-panel-content').innerText();
          assert(!text.includes('Without confirmed identity'));
          assert(!text.includes('Presence outdated'));
          assert(text.includes('Presence not currently confirmed'));
          assert(text.includes('Current membership is known, but physical presence is not currently confirmed by operational evidence.'));
        }

        await resize(width,height);validate(await page.evaluate(geometry),false);await select();
        const g = await page.evaluate(geometry);validate(g);
        if (mode === 'current') {
          const text = await detail().innerText();
          assert(text.includes('Presence not currently confirmed'));
          assert(text.includes('Last operational confirmation: aboard'));
          assert(text.includes('Structured assignment does not confirm presence aboard.'));
          assert(!text.includes('Presence outdated')); assert(!text.includes('Last known:'));
        }
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
        const capture = true;
        if(capture) await page.locator('.crew-workspace .crew-panel-content').evaluate(n=>n.scrollTop=0);
        const clipped = await page.locator('.crew-detail-layout').evaluate(layout => {
          const bad = [];
          for (const n of layout.querySelectorAll('.crew-roster-summary dt,.crew-roster-summary dd,.crew-roster-presence > span,.crew-roster-presence small,.astronaut-presence-state,.astronaut-secondary,.crew-assessment-evidence > summary')) {
            const b=n.getBoundingClientRect(); if(!b.width || !b.height) continue;
            const range=document.createRange();range.selectNodeContents(n);
            const r=range.getBoundingClientRect();
            if(r.left<b.left-1 || r.right>b.right+1 || r.top<b.top-1 || r.bottom>b.bottom+1) bad.push({text:n.textContent,box:b.toJSON(),range:r.toJSON()});
          }
          return bad;
        }); assert.deepEqual(clipped, [], 'Clipped Crew text');
        if(capture) await page.screenshot({path:path.join(out,`${mode}-${width}x${height}.png`)});
        report.viewports.push({mode,width,height,geometry:g,scroll,result:'PASS'});
        await clear();assert.equal(await page.evaluate(()=>document.activeElement.dataset.memberId),id);validate(await page.evaluate(geometry),false);
        console.log(`${build} ${mode} ${width}x${height} PASS`);
      }
      await resize(390,844);await select();
      await page.evaluate(()=>{window.__crewRoster=document.querySelector('.crew-roster-rows');window.__crewSurface=document.querySelector('.crew-detail-surface');
        window.__crewProfile=document.querySelector('.astronaut-profile-body,.crew-profile');document.querySelector('.astronaut-profile-body,.crew-historical-profile-body').scrollTop=100;});
      await page.waitForTimeout(300);const requestCount=report.profileRequests.length, id=await detail().getAttribute('data-entity-id');
      let previousScroll=await detail().locator('.astronaut-profile-body,.crew-historical-profile-body').evaluate(n=>n.scrollTop);
      for (const width of [768,820,1024,741,740,430,320,932,844,1440,390]) {
        await resize(width,900);const g=await page.evaluate(geometry);validate(g);assert.equal(g.selected,id);
        assert(await page.evaluate(()=>window.__crewRoster===document.querySelector('.crew-roster-rows')&&window.__crewSurface===document.querySelector('.crew-detail-surface')
          &&window.__crewProfile===document.querySelector('.astronaut-profile-body,.crew-profile')));
        const scrollTop=await detail().locator('.astronaut-profile-body,.crew-historical-profile-body').evaluate(n=>n.scrollTop);
        const extent=await detail().locator('.astronaut-profile-body,.crew-historical-profile-body').evaluate(n=>n.scrollHeight-n.clientHeight);
        if(previousScroll>0&&extent>0)assert(scrollTop>0,'Scrollable profile keeps native scroll across resize');
        previousScroll=scrollTop;
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
