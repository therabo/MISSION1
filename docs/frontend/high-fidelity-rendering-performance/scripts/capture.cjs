const fs=require('fs');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const {viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const out=process.env.MISSION1_EVIDENCE||require('path').resolve(__dirname,'../evidence/after');fs.mkdirSync(out,{recursive:true});let active;
(async()=>{
 const b=active=await chromium.launch({headless:false,args:['--use-angle=metal']});const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});const p=await c.newPage();await p.bringToFront();const errors=[],network=[];p.on('pageerror',e=>errors.push(String(e)));p.on('requestfinished',async r=>{const s=await r.sizes().catch(()=>null);network.push({url:r.url(),type:r.resourceType(),sizes:s,timing:r.timing()});});
 const loads=[];let networkStart=0;
 for(const mode of ['cold','warm','repeat']){
  if(mode==='cold'){const session=await c.newCDPSession(p);await session.send('Network.clearBrowserCache');await session.detach();}
  await p.goto(process.env.MISSION1_URL||'http://127.0.0.1:4175');
  const milestones=await p.evaluate(async viewerText=>{
   const result={navigation:performance.getEntriesByType('navigation')[0].toJSON()},start=performance.now();let v;
   while(!(v=eval(`(${viewerText})()`)))await new Promise(r=>setTimeout(r,16));result.viewerReady=performance.now();
   const model=()=>Array.from({length:v.scene.primitives.length},(_,i)=>v.scene.primitives.get(i)).find(x=>x.id?.includes?.('iss'));
   let starDecodedAt=null;const stopStar=v.scene.postRender.addEventListener(()=>{if(starDecodedAt===null&&v.scene.skyBox?.sources?.positiveX?.src?.includes('tycho'))starDecodedAt=performance.now();});
   const render=()=>new Promise(r=>{const remove=v.scene.postRender.addEventListener(()=>{remove();r();})});
   await render();result.firstObservedEarthFrame=performance.now();
   while(!model()?.ready){await render();}result.modelResourcesReady=performance.now();
   while([...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled!==false)await render();result.inspectionReady=performance.now();
   while(!v.scene.globe.tilesLoaded&&performance.now()-start<30000)await render();result.tileQueueIdle=performance.now();
   while(starDecodedAt===null&&performance.now()-start<30000)await render();result.starDecodedAt=starDecodedAt;result.fullSceneReady=performance.now();stopStar();
   result.tileQueueSettled=v.scene.globe.tilesLoaded;result.starFieldReady=!!v.scene.skyBox?.sources?.positiveX?.src?.includes('tycho');result.starDecodeComplete=result.starFieldReady?performance.now():null;result.layers=Array.from({length:v.imageryLayers.length},(_,i)=>({url:v.imageryLayers.get(i).imageryProvider.url,show:v.imageryLayers.get(i).show}));result.resources=performance.getEntriesByType('resource').map(x=>x.toJSON());return result;
  },viewer.toString());loads.push({mode,...milestones,network:network.slice(networkStart)});networkStart=network.length;fs.writeFileSync(`${out}/loading.json`,JSON.stringify({loads,errors,network},null,2));console.log(JSON.stringify({mode,viewer:milestones.viewerReady,earth:milestones.firstObservedEarthFrame,model:milestones.modelResourcesReady,inspection:milestones.inspectionReady,idle:milestones.tileQueueIdle}));
 }
 if(process.env.MISSION1_LOADING_ONLY){await b.close();return;}
 await p.evaluate(`window.__v=(${viewer.toString()})();`);
 await p.getByRole('button',{name:'Replay history',exact:true}).click();
 const rows=[];
 async function time(t){await p.getByLabel('Replay UTC instant',{exact:true}).fill(t);await p.waitForFunction(t=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes(t+':00')&&!document.body.textContent.includes('Loading historical state'),t);await p.waitForTimeout(500);}
 async function earth(name,t,lon,lat,height=17000000,orientation){await time(t);await p.evaluate(({lon,lat,height,orientation})=>{const v=__v;v.camera.setView({destination:v.camera.position.constructor.fromDegrees(lon,lat,height),orientation:orientation||{heading:0,pitch:-Math.PI/2,roll:0}});},{lon,lat,height,orientation});await p.waitForTimeout(5000);await cap(name);}
 async function cap(name){const state=await p.evaluate(observe);rows.push({name,...state});await p.screenshot({path:`${out}/${name}.png`});fs.writeFileSync(`${out}/fixtures.json`,JSON.stringify({rows,errors,network},null,2));console.log(name);}
 await earth('earth-day','2026-10-02T12:00',12,35);
 await earth('earth-terminator','2026-10-02T18:00',12,35);
 for(const [name,t,lon,lat] of [['europe','2026-10-02T23:00',12,45],['north-america','2026-10-02T06:00',-90,40],['india-middle-east','2026-10-02T19:00',65,26],['east-asia','2026-10-02T16:00',120,35]])await earth(`earth-night-${name}`,t,lon,lat,1300000);
 await earth('stars-limb','2026-10-02T23:00',12,35,17000000,{heading:Math.PI/2,pitch:-.8,roll:0});
 await earth('earth-night','2026-10-02T23:00',12,35);
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(1000);await cap('iss-canonical');
 await p.mouse.move(950,450);for(let i=0;i<8;i++)await p.mouse.wheel(0,-100);await p.waitForTimeout(800);await cap('iss-close');
 await p.evaluate(()=>{const v=__v;v.camera.lookAtTransform(v.camera.transform,new v.camera.position.constructor(0,-100,70));});await p.waitForTimeout(500);await cap('iss-oblique');
 await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(800);await cap('mobile-overview');await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(800);await cap('mobile-inspection');
 await b.close();
})().catch(async e=>{console.error(e);await active?.close();process.exitCode=1});
