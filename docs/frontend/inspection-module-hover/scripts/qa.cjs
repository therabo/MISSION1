// Browser evidence only. No hooks or fixtures are shipped in the application.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,viewer,observe}=require('../../occlusion-aware-workspace-centering/scripts/browser-utils.cjs');
const root=path.resolve(__dirname,'../../../..'),out=path.resolve(__dirname,'../evidence');
const mappings=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/cesium/issModelManifest.json'))).semanticMappings;
const nodes=JSON.parse(fs.readFileSync(path.join(root,'docs/frontend/inspection-orientation-review/asset-axes.json'))).nodes;
const port=Number(process.argv[2]||5175),label=process.argv[3]||'development';
function mode(){const el=document.querySelector('.earth-view');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(['EARTH_OVERVIEW','ENTERING_INSPECTION','ISS_INSPECTION','EXITING_INSPECTION'].includes(r))return r;}}
function install(){
 window.__held=false;const v=__v;window.__model=Array.from({length:v.scene.primitives.length},(_,i)=>v.scene.primitives.get(i)).find(p=>typeof p.id==='string'&&p.id.includes('iss'));
 window.__features=new Map();window.__picks=[];window.__frames=[];window.__scan=false;window.__phase='initial';window.__previous=null;window.__events=[];window.addEventListener('pointerdown',e=>{if(e.target===__v.canvas)__held=true},true);window.addEventListener('pointerup',()=>__held=false,true);for(const e of ['pointerdown','pointerup','pointermove','pointerleave','blur','wheel'])window.addEventListener(e,event=>__events.push({event:e,x:event.clientX,y:event.clientY,phase:__phase,time:performance.now()}),true);
 const native=v.scene.pick;v.scene.pick=function(...args){const start=performance.now(),h=native.apply(this,args);if(!__scan)__picks.push({phase:__phase,time:performance.now(),x:args[0].x,y:args[0].y,featureId:h?.featureId??null,ms:performance.now()-start});if(typeof h?.featureId==='number'&&h.getProperty?.('moduleCode'))__features.set(h.featureId,h);return h;};
 window.__hoverState=()=>({tinted:[...__features].filter(([,f])=>{const c=f.color;return Math.min(c.red,c.green,c.blue)<.99}).map(([id])=>id),cursor:__v.canvas.style.cursor,blend:__model.colorBlendMode,amount:__model.colorBlendAmount});
 v.scene.postRender.addEventListener(()=>{const c=v.camera,pose=[c.position.x,c.position.y,c.position.z,c.direction.x,c.direction.y,c.direction.z,c.up.x,c.up.y,c.up.z,c.frustum.fov,c.frustum.xOffset,c.frustum.yOffset],state=__hoverState(),changed=__previous&&pose.some((x,i)=>Math.abs(x-__previous[i])>(i<3?1e-7:1e-10));__frames.push({time:performance.now(),phase:__phase,pose,mode:window.__mode(),held:__held,changed:!!changed,...state});__previous=pose;});
}
const {scan}=require('./surface-scan.cjs');
function state(){return __hoverState();}
async function main(){const b=await chromium.launch({headless:true,args:['--use-angle=metal']}),report=fs.existsSync(path.join(out,`${label}-qa.json`))?JSON.parse(fs.readFileSync(path.join(out,`${label}-qa.json`))):[];try{
 for(const [width,height] of [[1440,900],[1280,720],[900,700],[390,844]].filter(([w])=>!process.env.MISSION1_QA_WIDTH||w===Number(process.env.MISSION1_QA_WIDTH))){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:1}),errors=[],consoleErrors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});await p.bringToFront();await p.goto(`http://127.0.0.1:${port}`);
 await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:120000});await p.evaluate(`window.__v=(${viewer})();`);
 async function cap(name){await p.screenshot({path:path.join(out,`${label}-${width}x${height}-${name}.png`)});if(name.startsWith('hover'))fs.writeFileSync(path.join(out,`${label}-${name}-diagnostic.json`),JSON.stringify(await p.evaluate(()=>({frames:__frames,picks:__picks,events:__events,state:__hoverState()})),null,2));}
 const overview=await p.evaluate(observe);await cap('overview');await p.evaluate(`window.__mode=(${mode});`);await p.evaluate(install);
 const phase=async name=>p.evaluate(name=>window.__phase=name,name);
 const hover=async hit=>{await p.mouse.move(hit.x,hit.y);await p.waitForFunction(id=>__hoverState().tinted.length===1&&__hoverState().tinted[0]===id,hit.featureId,{timeout:8000});assert.equal((await p.evaluate(state)).cursor,'pointer');};
 async function enter(){await phase('entry');await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});await p.waitForTimeout(1000);}
 async function leave(){await phase('exit');await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();assert.deepEqual((await p.evaluate(state)).tinted,[]);await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:30000});await p.waitForTimeout(800);const back=await p.evaluate(observe);assert(Math.hypot(...back.position.map((x,i)=>x-overview.position[i]))<.001);}
 await enter();const inspection=await p.evaluate(observe);assert.equal(inspection.canvas.width,width);assert.equal(inspection.canvas.left,0);assert(inspection.error<2);assert(Math.abs(inspection.range-90*Math.max(1,1.2/(width/height)))<.01);assert(Math.abs(inspection.elevation-42.5)<.001);assert(Math.abs(inspection.nativeFovDegrees-100)<.001);await cap('normal');
 await phase('idle');const before=await p.evaluate(()=>__picks.length);await p.waitForTimeout(1000);const idleData=await p.evaluate(()=>({frames:__frames,picks:__picks,events:__events}));fs.writeFileSync(path.join(out,`${label}-idle-diagnostic.json`),JSON.stringify(idleData,null,2));assert.equal(await p.evaluate(()=>__picks.length),before);
 let sequence=null,moduleResults=[];
 if(width===1440){
 let a,bhit;
 for(const m of mappings){const hit=await p.evaluate(scan,{mapping:m,node:nodes.find(n=>n.index===m.nodeIndex)});if(hit){if(!a)a=hit;else if(hit.featureId!==a.featureId){bhit=hit;break;}}}assert(a&&bhit,'two visible modules');
 await phase('hover-A');await hover(a);await cap('hover-A');await phase('hover-B');await hover(bhit);await cap('hover-B');assert.deepEqual((await p.evaluate(state)).tinted,[bhit.featureId]);
 await phase('background');await p.mouse.move(width-20,80);await p.waitForTimeout(100);assert.deepEqual((await p.evaluate(state)).tinted,[]);
 const non=await p.evaluate(scan,{unmapped:true});assert(non);await phase('non-module');await p.mouse.move(non.x,non.y);await p.waitForTimeout(100);assert.deepEqual((await p.evaluate(state)).tinted,[]);await cap('non-module');
 await phase('hover-A');await hover(a);await phase('drag-start');await p.mouse.down();assert.deepEqual((await p.evaluate(state)).tinted,[]);assert.notEqual((await p.evaluate(state)).cursor,'pointer');
 await phase('drag');const dragStart=await p.evaluate(()=>__picks.length);await p.mouse.move(a.x+50,a.y+20,{steps:15});assert.deepEqual((await p.evaluate(state)).tinted,[]);assert.equal(await p.evaluate(()=>__picks.length),dragStart);
 await phase('inertia');await p.mouse.up();assert.deepEqual((await p.evaluate(state)).tinted,[]);await p.waitForTimeout(2500);
 await phase('after-orbit');const afterOrbit=await p.evaluate(()=>({state:__hoverState(),picks:__picks.filter(p=>p.phase==='inertia')}));assert.equal(afterOrbit.picks.length,1,'one re-pick after orbit/inertia');
 // Return to the canonical pose in the browser harness, then re-hover A.
 await p.evaluate(()=>__v.camera.lookAtTransform(__v.camera.transform,new __v.camera.position.constructor(-66.354960313,0,60.803118686)));await p.waitForTimeout(600);await hover(a);
 await phase('wheel');const wheelStart=await p.evaluate(()=>__picks.length);await p.mouse.wheel(0,-100);assert.deepEqual((await p.evaluate(state)).tinted,[]);await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>__picks.length),wheelStart);
 await p.waitForTimeout(600);const wheelPicks=await p.evaluate(()=>__picks.filter(p=>p.phase==='wheel'));assert.equal(wheelPicks.length,1);assert(Math.abs(wheelPicks[0].x-a.x)<.001);assert(Math.abs(wheelPicks[0].y-a.y)<.001);
 await phase('stationary');const idleStart=await p.evaluate(()=>__picks.length);await p.waitForTimeout(2000);assert.equal(await p.evaluate(()=>__picks.length),idleStart);
 await phase('empty-move');let start=await p.evaluate(()=>__picks.length);await p.mouse.move(width-90,80,{steps:10});await p.mouse.move(width-20,80,{steps:10});const emptyMove=await p.evaluate(n=>({calls:__picks.length-n,rows:__picks.slice(n)}),start);assert(emptyMove.calls<=20);
 await phase('module-move');await p.evaluate(()=>__v.camera.lookAtTransform(__v.camera.transform,new __v.camera.position.constructor(-66.354960313,0,60.803118686)));await p.waitForTimeout(600);start=await p.evaluate(()=>__picks.length);for(let i=0;i<5;i++){await hover(a);await hover(bhit);}const moduleMove=await p.evaluate(n=>({calls:__picks.length-n,rows:__picks.slice(n)}),start);assert.equal(moduleMove.calls,10);
 sequence={a,b:bhit,non,afterOrbit,wheelPicks,idleCalls:0,emptyMove,moduleMove};
 // Existing mapped-node center infrastructure, public projection, native GPU picks.
 for(const source of ['MISSION1 GP/TLE','NASA OEM']){
 if(source==='NASA OEM'){await leave();await p.getByRole('button',{name:source,exact:true}).click();await enter();}
 const seen=new Set();
 for(const off of [[-119,0,0],[119,0,0],[0,-150,0],[0,150,0],[0,0,-119],[0,0,119],[-100,-100,70],[100,100,-70]]){
 await phase('programmatic');await p.evaluate(off=>__v.camera.lookAtTransform(__v.camera.transform,new __v.camera.position.constructor(...off)),off);await p.waitForTimeout(600);
 for(const m of mappings.filter(m=>!seen.has(m.featureId))){const hit=await p.evaluate(scan,{mapping:m,node:nodes.find(n=>n.index===m.nodeIndex)});if(!hit)continue;await phase('module-validation');await hover(hit);await p.mouse.click(hit.x,hit.y);await p.waitForFunction(name=>document.querySelector('.module-panel')?.textContent.includes(name),m.displayName);
 await p.getByRole('button',{name:'Close module information',exact:true}).click();await p.mouse.move(width-20,80);await p.waitForTimeout(100);assert.deepEqual((await p.evaluate(state)).tinted,[]);seen.add(m.featureId);moduleResults.push({source,name:m.displayName,componentId:m.componentId,featureId:m.featureId,moduleCode:m.moduleCode,pixel:hit,picked:true,hovered:true,restored:true,clicked:true});}
 if(seen.size===14)break;
 }assert.equal(seen.size,14,`${source}: all modules`);
 }
 }else if(width!==390){const hit=await p.evaluate(scan,{any:true});assert(hit);await phase('responsive-hover');await hover(hit);await cap('hover');await p.mouse.move(width-20,80);assert.deepEqual((await p.evaluate(state)).tinted,[]);}
 await leave();await cap('back');
 await p.locator('#crew-launcher').click();await p.locator('.crew-summary').waitFor();await p.locator('.crew-member').first().click();await p.locator('.crew-profile').waitFor();await cap('crew-detail');await p.getByRole('button',{name:'Close crew panel',exact:true}).click();
 await p.getByRole('button',{name:'Replay history',exact:true}).click();await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00')&&!document.body.textContent.includes('Loading historical state'));await cap('replay');await enter();await cap('replay-inspection');await leave();await p.getByRole('button',{name:'Return to LIVE',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);
 const lint=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,unnamed:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width&&!(b.textContent.trim()||b.getAttribute('aria-label'))).length}));assert(!lint.overflow);assert.equal(lint.unnamed,0);
 const frames=await p.evaluate(()=>__frames),picks=await p.evaluate(()=>__picks);fs.writeFileSync(path.join(out,`${label}-${width}-trace.json`),'{"frames":[\n'+frames.map(f=>JSON.stringify(f)).join(',\n')+'\n],"picks":[\n'+picks.map(f=>JSON.stringify(f)).join(',\n')+'\n]}\n');assert(!frames.some(f=>f.tinted.length>1));assert(!frames.some(f=>(f.mode!=='ISS_INSPECTION'||f.held)&&f.tinted.length));assert(!frames.some(f=>f.changed&&f.tinted.length));assert.deepEqual(errors,[]);
 const row={label,width,height,overview,inspection,sequence,moduleResults,lint,errors,consoleErrors,frameCount:frames.length,pickCount:picks.length,traceFile:`${label}-${width}-trace.json`};const previous=report.findIndex(r=>r.width===width);if(previous>=0)report[previous]=row;else report.push(row);fs.writeFileSync(path.join(out,`${label}-qa.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({label,width,height,modules:moduleResults.length,picks:picks.length,frames:frames.length,consoleErrors,pass:true}));await p.close();
 }
}finally{await b.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
