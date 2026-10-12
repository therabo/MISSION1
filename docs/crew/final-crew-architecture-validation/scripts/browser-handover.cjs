// Real local backend transport only; requested UTC is changed through the visible calendar.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(require('node:path').resolve(__dirname,'../../../frontend/occlusion-aware-workspace-centering/scripts/browser-utils.cjs'));
const [url='http://127.0.0.1:5175/',build='development',output=require('node:path').join(require('node:os').tmpdir(),'mission1-final-crew-handover')]=process.argv.slice(2);
const backend=process.env.MISSION1_QA_BACKEND||'http://127.0.0.1:8081';
fs.mkdirSync(output,{recursive:true});
const prior=process.env.MISSION1_QA_CONTINUE==='1'&&fs.existsSync(path.join(output,'report.json'))?JSON.parse(fs.readFileSync(path.join(output,'report.json'))):null;
const report={url,build,backend,realBackend:true,cases:(prior?.cases??[]).filter(c=>String(c.width)!==process.env.MISSION1_QA_RECHECK_WIDTH),errors:[],currentReads:prior?.currentReads??0,historicalReads:prior?.historicalReads??0};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});
 try{
  for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568]].filter(([w])=>!report.cases.some(c=>c.width===w)&&(!process.env.MISSION1_QA_WIDTHS||process.env.MISSION1_QA_WIDTHS.split(',').map(Number).includes(w)))){
   const p=await browser.newPage({viewport:{width,height}});p.setDefaultTimeout(90000);
   p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await p.route('**/api/iss/**',async route=>{const u=new URL(route.request().url());
    if(u.pathname==='/api/iss/crew')report.currentReads++;
    if(u.pathname==='/api/iss/replay')report.historicalReads++;
    await route.fulfill({response:await route.fetch({url:backend+u.pathname+u.search})});
   });
   const action=name=>p.getByRole('button',{name,exact:true});
   const settled=async()=>{await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')==='false');await p.waitForTimeout(250);};
   const select=async time=>{
    if(await p.locator('.crew-historical-detail').count()){await action('Close astronaut detail').click();await p.locator('.crew-historical-detail').waitFor({state:'detached'});}
    if(await p.locator('.crew-workspace-host').count()){await action('Close crew panel').click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});}
    if(width<=740&&await action('Open Historical controls').isVisible()){await action('Open Historical controls').focus();await action('Open Historical controls').press('Enter');}
    await action('Open Historical calendar').focus();await action('Open Historical calendar').press('Enter');
    const d=time.slice(0,10),hour=time.slice(11,13),minute=time.slice(14,16),second=time.slice(17,19);
    await action(d+' UTC').click();await p.getByLabel('UTC hour',{exact:true}).selectOption(hour);
    await p.getByLabel('UTC minute',{exact:true}).selectOption(minute);await p.getByLabel('UTC second',{exact:true}).selectOption(second);
    await action('Apply').click();await settled();
    await action('Crew').click();await p.locator('.crew-historical').waitFor();await settled();
   };
   await p.goto(url);await action('Crew').click();await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
   await action('Historical').click();await settled();
   const checks=[];
   for(const [time,count]of[['2026-10-02T02:01:54Z',null],['2026-10-02T02:01:55Z',11],['2026-10-07T12:04:59Z',11],['2026-10-07T12:05:00Z',7],['2026-10-07T12:05:01Z',7]]){
    await select(time);
    if(count===null){assert.equal(await p.locator('.crew-roster-row').count(),0);assert((await p.locator('.crew-historical-unavailable').innerText()).includes('No current roster is substituted'));}
    else{await p.waitForFunction(count=>document.querySelectorAll('.crew-roster-row').length===count,count);assert.equal(await p.locator('.crew-roster-row .crew-historical-membership').count(),count);}
    const names=await p.locator('.crew-roster-identity strong').allTextContents();
    if(count===7)for(const name of ['Jessica Meir','Jack Hathaway','Sophie Adenot','Andrei Fedyaev'])assert(!names.includes(name));
    if(count===11)assert(names.includes('Andrei Fedyaev'));
    checks.push({time,count,names,result:'PASS'});
    await p.screenshot({path:path.join(output,`${width}-${time.replaceAll(':','_')}.png`)});
   }
   await select('2026-10-07T12:04:59Z');
   await p.locator('.crew-roster-row').filter({hasText:'Andrei Fedyaev'}).click();await p.locator('.crew-historical-detail').waitFor();
   assert((await p.locator('.crew-historical-detail').innerText()).includes('2026-10-07 12:04:59 UTC'));
   await select('2026-10-07T12:05:00Z');assert.equal(await p.locator('.crew-historical-detail').count(),0);
   await select('2026-10-03T12:04:00Z');
   await action('Close crew panel').click();await p.locator('.crew-workspace-host').waitFor({state:'detached'});
   if(width<=740&&await action('Open Historical controls').isVisible()){await action('Open Historical controls').focus();await action('Open Historical controls').press('Enter');}
   await action('Historical forward 10 minutes').focus();await action('Historical forward 10 minutes').press('Enter');await settled();
   assert.equal(Date.parse(await p.locator('.historical-date time').getAttribute('datetime')),Date.parse('2026-10-03T12:14:00Z'));
   await action('Historical back 10 minutes').focus();await action('Historical back 10 minutes').press('Enter');await settled();
   assert.equal(Date.parse(await p.locator('.historical-date time').getAttribute('datetime')),Date.parse('2026-10-03T12:04:00Z'));
   await action('Crew').click();await p.locator('.crew-historical').waitFor();await settled();
   const before=report.currentReads;const accepted=await p.locator('.crew-historical').getAttribute('data-accepted-at');
   await p.clock.install();await p.clock.fastForward(240001);await p.waitForTimeout(100);
   assert.equal(report.currentReads,before);assert.equal(await p.locator('.crew-historical').getAttribute('data-accepted-at'),accepted);
   await action('Current').click();await settled();await p.waitForFunction(()=>document.querySelectorAll('.crew-roster-row').length===7);
   assert.equal(await p.locator('.crew-historical-membership').count(),0);assert.equal(await p.locator('.crew-current-membership').count(),7);
   report.cases.push({width,height,checks,selectedHistoricalDepartureDetailBeforeSeek:true,departingMemberAbsentAfterAcceptedSeek:true,plusMinusTenMinutes:true,historicalPollingPaused:true,currentReturnSeven:true,result:'PASS'});
   await p.unrouteAll({behavior:"ignoreErrors"});await p.close();console.log(build,width,'REAL HANDOVER PASS');
  }
  assert.deepEqual(report.errors,[]);report.result='PASS';
 }catch(e){report.result='FAIL';report.failure=e.stack;throw e;}
 finally{await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
