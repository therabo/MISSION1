/* Current/Historical transition regression QA. Uses real API bodies unchanged.
 * Every React mutation and every requestAnimationFrame is sampled, including
 * commits between paint frames. At 1440x900 CDP records every delivered paint.
 * node browser-temporal-transition-qa.cjs [base-url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,matrix,intermediateWidths,layout,checkLayout,probe}=require('./browser-responsive-qa.cjs');
const base=process.argv[2]||'http://127.0.0.1:5175/',sdk=process.argv[3]!=='production';
const out=path.resolve(process.env.MISSION1_QA_OUTPUT||'/tmp/mission1-transition-qa');fs.mkdirSync(out,{recursive:true});
function geometryEqual(a,b){for(const selector of ['legend','controls','header','summary','canvas'])for(const k of ['x','y','width','height']){
  // Source text length legitimately changes the legend width; its anchor and height do not.
  if(selector==='legend'&&k==='width')continue;
  assert(Math.abs(a[selector][k]-b[selector][k])<.1,`${selector} ${k} jumped: ${a[selector][k]} → ${b[selector][k]}`);
}for(let i=0;i<3;i++)for(const k of ['x','y','width','height'])assert(Math.abs(a.buttons[i][k]-b.buttons[i][k])<.1,`Scene control ${i} ${k} jumped`);}
function cameraEqual(a,b){if(!a||!b)return;for(const k of ['position','direction','up'])for(let i=0;i<3;i++)assert(Math.abs(a[k][i]-b[k][i])<(k==='position'?1e-6:1e-12),`Camera changed: ${k}`);}
async function snap(page){return page.evaluate(()=>globalThis.__temporalSnap());}
async function transition(page,destination,count=48){return page.evaluate(async({destination,count})=>{
 const frames=[],mutations=[],before=globalThis.__temporalSnap(),observer=new MutationObserver(()=>mutations.push(globalThis.__temporalSnap()));
 observer.observe(document.querySelector('.app-shell'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','data-state']});
 [...document.querySelector('.context-temporal').querySelectorAll('button')].find(e=>e.textContent===destination).click();
 for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);frames.push(globalThis.__temporalSnap());}
 observer.disconnect();return {before,frames,mutations};
 },{destination,count});}
function validate(trace,currentSource){
 for(const s of [...trace.frames,...trace.mutations]){
  geometryEqual(trace.before,s);assert.deepEqual(s.notices,[],'Transient Current notice rendered');
  assert(s.nodesStable&&s.canvasStable,'Shared scene presentation was recreated');assert.equal(s.viewerCount,1);
  assert.equal(s.sourceOpacity,1,'Source label faded during temporal switching');
  assert(s.transforms.every(x=>x==='none'),'Scene UI translated');cameraEqual(trace.before.camera,s.camera);
  if(!s.presentedHistorical)assert.equal(s.source,currentSource,'Current source label flashed');
 }
 const intervals=trace.frames.slice(1).map((s,i)=>s.at-trace.frames[i].at).sort((a,b)=>a-b);
 return {frames:trace.frames.length,mutations:trace.mutations.length,frameIntervalMedianMs:intervals[Math.floor(intervals.length*.5)],frameIntervalP95Ms:intervals[Math.floor(intervals.length*.95)],result:'PASS'};
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const report={base,sdk,viewports:[],intermediateWidths:[],rapid:[],warnings:null,errors:[],resizeWarnings:[]};
try{const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ResizeObserver/.test(m.text()))report.resizeWarnings.push(m.text());});
 await page.addInitScript(()=>{globalThis.__mission1QA={viewers:[],canvas:null};});
 if(sdk)await page.route('**/src/cesium/EarthView.tsx*',async route=>{const response=await route.fetch(),body=await response.text();assert(body.includes('viewer.current = instance;'));await route.fulfill({response,body:body.replace('viewer.current = instance;','viewer.current = instance; globalThis.__mission1QA.viewers.push(instance); globalThis.__mission1QA.canvas=instance.canvas;')});});
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>document.querySelector('.summary-position dd')?.textContent.includes('°'),null,{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled),null,{timeout:90000});
 await page.evaluate(sdk=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const legend=document.querySelector('.trajectory-legend'),controls=document.querySelector('.earth-scene-controls'),canvas=document.querySelector('.earth-view canvas');
  globalThis.__temporalSnap=()=>{
   const label=document.querySelector('.context-source-value'),view=globalThis.__mission1QA.viewers[0],vec=p=>[p.x,p.y,p.z];
   return {at:performance.now(),historical:document.querySelector('.context-temporal button:last-child').getAttribute('aria-pressed')==='true',
    legend:rect(legend),controls:rect(controls),buttons:[...controls.querySelectorAll('button')].map(rect),header:rect(document.querySelector('.top-context-bar')),summary:rect(document.querySelector('.operational-summary')),canvas:rect(canvas),
    notices:[...document.querySelectorAll('.earth-current-notice')].map(e=>e.textContent),source:label.textContent,sourceOpacity:Number(getComputedStyle(label).opacity),presentedHistorical:document.querySelector('.context-date > span').textContent==='HISTORICAL DATE',
    transforms:[legend,controls].map(e=>getComputedStyle(e).transform),nodesStable:legend===document.querySelector('.trajectory-legend')&&controls===document.querySelector('.earth-scene-controls'),canvasStable:canvas===document.querySelector('.earth-view canvas'),
    viewerCount:sdk?globalThis.__mission1QA.viewers.length:document.querySelectorAll('.cesium-viewer').length,
    camera:sdk?{position:vec(view.camera.positionWC),direction:vec(view.camera.directionWC),up:vec(view.camera.upWC)}:null};
  };
 },sdk);
 // Choose a genuine past epoch outside the Current sample buffer via existing native steps.
 await page.getByRole('button',{name:'Historical',exact:true}).click();
 await page.getByRole('button',{name:'Historical back 10 minutes',exact:true}).evaluate(e=>{e.click();e.click();e.click();});
 async function ready(){await page.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false'&&document.querySelector('.context-date > span').textContent==='HISTORICAL DATE',null,{timeout:30000});}
 await ready();await page.waitForTimeout(220);
 // Verify independent NASA OEM Current preference: Historical may choose GP automatically.
 await page.getByRole('button',{name:'Current',exact:true}).click();await page.waitForTimeout(220);
 const select=page.getByLabel('Orbital source',{exact:true});
 assert(await select.locator('option[value="NASA_OEM"]').evaluate(e=>!e.disabled),'Real Current OEM is required for transition source regression');
 await select.selectOption('NASA_OEM');await page.waitForTimeout(300);
 const original=sdk?await probe(page):null;
 for(const [width,height] of matrix){await page.setViewportSize({width,height});await page.waitForTimeout(120);
  const current=await layout(page);checkLayout(current);const start=await snap(page);assert.deepEqual(start.notices,[]);
  let cdp,paints=[];
  if(width===1440&&height===900){await page.screenshot({path:path.join(out,'1440x900-current.png')});cdp=await page.context().newCDPSession(page);
   cdp.on('Page.screencastFrame',event=>{paints.push({data:event.data,timestamp:event.metadata.timestamp});void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
   await cdp.send('Page.startScreencast',{format:'png',maxWidth:1440,maxHeight:900,everyNthFrame:1});}
  const enter=await transition(page,'Historical');validate(enter,'NASA OEM');await ready();
  const historical=await layout(page);checkLayout(historical);geometryEqual(start,await snap(page));
  if(cdp){await page.screenshot({path:path.join(out,'1440x900-historical.png')});paints=[];}
  const exit=await transition(page,'Current');const exitResult=validate(exit,'NASA OEM');
  const returned=await layout(page);checkLayout(returned);geometryEqual(start,await snap(page));
  if(cdp){await cdp.send('Page.stopScreencast');await cdp.detach();
   for(const [i,p] of paints.entries())fs.writeFileSync(path.join(out,`exit-frame-${String(i).padStart(3,'0')}.png`),Buffer.from(p.data,'base64'));
   fs.writeFileSync(path.join(out,'exit-paint-frames.json'),JSON.stringify(paints.map((p,i)=>({frame:i,timestamp:p.timestamp})),null,2));
   fs.writeFileSync(path.join(out,'1440x900-enter-trace.json'),JSON.stringify(enter,null,2));fs.writeFileSync(path.join(out,'1440x900-exit-trace.json'),JSON.stringify(exit,null,2));
   await page.screenshot({path:path.join(out,'1440x900-returned-current.png')});}
  if(sdk)cameraEqual(original,await probe(page));
  report.viewports.push({width,height,current,historical,returned,enter:validate(enter,'NASA OEM'),exit:exitResult,currentAnchors:start,historicalAnchors:enter.frames.at(-1),result:'PASS'});
  fs.writeFileSync(path.join(out,'transition-qa.json'),JSON.stringify(report,null,2));console.log(`${width}x${height}: both transitions PASS`);
 }
 for(const width of intermediateWidths){await page.setViewportSize({width,height:800});await page.waitForTimeout(80);checkLayout(await layout(page));
  const enter=await transition(page,'Historical',20);validate(enter,'NASA OEM');await ready();
  const exit=await transition(page,'Current',20);validate(exit,'NASA OEM');checkLayout(await layout(page));
  report.intermediateWidths.push({width,enter:validate(enter,'NASA OEM'),exit:validate(exit,'NASA OEM'),result:'PASS'});
 }
 await page.setViewportSize({width:1440,height:900});
 for(const reduced of ['no-preference','reduce']){await page.emulateMedia({reducedMotion:reduced});
  const trace=await page.evaluate(async()=>{const before=globalThis.__temporalSnap(),frames=[],mutations=[],observer=new MutationObserver(()=>mutations.push(globalThis.__temporalSnap()));observer.observe(document.querySelector('.app-shell'),{subtree:true,childList:true,characterData:true});
   for(let i=0;i<60;i++){if(i<24&&i%3===0){const buttons=document.querySelectorAll('.context-temporal button');buttons[i%6===0?1:0].click();}await new Promise(requestAnimationFrame);frames.push(globalThis.__temporalSnap());}
   observer.disconnect();return {before,frames,mutations};});
  report.rapid.push({reduced,...validate(trace,'NASA OEM')});
 }
 // Transport fault only, not invented orbital data. A genuine Current loading failure remains visible.
 await page.getByRole('button',{name:'Historical',exact:true}).click();await ready();
 await page.route('**/api/iss/orbit/samples',route=>route.abort('failed'));
 await page.getByRole('button',{name:'Current',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.earth-current-notice')?.textContent.includes('Failed to fetch'),null,{timeout:30000});
 report.warnings={transportFailure:await page.locator('.earth-current-notice').textContent(),visible:await page.locator('.earth-current-notice').isVisible(),result:'PASS'};
 assert(report.warnings.visible);assert.deepEqual(report.errors,[]);assert.deepEqual(report.resizeWarnings,[]);report.result='PASS';
}finally{fs.writeFileSync(path.join(out,'transition-qa.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
