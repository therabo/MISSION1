/* Phase 10: real Historical Crew, accepted UTC and native Cesium astronomy.
 * Reuses existing geometry/oracle helpers; only edge cases below mutate TEST
 * responses, after all real-data visual captures. No runtime mocks are shipped.
 * node browser-historical-crew-qa.cjs [url] [development|production]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let inspection=fs.readFileSync(path.join(__dirname,'browser-inspection-qa.cjs'),'utf8');
const crewCode=fs.readFileSync(path.join(__dirname,'browser-crew-qa.cjs'),'utf8');
const helperStart=crewCode.indexOf(' async function resizeViewport');
const helpers=crewCode.slice(helperStart,crewCode.indexOf(' report.viewports=[];',helperStart));
const start=' report.viewports=[];report.intermediate=[];',end=' report.resizeActivity=';
assert.equal(inspection.split(start).length,2);assert.equal(inspection.split(end).length,2);
async function historicalCrewScenario(){
 report.viewports=[];report.intermediate=[];
 const ready=async()=>{await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false',null,{timeout:30000});await p.waitForTimeout(240);};
 const ids=()=>p.locator('.crew-roster-row').evaluateAll(rows=>rows.map(r=>r.dataset.memberId));
 const accepted=()=>p.locator('.context-date time').getAttribute('datetime');
 let delay=650,failNext=false,transform=null;
 await p.unroute('**/api/iss/replay?*');
 await p.route('**/api/iss/replay?*',async route=>{
  if(failNext){failNext=false;return route.fulfill({status:503,body:''});}
  const response=await route.fetch(),data=await response.json(),wait=delay;
  const body=transform?transform(structuredClone(data)):data;history.set(Date.parse(body.requestedAt),body);
  await new Promise(r=>setTimeout(r,wait));try{await route.fulfill(transform?{json:body}:{response});}catch{}
 });
 async function calendar(utc){
  await p.getByRole('button',{name:'Open Historical calendar',exact:true}).click();await p.waitForTimeout(140);
  const target=new Date(utc),label=target.toLocaleString('en',{month:'long',year:'numeric',timeZone:'UTC'});
  for(let i=0;i<48&&await p.locator('#calendar-month').innerText()!==label;i++){
   const visible=new Date('1 '+await p.locator('#calendar-month').innerText()+' UTC');await p.keyboard.press(visible<target?'PageDown':'PageUp');
  }
  assert.equal(await p.locator('#calendar-month').innerText(),label);
  await p.getByRole('button',{name:utc.slice(0,10)+' UTC',exact:true}).click();
  for(const [field,value] of [['hour',utc.slice(11,13)],['minute',utc.slice(14,16)],['second',utc.slice(17,19)]])await p.getByLabel('UTC '+field,{exact:true}).selectOption(value);
  await p.getByRole('button',{name:'Apply',exact:true}).click();
 }
 async function checkAccepted(){
  const at=await accepted(),g=await geometry(),data=history.get(Date.parse(at));assert(data,'Accepted replay response missing');
  if(data.crew.availability==='UNAVAILABLE'||!data.crew.state){assert.equal(await p.locator('.crew-historical-unavailable').count(),1);assert.deepEqual(g.ids,[]);assert.equal(Date.parse(await p.locator('.crew-historical').getAttribute('data-accepted-at')),Date.parse(at));coherent(await metrics());return {at,g,unavailable:true};}
  assert.equal(Date.parse(data.crew.state.freshness.evaluatedAt),Date.parse(at),'Backend Crew assessment is not effective at accepted UTC');assert.equal(Date.parse(g.assessment),Date.parse(at));assert.deepEqual(g.ids.slice().sort(),data.crew.state.members.map(m=>m.id).sort());
  assert.equal(g.summary[0].value,data.crew.state.counts.officialAboard===null?'Unavailable':String(data.crew.state.counts.officialAboard));
  assert.equal(g.summary[1].value,String(data.crew.state.counts.resolvedAboard));assert.equal(g.summary[2].value,String(data.crew.state.counts.unidentifiedAboard));
  assert.equal(await p.locator('.crew-workspace .historical-time-bar,.crew-workspace .historical-calendar').count(),0);
  assert.equal(await p.locator('.crew-workspace').count(),1);coherent(await metrics());return {at,g,counts:data.crew.state.counts};
 }
 async function temporalCrew(destination){
  await p.evaluate(()=>{const q=__skyQA;q.hcFrames=[];q.hcRemove=q.viewers[0].scene.postRender.addEventListener(()=>{const n=document.querySelector('.crew-historical'),m=q.metrics();q.hcFrames.push({...m,crewCount:document.querySelectorAll('.crew-panel').length,crewHistorical:!!n,crewAt:n?.dataset.acceptedAt,assessment:n?.querySelector('.crew-assessment time')?.dateTime,roster:[...document.querySelectorAll('.crew-roster-row')].map(b=>b.dataset.memberId)});});});
  const before=await metrics();await p.getByRole('button',{name:destination,exact:true}).click();await ready();
  const samples=await p.evaluate(()=>{__skyQA.hcRemove();return __skyQA.hcFrames;});assert(samples.length);
  for(const f of samples){equal(before,f);coherent(f);assert.equal(f.crewCount,1);assert.equal(f.crewHistorical,f.presentedHistorical);
   if(f.crewHistorical){assert.equal(Date.parse(f.crewAt),Date.parse(f.utc));assert.equal(Date.parse(f.assessment),Date.parse(f.utc));assert.deepEqual(f.roster.slice().sort(),history.get(Date.parse(f.utc)).crew.state.members.map(m=>m.id).sort());}
  }
  return {frames:samples.length,holding:samples.filter(f=>f.holding).length,result:'PASS'};
 }
 await historical.click();await ready();await calendar('2026-10-03T12:00:00Z');await ready();await current.click();await ready();
 if(process.env.MISSION1_HCREW_FLOWS_ONLY==='1'){const previous=JSON.parse(fs.readFileSync(path.join(out,'historical-crew-qa.json')));assert.equal(previous.viewports.length,10);assert.equal(previous.intermediate.length,15);assert([...previous.viewports,...previous.intermediate].every(r=>r.result==='PASS'));report.viewports=previous.viewports;report.intermediate=previous.intermediate;report.figma=previous.figma;report.reusedPassingViewportEvidence=true;}
 for(const [width,height] of process.env.MISSION1_HCREW_FLOWS_ONLY==='1'?[]:[...matrix,...intermediateWidths.map(w=>[w,900])]){
  await resizeViewport({width,height});await open();const currentIds=await ids(),baseGeometry=await geometry();checkCrew(baseGeometry,width,height);
  const enter=await temporalCrew('Historical'),h=await checkAccepted();checkCrew(h.g,width,height);
  await p.locator('.crew-roster-row').last().scrollIntoViewIfNeeded();await p.locator('.crew-panel-content').evaluate(e=>e.scrollTop=0);
  if([1440,1024,390].includes(width)){await p.locator('.crew-historical-evidence > summary').click();const evidence=await geometry();checkCrew(evidence,width,height);assert((await p.locator('.crew-historical-evidence').textContent()).includes('latest-retained metadata'));await p.locator('.crew-historical-evidence > summary').click();}
  const before=await metrics(),pixels=await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x)));
  await p.locator('.crew-roster-row').first().click();await p.locator('.crew-historical-detail').waitFor();assert.equal(await p.locator('.astronaut-dock').count(),0);
  await p.keyboard.press('Escape');await p.locator('.crew-historical-detail').waitFor({state:'detached'});crewStable(before,await metrics());
  assert.deepEqual(await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x))),pixels);
  await p.locator('#replay-crew-title').click();
  if(matrix.some(([w,h])=>w===width&&h===height))await p.screenshot({path:path.join(out,`${width}x${height}-historical-crew.png`)});
  if(width===1440&&height===900){assert.deepEqual(Object.values(h.g.box),[24,88,1392,788]);
   report.figma=await surface.evaluate(e=>{const box=n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};return {outer:box(e),header:box(e.querySelector('header')),summary:box(e.querySelector('.crew-roster-summary')),columns:box(e.querySelector('.crew-roster-columns')),firstRow:box(e.querySelector('.crew-roster-row')),portrait:box(e.querySelector('.crew-portrait')),fill:getComputedStyle(e).backgroundColor,fonts:['h2','.crew-roster-identity strong','.crew-assessment dd'].map(s=>({selector:s,size:getComputedStyle(e.querySelector(s)).fontSize,line:getComputedStyle(e.querySelector(s)).lineHeight,family:getComputedStyle(e.querySelector(s)).fontFamily}))};});
   assert.deepEqual(report.figma.header,[48,108,1344,51]);assert.equal(report.figma.summary[1],159);assert.equal(report.figma.columns[1],230);assert.equal(report.figma.firstRow[1],266);assert(Math.abs(report.figma.firstRow[3]-65.55556)<.03);assert.deepEqual(report.figma.portrait.slice(2),[40,40]);
  }
  const exit=await temporalCrew('Current');assert.deepEqual((await ids()).sort(),currentIds.sort());assert.equal(await p.locator('.crew-historical').count(),0);await shut();
  await historical.click();await ready();const frozen=await metrics();await frames(()=>crew.click());const direct=await checkAccepted();checkCrew(direct.g,width,height);await shut();crewStable(frozen,await metrics());assert.equal((await metrics()).utc,frozen.utc);await current.click();await ready();
  const result={width,height,current:baseGeometry,historical:h.g,enter,exit,directHistoricalEntry:true,sameUtcProfileSkyDifference:0,result:'PASS'};
  (matrix.some(([w,h])=>w===width&&h===height)?report.viewports:report.intermediate).push(result);save();console.log(`${width}x${height}: Current / Historical / detail / Current / close / direct Historical PASS`);
 }
 await resizeViewport({width:1440,height:900});await open();
 // Native operation motion, including deterministic intermediate sampling.
 report.motion=[];
 for(const reduced of ['no-preference','reduce']){
  await p.emulateMedia({reducedMotion:reduced});delay=100;
  const motion=await p.evaluate(async()=>{
   const observer=new MutationObserver(()=>{const g=document.querySelector('.crew-workspace-group');if(g?.dataset.temporalContext!=='historical')return;
    const a=g.getAnimations()[0];if(!a)return;observer.disconnect();a.pause();a.currentTime=a.effect.getTiming().duration*.35;
    globalThis.__hcAnimation=a;globalThis.__hcMotion={timing:a.effect.getTiming(),frames:a.effect.getKeyframes(),opacity:Number(getComputedStyle(g).opacity),hostOpacity:Number(getComputedStyle(g.parentElement).opacity),earthOpacity:Number(getComputedStyle(document.querySelector('.earth-view')).opacity)};
   });observer.observe(document.querySelector('.crew-workspace-host'),{attributes:true,childList:true,subtree:true,attributeFilter:['data-temporal-context']});document.querySelector('.context-temporal button:last-child').click();
   while(!globalThis.__hcMotion)await new Promise(requestAnimationFrame);const m=globalThis.__hcMotion;delete globalThis.__hcMotion;return m;
  });await p.evaluate(()=>__hcAnimation.currentTime=0);await p.screenshot({path:path.join(out,`${reduced}-initial-historical.png`)});motion.opacity=await p.evaluate(async()=>{__hcAnimation.currentTime=__hcAnimation.effect.getTiming().duration*.35;await new Promise(requestAnimationFrame);return Number(getComputedStyle(document.querySelector('.crew-workspace-group')).opacity);});await p.screenshot({path:path.join(out,`${reduced}-intermediate-historical.png`)});await p.evaluate(()=>__hcAnimation.play());await ready();assert.equal(motion.timing.duration,reduced==='reduce'?120:200);assert.equal(motion.timing.easing,reduced==='reduce'?'linear':'cubic-bezier(0.42, 0, 0.58, 1)');assert.equal(motion.timing.iterations,1);assert(motion.frames.every(f=>!f.transform));assert(motion.opacity>0&&motion.opacity<1);assert.equal(motion.hostOpacity,1);assert.equal(motion.earthOpacity,1);
  await p.screenshot({path:path.join(out,`${reduced}-settled-historical.png`)});await temporalCrew('Current');report.motion.push({reduced,motion,result:'PASS'});
 }
 await p.emulateMedia({reducedMotion:'no-preference'});delay=650;
 const rapid=await p.evaluate(async()=>{const q=__skyQA,frames=[],remove=q.viewers[0].scene.postRender.addEventListener(()=>frames.push(q.metrics()));const buttons=document.querySelectorAll('.context-temporal button');for(const i of [1,0,1]){buttons[i].click();await new Promise(r=>setTimeout(r,80));}await new Promise(r=>setTimeout(r,1500));remove();return frames;});
 for(const f of rapid){equal(rapid[0],f);coherent(f);}await ready();await checkAccepted();report.rapidTemporal={frames:rapid.length,latestHistorical:true,oneCrew:true,result:'PASS'};await p.screenshot({path:path.join(out,'interrupted-settled-historical.png')});
 // Calendar commit and a genuinely delayed matching replay response.
 const t1=await accepted(),roster1=await ids();await close.click();delay=2500;await calendar('2026-10-03T12:10:00Z');await crew.click();await p.waitForTimeout(500);
 assert.equal(await accepted(),t1);assert.deepEqual(await ids(),roster1);assert.equal(Date.parse((await geometry()).assessment),Date.parse(t1));assert((await metrics()).holding);
 await ready();const t2=await checkAccepted();assert.equal(Date.parse(t2.at),Date.parse('2026-10-03T12:10:00Z'));report.seek={pendingAcceptedT1:t1,acceptedT2:t2.at,result:'PASS'};
 // Failed T3 retains accepted T2; real retry must recover exact requested UTC.
 await close.click();failNext=true;await calendar('2026-10-03T12:20:00Z');await crew.click();await p.locator('.crew-error').waitFor();assert.equal(await accepted(),t2.at);assert.equal(Date.parse((await geometry()).assessment),Date.parse(t2.at));delay=100;await p.getByRole('button',{name:'Retry historical crew',exact:true}).click();await ready();const recovered=await checkAccepted();assert.equal(Date.parse(recovered.at),Date.parse('2026-10-03T12:20:00Z'));report.errorRetry={http503:true,keptT2:true,retryReal:true,recovered:recovered.at,result:'PASS'};
 // Overlap real T2/T3 responses; abort identity prevents stale acceptance.
 await close.click();delay=2500;await calendar('2026-10-03T12:30:00Z');await crew.click();await p.waitForTimeout(500);await close.click();delay=100;await calendar('2026-10-03T12:40:00Z');await crew.click();await ready();await p.waitForTimeout(2600);const latest=await checkAccepted();assert.equal(Date.parse(latest.at),Date.parse('2026-10-03T12:40:00Z'));report.rapidSeek={overlapping:true,latest:latest.at,staleCannotOverwrite:true,result:'PASS'};
 // Calendar Cancel leaves accepted UTC; Crew close/open has identical GPU sky.
 await shut();const frozen=await metrics(),sky=await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x)));await p.getByRole('button',{name:'Open Historical calendar',exact:true}).click();await p.getByRole('button',{name:'2026-10-02 UTC',exact:true}).click();await p.getByRole('button',{name:'Cancel',exact:true}).click();await frames(()=>crew.click());assert.equal(await accepted(),latest.at);assert.deepEqual(await p.evaluate(()=>__skyQA.sample().then(x=>Array.from(x))),sky);await shut();crewStable(frozen,await metrics());report.calendarCancel={sameUtc:true,skyPixelDifference:0,result:'PASS'};
 report.sources=[];
 for(const preference of ['PRIMARY_GP_TLE','NASA_OEM']){
  await current.click();await ready();await p.getByLabel('Orbital source',{exact:true}).selectOption(preference);await p.waitForTimeout(300);const before=await metrics();await historical.click();await ready();await frames(()=>crew.click());const h=await checkAccepted();await shut();await current.click();await ready();assert.equal((await metrics()).source,preference);equal(before,await metrics());report.sources.push({preference,historicalSource:history.get(Date.parse(h.at)).orbit.primary.source.kind,result:'PASS'});
 }
 await historical.click();await ready();await calendar('2026-09-30T12:04:00Z');await ready();await frames(()=>crew.click());assert.equal((await metrics()).source,'NASA_OEM');await checkAccepted();await shut();report.historicalOem={realFallback:true,result:'PASS'};
 // TEST-only extremes; no response mutation before real matrix/screenshots.
 await calendar('2026-10-03T12:40:00Z');await ready();
 const original=history.get(Date.parse(await accepted()));assert(original.crew.state.members.length);const realHistoricalInputs=[...history.values()];report.variableData=[];
 transform=d=>{const original=d.crew.state.members;d.crew.state.members=Array.from({length:24},(_,i)=>({...original[i%original.length],id:require('node:crypto').randomUUID(),name:'TEST ONLY long historical astronaut '.repeat(3),image:null}));d.crew.state.expedition.name='TEST ONLY long historical expedition '.repeat(3);d.crew.state.counts.officialAboard=null;d.crew.coverage.limitations=['TEST ONLY partial coverage'];return d;};
 await current.click();await ready();await historical.click();await ready();await frames(()=>crew.click());
 for(const [width,height] of [[1440,900],[768,1024],[430,932],[390,844],[360,800],[320,568],[844,390]]){await resizeViewport({width,height});const g=await geometry();checkCrew(g,width,height);assert.equal(g.ids.length,24);await p.locator('.crew-roster-row').last().scrollIntoViewIfNeeded();assert((await geometry()).scroll.top>0);report.variableData.push({width,height,longNames:true,longMission:true,nullableCount:true,noPortrait:true,rows:24,testOnly:true,result:'PASS'});}
 // Native touch scroll vs exposed real scene orbit.
 await resizeViewport({width:390,height:844});await p.locator('.crew-panel-content').evaluate(e=>e.scrollTop=0);const beforeTouch=await metrics(),g=await geometry(),cdp=await p.context().newCDPSession(p),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
 const x=g.box.x+g.box.width*.65,y=g.box.y+g.box.height*.8;await touch('touchStart',[[x,y,1]]);for(let i=1;i<=10;i++){await touch('touchMove',[[x,y-i*20,1]]);await p.waitForTimeout(25);}await touch('touchEnd',[]);await p.waitForTimeout(500);crewStable(beforeTouch,await metrics());assert((await geometry()).scroll.top>0);
 const exposed=await p.evaluate(()=>{for(let x=2;x<innerWidth;x+=30)for(const y of [innerHeight-3,innerHeight-20,260,400])if(document.elementFromPoint(x,y)===document.querySelector('canvas'))return {x,y};return null;});assert(exposed);const b=await metrics();await touch('touchStart',[[exposed.x,exposed.y,1]]);for(let i=1;i<=8;i++){await touch('touchMove',[[exposed.x+i*3,exposed.y-i*2,1]]);await p.waitForTimeout(20);}await touch('touchEnd',[]);await p.waitForTimeout(2500);assert(delta(b.camera.position,(await metrics()).camera.position)>1e-3);await cdp.detach();report.touch={rosterScroll:true,noOrbitLeak:true,exposedSceneOrbit:true,result:'PASS'};
 await shut();await current.click();await ready();
 for(const state of ['small','zero','unavailable']){
  transform=d=>{if(state==='unavailable'){d.crew.state=null;d.crew.availability='UNAVAILABLE';return d;}d.crew.state.members=state==='small'?d.crew.state.members.slice(0,2):[];if(state==='zero')Object.assign(d.crew.state.counts,{officialAboard:0,lastKnownOfficialAboard:0,resolvedAboard:0,unidentifiedAboard:0,structuredAssignments:0});return d;};
  await historical.click();await ready();await frames(()=>crew.click());assert.equal((await ids()).length,state==='small'?2:0);assert.equal(await p.locator('.crew-historical-unavailable').count(),state==='unavailable'?1:0);if(state==='zero'){assert.equal((await geometry()).summary[0].value,'0');assert.equal(await p.locator('.crew-roster-empty').count(),1);}await shut();await current.click();await ready();report.variableData.push({state,testOnly:true,noCurrentFallback:true,result:'PASS'});
 }
 transform=null;report.realInputs={currentCrew:realCrew,historicalEnvelopes:realHistoricalInputs,currentWindows,comparisons};
}
const code=historicalCrewScenario.toString(),body=helpers+code.slice(code.indexOf('{')+1,code.lastIndexOf('}'));
const escaped=body.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${');
inspection=inspection.slice(0,inspection.indexOf(start))+escaped+inspection.slice(inspection.indexOf(end));
inspection=inspection.replaceAll("'inspection-qa.json'","'historical-crew-qa.json'").replaceAll("'crew-qa.json'","'historical-crew-qa.json'");
new Function('require','__dirname','process',inspection)(require,__dirname,process);
