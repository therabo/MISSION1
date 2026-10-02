// QA only: disposable instrumented copies, recorded real API data, frozen UTC.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { chromium } = require(process.env.MISSION1_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.MISSION1_REPO_ROOT;
const out = process.env.MISSION1_EVIDENCE_DIR;
const [port, label, mode = 'all'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({headless:true,args:['--use-angle=metal']});
 try {
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
  await context.addInitScript(()=>{const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,ms>=119000?1000000000:ms,...args);});
  for (const [api,file] of [['samples','real-samples.json'],['comparison','real-comparison.json']])
   await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(path.join(root,'docs/frontend/inspection-orientation-review',file)))}));
  await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
  const page = await context.newPage(), report = {label, browser:browser.version(), errors:[], runs:[]};
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+port);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Inspect ISS'&&!b.disabled),null,{timeout:60000});
  await page.evaluate(()=>{
   const q=globalThis.__qa, H=q.helpers, v=q.viewer, C=H.Cartesian3;
   v.useDefaultRenderLoop=false; v.clock.shouldAnimate=false;
   v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');q.tick();v.render();
   const vec=p=>[p.x,p.y,p.z];
   const at=(t,ms)=>t.position.getValue(H.JulianDate.fromDate(new Date(ms)),new C());
   const inFront=p=>p&&C.dot(C.subtract(p,v.camera.positionWC,new C()),v.camera.directionWC)>v.camera.frustum.near;
   const project=p=>{if(!inFront(p))return null;const a=H.SceneTransforms.worldToWindowCoordinates(v.scene,p,new H.Cartesian2());return a?{x:a.x,y:a.y}:null;};
   const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
   const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const ids=new WeakMap();let counter=0;const id=o=>{if(!ids.has(o))ids.set(o,++counter);return ids.get(o);};
   q.pose=({angle=45,range=6000000,phi=0,earth=0,look=0})=>{
    v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');
    const t=q.trails.trails.find(t=>t.source===q.source),now=H.JulianDate.toDate(v.clock.currentTime).getTime();
    const p=at(t,now),next=at(t,now+1000),f=C.normalize(C.subtract(next,p,new C()),new C());
    const radial=H.Ellipsoid.WGS84.geodeticSurfaceNormal(p,new C());
    const u=C.normalize(C.subtract(radial,C.multiplyByScalar(f,C.dot(radial,f),new C()),new C()),new C());
    const l=C.cross(f,u,new C()),radians=angle*Math.PI/180,azimuth=phi*Math.PI/180;
    const transverse=C.add(C.multiplyByScalar(u,Math.cos(azimuth),new C()),C.multiplyByScalar(l,Math.sin(azimuth),new C()),new C());
    const offset=C.add(C.multiplyByScalar(f,-Math.cos(radians)*range,new C()),C.multiplyByScalar(transverse,Math.sin(radians)*range,new C()),new C());
    let position=C.add(q.model.boundingSphere.center,offset,new C()),target=C.clone(q.model.boundingSphere.center);
    if(earth){const a=earth*Math.PI/180,c=Math.cos(a),s=Math.sin(a);position=new C(position.x*c-position.y*s,position.x*s+position.y*c,position.z);target=C.ZERO;}
    let direction=C.normalize(C.subtract(target,position,new C()),new C());
    if(look){direction=C.normalize(C.add(direction,C.multiplyByScalar(l,look,new C()),new C()),new C());}
    const right=C.normalize(C.cross(direction,Math.abs(C.dot(direction,u))>.99?f:u,new C()),new C()),up=C.normalize(C.cross(right,direction,new C()),new C());
    v.camera.lookAtTransform(H.Matrix4.IDENTITY);C.clone(position,v.camera.position);C.clone(direction,v.camera.direction);C.clone(up,v.camera.up);C.clone(right,v.camera.right);v.camera.frustum.fov=Math.PI/3;
    v.render();
   };
   q.snapshot=async previous=>{
    const t=q.trails.trails.find(t=>t.source===q.source),now=H.JulianDate.toDate(v.clock.currentTime).getTime(),u=t.layers[1].material.uniforms,m=t.layers[1].material.materials.clearanceMask.uniforms;
    const start=t.startMs+u.forwardStart*(t.endMs-t.startMs),end=t.startMs+u.forwardEnd*(t.endMs-t.startMs),physicalEnd=Math.min(t.endMs,now+.85*t.periodSeconds*1000);
    const capturedUtc=H.JulianDate.toIso8601(v.clock.currentTime);
    const hull=H.projectedModelFootprint(v.scene,q.model);
    const distance=(p,ms)=>{
     if(!p)return 0;
     if(m.radius!==undefined){
      if(!m.radius)return 1e10;
      const circle=Math.hypot(p.x-m.center.x,p.y-m.center.y)-m.radius;
      if(!m.initialExternal)return circle;
      const a=m.origin,b=m.tangentA,c=m.tangentB,side=(u,v)=>(v.x-u.x)*(p.y-u.y)-(v.y-u.y)*(p.x-u.x),cross=[side(a,b),side(b,c),side(c,a)];
      const inside=cross.every(x=>x>=0)||cross.every(x=>x<=0),seg=(u,v)=>{const dx=v.x-u.x,dy=v.y-u.y,k=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-u.x-k*dx,p.y-u.y-k*dy);};
      const triangle=Math.min(seg(a,b),seg(b,c),seg(c,a));return Math.min(circle,inside?-triangle:triangle);
     }
     if(!hull)return 1e10;
     let inside=true,d=Infinity;
     for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y;if(dx*(p.y-a.y)-dy*(p.x-a.x)<0)inside=false;const k=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(p.x-a.x-k*dx,p.y-a.y-k*dy));}
     return (inside?0:d)-m.clearance;
    };
    const futureStart=u.futureStart!==undefined?t.startMs+u.futureStart*(t.endMs-t.startMs):start;
    const alpha=ms=>u.maximumAlpha*smooth((ms-futureStart)/Math.max(.001,u.futureStart!==undefined?u.startRamp*(t.endMs-t.startMs):t.rampSeconds*1000))*(1-smooth((ms-start)/(end-start)))*smooth(distance(project(at(t,ms)),ms)/(m.softness||.75));
    const nearExitTimes=t.firstExitMs===null?[]:[1,2,4,8,16,32,64,128,256,512,1000].map(d=>t.firstExitMs+d);
    const queryTimes=[...t.sampleTimes,...nearExitTimes,end-1].filter(ms=>ms>futureStart&&ms<end).sort((a,b)=>a-b);
    let onset=null,previousMs=futureStart,safeSamples=0,perceptibleSafeSamples=0,initialTriangleProtectedSamples=0,cameraClippedSamples=0;
    for(const ms of queryTimes){
     const world=at(t,ms),p=project(world);
     if(!inFront(world))cameraClippedSamples++;
     if(p&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720&&!H.earthOccludes(v.camera.positionWC,world)){
      if(m.radius!==undefined&&Math.hypot(p.x-m.center.x,p.y-m.center.y)-m.radius>(m.softness||.75)&&distance(p,ms)<=(m.softness||.75))initialTriangleProtectedSamples++;
      if(distance(p,ms)>(m.softness||.75)&&u.maximumAlpha*(1-smooth((ms-now)/(physicalEnd-now)))>=.005){safeSamples++;if(alpha(ms)>=.005)perceptibleSafeSamples++;}
     }
     if(!onset&&alpha(ms)>=.005){let lo=previousMs,hi=ms;for(let j=0;j<25&&hi-lo>1;j++){const mid=(hi+lo)/2;if(alpha(mid)>=.005)hi=mid;else lo=mid;}onset={ms:hi,world:vec(at(t,hi)),screen:project(at(t,hi))};}previousMs=ms;
    }
    // Inspect the entire immutable physical arc for safe fragments, including
    // samples a bad start could have clipped. These projections are QA only.
    let cameraSafePhysicalSamples=0,farSafeSamples=0,lostFarSafeSamples=0;const safeRasterScreens=[];
    const originWorld=at(t,now+1),speed=C.distance(originWorld,at(t,now+1001)),range=C.distance(v.camera.positionWC,originWorld);
    const maskRadius=m.radius??(hull?Math.max(...hull.map(p=>Math.hypot(p.x-(Math.min(...hull.map(p=>p.x))+Math.max(...hull.map(p=>p.x)))/2,p.y-(Math.min(...hull.map(p=>p.y))+Math.max(...hull.map(p=>p.y)))/2)))+(m.clearance||0):0);
    const protectedMetres=(maskRadius+10)*2*range/(v.scene.canvas.clientHeight*v.camera.frustum.projectionMatrix[5]);
    const localBoundSeconds=(protectedMetres+Math.sqrt(2*C.magnitude(originWorld)*protectedMetres))/Math.max(1,speed);
    for(const ms of queryTimes){
     if(ms<=now||ms>=physicalEnd)continue;const world=at(t,ms),p=project(world);
     if(p&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720&&distance(p,ms)>(m.softness||.75)&&!H.earthOccludes(v.camera.positionWC,world)&&u.maximumAlpha*(1-smooth((ms-now)/(physicalEnd-now)))>=.005){
      cameraSafePhysicalSamples++;if(alpha(ms)>=.10)safeRasterScreens.push({ms,x:p.x,y:p.y,alpha:alpha(ms)});
      if(ms>now+localBoundSeconds*1000&&u.maximumAlpha*(1-smooth((ms-now)/(physicalEnd-now)))>=.005){farSafeSamples++;if(alpha(ms)<.005)lostFarSafeSamples++;}
     }
    }
    const positions=new Float64Array(t.positions.flatMap(p=>vec(p))),epochs=new Float64Array(t.sampleTimes);
    let length=0,gapLength=0,prev=at(t,now);
    for(const ms of [...t.sampleTimes.filter(ms=>ms>now&&ms<physicalEnd),physicalEnd]){const p=at(t,ms);length+=C.distance(prev,p);prev=p;}
    prev=at(t,now);for(const ms of [...t.sampleTimes.filter(ms=>ms>now&&ms<start),start]){const p=at(t,ms);gapLength+=C.distance(prev,p);prev=p;}
    const old=previous?.onset&&project(new C(...previous.onset.world));
    // Separate camera/mask-driven changes from the effect of the temporal gap.
    // Re-evaluate the old gap with the CURRENT camera and mask, not the old pose.
    let oldGapOnset=null;
    if(previous){
     const oldStart=previous.endpointFadeStartEpoch??previous.firstVisibleEpoch;
     const oldAlpha=ms=>u.maximumAlpha*smooth((ms-(u.futureStart!==undefined?futureStart:oldStart))/Math.max(.001,u.futureStart!==undefined?u.startRamp*(t.endMs-t.startMs):previous.rampSeconds*1000))*(1-smooth((ms-oldStart)/(end-oldStart)))*smooth(distance(project(at(t,ms)),ms)/(m.softness||.75));
     let lo=u.futureStart!==undefined?futureStart:oldStart;
     for(const ms of queryTimes.filter(ms=>ms>(u.futureStart!==undefined?futureStart:oldStart))){
      if(oldAlpha(ms)>=.005){let hi=ms;for(let j=0;j<25&&hi-lo>1;j++){const mid=(hi+lo)/2;if(oldAlpha(mid)>=.005)hi=mid;else lo=mid;}oldGapOnset=project(at(t,hi));break;}lo=ms;
     }
    }
    let perceptibleGapLength=0;prev=at(t,now);if(onset)for(const ms of [...t.sampleTimes.filter(ms=>ms>now&&ms<onset.ms),onset.ms]){const p=at(t,ms);perceptibleGapLength+=C.distance(prev,p);prev=p;}
    const first=project(at(t,now+1)),next=project(at(t,t.sampleTimes.find(ms=>ms>now+1)));
    return {source:q.source,utc:capturedUtc,sampleHash:await hash(positions.buffer),epochHash:await hash(epochs.buffer),sampleCount:t.positions.length,
     firstPhysicalEpoch:now,lastPhysicalEpoch:physicalEnd,physicalEndpoint:vec(at(t,physicalEnd)),physicalPathLength:length,
     firstVisibleEpoch:onset?.ms??null,endpointFadeStartEpoch:start,originProtectionEndEpoch:now+t.gapSeconds*1000,physicalShaderStartEpoch:futureStart,localProtectionSeconds:t.gapSeconds,localProtectionPathMetres:gapLength,adaptiveGapSeconds:onset?(onset.ms-now)/1000:null,adaptiveGapPathMetres:perceptibleGapLength,firstTemporalExitEpoch:t.firstExitMs??null,rampSeconds:t.rampSeconds??0,trajectoryReveal:q.visibility,
     camera:{position:vec(v.camera.positionWC),direction:vec(v.camera.directionWC),up:vec(v.camera.upWC)},endpointScreen:project(at(t,physicalEnd)),
     geometryBuildCount:q.geometryBuildCount??null,primitiveIds:t.layers.map(l=>id(l.primitive)),geometryIds:t.layers.map(l=>id(l.primitive.geometryInstances||l.primitive)),visiblePrimitiveCount:t.layers.filter(l=>l.primitive.show&&l.material.uniforms.maximumAlpha>.005).length,
     safeSamples,cameraSafePhysicalSamples,safeRasterScreens,farSafeSamples,lostFarSafeSamples,localBoundSeconds,perceptibleSafeSamples,initialTriangleProtectedSamples,cameraClippedSamples,adaptiveGapScreenCssPixels:first&&onset?Math.hypot(onset.screen.x-first.x,onset.screen.y-first.y):null,localProtectionScreenCssPixels:first&&project(at(t,start))?Math.hypot(project(at(t,start)).x-first.x,project(at(t,start)).y-first.y):null,unexpectedHidden:cameraSafePhysicalSamples>0&&q.visibility>.01&&(!t.layers.some(l=>l.primitive.show&&l.material.uniforms.maximumAlpha>.005)||!onset||perceptibleSafeSamples===0),
     visibleFraction:onset?(physicalEnd-onset.ms)/(physicalEnd-now):null,physicalShaderFraction:(physicalEnd-futureStart)/(physicalEnd-now),localProtectionFraction:(physicalEnd-start)/(physicalEnd-now),bodyAlpha:u.maximumAlpha,mask:JSON.parse(JSON.stringify(m)),onset,
     priorOnsetProjectedIntoCurrentCameraCssPx:old&&onset?Math.hypot(onset.screen.x-old.x,onset.screen.y-old.y):null,
     gapInducedOriginMotionCssPx:oldGapOnset&&onset?Math.hypot(onset.screen.x-oldGapOnset.x,onset.screen.y-oldGapOnset.y):null,
     firstProjectedIntervalCssPx:first&&next?Math.hypot(next.x-first.x,next.y-first.y):null,trajectoryCpu:q.trajectoryCpu};
   };
  });

  await page.evaluate(()=>{const q=globalThis.__qa;q.gpuHide=false;q.gpuOld=null;q.viewer.scene.preRender.addEventListener(()=>{
   for(const t of q.trails.trails)for(const l of t.layers){l.primitive.show=!q.gpuHide&&t.source===q.source;
    if(q.gpuOld&&t.source===q.source){l.material.uniforms.forwardStart=q.gpuOld.start;}}
  });});
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   for(const name of mode.startsWith('memory')?['memory']:['axis','crossing']){
    const frames=[];let previous=null;
    for(let i=0;i<(mode==='memory-quick'?15:250);i++){
     const p=i/249,f=(i+(mode==='memory-quick'?360:250))/499,pose=name==='memory'?{angle:180+20*Math.sin(12*Math.PI*f),range:500000+16500000*(1+Math.cos(4*Math.PI*f))/2,phi:0}:name==='axis'?{angle:175+10*p,range:500000+7500000*p}:{angle:30-60*p,range:500000+7500000*p};
     const row=await page.evaluate(async({pose,previous})=>{const q=globalThis.__qa;q.gpuOld=null;q.gpuHide=false;q.pose(pose);return q.snapshot(previous);},{pose,previous});
     const prefix=path.join(out,`${label}-${source}-${name}-${String(i).padStart(3,'0')}`),clip={x:550,y:170,width:180,height:540};
     await page.evaluate(()=>{const q=globalThis.__qa;q.gpuHide=true;q.viewer.render();});
     await page.screenshot({path:prefix+'-off-before.png',clip});
     await page.evaluate(()=>{const q=globalThis.__qa;q.gpuHide=false;q.viewer.render();});
     await page.screenshot({path:prefix+'-current.png',clip});
     if(previous){await page.evaluate(previous=>{const q=globalThis.__qa,t=q.trails.trails.find(t=>t.source===q.source),span=t.endMs-t.startMs;q.gpuOld={start:(previous.endpointFadeStartEpoch-t.startMs)/span,end:(previous.originProtectionEndEpoch-t.startMs)/span};q.viewer.render();},previous);}
     await page.screenshot({path:prefix+'-previous-gap.png',clip});
     await page.evaluate(()=>{const q=globalThis.__qa;q.gpuHide=true;q.gpuOld=null;q.viewer.render();});
     await page.screenshot({path:prefix+'-off.png',clip});
     row.frame=i;row.pose=pose;row.rasterClip=clip;frames.push(row);previous=row;
    }
    fs.writeFileSync(path.join(out,`${label}-${source}-${name}.json.gz`),zlib.gzipSync(JSON.stringify(frames)));
    report.runs.push({source,name,frames:frames.length});fs.writeFileSync(path.join(out,label+'-summary.json'),JSON.stringify(report,null,2));console.log(label,source,name,frames.length,'native current / old-gap / off frames');
   }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
