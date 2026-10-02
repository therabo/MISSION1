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
    const t=q.trails.trails.find(t=>t.source===q.source),now=H.JulianDate.toDate(v.clock.currentTime).getTime();
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
    const now=H.JulianDate.toDate(v.clock.currentTime).getTime(),t=q.trails.trails.find(t=>t.source===q.source),u=t.layers[1].material.uniforms;
    const at=ms=>t.position.getValue(H.JulianDate.fromDate(new Date(Math.max(t.startMs+1,Math.min(t.endMs-1,ms)))),new C());
    const start=t.startMs+u.forwardStart*(t.endMs-t.startMs),first=at(start),origin=project(at(Math.max(now+1,t.startMs))),nextTime=t.sampleTimes.find(ms=>ms>now+1),future=project(at(nextTime));
    const dx=future.x-origin.x,dy=future.y-origin.y,len=Math.hypot(dx,dy);
    return {timestamp:H.JulianDate.toIso8601(v.clock.currentTime),cameraPosition:vec(v.camera.positionWC),cameraDirection:vec(v.camera.directionWC),cameraToDisplayedIssRange:C.distance(v.camera.positionWC,q.model.boundingSphere.center),selectedSource:q.source,displayedIssPosition:vec(q.model.boundingSphere.center),trajectoryReveal:q.visibility,futureProjectedDirection:[dx,dy],futureProjectedDirectionLengthPx:len,futureProjectedDirectionAngle:Math.atan2(dy,dx),adaptiveGapSeconds:t.gapSeconds,originProtectionEndEpoch:new Date(start).toISOString(),firstTemporalExitEpoch:t.firstExitMs,originProtectionEndWorldPosition:vec(first),originProtectionEndScreenPosition:project(first),oneSecondAfterProtectionEndEpoch:new Date(start+1000).toISOString(),oneSecondAfterProtectionEndScreenPosition:project(at(start+1000)),hull:H.projectedModelFootprint(v.scene,q.model),bodyAlpha:u.maximumAlpha,haloAlpha:t.layers[0].material.uniforms.maximumAlpha,mask:t.layers[1].material.materials.clearanceMask.uniforms,projectedSamples:t.sampleTimes.map(ms=>({ms,pixel:project(at(ms))}))};
   };
  });
  const file=path.join(out,label+'-sweep.json'), existing=JSON.parse(fs.readFileSync(file));
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   for(const row of existing.poses.filter(r=>r.source===source)){
    await page.evaluate(p=>globalThis.__qa.pose(p),row.pose);
    const result=await page.evaluate(()=>{
     const q=globalThis.__qa,H=q.helpers,C=H.Cartesian3,v=q.viewer,t=q.trails.trails.find(t=>t.source===q.source),near=v.camera.frustum.near;
     const depth=p=>C.dot(C.subtract(p,v.camera.positionWC,new C()),v.camera.directionWC);
     const project=p=>{const relative=C.subtract(p,v.camera.positionWC,new C()),z=C.dot(relative,v.camera.directionWC),m=v.camera.frustum.projectionMatrix;return {x:v.scene.canvas.clientWidth*(0.5+0.5*m[0]*C.dot(relative,v.camera.rightWC)/z),y:v.scene.canvas.clientHeight*(0.5-0.5*m[5]*C.dot(relative,v.camera.upWC)/z)};};
     const segments=[];
     for(let i=0;i<t.positions.length-1;i++){
      let a=t.positions[i],b=t.positions[i+1],da=depth(a),db=depth(b);
      if(da<near&&db<near)continue;
      if(da<near)a=C.lerp(a,b,(near-da)/(db-da),new C());
      else if(db<near)b=C.lerp(b,a,(near-db)/(da-db),new C());
      const pa=project(a),pb=project(b);if(pa&&pb&&Number.isFinite(pa.x)&&Number.isFinite(pa.y)&&Number.isFinite(pb.x)&&Number.isFinite(pb.y))segments.push([pa,pb]);
     }
     return {cameraPosition:[v.camera.positionWC.x,v.camera.positionWC.y,v.camera.positionWC.z],near,segments};
    });
    if(result.cameraPosition.some((x,i)=>Math.abs(x-row.cameraPosition[i])>1e-6))throw Error('Clip reference camera differs from original raster '+row.name);
    row.projectedClippedSegments=result.segments;row.clipReferenceNearMetres=result.near;
   }
  }
  fs.writeFileSync(file,JSON.stringify(existing));console.log(label,'same-camera native clipped source segment references',existing.poses.length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
