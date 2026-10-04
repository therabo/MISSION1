const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const {viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const root=process.env.MISSION1_EVIDENCE||path.resolve(__dirname,'../evidence');let active;
for(const build of ['before','after'])fs.mkdirSync(path.join(root,build),{recursive:true});
(async()=>{const browser=active=await chromium.launch({headless:false,args:['--use-angle=metal']});const rows=[];
 for(const [build,port] of [['before',4185],['after',4175]]){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const p=await context.newPage();await p.bringToFront();const failures=[],errors=[],requests=[];p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(String(e)));let failedTile=null,failuresLeft=1;
 // The outage is restricted to one real non-probe night tile. Other requests
 // reach NASA unchanged. It tests layer persistence, not fabricated imagery.
 if(!process.env.MISSION1_NORMAL)await context.route('https://gibs.earthdata.nasa.gov/**',r=>{const u=r.request().url();if(u.includes('VIIRS_Black_Marble')&&!u.endsWith('/2/1/2.png')&&failuresLeft){failuresLeft--;failedTile=u;failures.push(u);return r.fulfill({status:503,body:'Controlled QA tile outage'});}return r.continue();});
 await p.goto(`http://127.0.0.1:${port}`);await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});await p.evaluate(`window.__v=(${viewer.toString()})();`);
 await p.getByRole('button',{name:'Replay history',exact:true}).click();await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00')&&!document.body.textContent.includes('Loading historical state'));
 for(const [name,lon,lat,height,pitch] of [['night-one-tile-outage',12,45,1300000,-Math.PI/2],['stars-with-earth-limb',12,35,17000000,-1.12],['day-max-level',12,45,100000,-Math.PI/2],['night-max-level',12,45,100000,-Math.PI/2]]){
  if(process.env.MISSION1_NORMAL&&name==='night-one-tile-outage')continue;
  if(name==='day-max-level'){await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T12:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T12:00:00')&&!document.body.textContent.includes('Loading historical state'));}
  if(name==='night-max-level'){await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00')&&!document.body.textContent.includes('Loading historical state'));}
  await p.evaluate(({lon,lat,height,pitch})=>__v.camera.setView({destination:__v.camera.position.constructor.fromDegrees(lon,lat,height),orientation:{heading:0,pitch,roll:0}}),{lon,lat,height,pitch});await p.waitForTimeout(6000);
  const row={build,name,...await p.evaluate(observe),layers:await p.evaluate(()=>Array.from({length:__v.imageryLayers.length},(_,i)=>({url:__v.imageryLayers.get(i).imageryProvider.url}))),failedTile,controlledFailures:failures.slice(),requests:requests.slice(),pageErrors:errors.slice()};rows.push(row);await p.screenshot({path:path.join(root,build,`${name}.png`)});fs.writeFileSync(path.join(root,'fixed-comparison.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify({build,name,layers:row.layers,controlledFailures:failures.length}));
 }
 assert.equal(errors.length,0);await context.close();
 }
 await browser.close();})().catch(async e=>{console.error(e);await active?.close();process.exitCode=1});
