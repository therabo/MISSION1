/* Run against Vite and the real backend. No API fixtures or screenshot equality.
 * MISSION1_PLAYWRIGHT_MODULE=/path/to/playwright
 * MISSION1_QA_OUTPUT=/path/to/evidence node browser-responsive-qa.cjs [base-url]
 * The isolated Vite response adds a public SDK observation seam; repository
 * source, Viewer construction, camera/clock behavior and API data are untouched.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5175/';
const out = path.resolve(process.env.MISSION1_QA_OUTPUT || '/tmp/mission1-responsive-qa');
fs.mkdirSync(out, { recursive: true });
const matrix = [[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[360,800],[320,568],[844,390]];
const slotSelector = '.summary-identity,.summary-position > div,.source-state-slot';
const rect = r => ({ x:r.x,y:r.y,width:r.width,height:r.height });
async function layout(page) {
  return page.evaluate(slotSelector => {
    const box = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
    const keys=['.top-context-bar','.operational-summary','.trajectory-legend','.earth-scene-controls','.earth-scene-ui','.earth-view canvas'];
    const controls=[...document.querySelectorAll('.top-context-bar button,.top-context-bar select,.earth-scene-controls button,.source-state-slot > summary')].map(e=>({text:e.getAttribute('aria-label')||e.textContent.trim(),...box(e)}));
    const groups=['.context-identity','.context-spatial','.context-source-control','.context-temporal','.context-crew','.context-date'];
    const textClipping=[];
    for(const e of document.querySelectorAll('.summary-position dd,.summary-position dt,.summary-identity strong,.summary-identity span,.source-state-slot > summary,.context-date time,.context-source-value,.top-context-bar button')){
      const range=document.createRange(); range.selectNodeContents(e);
      const text=range.getBoundingClientRect(), parent=e.getBoundingClientRect();
      if(text.left<parent.left-1||text.right>parent.right+1||text.top<parent.top-1||text.bottom>parent.bottom+1)textClipping.push({text:e.textContent,...box(e)});
    }
    return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth,
      verticalOverflow:document.documentElement.scrollHeight>innerHeight,
      geometry:Object.fromEntries(keys.map(s=>[s,box(document.querySelector(s))])),controls,
      navGroups:groups.map(s=>({selector:s,...box(document.querySelector(s))})),textClipping,
      slots:[...document.querySelectorAll(slotSelector)].map(e=>({...box(e),text:e.querySelector('summary')?.textContent||e.innerText})),
      legend:[...document.querySelectorAll('.trajectory-legend > span')].map(e=>({text:e.textContent,color:getComputedStyle(e.querySelector('i')).backgroundColor})),
      source:document.querySelector('select[aria-label="Orbital source"]').value,
      sourceStatus:document.querySelector('.source-state-slot > summary').textContent,
      credit:box(document.querySelector('.cesium-viewer-bottom')),
      creditContent:[...document.querySelectorAll('.cesium-credit-textContainer,.cesium-credit-expand-link')].map(e=>box(e)).filter(r=>r.width>1&&r.height>1)};
  },slotSelector);
}
async function probe(page) {
  return page.evaluate(()=>{
    const test=globalThis.__mission1QA,v=test.viewers[0],vector=p=>[p.x,p.y,p.z];
    return {viewerCount:test.viewers.length,canvasSame:test.canvas===v.canvas,
      position:vector(v.camera.positionWC),direction:vector(v.camera.directionWC),up:vector(v.camera.upWC)};
  });
}
function sameCamera(a,b) { for(const k of ['position','direction','up']) assert.deepEqual(a[k],b[k],`Unexpected camera change: ${k}`); }
function overlaps(a,b) { return Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5; }
function checkLayout(state) {
  assert.equal(state.overflow,false,'Horizontal document overflow');
  assert.equal(state.verticalOverflow,false,'Vertical document overflow');
  assert.equal(state.slots.length,5);
  assert.equal(state.legend.length,1);
  assert.deepEqual(state.textClipping,[],'Core text clipped');
  for(const c of state.controls)assert(c.x>=-.5&&c.y>=-.5&&c.x+c.width<=state.width+.5&&c.y+c.height<=state.height+.5,`Control outside viewport: ${c.text}`);
  const g=state.geometry;
  for(const key of ['.trajectory-legend','.earth-scene-controls']){
    assert(!overlaps(g[key],g['.top-context-bar']),`${key} overlaps navigation`);
    assert(!overlaps(g[key],g['.operational-summary']),`${key} overlaps summary`);
  }
  assert(!overlaps(g['.top-context-bar'],g['.operational-summary']));
  assert(!overlaps(g['.trajectory-legend'],g['.earth-scene-controls']));
  for(let i=0;i<state.navGroups.length;i++)for(let j=i+1;j<state.navGroups.length;j++)assert(!overlaps(state.navGroups[i],state.navGroups[j]),`Navigation overlap: ${state.navGroups[i].selector}/${state.navGroups[j].selector}`);
  assert(g['.earth-scene-ui'].height>160,'Spatial workspace too small');
  if(state.width<1244)for(const c of state.controls)assert(c.height>=44,`Small touch target: ${c.text}`);
  assert(state.credit.y>=g['.top-context-bar'].height&&state.credit.y+state.credit.height<=g['.operational-summary'].y+.5,'Credits obscured');
  for(const key of ['.trajectory-legend','.earth-scene-controls'])for(const credit of state.creditContent)assert(!overlaps(credit,g[key]),`${key} overlaps credits: ${JSON.stringify(credit)} / ${JSON.stringify(g[key])}`);
}
function stableSlots(a,b) {
  for(let i=0;i<5;i++)for(const k of ['x','y','width','height'])assert(Math.abs(a.slots[i][k]-b.slots[i][k])<.1,`Source layout shift: slot ${i} ${k}`);
}
function desktopReference(s) {
  const expected={'.top-context-bar':[0,0,1440,64],'.operational-summary':[0,820,1440,80],'.earth-scene-controls':[1188,772,228,36],'.earth-view canvas':[0,0,1440,900]};
  for(const [key,values] of Object.entries(expected))for(const [i,k] of ['x','y','width','height'].entries())assert(Math.abs(s.geometry[key][k]-values[i])<.51,`Figma desktop regression: ${key} ${k}`);
  for(const [i,slot] of s.slots.entries()){assert(Math.abs(slot.x-(24+i*283.2))<.03);assert(Math.abs(slot.width-259.2)<.03);assert.equal(slot.y,841);assert.equal(slot.height,38);}
  for(const [selector,values] of [['.context-source-control',[506,14,128,36]],['.context-date',[680,14,220,36]]]){
    const group=s.navGroups.find(g=>g.selector===selector);for(const [i,k] of ['x','y','width','height'].entries())assert(Math.abs(group[k]-values[i])<.51,`Figma desktop regression: ${selector} ${k}`);
  }
  assert.equal(s.geometry['.trajectory-legend'].x,24);assert.equal(s.geometry['.trajectory-legend'].y,776);assert.equal(s.geometry['.trajectory-legend'].height,28);
}
async function canvasSamples(page) {
  return page.evaluate(async()=>{
    const samples=[];
    for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);const c=document.querySelector('.earth-view canvas'),r=c.getBoundingClientRect();samples.push([r.width,r.height,c.width,c.height]);}
    return samples;
  });
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
  const report={base,viewports:[],intermediateWidths:[],errors:[],resizeWarnings:[],touch:[],credits:[],reducedMotion:null};
  let page;
  try {
    page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,deviceScaleFactor:1});
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(/ResizeObserver/i.test(m.text()))report.resizeWarnings.push(m.text());});
    await page.addInitScript(()=>{globalThis.__mission1QA={viewers:[],canvas:null,animations:[]};const native=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.classList.contains('context-source-value'))globalThis.__mission1QA.animations.push(options);return native.call(this,frames,options);};});
    await page.route('**/src/cesium/EarthView.tsx',async route=>{
      const response=await route.fetch(),body=await response.text();
      assert(body.includes('viewer.current = instance;'),'Use the Vite development URL for public Viewer observation');
      await route.fulfill({response,body:body.replace('viewer.current = instance;','viewer.current = instance; globalThis.__mission1QA.viewers.push(instance); globalThis.__mission1QA.canvas = instance.canvas;')});
    });
    await page.goto(base);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.querySelector('.summary-position dd')?.textContent.includes('°'),null,{timeout:30000});
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled),null,{timeout:90000});
    const select=page.getByLabel('Orbital source',{exact:true});
    assert(await select.locator('option[value="NASA_OEM"]').evaluate(e=>!e.disabled),'Real NASA OEM must cover scene time for the source-switch matrix');
    const original=await probe(page);
    for(const [width,height] of matrix){
      await page.setViewportSize({width,height});await page.waitForTimeout(150);
      const samples=await canvasSamples(page); assert(samples.every(x=>JSON.stringify(x)===JSON.stringify(samples[0])),'Canvas dimensions oscillated');
      const gp=await layout(page);checkLayout(gp);sameCamera(original,await probe(page));
      assert.equal(gp.legend[0].text,'GP/TLE');assert.equal(gp.legend[0].color,'rgb(83, 217, 205)');
      await page.screenshot({path:path.join(out,`${width}x${height}-gp-tle.png`)});
      await select.selectOption('NASA_OEM');await page.waitForFunction(()=>document.querySelector('.summary-position dd')?.textContent.includes('°'));await page.waitForTimeout(250);
      const oem=await layout(page);checkLayout(oem);stableSlots(gp,oem);sameCamera(original,await probe(page));
      if(width===1440&&height===900){desktopReference(gp);desktopReference(oem);}
      assert.equal(oem.legend[0].text,'NASA OEM');assert.equal(oem.legend[0].color,'rgb(237, 184, 106)');
      assert(oem.sourceStatus.includes('NASA OEM status'));assert(!oem.sourceStatus.includes('General Perturbations'));
      await page.screenshot({path:path.join(out,`${width}x${height}-nasa-oem.png`)});
      await select.selectOption('PRIMARY_GP_TLE');await page.waitForTimeout(150);
      const returned=await layout(page);checkLayout(returned);stableSlots(gp,returned);sameCamera(original,await probe(page));
      const p=await probe(page);assert.equal(p.viewerCount,1);assert(p.canvasSame);
      // Native disclosure remains usable without colliding with responsive navigation.
      await page.locator('.source-state-slot > summary').click();
      const evidence=rect(await page.locator('.orbital-status-evidence').boundingBox());
      assert(evidence.y>=gp.geometry['.top-context-bar'].height,'Evidence overlaps navigation');
      assert(evidence.y+evidence.height<=height);await page.locator('.source-state-slot > summary').click();
      report.viewports.push({width,height,gp,oem,returned,canvasSamples:samples,viewer:p,evidence,result:'PASS'});
      fs.writeFileSync(path.join(out,'responsive-qa.json'),JSON.stringify(report,null,2));
      console.log(`${width}x${height}: PASS, stable 5 slots, single Viewer`);
    }
    // Breakpoint-adjacent widths ensure continuous reflow rather than exact-size hacks.
    for(const width of [321,379,380,599,600,601,739,740,741,767,1023,1243,1244,1399,1400]){
      await page.setViewportSize({width,height:800});await page.waitForTimeout(100);
      const s=await layout(page);checkLayout(s);sameCamera(original,await probe(page));report.intermediateWidths.push({width,result:'PASS'});
    }
    for(const viewport of [{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(150);
      const before=await probe(page),scene=(await layout(page)).geometry['.earth-scene-ui'];
      const cdp=await page.context().newCDPSession(page),x=viewport.width*.5,y=scene.y+scene.height*.45;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+50*i/10,y:y+20*i/10}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500);
      const after=await probe(page);assert.notDeepEqual(before.position,after.position,'Native touch drag did not change camera');
      await page.getByRole('button',{name:'Zoom in',exact:true}).tap();await page.waitForTimeout(350);
      const zoom=await probe(page);assert.notDeepEqual(after.position,zoom.position,'Touch zoom control did not work');
      assert.equal(zoom.viewerCount,1);assert(zoom.canvasSame);
      report.touch.push({...viewport,nativeDrag:true,zoomTap:true,viewerStable:true});
      await page.getByRole('button',{name:'Reset view',exact:true}).tap();await page.waitForTimeout(500);
      const credit=page.locator('.cesium-credit-expand-link');await credit.focus();await page.keyboard.press('Enter');
      await page.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor();
      await page.keyboard.press('Escape');
      assert((await credit.boundingBox()).height>=44,'Attribution touch target smaller than 44px');
      await credit.tap();await page.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor();
      report.credits.push({...viewport,keyboardDialog:true,touchDialog:true});await page.keyboard.press('Escape');
      await cdp.detach();
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    const count=await page.evaluate(()=>globalThis.__mission1QA.animations.length);
    await select.selectOption('NASA_OEM');
    report.reducedMotion=await page.evaluate(count=>({noNewAnimation:globalThis.__mission1QA.animations.length===count,source:document.querySelector('select[aria-label="Orbital source"]').value,legend:document.querySelector('.trajectory-legend').textContent}),count);
    assert(report.reducedMotion.noNewAnimation);assert.equal(report.reducedMotion.legend,'NASA OEM');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.resizeWarnings,[]);
  } finally {
    fs.writeFileSync(path.join(out,'responsive-qa.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
