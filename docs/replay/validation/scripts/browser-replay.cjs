// Real backend/production QA. No provider fixtures, request interception, scene/camera/clock writes.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../browser');
function pose(){
 const el=document.querySelector('.earth-view');let fiber=el&&el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],v,model,trails=[];
 for(let f=fiber;f&&!v;f=f.return){for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.scene?.camera&&r?.clock)v=r;if(r?.modelMatrix&&typeof r.ready==='boolean')model=r;if(r?.trails)trails.push(...r.trails.flatMap(t=>t.layers.map(l=>l.primitive.show)));}}
 if(!v)return null;
 if(!globalThis.__replayQaViewer)globalThis.__replayQaViewer=v;
 const vector=x=>[x.x,x.y,x.z];
 return {sameViewer:globalThis.__replayQaViewer===v,position:vector(v.camera.positionWC),direction:vector(v.camera.directionWC),up:vector(v.camera.upWC),fov:v.camera.frustum.fov,animate:v.clock.shouldAnimate,epoch:v.clock.currentTime.constructor.toIso8601(v.clock.currentTime),modelShown:model?.show,modelPosition:model&&vector(model.boundingSphere.center),trails};
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];
try{for(const port of [5175,4175])for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:720},deviceScaleFactor:1});const page=await context.newPage();
 const row={port,width,errors:[],requests:[],cases:[],sourceInspection:[]};page.on('pageerror',e=>row.errors.push(String(e)));page.on('request',r=>{if(r.url().includes('/api/iss/')||/ll.thespacedevs|celestrak.org|nasa-public-data.*ISS_OEM|blogs\/spacestation\/feed/.test(r.url()))row.requests.push({url:r.url(),time:Date.now()});});
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:60000});
 await page.locator('#crew-launcher').click();await page.locator('.crew-summary').waitFor();row.liveCrew=await page.locator('#crew-panel').innerText();await page.getByRole('button',{name:'Close crew panel'}).click();row.before=await page.evaluate(pose);if(!row.before)throw Error('Viewer read probe unavailable');
 row.replayStart=Date.now();await page.getByRole('button',{name:'Replay history',exact:true}).click();await page.getByRole('button',{name:'Crew history',exact:true}).click();
 const coverage=await (await context.request.get('http://127.0.0.1:8080/api/iss/replay/coverage')).json();const last=new Date(Date.parse(coverage.evaluatedAt)-60000).toISOString().slice(0,19);
 const values=[['earliest','2026-10-02T02:01:55'],['middle','2026-10-02T23:00:00'],['latest',last],['unsupported','2026-01-01T00:00:00']];
 for(const [label,value]of values){const expected=await(await context.request.get('http://127.0.0.1:8080/api/iss/replay?at='+value+'Z')).json();
  await page.getByLabel('Replay UTC instant',{exact:true}).fill(value.endsWith(':00')?value.slice(0,-3):value);await page.waitForFunction(t=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes(t)&&!document.body.textContent.includes('Loading historical state'),value,{timeout:30000});
  await page.waitForTimeout(500);const snapshot=await page.evaluate(pose),crew=await page.locator('#crew-panel').innerText();
  if(snapshot.animate||Math.abs(Date.parse(snapshot.epoch)-Date.parse(value+'Z'))>1)throw Error('Scene epoch mismatch '+JSON.stringify(snapshot));
  if(snapshot.position.some((x,i)=>Math.abs(x-row.before.position[i])>0.001)||!snapshot.sameViewer)throw Error('Replay mode moved camera or replaced Viewer');
  if(snapshot.trails.some(Boolean))throw Error('Current trajectories visible in Replay');
  if(expected.orbit.primary){if(!snapshot.modelShown)throw Error('Historical model hidden');const s=expected.orbit.primary,p=s.position,lat=s.latitudeDegrees*Math.PI/180,lon=s.longitudeDegrees*Math.PI/180;const normal=[p.x/(6378137**2),p.y/(6378137**2),p.z/(6356752.314245179**2)],length=Math.hypot(...normal);const projected=[p.x,p.y,p.z].map((x,i)=>x+75000*normal[i]/length);if(projected.some((x,i)=>Math.abs(x-snapshot.modelPosition[i])>1))throw Error('Model historical PV/lift mismatch '+JSON.stringify({projected,model:snapshot.modelPosition}));}
  else if(snapshot.modelShown)throw Error('Unavailable historical model shown');
  row.cases.push({label,at:value+'Z',crew,orbit:expected.orbit.availability,pose:snapshot});await page.screenshot({path:path.join(out,`${port}-${width}-${label}.png`)});
 }
 await page.getByLabel('Replay UTC instant',{exact:true}).fill('2027-01-01T00:00');await page.getByRole('alert').filter({hasText:'Enter a valid'}).waitFor();row.futureRejected=true;
 await page.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T03:00');await page.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-03T11:00');await page.waitForFunction(()=>!document.body.textContent.includes('Loading historical state')&&document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-03T11:00:00'),null,{timeout:30000});row.rapidFinalEpoch=(await page.evaluate(pose)).epoch;
 const member=page.locator('[data-member-id]').first();await member.click();await page.locator('.crew-profile').waitFor();row.profile=await page.locator('.crew-profile').innerText();if(!row.profile.includes('Latest retained career totals')||!row.profile.includes('Assignment at replay time'))throw Error('Profile temporal labels missing');await page.screenshot({path:path.join(out,`${port}-${width}-profile.png`)});
 row.replayEnd=Date.now();row.replayRequests=row.requests.filter(r=>r.time>=row.replayStart&&r.time<=row.replayEnd);if(row.replayRequests.some(r=>r.url.includes('/api/iss/')&&!r.url.includes('/api/iss/replay')))throw Error('Current API called during Replay');
 await page.getByRole('button',{name:'Return to LIVE',exact:true}).click();await page.locator('.crew-summary').waitFor();row.restoredCrew=await page.locator('#crew-panel').innerText();await page.getByRole('button',{name:'Close crew panel'}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:30000});row.after=await page.evaluate(pose);if(!row.after.sameViewer||!row.after.animate)throw Error('LIVE not restored');
 for(const source of ['MISSION1 GP/TLE','NASA OEM']){const b=page.getByRole('button',{name:source,exact:true});if(await b.isDisabled())throw Error('LIVE source unavailable '+source);await b.click();await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();await page.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:25000});await page.screenshot({path:path.join(out,`${port}-${width}-${source==='NASA OEM'?'oem':'gp'}-live-inspection.png`)});await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:25000});row.sourceInspection.push({source,inspection:true,return:true});}
 if(row.errors.length)throw Error(JSON.stringify(row.errors));report.push(row);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({port,width,cases:row.cases.map(x=>x.label),sameViewer:row.after.sameViewer,errors:row.errors}));await context.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
