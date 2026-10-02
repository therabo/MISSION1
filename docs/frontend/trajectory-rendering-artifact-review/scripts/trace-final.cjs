// Diagnostic harness for disposable instrumented builds only.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MISSION1_REPO_ROOT || path.resolve(__dirname, '../../../..');
const out = process.env.MISSION1_EVIDENCE_DIR || '/tmp/mission1-trajectory-artifact-evidence';
fs.mkdirSync(out,{recursive:true});
const port = +process.argv[2], label = process.argv[3];
(async () => {
 const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
  for(const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
   await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(root+'/docs/frontend/inspection-orientation-review/'+file))}));
  await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
  const page = await context.newPage(), report={label,onsetDefinition:'temporalStart is the shader boundary; analyticalPerceptibleOnset is centerline alpha >= 0.005, not a raster-pixel measurement',poses:[],errors:[]};
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
    return {timestamp:H.JulianDate.toIso8601(v.clock.currentTime),cameraPosition:vec(v.camera.positionWC),cameraDirection:vec(v.camera.directionWC),cameraToDisplayedIssRange:C.distance(v.camera.positionWC,q.model.boundingSphere.center),selectedSource:q.source,displayedIssPosition:vec(q.model.boundingSphere.center),trajectoryReveal:q.visibility,futureProjectedDirection:[dx,dy],futureProjectedDirectionLengthPx:len,futureProjectedDirectionAngle:Math.atan2(dy,dx),adaptiveGapSeconds:t.gapSeconds,firstVisibleEpoch:new Date(start).toISOString(),firstVisibleWorldPosition:vec(first),firstVisibleScreenPosition:project(first),secondVisibleEpoch:new Date(start+1000).toISOString(),secondVisibleScreenPosition:project(at(start+1000)),hull:H.projectedModelFootprint(v.scene,q.model),bodyAlpha:u.maximumAlpha,haloAlpha:t.layers[0].material.uniforms.maximumAlpha,mask:t.layers[1].material.materials.clearanceMask.uniforms,projectedSamples:t.sampleTimes.map(ms=>({ms,pixel:project(at(ms))}))};
   };
  });
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   for(const pathName of ['along','off-axis','reverse','crossing']){
    const frames=await page.evaluate(async pathName=>{
     const q=globalThis.__qa,H=q.helpers,C=H.Cartesian3,frames=[];
     const initial={range:pathName==='reverse'?8000000:500000,angle:pathName==='crossing'?30:pathName==='off-axis'?175:180,phi:pathName==='off-axis'?5:0};
     for(const t of q.trails.trails)t.gapSeconds=null;
     q.pose(initial);await new Promise(resolve=>setTimeout(resolve,150));q.tick();q.viewer.render();
     for(let i=0;i<250;i++){
      await new Promise(requestAnimationFrame);
      const phase=i/249, range=pathName==='reverse'?8000000-7500000*phase:500000+7500000*phase;
      const pose={range,angle:pathName==='crossing'?30-60*phase:pathName==='off-axis'?175:180,phi:pathName==='off-axis'?5:0};
      q.pose(pose);const r=q.snapshot();r.frameIndex=i;r.wallTimestamp=performance.now();r.trajectoryCpu=q.trajectoryCpu;r.rampSeconds=q.trails.trails.find(t=>t.source===q.source).rampSeconds;
      const t=q.trails.trails.find(t=>t.source===q.source),at=ms=>t.position.getValue(H.JulianDate.fromDate(new Date(Math.max(t.startMs+1,Math.min(t.endMs-1,ms)))),new C()),now=H.JulianDate.toDate(q.viewer.clock.currentTime).getTime(),start=now+(t.gapSeconds||0)*1000;
      r.firstVisibleSampleIndex=t.sampleTimes.findIndex(ms=>ms>=start);r.adaptiveGapPathMetres=0;let prev=at(now);
      for(const ms of [...t.sampleTimes.filter(ms=>ms>now&&ms<start),start]){const p=at(ms);r.adaptiveGapPathMetres+=C.distance(prev,p);prev=p}
      const hull=r.hull,p=r.firstVisibleScreenPosition;let d=Infinity,inside=true;
      for(let j=0;j<hull.length;j++){const a=hull[j],b=hull[(j+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;if(dx*(p.y-a.y)-dy*(p.x-a.x)<0)inside=false;const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy))}
      r.screenClearance=inside?0:d;r.downstreamSign=Math.sign((p.x-640)*r.futureProjectedDirection[0]+(p.y-360)*r.futureProjectedDirection[1]);
      r.candidateGapChanged=i>0&&r.adaptiveGapSeconds!==frames[i-1].adaptiveGapSeconds;r.firstVisibleSampleIndexChanged=i>0&&r.firstVisibleSampleIndex!==frames[i-1].firstVisibleSampleIndex;r.downstreamSignChanged=i>0&&r.downstreamSign!==frames[i-1].downstreamSign;r.projectedTangentNearZero=r.futureProjectedDirectionLengthPx<.5;
      const distance=p=>{if(!p||!hull)return 0;let inside=true,dist=Infinity;for(let j=0;j<hull.length;j++){const a=hull[j],b=hull[(j+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;if(dx*(p.y-a.y)-dy*(p.x-a.x)<0)inside=false;const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));dist=Math.min(dist,Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy))}return inside?0:dist};
      const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
      const uniforms=t.layers[1].material.uniforms,mask=t.layers[1].material.materials.clearanceMask.uniforms;
      const begin=t.startMs+uniforms.forwardStart*(t.endMs-t.startMs),end=t.startMs+uniforms.forwardEnd*(t.endMs-t.startMs);
      const project=p=>{const a=H.SceneTransforms.worldToWindowCoordinates(q.viewer.scene,p,new H.Cartesian2());return a?{x:a.x,y:a.y}:null};
      const alpha=ms=>uniforms.maximumAlpha*smooth((ms-begin)/Math.max(.001,t.rampSeconds*1000))*(1-smooth((ms-begin)/(end-begin)))*smooth((distance(project(at(ms)))-mask.clearance)/.75);
      r.temporalStartEpoch=r.firstVisibleEpoch;r.temporalStartWorldPosition=r.firstVisibleWorldPosition;r.temporalStartScreenPosition=r.firstVisibleScreenPosition;
      r.analyticalPerceptibleOnset=null;
      if(uniforms.maximumAlpha>=.005){let low=begin;for(const hi of [...t.sampleTimes.filter(ms=>ms>begin&&ms<end),end-1]){if(alpha(hi)>=.005){let high=hi;for(let k=0;k<25&&high-low>1;k++){const mid=(low+high)/2;if(alpha(mid)>=.005)high=mid;else low=mid}r.analyticalPerceptibleOnset={epoch:new Date(high).toISOString(),timeMs:high,world:[at(high).x,at(high).y,at(high).z],screen:project(at(high)),alpha:alpha(high),screenClearance:distance(project(at(high)))};break}low=hi}}
      r.firstVisibleEpoch=r.analyticalPerceptibleOnset?.epoch??null;r.firstVisibleWorldPosition=r.analyticalPerceptibleOnset?.world??null;r.firstVisibleScreenPosition=r.analyticalPerceptibleOnset?.screen??null;
      if(r.analyticalPerceptibleOnset){const ms=r.analyticalPerceptibleOnset.timeMs;r.secondVisibleEpoch=new Date(ms+1000).toISOString();r.secondVisibleScreenPosition=project(at(ms+1000));r.screenClearance=r.analyticalPerceptibleOnset.screenClearance;}
      if(i>0&&r.analyticalPerceptibleOnset&&frames[i-1].analyticalPerceptibleOnset){const old=frames[i-1].analyticalPerceptibleOnset,p=project(new C(...old.world));r.gapInducedMotionCssPx=p?Math.hypot(r.analyticalPerceptibleOnset.screen.x-p.x,r.analyticalPerceptibleOnset.screen.y-p.y):null;r.cameraProjectionMotionCssPx=p?Math.hypot(p.x-old.screen.x,p.y-old.screen.y):null;}
      delete r.projectedSamples;frames.push(r);
     }return frames;
    },pathName);
    report.poses.push({source,pathName,frames});
    console.log(label,source,pathName,frames.length);
    fs.writeFileSync(path.join(out,label+'-trace.json'),JSON.stringify(report));
   }
  }
  fs.writeFileSync(path.join(out,label+'-trace.json'),JSON.stringify(report));
  console.log(label,'poses',report.poses.length,'errors',report.errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
