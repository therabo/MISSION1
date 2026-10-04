const fs=require('fs'),assert=require('assert/strict');
const path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const repo=process.env.MISSION1_REPO_ROOT||path.resolve(__dirname,'../../../..');
const evidence=process.env.MISSION1_EVIDENCE_DIR||path.join(repo,'docs/frontend/dynamic-workspace-centering/evidence');
const port=Number(process.argv[2]||5175),label=process.argv[3]||'development';
const out=evidence;
function observe(){
 const el=document.querySelector('.earth-view');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],v;
 for(;f&&!v;f=f.return)for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.scene?.camera&&r?.clock)v=r;}
 if(!v)return null;
 const c=v.camera,fr=c.frustum,r=v.canvas.getBoundingClientRect(),full=document.querySelector('.app-shell').getBoundingClientRect();
 const vector=p=>[p.x,p.y,p.z];
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 function project(point){const rel={x:point.x-c.positionWC.x,y:point.y-c.positionWC.y,z:point.z-c.positionWC.z};const z=dot(rel,c.directionWC);return z>0?{x:r.left+r.width/2+dot(rel,c.rightWC)/z*r.width/(2*Math.tan(fr.fovy/2)*fr.aspectRatio),y:r.top+r.height/2-dot(rel,c.upWC)/z*r.height/(2*Math.tan(fr.fovy/2))}:null;}
 const panels=[...document.querySelectorAll('.status-panel,.replay-orbit')].map(e=>{const p=e.getBoundingClientRect(),s=getComputedStyle(e);return {class:e.className,left:p.left,right:p.right,width:p.width,height:p.height,side:s.getPropertyValue('--earth-workspace-side').trim()==='1'&&s.visibility!=='hidden'&&s.display!=='none'};});
 const left=Math.max(0,...panels.filter(p=>p.side&&p.width&&p.height).map(p=>p.right));
 const model=[...Array(v.scene.primitives.length)].map((_,i)=>v.scene.primitives.get(i)).find(p=>p.id==='iss-vtad-model'||p.id?.includes?.('iss'));
 const modelCenter=model?.boundingSphere?.center;
 const physicalFrame=model?.modelMatrix;
 const modelPosition=modelCenter&&project(modelCenter);
 const nativeFov=fr.fov,canonicalFov=2*Math.atan(Math.tan(nativeFov/2)*Math.max(full.width,full.height)/Math.max(r.width,r.height));
 const cameraLocal=vector(c.position);
 const geometry={range:Math.hypot(...cameraLocal),elevation:Math.atan2(cameraLocal[2],Math.hypot(cameraLocal[0],cameraLocal[1]))*180/Math.PI,lateral:cameraLocal[1]};
 return {panels,layout:left?'LEFT_DASHBOARD':'FULL_WIDTH / BOTTOM_PANEL',viewportLeft:full.left,viewportRight:full.right,dashboardRight:left,expectedCenter:left+(full.right-left)/2,observedEarth:project({x:0,y:0,z:0}),observedModel:modelPosition,canvas:{left:r.left,width:r.width,height:r.height},position:vector(c.positionWC),direction:vector(c.directionWC),up:vector(c.upWC),nativeFovDegrees:nativeFov*180/Math.PI,canonicalFovDegrees:canonicalFov*180/Math.PI,pixelLens:r.height/(2*Math.tan(fr.fovy/2)),inspection:geometry,animate:v.clock.shouldAnimate,epoch:v.clock.currentTime.constructor.toIso8601(v.clock.currentTime),modelReady:!!model?.ready};
}
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=metal']});const report=[];try{for(const [width,height] of [[1440,900],[1280,720],[1024,768],[900,700],[768,1024],[390,844]]){
 const p=await b.newPage({viewport:{width,height}}),errors=[],consoleErrors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 await p.goto(`http://127.0.0.1:${port}`);await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:90000});await p.waitForTimeout(500);
 async function capture(state,earth=true){await p.waitForTimeout(800);const r=await p.evaluate(observe);assert(r);assert(Math.abs(r.canvas.left-r.dashboardRight)<1,JSON.stringify(r));if(earth){assert(r.observedEarth);assert(Math.abs(r.observedEarth.x-r.expectedCenter)<2,JSON.stringify(r));} report.push({build:label,width,height,state,...r,pageErrors:[...errors],consoleErrors:[...consoleErrors]});await p.screenshot({path:`${out}/after-${label}-${width}x${height}-${state}.png`});fs.writeFileSync(`${out}/${label}-browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({build:label,width,height,state,left:r.dashboardRight,expected:r.expectedCenter,observed:r.observedEarth?.x,model:r.observedModel,inspection:r.inspection,fov:r.canonicalFovDegrees,errors}));return r;}
 const overview=await capture('overview');
 if(width===1440){await p.locator('.status-panel').evaluate(e=>e.style.width='436px');const changed=await capture('altered-dashboard-width');assert.equal(changed.dashboardRight,460);assert(Math.abs(changed.pixelLens-overview.pixelLens)<1e-6);assert.deepEqual(changed.position,overview.position);await p.locator('.status-panel').evaluate(e=>e.style.removeProperty('width'));await capture('restored-width');}
 if([1440,768,390].includes(width)){
 await p.locator('#crew-launcher').click();await p.locator('.crew-summary').waitFor();const crew=await capture('crew');if(width===1440)assert.equal(crew.dashboardRight,overview.dashboardRight);if(width<=768)assert.equal(crew.dashboardRight,0);
 await p.locator('.crew-member').first().click();await p.locator('.crew-profile').waitFor();const detail=await capture('crew-detail');assert.equal(detail.dashboardRight,crew.dashboardRight);await p.getByRole('button',{name:'Close crew panel',exact:true}).click();await capture('crew-closed');
 await p.getByRole('button',{name:'Replay history',exact:true}).click();await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T23:00');await p.waitForFunction(()=>document.querySelector('.replay-orbit .eyebrow')?.textContent.includes('2026-10-02T23:00:00')&&!document.body.textContent.includes('Loading historical state'));const replay=await capture('replay');assert.equal(replay.animate,false);await p.getByLabel('Replay UTC instant',{exact:true}).fill('2026-10-02T22:00');await p.waitForTimeout(600);const seek=await capture('replay-seek');assert.equal(seek.dashboardRight,replay.dashboardRight);await p.getByRole('button',{name:'Return to LIVE',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false);await capture('return-live');
 await p.getByRole('button',{name:'Inspect ISS',exact:true}).click();await p.getByText('Drag to orbit the ISS · Scroll to zoom',{exact:true}).waitFor({timeout:30000});const inspection=await capture('inspection',false);const expectedRange=90*Math.max(1,1.2/(width/height));assert(Math.abs(inspection.inspection.range-expectedRange)<0.01);assert(Math.abs(inspection.inspection.elevation-42.5)<0.001);assert(Math.abs(inspection.inspection.lateral)<0.001);assert(Math.abs(inspection.canonicalFovDegrees-100)<0.001);
 await p.getByRole('button',{name:'Back to Earth View',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Inspect ISS')?.disabled===false,null,{timeout:30000});const returned=await capture('back');assert(Math.hypot(...returned.position.map((x,i)=>x-overview.position[i]))<0.001);
 }
 if(width===900){for(const [w,h] of [[390,844],[1024,768],[768,1024],[900,700]]){await p.setViewportSize({width:w,height:h});await capture(`resize-${w}x${h}`);}}
 assert.deepEqual(errors,[]);assert(!consoleErrors.some(e=>/ResizeObserver|loop limit/i.test(e)));await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
