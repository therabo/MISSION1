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
    return {timestamp:H.JulianDate.toIso8601(v.clock.currentTime),cameraPosition:vec(v.camera.positionWC),cameraDirection:vec(v.camera.directionWC),cameraToDisplayedIssRange:C.distance(v.camera.positionWC,q.model.boundingSphere.center),selectedSource:q.source,displayedIssPosition:vec(q.model.boundingSphere.center),trajectoryReveal:q.visibility,futureProjectedDirection:[dx,dy],futureProjectedDirectionLengthPx:len,futureProjectedDirectionAngle:Math.atan2(dy,dx),adaptiveGapSeconds:t.gapSeconds,firstVisibleEpoch:new Date(start).toISOString(),firstVisibleWorldPosition:vec(first),firstVisibleScreenPosition:project(first),secondVisibleEpoch:new Date(start+1000).toISOString(),secondVisibleScreenPosition:project(at(start+1000)),hull:H.projectedModelFootprint(v.scene,q.model),bodyAlpha:u.maximumAlpha,haloAlpha:t.layers[0].material.uniforms.maximumAlpha,mask:t.layers[1].material.materials.clearanceMask.uniforms,projectedSamples:t.sampleTimes.map(ms=>({ms,pixel:project(at(ms))}))};
   };
  });
  for(const source of ['PRIMARY_GP_TLE','NASA_OEM']){
   await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).evaluate(b=>b.click());
   for(const pose of [{angle:15.54,range:2307000,phi:0},{angle:13.6,range:2500000,phi:0},{angle:20,range:1700000,phi:0}]){
    await page.evaluate(p=>{for(const t of globalThis.__qa.trails.trails)t.gapSeconds=null;globalThis.__qa.pose(p)},pose); await page.waitForTimeout(120);
    await page.evaluate(()=>{const q=globalThis.__qa;q.tick();q.viewer.render()});
    for(const mode of ['normal','body','halo','no-mask','reveal-one','no-silhouette','no-fxaa','no-depth','no-globe','active-only']){
     const row=await page.evaluate(mode=>{
      const q=globalThis.__qa,v=q.viewer,undo=[];
      if(mode==='no-mask')for(const t of q.trails.trails)for(const l of t.layers){const u=l.material.materials.clearanceMask.uniforms,old=u.clearance;u.clearance=-10;undo.push(()=>u.clearance=old)}
      if(mode==='no-silhouette'){const old=q.model.silhouetteColor.alpha;q.model.silhouetteColor.alpha=0;undo.push(()=>q.model.silhouetteColor.alpha=old)}
      if(mode==='no-fxaa'){for(let i=0;i<v.scene.postProcessStages.length;i++){const st=v.scene.postProcessStages.get(i),old=st.enabled;st.enabled=false;undo.push(()=>st.enabled=old)}}
      if(mode==='no-globe'){const old=v.scene.globe.show;v.scene.globe.show=false;undo.push(()=>v.scene.globe.show=old)}
      if(mode==='no-depth')for(const t of q.trails.trails)for(const l of t.layers){const old=l.primitive.appearance;l.primitive.appearance=new old.constructor({material:l.material,vertexShaderSource:old.vertexShaderSource,fragmentShaderSource:old.fragmentShaderSource,translucent:true,renderState:{depthTest:{enabled:false},depthMask:false}});undo.push(()=>l.primitive.appearance=old)}
      const remove=v.scene.preRender.addEventListener(()=>{
       for(const t of q.trails.trails)for(const [i,l] of t.layers.entries()){
        if((mode==='body'&&i===0)||(mode==='halo'&&i===1)||(mode==='active-only'&&t.source!==q.source))l.primitive.show=false;
        if(mode==='no-mask')l.material.materials.clearanceMask.uniforms.clearance=-10;
        if(mode==='reveal-one')l.material.uniforms.maximumAlpha=t.gapSeconds===null?0:(t.source===q.source?.85:.08)*(i===0?.26:1);
       }
       if(mode==='no-silhouette'){q.model.silhouetteColor.alpha=0;q.model.silhouetteSize=0;}
       if(mode==='no-fxaa'){v.scene.postProcessStages.fxaa.enabled=false;for(let i=0;i<v.scene.postProcessStages.length;i++)v.scene.postProcessStages.get(i).enabled=false;}
      });
      undo.push(remove);q.undo=()=>{undo.forEach(f=>f());q.tick();v.render()};
      for(let i=0;i<4;i++)v.render();return {snapshot:q.snapshot(),renderStates:q.trails.trails.map(t=>t.layers.map(l=>l.primitive.appearance.getRenderState()))};
     },mode);
     report.poses.push({pose,mode,...row});
     await page.screenshot({path:path.join(out,`${label}-${source}-${pose.range}-${pose.angle}-${pose.phi}-${mode}.png`)});
     await page.evaluate(()=>globalThis.__qa.undo());
    }
   }
  }
  fs.writeFileSync(path.join(out,label+'-sweep.json'),JSON.stringify(report));
  console.log(label,'poses',report.poses.length,'errors',report.errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
