// Diagnostic harness for disposable instrumented builds only.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MISSION1_REPO_ROOT || path.resolve(__dirname, '../../../../..');
const out = process.env.MISSION1_EVIDENCE_DIR || '/tmp/mission1-trajectory-artifact-evidence';
fs.mkdirSync(out,{recursive:true});
const port = +process.argv[2], label = process.argv[3];
(async () => {
 const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
  await context.addInitScript(()=>{const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,ms>=119000?1000000000:ms,...args);});
  for(const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
   await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(root+'/docs/frontend/inspection-orientation-review/'+file))}));
  await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
  const page = await context.newPage(), report={label,poses:[],errors:[]};
  page.on('pageerror',e=>{report.errors.push(String(e));console.log('PAGE',e.message,e.stack)}); page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
  await page.goto('http://127.0.0.1:'+port);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false,null,{timeout:60000});
  await page.evaluate(()=>{
   const q=globalThis.__qa,H=q.helpers,v=q.viewer,C=H.Cartesian3;
   v.useDefaultRenderLoop=false;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');q.tick();v.render();
   const project=p=>{const s=H.SceneTransforms.worldToWindowCoordinates(v.scene,p,new H.Cartesian2());return s?{x:s.x,y:s.y}:null;};
   const vec=p=>[p.x,p.y,p.z];
   q.pose=({angle,range,side=1,seconds=0,phi=45})=>{
    const t=q.trails.trails.find(t=>t.source===(q.isolatedSource||q.source)),now=H.JulianDate.toDate(v.clock.currentTime).getTime();
    const at=ms=>t.position.getValue(H.JulianDate.fromDate(new Date(Math.max(t.startMs+1,Math.min(t.endMs-1,ms)))),new C());
    const target=seconds===0?C.clone(q.model.boundingSphere.center):at(now+seconds*1000);
    const p=at(now+seconds*1000),next=at(now+seconds*1000+1000),f=C.normalize(C.subtract(next,p,new C()),new C());
    const radial=H.Ellipsoid.WGS84.geodeticSurfaceNormal(p,new C());
    const u=C.normalize(C.subtract(radial,C.multiplyByScalar(f,C.dot(radial,f),new C()),new C()),new C());
    const lateral=C.cross(f,u,new C()); const transverse=C.add(C.multiplyByScalar(u,Math.cos(phi*Math.PI/180),new C()),C.multiplyByScalar(lateral,Math.sin(phi*Math.PI/180),new C()),new C());
    const offset=C.add(C.multiplyByScalar(f,-Math.cos(angle*Math.PI/180)*range,new C()),C.multiplyByScalar(transverse,side*Math.sin(angle*Math.PI/180)*range,new C()),new C());
    const position=C.add(target,offset,new C()),direction=C.normalize(C.negate(offset,new C()),new C());
    const right=C.normalize(C.cross(direction,Math.abs(C.dot(direction,u))>.99?f:u,new C()),new C()),up=C.normalize(C.cross(right,direction,new C()),new C());
    v.camera.lookAtTransform(H.Matrix4.IDENTITY);C.clone(position,v.camera.position);C.clone(direction,v.camera.direction);C.clone(up,v.camera.up);C.clone(right,v.camera.right);v.camera.frustum.fov=Math.PI/3;
    v.render();
   };
   q.snapshot=()=>{
    const now=H.JulianDate.toDate(v.clock.currentTime).getTime(),t=q.trails.trails.find(t=>t.source===(q.isolatedSource||q.source)),u=t.layers[1].material.uniforms;
    const at=ms=>t.position.getValue(H.JulianDate.fromDate(new Date(Math.max(t.startMs+1,Math.min(t.endMs-1,ms)))),new C());
    const start=t.startMs+u.forwardStart*(t.endMs-t.startMs),first=at(start),origin=project(at(Math.max(now+1,t.startMs))),nextTime=t.sampleTimes.find(ms=>ms>now+1),future=project(at(nextTime));
    const dx=future.x-origin.x,dy=future.y-origin.y,len=Math.hypot(dx,dy);
    return {timestamp:H.JulianDate.toIso8601(v.clock.currentTime),cameraPosition:vec(v.camera.positionWC),cameraDirection:vec(v.camera.directionWC),cameraToDisplayedIssRange:C.distance(v.camera.positionWC,q.model.boundingSphere.center),selectedSource:q.source,displayedIssPosition:vec(q.model.boundingSphere.center),trajectoryReveal:q.visibility,futureProjectedDirection:[dx,dy],futureProjectedDirectionLengthPx:len,futureProjectedDirectionAngle:Math.atan2(dy,dx),adaptiveGapSeconds:t.gapSeconds,originProtectionEndEpoch:new Date(start).toISOString(),firstTemporalExitEpoch:t.firstExitMs,originProtectionEndWorldPosition:vec(first),originProtectionEndScreenPosition:project(first),oneSecondAfterProtectionEndEpoch:new Date(start+1000).toISOString(),oneSecondAfterProtectionEndScreenPosition:project(at(start+1000)),hull:H.projectedModelFootprint(v.scene,q.model),bodyAlpha:u.maximumAlpha,haloAlpha:t.layers[0].material.uniforms.maximumAlpha,mask:t.layers[1].material.materials.clearanceMask.uniforms,projectedSamples:t.sampleTimes.map(ms=>({ms,pixel:project(at(ms))}))};
   };
  });
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'MISSION1 GP/TLE':'NASA OEM',exact:true}).evaluate(b=>b.click());
   await page.evaluate(source=>{globalThis.__qa.isolatedSource=source;globalThis.__qa.tick();globalThis.__qa.viewer.render();},source);
   const poses=[...([30,45,179.9].map(a=>['inactive-'+a,{angle:a,range:6000000,phi:0}]))];
   for(const [name,pose] of poses){
    await page.evaluate(p=>globalThis.__qa.pose(p),pose);
    await page.waitForTimeout(150);await page.evaluate(()=>globalThis.__qa.viewer.render());
    const snapshot=await page.evaluate(()=>globalThis.__qa.snapshot());report.poses.push({source,name,pose,inactive:true,analysisThreshold:1,...snapshot});
    await page.evaluate(()=>{const q=globalThis.__qa;q.isolationLayer='both';q.hideModel=false;q.hideAll=false;
     q.isolation=q.viewer.scene.preRender.addEventListener(()=>{
      q.model.show=!q.hideModel;
      for(const t of q.trails.trails)for(let i=0;i<t.layers.length;i++)t.layers[i].primitive.show=!q.hideAll&&t.source===q.isolatedSource&&(q.isolationLayer==='both'||q.isolationLayer===i);
     });q.viewer.render();});
    await page.evaluate(()=>{const q=globalThis.__qa;q.hideAll=true;q.viewer.render();});
    await page.screenshot({path:path.join(out,`${label}-${source}-${name}-off-before.png`),clip:{x:420,y:200,width:440,height:470}});
    await page.evaluate(()=>{const q=globalThis.__qa;q.hideAll=false;q.viewer.render();});
    for(const layer of ['both',1,0]){
     await page.evaluate(layer=>{const q=globalThis.__qa;q.isolationLayer=layer;q.viewer.render();},layer);
     await page.screenshot({path:path.join(out,`${label}-${source}-${name}-${layer==='both'?'both':layer===1?'body':'halo'}.png`),clip:{x:420,y:200,width:440,height:470}});
     if(layer==='both')await page.screenshot({path:path.join(out,`${label}-${source}-${name}-full.jpg`),type:'jpeg',quality:88});
    }
    await page.evaluate(()=>{const q=globalThis.__qa;q.hideAll=true;q.viewer.render();});
    await page.screenshot({path:path.join(out,`${label}-${source}-${name}-off.png`),clip:{x:420,y:200,width:440,height:470}});
    await page.evaluate(()=>{const q=globalThis.__qa;q.hideAll=false;q.hideModel=true;q.isolationLayer='both';q.viewer.render();});
    await page.screenshot({path:path.join(out,`${label}-${source}-${name}-model-off.png`),clip:{x:420,y:200,width:440,height:470}});
    await page.evaluate(()=>{const q=globalThis.__qa;q.isolation();q.model.show=true;for(const t of q.trails.trails)for(const l of t.layers)l.primitive.show=true;q.viewer.render();});
   }
  }
  fs.writeFileSync(path.join(out,label+'-sweep.json'),JSON.stringify(report));
  console.log(label,'poses',report.poses.length,'errors',report.errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
