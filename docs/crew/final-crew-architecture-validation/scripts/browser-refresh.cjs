// EXPLICIT TEST ONLY HTTP response fixtures. DB and real orbital responses are untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(require('node:path').resolve(__dirname,'../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs'));
const [url='http://127.0.0.1:5175/',build='development',output=require('node:path').join(require('node:os').tmpdir(),'mission1-final-crew-refresh')]=process.argv.slice(2);
const backend=process.env.MISSION1_QA_BACKEND||'http://127.0.0.1:8081';
fs.mkdirSync(output,{recursive:true});
const prior=process.env.MISSION1_QA_CONTINUE==='1'&&fs.existsSync(path.join(output,'report.json'))?JSON.parse(fs.readFileSync(path.join(output,'report.json'))):null;
const report={url,build,backend,kind:'EXPLICIT TEST ONLY same-origin Crew HTTP fixtures; real orbit; canonical DB untouched',cases:prior?.cases??[],errors:[],providerRequests:[],expectedReadCancellations:prior?.expectedReadCancellations??[]};
function fixture(real,count){const c=structuredClone(real);c.members=Array.from({length:count},(_,i)=>i<7?{...c.members[i],name:'TEST ONLY · '+c.members[i].name}:{...c.members[0],id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:'TEST ONLY arrival '+i});c.counts.structuredAssignments=count;c.membership.resolvedCurrentMembers=count;return c;}
(async()=>{
 const real=await(await fetch(backend+'/api/iss/crew')).json();
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  for(const [width,height]of[[1440,900],[1024,768],[768,1024],[390,844],[320,568]].filter(([w])=>!report.cases.some(c=>c.width===w))){
   const p=await browser.newPage({viewport:{width,height}});p.setDefaultTimeout(90000);
   p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   p.on('request',r=>{if(/ll\.thespacedevs|wp-json|spacestation\/feed/.test(r.url()))report.providerRequests.push(r.url());});
   let current=fixture(real,7),fail=false,reads=0;
   await p.route('**/api/iss/**',async route=>{
    try {
    const u=new URL(route.request().url());
    if(u.pathname==='/api/iss/crew'){reads++;return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fail?{detail:'TEST ONLY malformed Current DTO'}:current)});}
    return await route.fulfill({response:await route.fetch({url:backend+u.pathname+u.search})});
    } catch(e) { if(/Route is already handled|Target.*closed|context.*disposed|Request.*cancel/i.test(String(e))){report.expectedReadCancellations.push(String(e).split('\n')[0]);return;}throw e; }
   });
   await p.clock.install();await p.goto(url);await p.getByRole('button',{name:'Crew',exact:true}).click();
   await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
   await p.locator('.earth-view canvas').evaluate(e=>{window.__refreshCanvas=e;});
   const mode=await p.locator('main').getAttribute('data-view-mode');
   const selected=await p.locator('.crew-roster-row').first().getAttribute('data-member-id');await p.locator('.crew-roster-row').first().click();
   await p.waitForFunction(()=>!!document.querySelector('.has-astronaut'));current=fixture(real,11);current.membership.revision++;
   await p.clock.fastForward(120001);await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===11);
   assert.equal(await p.locator('.crew-current-membership').count(),11);assert.equal(await p.locator('[data-selected-member-id]').getAttribute('data-selected-member-id'),selected);
   await p.screenshot({path:path.join(output,`${width}-test-only-arrival11.png`)});
   current.members=current.members.filter(m=>m.id!==selected).slice(-7);current.membership.resolvedCurrentMembers=current.members.length;current.membership.revision++;
   await p.clock.fastForward(120001);await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
   await p.clock.fastForward(500);assert.equal(await p.locator('.has-astronaut').count(),0);
   assert.equal(await p.locator('.earth-view canvas').evaluate(e=>e===window.__refreshCanvas),true);
   assert.equal(await p.locator('main').getAttribute('data-view-mode'),mode);assert.equal(await p.evaluate(()=>document.activeElement?.id),'crew-title');
   await p.screenshot({path:path.join(output,`${width}-test-only-departure7.png`)});
   fail=true;await p.clock.fastForward(120001);await p.locator('.crew-error').waitFor();assert.equal(await p.locator('.crew-roster-row').count(),7);
   fail=false;await p.getByRole('button',{name:'Retry crew',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.crew-error'));
   await p.getByRole('button',{name:'Historical',exact:true}).click();await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
   await p.locator('.crew-historical .crew-roster-row').first().waitFor();
   const historicalNames=await p.locator('.crew-roster-identity strong').allTextContents();assert(!historicalNames.some(n=>n.startsWith('TEST ONLY')));
   const historicalReadCount=reads,accepted=await p.locator('.crew-historical').getAttribute('data-accepted-at');
   current=fixture(real,11);await p.clock.fastForward(240001);
   assert.equal(reads,historicalReadCount);assert.deepEqual(await p.locator('.crew-roster-identity strong').allTextContents(),historicalNames);
   assert.equal(await p.locator('.crew-historical').getAttribute('data-accepted-at'),accepted);
   await p.getByRole('button',{name:'Current',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.crew-current-membership').length===11);
   assert.equal(await p.locator('.crew-historical-membership').count(),0);
   const ids=await p.locator('.crew-roster-row').evaluateAll(rows=>rows.map(r=>r.dataset.memberId));assert.equal(new Set(ids).size,ids.length);
   const geometry=await p.evaluate(()=>({documentOverflow:document.documentElement.scrollWidth>innerWidth,panelOverflow:[...document.querySelectorAll('.crew-panel-content')].some(e=>e.scrollWidth>e.clientWidth+1)}));
   assert.deepEqual(geometry,{documentOverflow:false,panelOverflow:false});
   report.cases.push({width,height,arrival:'7→11',departure:'11→7',selectedDepartingPersonCleared:true,lastGoodOnError:true,sameCanvas:true,modePreserved:true,currentReads:reads,cadence:'120s virtual clock; production hook',historicalPaused:true,noCurrentRosterBleed:true,noDuplicateCards:true,geometry,result:'PASS'});
   fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await p.unrouteAll({behavior:"ignoreErrors"});await p.close();console.log(build,width,'FIXTURE REFRESH PASS');
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.providerRequests,[]);report.result='PASS';
 }catch(e){report.result='FAIL';report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
