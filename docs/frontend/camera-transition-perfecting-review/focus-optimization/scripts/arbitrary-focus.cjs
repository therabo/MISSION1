// Diagnostic only, public Cesium hooks in disposable archives. Real recorded API fixtures.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.MISSION1_PLAYWRIGHT_MODULE||'playwright');
const repo=process.env.MISSION1_REPO_ROOT||'/Users/daniel/Desktop/MISSION1';
const out=process.env.MISSION1_EVIDENCE_DIR||repo+'/docs/frontend/camera-transition-perfecting-review/focus-optimization';
const port=+process.argv[2],label=process.argv[3],resourceOnly=!!process.env.MISSION1_QA_RESOURCE_ONLY;
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=metal']});try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2,hasTouch:true});
 for(const [api,file]of [['samples','real-samples.json'],['comparison','real-comparison.json']])await context.route('**/api/iss/orbit/'+api,r=>r.fulfill({json:JSON.parse(fs.readFileSync(repo+'/docs/frontend/inspection-orientation-review/'+file))}));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort('failed'));
 const page=await context.newPage(),report={label,entries:[],exits:[],cycles:[],resources:[],errors:[],consoleErrors:[]};
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|gibs/.test(m.text()))report.consoleErrors.push(m.text());});
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>globalThis.__qa?.model?.ready,null,{timeout:60000});
 await page.evaluate(()=>{const q=globalThis.__qa,gl=q.viewer.scene.canvas.getContext('webgl2');q.slowGl=[];q.linkedPrograms=[];for(const name of ['linkProgram','getProgramParameter','drawElements','drawArrays']){const original=gl[name];gl[name]=function(...args){const before=performance.now(),result=original.apply(this,args),milliseconds=performance.now()-before;if(name==='linkProgram'&&q.flight){q.linkedPrograms.push({case:q.caseName,source:q.source,mode:q.mode,progress:q.progress,shaders:gl.getAttachedShaders(args[0]).map(shader=>gl.getShaderSource(shader))});}if(milliseconds>10){const program=name==='linkProgram'||name==='getProgramParameter'?args[0]:gl.getParameter(gl.CURRENT_PROGRAM);q.slowGl.push({name,milliseconds,mode:q.mode,progress:q.progress,case:q.caseName??'warmup',source:q.source,shaders:program?gl.getAttachedShaders(program).map(shader=>gl.getShaderSource(shader)):[]});}return result;};}});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Inspect ISS')?.disabled===false);
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
 const resource=()=>page.evaluate(()=>{const q=globalThis.__qa,v=q.viewer,s=v.scene;
  if(!q.resources)q.resources={model:q.model,globe:s.globe,sky:s.skyAtmosphere,box:s.skyBox,stages:s.postProcessStages,providers:Array.from({length:v.imageryLayers.length},(_,i)=>v.imageryLayers.get(i).imageryProvider)};
  return {modelSame:q.resources.model===q.model,globeSame:q.resources.globe===s.globe,atmosphereSame:q.resources.sky===s.skyAtmosphere,postSame:q.resources.stages===s.postProcessStages,providersSame:q.resources.providers.every((p,i)=>p===v.imageryLayers.get(i)?.imageryProvider),primitives:s.primitives.length,layers:v.imageryLayers.length,modelReady:q.model.ready,activeTransition:!!q.flight,resolutionScale:v.resolutionScale,canvas:[s.canvas.width,s.canvas.height],msaa:s.msaaSamples,fxaaStages:s.postProcessStages.length,modelScale:q.model.scale,minimumPixelSize:q.model.minimumPixelSize};});
 const snap=()=>page.evaluate(()=>{const q=globalThis.__qa,H=q.helpers,c=q.viewer.camera,vec=a=>[a.x,a.y,a.z];return {position:vec(c.positionWC),direction:vec(c.directionWC),up:vec(c.upWC),fov:c.frustum.fov,near:c.frustum.near,far:c.frustum.far,transform:Array.from(c.transform),controller:Object.fromEntries(['enableInputs','enableZoom','enableTranslate','enableLook','enableTilt','zoomFactor','minimumZoomDistance','maximumZoomDistance','inertiaZoom','inertiaSpin','inertiaTranslate'].map(k=>[k,q.viewer.scene.screenSpaceCameraController[k]]))};});
 const pose=async name=>{await page.evaluate(name=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;delete q.override;v.clock.shouldAnimate=false;v.clock.currentTime=H.JulianDate.fromIso8601('2026-09-30T15:45:59.975908Z');q.tick();const p=q.positionAt(v.clock.currentTime,new H.Cartesian3()),g=H.Ellipsoid.WGS84.cartesianToCartographic(p);let position=new H.Cartesian3(-9412786.358621413,-21163227.169227634,-3167995.3206285993),target=H.Cartesian3.ZERO;
  if(name==='far')position=H.Cartesian3.multiplyByScalar(position,3,new H.Cartesian3());
  if(name==='close')position=H.Cartesian3.fromRadians(g.longitude,g.latitude,2_000_000);
  if(name==='rotated')position=H.Cartesian3.fromRadians(g.longitude+Math.PI/2,0,17_000_000);
  if(name==='limb')position=H.Cartesian3.fromRadians(g.longitude+70*Math.PI/180,g.latitude,17_000_000);
  if(name==='pitch'){position=H.Cartesian3.fromRadians(g.longitude+30*Math.PI/180,60*Math.PI/180,17_000_000);target=H.Cartesian3.fromRadians(g.longitude+10*Math.PI/180,10*Math.PI/180,0);}
  const direction=H.Cartesian3.normalize(H.Cartesian3.subtract(target,position,new H.Cartesian3()),new H.Cartesian3());
  const up=H.Cartesian3.normalize(H.Cartesian3.cross(H.Cartesian3.cross(direction,H.Cartesian3.UNIT_Z,new H.Cartesian3()),direction,new H.Cartesian3()),new H.Cartesian3());
  if(name==='canonical'){direction.x=.40258878698283174;direction.y=.9051600270198104;direction.z=.13640965538109276;up.x=-.055435177167269443;up.y=-.12463761556457154;up.z=.9906525152235831;}
  v.camera.lookAtTransform(H.Matrix4.IDENTITY);v.camera.setView({destination:position,orientation:{direction,up}});v.camera.frustum.fov=Math.PI/3;
 },name);await page.waitForTimeout(100);};
 async function inspect(){await page.getByRole('button',{name:'Inspect ISS',exact:true}).click();await page.evaluate(()=>{const q=globalThis.__qa;q.flightClass=q.flight.constructor;});}
 // Every rendered sample uses the real tick, retained model and native output. Clock
 // frozen for deterministic arbitrary-geometry analysis; separate real-time traces profile pacing.
 async function sweep(direction,name){
  await page.evaluate(name=>{globalThis.__qa.caseName=name;},direction+'-'+name);
  const setup=await page.evaluate(resourceOnly=>{const q=globalThis.__qa,H=q.helpers,f=q.flight;let minHeight=Infinity,maxStep=0,previous=null,minRay=Infinity;for(let i=0;i<=(resourceOnly?0:2000);i++){const progress=i/2000,physical=H.Matrix4.getTranslation(q.frame,new H.Cartesian3());const normal=H.Ellipsoid.WGS84.geodeticSurfaceNormal(physical,new H.Cartesian3());const target=H.Cartesian3.add(physical,H.Cartesian3.multiplyByScalar(normal,75000*f.presentationAt(progress),normal),new H.Cartesian3());const p=f.evaluate(q.frame,progress,target);minHeight=Math.min(minHeight,H.Ellipsoid.WGS84.cartesianToCartographic(p.position).height);if(previous)maxStep=Math.max(maxStep,H.CesiumMath.toDegrees(H.Cartesian3.angleBetween(previous,p.direction)));previous=H.Cartesian3.clone(p.direction);if(f.focusPoint)minRay=Math.min(minRay,H.Cartesian3.distance(f.focusPoint,p.position));}return {duration:f.duration,pathLength:f.pathLength,minHeight,maxDirectionStep:maxStep,minFocusRadius:Number.isFinite(minRay)?minRay:null,focusBudget:f.composition?.focusBudget??null};},resourceOnly);
  const frames=[];
  for(const i of resourceOnly&&!process.env.MISSION1_QA_RESOURCE_DENSE?[0,1,5,10,20,30,50,70,80,90,95,99,100]:Array.from({length:101},(_,i)=>i)){
   const row=await page.evaluate(async p=>{const q=globalThis.__qa,H=q.helpers,v=q.viewer;q.override=p;q.tick();await new Promise(resolve=>{const remove=v.scene.postRender.addEventListener(()=>{remove();resolve();});});const c=v.camera,vec=a=>a?[a.x,a.y,a.z]:null,project=a=>{const s=H.SceneTransforms.worldToWindowCoordinates(v.scene,a);return s?[s.x,s.y]:null;};return {progress:p,position:vec(c.positionWC),direction:vec(c.directionWC),up:vec(c.upWC),fov:c.frustum.fov,focus:vec(q.flight?.focusPoint),focusBlend:q.flight?.focusBlend??null,issScreen:project(q.model.boundingSphere.center),earthScreen:project(H.Cartesian3.ZERO),height:H.Ellipsoid.WGS84.cartesianToCartographic(c.positionWC).height,range:H.Cartesian3.distance(c.positionWC,q.positionAt(v.clock.currentTime,new H.Cartesian3())),lift:H.Cartesian3.distance(q.model.boundingSphere.center,q.positionAt(v.clock.currentTime,new H.Cartesian3())),silhouette:q.model.silhouetteSize};},i/100);frames.push(row);
   if(!resourceOnly&&[0,10,20,30,50,70,90,100].includes(i))await page.screenshot({path:out+'/'+label+'-'+report.source+'-'+direction+'-'+name+'-'+i+'.jpg',type:'jpeg',quality:75});
  }
  await page.evaluate(()=>delete globalThis.__qa.override);
  return {...setup,frames,after:await snap()};
 }
 for(const source of process.env.MISSION1_QA_PROBE_SOURCE?[process.env.MISSION1_QA_PROBE_SOURCE]:['PRIMARY_GP_TLE','NASA_OEM']){
  report.source=source;await page.getByRole('button',{name:source==='NASA_OEM'?'NASA OEM':'MISSION1 GP/TLE',exact:true}).click();
  report.resources.push({source,stage:'before',...await resource()});await cdp.send('HeapProfiler.collectGarbage');const beforeHeap=await cdp.send('Runtime.getHeapUsage');
  for(const name of ['canonical','far','close','rotated','limb','pitch']){
   await pose(name);const saved=await snap();await inspect();const entry=await sweep('entry',name);report.entries.push({source,name,saved,...entry});
   await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();const exit=await sweep('exit',name);report.exits.push({source,name:'from-'+name,saved,...exit});
  }
  for(const name of ['close-module','max-zoom','orbit-90','orbit-180']){
   await pose('canonical');const saved=await snap();await inspect();await page.evaluate(()=>{const q=globalThis.__qa;q.override=1;q.tick();delete q.override;});
   await page.evaluate(name=>{const q=globalThis.__qa,H=q.helpers;let offset=new H.Cartesian3(-66.354960313,0,60.803118685);if(name==='close-module')offset=H.Cartesian3.multiplyByScalar(offset,.65,offset);if(name==='max-zoom')offset=H.Cartesian3.multiplyByScalar(offset,2000/90,offset);if(name==='orbit-90'){offset.y=offset.x;offset.x=0;}if(name==='orbit-180')offset.x=-offset.x;q.viewer.camera.lookAtTransform(q.frame,offset);},name);await page.waitForTimeout(100);
   const actual=await snap();await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();report.exits.push({source,name,saved,actual,...await sweep('exit',name)});
  }
  for(let cycle=0;cycle<(resourceOnly?0:10);cycle++){
   await pose('canonical');const saved=await snap();await inspect();await page.evaluate(async()=>{const q=globalThis.__qa;for(let i=0;i<=20;i++){q.override=i/20;q.tick();await new Promise(r=>requestAnimationFrame(r));}delete q.override;});
   await page.getByRole('button',{name:'Back to Earth View',exact:true}).click();await page.evaluate(async()=>{const q=globalThis.__qa;for(let i=0;i<=20;i++){q.override=i/20;q.tick();await new Promise(r=>requestAnimationFrame(r));}delete q.override;});
   report.cycles.push({source,cycle,saved,after:await snap(),resources:await resource(),heap:await cdp.send('Runtime.getHeapUsage')});
  }
  await cdp.send('HeapProfiler.collectGarbage');const afterHeap=await cdp.send('Runtime.getHeapUsage');
  const proto=await cdp.send('Runtime.evaluate',{expression:'globalThis.__qa.flightClass.prototype'});const objects=await cdp.send('Runtime.queryObjects',{prototypeObjectId:proto.result.objectId});const count=await cdp.send('Runtime.callFunctionOn',{objectId:objects.objects.objectId,functionDeclaration:'function(){return this.length}',returnByValue:true});await cdp.send('Runtime.releaseObject',{objectId:objects.objects.objectId});
  report.slowGl=await page.evaluate(()=>globalThis.__qa.slowGl);report.linkedPrograms=await page.evaluate(()=>globalThis.__qa.linkedPrograms);
  report.resources.push({source,stage:'after',beforeHeap,afterHeap,retainedTransitions:count.result.value,...await resource()});
  fs.writeFileSync(out+'/'+label+'-arbitrary.json',JSON.stringify(report,null,2));console.log(label,source,'matrix complete');
 }
 if(report.errors.length||report.consoleErrors.length)throw Error(JSON.stringify({errors:report.errors,console:report.consoleErrors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
