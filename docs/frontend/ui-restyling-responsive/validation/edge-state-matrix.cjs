/* Loading/error/variable-content layout evidence. TEST ONLY fixtures are
 * explicit QA route interceptions, never shipped or passed off as ISS facts.
 * Delayed and recovered responses come from the real local backend.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const {geometry,matrix}=require('./responsive-matrix.cjs');
const [url='http://127.0.0.1:5175/',build='development']=process.argv.slice(2);
const out=path.join(__dirname,'edge-states',build);fs.mkdirSync(out,{recursive:true});
async function run(){
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const previous=process.env.MISSION1_QA_RESUME && fs.existsSync(path.join(out,'matrix.json')) ? JSON.parse(fs.readFileSync(path.join(out,'matrix.json'))) : null;
 const report=previous || {url,build,matrix,states:[],errors:[],expectedHttp503:[],console:[]};
 const save=()=>fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(report,null,2)+'\n');
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
 p.on('response',r=>{if(r.status()===503)report.expectedHttp503.push(r.url());});
 try{
  await p.goto(url);await p.evaluate(()=>document.fonts.ready);
  await p.waitForFunction(()=>!document.querySelector('.context-spatial button:last-child').disabled,null,{timeout:120000});
  const crew=await (await p.request.get(new URL('/api/iss/crew',url).href)).json();
  const profile=await (await p.request.get(new URL('/api/iss/crew/'+crew.members[0].id,url).href)).json();
  const open=()=>p.getByRole('button',{name:'Crew',exact:true}).click();
  const close=async()=>{await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});};
  const loaded=()=>p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length>0);
  async function cap(state,testOnly=false){
   if(previous?.states.some(s=>s.state===state && s.entries.length===20 && s.entries.every(e=>!e.failures.length)))return;
   const entries=[];
   for(const [width,height] of matrix){await p.setViewportSize({width,height});await p.waitForTimeout(100);
    const g=await p.evaluate(geometry);const canvas=await p.locator('.earth-view canvas').evaluate(e=>e);
    assert(canvas!==null);const screenshot=`${width}x${height}-${state}.png`;await p.screenshot({path:path.join(out,screenshot)});
    entries.push({...g,screenshot,result:g.failures.length?'FAIL':'PASS'});
   }
   report.states.push({state,testOnly,entries});save();console.log(`${state}: ${entries.filter(e=>!e.failures.length).length}/20`);
   await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(150);
  }
  let release;
  const unlock=async()=>{for(let i=0;typeof release!=='function' && i<1200;i++)await p.waitForTimeout(25);assert.equal(typeof release,'function');const resolve=release;release=null;resolve();};
  await p.route('**/api/iss/crew',async r=>{const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});});
  await open();await p.locator('.crew-loading').waitFor();await cap('crew-loading');await unlock();await loaded();await close();await p.unroute('**/api/iss/crew');
  await p.route('**/api/iss/crew',r=>r.fulfill({status:503,body:''}));await open();await p.locator('.crew-error').waitFor();await cap('crew-error');
  await p.unroute('**/api/iss/crew');await p.getByRole('button',{name:'Retry crew',exact:true}).click();await loaded();await close();
  const empty=structuredClone(crew);empty.station.name='TEST ONLY empty roster';empty.members=[];Object.assign(empty.counts,{officialAboard:0,resolvedAboard:0,unidentifiedAboard:0,structuredAssignments:0});
  await p.route('**/api/iss/crew',r=>r.fulfill({json:empty}));await open();await p.locator('.crew-roster-empty').waitFor();await cap('crew-empty',true);await close();await p.unroute('**/api/iss/crew');
  await p.route('**/api/iss/crew/*',async r=>{const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});});
  await open();await loaded();await p.locator('.crew-roster-row').first().click();await p.locator('.astronaut-profile-body [role="status"]').waitFor();await cap('profile-loading');await unlock();
  await p.locator('.astronaut-profile-body [role="status"]').waitFor({state:'detached'});await close();await p.unroute('**/api/iss/crew/*');
  await p.route('**/api/iss/crew/*',r=>r.fulfill({status:503,body:''}));await open();await loaded();await p.locator('.crew-roster-row').first().click();await p.locator('.astronaut-dock [role="alert"]').waitFor();await cap('profile-error');
  await p.unroute('**/api/iss/crew/*');await p.getByRole('button',{name:'Retry profile',exact:true}).click();await p.locator('.astronaut-profile-body [role="status"]').waitFor({state:'detached'});await p.locator('.astronaut-dock [role="alert"]').waitFor({state:'detached'});await close();
  const long=structuredClone(crew);long.station.name='TEST ONLY long roster';long.expedition.name='TEST ONLY long expedition '.repeat(4);long.counts.officialAboard=null;
  long.members=Array.from({length:24},(_,i)=>({...crew.members[i%crew.members.length],id:require('node:crypto').randomUUID(),name:'TEST ONLY long astronaut identity '.repeat(3),image:null}));
  await p.route('**/api/iss/crew',r=>r.fulfill({json:long}));await open();await loaded();await cap('crew-long',true);
  await p.route('**/api/iss/crew/*',r=>{const id=r.request().url().split('/').at(-1);return r.fulfill({json:{...profile,id,name:long.members.find(m=>m.id===id).name,image:null,biography:'TEST ONLY long biography. '.repeat(100)}});});
  await p.locator('.crew-roster-row').first().click();await p.locator('.astronaut-biography summary').waitFor();await p.locator('.astronaut-biography summary').click();await cap('profile-long',true);await close();await p.unroute('**/api/iss/crew/*');await p.unroute('**/api/iss/crew');
  await p.route('**/api/iss/crew/*',r=>r.fulfill({json:{...profile,id:r.request().url().split('/').at(-1),profileAvailability:'UNAVAILABLE',biography:null,career:null,profileProvenance:null,image:null}}));
  await open();await loaded();await p.locator('.crew-roster-row').first().click();await p.getByText('Structured profile unavailable.',{exact:false}).waitFor();await cap('profile-unavailable',true);await close();await p.unroute('**/api/iss/crew/*');
  const ready=()=>p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
  await p.getByRole('button',{name:'Historical',exact:true}).click();await ready();
  await p.getByRole('button',{name:'Open Historical calendar',exact:true}).click();await p.getByRole('button',{name:'2026-10-03 UTC',exact:true}).click();
  for(const [field,value] of [['hour','12'],['minute','04'],['second','00']])await p.getByLabel('UTC '+field,{exact:true}).selectOption(value);
  await p.getByRole('button',{name:'Apply',exact:true}).click();await ready();
  const accepted=await p.locator('.context-date time').getAttribute('datetime');
  await p.route('**/api/iss/replay?*',async r=>{const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});});
  await p.getByRole('button',{name:'Historical forward 10 minutes',exact:true}).click();await open();await p.locator('.crew-temporal-pending').waitFor();await cap('historical-crew-pending');
  assert.equal(await p.locator('.context-date time').getAttribute('datetime'),accepted);await unlock();await ready();await close();await p.unroute('**/api/iss/replay?*');
  await p.route('**/api/iss/replay?*',r=>r.fulfill({status:503,body:''}));await p.getByRole('button',{name:'Historical forward 10 minutes',exact:true}).click();await open();await p.locator('.crew-error').waitFor();await cap('historical-crew-error');
  await p.unroute('**/api/iss/replay?*');await p.getByRole('button',{name:'Retry historical crew',exact:true}).click();await ready();await close();
  await p.route('**/api/iss/replay?*',async r=>{const response=await r.fetch(),d=await response.json();d.crew.state=null;d.crew.availability='UNAVAILABLE';d.crew.coverage.limitations=['TEST ONLY unavailable historical crew'];await r.fulfill({json:d});});
  await p.getByRole('button',{name:'Historical forward 10 minutes',exact:true}).click();await ready();await open();await p.locator('.crew-historical-unavailable').waitFor();await cap('historical-crew-unavailable',true);
  report.summary={captures:report.states.reduce((n,s)=>n+s.entries.length,0),failures:report.states.flatMap(s=>s.entries.filter(e=>e.failures.length).map(e=>({state:s.state,width:e.width,height:e.height,failures:e.failures})))};
  assert.deepEqual(report.summary.failures,[]);assert.deepEqual(report.errors,[]);assert(!report.console.some(s=>/ResizeObserver|React|Uncaught/.test(s)));report.result='PASS';save();
 }finally{save();await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
