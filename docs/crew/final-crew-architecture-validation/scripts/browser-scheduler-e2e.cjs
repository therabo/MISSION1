// Actual Java scheduler acceptance server -> real REST -> actual production frontend refresh hook.
// Test source fixtures and virtual clocks are explicit; no response DTO is substituted here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(require('node:path').resolve(__dirname,'../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs'));
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
const api=arg('--api'),scenario=arg('--scenario'),frontend=arg('--frontend');
assert(api&&scenario&&frontend,'--api --scenario --frontend required');
const cfg=JSON.parse(fs.readFileSync(path.join(scenario,'scenario.json')));
const report={kind:'TEST ONLY source fixtures, accelerated Java scheduler and browser clock; actual Java HTTP REST and production UI hook; no DTO substitution',api,frontend,scenario:cfg,phases:[],pageErrors:[],consoleErrors:[],expectedUnavailableOrbitalTransport:[],providerRequests:[]};
const mark=name=>fs.writeFileSync(path.join(scenario,name),new Date().toISOString()+'\n');
const wait=async name=>{const deadline=Date.now()+55000;while(!fs.existsSync(path.join(scenario,name))){assert(Date.now()<deadline,'Timed out waiting '+name);await new Promise(resolve=>setTimeout(resolve,100));}};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(40000);
  p.on('pageerror',e=>report.pageErrors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'){if(/Failed to load resource: the server responded with a status of (503|404)/.test(m.text()))report.expectedUnavailableOrbitalTransport.push(m.text());else report.consoleErrors.push(m.text());}});
  p.on('request',r=>{if(/ll\.thespacedevs|wp-json|spacestation\/feed/.test(r.url()))report.providerRequests.push(r.url());});
  await p.route('**/api/iss/**',async route=>{
   const u=new URL(route.request().url());
   try{await route.fulfill({response:await route.fetch({url:api+u.pathname+u.search})});}
   catch(e){if(/Target.*closed|context.*disposed|Request.*cancel/i.test(String(e)))return;throw e;}
  });
  await p.clock.install({time:new Date(Date.parse(cfg.departure)+59000)});
  await p.clock.pauseAt(new Date(Date.parse(cfg.departure)+60000));
  await p.goto(frontend);await p.clock.resume();await p.getByRole('button',{name:'Crew',exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
  assert.equal(await p.locator('.crew-current-membership').count(),7);
  await p.screenshot({path:path.join(scenario,'browser-current-initial-seven.png')});
  report.phases.push({phase:'initial',members:7,result:'PASS'});mark('initial-observed');
  await wait('arrival-ready');await p.clock.fastForward(120001);
  await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===11);
  assert.equal(await p.locator('.crew-current-membership').count(),11);
  const outgoing=p.locator('.crew-roster-row').filter({hasText:cfg.selectedOutgoingName});assert.equal(await outgoing.count(),1);
  const outgoingId=await outgoing.getAttribute('data-member-id');await outgoing.click();await p.locator('.has-astronaut').waitFor();
  assert.equal(await p.locator('[data-selected-member-id]').getAttribute('data-selected-member-id'),outgoingId);
  await p.screenshot({path:path.join(scenario,'browser-current-arrival-eleven-selected.png')});
  report.phases.push({phase:'arrival',members:11,selectedOutgoingId:outgoingId,refresh:'production120s hook; virtual clock',result:'PASS'});mark('arrival-observed');
  await wait('departure-ready');await p.clock.fastForward(120001);
  await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
  await p.waitForFunction(()=>!document.querySelector('.has-astronaut'));
  assert.equal(await p.locator(`.crew-roster-row[data-member-id="${outgoingId}"]`).count(),0);
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'crew-title');
  await p.screenshot({path:path.join(scenario,'browser-current-departure-seven.png')});
  report.phases.push({phase:'departure',members:7,selectedDepartingAstronautCleared:true,refresh:'production120s hook; virtual clock',result:'PASS'});
  await p.clock.setSystemTime(new Date(cfg.departure));
  await p.getByRole('button',{name:'Historical',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
  // The isolated scenario has no orbital history, so the accepted calendar deliberately disables all days.
  // Exact Crew-only UTC checks use real HTTP; UI uses native ten-minute steps from the cached exact departure T.
  for(const [at,count,name]of[[cfg.start,7,'initial'],[cfg.entry,11,'arrival'],[cfg.departure,7,'departure']]){
   const response=await p.request.get(api+'/api/iss/replay?at='+encodeURIComponent(at));assert.equal(response.status(),200);
   const data=await response.json();assert.equal(data.crew.state.members.length,count);
   assert.equal(data.crew.state.membership.mode,'HISTORICAL_V10_S10');
   report.phases.push({phase:'historical-exact-http-'+name,effectiveAt:at,members:count,realJavaHttp:true,result:'PASS'});
  }
  if(await p.locator('.crew-workspace-host').count()){await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});}
  const step=async direction=>{
   await p.getByRole('button',{name:'Historical '+direction+' 10 minutes',exact:true}).click();
   await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');
  };
  for(let i=0;i<24;i++)await step('back');
  const cases=[['initial',Date.parse(cfg.start)+2000,7,0],['arrival',Date.parse(cfg.entry)+1000,11,12],['departure',Date.parse(cfg.departure),7,12]];
  for(const [name,time,count,steps]of cases){
   for(let i=0;i<steps;i++)await step('forward');
   const at=new Date(time).toISOString();
   assert.equal(Date.parse(await p.locator('.historical-date time').getAttribute('datetime')),time);
   await p.getByRole('button',{name:'Crew',exact:true}).click();await p.locator('.crew-historical').waitFor();
   await p.waitForFunction(count=>document.querySelectorAll('.crew-roster-row').length===count,count);
   assert.equal(await p.locator('.crew-roster-row .crew-historical-membership').count(),count);
   if(name==='arrival')assert.equal(await p.locator(`.crew-roster-row[data-member-id="${outgoingId}"]`).count(),1);
   if(name==='departure')assert.equal(await p.locator(`.crew-roster-row[data-member-id="${outgoingId}"]`).count(),0);
   await p.screenshot({path:path.join(scenario,'browser-historical-'+name+'.png')});
   report.phases.push({phase:'historical-ui-'+name,effectiveAt:at,members:count,method:'native ten-minute step controls; orbital-history calendar remains honestly unavailable',result:'PASS'});
   fs.writeFileSync(path.join(scenario,'browser-scheduler-report.json'),JSON.stringify(report,null,2)+'\n');
   if(name==='initial')mark('historical-initial-observed');
   if(name==='arrival')mark('historical-arrival-observed');
   if(name!=='departure'){await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});}
  }
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.providerRequests,[]);
  report.result='PASS';fs.writeFileSync(path.join(scenario,'browser-scheduler-report.json'),JSON.stringify(report,null,2)+'\n');mark('completed');
 }catch(e){report.result='FAIL';report.failure=e.stack;fs.writeFileSync(path.join(scenario,'browser-scheduler-report.json'),JSON.stringify(report,null,2)+'\n');throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
