// Diagnostic harness for disposable instrumented builds only.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MISSION1_REPO_ROOT || path.resolve(__dirname, '../../../../..');
const out = process.env.MISSION1_EVIDENCE_DIR || path.resolve(__dirname,'../runs');
fs.mkdirSync(out,{recursive:true});
const port = +process.argv[2], label = process.argv[3];
(async () => {
 const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
 try {
  const context = await browser.newContext({viewport:{width:1920,height:992},deviceScaleFactor:2});
  await context.addInitScript(()=>{const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,ms>=119000?1000000000:ms,...args);});
  for(const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
   await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(path.join(process.env.MISSION1_FIXTURE_DIR||path.resolve(__dirname,'../fixtures'),file)))}));
  await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
  const page = await context.newPage(), report={label,poses:[],errors:[]};
  page.on('pageerror',e=>{report.errors.push(String(e));console.log('PAGE',e.message,e.stack)}); page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
  await page.goto('http://127.0.0.1:'+port);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false,null,{timeout:60000});
  await page.evaluate(()=>{
   const q=globalThis.__qa,H=q.helpers,v=q.viewer,C=H.Cartesian3;
   v.useDefaultRenderLoop=false;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-10-02T22:27:11Z');q.tick();v.render();
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


  await page.evaluate(()=>{
   const q=globalThis.__qa,H=q.helpers,v=q.viewer,C=H.Cartesian3;
   q.earthPose=({lat,lon,roll=0,radius=23500000})=>{
    const position=C.fromDegrees(lon,lat,radius-6378137),direction=C.normalize(C.negate(position,new C()),new C());
    let right=C.normalize(C.cross(direction,C.UNIT_Z,new C()),new C()),up=C.normalize(C.cross(right,direction,new C()),new C());
    const a=roll*Math.PI/180;right=C.add(C.multiplyByScalar(right,Math.cos(a),new C()),C.multiplyByScalar(up,Math.sin(a),new C()),new C());up=C.normalize(C.cross(right,direction,new C()),new C());
    v.camera.lookAtTransform(H.Matrix4.IDENTITY);C.clone(position,v.camera.position);C.clone(direction,v.camera.direction);C.clone(up,v.camera.up);C.clone(right,v.camera.right);v.camera.frustum.fov=Math.PI/3;v.render();
   };
   q.simpleSnapshot=()=>{const t=q.trails.trails.find(t=>t.source===q.source),c=v.camera,vec=p=>[p.x,p.y,p.z];return {source:q.source,time:H.JulianDate.toIso8601(v.clock.currentTime),cameraWorldPosition:vec(c.positionWC),cameraDirection:vec(c.directionWC),cameraUp:vec(c.upWC),cameraRange:C.distance(c.positionWC,q.model.boundingSphere.center),trajectoryReveal:q.visibility,bodyAlpha:t.layers[1].material.uniforms.maximumAlpha,haloAlpha:t.layers[0].material.uniforms.maximumAlpha,mask:t.layers[1].material.materials.clearanceMask.uniforms,earthOccludes:H.earthOccludes(c.positionWC,q.model.boundingSphere.center),renderStates:t.layers.map(l=>l.primitive.appearance.getRenderState()),oit:v.scene.orderIndependentTranslucency};};
  });

  for(let frame=0;frame<80;frame++){await page.evaluate(()=>globalThis.__qa.viewer.render());await page.waitForTimeout(40);if(await page.evaluate(()=>!!globalThis.__qa.trails?.trails?.length))break;}

  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   const boundary=await page.evaluate(()=>{
    const q=globalThis.__qa,H=q.helpers,C=H.Cartesian3,v=q.viewer;
    let lo=-112,hi=-14;
    for(let i=0;i<35;i++){const lon=(lo+hi)/2;q.earthPose({lat:-39,lon,radius:23200000});if(H.earthOccludes(v.camera.positionWC,q.model.boundingSphere.center))hi=lon;else lo=lon;}
    return (lo+hi)/2;
   });
   for(const offset of [-3,-1,-.25,0,.25,1,3]){
    const row=await page.evaluate(lon=>{const q=globalThis.__qa,H=q.helpers,C=H.Cartesian3,v=q.viewer;q.earthPose({lat:-39,lon,radius:23200000});for(let i=0;i<3;i++)v.render();const snap=q.simpleSnapshot(),m=snap.mask,cam=v.camera;const counts={masked:0,earthBehind:0};
     // QA ray/ellipsoid comparison across the curved protected disk.
     const invR=[1/6378137,1/6378137,1/6356752.314245];
     for(let y=m.center.y-m.radius;y<=m.center.y+m.radius;y+=2)for(let x=m.center.x-m.radius;x<=m.center.x+m.radius;x+=2){if(Math.hypot(x-m.center.x,y-m.center.y)>m.radius)continue;const ray=cam.getPickRay(new H.Cartesian2(x,y));const depthScale=C.dot(ray.direction,cam.directionWC);const scaled=new C(ray.direction.x*invR[0],ray.direction.y*invR[1],ray.direction.z*invR[2]);const origin=new C(ray.origin.x*invR[0],ray.origin.y*invR[1],ray.origin.z*invR[2]);const a=C.dot(scaled,scaled),b=C.dot(origin,scaled),c=C.dot(origin,origin)-1,disc=b*b-a*c;const earth=b<0&&disc>=0?(-b-Math.sqrt(disc))/a*depthScale:Infinity;if(earth<m.stationNearDepth-1)counts.earthBehind++;else counts.masked++;}
     return {snapshot:snap,counts};},boundary+offset);
    report.poses.push({source,boundary,offset,...row});
    await page.screenshot({path:path.join(out,`${label}-${source}-${offset}.jpg`),type:'jpeg',quality:92});
    const m=row.snapshot.mask;await page.screenshot({clip:{x:Math.max(0,Math.min(1760,m.center.x-80)),y:Math.max(0,Math.min(832,m.center.y-80)),width:160,height:160},path:path.join(out,`${label}-${source}-${offset}-native.png`)});
   }
  }
  fs.writeFileSync(path.join(out,label+'-sweep.json'),JSON.stringify(report));console.log(label,report.poses.length,report.errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
