/* Reuse Phase 3 geometry checks with the real replay API and native controls.
 * node browser-historical-qa.cjs [base-url] [development|production]
 * Uses the same MISSION1_PLAYWRIGHT_MODULE / MISSION1_QA_OUTPUT environment.
 * MISSION1_OEM_HISTORY_UTC identifies a real retained interval where OEM is primary.
 * The target is reached exclusively by native ±600s actions, never state injection.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,matrix,intermediateWidths,layout,probe,overlaps,checkLayout,stableSlots,canvasSamples}=require('./browser-responsive-qa.cjs');
const base=process.argv[2]||'http://127.0.0.1:5175/',sdk=process.argv[3]!=='production';
const out=path.resolve(process.env.MISSION1_QA_OUTPUT||'/tmp/mission1-historical-qa');fs.mkdirSync(out,{recursive:true});
// Cesium may renormalize orientation vectors at a frozen epoch (roundoff ~1e-15).
// Require sub-micrometre position continuity and 1e-12 direction/up continuity.
function cameraStable(a,b){for(const k of ['position','direction','up'])for(let i=0;i<3;i++)assert(Math.abs(a[k][i]-b[k][i])<(k==='position'?1e-6:1e-12),`Unexpected camera movement: ${k}`);}
async function temporal(page){return page.evaluate(()=>{
  const bar=document.querySelector('.historical-time-bar'),b=bar.getBoundingClientRect(),css=getComputedStyle(bar);
  const controls=[...bar.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label'),disabled:e.disabled,x:r.x,y:r.y,width:r.width,height:r.height};});
  const t=bar.querySelector('time'),range=document.createRange();range.selectNodeContents(t);const r=range.getBoundingClientRect(),p=t.parentElement.getBoundingClientRect();
  return {x:b.x,y:b.y,width:b.width,height:b.height,background:css.backgroundColor,blur:css.backdropFilter,shadow:css.boxShadow,animation:css.animationName,duration:css.animationDuration,
    utc:t.dateTime,text:t.textContent,font:getComputedStyle(t).fontFamily,fontSize:getComputedStyle(t).fontSize,
    clipped:r.x<p.x-1||r.right>p.right+1||r.y<p.y-1||r.bottom>p.bottom+1,controls,
    keyframes:bar.getAnimations().flatMap(a=>a.effect?.getKeyframes()??[])};
});}
function checkHistorical(state,t){
  checkLayout(state);assert.equal(t.clipped,false,'Historical UTC clipped');assert.equal(t.blur,'none');assert.equal(t.shadow,'none');assert.equal(t.background,'rgba(21, 29, 39, 0.5)');
  assert(t.y>=state.geometry['.top-context-bar'].height+7,'Detached bar overlaps header');
  assert(t.x>=11&&t.x+t.width<=state.width-11&&t.y+t.height<state.height,'Historical surface outside viewport');
  for(const key of ['.trajectory-legend','.earth-scene-controls','.operational-summary'])assert(!overlaps(t,state.geometry[key]),`Historical bar overlaps ${key}`);
  for(const c of t.controls){assert(c.x>=t.x&&c.x+c.width<=t.x+t.width+.5&&c.y>=t.y&&c.y+c.height<=t.y+t.height+.5);if(state.width<1244)assert(c.height>=44);}
  if(state.width===1440&&state.height===900){assert.deepEqual([t.x,t.y,t.width,t.height],[340,88,760,52]);
    for(const [i,expected] of [[0,[360,96,36,36]],[1,[412,96,444,36]],[2,[872,96,96,36]],[3,[984,96,96,36]]])assert.deepEqual(['x','y','width','height'].map(k=>t.controls[i][k]),expected);
    assert.equal(state.geometry['.trajectory-legend'].y,764);assert.equal(state.geometry['.earth-scene-controls'].y,760);
  }
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
const report={base,sdk,viewports:[],intermediateWidths:[],sourceStates:[],coherence:null,persistence:null,rapidStepping:null,cancellation:null,unavailable:null,touch:[],motion:[],errors:[],resizeWarnings:[],abortedRequests:[]};
try{
  const p=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,deviceScaleFactor:1});
  let answer=null;const answers=new Map();
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(/ResizeObserver/.test(m.text()))report.resizeWarnings.push(m.text());});
  p.on('requestfailed',r=>{if(r.url().includes('/api/iss/replay?'))report.abortedRequests.push({url:r.url(),error:r.failure()?.errorText});});
  p.on('response',async r=>{if(r.url().includes('/api/iss/replay?')&&r.ok()){try{answer=await r.json();answers.set(Date.parse(answer.requestedAt),answer);}catch{}}});
  await p.addInitScript(()=>{globalThis.__mission1QA={viewers:[],canvas:null};});
  if(sdk)await p.route('**/src/cesium/EarthView.tsx*',async route=>{const response=await route.fetch(),body=await response.text();assert(body.includes('viewer.current = instance;'));await route.fulfill({response,body:body.replace('viewer.current = instance;','viewer.current = instance; globalThis.__mission1QA.viewers.push(instance); globalThis.__mission1QA.canvas=instance.canvas;')});});
  await p.goto(base);await p.evaluate(()=>document.fonts.ready);
  await p.waitForFunction(()=>document.querySelector('.summary-position dd')?.textContent.includes('°'),null,{timeout:30000});
  await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled),null,{timeout:90000});
  const source=p.getByLabel('Orbital source',{exact:true});
  // Current OEM preference must survive an automatically chosen Historical GP.
  assert(await source.locator('option[value="NASA_OEM"]').evaluate(e=>!e.disabled));await source.selectOption('NASA_OEM');await p.waitForTimeout(300);
  await p.evaluate(()=>globalThis.__persistentCanvas=document.querySelector('.earth-view canvas'));
  const original=sdk?await probe(p):null;
  await p.getByRole('button',{name:'Historical',exact:true}).click();
  async function ready(){await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false'&&document.querySelector('.context-date > span').textContent==='HISTORICAL DATE',null,{timeout:30000});}
  await ready();
  async function inspectReady(){const s=await layout(p),t=await temporal(p);checkHistorical(s,t);
    const data=answers.get(Date.parse(t.utc));assert(data,'No real API response corresponding to committed UTC');
    const kind=data.orbit.primary?.source.kind;assert(kind==='GP_TLE'||kind==='NASA_OEM');
    assert.equal(s.legend[0].text,kind==='NASA_OEM'?'NASA OEM':'GP/TLE');assert.equal(s.source,kind==='NASA_OEM'?'NASA_OEM':'PRIMARY_GP_TLE');
    assert.equal(s.legend[0].color,kind==='NASA_OEM'?'rgb(237, 184, 106)':'rgb(83, 217, 205)');
    assert.equal(await source.isDisabled(),true);assert(await p.evaluate(()=>globalThis.__persistentCanvas===document.querySelector('.earth-view canvas')&&document.querySelectorAll('.cesium-viewer').length===1));
    if(sdk){const v=await probe(p);cameraStable(original,v);assert.equal(v.viewerCount,1);assert(v.canvasSame);}
    return {s,t,realSource:kind,effectiveAt:data.orbit.primary.effectiveAt};
  }
  // A rapid seek preserves the complete previous scene while the existing hook debounces.
  const before=await temporal(p),beforeScene=await layout(p),beforePresented=await p.locator('.context-date time').getAttribute('datetime'),back=p.getByRole('button',{name:'Historical back 10 minutes',exact:true});
  await back.evaluate(e=>{e.click();e.click();e.click();});
  const loading=await layout(p),requested=await temporal(p);
  assert.equal(Date.parse(requested.utc)-Date.parse(before.utc),-1800000);
  assert.deepEqual(loading.slots.map(x=>x.text),beforeScene.slots.map(x=>x.text));assert.equal(await p.locator('.context-date time').getAttribute('datetime'),beforePresented);assert.equal(await p.locator('main').getAttribute('aria-busy'),'true');
  report.coherence={requested:requested.utc,previousCoherentScenePreserved:true,loading};await ready();
  await p.getByRole('button',{name:'Historical forward 10 minutes',exact:true}).click();await ready();
  assert.equal(Date.parse((await temporal(p)).utc),Date.parse(before.utc)-1200000);report.rapidStepping={threeBackward:-1800,oneForward:600,result:'PASS'};
  // Reach a retained GP epoch using the same actual step control, without injecting a UTC/state.
  const current=await inspectReady();report.sourceStates.push(current);
  await back.evaluate(e=>{for(let i=0;i<400;i++)e.click();});await ready();
  const gp=await inspectReady();assert.equal(gp.realSource,'GP_TLE');stableSlots(current.s,gp.s);report.sourceStates.push(gp);
  const committed=gp.t.utc;await p.getByRole('button',{name:'Current',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('.historical-time-bar'));
  await p.waitForFunction(()=>document.querySelector('select[aria-label="Orbital source"]')?.value==='NASA_OEM');
  const currentState=await layout(p);checkLayout(currentState);
  await p.getByRole('button',{name:'Historical',exact:true}).click();assert.equal((await temporal(p)).utc,committed);await ready();report.persistence={committed,restored:committed,currentSourcePreserved:true};
  await p.screenshot({path:path.join(out,`${sdk?'development':'production'}-1440x900-historical-gp.png`)});
  async function seekSteps(target){const at=(await temporal(p)).utc,steps=Math.round((Date.parse(target)-Date.parse(at))/600000);
    const control=p.getByRole('button',{name:steps>0?'Historical forward 10 minutes':'Historical back 10 minutes',exact:true});
    if(steps)await control.evaluate((e,n)=>{for(let i=0;i<n;i++)e.click();},Math.abs(steps));await ready();return (await temporal(p)).utc;
  }
  assert(process.env.MISSION1_OEM_HISTORY_UTC,'Set MISSION1_OEM_HISTORY_UTC to an actually retained OEM-primary interval');
  const oemUtc=await seekSteps(process.env.MISSION1_OEM_HISTORY_UTC),oem=await inspectReady();assert.equal(oem.realSource,'NASA_OEM');stableSlots(gp.s,oem.s);report.sourceStates.push(oem);
  for(const [width,height] of matrix){await p.setViewportSize({width,height});await p.waitForTimeout(200);
    const checked=await inspectReady(),samples=await canvasSamples(p);assert(samples.every(x=>JSON.stringify(x)===JSON.stringify(samples[0])));
    await seekSteps(committed);const gpChecked=await inspectReady();assert.equal(gpChecked.realSource,'GP_TLE');stableSlots(checked.s,gpChecked.s);
    await seekSteps(oemUtc);const returned=await inspectReady();stableSlots(checked.s,returned.s);
    report.viewports.push({width,height,...checked,gp:gpChecked,returned,canvasSamples:samples,result:'PASS'});
    await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='ISS Inspection'&&!e.disabled&&getComputedStyle(e).opacity==='1'));
    await p.screenshot({path:path.join(out,`${sdk?'development':'production'}-${width}x${height}-historical.png`)});
    fs.writeFileSync(path.join(out,'historical-qa.json'),JSON.stringify(report,null,2));console.log(`${width}x${height} Historical: PASS`);
  }
  for(const width of intermediateWidths){await p.setViewportSize({width,height:800});await p.waitForTimeout(100);await inspectReady();report.intermediateWidths.push({width,result:'PASS'});}
  for(const v of [{width:390,height:844},{width:844,height:390}]){await p.setViewportSize(v);await p.waitForTimeout(150);
    const state=await layout(p),t=await temporal(p),area=state.geometry['.earth-scene-ui'],x=v.width*.5,y=t.y+t.height+(state.geometry['.earth-scene-controls'].y-t.y-t.height)*.5;
    const beforeTouch=sdk?await probe(p):null,cdp=await p.context().newCDPSession(p);
    assert(y>t.y+t.height&&y<area.y+area.height);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+40*i/10,y:y+12*i/10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(400);
    if(sdk){assert.notDeepEqual(beforeTouch.position,(await probe(p)).position);report.touch.push({...v,nativeDrag:true});}
    else report.touch.push({...v,nativeEvents:true});
    await p.getByRole('button',{name:'Zoom in',exact:true}).tap();await p.getByRole('button',{name:'Reset view',exact:true}).tap();await p.waitForTimeout(500);await cdp.detach();
  }
  await p.setViewportSize({width:1440,height:900});
  for(const reduced of ['no-preference','reduce']){await p.emulateMedia({reducedMotion:reduced});await p.getByRole('button',{name:'Current',exact:true}).click();
    const exit=await temporal(p);report.motion.push({reduced,phase:'exit',animation:exit.animation,duration:exit.duration});
    assert.equal(exit.duration,reduced==='reduce'?'0.12s':'0.16s');await p.waitForFunction(()=>!document.querySelector('.historical-time-bar'));
    await p.getByRole('button',{name:'Historical',exact:true}).click();const enter=await temporal(p);report.motion.push({reduced,phase:'enter',animation:enter.animation,duration:enter.duration});
    assert.equal(enter.duration,reduced==='reduce'?'0.12s':'0.2s');if(reduced==='reduce')assert(enter.keyframes.every(k=>!k.transform||k.transform==='none'));await ready();}
  // Delay one unchanged real response in this isolated browser, then supersede it.
  let delayNext=true,delayedUtc=null;
  await p.route('**/api/iss/replay?*',async route=>{const response=await route.fetch();
    if(delayNext){delayNext=false;delayedUtc=new URL(route.request().url()).searchParams.get('at');await p.waitForTimeout(700);}
    try{await route.fulfill({response});}catch{/* Expected when the browser's existing AbortController cancels the request. */}
  });
  const beforeCanceled=await layout(p),beforeCanceledUtc=await p.locator('.context-date time').getAttribute('datetime');
  const firstRequest=p.waitForRequest(r=>r.url().includes('/api/iss/replay?'));
  await back.click();await firstRequest;await back.click();
  const canceledLoading=await layout(p);assert.deepEqual(canceledLoading.slots.map(x=>x.text),beforeCanceled.slots.map(x=>x.text));assert.equal(await p.locator('.context-date time').getAttribute('datetime'),beforeCanceledUtc);
  await ready();await p.waitForTimeout(800);
  assert(report.abortedRequests.some(r=>/ERR_ABORTED/.test(r.error??'')),'Superseded native replay request was not canceled');
  const accepted=(await temporal(p)).utc;assert.notEqual(accepted,delayedUtc);report.cancellation={delayedUtc,accepted,previousCoherentScenePreserved:true,aborted:true};
  await p.unroute('**/api/iss/replay?*');
  // A genuine date outside retained orbit coverage must never substitute Current coordinates.
  await p.setViewportSize({width:320,height:568});
  const currentUtc=(await temporal(p)).utc,uncoveredSteps=Math.round((Date.parse(currentUtc)-Date.parse('2026-09-01T12:00:00Z'))/600000);
  await back.evaluate((e,n)=>{for(let i=0;i<n;i++)e.click();},uncoveredSteps);
  await p.waitForFunction(()=>document.querySelector('.source-state-content')?.textContent==='Orbital source statusUnavailable');
  const unavailable=await layout(p),unavailableTime=await temporal(p);checkHistorical(unavailable,unavailableTime);
  assert(unavailable.slots.slice(1,4).every(x=>x.text.includes('Unavailable')));assert.equal(unavailable.legend[0].color,null);
  report.unavailable={utc:unavailableTime.utc,state:unavailable,actualApiAvailability:answers.get(Date.parse(unavailableTime.utc))?.orbit.availability};
  assert.equal(report.unavailable.actualApiAvailability,'UNAVAILABLE');
  await p.screenshot({path:path.join(out,`${sdk?'development':'production'}-320x568-history-unavailable.png`)});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.resizeWarnings,[]);report.result='PASS';
}finally{fs.writeFileSync(path.join(out,'historical-qa.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
