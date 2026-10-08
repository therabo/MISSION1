/* UI-only QA. Real backend responses; no fabricated station/orbit/profile facts.
 * Read-only public Cesium observations use the existing QA Viewer lookup.
 * Node 24; MISSION1_PLAYWRIGHT_MODULE may point to the bundled Playwright.
 * node responsive-matrix.cjs URL development|production golden|audit|final
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, viewer, observe } = require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const { scan } = require('../../inspection-module-hover/scripts/surface-scan.cjs');
const root = path.resolve(__dirname, '../../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/cesium/issModelManifest.json')));
const nodes = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/inspection-orientation-review/asset-axes.json'))).nodes;
const [url = 'http://127.0.0.1:5175/', build = 'development', phase = 'audit'] = process.argv.slice(2);
const out = path.resolve(process.env.MISSION1_QA_OUTPUT || path.join(__dirname, phase, build));
fs.mkdirSync(out, { recursive: true });
const matrix = [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[900,700],
  [834,1194],[820,1180],[768,1024],[430,932],[412,915],[390,844],[375,812],[360,800],[320,568],
  [1920,700],[1024,600],[844,390],[932,430]];
const selectedMatrix = process.env.MISSION1_QA_VIEWPORTS ? JSON.parse(process.env.MISSION1_QA_VIEWPORTS) : phase === 'golden' ? [[1440,900]] : matrix;
const revalidateStates = process.env.MISSION1_QA_STATES?.split(',');

function geometry() {
  const box = e => { const r = e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
  const visible = e => e.checkVisibility({visibilityProperty:true}) && !e.closest('[inert],.sr-only') && e.getBoundingClientRect().width > 1;
  const overlap = (a,b) => Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1 && Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1;
  const inside = (a,b) => a.x>=b.x-1 && a.y>=b.y-1 && a.x+a.width<=b.x+b.width+1 && a.y+a.height<=b.y+b.height+1;
  const screen = {x:0,y:0,width:innerWidth,height:innerHeight};
  const failures = [];
  const canvas = document.querySelector('.earth-view canvas');
  const areas = {};
  for (const s of ['.top-context-bar','.earth-scene-ui','.operational-summary','.inspection-strip','.trajectory-legend','.earth-scene-controls',
    '.historical-time-bar','#historical-calendar','.orbital-status-evidence','.crew-workspace-host','.crew-workspace','.astronaut-dock','.module-dock','.cesium-credit-lightbox']) {
    const e=document.querySelector(s); if(e && visible(e)) areas[s]=box(e);
  }
  if(document.documentElement.scrollWidth>document.documentElement.clientWidth || document.body.scrollWidth>innerWidth) failures.push('Horizontal page overflow');
  if(document.documentElement.scrollHeight>innerHeight || document.body.scrollHeight>innerHeight) failures.push('Vertical page overflow');
  if(!canvas || !inside(box(canvas),screen) || box(canvas).width!==innerWidth || box(canvas).height!==innerHeight) failures.push('Canvas does not fill shell');
  for(const [s,b] of Object.entries(areas)) if(!inside(b,screen)) failures.push('Surface outside viewport: '+s);
  const groups=[...document.querySelectorAll('.context-identity,.context-spatial,.context-source,.context-date,.context-temporal,.context-crew')].filter(visible).map(box);
  for(let i=0;i<groups.length;i++) for(let j=i+1;j<groups.length;j++) if(overlap(groups[i],groups[j])) failures.push('Navigation group overlap '+i+'/'+j);
  // Measure the union of visible text ranges, not the spanning date wrapper.
  const dateRects=[];
  const dateWalker=document.createTreeWalker(document.querySelector('.context-date'),NodeFilter.SHOW_TEXT); let dateText;
  while((dateText=dateWalker.nextNode())) if(dateText.textContent.trim() && visible(dateText.parentElement)) {
    const range=document.createRange();range.selectNodeContents(dateText);dateRects.push(...range.getClientRects());
  }
  const dateCenterX=(Math.min(...dateRects.map(r=>r.left))+Math.max(...dateRects.map(r=>r.right)))/2;
  const dateDelta=Math.abs(dateCenterX-innerWidth/2);
  if(innerWidth<=1243 && dateDelta>2) failures.push('Visible date is not viewport-centered: '+dateDelta);
  const navigation={dateCenterX,viewportCenterX:innerWidth/2,dateDelta,
    groups:[...document.querySelectorAll('.context-identity,.context-spatial,.context-source,.context-temporal,.context-crew')].map(e=>({name:e.className,...box(e)}))};
  const calendar=document.querySelector('#historical-calendar');
  const calendarPosition=calendar && visible(calendar) ? {mode:document.querySelector('.historical-time-bar').dataset.mobile==='true'?'compact':'persistent',
    centerX:box(calendar).x+box(calendar).width/2,viewportCenterX:innerWidth/2,
    delta:Math.abs(box(calendar).x+box(calendar).width/2-innerWidth/2),top:box(calendar).y,bottom:box(calendar).y+box(calendar).height} : null;
  if(calendarPosition?.mode==='compact' && calendarPosition.delta>2) failures.push('Compact calendar is not viewport-centered: '+calendarPosition.delta);
  if(calendarPosition?.mode==='compact' && visible(document.querySelector('.historical-time-bar'))) failures.push('Compact calendar leaves its bar visible');
  const crewHeader=document.querySelector('.crew-workspace .crew-panel-header');
  if(crewHeader && visible(crewHeader) && [...crewHeader.querySelectorAll('button')].some(b=>/^(Refresh|Refreshing…)$/.test(b.textContent.trim()))) failures.push('Routine Crew Refresh remains');
  const tools=['.trajectory-legend','.earth-scene-controls','.historical-time-bar'];
  for(let i=0;i<tools.length;i++) for(let j=i+1;j<tools.length;j++) if(areas[tools[i]]&&areas[tools[j]]&&overlap(areas[tools[i]],areas[tools[j]])) failures.push('Scene tool overlap '+tools[i]+'/'+tools[j]);
  for(const s of ['.module-dock','.orbital-status-evidence','.historical-time-bar','#historical-calendar']) if(areas[s]) {
    for(const chrome of ['.top-context-bar','.operational-summary','.inspection-strip']) if(areas[chrome]&&overlap(areas[s],areas[chrome])) failures.push('Surface overlaps chrome: '+s+'/'+chrome);
  }
  const clipping=[];
  for(const e of document.querySelectorAll('.top-context-bar button,.context-source-value,.context-date time,.summary-identity strong,.summary-identity span,.summary-position dt,.summary-position dd,.summary-quality,.historical-date,.inspection-strip strong,.inspection-strip span,.inspection-strip button,.inspection-strip summary,.crew-roster-row strong,.crew-roster-identity,.crew-roster-mission,.crew-roster-agency,.crew-roster-presence,.crew-roster-summary dt,.crew-roster-summary dd,.context-dock h2,.context-dock h3,.context-dock p,.context-dock dt,.context-dock dd,.context-dock-footer .context-button,.crew-mission-context,.crew-panel-header h2,.calendar-error')) {
    if(!visible(e)) continue;
    const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),rects=[];let text;
    while((text=walker.nextNode())) {if(!text.textContent.trim()||text.parentElement.closest('.sr-only')||!visible(text.parentElement))continue;const r=document.createRange();r.selectNodeContents(text);rects.push(...r.getClientRects());}
    const eb=e.getBoundingClientRect();
    for(const t of rects) if(t.width>0&&(t.left<eb.left-1.5||t.right>eb.right+1.5||t.top<eb.top-1.5||t.bottom>eb.bottom+1.5)) {clipping.push({selector:e.className||e.tagName,text:e.textContent.trim().slice(0,160),box:box(e)});break;}
  }
  if(clipping.length) failures.push('Text clipping: '+clipping.map(c=>c.text).join(' / '));
  const controls=[];
  for(const e of document.querySelectorAll('button,select,summary,a.context-button,[role="button"]')) {
    if(!visible(e)) continue;
    const b=box(e), name=e.getAttribute('aria-label')||e.textContent.trim().slice(0,100);
    let scrollOwner=null;
    for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement) if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+1) {scrollOwner=p;break;}
    if(!scrollOwner&&!inside(b,screen)) failures.push('Control outside viewport: '+name);
    if(e.matches('.cesium-credit-lightbox-close,.calendar-close') && document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)!==e) failures.push('Close control occluded: '+name);
    controls.push({name,...b,scrollOwner:scrollOwner?.className||null,disabled:!!e.disabled});
  }
  const scrolls=[...document.querySelectorAll('.crew-panel-content,.astronaut-profile-body,.context-dock,.context-dock-content,.orbital-status-evidence,#historical-calendar,.calendar-body,.calendar-grid')]
    .filter(visible).map(e=>({selector:e.className||e.id,...box(e),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowY:getComputedStyle(e).overflowY}));
  for(const s of scrolls) if(s.scrollWidth>s.clientWidth+1) failures.push('Panel horizontal overflow: '+s.selector);
  const styles=Object.fromEntries(Object.keys(areas).map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return [s,{fill:c.backgroundColor,border:c.borderColor,radius:c.borderRadius,blur:c.backdropFilter,shadow:c.boxShadow,font:c.fontFamily,fontSize:c.fontSize}];}));
  const selection={source:document.querySelector('[aria-label="Orbital source"]')?.value,utc:document.querySelector('.context-date time')?.dateTime,
    requested:document.querySelector('.historical-date time')?.dateTime,module:document.querySelector('.module-dock')?.dataset.entityId,member:document.querySelector('.astronaut-dock')?.dataset.entityId,
    mode:document.querySelector('main').dataset.viewMode,crew:!!document.querySelector('.crew-workspace'),historical:document.querySelector('.context-date > span')?.textContent};
  return {width:innerWidth,height:innerHeight,areas,canvas:box(canvas),styles,controls,scrolls,clipping,navigation,calendarPosition,failures:[...new Set(failures)],selection,
    exposedScene:document.elementFromPoint(innerWidth/2,(areas['.top-context-bar'].height+innerHeight-(areas['.operational-summary']?.height||areas['.inspection-strip']?.height||0))/2)===canvas};
}

async function run() {
  const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
  const report=revalidateStates ? JSON.parse(fs.readFileSync(path.join(out,'matrix.json'))) : {url,build,phase,matrix:selectedMatrix,states:[],continuity:[],errors:[],console:[],externalFailures:[],realResponses:[]};
  if(revalidateStates) {
    assert.equal(report.url,url);assert.equal(report.build,build);assert.deepEqual(report.matrix,selectedMatrix);
    report.revalidation={states:revalidateStates,reason:process.env.MISSION1_QA_REASON || 'Native scroll alignment and inline-link fragment hit tests; application source unchanged',startedAt:new Date().toISOString()};
  }
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:false});
  const save=()=>fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(report,null,2)+'\n');
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/ResizeObserver/.test(m.text())) report.console.push({type:m.type(),text:m.text()});});
  page.on('requestfailed',r=>report.externalFailures.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',async r=>{if(r.ok()&&r.url().includes('/api/iss/'))try {report.realResponses.push({url:r.url(),body:await r.json()});}catch{}});
  try {
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='ISS Inspection'&&!b.disabled),null,{timeout:120000});
    await page.evaluate(`window.__v=(${viewer.toString()})();window.__model=Array.from({length:__v.scene.primitives.length},(_,i)=>__v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));window.__scan=false;window.__originalCanvas=__v.canvas;`);
    await page.waitForTimeout(1200);
    const before=await page.evaluate(observe);
    report.initialScene=before;
    async function ready() {await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false',null,{timeout:45000});await page.waitForTimeout(350);}
    async function resize(width,height) {await page.setViewportSize({width,height});await page.waitForTimeout(100);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
    async function cap(state) {
      if(revalidateStates&&!revalidateStates.includes(state))return;
      const entries=[];
      for(const [width,height] of selectedMatrix) {
        await resize(width,height);
        if(state==='crew-detail-evidence') await page.locator('.astronaut-profile-body .crew-sources').last().scrollIntoViewIfNeeded();
        const g=await page.evaluate(geometry),scene=await page.evaluate(observe);
        assert(await page.evaluate(()=>__originalCanvas===document.querySelector('.earth-view canvas')&&document.querySelectorAll('.cesium-viewer').length===1),'Viewer/canvas recreated');
        if(scene.error>=2)g.failures.push('Focal composition error '+scene.error);
        const name=`${width}x${height}-${state}.png`;
        await page.screenshot({path:path.join(out,name)});
        const reachability=[];
        const targets=state==='historical-calendar' ? ['[aria-label="UTC hour"]','[aria-label="UTC minute"]','[aria-label="UTC second"]','.calendar-actions button:last-child','.calendar-close']
          : /^(historical-)?module$/.test(state) ? ['.module-evidence','.context-dock-footer a:last-child','.module-dock header button']
          : state==='crew-detail' || state==='crew-detail-evidence' ? ['.astronaut-dock footer button','.astronaut-dock header button']
          : state==='crew'||state==='historical-crew' ? ['.crew-roster-row:last-child','.crew-header-actions button:last-child'] : [];
        for(const selector of targets) {
          const target=page.locator(selector).last();if(!await target.count())continue;
          // Align information links below the existing sticky dock header.
          // Playwright's default centering can put a visible link behind it.
          await target.evaluate(e=>e.scrollIntoView({block:'end',inline:'nearest'}));
          const r=await target.boundingBox();
          // Inline multi-line links have disjoint boxes; their aggregate
          // center may be whitespace belonging to the surrounding paragraph.
          const exposed=await target.evaluate(e=>[...e.getClientRects()].some(r=>{const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===h||e.contains(h);}));
          reachability.push({selector,box:r,exposed});
          if(!r||r.x<0||r.y<0||r.x+r.width>width+1||r.y+r.height>height+1||!exposed)g.failures.push('Unreachable important control: '+selector);
        }
        if(state==='historical-calendar') {
          const beforeRequested=await page.locator('.historical-date time').getAttribute('datetime');
          const minute=page.getByLabel('UTC minute',{exact:true});await minute.scrollIntoViewIfNeeded();const original=await minute.inputValue();
          await minute.selectOption(original==='07'?'08':'07');
          const r=await minute.boundingBox(),b=await page.locator('.calendar-body').boundingBox();
          if(b&&r&&(r.y<b.y-1||r.y+r.height>b.y+b.height+1))g.failures.push('UTC edit unexpectedly scrolls away');
          await minute.selectOption(original);
          if(await page.locator('.historical-date time').getAttribute('datetime')!==beforeRequested)g.failures.push('Draft edit changed accepted target');
          await page.locator('.calendar-body').evaluate(e=>e.scrollTop=0);
        }
        // Restore only information-surface scroll positions after reachability
        // checks. Semantic selections/UTC/source and the native scene persist.
        await page.evaluate(()=>document.querySelectorAll('.crew-panel-content,.astronaut-profile-body,.module-dock,.context-dock-content').forEach(e=>e.scrollTop=0));
        entries.push({...g,scene,reachability,screenshot:name,result:g.failures.length?'FAIL':'PASS'});
      }
      const previous=report.states.findIndex(s=>s.state===state);
      if(previous>=0)report.states[previous]={state,entries};else report.states.push({state,entries});save();
      console.log(`${state}: ${entries.filter(e=>!e.failures.length).length}/${entries.length} geometry PASS`);
      await resize(1440,900);
    }
    async function continuity(state) {
      if(phase!=='final') return;
      if(revalidateStates&&!revalidateStates.includes(state))return;
      const entries=[];
      const identity=await page.evaluate(()=>({source:document.querySelector('[aria-label="Orbital source"]').value,module:document.querySelector('.module-dock')?.dataset.entityId,member:document.querySelector('.astronaut-dock')?.dataset.entityId,requested:document.querySelector('.historical-date time')?.dateTime,mode:document.querySelector('main').dataset.viewMode}));
      const widths=[...new Set([...Array.from({length:101},(_,i)=>320+i*16),379,380,599,600,601,739,740,741,1243,1244,1399,1400,1920])].sort((a,b)=>a-b);
      for(const width of widths) {
        await resize(width,800);const g=await page.evaluate(geometry);
        for(const key of ['source','module','member','requested','mode']) if(identity[key]!==g.selection[key])g.failures.push('Resize reset '+key);
        entries.push({width,failures:g.failures});
      }
      const previous=report.continuity.findIndex(s=>s.state===state);
      if(previous>=0)report.continuity[previous]={state,entries};else report.continuity.push({state,entries});save();console.log(`${state}: continuity ${entries.filter(e=>!e.failures.length).length}/${entries.length}`);await resize(1440,900);
    }
    const source=page.getByLabel('Orbital source',{exact:true});
    await source.selectOption('PRIMARY_GP_TLE');await page.waitForTimeout(300);
    await cap('earth-gp');await continuity('earth-gp');
    await page.locator('.source-state-slot > summary').click();await cap('earth-gp-provenance');await continuity('earth-gp-provenance');await page.locator('.source-state-slot > summary').click();
    if(!await source.locator('option[value="NASA_OEM"]').isDisabled()) {
      await source.selectOption('NASA_OEM');await page.waitForTimeout(350);await cap('earth-oem');
      await page.locator('.source-state-slot > summary').click();await cap('earth-oem-provenance');await page.locator('.source-state-slot > summary').click();
    }
    await source.selectOption('PRIMARY_GP_TLE');
    await page.getByRole('button',{name:'Crew',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);await page.waitForTimeout(300);
    await cap('crew');await continuity('crew');
    await page.locator('.crew-roster-evidence > details > summary').click();await cap('crew-evidence');await page.locator('.crew-roster-evidence > details > summary').click();
    await page.locator('.crew-roster-row').first().click();await page.locator('.astronaut-dock').waitFor();await page.waitForFunction(()=>!document.querySelector('.astronaut-profile-body [role="status"]'));await page.waitForTimeout(350);
    await cap('crew-detail');await continuity('crew-detail');
    await page.getByRole('button',{name:'Profile source & presence evidence',exact:true}).click();await cap('crew-detail-evidence');
    await page.getByRole('button',{name:'Close astronaut detail',exact:true}).click();await page.locator('.astronaut-dock').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Close crew panel',exact:true}).click();await page.locator('.crew-workspace-host').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Historical',exact:true}).click();await ready();
    // A real retained UTC, reached through the product's native editor. This
    // same fixed historical time makes golden comparisons reproducible.
    await page.getByRole('button',{name:'Open Historical calendar',exact:true}).click();
    await page.getByRole('button',{name:'2026-10-03 UTC',exact:true}).click();
    await page.getByLabel('UTC hour',{exact:true}).selectOption('12');await page.getByLabel('UTC minute',{exact:true}).selectOption('04');await page.getByLabel('UTC second',{exact:true}).selectOption('00');
    await page.getByRole('button',{name:'Apply',exact:true}).click();await ready();
    await cap('historical');await continuity('historical');
    await page.getByRole('button',{name:'Open Historical calendar',exact:true}).click();await page.waitForTimeout(200);await cap('historical-calendar');await continuity('historical-calendar');await page.keyboard.press('Escape');await page.locator('#historical-calendar').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Crew',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);await page.waitForTimeout(300);
    await cap('historical-crew');await continuity('historical-crew');
    await page.locator('.crew-historical-evidence > summary').click();await cap('historical-crew-evidence');await page.locator('.crew-historical-evidence > summary').click();
    await page.locator('.crew-roster-row').first().click();await page.locator('.crew-historical-detail').waitFor();await cap('historical-crew-detail');await continuity('historical-crew-detail');
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Close crew panel',exact:true}).click();await page.locator('.crew-workspace-host').waitFor({state:'detached'});
    async function inspection() {await page.getByRole('button',{name:'ISS Inspection',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='ISS_INSPECTION',null,{timeout:45000});await page.waitForTimeout(450);}
    async function earth() {await page.getByRole('button',{name:'Earth',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main').dataset.viewMode==='EARTH_OVERVIEW',null,{timeout:45000});await page.waitForTimeout(350);}
    async function modulePick() {
      const mappings=[...manifest.semanticMappings].sort((a,b)=>(a.componentId==='ZVEZDA'?-1:0)-(b.componentId==='ZVEZDA'?-1:0));
      for(const mapping of mappings) {const hit=await page.evaluate(scan,{mapping,node:nodes.find(n=>n.index===mapping.nodeIndex)});if(hit) {await page.mouse.click(hit.x,hit.y);await page.locator('.module-dock').waitFor();await page.mouse.move(2,2);await page.waitForTimeout(350);return mapping;}}
      throw Error('No actual native module hit');
    }
    await inspection();await cap('historical-inspection');
    await page.locator('.inspection-orbital-toggle > summary').click();await cap('historical-inspection-provenance');await page.locator('.inspection-orbital-toggle > summary').click();
    await modulePick();await cap('historical-module');await continuity('historical-module');
    await page.getByRole('button',{name:'Close module information',exact:true}).click();await page.locator('.module-dock').waitFor({state:'detached'});await earth();
    await page.getByRole('button',{name:'Current',exact:true}).click();await ready();
    await inspection();await cap('inspection');await continuity('inspection');
    await page.locator('.inspection-orbital-toggle > summary').click();await cap('inspection-provenance');await page.locator('.inspection-orbital-toggle > summary').click();
    await modulePick();await cap('module');await continuity('module');
    await page.getByRole('button',{name:'Close module information',exact:true}).click();await page.locator('.module-dock').waitFor({state:'detached'});await earth();
    const credit=page.locator('.cesium-credit-expand-link');await credit.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Data attribution',exact:true}).waitFor();await cap('attribution');await page.keyboard.press('Escape');
    report.finalScene=await page.evaluate(observe);
    report.summary={states:report.states.length,captures:report.states.reduce((n,s)=>n+s.entries.length,0),failures:report.states.flatMap(s=>s.entries.filter(e=>e.failures.length).map(e=>({state:s.state,width:e.width,height:e.height,failures:e.failures}))),continuityFailures:report.continuity.flatMap(s=>s.entries.filter(e=>e.failures.length).map(e=>({state:s.state,...e})))};
    save();console.log(JSON.stringify({states:report.summary.states,captures:report.summary.captures,failed:report.summary.failures.length,continuityFailed:report.summary.continuityFailures.length,errors:report.errors.length}));
    if(phase==='final') {assert.deepEqual(report.summary.failures,[]);assert.deepEqual(report.summary.continuityFailures,[]);assert.deepEqual(report.errors,[]);assert(!report.console.some(e=>/ResizeObserver|React|Uncaught/i.test(e.text)));}
  } finally {save();await browser.close();}
}
module.exports={geometry,matrix};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
