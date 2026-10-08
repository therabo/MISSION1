/* Real Cesium/backend Crew QA. Reuse the unchanged astronomical oracle and
 * read-only SDK observer. Edge-case response mutations are TEST-only and run
 * after real-data screenshots; they never ship or persist to the backend.
 * node browser-crew-qa.cjs [url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let inspection=fs.readFileSync(path.join(__dirname,'browser-inspection-qa.cjs'),'utf8');
const start=' report.viewports=[];report.intermediate=[];',end=' report.resizeActivity=';
assert.equal(inspection.split(start).length,2);assert.equal(inspection.split(end).length,2);
async function crewScenario(){
 async function resizeViewport(viewport){
  await p.setViewportSize(viewport);
  await p.waitForFunction(()=>{const v=__skyQA.viewers[0],c=v.scene.canvas;return c.width===Math.floor(c.clientWidth*v.resolutionScale)&&c.height===Math.floor(c.clientHeight*v.resolutionScale);});
  await p.waitForTimeout(180);
 }
 const crew=p.getByRole('button',{name:'Crew',exact:true});
 const realCrew=[];p.on('response',async r=>{if(r.ok()&&r.url().endsWith('/api/iss/crew'))try{realCrew.push(await r.json());}catch{}});
 const host=p.locator('.crew-workspace-host'),surface=p.locator('.crew-workspace'),close=p.getByRole('button',{name:'Close crew panel',exact:true});
 const save=()=>fs.writeFileSync(path.join(out,'crew-qa.json'),JSON.stringify(report,null,2));
 async function geometry(){return surface.evaluate(e=>{
  const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},s=getComputedStyle(e),content=e.querySelector('.crew-panel-content');
  const clipped=[];for(const row of e.querySelectorAll('.crew-roster-row')){const b=row.getBoundingClientRect();for(const text of row.querySelectorAll('strong,span:not(.crew-portrait,.crew-roster-chevron),small')){if(getComputedStyle(text).display==='none')continue;const r=text.getBoundingClientRect();if(r.width&&r.height&&(r.left<b.left-.5||r.right>b.right+.5||r.top<b.top-.5||r.bottom>b.bottom+.5))clipped.push(text.textContent);}}
  return {box:box(e),context:box(document.querySelector('.top-context-bar')),canvas:box(document.querySelector('canvas')),fill:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow,blur:s.backdropFilter,header:box(e.querySelector('header')),scroll:{top:content.scrollTop,height:content.clientHeight,total:content.scrollHeight},clipped,
    overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,
    controls:[...e.querySelectorAll('header button')].map(b=>({...box(b),label:b.textContent})),rowTargets:[...e.querySelectorAll('.crew-roster-row')].map(box),ids:[...e.querySelectorAll('[data-member-id]')].map(b=>b.dataset.memberId),
    summary:[...e.querySelectorAll('.crew-roster-summary > div')].map(n=>({label:n.querySelector('dt').textContent,value:n.querySelector('dd').textContent})),assessment:e.querySelector('.crew-assessment time')?.dateTime,focus:document.activeElement?.id};
 });}
 function checkCrew(g,width,height){assert(!g.overflow,'Document overflow');assert.deepEqual(g.clipped,[],'Roster cell collision');assert(g.box.x>0&&g.box.y>g.context.height&&g.box.x+g.box.width<width&&g.box.y+g.box.height<height,'Detached margins');assert.deepEqual([g.canvas.x,g.canvas.y,g.canvas.width,g.canvas.height],[0,0,width,height]);assert.equal(g.fill,'rgba(21, 29, 39, 0.6)');assert.equal(g.radius,'6px');assert.equal(g.shadow,'none');assert.equal(g.blur,'none');assert(g.rowTargets.every(b=>b.height>=44));if(width<1244)assert(g.controls.every(c=>c.width>=44&&c.height>=44));}
 function crewStable(a,b){equal(a,b);assert.equal(b.modelCount,1);assert.equal(b.mode,'EARTH_OVERVIEW');assert.equal(b.uiMode,'EARTH_OVERVIEW');assert.equal(b.source,a.source);}
 async function frames(action){await p.evaluate(()=>{const q=__skyQA;q.crewFrames=[];q.crewRemove=q.viewers[0].scene.postRender.addEventListener(()=>q.crewFrames.push({...q.metrics(),crewInteractive:!!document.querySelector('.crew-workspace-host:not([inert]) .crew-workspace'),legacyCrew:!!document.querySelector('#replay-crew-title')}));});
  const before=await metrics();await action();await p.waitForTimeout(350);const samples=await p.evaluate(()=>{__skyQA.crewRemove();return __skyQA.crewFrames;});assert(samples.length);for(const f of samples){crewStable(before,f);coherent(f);}return {before,after:await metrics(),frames:samples.length,result:'PASS'};
 }
 async function open(){const r=await frames(()=>crew.click());await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);assert.equal(await p.locator('.crew-panel').count(),1);return r;}
 async function shut(){const r=await frames(()=>close.click());await host.waitFor({state:'detached'});assert.equal(await crew.getAttribute('aria-expanded'),'false');return r;}
 async function requestFromInspection(){
  const before=await metrics();await p.evaluate(()=>{const q=__skyQA;q.returnFrames=[];q.returnRemove=q.viewers[0].scene.postRender.addEventListener(()=>q.returnFrames.push({...q.metrics(),crewInteractive:!!document.querySelector('.crew-workspace-host:not([inert]) .crew-workspace')}));});
  await crew.click();assert.equal(await surface.count(),0);await readyMode('EARTH_OVERVIEW');await p.waitForFunction(()=>!!document.querySelector('.crew-workspace'));await p.waitForTimeout(280);
  const samples=await p.evaluate(()=>{__skyQA.returnRemove();return __skyQA.returnFrames;});
  assert(samples.some(f=>f.mode==='EXITING_INSPECTION'));assert(samples.every(f=>!f.crewInteractive||f.mode==='EARTH_OVERVIEW'&&f.uiMode==='EARTH_OVERVIEW'),'Crew opened before coherent Earth return');
  for(const f of samples){stableScene(before,f);coherent(f);}restored(report.earthSnapshot,await metrics());assert((await metrics()).at-before.at>3000,'Crew snapped camera');
  return {frames:samples.length,states:[...new Set(samples.map(f=>f.mode))],crewOnlyAfterEarth:true,result:'PASS'};
 }
 report.viewports=[];report.intermediate=[];
 if(process.env.MISSION1_CREW_FLOWS_ONLY==='1'){
  const previous=JSON.parse(fs.readFileSync(path.join(out,'crew-qa.json')));assert.equal(previous.viewports.length,10);assert.equal(previous.intermediate.length,15);assert([...previous.viewports,...previous.intermediate].every(r=>r.result==='PASS'));assert.deepEqual(previous.errors,[]);
  report.viewports=previous.viewports;report.intermediate=previous.intermediate;report.figma=previous.figma;report.reusedPassingViewportEvidence=true;
 }
 for(const [width,height] of process.env.MISSION1_CREW_FLOWS_ONLY==='1'?[]:[...matrix,...intermediateWidths.map(w=>[w,900])]){
  await resizeViewport({width,height});await p.waitForTimeout(180);const enter=await open(),g=await geometry();checkCrew(g,width,height);
  await p.locator('.crew-roster-row').last().scrollIntoViewIfNeeded();assert(await p.locator('.crew-roster-row').last().isVisible());
  await p.locator('.crew-panel-content').evaluate(e=>e.scrollTop=0);crewStable(enter.before,await metrics());
  if(matrix.some(([w,h])=>w===width&&h===height))await p.screenshot({path:path.join(out,`${width}x${height}-crew.png`)});
  if(width===1440&&height===900){assert.deepEqual(Object.values(g.box),[24,88,1392,788]);assert.deepEqual(Object.values(g.context),[0,0,1440,64]);report.figma=g;}
  const exit=await shut();checkLayout(await layout(p));
  report.earthSnapshot=await metrics();await spatial('ISS Inspection');const fromInspection=await requestFromInspection();checkCrew(await geometry(),width,height);await shut();
  const r={width,height,geometry:g,enter,exit,fromInspection,result:'PASS'};(matrix.some(([w,h])=>w===width&&h===height)?report.viewports:report.intermediate).push(r);save();console.log(`${width}x${height}: Earth / Crew / close / Inspection return / Crew PASS`);
 }
 // The runtime roster is the complete real response, with its backend counts.
 await resizeViewport({width:1440,height:900});await open();const data=realCrew.at(-1);assert(data);const g=await geometry();
 assert.deepEqual([...g.ids].sort(),data.members.map(m=>m.id).sort());assert.equal(g.summary[0].value,data.counts.officialAboard===null?'Unavailable':String(data.counts.officialAboard));assert.equal(g.summary[1].value,String(data.counts.resolvedAboard));assert.equal(g.summary[2].value,String(data.counts.unidentifiedAboard));assert.equal(g.assessment,data.freshness.evaluatedAt);report.realRoster={ids:g.ids,counts:data.counts,assessment:g.assessment,result:'PASS'};
 // S8 replaces only Current detail; the real lazy profile and roster remain alive.
 const row=p.locator('.crew-roster-row').first(),id=await row.getAttribute('data-member-id');await row.focus();await p.keyboard.press('Enter');await p.locator('.astronaut-dock').waitFor();assert.equal(await surface.count(),1);assert.equal(await p.locator('.context-dock').count(),1);assert.equal(await p.locator('.crew-panel').count(),1);await p.keyboard.press('Escape');await p.locator('.astronaut-dock').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>document.activeElement?.dataset.memberId),id);report.currentProfile={id,lazyRealProfile:true,escapeBack:true,rosterMounted:true,newDock:true,result:'PASS'};await p.keyboard.press('Escape');await host.waitFor({state:'detached'});assert.equal(await p.evaluate(()=>document.activeElement?.id),'crew-launcher');
 // Current source preference survives Crew; no duplicated source owner exists.
 report.sources=[];
 for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){const select=p.getByLabel('Orbital source',{exact:true});if(await select.locator(`option[value="${source}"]`).isDisabled()){report.sources.push({source,unavailableGuard:true});continue;}await select.selectOption(source);await p.waitForTimeout(350);const initial=await metrics();await open();assert.equal((await metrics()).source,source);await shut();crewStable(initial,await metrics());report.sources.push({source,result:'PASS'});}
 await p.getByLabel('Orbital source',{exact:true}).selectOption('PRIMARY_GP_TLE');
 // Module → Crew clears actual feature tint and both authoritative selection refs.
 report.earthSnapshot=await metrics();await spatial('ISS Inspection');
 await p.evaluate(()=>{const q=__skyQA;q.features=new Map();q.originals=new Map();const native=__v.scene.pick;__v.scene.pick=function(...args){const h=native.apply(this,args);if(h?.getProperty?.('moduleCode')&&!q.features.has(h.featureId)){q.features.set(h.featureId,h);const c=h.color;q.originals.set(h.featureId,[c.red,c.green,c.blue,c.alpha]);}return h;};q.ref=()=>{let f=document.querySelector('.earth-view')[Object.keys(document.querySelector('.earth-view')).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.current?.componentId)return h.memoizedState;return null;};});
 let hit;for(const mapping of manifest.semanticMappings){const point=await p.evaluate(scan,{mapping,node:nodes.find(n=>n.index===mapping.nodeIndex)});if(point){hit={mapping,point};break;}}assert(hit);await p.evaluate(id=>{__skyQA.feature=__skyQA.features.get(id);__skyQA.original=__skyQA.originals.get(id);},hit.mapping.featureId);assert(await p.evaluate(()=>!!__skyQA.feature));await p.mouse.click(hit.point.x,hit.point.y);await p.waitForFunction(()=>!!document.querySelector('.module-dock[data-state="open"]'));await p.mouse.move(2,2);await p.waitForTimeout(150);await p.evaluate(()=>__skyQA.savedRef=__skyQA.ref());assert(await p.evaluate(()=>!!__skyQA.savedRef));
 await requestFromInspection();const cleaned=await p.evaluate(()=>{const q=__skyQA,c=q.feature.color;return {original:q.original,color:[c.red,c.green,c.blue,c.alpha],ref:q.savedRef.current};});assert.deepEqual(cleaned.color,cleaned.original);assert.equal(cleaned.ref,null);assert.equal(await p.locator('.module-dock').count(),0);await shut();report.earthSnapshot=await metrics();await spatial('ISS Inspection');assert.equal(await p.locator('.inspection-selection strong').innerText(),'None');await spatial('Earth');report.moduleCleanup={module:hit.mapping.componentId,exactOriginalColor:true,nativeRefClear:true,noStaleReentry:true,result:'PASS'};
 // Queued request can be cancelled; the unchanged physical return still finishes.
 report.earthSnapshot=await metrics();await spatial('ISS Inspection');await crew.click();await p.waitForTimeout(500);assert.equal((await metrics()).mode,'EXITING_INSPECTION');await crew.click();await readyMode('EARTH_OVERVIEW');assert.equal(await surface.count(),0);restored(report.earthSnapshot,await metrics());report.cancelledRequest={returnPreserved:true,noLateCrew:true,result:'PASS'};
 // Motion samples: entry, intermediate, settled, exit, interrupted, reduced.
 report.motion=[];
 for(const reduced of ['no-preference','reduce']){await p.emulateMedia({reducedMotion:reduced});const sampled=await p.evaluate(async()=>{
   document.querySelector('.context-crew').click();await new Promise(requestAnimationFrame);
   const e=document.querySelector('.crew-workspace-host'),a=e.getAnimations()[0];const timing=a.effect.getTiming(),frames=a.effect.getKeyframes();
   // Sample the UI animation's native timeline deterministically; the real
   // Cesium clock/camera continue unchanged. No remote round-trip timing race.
   a.pause();a.currentTime=timing.duration*.35;const intermediate=Number(getComputedStyle(e).opacity);a.play();
   return {motion:[{timing,frames}],intermediate,sampledAtMs:timing.duration*.35};
  });const {motion,intermediate}=sampled;assert.equal(motion[0].timing.duration,reduced==='reduce'?120:240);assert(motion[0].frames.every(f=>!f.transform));assert.equal(motion[0].timing.iterations,1);assert(intermediate>0&&intermediate<1);await host.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});assert.equal(await host.evaluate(e=>Number(getComputedStyle(e).opacity)),1);
  await close.evaluate(e=>e.click());const exit=await host.evaluate(e=>({inert:e.hasAttribute('inert'),animations:e.getAnimations().map(a=>({timing:a.effect.getTiming(),frames:a.effect.getKeyframes()}))}));assert(exit.inert);assert.equal(exit.animations[0].timing.duration,reduced==='reduce'?120:200);assert(exit.animations[0].frames.every(f=>!f.transform));await crew.evaluate(e=>e.click());await p.waitForTimeout(350);assert.equal(await surface.count(),1);assert.equal(await p.evaluate(()=>document.activeElement?.id),'crew-title');await shut();report.motion.push({reduced,motion,intermediate,sampledAtMs:sampled.sampledAtMs,exit,rapidReopen:true,result:'PASS'});
 }
 await p.emulateMedia({reducedMotion:'no-preference'});
 // Same accepted Historical UTC: original Crew presentation, exact sky/ephemeris.
 await historical.click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');const frozen=await metrics();const sky=await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x)));const historicalEnter=await frames(()=>crew.click());assert.equal(await p.locator('#replay-crew-title').count(),1);assert.equal(await surface.count(),0);const after=await metrics();crewStable(frozen,after);assert.equal(after.utc,frozen.utc);for(const k of ['starTransform','sunPositionWC','moonDirectionEC','iss','sunDirectionWC'])assert.deepEqual(after[k],frozen[k]);assert.deepEqual(await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x))),sky);await close.click();await p.waitForTimeout(180);assert.equal((await metrics()).utc,frozen.utc);report.historicalCrew={legacy:true,newS9:false,sameUtc:frozen.utc,skyPixelDifference:0,enter:historicalEnter,result:'PASS'};await current.click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
 // Native touch: scroll belongs to Crew, exposed scene retains real orbit input.
 await resizeViewport({width:390,height:844});await open();const cdp=await p.context().newCDPSession(p);const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});const b=await metrics(),s=await geometry(),x=s.box.x+s.box.width*.65,y=s.box.y+s.box.height*.8;
 await touch('touchStart',[[x,y,1]]);for(let i=1;i<=10;i++){await touch('touchMove',[[x,y-i*20,1]]);await p.waitForTimeout(25);}await touch('touchEnd',[]);await p.waitForTimeout(500);crewStable(b,await metrics());assert((await geometry()).scroll.top>0,'Crew touch scroll failed');const scrolled=(await geometry()).scroll.top;
 const exposed=await p.evaluate(()=>{for(let x=2;x<innerWidth;x+=30)for(const y of [innerHeight-3,innerHeight-20,260,400])if(document.elementFromPoint(x,y)===document.querySelector('canvas'))return {x,y};return null;});assert(exposed,'No exposed scene input');const beforeOrbit=await metrics();await touch('touchStart',[[exposed.x,exposed.y,1]]);for(let i=1;i<=8;i++){await touch('touchMove',[[exposed.x+i*3,exposed.y-i*2,1]]);await p.waitForTimeout(20);}await touch('touchEnd',[]);await p.waitForTimeout(1000);assert(delta(beforeOrbit.camera.position,(await metrics()).camera.position)>1e-3,'Exposed scene touch failed');assert.equal((await geometry()).scroll.top,scrolled);await cdp.detach();await shut();report.touch={crewScroll:true,noOrbitLeak:true,exposedSceneOrbit:true,result:'PASS'};
 // Explicit TEST-only variable-data layout; not a production roster substitute.
 let testData=structuredClone(data);testData.members=Array.from({length:24},(_,i)=>({...testData.members[i%testData.members.length],id:require('node:crypto').randomUUID(),name:'TEST ONLY — Long astronaut identity '.repeat(3),agency:i%2?null:testData.members[0].agency,image:null}));testData.station.name='TEST ONLY — layout fixture';testData.expedition.name='TEST ONLY — Long mission label '.repeat(3);testData.counts.officialAboard=null;
 await p.route('**/api/iss/crew',route=>route.fulfill({json:testData}));report.variableData=[];
 for(const [width,height] of [[1440,900],[768,1024],[430,932],[390,844],[360,800],[320,568],[844,390]]){await resizeViewport({width,height});await open();const g=await geometry();checkCrew(g,width,height);assert.equal(g.ids.length,24);await p.locator('.crew-roster-row').last().scrollIntoViewIfNeeded();assert((await geometry()).scroll.top>0);report.variableData.push({width,height,testOnly:true,longNames:true,nullableCount:true,rows:24,result:'PASS'});await shut();}
 // TEST-only zero/empty response; keep unavailable and zero distinguishable.
 testData=structuredClone(data);testData.station.name='TEST ONLY — layout fixture';testData.members=[];testData.unresolvedSubjects=[];Object.assign(testData.counts,{officialAboard:0,lastKnownOfficialAboard:0,resolvedAboard:0,unresolvedSubjects:0,unidentifiedAboard:0,structuredAssignments:0});
 await crew.click();await p.locator('.crew-roster-empty').waitFor();const empty=await geometry();assert.equal(empty.ids.length,0);assert.equal(empty.summary[0].value,'0');checkCrew(empty,844,390);await shut();report.empty={testOnly:true,zero:true,noSyntheticMembers:true,result:'PASS'};
 await p.unroute('**/api/iss/crew');
 // An isolated real HTTP status exercises error/retry; retry returns to real data.
 await p.route('**/api/iss/crew',route=>route.fulfill({status:503,body:''}));await crew.click();await p.locator('.crew-error').waitFor();const errorGeometry=await geometry();assert.equal(errorGeometry.ids.length,0);checkCrew(errorGeometry,844,390);await p.unroute('**/api/iss/crew');await p.getByRole('button',{name:'Retry crew',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);assert.deepEqual((await geometry()).box,errorGeometry.box);await shut();report.errorRetry={http503:true,retryRealResponse:true,shellStable:true,result:'PASS'};
 await p.route('**/api/iss/crew',async route=>{const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({response});});await crew.click();await p.locator('.crew-loading').waitFor();const loadingGeometry=await geometry();assert.equal(loadingGeometry.ids.length,0);await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);assert.deepEqual((await geometry()).box,loadingGeometry.box);await shut();await p.unroute('**/api/iss/crew');report.loading={realResponseDelayed:true,shellStable:true,noFakeAstronauts:true,result:'PASS'};
 report.realInputs={crew:realCrew.filter(d=>d.station?.name!=='TEST ONLY — layout fixture'),historicalEnvelopes:[...history.values()],currentWindows,comparisons};
}
const code=crewScenario.toString(),body=code.slice(code.indexOf('{')+1,code.lastIndexOf('}'));
const escaped=body.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${');
inspection=inspection.slice(0,inspection.indexOf(start))+escaped+inspection.slice(inspection.indexOf(end));
inspection=inspection.replaceAll("'inspection-qa.json'","'crew-qa.json'");
new Function('require','__dirname','process',inspection)(require,__dirname,process);
