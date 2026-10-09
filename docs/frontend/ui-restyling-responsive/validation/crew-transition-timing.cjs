/* Real local API + native Cesium QA. No response substitution or animation clock
 * manipulation. Node 24; screenshots/logs default outside Git. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, viewer, observe } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const [url = 'http://127.0.0.1:5175/', build = 'development', out = path.join(require('node:os').tmpdir(), 'mission1-crew-timing', build), scope = 'all'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sizes = [[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]];
const report = { build, url, flows: [], errors: [] };
function layout() {
  const box = n => { const r = n.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
  const visible = n => n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().width > 0;
  const roster = document.querySelector('.crew-workspace'), summary = roster?.querySelector('.crew-roster-summary');
  const detail = document.querySelector('.crew-detail-surface'), group = document.querySelector('.crew-workspace-group');
  const overflow = [...document.querySelectorAll('.crew-panel-content,.astronaut-profile-body,.crew-historical-profile-body,.crew-detail-surface')]
    .filter(visible).filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.className);
  return { documentOverflow: document.documentElement.scrollWidth > innerWidth, overflow,
    padding: summary && parseFloat(getComputedStyle(summary).paddingBlockEnd),
    dividerGap: summary && box(summary).bottom - parseFloat(getComputedStyle(summary).borderBottomWidth) - Math.max(...[...summary.children].map(n => box(n).bottom)),
    groupWidth: group && box(group).width, rosterVisible: visible(roster), backVisible: visible(detail?.querySelector('[aria-label="Back to Crew"]')),
    detail: detail && box(detail), footer: detail?.querySelector('footer') && box(detail.querySelector('footer')) };
}
function validate(g) {
  assert(!g.documentOverflow); assert.deepEqual(g.overflow, []);
  if (g.padding !== null) { assert.equal(g.padding,12); assert(g.dividerGap >= 11.9 && g.dividerGap <= 12.1, JSON.stringify(g)); }
  if(g.detail) { assert.equal(g.rosterVisible,g.groupWidth > 716); assert.equal(g.backVisible,g.groupWidth <= 716); }
}
function instrument() {
  window.__crewTiming = null; window.__canvasEvents = [];
  const canvas = __v.canvas; window.__initialCanvas = canvas;
  for (const event of ['pointerdown','wheel']) canvas.addEventListener(event, e => __canvasEvents.push({event,time:performance.now()}), true);
  document.querySelector('#crew-launcher').addEventListener('click', () => {
    if(document.querySelector('.crew-workspace-host')?.dataset.state === 'open') return;
    const timing = window.__crewTiming = {start:performance.now(),frames:[]};
    const sample = () => {
      const mode = document.querySelector('main').dataset.viewMode, host = document.querySelector('.crew-workspace-host');
      const at = performance.now()-timing.start;
      if(mode==='EXITING_INSPECTION' && timing.exitStarted===undefined) timing.exitStarted=at;
      if(host && timing.dom===undefined) timing.dom=at;
      if(host && Number(getComputedStyle(host).opacity)>0 && timing.visible===undefined) timing.visible=at;
      const close = host?.querySelector('[aria-label="Close crew panel"]');
      if(close && !host.inert && timing.interactive===undefined) {
        const r=close.getBoundingClientRect();if(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===close) timing.interactive=at;
      }
      const c=__v.camera;timing.frames.push({at,mode,position:[c.positionWC.x,c.positionWC.y,c.positionWC.z]});
      if(mode==='EARTH_OVERVIEW') {timing.complete=at;return;}
      requestAnimationFrame(sample);
    }; sample();
  }, true);
}
function moduleHit() {
  // Search from the model's actual projected centre, limiting GPU readbacks.
  const c=__v.camera,r=__v.canvas.getBoundingClientRect(),a=__model.boundingSphere.center;
  const world=[a.x,a.y,a.z,1],p=c.viewMatrix,m=c.frustum.projectionMatrix;
  const eye=[0,1,2,3].map(i=>world.reduce((n,w,j)=>n+p[j*4+i]*w,0));
  const clip=[0,1,2,3].map(i=>eye.reduce((n,w,j)=>n+m[j*4+i]*w,0));
  const sx=r.width*(clip[0]/clip[3]+1)/2,sy=r.height*(1-clip[1]/clip[3])/2;
  const offsets=[0,...Array.from({length:12},(_,i)=>[(i+1)*5,-(i+1)*5]).flat()];
  for(const dy of offsets)for(const dx of offsets) {
    const x=sx+dx,y=sy+dy;if(document.elementFromPoint(x,y)!==__v.canvas)continue;
    const hit=__v.scene.pick({x,y});if(typeof hit?.featureId==='number'&&hit.getProperty?.('moduleCode')) return {x,y,featureId:hit.featureId};
  }
  return null;
}
(async () => {
  const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>report.errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(url);await page.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled,null,{timeout:90000});
    await page.evaluate(`window.__v=(${viewer.toString()})();`); await page.evaluate(instrument);
    const action = name => page.getByRole('button',{name,exact:true});
    const mode = name => page.waitForFunction(m=>document.querySelector('main').dataset.viewMode===m,name);
    const enter = async () => {await action('ISS Inspection').click();await mode('ISS_INSPECTION');};
    const isExiting = async label => {assert.equal(await page.locator('main').getAttribute('data-view-mode'),'EXITING_INSPECTION',label);};
    const closeCrew = async () => {await action('Close crew panel').click();await page.locator('.crew-workspace-host').waitFor({state:'detached'});};
    for(const context of scope==='supplemental' ? [] : scope==='historical' ? ['historical'] : ['current','historical']) {
      if(context==='historical') {await action('Historical').click();await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');}
      for(const [width,height] of sizes) {
        console.log(`${build} ${context} ${width}x${height} start`);
        await page.setViewportSize({width,height});
        // Earth -> Crew still opens immediately and uses the same responsive layout.
        await action('Crew').click();await page.locator('.crew-roster-row').first().waitFor();validate(await page.evaluate(layout));await closeCrew();
        await enter();
        if(width===1440 && context==='current') {
          await page.evaluate(()=>{window.__model=Array.from({length:__v.scene.primitives.length},(_,i)=>__v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));});
          const hit=await page.evaluate(moduleHit);assert(hit,'Inspection native module hit');
          await page.mouse.move(hit.x,hit.y);await page.waitForFunction(()=>__v.canvas.style.cursor==='pointer');
          await page.mouse.click(hit.x,hit.y);await page.locator('.module-dock').waitFor();await action('Close module information').click();
          // Existing Inspection Back still returns through the accepted renderer path.
          await action('Earth').click();await mode('EARTH_OVERVIEW');await enter();
        }
        await page.evaluate(()=>__canvasEvents.length=0);
        await action('Crew').click();
        await page.waitForFunction(()=>__crewTiming?.visible!==undefined&&__crewTiming?.interactive!==undefined);
        await isExiting('Crew must be available before completion');
        const row = page.locator('.crew-roster-row').first();await row.waitFor();
        validate(await page.evaluate(layout));
        // Real wheel goes to Crew's scroll owner, never to Cesium.
        const content=page.locator('.crew-panel-content'), rect=await content.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
        await page.mouse.wheel(0,350);await page.waitForTimeout(100);
        const scrolled=await content.evaluate(n=>n.scrollTop);assert(scrolled>0,'Crew scroll during exit');
        await content.evaluate(n=>n.scrollTop=0);
        const disclosure=page.locator(context==='current'?'.crew-roster-evidence > details > summary':'.crew-historical-evidence > summary');await disclosure.click();await isExiting('Crew disclosure during exit');
        assert(await disclosure.evaluate(n=>n.parentElement.open));await disclosure.click();
        await row.click();await page.locator('.crew-detail-surface').waitFor();await isExiting('Astronaut selection during exit');
        const firstInteraction=await page.evaluate(()=>performance.now()-__crewTiming.start);
        let detail=page.locator('.crew-detail-surface');const id=await detail.getAttribute('data-entity-id');
        validate(await page.evaluate(layout));
        if(width<=740) {await action('Back to Crew').click();await detail.waitFor({state:'detached'});await isExiting('Mobile Back during exit');await row.click();}
        await action('Close astronaut detail').click();await detail.waitFor({state:'detached'});await isExiting('Profile Close during exit');await row.click();
        detail=page.locator('.crew-detail-surface');await detail.waitFor();
        const evidence=detail.locator('details').filter({has:page.locator('summary', {hasText:'Profile source & presence evidence'})});
        await evidence.waitFor();assert.equal(await detail.getByRole('button',{name:'Profile source & presence evidence',exact:true}).count(),0);
        assert.equal(await detail.getByRole('link',{name:'Profile source & presence evidence',exact:true}).count(),0);
        // Short viewport scrolls the whole dock; tall viewport scrolls its body.
        await detail.evaluate(n=>{const b=n.querySelector('.astronaut-profile-body,.crew-historical-profile-body');const owner=getComputedStyle(n).overflowY==='auto'?n:b;owner.scrollTop=owner.scrollHeight;});
        await evidence.locator('summary').click();assert(await evidence.evaluate(n=>n.open));await isExiting('Profile evidence disclosure during exit');
        const evidenceText=await evidence.innerText();assert(evidenceText.includes('Profile last successful fetch'));assert(evidenceText.includes('Original profile observation'));
        await page.evaluate(()=>{window.__savedCrew=document.querySelector('.crew-workspace');window.__savedDetail=document.querySelector('.crew-detail-surface');window.__savedProfile=__savedDetail.querySelector('.astronaut-profile-body,.crew-historical-profile-body');});
        await mode('EARTH_OVERVIEW');
        assert.equal(await detail.getAttribute('data-entity-id'),id);
        assert(await page.evaluate(()=>__savedCrew===document.querySelector('.crew-workspace')&&__savedDetail===document.querySelector('.crew-detail-surface')&&__savedProfile===__savedDetail.querySelector('.astronaut-profile-body,.crew-historical-profile-body')));
        assert(await evidence.evaluate(n=>n.open));assert.deepEqual(await page.evaluate(()=>__canvasEvents),[],'Crew events must not reach Cesium');
        const timing=await page.evaluate(()=>__crewTiming);assert(timing.visible<timing.complete/4&&timing.interactive<timing.complete/4);assert(firstInteraction<timing.complete);
        assert(timing.complete>4000,'Accepted exit remains long');
        assert(timing.frames.some((f,i,a)=>i&&f.position.some((x,j)=>Math.abs(x-a[i-1].position[j])>1)),'Background camera moved');
        const framing=await page.evaluate(observe);assert(framing.error<1,'Existing workspace framing');
        const g=await page.evaluate(layout);validate(g);if(g.footer)assert(g.footer.height<100,'No reserved shortcut footer height');
        const capture=build==='development'&&(context==='current'&&width===1440||context==='historical'&&width===768)||build==='production'&&context==='historical'&&width===390;
        if(build==='production'&&context==='current'&&width===1440) await page.screenshot({path:path.join(out,'current-1440-evidence.png')});
        if(capture) {await detail.evaluate(n=>{n.scrollTop=0;n.querySelector('.astronaut-profile-body,.crew-historical-profile-body').scrollTop=0;});await page.screenshot({path:path.join(out,`${context}-${width}-detail.png`)});}
        await action('Close astronaut detail').click();await detail.waitFor({state:'detached'});
        if(build==='production'&&context==='current'&&width===320) {await content.evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(out,'current-320-roster.png')});}
        await closeCrew();
        // Close the entire surface before the camera finishes; completion cannot reopen it.
        await enter();await action('Crew').click();await isExiting('Close Crew scenario');await closeCrew();await isExiting('Crew closed before completion');
        await mode('EARTH_OVERVIEW');assert.equal(await page.locator('.crew-workspace-host').count(),0);assert.equal(await action('Crew').getAttribute('aria-expanded'),'false');
        assert(await page.evaluate(()=>__initialCanvas===document.querySelector('.earth-view canvas')&&document.querySelectorAll('.cesium-viewer').length===1));
        report.flows.push({context,width,height,geometry:g,timing:{dom:timing.dom,visible:timing.visible,interactive:timing.interactive,exitStarted:timing.exitStarted,firstAstronautSelection:firstInteraction,complete:timing.complete},cameraFrames:timing.frames.length,framingError:framing.error,scrollTop:scrolled,closeDuringExit:true,result:'PASS'});
        fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(`${build} ${context} ${width}x${height} PASS ${JSON.stringify(report.flows.at(-1).timing)}`);
      }
    }
    report.boundaries=[];
    await page.setViewportSize({width:1440,height:900});
    for(const context of ['current','historical']) {
      await action(context==='current'?'Current':'Historical').click();await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
      await action('Crew').click();await page.locator('.crew-roster-row').first().waitFor();await page.locator('.crew-roster-row').first().click();await page.locator('.crew-detail-surface').waitFor();
      const id=await page.locator('.crew-detail-surface').getAttribute('data-entity-id');
      for(const width of [716,717]) {
        await page.locator('.crew-workspace-host').evaluate((n,w)=>n.style.width=`${w}px`,width);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const geometry=await page.evaluate(layout);validate(geometry);assert.equal(geometry.groupWidth,width);
        assert.equal(await page.locator('.crew-detail-surface').getAttribute('data-entity-id'),id);report.boundaries.push({context,width,geometry,result:'PASS'});
      }
      await page.locator('.crew-workspace-host').evaluate(n=>n.style.removeProperty('width'));await action('Close astronaut detail').click();await page.locator('.crew-detail-surface').waitFor({state:'detached'});await closeCrew();
    }
    report.touch=[];
    const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    touch.on('pageerror',e=>report.errors.push(e.message));touch.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await touch.goto(url);await touch.waitForFunction(()=>!document.querySelector('[aria-label="ISS Inspection"]').disabled,null,{timeout:90000});
    for(const context of ['current','historical']) {
      if(context==='historical') {await touch.getByRole('button',{name:'Historical',exact:true}).tap();await touch.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');}
      await touch.getByRole('button',{name:'ISS Inspection',exact:true}).tap();await touch.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='ISS_INSPECTION');
      await touch.getByRole('button',{name:'Crew',exact:true}).tap();await touch.locator('.crew-roster-row').first().waitFor();
      await touch.locator('.crew-roster-row').first().tap();await touch.locator('.crew-detail-surface').waitFor();
      await touch.getByRole('button',{name:'Back to Crew',exact:true}).tap();await touch.locator('.crew-detail-surface').waitFor({state:'detached'});
      await touch.getByRole('button',{name:'Close crew panel',exact:true}).tap();assert.equal(await touch.locator('main').getAttribute('data-view-mode'),'EXITING_INSPECTION');
      await touch.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='EARTH_OVERVIEW');assert.equal(await touch.locator('.crew-workspace-host').count(),0);
      report.touch.push({context,width:390,height:844,backDuringExit:true,closeDuringExit:true,result:'PASS'});
    }
    await touch.close();assert.deepEqual(report.errors,[]);report.result='PASS';fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));
  } catch(e) {report.result='FAIL';report.failure=e.stack;fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));throw e;}
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
